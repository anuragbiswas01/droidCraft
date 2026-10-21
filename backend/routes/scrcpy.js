const express = require('express');
const router = express.Router();
const scrcpy = require('../services/scrcpy');
const adb = require('../services/adb');

/**
 * GET /api/scrcpy/status
 * Returns scrcpy system availability and all running sessions
 */
router.get('/status', async (req, res) => {
  try {
    const availability = await scrcpy.checkAvailability();
    const sessions = scrcpy.getAllSessions();
    res.json({
      ...availability,
      sessions
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/scrcpy/start
 * Launches scrcpy for the target device
 */
router.post('/start', async (req, res) => {
  try {
    const { serial, maxSize, bitrate, stayAwake, turnScreenOff, noAudio } = req.body;
    if (!serial) {
      return res.status(400).json({ error: 'Device serial is required.' });
    }

    // Safety check: ensure device is not legacy Android 4.2.2 which scrcpy cannot support
    try {
      const info = await adb.getDeviceInfo(serial);
      if (info && info.apiLevel && info.apiLevel < 21) {
        return res.status(400).json({
          error: `scrcpy requires Android 5.0+ (API 21+). Device is running Android ${info.androidVersion} (API ${info.apiLevel}). Please use Legacy ADB Mode.`,
          isLegacy: true
        });
      }
    } catch (_) {}

    const session = await scrcpy.startSession(serial, {
      maxSize,
      bitrate,
      stayAwake,
      turnScreenOff,
      noAudio
    });

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/scrcpy/stop
 * Terminates scrcpy session for the target device
 */
router.post('/stop', (req, res) => {
  try {
    const { serial } = req.body;
    if (!serial) {
      return res.status(400).json({ error: 'Device serial is required.' });
    }

    const result = scrcpy.stopSession(serial);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
