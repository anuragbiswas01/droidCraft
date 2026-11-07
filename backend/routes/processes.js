const express = require('express');
const router = express.Router({ mergeParams: true });
const processService = require('../services/processService');

/**
 * GET /api/devices/:serial/processes
 * Returns running processes parsed from ps/ps -A
 */
router.get('/', async (req, res) => {
  try {
    const { serial } = req.params;
    const processes = await processService.getProcesses(serial, req.query);
    res.json({
      success: true,
      count: processes.length,
      processes
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * POST /api/devices/:serial/processes/:pid/kill
 * Terminate a process by PID with root escalation if needed
 */
router.post('/:pid/kill', async (req, res) => {
  try {
    const { serial, pid } = req.params;
    const { signal, packageName, name } = req.body || {};

    const result = await processService.killProcess(serial, pid, {
      signal,
      packageName,
      name
    });

    res.json({
      success: true,
      result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/devices/:serial/processes/stream
 * Server-Sent Events (SSE) live process stream
 */
router.get('/stream', async (req, res) => {
  const { serial } = req.params;
  const rawInterval = parseInt(req.query.interval, 10);
  const intervalMs = (!isNaN(rawInterval) && rawInterval >= 1000 && rawInterval <= 10000)
    ? rawInterval
    : 2000;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let active = true;

  const sendUpdate = async () => {
    if (!active) return;
    try {
      const processes = await processService.getProcesses(serial);
      if (active) {
        res.write(`event: processes\ndata: ${JSON.stringify({ timestamp: Date.now(), count: processes.length, processes })}\n\n`);
      }
    } catch (err) {
      if (active) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      }
    }
  };

  // Immediate first payload
  await sendUpdate();

  // Periodic timer
  const timer = setInterval(sendUpdate, intervalMs);

  req.on('close', () => {
    active = false;
    clearInterval(timer);
    res.end();
  });
});

module.exports = router;

