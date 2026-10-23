const { spawn, execFile } = require('child_process');
const db = require('./db');

class ScrcpyService {
  constructor() {
    this.activeSessions = new Map(); // serial -> { process, pid, startedAt, logs: [] }
  }

  getScrcpyPath() {
    const settings = db.getSettings();
    return settings.scrcpyPath || 'scrcpy';
  }

  setScrcpyPath(pathStr) {
    db.updateSettings({ scrcpyPath: pathStr });
  }

  /**
   * Checks if scrcpy executable is found and returns its version
   */
  async checkAvailability() {
    const scrcpyPath = this.getScrcpyPath();
    return new Promise((resolve) => {
      execFile(scrcpyPath, ['--version'], { timeout: 3500 }, (error, stdout, stderr) => {
        if (error) {
          // If custom path failed, also test common C:\Tools\scrcpy-win64-v2.4\scrcpy.exe
          const fallbackPath = 'C:\\Tools\\scrcpy-win64-v2.4\\scrcpy.exe';
          if (scrcpyPath !== fallbackPath) {
            execFile(fallbackPath, ['--version'], { timeout: 3500 }, (fErr, fOut) => {
              if (!fErr && fOut) {
                const match = fOut.match(/scrcpy\s+([\d.]+)/i);
                this.setScrcpyPath(fallbackPath);
                return resolve({
                  available: true,
                  version: match ? match[1] : 'detected',
                  path: fallbackPath,
                  details: fOut.split('\n')[0]
                });
              }
              resolve({
                available: false,
                version: null,
                path: scrcpyPath,
                error: error.message || 'scrcpy executable not found in PATH.'
              });
            });
            return;
          }

          return resolve({
            available: false,
            version: null,
            path: scrcpyPath,
            error: error.message || 'scrcpy executable not found in PATH.'
          });
        }

        const raw = stdout || stderr || '';
        const match = raw.match(/scrcpy\s+([\d.]+)/i);
        resolve({
          available: true,
          version: match ? match[1] : 'detected',
          path: scrcpyPath,
          details: raw.split('\n')[0]
        });
      });
    });
  }

  /**
   * Starts a scrcpy window session for a modern Android device (API 21+)
   */
  async startSession(serial, options = {}) {
    if (!serial) {
      throw new Error('Device serial is required to launch scrcpy.');
    }

    if (this.activeSessions.has(serial)) {
      const existing = this.activeSessions.get(serial);
      if (existing && !existing.process.killed) {
        return {
          success: true,
          alreadyRunning: true,
          serial,
          pid: existing.pid,
          startedAt: existing.startedAt,
          message: `scrcpy session is already running for device ${serial} (PID: ${existing.pid}).`
        };
      }
    }

    const scrcpyPath = this.getScrcpyPath();
    const settings = db.getSettings();

    const args = [
      '-s', serial,
      '--window-title', `DroidCraft - ${serial}`,
      '--max-size', String(options.maxSize || settings.scrcpyMaxSize || 1024),
      '--video-bit-rate', String(options.bitrate || settings.scrcpyBitrate || '4M')
    ];

    if (options.stayAwake ?? settings.scrcpyStayAwake) {
      args.push('--stay-awake');
    }
    if (options.turnScreenOff ?? settings.scrcpyTurnScreenOff) {
      args.push('--turn-screen-off');
    }
    if (options.noAudio) {
      args.push('--no-audio');
    }

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const logs = [];

      try {
        const proc = spawn(scrcpyPath, args, {
          detached: false,
          windowsHide: false
        });

        const session = {
          process: proc,
          pid: proc.pid,
          serial,
          startedAt: Date.now(),
          args,
          logs
        };

        this.activeSessions.set(serial, session);

        proc.stdout.on('data', (chunk) => {
          const str = chunk.toString();
          logs.push({ time: Date.now(), type: 'stdout', text: str.trim() });
          if (logs.length > 50) logs.shift();
        });

        proc.stderr.on('data', (chunk) => {
          const str = chunk.toString();
          logs.push({ time: Date.now(), type: 'stderr', text: str.trim() });
          if (logs.length > 50) logs.shift();
        });

        proc.on('error', (err) => {
          this.activeSessions.delete(serial);
          db.addLog({
            type: 'error',
            serial,
            message: `scrcpy process error for ${serial}: ${err.message}`
          });
          if (!isSettled) {
            isSettled = true;
            reject(new Error(`Failed to start scrcpy: ${err.message}`));
          }
        });

        proc.on('exit', (code, signal) => {
          this.activeSessions.delete(serial);
          db.addLog({
            type: 'info',
            serial,
            message: `scrcpy session exited for ${serial} (code: ${code}, signal: ${signal})`
          });
        });

        // Give it 800ms to verify it didn't immediately crash
        setTimeout(() => {
          if (!isSettled) {
            isSettled = true;
            db.addLog({
              type: 'success',
              serial,
              message: `scrcpy session started successfully for ${serial} (PID: ${proc.pid})`
            });
            resolve({
              success: true,
              serial,
              pid: proc.pid,
              startedAt: session.startedAt,
              args
            });
          }
        }, 800);
      } catch (err) {
        if (!isSettled) {
          isSettled = true;
          reject(err);
        }
      }
    });
  }

  /**
   * Stops an active scrcpy session for a given device serial
   */
  stopSession(serial) {
    if (!serial) return { success: false, error: 'Device serial required' };

    const session = this.activeSessions.get(serial);
    if (!session) {
      return { success: true, message: `No active scrcpy session for ${serial}` };
    }

    try {
      if (process.platform === 'win32' && session.pid) {
        execFile('taskkill', ['/pid', String(session.pid), '/f', '/t'], () => {});
      } else {
        session.process.kill('SIGINT');
      }
      this.activeSessions.delete(serial);
      db.addLog({
        type: 'info',
        serial,
        message: `Terminated scrcpy session for ${serial}`
      });
      return { success: true, message: `Stopped scrcpy session for ${serial}` };
    } catch (err) {
      this.activeSessions.delete(serial);
      return { success: false, error: err.message };
    }
  }

  /**
   * Gets session status for a specific serial
   */
  getSession(serial) {
    if (!serial) return null;
    const session = this.activeSessions.get(serial);
    if (!session) return { running: false, serial };

    return {
      running: true,
      serial,
      pid: session.pid,
      startedAt: session.startedAt,
      durationSec: Math.floor((Date.now() - session.startedAt) / 1000),
      recentLogs: session.logs.slice(-10)
    };
  }

  /**
   * Returns list of all active scrcpy sessions
   */
  getAllSessions() {
    const list = [];
    for (const [serial, session] of this.activeSessions.entries()) {
      list.push({
        running: true,
        serial,
        pid: session.pid,
        startedAt: session.startedAt,
        durationSec: Math.floor((Date.now() - session.startedAt) / 1000)
      });
    }
    return list;
  }
}

module.exports = new ScrcpyService();
