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
  getStatus: () => fetchJson('/api/status')
};
