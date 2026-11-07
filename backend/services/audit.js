const fs = require('fs');
const path = require('path');

const AUDIT_FILE = path.join(__dirname, '..', 'data', 'audit.jsonl');

class AuditService {
  constructor() {
    this._ensureDir();
  }

  _ensureDir() {
    const dir = path.dirname(AUDIT_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Log a mutating action to JSON lines audit log
   * @param {object} entry - { serial, action, package, command, result, status, error, user }
   */
  log(entry) {
    try {
      this._ensureDir();
      const record = {
        timestamp: new Date().toISOString(),
        serial: entry.serial || null,
        action: entry.action || 'unknown',
        package: entry.package || null,
        command: entry.command || null,
        status: entry.status || 'success', // 'success', 'failed', 'dry_run', 'skipped'
        result: entry.result || null,
        error: entry.error || null,
        details: entry.details || null
      };

      const line = JSON.stringify(record) + '\n';
      fs.appendFileSync(AUDIT_FILE, line, 'utf8');
      return record;
    } catch (err) {
      console.error('[AuditService] Failed to write audit log:', err.message);
      return null;
    }
  }

  /**
   * Read recent audit log entries
   * @param {string} [serial] - Filter by device serial
   * @param {number} [limit=100] - Number of entries
   */
  getLogs(serial = null, limit = 100) {
    try {
      if (!fs.existsSync(AUDIT_FILE)) return [];
      const content = fs.readFileSync(AUDIT_FILE, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const records = [];

      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const parsed = JSON.parse(lines[i]);
          if (!serial || parsed.serial === serial) {
            records.push(parsed);
            if (records.length >= limit) break;
          }
        } catch (_) {}
      }

      return records;
    } catch (err) {
      console.error('[AuditService] Failed to read audit log:', err.message);
      return [];
    }
  }

  /**
   * Clear audit log
   */
  clear() {
    try {
      if (fs.existsSync(AUDIT_FILE)) {
        fs.unlinkSync(AUDIT_FILE);
      }
      return true;
    } catch (err) {
      console.error('[AuditService] Failed to clear audit log:', err.message);
      return false;
    }
  }
}

module.exports = new AuditService();

