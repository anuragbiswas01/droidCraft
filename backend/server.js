const express = require('express');
const path = require('path');
const { router: settingsRouter, getNetworkInfo } = require('./routes/settings');
const devicesRouter = require('./routes/devices');
const screenRouter = require('./routes/screen');
const actionsRouter = require('./routes/actions');
const scrcpyRouter = require('./routes/scrcpy');
const adb = require('./services/adb');
const db = require('./services/db');

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const host = process.env.HOST || '0.0.0.0';

// Middleware
app.use(express.json({ limit: '1mb' }));

// CORS & Security Headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Modular API Routes
app.use('/api/devices', devicesRouter);
app.use('/api/screen', screenRouter);
app.use('/api/action', actionsRouter);
app.use('/api/scrcpy', scrcpyRouter);
app.use('/api/settings', settingsRouter);

// Legacy backward-compatibility routes
app.get('/api/status', async (req, res) => {
  try {
    const devResult = await adb.getDevices();
    const network = getNetworkInfo(port);
    res.json({ ...devResult, network });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/device-info', async (req, res) => {
  try {
    const { serial } = req.query;
    if (!serial) return res.status(400).json({ error: 'Query parameter "serial" is required.' });
    const info = await adb.getDeviceInfo(serial);
    res.json(info);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/screen.png', (req, res, next) => {
  req.url = '/';
  screenRouter(req, res, next);
});

app.get('/api/last-screen.png', (req, res, next) => {
  req.url = '/last';
  screenRouter(req, res, next);
});

app.post('/api/adb-path', async (req, res) => {
  try {
    const { adbPath } = req.body;
    if (!adbPath) return res.status(400).json({ error: 'adbPath string is required.' });
    adb.setAdbPath(adbPath);
    const result = await adb.getDevices();
    res.json({ success: true, adbPath: adb.getAdbPath(), devices: result.devices || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Static frontend serving: checks frontend/dist first (React build), then public/
const frontendDistPath = path.join(__dirname, '..', 'frontend', 'dist');
const legacyPublicPath = path.join(__dirname, '..', 'public');

if (require('fs').existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  app.use(express.static(legacyPublicPath));
}

// Error handling
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload.' });
  }
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

// Start listening
const server = app.listen(port, host, () => {
  const netInfo = getNetworkInfo(port);
  console.log(`===================================================`);
  console.log(` mobiCraft Backend Service (Express + Local DB)`);
  console.log(` -------------------------------------------------`);
  console.log(` > Local:   ${netInfo.localUrl}`);
  if (netInfo.networkUrls.length > 0) {
    netInfo.networkUrls.forEach(net => {
      console.log(` > Network: ${net.url} (${net.interface})`);
    });
  } else {
    console.log(` > Network: None detected (connect to Wi-Fi)`);
  }
  console.log(`===================================================`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[Error] Port ${port} is already in use.`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

module.exports = { app, server, adb, db };
