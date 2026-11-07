/**
 * Centralized API service for DroidCraft
 */

const BASE_URL = '';

export async function fetchJson(endpoint, options = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      errMsg = data.error || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return res.json();
}

export async function uploadForm(endpoint, formData) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      errMsg = data.error || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }

  return res.json();
}

export const api = {
  // Device endpoints
  getDevices: () => fetchJson('/api/devices'),
  getDeviceInfo: (serial) => fetchJson(`/api/devices/${encodeURIComponent(serial)}/info`),
  setDeviceMode: (serial, mode) => fetchJson(`/api/devices/${encodeURIComponent(serial)}/mode`, {
    method: 'POST',
    body: JSON.stringify({ mode })
  }),

  // Screen endpoints
  getScreenUrl: (serial) => `/api/screen?serial=${encodeURIComponent(serial)}&t=${Date.now()}`,
  getLastScreenUrl: (serial) => `/api/screen/last?serial=${encodeURIComponent(serial)}`,

  // Action dispatcher
  sendAction: (serial, payload) => fetchJson('/api/action', {
    method: 'POST',
    body: JSON.stringify({ serial, ...payload })
  }),

  // Scrcpy endpoints
  getScrcpyStatus: () => fetchJson('/api/scrcpy/status'),
  startScrcpy: (payload) => fetchJson('/api/scrcpy/start', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  stopScrcpy: (serial) => fetchJson('/api/scrcpy/stop', {
    method: 'POST',
    body: JSON.stringify({ serial })
  }),

  // Settings & DB endpoints
  getSettings: () => fetchJson('/api/settings'),
  updateSettings: (settings) => fetchJson('/api/settings', {
    method: 'POST',
    body: JSON.stringify(settings)
  }),
  getLogs: (limit = 50) => fetchJson(`/api/settings/logs?limit=${limit}`),
  clearLogs: () => fetchJson('/api/settings/logs', { method: 'DELETE' }),

  // Backward compatibility status
  getStatus: () => fetchJson('/api/status'),

  // Package Manager endpoints
  getDeviceCapabilities: (serial, refresh = false) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/packages/capabilities${refresh ? '?refresh=1' : ''}`),
  getPackages: (serial, refresh = false) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/packages${refresh ? '?refresh=1' : ''}`),
  getPackageDetails: (serial, pkgName) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/packages/${encodeURIComponent(pkgName)}`),
  createPackagePlan: (serial, payload) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/packages/plan`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  executePackagePlan: (serial, payload) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/packages/execute`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  backupPackages: (serial, payload) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/packages/backup`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  getBackups: (serial) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/packages/backups`),
  getBackupDownloadUrl: (serial, backupId) => 
    `/api/devices/${encodeURIComponent(serial)}/packages/backups/${encodeURIComponent(backupId)}/download`,
  restoreBackup: (serial, backupId, payload) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/packages/backups/${encodeURIComponent(backupId)}/restore`, {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  deleteBackup: (serial, backupId) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/packages/backups/${encodeURIComponent(backupId)}`, {
      method: 'DELETE'
    }),
  installApks: (serial, formData) => 
    uploadForm(`/api/devices/${encodeURIComponent(serial)}/packages/install`, formData),
  getJobStreamUrl: (serial, jobId) => 
    `/api/devices/${encodeURIComponent(serial)}/packages/jobs/${encodeURIComponent(jobId)}/stream`,
  getAuditLogs: (serial, limit = 100) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/packages/audit?limit=${limit}`),
  rebootDevice: (serial) => 
    fetchJson('/api/action', {
      method: 'POST',
      body: JSON.stringify({ serial, action: 'reboot' })
    }),

  // Memory & RAM Stats
  getMemoryStats: (serial) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/memory`),
  getTopMemoryProcesses: (serial, limit = 10) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/memory/top?limit=${limit}`),

  // Process Management
  getProcesses: (serial) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/processes`),
  killProcess: (serial, pid, options = {}) => 
    fetchJson(`/api/devices/${encodeURIComponent(serial)}/processes/${encodeURIComponent(pid)}/kill`, {
      method: 'POST',
      body: JSON.stringify(options)
    }),
  getProcessStreamUrl: (serial, interval = 2000) => 
    `/api/devices/${encodeURIComponent(serial)}/processes/stream?interval=${interval}`
};
