const express = require('express');
const router = express.Router();
const adb = require('../services/adb');

/**
 * GET /api/screen.png or /api/screen?serial=...
 * Captures PNG frame via legacy /data/local/tmp and streams bytes
 */
router.get('/', async (req, res) => {
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
 * GET /api/screen/last
 * Serves last known cached frame without issuing new capture
 */
router.get('/last', (req, res) => {
  const { serial } = req.query;
  if (!serial) {
    return res.status(400).json({ error: 'Query parameter "serial" is required.' });
  }

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
});

module.exports = router;
