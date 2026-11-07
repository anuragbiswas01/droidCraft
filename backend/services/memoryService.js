const adb = require('./adb');

class MemoryService {
  /**
   * Format bytes to human readable format (MB, GB, KB)
   */
  formatBytes(bytes) {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  }

  /**
   * Get device memory & RAM status from /proc/meminfo
   * @param {string} serial
   */
  async getMemoryStats(serial) {
    if (!serial) throw new Error('Device serial is required.');

    const { stdout: memOut } = await adb.execAdb(['-s', serial, 'shell', 'cat', '/proc/meminfo'], { timeout: 8000 });
    const meminfo = {};

    memOut.split('\n').forEach(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const valMatch = parts[1].trim().match(/^(\d+)/);
        if (valMatch) {
          meminfo[key] = parseInt(valMatch[1], 10) * 1024; // Convert kB to bytes
        }
      }
    });

    const totalBytes = meminfo.MemTotal || 0;
    const freeBytes = meminfo.MemFree || 0;
    const buffersBytes = meminfo.Buffers || 0;
    const cachedBytes = meminfo.Cached || 0;
    
    // Modern kernels report MemAvailable directly; older kernels estimate: free + buffers + cached
    const availableBytes = meminfo.MemAvailable || (freeBytes + buffersBytes + cachedBytes);
    const usedBytes = Math.max(0, totalBytes - availableBytes);
    const usedPercentage = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
    const freePercentage = Math.max(0, 100 - usedPercentage);

    // Swap / ZRAM stats
    const swapTotalBytes = meminfo.SwapTotal || 0;
    const swapFreeBytes = meminfo.SwapFree || 0;
    const swapUsedBytes = Math.max(0, swapTotalBytes - swapFreeBytes);
    const swapUsedPercentage = swapTotalBytes > 0 ? Math.round((swapUsedBytes / swapTotalBytes) * 100) : 0;

    return {
      serial,
      timestamp: Date.now(),
      ram: {
        totalBytes,
        usedBytes,
        freeBytes,
        availableBytes,
        buffersBytes,
        cachedBytes,
        usedPercentage,
        freePercentage,
        totalFormatted: this.formatBytes(totalBytes),
        usedFormatted: this.formatBytes(usedBytes),
        freeFormatted: this.formatBytes(freeBytes),
        availableFormatted: this.formatBytes(availableBytes),
        buffersFormatted: this.formatBytes(buffersBytes),
        cachedFormatted: this.formatBytes(cachedBytes)
      },
      swap: {
        totalBytes: swapTotalBytes,
        usedBytes: swapUsedBytes,
        freeBytes: swapFreeBytes,
        usedPercentage: swapUsedPercentage,
        totalFormatted: this.formatBytes(swapTotalBytes),
        usedFormatted: this.formatBytes(swapUsedBytes),
        freeFormatted: this.formatBytes(swapFreeBytes)
      },
      details: {
        active: this.formatBytes(meminfo.Active || 0),
        inactive: this.formatBytes(meminfo.Inactive || 0),
        dirty: this.formatBytes(meminfo.Dirty || 0),
        slab: this.formatBytes(meminfo.Slab || 0),
        pageTables: this.formatBytes(meminfo.PageTables || 0),
        kernelStack: this.formatBytes(meminfo.KernelStack || 0)
      }
    };
  }

  /**
   * Get top memory consuming processes from dumpsys meminfo
   * @param {string} serial
   * @param {number} limit
   */
  async getTopMemoryProcesses(serial, limit = 10) {
    if (!serial) throw new Error('Device serial is required.');

    try {
      const { stdout: dumpOut } = await adb.execAdb(['-s', serial, 'shell', 'dumpsys', 'meminfo'], { timeout: 10000 });
      const lines = dumpOut.split('\n');
      const processes = [];
      let inProcessList = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('Total PSS by process:')) {
          inProcessList = true;
          continue;
        }

        if (inProcessList) {
          if (trimmed.startsWith('Total PSS by OOM adjustment:') || trimmed.startsWith('Total PSS by category:')) {
            break;
          }

          // Format: "34460 kB: com.google.android.gms.persistent (pid 808)"
          const match = trimmed.match(/^([\d,]+)\s*kB:\s*([^\s(]+)(?:\s*\(pid\s*(\d+)[^)]*\))?/i);
          if (match) {
            const kb = parseInt(match[1].replace(/,/g, ''), 10);
            const name = match[2];
            const pid = match[3] ? parseInt(match[3], 10) : null;
            const pssBytes = kb * 1024;

            processes.push({
              pid,
              name,
              pssKb: kb,
              pssBytes,
              pssFormatted: this.formatBytes(pssBytes)
            });

            if (processes.length >= limit) break;
          }
        }
      }

      return processes;
    } catch (_) {
      return [];
    }
  }
}

module.exports = new MemoryService();
