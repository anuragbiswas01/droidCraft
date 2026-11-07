const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const db = require('./db');

class AdbService {
  constructor() {
    this.captureLocks = new Map();
    this.lastScreenshots = new Map();
    this.deviceInfoCache = new Map();
    this.deviceResolutions = new Map();
    this.rootFormCache = new Map();
    this.capabilitiesCache = new Map();
  }

  getAdbPath() {
    const settings = db.getSettings();
    return settings.adbPath || 'adb';
  }

  setAdbPath(pathStr) {
    db.updateSettings({ adbPath: pathStr });
  }

  /**
   * Safe execution wrapper using child_process.execFile (No raw shell string injection)
   * Automatically strips \r from Windows ADB output and enforces high buffer limits.
   */
  async execAdb(args, options = {}) {
    const adbPath = this.getAdbPath();
    const timeout = options.timeout || 10000;
    const maxBuffer = options.maxBuffer || 20 * 1024 * 1024;
    const encoding = options.encoding || 'utf8';

    return new Promise((resolve, reject) => {
      execFile(adbPath, args, { timeout, windowsHide: true, maxBuffer, encoding }, (error, stdout, stderr) => {
        const clean = (val) => {
          if (!val) return '';
          if (typeof val === 'string') {
            return val.replace(/\r/g, '');
          }
          return val;
        };

        if (error) {
          error.stdout = clean(stdout);
          error.stderr = clean(stderr);
          return reject(error);
        }
        resolve({
          stdout: clean(stdout),
          stderr: clean(stderr)
        });
      });
    });
  }

  /**
   * Run command as root, automatically detecting and remembering su syntax
   * (su -c "<cmd>" vs su 0 sh -c "<cmd>")
   */
  async runAsRoot(serial, cmd, options = {}) {
    const timeout = options.timeout || 15000;
    const cachedForm = this.rootFormCache.get(serial);

    const tryForm1 = async () => {
      return await this.execAdb(['-s', serial, 'shell', 'su', '-c', cmd], { timeout });
    };

    const tryForm2 = async () => {
      return await this.execAdb(['-s', serial, 'shell', 'su', '0', 'sh', '-c', cmd], { timeout });
    };

    if (cachedForm === 'su_0_sh_c') {
      try {
        const res = await tryForm2();
        return res;
      } catch (err2) {
        const res1 = await tryForm1();
        this.rootFormCache.set(serial, 'su_c');
        return res1;
      }
    } else {
      try {
        const res = await tryForm1();
        this.rootFormCache.set(serial, 'su_c');
        return res;
      } catch (err1) {
        try {
          const res2 = await tryForm2();
          this.rootFormCache.set(serial, 'su_0_sh_c');
          return res2;
        } catch (err2) {
          throw err1;
        }
      }
    }
  }

  /**
   * Check if root is available and verified (uid=0)
   */
  async isRootAvailable(serial) {
    try {
      const res = await this.runAsRoot(serial, 'id', { timeout: 8000 });
      return res.stdout.includes('uid=0');
    } catch (_) {
      return false;
    }
  }

  parseSizeToBytes(str, blksize = 1024) {
    if (!str) return 0;
    const match = str.trim().match(/^([\d.]+)\s*([KMGTkmgt])?$/);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    const unit = (match[2] || '').toUpperCase();
    if (unit === 'K') return Math.round(num * 1024);
    if (unit === 'M') return Math.round(num * 1024 * 1024);
    if (unit === 'G') return Math.round(num * 1024 * 1024 * 1024);
    if (unit === 'T') return Math.round(num * 1024 * 1024 * 1024 * 1024);
    return Math.round(num * blksize);
  }

  /**
   * Parse df output for /system, /data, /sdcard
   */
  async getDf(serial) {
    try {
      const { stdout } = await this.execAdb(['-s', serial, 'shell', 'df'], { timeout: 10000 });
      const lines = stdout.split('\n');
      const partitions = {};

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('Filesystem') || trimmed.includes('Permission denied')) continue;
        const parts = trimmed.split(/\s+/);
        if (parts.length < 4) continue;

        const fsName = parts[0];
        const sizeStr = parts[1];
        const usedStr = parts[2];
        const freeStr = parts[3];
        const mountPoint = parts[parts.length - 1];

        let matchedTarget = null;
        let resolvedMount = fsName;
        if (fsName === '/system' || mountPoint === '/system') {
          matchedTarget = 'system';
          resolvedMount = '/system';
        } else if (fsName === '/data' || mountPoint === '/data') {
          matchedTarget = 'data';
          resolvedMount = '/data';
        } else if (fsName === '/sdcard' || mountPoint === '/sdcard' || mountPoint === '/storage/sdcard0' || mountPoint === '/storage/emulated/0' || fsName === '/storage/sdcard0') {
          if (!partitions.sdcard) {
            matchedTarget = 'sdcard';
            resolvedMount = '/sdcard';
          }
        }

        if (matchedTarget) {
          const blksize = parts[4] && /^\d+$/.test(parts[4]) ? parseInt(parts[4], 10) : 1024;
          const sizeBytes = this.parseSizeToBytes(sizeStr, blksize);
          const usedBytes = this.parseSizeToBytes(usedStr, blksize);
          const freeBytes = this.parseSizeToBytes(freeStr, blksize);

          partitions[matchedTarget] = {
            filesystem: fsName,
            mountPoint: resolvedMount,
            sizeBytes,
            usedBytes,
            freeBytes,
            sizeText: sizeStr,
            usedText: usedStr,
            freeText: freeStr
          };
        }
      }

      return partitions;
    } catch (err) {
      return { error: err.message };
    }
  }

  /**
   * Dynamically detect active launcher package
   */
  async resolveActiveLauncher(serial) {
    try {
      try {
        const { stdout } = await this.execAdb([
          '-s', serial, 'shell', 'cmd', 'package', 'resolve-activity',
          '--brief', 'android.intent.action.MAIN', '-c', 'android.intent.category.HOME'
        ], { timeout: 5000 });
        const lines = stdout.split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          if (line.includes('/')) {
            const pkg = line.split('/')[0].trim();
            if (pkg && pkg !== 'android') return pkg;
          }
        }
      } catch (_) {}

      const { stdout: dumpOut } = await this.execAdb([
        '-s', serial, 'shell', 'dumpsys', 'activity'
      ], { timeout: 8000 });
      const match = dumpOut.match(/cat=\[android\.intent\.category\.HOME\][^\n]*cmp=([a-zA-Z0-9_.]+)\//i);
      if (match && match[1]) {
        return match[1];
      }
    } catch (_) {}

    return null;
  }

  /**
   * Dynamically detect active virtual keyboard
   */
  async resolveActiveIme(serial) {
    try {
      const { stdout } = await this.execAdb([
        '-s', serial, 'shell', 'settings', 'get', 'secure', 'default_input_method'
      ], { timeout: 5000 });
      const trimmed = stdout.trim();
      if (trimmed && trimmed.includes('/')) {
        return trimmed.split('/')[0].trim();
      }
    } catch (_) {}
    return null;
  }

  /**
   * Device capability detection (cached per serial)
   */
  async getDeviceCapabilities(serial, forceRefresh = false) {
    if (!forceRefresh && this.capabilitiesCache.has(serial)) {
      return this.capabilitiesCache.get(serial);
    }

    try {
      const { stdout: relOut } = await this.execAdb(['-s', serial, 'shell', 'getprop', 'ro.build.version.release']);
      const { stdout: sdkOut } = await this.execAdb(['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk']);
      const { stdout: abiOut } = await this.execAdb(['-s', serial, 'shell', 'getprop', 'ro.product.cpu.abi']);
      const { stdout: modelOut } = await this.execAdb(['-s', serial, 'shell', 'getprop', 'ro.product.model']);

      const androidVersion = relOut.trim() || 'Unknown';
      const apiLevel = parseInt(sdkOut.trim(), 10) || 17;
      const cpuAbi = abiOut.trim() || 'Unknown';
      const model = modelOut.trim() || 'Android Device';

      const rootAvailable = await this.isRootAvailable(serial);

      let provisioned = 'unknown';
      let setupComplete = 'unknown';

      try {
        const { stdout: provOut } = await this.execAdb(['-s', serial, 'shell', 'settings', 'get', 'global', 'device_provisioned'], { timeout: 4000 });
        const val = provOut.trim();
        if (val === '1' || val === '0') provisioned = val;
      } catch (_) {}

      try {
        const { stdout: setupOut } = await this.execAdb(['-s', serial, 'shell', 'settings', 'get', 'secure', 'user_setup_complete'], { timeout: 4000 });
        const val = setupOut.trim();
        if (val === '1' || val === '0') setupComplete = val;
      } catch (_) {}

      const freeSpace = await this.getDf(serial);
      const activeLauncher = await this.resolveActiveLauncher(serial);
      const activeIme = await this.resolveActiveIme(serial);

      const caps = {
        serial,
        androidVersion,
        apiLevel,
        cpuAbi,
        model,
        rootAvailable,
        rootForm: this.rootFormCache.get(serial) || (rootAvailable ? 'su_c' : null),
        provisioned,
        setupComplete,
        freeSpace,
        activeLauncher,
        activeIme,
        updatedAt: Date.now()
      };

      this.capabilitiesCache.set(serial, caps);
      return caps;
    } catch (err) {
      throw new Error(`Failed to query device capabilities for ${serial}: ${err.message}`);
    }
  }

  clearCapabilitiesCache(serial) {
    if (serial) {
      this.capabilitiesCache.delete(serial);
    } else {
      this.capabilitiesCache.clear();
    }
  }

  /**
   * Get connected ADB devices and detect authorized status
   */
  async getDevices() {
    try {
      const { stdout } = await this.execAdb(['devices', '-l']);
      const lines = stdout.split('\n');
      const devices = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const serial = parts[0];
          const state = parts[1];
          const isAuthorized = state === 'device';

          let model = '';
          let product = '';
          for (let j = 2; j < parts.length; j++) {
            if (parts[j].startsWith('model:')) model = parts[j].split(':')[1];
            if (parts[j].startsWith('product:')) product = parts[j].split(':')[1];
          }

          const devObj = {
            serial,
            state,
            authorized: isAuthorized,
            model: model || product || serial,
            details: line
          };

          devices.push(devObj);

          if (isAuthorized) {
            db.upsertDevice({
              serial,
              model: devObj.model,
              state
            });
          }
        }
      }

      return {
        success: true,
        adbPath: this.getAdbPath(),
        devices
      };
    } catch (err) {
      db.addLog({ type: 'error', message: `ADB devices check failed: ${err.message}` });
      return {
        success: false,
        error: `ADB Execution Error: ${err.message}. Ensure adb is in PATH or configure custom path.`,
        devices: []
      };
    }
  }

  /**
   * Extract device properties and screen resolution
   */
  async getDeviceInfo(serial) {
    if (this.deviceInfoCache.has(serial)) {
      return this.deviceInfoCache.get(serial);
    }

    try {
      const { stdout: osOut } = await this.execAdb(['-s', serial, 'shell', 'getprop', 'ro.build.version.release']);
      const { stdout: sdkOut } = await this.execAdb(['-s', serial, 'shell', 'getprop', 'ro.build.version.sdk']);
      const { stdout: modelOut } = await this.execAdb(['-s', serial, 'shell', 'getprop', 'ro.product.model']);
      const { stdout: brandOut } = await this.execAdb(['-s', serial, 'shell', 'getprop', 'ro.product.brand']);

      const androidVersion = osOut.trim() || 'Unknown';
      const apiLevel = parseInt(sdkOut.trim(), 10) || 17;
      const model = modelOut.trim() || 'Android Device';
      const brand = brandOut.trim() || '';
      const isLegacy = apiLevel < 21; // Scrcpy requires API >= 21

      let screenWidth = 480;
      let screenHeight = 800;

      try {
        const { stdout: wmOut } = await this.execAdb(['-s', serial, 'shell', 'wm', 'size']);
        const match = wmOut.match(/(\d+)\s*x\s*(\d+)/i);
        if (match) {
          screenWidth = parseInt(match[1], 10);
          screenHeight = parseInt(match[2], 10);
        }
      } catch (e) {
        try {
          const { stdout: dumpOut } = await this.execAdb(['-s', serial, 'shell', 'dumpsys', 'window']);
          const match = dumpOut.match(/init=(\d+)x(\d+)/i);
          if (match) {
            screenWidth = parseInt(match[1], 10);
            screenHeight = parseInt(match[2], 10);
          }
        } catch (_) {}
      }

      this.deviceResolutions.set(serial, { width: screenWidth, height: screenHeight });

      const info = {
        serial,
        androidVersion,
        apiLevel,
        isLegacy,
        modeRecommended: isLegacy ? 'legacy' : 'scrcpy',
        model,
        brand,
        screenWidth,
        screenHeight
      };

      this.deviceInfoCache.set(serial, info);
      db.upsertDevice(info);

      return info;
    } catch (err) {
      throw new Error(`Failed to query device info for ${serial}: ${err.message}`);
    }
  }

  /**
   * Fast PNG header parser
   */
  parsePngDimensions(buffer) {
    if (buffer.length >= 24 &&
        buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[12] === 0x49 && buffer[13] === 0x48 && buffer[14] === 0x44 && buffer[15] === 0x52) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
    return null;
  }

  /**
   * Captures screen via /data/local/tmp staging and adb pull (strictly required for legacy 4.2.2)
   */
  async captureScreenshot(serial) {
    if (this.captureLocks.get(serial)) {
      const err = new Error(`Capture already in flight for device ${serial}`);
      err.code = 'CAPTURE_BUSY';
      throw err;
    }

    this.captureLocks.set(serial, true);
    const startMs = Date.now();
    const tempId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const remoteTmpPath = `/data/local/tmp/droidcraft_${tempId}.png`;
    const localTmpPath = path.join(os.tmpdir(), `droidcraft_${tempId}.png`);

    try {
      // 1. Capture to device tmp
      await this.execAdb(['-s', serial, 'shell', 'screencap', '-p', remoteTmpPath], { timeout: 8000 });

      // 2. Pull to host
      await this.execAdb(['-s', serial, 'pull', remoteTmpPath, localTmpPath], { timeout: 8000 });

      // 3. Purge remote file
      this.execAdb(['-s', serial, 'shell', 'rm', '-f', remoteTmpPath]).catch(() => {});

      // 4. Ingest local buffer
      if (!fs.existsSync(localTmpPath)) {
        throw new Error('Screenshot file was not retrieved from device.');
      }

      const buffer = fs.readFileSync(localTmpPath);
      fs.unlink(localTmpPath, () => {});

      if (!buffer || buffer.length === 0) {
        throw new Error('Retrieved screenshot is empty (0 bytes).');
      }

      let width = 480;
      let height = 800;
      const dims = this.parsePngDimensions(buffer);
      if (dims && dims.width > 0 && dims.height > 0) {
        width = dims.width;
        height = dims.height;
        this.deviceResolutions.set(serial, dims);
      } else if (this.deviceResolutions.has(serial)) {
        const cached = this.deviceResolutions.get(serial);
        width = cached.width;
        height = cached.height;
      }

      const durationMs = Date.now() - startMs;
      const screenshot = {
        buffer,
        width,
        height,
        captureDurationMs: durationMs,
        timestamp: Date.now()
      };

      this.lastScreenshots.set(serial, screenshot);
      return screenshot;
    } catch (err) {
      if (fs.existsSync(localTmpPath)) {
        fs.unlink(localTmpPath, () => {});
      }
      this.execAdb(['-s', serial, 'shell', 'rm', '-f', remoteTmpPath]).catch(() => {});
      throw err;
    } finally {
      this.captureLocks.set(serial, false);
    }
  }

  getLastScreenshot(serial) {
    return this.lastScreenshots.get(serial) || null;
  }

  /**
   * Action dispatcher with Android 4.2.2 compatibility & smart notification shade
   */
  async sendAction(serial, actionData) {
    if (!serial) throw new Error('Device serial is required.');
    const { action } = actionData;

    switch (action) {
      case 'tap': {
        const x = Math.round(Number(actionData.x));
        const y = Math.round(Number(actionData.y));
        if (isNaN(x) || isNaN(y)) throw new Error('Invalid x or y coordinates for tap.');
        await this.execAdb(['-s', serial, 'shell', 'input', 'tap', String(x), String(y)]);
        db.addLog({ type: 'info', serial, message: `Tap (${x}, ${y})` });
        return { success: true, action: 'tap', x, y };
      }

      case 'swipe': {
        const x1 = Math.round(Number(actionData.x1));
        const y1 = Math.round(Number(actionData.y1));
        const x2 = Math.round(Number(actionData.x2));
        const y2 = Math.round(Number(actionData.y2));
        if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
          throw new Error('Invalid coordinates for swipe.');
        }

        const deltaY = y2 - y1;

        // Downward drag from top edge (y <= 48) -> open notification shade
        if (y1 <= 48 && deltaY > 30) {
          try {
            await this.execAdb(['-s', serial, 'shell', 'service', 'call', 'statusbar', '1']);
            db.addLog({ type: 'info', serial, message: 'Notification shade opened' });
            return { success: true, action: 'notifications', mode: 'service_call' };
          } catch (_) {}
        }

        // Clamp coordinates to valid device display dimensions
        const res = this.deviceResolutions.get(serial) || { width: 480, height: 800 };
        const maxW = res.width || 480;
        const maxH = res.height || 800;

        const clampX1 = Math.max(0, Math.min(maxW, x1));
        const clampY1 = Math.max(0, Math.min(maxH, y1));
        const clampX2 = Math.max(0, Math.min(maxW, x2));
        const clampY2 = Math.max(0, Math.min(maxH, y2));

        const devInfo = this.deviceInfoCache.get(serial);
        const swipeArgs = [
          '-s', serial, 'shell', 'input', 'swipe',
          String(clampX1), String(clampY1), String(clampX2), String(clampY2)
        ];

        // Android 4.4+ (API >= 19) supports an optional duration in ms
        if (devInfo && devInfo.apiLevel >= 19) {
          swipeArgs.push('300');
        }

        await this.execAdb(swipeArgs);

        db.addLog({ type: 'info', serial, message: `Swipe (${clampX1},${clampY1}) -> (${clampX2},${clampY2})` });
        return { success: true, action: 'swipe', x1: clampX1, y1: clampY1, x2: clampX2, y2: clampY2 };
      }

      case 'scroll': {
        const direction = actionData.direction || 'down';
        const res = this.deviceResolutions.get(serial) || { width: 480, height: 800 };
        const midX = Math.round(res.width / 2);
        const midY = Math.round(res.height / 2);
        const step = Math.round(Math.min(res.width, res.height) * 0.35);

        let x1 = midX, y1 = midY, x2 = midX, y2 = midY;
        if (direction === 'down') {
          y1 = midY + Math.round(step / 2);
          y2 = y1 - step;
        } else if (direction === 'up') {
          y1 = midY - Math.round(step / 2);
          y2 = y1 + step;
        } else if (direction === 'right') {
          x1 = midX + Math.round(step / 2);
          x2 = x1 - step;
        } else if (direction === 'left') {
          x1 = midX - Math.round(step / 2);
          x2 = x1 + step;
        }

        const devInfo = this.deviceInfoCache.get(serial);
        const scrollArgs = [
          '-s', serial, 'shell', 'input', 'swipe',
          String(x1), String(y1), String(x2), String(y2)
        ];
        if (devInfo && devInfo.apiLevel >= 19) {
          scrollArgs.push('250');
        }

        await this.execAdb(scrollArgs);

        db.addLog({ type: 'info', serial, message: `Scroll ${direction}` });
        return { success: true, action: 'scroll', direction };
      }

      case 'keyevent': {
        const code = Number(actionData.code);
        if (isNaN(code)) throw new Error('Invalid keycode.');
        await this.execAdb(['-s', serial, 'shell', 'input', 'keyevent', String(code)]);
        db.addLog({ type: 'info', serial, message: `Keyevent ${code}` });
        return { success: true, action: 'keyevent', code };
      }

      case 'text': {
        const text = String(actionData.text || '');
        if (!text) return { success: true, text: '' };
        const escaped = text.replace(/ /g, '%s').replace(/([&|;()<>$"`\\!*?~])/g, '\\$1');
        await this.execAdb(['-s', serial, 'shell', 'input', 'text', escaped]);
        db.addLog({ type: 'info', serial, message: `Typed text: "${text}"` });
        return { success: true, action: 'text', length: text.length };
      }

      case 'wake':
        await this.execAdb(['-s', serial, 'shell', 'input', 'keyevent', '224']);
        db.addLog({ type: 'info', serial, message: 'Screen Wake (Keyevent 224)' });
        return { success: true, action: 'wake' };

      case 'power':
        await this.execAdb(['-s', serial, 'shell', 'input', 'keyevent', '26']);
        db.addLog({ type: 'warn', serial, message: 'Power Toggle (Keyevent 26)' });
        return { success: true, action: 'power' };

      case 'home':
        await this.execAdb(['-s', serial, 'shell', 'input', 'keyevent', '3']);
        db.addLog({ type: 'info', serial, message: 'Home (Keyevent 3)' });
        return { success: true, action: 'home' };

      case 'back':
        await this.execAdb(['-s', serial, 'shell', 'input', 'keyevent', '4']);
        db.addLog({ type: 'info', serial, message: 'Back (Keyevent 4)' });
        return { success: true, action: 'back' };

      case 'menu':
        await this.execAdb(['-s', serial, 'shell', 'input', 'keyevent', '82']);
        db.addLog({ type: 'info', serial, message: 'Menu (Keyevent 82)' });
        return { success: true, action: 'menu' };

      case 'notifications':
        await this.execAdb(['-s', serial, 'shell', 'service', 'call', 'statusbar', '1']);
        db.addLog({ type: 'info', serial, message: 'Notification shade opened' });
        return { success: true, action: 'notifications' };

      case 'notifications_collapse':
        await this.execAdb(['-s', serial, 'shell', 'service', 'call', 'statusbar', '2']);
        db.addLog({ type: 'info', serial, message: 'Notification shade closed' });
        return { success: true, action: 'notifications_collapse' };

      case 'volume_up':
        await this.execAdb(['-s', serial, 'shell', 'input', 'keyevent', '24']);
        db.addLog({ type: 'info', serial, message: 'Volume Up' });
        return { success: true, action: 'volume_up' };

      case 'volume_down':
        await this.execAdb(['-s', serial, 'shell', 'input', 'keyevent', '25']);
        db.addLog({ type: 'info', serial, message: 'Volume Down' });
        return { success: true, action: 'volume_down' };

      case 'enter':
        await this.execAdb(['-s', serial, 'shell', 'input', 'keyevent', '66']);
        db.addLog({ type: 'info', serial, message: 'Enter (Keyevent 66)' });
        return { success: true, action: 'enter' };

      case 'backspace':
        await this.execAdb(['-s', serial, 'shell', 'input', 'keyevent', '67']);
        return { success: true, action: 'backspace' };

      case 'reboot':
        await this.execAdb(['-s', serial, 'reboot']);
        db.addLog({ type: 'warn', serial, message: 'Device reboot initiated' });
        return { success: true, action: 'reboot' };

      default:
        throw new Error(`Unsupported action "${action}".`);
    }
  }
}

module.exports = new AdbService();
