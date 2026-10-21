const express = require('express');
const router = express.Router();
const adb = require('../services/adb');
const scrcpy = require('../services/scrcpy');
const db = require('../services/db');

/**
 * GET /api/devices
 * Lists all connected devices and evaluates compatibility (scrcpy vs legacy)
 */
router.get('/', async (req, res) => {
  try {
    const result = await adb.getDevices();
    const scrcpyStatus = await scrcpy.checkAvailability();

    // Enhance device list with stored metadata
    const devices = (result.devices || []).map(dev => {
      const stored = db.getDevice(dev.serial) || {};
      const scrcpySession = scrcpy.getSession(dev.serial);

      return {
        ...dev,
        apiLevel: stored.apiLevel || null,
        androidVersion: stored.androidVersion || null,
        isLegacy: stored.isLegacy ?? (stored.apiLevel ? stored.apiLevel < 21 : null),
        modeRecommended: stored.modeRecommended || (stored.apiLevel && stored.apiLevel < 21 ? 'legacy' : 'scrcpy'),
        preferredMode: stored.preferredMode || db.getSettings().defaultMode,
        scrcpySession
      };
    });

    res.json({
      success: true,
      devices,
      scrcpyAvailable: scrcpyStatus.available,
      scrcpyVersion: scrcpyStatus.version
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/devices/:serial/info
 * Detailed device properties & screen size
 */
router.get('/:serial/info', async (req, res) => {
  try {
    const { serial } = req.params;
    const info = await adb.getDeviceInfo(serial);
    const session = scrcpy.getSession(serial);
    res.json({ ...info, scrcpySession: session });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/devices/:serial/mode
 * Change preferred control mode ('auto', 'scrcpy', 'legacy')
 */
router.post('/:serial/mode', (req, res) => {
  try {
    const { serial } = req.params;
    const { mode } = req.body;
    if (!['auto', 'scrcpy', 'legacy'].includes(mode)) {
      return res.status(400).json({ error: 'Mode must be "auto", "scrcpy", or "legacy"' });
    }

    const updated = db.upsertDevice({ serial, preferredMode: mode });
    res.json({ success: true, device: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
