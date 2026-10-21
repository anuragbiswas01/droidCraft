const express = require('express');
const router = express.Router();
const adb = require('../services/adb');

/**
 * POST /api/action
 * Dispatches ADB control actions (tap, swipe, scroll, text, keyevents)
 */
router.post('/', async (req, res) => {
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

module.exports = router;
