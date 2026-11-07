const { EventEmitter } = require('events');

class JobManager extends EventEmitter {
  constructor() {
    super();
    this.jobs = new Map(); // jobId -> Job
    this.deviceActiveJobs = new Map(); // serial -> jobId
  }

  isDeviceBusy(serial) {
    if (!serial) return false;
    const jobId = this.deviceActiveJobs.get(serial);
    if (!jobId) return false;
    const job = this.jobs.get(jobId);
    if (job && (job.status === 'running' || job.status === 'pending')) {
      return true;
    }
    this.deviceActiveJobs.delete(serial);
    return false;
  }

  getActiveJobForDevice(serial) {
    const jobId = this.deviceActiveJobs.get(serial);
    if (!jobId) return null;
    return this.jobs.get(jobId) || null;
  }

  createJob(serial, type, metadata = {}) {
    if (this.isDeviceBusy(serial)) {
      const busyJob = this.getActiveJobForDevice(serial);
      const err = new Error(`Device ${serial} is busy with job ${busyJob ? busyJob.id : ''}. Please wait for it to finish.`);
      err.code = 'DEVICE_BUSY';
      err.runningJobId = busyJob ? busyJob.id : null;
      throw err;
    }

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const job = {
      id: jobId,
      serial,
      type, // 'execute_plan', 'backup', 'restore', 'install'
      status: 'pending', // 'pending', 'running', 'completed', 'failed', 'cancelled'
      createdAt: Date.now(),
      startedAt: null,
      finishedAt: null,
      metadata,
      events: [],
      subscribers: new Set(),
      cancelled: false
    };

    this.jobs.set(jobId, job);
    this.deviceActiveJobs.set(serial, jobId);
    return job;
  }

  getJob(jobId) {
    return this.jobs.get(jobId) || null;
  }

  startJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'running';
      job.startedAt = Date.now();
      this.sendEvent(jobId, {
        step: 'init',
        status: 'running',
        message: `Job ${jobId} started.`
      });
    }
  }

  sendEvent(jobId, eventData) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const payload = {
      timestamp: Date.now(),
      jobId,
      ...eventData
    };

    job.events.push(payload);

    // Stream to active SSE clients
    for (const res of job.subscribers) {
      try {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (_) {
        job.subscribers.delete(res);
      }
    }
  }

  completeJob(jobId, summary = {}) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'completed';
    job.finishedAt = Date.now();
    job.summary = summary;

    this.sendEvent(jobId, {
      step: 'finish',
      status: 'done',
      done: true,
      message: 'Job completed successfully.',
      summary
    });

    if (job.serial && this.deviceActiveJobs.get(job.serial) === jobId) {
      this.deviceActiveJobs.delete(job.serial);
    }

    // Close subscribers after short delay
    setTimeout(() => {
      for (const res of job.subscribers) {
        try {
          res.end();
        } catch (_) {}
      }
      job.subscribers.clear();
    }, 1000);
  }

  failJob(jobId, error) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'failed';
    job.finishedAt = Date.now();
    job.error = typeof error === 'string' ? error : error.message;

    this.sendEvent(jobId, {
      step: 'error',
      status: 'failed',
      done: true,
      error: job.error,
      message: `Job failed: ${job.error}`
    });

    if (job.serial && this.deviceActiveJobs.get(job.serial) === jobId) {
      this.deviceActiveJobs.delete(job.serial);
    }

    setTimeout(() => {
      for (const res of job.subscribers) {
        try {
          res.end();
        } catch (_) {}
      }
      job.subscribers.clear();
    }, 1000);
  }

  cancelJob(jobId, reason = 'Cancelled by user') {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.cancelled = true;
    job.status = 'cancelled';
    job.finishedAt = Date.now();

    this.sendEvent(jobId, {
      step: 'cancelled',
      status: 'skipped',
      done: true,
      message: `Job cancelled: ${reason}`
    });

    if (job.serial && this.deviceActiveJobs.get(job.serial) === jobId) {
      this.deviceActiveJobs.delete(job.serial);
    }
  }

  /**
   * Subscribe an Express SSE response to job stream
   */
  subscribe(jobId, res) {
    const job = this.jobs.get(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    // Replay existing events to newly connected client
    for (const ev of job.events) {
      res.write(`data: ${JSON.stringify(ev)}\n\n`);
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      res.end();
      return;
    }

    job.subscribers.add(res);

    res.on('close', () => {
      job.subscribers.delete(res);
    });
  }
}

module.exports = new JobManager();

