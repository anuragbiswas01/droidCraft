const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const os = require('os');
const path = require('path');
const fs = require('fs');

const adb = require('../services/adb');
const packageScanner = require('../services/packageScanner');
const packageOperations = require('../services/packageOperations');
const backupService = require('../services/backupService');
const jobManager = require('../services/jobManager');
const audit = require('../services/audit');

// Configure Multer for APK uploads to temporary directory
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(os.tmpdir(), 'droidcraft_uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${cleanName}`);
  }
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB max per APK
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.apk' || ext === '.apks' || ext === '.xapk') {
      cb(null, true);
    } else {
      cb(new Error('Only .apk files are supported for installation.'));
    }
  }
});

/**
 * Middleware: ensure valid device serial is present
 */
function requireSerial(req, res, next) {
  const serial = req.params.serial || req.query.serial;
  if (!serial) {
    return res.status(400).json({ error: 'Device serial parameter is required.' });
  }
  req.serial = serial;
  next();
}

router.use(requireSerial);

/**
 * GET /capabilities
 * Device facts (Android version, API, CPU ABI, model, root, provisioning, storage)
 */
router.get('/capabilities', async (req, res) => {
  try {
    const forceRefresh = req.query.refresh === '1';
    const caps = await adb.getDeviceCapabilities(req.serial, forceRefresh);
    res.json({ success: true, capabilities: caps });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /
 * Scan and classify all packages on the device (?refresh=1 to invalidate cache)
 */
router.get('/', async (req, res) => {
  try {
    const refresh = req.query.refresh === '1';
    const packages = await packageScanner.scanPackages(req.serial, { refresh });
    res.json({
      success: true,
      serial: req.serial,
      count: packages.length,
      packages
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /:name
 * Fetch deep package details (permissions, APK paths, versions, sizes) lazily
 */
router.get('/:name', async (req, res) => {
  try {
    const pkgName = req.params.name;
    const details = await packageScanner.getPackageDetails(req.serial, pkgName);
    res.json({ success: true, details });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /plan
 * Dry run for package actions (disable, enable, uninstall, delete, restore)
 */
router.post('/plan', async (req, res) => {
  try {
    const { action, packages = [], options = {} } = req.body;
    if (!action) return res.status(400).json({ error: 'Action is required in plan request.' });
    if (!Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({ error: 'Packages array is required.' });
    }

    const plan = await packageOperations.createPlan(req.serial, action, packages, options);
    res.json({ success: true, plan });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

/**
 * POST /execute
 * Run an approved plan asynchronously
 */
router.post('/execute', async (req, res) => {
  try {
    const { action, packages = [], options = {}, plan } = req.body;

    // Use submitted plan or create one on the fly
    const effectivePlan = plan || await packageOperations.createPlan(req.serial, action, packages, options);

    if (effectivePlan.blocked) {
      return res.status(403).json({
        error: 'Execution blocked by security rules.',
        blockedReasons: effectivePlan.blockedReasons
      });
    }

    // Check device lock
    if (jobManager.isDeviceBusy(req.serial)) {
      const activeJob = jobManager.getActiveJobForDevice(req.serial);
      return res.status(409).json({
        error: `Device is currently busy with another operation (${activeJob ? activeJob.id : ''}).`,
        runningJobId: activeJob ? activeJob.id : null
      });
    }

    // Create mutating job
    const job = jobManager.createJob(req.serial, `execute_${effectivePlan.action}`, {
      action: effectivePlan.action,
      packages: effectivePlan.packages.map(p => p.name)
    });

    // Run asynchronously
    packageOperations.executePlan(req.serial, effectivePlan, job.id).catch(err => {
      console.error(`[Job ${job.id} Error]:`, err);
    });

    res.json({
      success: true,
      jobId: job.id,
      streamUrl: `/api/devices/${encodeURIComponent(req.serial)}/packages/jobs/${job.id}/stream`
    });
  } catch (err) {
    if (err.code === 'DEVICE_BUSY') {
      return res.status(409).json({ error: err.message, runningJobId: err.runningJobId });
    }
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /backup
 * Standalone backup of selected packages to host
 */
router.post('/backup', async (req, res) => {
  try {
    const { packages = [], options = {} } = req.body;
    if (!Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({ error: 'Packages array is required for backup.' });
    }

    if (jobManager.isDeviceBusy(req.serial)) {
      const activeJob = jobManager.getActiveJobForDevice(req.serial);
      return res.status(409).json({
        error: `Device is busy with job ${activeJob ? activeJob.id : ''}.`,
        runningJobId: activeJob ? activeJob.id : null
      });
    }

    const job = jobManager.createJob(req.serial, 'backup', { packages });

    // Execute backup as job
    (async () => {
      try {
        jobManager.startJob(job.id);
        const result = await backupService.createBackup(
          req.serial,
          packages,
          options,
          (progressEvent) => jobManager.sendEvent(job.id, progressEvent)
        );
        jobManager.completeJob(job.id, result);
      } catch (bErr) {
        jobManager.failJob(job.id, bErr);
      }
    })();

    res.json({
      success: true,
      jobId: job.id,
      streamUrl: `/api/devices/${encodeURIComponent(req.serial)}/packages/jobs/${job.id}/stream`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /backups
 * List all backup sessions for this device
 */
router.get('/backups', async (req, res) => {
  try {
    const backups = await backupService.listBackups(req.serial);
    res.json({ success: true, backups });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /backups/:id/download
 * Export backup directory as ZIP archive download
 */
router.get('/backups/:id/download', async (req, res) => {
  try {
    const backupId = req.params.id;
    const caps = await adb.getDeviceCapabilities(req.serial).catch(() => ({ model: 'device' }));
    const filename = `${caps.model || 'device'}_${req.serial}_${backupId}.zip`.replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await backupService.exportBackupZip(req.serial, backupId, res);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

/**
 * POST /backups/:id/restore
 * Restore packages from a backup
 */
router.post('/backups/:id/restore', async (req, res) => {
  try {
    const backupId = req.params.id;
    const { packages = [], options = {} } = req.body;

    if (!Array.isArray(packages) || packages.length === 0) {
      return res.status(400).json({ error: 'Packages array to restore is required.' });
    }

    if (jobManager.isDeviceBusy(req.serial)) {
      return res.status(409).json({ error: 'Device is busy with another operation.' });
    }

    const job = jobManager.createJob(req.serial, 'restore', { backupId, packages });

    const plan = {
      action: 'restore',
      packages: packages.map(p => (typeof p === 'string' ? { name: p } : p)),
      options: { ...options, backupId }
    };

    packageOperations.executePlan(req.serial, plan, job.id).catch(err => {
      console.error(`[Restore Job Error]:`, err);
    });

    res.json({
      success: true,
      jobId: job.id,
      streamUrl: `/api/devices/${encodeURIComponent(req.serial)}/packages/jobs/${job.id}/stream`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /backups/:id
 * Delete a backup session from host storage
 */
router.delete('/backups/:id', async (req, res) => {
  try {
    const backupId = req.params.id;
    await backupService.deleteBackup(req.serial, backupId);
    res.json({ success: true, message: `Backup "${backupId}" deleted.` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * POST /install
 * Multipart upload of one or more APKs to install through ADB
 */
router.post('/install', upload.array('apks', 20), async (req, res) => {
  const uploadedFiles = (req.files || []).map(f => f.path);

  try {
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return res.status(400).json({ error: 'No APK files were uploaded.' });
    }

    const replace = req.body.replace !== 'false';
    const downgrade = req.body.downgrade === 'true';
    const grantPermissions = req.body.grantPermissions === 'true';
    const allowTest = req.body.allowTest === 'true';
    const installAsSystem = req.body.installAsSystem === 'true';

    const result = await packageOperations.installApks(req.serial, uploadedFiles, {
      replace,
      downgrade,
      grantPermissions,
      allowTest,
      installAsSystem
    });

    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  } finally {
    // Clean up uploaded temporary files
    for (const fp of uploadedFiles) {
      try {
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      } catch (_) {}
    }
  }
});

/**
 * GET /jobs/:jobId/stream
 * Server-Sent Events (SSE) live progress stream for jobs
 */
router.get('/jobs/:jobId/stream', (req, res) => {
  jobManager.subscribe(req.params.jobId, res);
});

/**
 * GET /audit
 * Get recent mutating audit logs for this device
 */
router.get('/audit', (req, res) => {
  const limit = parseInt(req.query.limit || '100', 10);
  const logs = audit.getLogs(req.serial, limit);
  res.json({ success: true, serial: req.serial, logs });
});

module.exports = router;

