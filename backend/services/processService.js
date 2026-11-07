const adb = require('./adb');
const audit = require('./audit');

const CRITICAL_SYSTEM_PROCESSES = new Set([
  'init',
  '/init',
  'kthreadd',
  'system_server',
  'zygote',
  'zygote64',
  'surfaceflinger',
  'servicemanager',
  'adbd',
  'vold',
  'netd'
]);

class ProcessService {
  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 KB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return `${mb.toFixed(1)} MB`;
    }
    return `${Math.round(bytes / 1024)} KB`;
  }

  /**
   * Universal process scanner using ps / ps -A
   */
  async getProcesses(serial, options = {}) {
    if (!serial) throw new Error('Device serial is required.');

    // 1. Try ps -A first (standard on Android 8+ toybox)
    let stdout = '';
    try {
      const res = await adb.execAdb(['-s', serial, 'shell', 'ps', '-A'], { timeout: 8000 });
      const testLines = res.stdout.trim().split('\n').filter(Boolean);
      // On Android 4.x, ps -A returns 0 rows (thinks -A is username)
      if (testLines.length > 2) {
        stdout = res.stdout;
      }
    } catch (_) {}

    // Fall back to plain ps
    if (!stdout) {
      const res = await adb.execAdb(['-s', serial, 'shell', 'ps'], { timeout: 8000 });
      stdout = res.stdout;
    }

    const lines = stdout.trim().split('\n');
    if (lines.length < 2) return [];

    // Parse header to map column positions
    const headerLine = lines[0].trim();
    const headers = headerLine.split(/\s+/).map(h => h.toUpperCase());

    const userIdx = headers.findIndex(h => h === 'USER' || h === 'UID');
    const pidIdx = headers.findIndex(h => h === 'PID');
    const ppidIdx = headers.findIndex(h => h === 'PPID');
    const vszIdx = headers.findIndex(h => h === 'VSIZE' || h === 'VSZ');
    const rssIdx = headers.findIndex(h => h === 'RSS' || h === 'SZ');
    const nameIdx = headers.findIndex(h => h === 'NAME' || h === 'CMD' || h === 'COMMAND');

    const processes = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(/\s+/);
      if (parts.length < 4) continue;

      const pidStr = pidIdx !== -1 ? parts[pidIdx] : parts[1];
      const pid = parseInt(pidStr, 10);
      if (isNaN(pid)) continue;

      const user = userIdx !== -1 ? parts[userIdx] : parts[0];
      const ppid = ppidIdx !== -1 ? parseInt(parts[ppidIdx], 10) || 0 : parseInt(parts[2], 10) || 0;
      
      const vszKb = vszIdx !== -1 ? parseInt(parts[vszIdx], 10) || 0 : 0;
      const rssKb = rssIdx !== -1 ? parseInt(parts[rssIdx], 10) || 0 : 0;
      
      // Name can span multiple tokens if there are arguments
      // Handle legacy toolbox ps where single-letter state column (e.g. 'S') is present in row but missing from header
      let actualNameIdx = nameIdx;
      if (actualNameIdx !== -1 && parts[actualNameIdx] && /^[SRDZTWX]$/i.test(parts[actualNameIdx]) && parts.length > actualNameIdx + 1) {
        actualNameIdx++;
      }

      let name = '';
      if (actualNameIdx !== -1 && parts[actualNameIdx]) {
        name = parts.slice(actualNameIdx).join(' ');
      } else {
        name = parts[parts.length - 1];
      }

      // Identify category
      let category = 'daemon';
      const isKernel = ppid === 2 || vszKb === 0 || (name.startsWith('[') && name.endsWith(']'));
      const isApp = name.includes('.') && !name.startsWith('/') && !name.startsWith('[');
      const isSystemApp = isApp && (user === 'system' || user === 'root' || name.startsWith('com.android.'));

      if (isKernel) {
        category = 'kernel';
      } else if (isApp) {
        category = isSystemApp ? 'system-app' : 'user-app';
      } else if (user === 'root' || user === 'system') {
        category = 'system';
      }

      const cleanName = name.replace(/^\[|\]$/g, '').replace(/^.*\//, '');
      const isCritical = pid === 1 || pid === 2 || CRITICAL_SYSTEM_PROCESSES.has(cleanName) || CRITICAL_SYSTEM_PROCESSES.has(name);

      processes.push({
        pid,
        ppid,
        user,
        name,
        cleanName,
        vszKb,
        vszFormatted: this.formatBytes(vszKb * 1024),
        rssKb,
        rssFormatted: this.formatBytes(rssKb * 1024),
        category, // 'user-app', 'system-app', 'system', 'kernel', 'daemon'
        isCritical
      });
    }

    // Sort by RSS descending by default
    processes.sort((a, b) => b.rssKb - a.rssKb);

    return processes;
  }

  /**
   * Terminate / Kill process by PID
   */
  async killProcess(serial, pid, options = {}) {
    if (!serial) throw new Error('Device serial is required.');

    const pidNum = parseInt(pid, 10);
    if (isNaN(pidNum) || pidNum <= 0) {
      throw new Error(`Invalid PID "${pid}".`);
    }

    // Critical kernel process hard guard
    if (pidNum === 1 || pidNum === 2) {
      throw new Error(`Refusing to kill PID ${pidNum} (${pidNum === 1 ? '/init' : 'kthreadd'}): Critical kernel thread.`);
    }

    const signal = options.signal === '15' || options.signal === 'SIGTERM' ? '15' : '9'; // default SIGKILL (-9)
    let method = 'plain';

    try {
      // 1. Try standard kill command first
      await adb.execAdb(['-s', serial, 'shell', 'kill', `-${signal}`, String(pidNum)], { timeout: 6000 });
    } catch (err) {
      // 2. Fall back to root escalation if permission denied
      const caps = await adb.getDeviceCapabilities(serial).catch(() => ({ rootAvailable: false }));
      if (caps.rootAvailable) {
        await adb.runAsRoot(serial, `kill -${signal} ${pidNum}`);
        method = 'root';
      } else {
        throw new Error(`Failed to kill process ${pidNum}: ${err.message}. Device is not rooted.`);
      }
    }

    // 3. Optional force-stop app package to prevent instant restart
    if (options.packageName) {
      try {
        await adb.execAdb(['-s', serial, 'shell', 'am', 'force-stop', options.packageName], { timeout: 5000 });
      } catch (_) {}
    }

    // Log to mutating audit trail
    audit.log({
      serial,
      action: 'kill_process',
      package: options.packageName || options.name || null,
      command: `${method}: kill -${signal} ${pidNum}`,
      status: 'success',
      result: `Terminated PID ${pidNum}`
    });

    return {
      success: true,
      pid: pidNum,
      signal: signal === '9' ? 'SIGKILL' : 'SIGTERM',
      method
    };
  }
}

module.exports = new ProcessService();
