const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const archiver = require('archiver');
const adb = require('./adb');
const packageScanner = require('./packageScanner');

const DEFAULT_BACKUPS_DIR = path.join(__dirname, '..', '..', 'backups');

class BackupService {
  constructor(backupsDir = DEFAULT_BACKUPS_DIR) {
    this.backupsDir = backupsDir;
    this._ensureDir(this.backupsDir);
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  _sanitizeName(str) {
    return (str || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  _getDeviceFolder(model, serial) {
    const cleanModel = this._sanitizeName(model);
    const cleanSerial = this._sanitizeName(serial);
    return path.join(this.backupsDir, `${cleanModel}_${cleanSerial}`);
  }

  async checkHostFreeSpace(minBytes = 50 * 1024 * 1024) {
    return new Promise((resolve) => {
      fs.statfs(this.backupsDir, (err, stats) => {
        if (err || !stats) {
          return resolve({ ok: true, freeBytes: 1024 * 1024 * 1024 });
        }
        const freeBytes = Number(stats.bfree) * Number(stats.bsize);
        resolve({
          ok: freeBytes > minBytes,
          freeBytes,
          freeMB: Math.round(freeBytes / (1024 * 1024))
        });
      });
    });
  }

  _computeFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', chunk => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', err => reject(err));
    });
  }

  /**
   * Back up selected packages to host with verification
   */
  async createBackup(serial, packageNames, options = {}, onProgress = null) {
    if (!serial) throw new Error('Device serial is required.');
    if (!Array.isArray(packageNames) || packageNames.length === 0) {
      throw new Error('At least one package name must be specified for backup.');
    }

    // 1. Check host space
    const spaceCheck = await this.checkHostFreeSpace(100 * 1024 * 1024);
    if (!spaceCheck.ok) {
      throw new Error(`Insufficient host disk space for backup (${spaceCheck.freeMB} MB free).`);
    }

    // 2. Fetch device capabilities
    const caps = await adb.getDeviceCapabilities(serial);
    const deviceFolder = this._getDeviceFolder(caps.model, serial);
    this._ensureDir(deviceFolder);

    // Timestamp format: 2026-11-07T10-15-00Z
    const timestampStr = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, 'Z');
    const backupId = timestampStr;
    const sessionDir = path.join(deviceFolder, backupId);
    this._ensureDir(sessionDir);

    const allScanned = await packageScanner.scanPackages(serial);
    const scannedMap = new Map(allScanned.map(p => [p.name, p]));

    const manifest = {
      device: {
        serial,
        model: caps.model,
        android: caps.androidVersion,
        sdk: caps.apiLevel,
        cpuAbi: caps.cpuAbi
      },
      createdAt: new Date().toISOString(),
      backupId,
      packages: []
    };

    let totalBytes = 0;
    const totalCount = packageNames.length;

    for (let i = 0; i < packageNames.length; i++) {
      const pkgName = packageNames[i];
      if (onProgress) {
        onProgress({
          step: 'backup',
          package: pkgName,
          status: 'running',
          message: `Backing up ${pkgName} (${i + 1}/${totalCount})...`,
          progress: { current: i + 1, total: totalCount }
        });
      }

      const scanned = scannedMap.get(pkgName);
      const pkgFolder = path.join(sessionDir, pkgName);
      this._ensureDir(pkgFolder);

      // Query APK paths with pm path
      let paths = [];
      try {
        const { stdout: pathOut } = await adb.execAdb(['-s', serial, 'shell', 'pm', 'path', pkgName], { timeout: 10000 });
        paths = pathOut.split('\n').map(l => l.trim().replace(/^package:/, '')).filter(Boolean);
      } catch (_) {}

      if (paths.length === 0 && scanned && scanned.paths) {
        paths = scanned.paths;
      }

      if (paths.length === 0) {
        throw new Error(`Cannot locate APK path for package "${pkgName}".`);
      }

      const backupFiles = [];

      for (const remotePath of paths) {
        const fileName = path.basename(remotePath);
        const localTarget = path.join(pkgFolder, fileName);

        // Pull APK to host PC
        await adb.execAdb(['-s', serial, 'pull', remotePath, localTarget], { timeout: 300000 }); // 5 min timeout

        // Verification 1: local file exists and size > 0
        if (!fs.existsSync(localTarget)) {
          throw new Error(`Backup failed: pulled file ${fileName} does not exist on host.`);
        }
        const localStat = fs.statSync(localTarget);
        if (localStat.size === 0) {
          throw new Error(`Backup failed: pulled file ${fileName} is empty (0 bytes).`);
        }

        // Verification 2: check remote size match if readable
        try {
          const { stdout: lsOut } = await adb.execAdb(['-s', serial, 'shell', 'ls', '-l', remotePath], { timeout: 5000 });
          const parts = lsOut.trim().split(/\s+/);
          for (let j = 2; j < parts.length; j++) {
            if (/^\d{3,}$/.test(parts[j])) {
              const remoteSize = parseInt(parts[j], 10);
              if (remoteSize > 0 && remoteSize !== localStat.size) {
                throw new Error(`Size mismatch for ${fileName}: remote ${remoteSize} bytes vs local ${localStat.size} bytes.`);
              }
              break;
            }
          }
        } catch (_) {}

        // Compute SHA-256
        const sha256 = await this._computeFileHash(localTarget);
        totalBytes += localStat.size;

        backupFiles.push({
          file: `${pkgName}/${fileName}`,
          remotePath,
          bytes: localStat.size,
          sha256
        });

        // Try pulling matching .odex for Android 4.x
        if (remotePath.endsWith('.apk') && (caps.apiLevel < 21)) {
          const odexPath = remotePath.replace(/\.apk$/, '.odex');
          const odexName = path.basename(odexPath);
          const localOdex = path.join(pkgFolder, odexName);
          try {
            await adb.execAdb(['-s', serial, 'pull', odexPath, localOdex], { timeout: 30000 });
            if (fs.existsSync(localOdex) && fs.statSync(localOdex).size > 0) {
              const odexStat = fs.statSync(localOdex);
              const odexSha = await this._computeFileHash(localOdex);
              backupFiles.push({
                file: `${pkgName}/${odexName}`,
                remotePath: odexPath,
                bytes: odexStat.size,
                sha256: odexSha,
                isOdex: true
              });
              totalBytes += odexStat.size;
            }
          } catch (_) {
            // Ignore .odex pull failure if absent
          }
        }
      }

      let versionName = 'Unknown';
      try {
        const details = await packageScanner.getPackageDetails(serial, pkgName);
        versionName = details.versionName || 'Unknown';
      } catch (_) {}

      manifest.packages.push({
        name: pkgName,
        category: scanned ? scanned.category : 'unknown',
        originalPaths: paths,
        files: backupFiles,
        versionName,
        enabledAtBackup: scanned ? scanned.enabled : true
      });

      if (onProgress) {
        onProgress({
          step: 'backup',
          package: pkgName,
          status: 'done',
          message: `Backed up ${pkgName} (${backupFiles.length} files).`,
          progress: { current: i + 1, total: totalCount }
        });
      }
    }

    manifest.totalBytes = totalBytes;

    // Write manifest.json
    const manifestPath = path.join(sessionDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    return {
      success: true,
      backupId,
      sessionDir,
      manifest
    };
  }

  /**
   * List all backups for a device
   */
  async listBackups(serial) {
    if (!serial) throw new Error('Device serial is required.');

    const caps = await adb.getDeviceCapabilities(serial).catch(() => ({ model: 'device' }));
    const deviceFolder = this._getDeviceFolder(caps.model, serial);

    const backups = [];

    // Also check any folder ending with `_${serial}` in case model string changed
    const targetFolders = [deviceFolder];
    if (fs.existsSync(this.backupsDir)) {
      const dirs = fs.readdirSync(this.backupsDir);
      for (const d of dirs) {
        if (d.endsWith(`_${this._sanitizeName(serial)}`) && path.join(this.backupsDir, d) !== deviceFolder) {
          targetFolders.push(path.join(this.backupsDir, d));
        }
      }
    }

    for (const folder of targetFolders) {
      if (!fs.existsSync(folder)) continue;
      const entries = fs.readdirSync(folder, { withFileTypes: true });

      for (const ent of entries) {
        if (ent.isDirectory()) {
          const sessionPath = path.join(folder, ent.name);
          const manifestPath = path.join(sessionPath, 'manifest.json');
          if (fs.existsSync(manifestPath)) {
            try {
              const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
              backups.push({
                backupId: ent.name,
                deviceFolder: folder,
                createdAt: manifest.createdAt || ent.name,
                device: manifest.device || {},
                packageCount: Array.isArray(manifest.packages) ? manifest.packages.length : 0,
                totalBytes: manifest.totalBytes || 0,
                packages: (manifest.packages || []).map(p => ({
                  name: p.name,
                  category: p.category,
                  versionName: p.versionName,
                  fileCount: p.files ? p.files.length : 0
                }))
              });
            } catch (_) {}
          }
        }
      }
    }

    // Sort descending by creation date
    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return backups;
  }

  /**
   * Get full manifest for a backup
   */
  async getBackupDetails(serial, backupId) {
    const caps = await adb.getDeviceCapabilities(serial).catch(() => ({ model: 'device' }));
    const deviceFolder = this._getDeviceFolder(caps.model, serial);
    const sessionDir = path.join(deviceFolder, backupId);
    const manifestPath = path.join(sessionDir, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      // Search in other folders for this serial
      const allBackups = await this.listBackups(serial);
      const found = allBackups.find(b => b.backupId === backupId);
      if (found) {
        const altManifestPath = path.join(found.deviceFolder, backupId, 'manifest.json');
        if (fs.existsSync(altManifestPath)) {
          return JSON.parse(fs.readFileSync(altManifestPath, 'utf8'));
        }
      }
      throw new Error(`Backup "${backupId}" not found for device ${serial}.`);
    }

    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  /**
   * Delete a backup session
   */
  async deleteBackup(serial, backupId) {
    const caps = await adb.getDeviceCapabilities(serial).catch(() => ({ model: 'device' }));
    const deviceFolder = this._getDeviceFolder(caps.model, serial);
    const sessionDir = path.join(deviceFolder, backupId);

    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      return { success: true };
    }

    const allBackups = await this.listBackups(serial);
    const found = allBackups.find(b => b.backupId === backupId);
    if (found) {
      const altDir = path.join(found.deviceFolder, backupId);
      if (fs.existsSync(altDir)) {
        fs.rmSync(altDir, { recursive: true, force: true });
        return { success: true };
      }
    }

    throw new Error(`Backup "${backupId}" not found.`);
  }

  /**
   * Export backup as ZIP archive stream
   */
  async exportBackupZip(serial, backupId, outputStream) {
    const manifest = await this.getBackupDetails(serial, backupId);
    const caps = await adb.getDeviceCapabilities(serial).catch(() => ({ model: 'device' }));
    const deviceFolder = this._getDeviceFolder(caps.model, serial);
    let sessionDir = path.join(deviceFolder, backupId);

    if (!fs.existsSync(sessionDir)) {
      const allBackups = await this.listBackups(serial);
      const found = allBackups.find(b => b.backupId === backupId);
      if (found) {
        sessionDir = path.join(found.deviceFolder, backupId);
      }
    }

    if (!fs.existsSync(sessionDir)) {
      throw new Error(`Backup session directory not found for ${backupId}`);
    }

    const archive = typeof archiver === 'function' 
      ? archiver('zip', { zlib: { level: 6 } }) 
      : (archiver.create ? archiver.create('zip', { zlib: { level: 6 } }) : new archiver.ZipArchive({ zlib: { level: 6 } }));

    archive.pipe(outputStream);
    archive.directory(sessionDir, false);
    await archive.finalize();
  }

  /**
   * Verify backup file integrity using SHA-256 before restoration
   */
  async verifyBackupFile(sessionDir, fileEntry) {
    const localPath = path.join(sessionDir, fileEntry.file);
    if (!fs.existsSync(localPath)) {
      throw new Error(`Backup file "${fileEntry.file}" is missing from host storage.`);
    }

    const hash = await this._computeFileHash(localPath);
    if (hash !== fileEntry.sha256) {
      throw new Error(`Corrupted backup detected for "${fileEntry.file}": SHA-256 mismatch.`);
    }

    return localPath;
  }
}

module.exports = new BackupService();
