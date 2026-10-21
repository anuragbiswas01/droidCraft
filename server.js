const express = require('express');
const path = require('path');
const os = require('os');
const AdbController = require('./adb');

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
// Default to 0.0.0.0 to expose server to the local network (Wi-Fi / LAN)
const host = process.env.HOST || '0.0.0.0';

const adb = new AdbController();

/**
 * Discovers non-internal IPv4 LAN network interfaces
 */
function getNetworkInfo() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const iface of netList) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          interface: name,
          address: iface.address,
          url: `http://${iface.address}:${port}`
        });
      }
    }
  }
  return {
    host,
    port,
    localUrl: `http://localhost:${port}`,
    networkUrls: addresses
  };
}

// Basic middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Security headers and CORS headers for local network access
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

/**
 * GET /api/status
 * Returns ADB status, list of attached devices, and LAN network access info
 */
app.get('/api/status', async (req, res) => {
  try {
    const result = await adb.getDevices();
    const network = getNetworkInfo();
    res.json({ ...result, network });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to get ADB status' });
  }
});

/**
 * POST /api/adb-path
 * Update the adb binary path if adb is not in PATH
 */
app.post('/api/adb-path', async (req, res) => {
  try {
    const { adbPath } = req.body;
    if (!adbPath || typeof adbPath !== 'string') {
      return res.status(400).json({ error: 'adbPath string is required.' });
    }
    adb.setAdbPath(adbPath);
    const result = await adb.getDevices();
    res.json({
      success: true,
      adbPath: adb.getAdbPath(),
      devices: result.devices || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/device-info
 * Returns properties of the selected device (Android version, model, resolution)
 */
app.get('/api/device-info', async (req, res) => {
  try {
    const { serial } = req.query;
    if (!serial) {
      return res.status(400).json({ error: 'Query parameter "serial" is required.' });
    }
    const info = await adb.getDeviceInfo(serial);
    res.json(info);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/screen.png
 * Captures screenshot via /data/local/tmp and returns image/png bytes.
 * If capture is currently locked/busy, returns 429 with CAPTURE_BUSY.
 */
app.get('/api/screen.png', async (req, res) => {
  const { serial } = req.query;
  if (!serial) {
    return res.status(400).json({ error: 'Query parameter "serial" is required.' });
  }

  try {
    const screenshot = await adb.captureScreenshot(serial);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', screenshot.buffer.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Screen-Width', String(screenshot.width));
    res.setHeader('X-Screen-Height', String(screenshot.height));
    res.setHeader('X-Capture-Duration-Ms', String(screenshot.captureDurationMs));
    res.setHeader('X-Capture-Timestamp', String(screenshot.timestamp));

    res.end(screenshot.buffer);
  } catch (err) {
    if (err.code === 'CAPTURE_BUSY') {
      return res.status(429).json({
        error: 'Screenshot capture is already in progress for this device.',
        code: 'CAPTURE_BUSY'
      });
    }
    res.status(500).json({
      error: `Screenshot failed: ${err.message || 'Unknown capture error'}`
    });
  }
});

/**
 * GET /api/last-screen.png
 * Serves the last successfully captured screenshot without triggering a new capture
 */
app.get('/api/last-screen.png', (req, res) => {
  const { serial } = req.query;
  if (!serial) {
    return res.status(400).json({ error: 'Query parameter "serial" is required.' });
  }

  try {
    const screenshot = adb.getLastScreenshot(serial);
    if (!screenshot) {
      return res.status(404).json({ error: 'No cached screenshot available for this device.' });
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', screenshot.buffer.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('X-Screen-Width', String(screenshot.width));
    res.setHeader('X-Screen-Height', String(screenshot.height));
    res.setHeader('X-Capture-Timestamp', String(screenshot.timestamp));

    res.end(screenshot.buffer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/action
 * Dispatches an ADB control action (tap, swipe, home, back, menu, wake, power, text, etc.)
 */
app.post('/api/action', async (req, res) => {
  try {
    const { serial, ...payload } = req.body;
    if (!serial) {
      return res.status(400).json({ error: 'Property "serial" is required in request body.' });
    }

    const result = await adb.sendAction(serial, payload);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Fallback error handler
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload.' });
  }
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error: ' + (err.message || '') });
});

// Expose server to local network (0.0.0.0 binds to all local network adapters)
const server = app.listen(port, host, () => {
  const netInfo = getNetworkInfo();
  console.log(`===================================================`);
  console.log(` mobiCraft - Android 4.2.2 Screen Controller`);
  console.log(` -------------------------------------------------`);
  console.log(` > Local:   ${netInfo.localUrl}`);
  if (netInfo.networkUrls.length > 0) {
    netInfo.networkUrls.forEach(net => {
      console.log(` > Network: ${net.url}  (${net.interface})`);
    });
  } else {
    console.log(` > Network: No non-internal network adapters detected`);
  }
  console.log(`===================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[Error] Port ${port} is already in use by another process.`);
    console.error(`You can either:`);
    console.error(`  1. Stop the process currently using port ${port}`);
    console.error(`  2. Start on another port with: $env:PORT="3001"; npm start\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  server.close(() => {
    console.log('\nServer stopped gracefully.');
    process.exit(0);
  });
});

module.exports = { app, server, adb };
