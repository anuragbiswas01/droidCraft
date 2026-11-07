const adb = require('./adb');
const packageKnowledge = require('./packageKnowledge');

const PACKAGE_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const ALLOWED_PATH_PREFIXES = [
  '/system/',
  '/vendor/',
  '/oem/',
  '/product/',
  '/system_ext/',
  '/data/app/'
];

class PackageScanner {
  constructor() {
    this.packageCache = new Map(); // serial -> { timestamp, packages }
    this.detailsCache = new Map(); // `${serial}:${pkgName}` -> details
    this.CACHE_TTL = 30000; // 30 seconds
  }

  isValidPackageName(name) {
    if (!name || typeof name !== 'string') return false;
    if (name === 'android') return true;
    return PACKAGE_NAME_REGEX.test(name);
  }

  isPathAllowed(remotePath) {
    if (!remotePath || typeof remotePath !== 'string') return false;
    return ALLOWED_PATH_PREFIXES.some(prefix => remotePath.startsWith(prefix));
  }

  invalidateCache(serial) {
    if (serial) {
      this.packageCache.delete(serial);
      for (const key of this.detailsCache.keys()) {
        if (key.startsWith(`${serial}:`)) {
          this.detailsCache.delete(key);
        }
      }
    } else {
      this.packageCache.clear();
      this.detailsCache.clear();
    }
  }

  /**
   * Helper to execute pm command with --user 0 fallback
   */
  async _execPmList(serial, flag) {
    try {
      const res = await adb.execAdb(['-s', serial, 'shell', 'pm', 'list', 'packages', '--user', '0', flag], { timeout: 15000 });
      return res.stdout;
    } catch (_) {
      const res = await adb.execAdb(['-s', serial, 'shell', 'pm', 'list', 'packages', flag], { timeout: 15000 });
      return res.stdout;
    }
  }

  /**
   * Scan and classify all packages on the device
   */
  async scanPackages(serial, options = {}) {
    if (!serial) throw new Error('Device serial is required.');

    const forceRefresh = !!options.refresh;
    const cached = this.packageCache.get(serial);
    if (!forceRefresh && cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
      return cached.packages;
    }

    // 1. Get device capabilities / context for protection resolution
    const caps = await adb.getDeviceCapabilities(serial, forceRefresh).catch(() => ({}));
    const context = {
      activeLauncher: caps.activeLauncher || null,
      activeIme: caps.activeIme || null
    };

    // 2. Fetch basic lists concurrently
    const [allOut, sysOut, thirdOut, disOut] = await Promise.all([
      this._execPmList(serial, '-f'),
      this._execPmList(serial, '-s').catch(() => ''),
      this._execPmList(serial, '-3').catch(() => ''),
      this._execPmList(serial, '-d').catch(() => '')
    ]);

    // Parse sets
    const parsePkgSet = (str) => {
      const set = new Set();
      str.split('\n').forEach(line => {
        const clean = line.trim().replace(/^package:/, '');
        if (clean) set.add(clean);
      });
      return set;
    };

    const systemSet = parsePkgSet(sysOut);
    const thirdPartySet = parsePkgSet(thirdOut);
    const disabledSet = parsePkgSet(disOut);

    // Optional: parse dumpsys package flags leniently if available
    const dumpsysFlagsMap = new Map();
    try {
      const { stdout: dumpOut } = await adb.execAdb(['-s', serial, 'shell', 'dumpsys', 'package', 'packages'], { timeout: 8000 });
      const blocks = dumpOut.split(/Package\s*\[/);
      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const endBracket = block.indexOf(']');
        if (endBracket > 0) {
          const pkg = block.substring(0, endBracket).trim();
          const flagsMatch = block.match(/(?:pkgFlags|flags)=\[\s*([^\]]+)\]/i);
          if (flagsMatch && flagsMatch[1]) {
            dumpsysFlagsMap.set(pkg, flagsMatch[1].toUpperCase());
          }
        }
      }
    } catch (_) {}

    // Parse all packages with path
    const packagesMap = new Map();
    const lines = allOut.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith('package:')) continue;

      const withoutPrefix = line.replace(/^package:/, '');
      const lastEq = withoutPrefix.lastIndexOf('=');
      if (lastEq === -1) continue;

      const remotePath = withoutPrefix.substring(0, lastEq).trim();
      const pkgName = withoutPrefix.substring(lastEq + 1).trim();

      if (!this.isValidPackageName(pkgName)) continue;

      // Classify category
      let category = 'system';
      const flags = dumpsysFlagsMap.get(pkgName) || '';

      if (flags.includes('UPDATED_SYSTEM_APP')) {
        category = 'system-updated';
      } else if (remotePath.startsWith('/data/app/') && (systemSet.has(pkgName) || flags.includes('SYSTEM'))) {
        category = 'system-updated';
      } else if (systemSet.has(pkgName) || flags.includes('SYSTEM')) {
        category = 'system';
      } else if (thirdPartySet.has(pkgName)) {
        category = 'user';
      } else if (remotePath.startsWith('/data/')) {
        category = 'user';
      } else {
        category = 'system';
      }

      // Location
      let location = 'other';
      if (remotePath.startsWith('/system/')) location = 'system';
      else if (remotePath.startsWith('/data/')) location = 'data';
      else if (remotePath.startsWith('/vendor/')) location = 'vendor';

      const enabled = !disabledSet.has(pkgName);
      const knowledge = packageKnowledge.lookup(pkgName);
      const protection = packageKnowledge.isProtected(pkgName, context);

      const pkgRecord = {
        name: pkgName,
        category,
        enabled,
        paths: [remotePath],
        location,
        knowledge,
        protected: protection.protected,
        protectedReason: protection.reason || null
      };

      packagesMap.set(pkgName, pkgRecord);
    }

    const packageList = Array.from(packagesMap.values());

    // Sort by name
    packageList.sort((a, b) => a.name.localeCompare(b.name));

    this.packageCache.set(serial, {
      timestamp: Date.now(),
      packages: packageList
    });

    return packageList;
  }

  /**
   * Lazy load details for one package
   */
  async getPackageDetails(serial, pkgName) {
    if (!serial) throw new Error('Device serial is required.');
    if (!this.isValidPackageName(pkgName)) throw new Error(`Invalid package name: ${pkgName}`);

    const cacheKey = `${serial}:${pkgName}`;
    if (this.detailsCache.has(cacheKey)) {
      return this.detailsCache.get(cacheKey);
    }

    // 1. Get all paths using pm path <pkg>
    let paths = [];
    try {
      const { stdout: pathOut } = await adb.execAdb(['-s', serial, 'shell', 'pm', 'path', pkgName], { timeout: 8000 });
      const pathLines = pathOut.split('\n').map(l => l.trim().replace(/^package:/, '')).filter(Boolean);
      paths = pathLines.filter(p => this.isPathAllowed(p));
    } catch (_) {}

    // Fallback path from scan if pm path returned nothing
    if (paths.length === 0) {
      const allPkgs = await this.scanPackages(serial);
      const found = allPkgs.find(p => p.name === pkgName);
      if (found && found.paths && found.paths.length > 0) {
        paths = found.paths;
      }
    }

    // 2. Query dumpsys package <pkgName>
    let versionName = 'Unknown';
    let versionCode = null;
    let firstInstall = null;
    let lastUpdate = null;
    const permissions = [];

    try {
      const { stdout: dumpOut } = await adb.execAdb(['-s', serial, 'shell', 'dumpsys', 'package', pkgName], { timeout: 10000 });

      const vNameMatch = dumpOut.match(/versionName=([^\s]+)/i);
      if (vNameMatch) versionName = vNameMatch[1];

      const vCodeMatch = dumpOut.match(/versionCode=(\d+)/i);
      if (vCodeMatch) versionCode = parseInt(vCodeMatch[1], 10);

      const fInstallMatch = dumpOut.match(/firstInstallTime=([^\r\n]+)/i);
      if (fInstallMatch) firstInstall = fInstallMatch[1].trim();

      const lUpdateMatch = dumpOut.match(/lastUpdateTime=([^\r\n]+)/i);
      if (lUpdateMatch) lastUpdate = lUpdateMatch[1].trim();

      // Permissions section
      const permMatches = dumpOut.match(/grantedPermissions:\s*\n([\s\S]*?)(?=\n\s*(?:User\s*\d|signatures|queries|sharedUser|$))/i);
      if (permMatches && permMatches[1]) {
        permMatches[1].split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && trimmed.startsWith('android.permission.') || trimmed.includes('.permission.')) {
            permissions.push(trimmed);
          }
        });
      } else {
        // Fallback: search for requestedPermissions
        const reqMatches = dumpOut.match(/requested permissions:\s*\n([\s\S]*?)(?=\n\s*(?:install permissions|User\s*\d|$))/i);
        if (reqMatches && reqMatches[1]) {
          reqMatches[1].split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && (trimmed.startsWith('android.permission.') || trimmed.includes('.permission.'))) {
              permissions.push(trimmed);
            }
          });
        }
      }
    } catch (_) {}

    // 3. Compute sizes of APKs using ls -l
    let sizeBytes = 0;
    const fileSizes = [];
    for (const remotePath of paths) {
      try {
        const { stdout: lsOut } = await adb.execAdb(['-s', serial, 'shell', 'ls', '-l', remotePath], { timeout: 4000 });
        // Format: -rw-r--r-- 1 root root 1234567 2026-10-21 12:34 /system/app/Foo.apk
        const parts = lsOut.trim().split(/\s+/);
        for (let i = 2; i < parts.length; i++) {
          if (/^\d{3,}$/.test(parts[i])) {
            const bytes = parseInt(parts[i], 10);
            if (bytes > 0) {
              fileSizes.push({ path: remotePath, bytes });
              sizeBytes += bytes;
              break;
            }
          }
        }
      } catch (_) {}
    }

    const caps = await adb.getDeviceCapabilities(serial).catch(() => ({}));
    const context = {
      activeLauncher: caps.activeLauncher || null,
      activeIme: caps.activeIme || null
    };

    const knowledge = packageKnowledge.lookup(pkgName);
    const protection = packageKnowledge.isProtected(pkgName, context);
    const groupInfo = packageKnowledge.getDependencyGroup(pkgName);

    const details = {
      name: pkgName,
      paths,
      versionName,
      versionCode,
      firstInstall,
      lastUpdate,
      sizeBytes,
      fileSizes,
      permissions: Array.from(new Set(permissions)),
      knowledge,
      protected: protection.protected,
      protectedReason: protection.reason || null,
      dependencyGroup: groupInfo
    };

    this.detailsCache.set(cacheKey, details);
    return details;
  }
}

module.exports = new PackageScanner();

