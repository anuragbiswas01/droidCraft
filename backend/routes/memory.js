const express = require('express');
const router = express.Router({ mergeParams: true });
const memoryService = require('../services/memoryService');

/**
 * GET /api/devices/:serial/memory
 * Returns detailed RAM and swap / ZRAM statistics from /proc/meminfo
 */
router.get('/', async (req, res) => {
  try {
    const { serial } = req.params;
    const stats = await memoryService.getMemoryStats(serial);
    res.json({
      success: true,
      stats
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/devices/:serial/memory/top
 * Returns top memory-consuming processes from dumpsys meminfo
 */
router.get('/top', async (req, res) => {
  try {
    const { serial } = req.params;
    const limit = parseInt(req.query.limit, 10) || 10;
    const top = await memoryService.getTopMemoryProcesses(serial, limit);
    res.json({
      success: true,
      top
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;

