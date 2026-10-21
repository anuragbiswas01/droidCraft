const express = require('express');
const router = express.Router();
const os = require('os');
const db = require('../services/db');
const adb = require('../services/adb');
const scrcpy = require('../services/scrcpy');

function getNetworkInfo(port = 3000) {
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
    port,
    localUrl: `http://localhost:${port}`,
    networkUrls: addresses
  };
}

/**
 * GET /api/settings
 * Returns app settings, network interfaces, and tool paths
 */
router.get('/', async (req, res) => {
  try {
    const settings = db.getSettings();
    const network = getNetworkInfo(parseInt(process.env.PORT || '3000', 10));
    const scrcpyCheck = await scrcpy.checkAvailability();

    res.json({
      settings,
      network,
      scrcpy: scrcpyCheck
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/settings
 * Updates local db settings
 */
router.post('/', (req, res) => {
  try {
    const updated = db.updateSettings(req.body);
    if (req.body.adbPath) {
      adb.setAdbPath(req.body.adbPath);
    }
    if (req.body.scrcpyPath) {
      scrcpy.setScrcpyPath(req.body.scrcpyPath);
    }
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * GET /api/logs
 * Activity logs from local DB
 */
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit || '50', 10);
  res.json({ logs: db.getLogs(limit) });
});

/**
 * DELETE /api/logs
 * Clears activity logs
 */
router.delete('/logs', (req, res) => {
  db.clearLogs();
  res.json({ success: true });
});

module.exports = { router, getNetworkInfo };
