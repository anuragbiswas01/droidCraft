const fs = require('fs');
const path = require('path');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const DEFAULT_STATE = {
  settings: {
    adbPath: 'adb',
    scrcpyPath: 'scrcpy',
    defaultMode: 'auto', // 'auto', 'scrcpy', or 'legacy'
    refreshInterval: 1000,
    theme: 'dark',
    scrcpyBitrate: '4M',
    scrcpyMaxSize: 1024,
    scrcpyStayAwake: true,
    scrcpyTurnScreenOff: false
  },
  devices: [],
  logs: []
};

class LocalDatabase {
  constructor() {
    this.state = null;
    this._init();
  }

  _init() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        this.state = JSON.parse(raw);
        // Ensure keys exist
        this.state.settings = { ...DEFAULT_STATE.settings, ...(this.state.settings || {}) };
        this.state.devices = Array.isArray(this.state.devices) ? this.state.devices : [];
        this.state.logs = Array.isArray(this.state.logs) ? this.state.logs : [];
      } else {
        this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        this._save();
      }
    } catch (err) {
      console.warn('[DB] Failed to load local database, falling back to memory defaults:', err.message);
      this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  _save() {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('[DB] Failed to write database to disk:', err.message);
    }
  }

  // --- Settings ---
  getSettings() {
    return { ...this.state.settings };
  }

  updateSettings(partial) {
    if (!partial || typeof partial !== 'object') return this.getSettings();
    this.state.settings = {
      ...this.state.settings,
      ...partial
    };
    this._save();
    return this.getSettings();
  }

  // --- Devices ---
  getDevices() {
    return [...this.state.devices];
  }

  getDevice(serial) {
    return this.state.devices.find(d => d.serial === serial) || null;
  }

  upsertDevice(devData) {
    if (!devData || !devData.serial) return null;
    const index = this.state.devices.findIndex(d => d.serial === devData.serial);
    const updated = {
      ...(index >= 0 ? this.state.devices[index] : {}),
      ...devData,
      lastSeen: Date.now()
    };

    if (index >= 0) {
      this.state.devices[index] = updated;
    } else {
      this.state.devices.push(updated);
    }

    this._save();
    return updated;
  }

  // --- Logs ---
  addLog(entry) {
    const logItem = {
      id: Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      timeFormatted: new Date().toLocaleTimeString(),
      type: entry.type || 'info', // 'info', 'success', 'warn', 'error'
      message: entry.message || '',
      serial: entry.serial || null
    };

    this.state.logs.unshift(logItem);
    // Keep last 150 logs
    if (this.state.logs.length > 150) {
      this.state.logs.length = 150;
    }

    this._save();
    return logItem;
  }

  getLogs(limit = 50) {
    return this.state.logs.slice(0, limit);
  }

  clearLogs() {
    this.state.logs = [];
    this._save();
    return true;
  }
}

module.exports = new LocalDatabase();
