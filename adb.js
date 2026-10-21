const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class AdbController {
  constructor(options = {}) {
    this.adbPath = options.adbPath || process.env.ADB_PATH || 'adb';
    this.tempDir = path.join(os.tmpdir(), 'mobiscreen_tmp');
    this.captureLocks = new Map(); // serial -> boolean
    this.lastScreenshots = new Map(); // serial -> { buffer, width, height, timestamp }
    this.ensureTempDir();
  }

  ensureTempDir() {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
      }
    } catch (err) {
      console.error('Failed to create local temp directory:', err);
    }
  }

  setAdbPath(newPath) {
    if (typeof newPath === 'string' && newPath.trim()) {
      this.adbPath = newPath.trim();
    }
  }

  getAdbPath() {
    return this.adbPath;
  }

  /**
   * Run adb command with arguments using child_process.execFile.
   * Safe against shell injection because arguments are passed as an array directly to the executable.
   */
  runAdb(args, options = {}) {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || 15000;
      execFile(
        this.adbPath,
        args,
        {
          windowsHide: true,
          timeout,
          maxBuffer: 10 * 1024 * 1024,
          ...options
        },
        (error, stdout, stderr) => {
          if (error) {
            error.stdout = stdout;
            error.stderr = stderr;
            return reject(error);
          }
          resolve({ stdout: stdout ? stdout.toString() : '', stderr: stderr ? stderr.toString() : '' });
        }
      );
    });
  }

  /**
   * Validates serial string to ensure it contains only safe characters
   */
  validateSerial(serial) {
    if (!serial || typeof serial !== 'string') {
      throw new Error('Device serial is required.');
    }
    const clean = serial.trim();
    if (!/^[A-Za-z0-9_.:-]+$/.test(clean)) {
      throw new Error(`Invalid device serial format: ${serial}`);
    }
    return clean;
  }

  /**
   * List connected devices
   */
  async getDevices() {
    try {
      const { stdout } = await this.runAdb(['devices', '-l'], { timeout: 6000 });
      const lines = stdout.split(/\r?\n/);
      const devices = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('List of devices attached') || trimmed.startsWith('* daemon')) {
          continue;
        }

        // Format is: <serial> <state> [product:X model:Y device:Z transport_id:W]
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 2) {
          const serial = parts[0];
          const state = parts[1]; // 'device', 'unauthorized', 'offline', etc.
          const details = parts.slice(2).join(' ');

          let model = '';
          const modelMatch = details.match(/model:([^\s]+)/);
          if (modelMatch) model = modelMatch[1];

          devices.push({
            serial,
            state,
            authorized: state === 'device',
            details,
            model: model || undefined
          });
        }
      }

      return {
        success: true,
        adbPath: this.adbPath,
        devices
      };
    } catch (err) {
      return {
        success: false,
        adbPath: this.adbPath,
        error: `ADB error: ${err.message || 'Failed to list devices'}`,
        stderr: err.stderr || '',
        devices: []
      };
    }
  }

  /**
   * Get device properties (Android version, model, screen dimensions)
   */
  async getDeviceInfo(rawSerial) {
    const serial = this.validateSerial(rawSerial);
    try {
      const [releaseRes, modelRes, brandRes, dumpsysRes] = await Promise.allSettled([
        this.runAdb(['-s', serial, 'shell', 'getprop', 'ro.build.version.release']),
        this.runAdb(['-s', serial, 'shell', 'getprop', 'ro.product.model']),
        this.runAdb(['-s', serial, 'shell', 'getprop', 'ro.product.brand']),
        this.runAdb(['-s', serial, 'shell', 'dumpsys', 'window'])
      ]);

      const androidVersion = releaseRes.status === 'fulfilled' ? releaseRes.value.stdout.trim() : 'Unknown';
      const model = modelRes.status === 'fulfilled' ? modelRes.value.stdout.trim() : 'Unknown';
      const brand = brandRes.status === 'fulfilled' ? brandRes.value.stdout.trim() : 'Unknown';

      let screenWidth = null;
      let screenHeight = null;

      // Extract resolution from dumpsys window if available
      if (dumpsysRes.status === 'fulfilled') {
        const out = dumpsysRes.value.stdout;
        const initMatch = out.match(/init=(\d+)x(\d+)/i) || out.match(/mUnrestrictedScreen=\(\d+,\d+\)\s+(\d+)x(\d+)/i);
        if (initMatch) {
          screenWidth = parseInt(initMatch[1], 10);
          screenHeight = parseInt(initMatch[2], 10);
        }
      }

      // If we previously captured a screenshot, use its exact PNG dimensions
      const last = this.lastScreenshots.get(serial);
      if (last && last.width && last.height) {
        screenWidth = last.width;
        screenHeight = last.height;
      }

      return {
        success: true,
        serial,
        androidVersion,
        model,
        brand,
        screenWidth,
        screenHeight
      };
    } catch (err) {
      throw new Error(`Failed to get device info: ${err.message}`);
    }
  }

  /**
   * Check if the notification shade (StatusBar window) currently has focus
   */
  async isNotificationShadeOpen(rawSerial) {
    const serial = this.validateSerial(rawSerial);
    try {
      const { stdout } = await this.runAdb(['-s', serial, 'shell', 'dumpsys', 'window'], { timeout: 3000 });
      return stdout.includes('mCurrentFocus=Window{') && /mCurrentFocus=Window\{[0-9a-fA-F]+\s+u\d+\s+StatusBar\}/i.test(stdout);
    } catch (_) {
      return false;
    }
  }

  /**
   * Extract PNG width and height from PNG header (IHDR chunk)
   */
  parsePngDimensions(buffer) {
    if (!buffer || buffer.length < 24) return null;
    // Check PNG signature: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] !== 0x89 ||
      buffer[1] !== 0x50 ||
      buffer[2] !== 0x4e ||
      buffer[3] !== 0x47 ||
      buffer[4] !== 0x0d ||
      buffer[5] !== 0x0a ||
      buffer[6] !== 0x1a ||
      buffer[7] !== 0x0a
    ) {
      return null;
    }
    // IHDR width at offset 16, height at offset 20 (both 32-bit BE)
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  /**
   * Capture screenshot via /data/local/tmp and pull to local Windows host.
   * Enforces single-concurrency lock per serial to avoid ADB overlapping.
   */
  async captureScreenshot(rawSerial) {
    const serial = this.validateSerial(rawSerial);

    if (this.captureLocks.get(serial)) {
      const err = new Error('A screenshot capture is already in progress for this device.');
      err.code = 'CAPTURE_BUSY';
      throw err;
    }

    this.captureLocks.set(serial, true);
    const startTime = Date.now();

    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const remoteFilename = `sc_${startTime}_${randomSuffix}.png`;
    const remotePath = `/data/local/tmp/${remoteFilename}`;
    const localFilename = `screen_${serial.replace(/[^a-zA-Z0-9]/g, '_')}_${randomSuffix}.png`;
    const localPath = path.join(this.tempDir, localFilename);

    try {
      // Step 1: Capture screenshot directly on the device into /data/local/tmp
      await this.runAdb(['-s', serial, 'shell', 'screencap', '-p', remotePath], { timeout: 12000 });

      // Step 2: Pull the file to Windows host
      await this.runAdb(['-s', serial, 'pull', remotePath, localPath], { timeout: 10000 });

      // Step 3: Best-effort cleanup of remote file on device
      this.runAdb(['-s', serial, 'shell', 'rm', '-f', remotePath], { timeout: 4000 }).catch(() => {});

      // Step 4: Validate pulled file on Windows host
      if (!fs.existsSync(localPath)) {
        throw new Error('Screenshot file was not created on the host machine.');
      }

      const stat = fs.statSync(localPath);
      if (stat.size === 0) {
        try { fs.unlinkSync(localPath); } catch (_) {}
        throw new Error('Screenshot resulted in a 0-byte file.');
      }

      const buffer = fs.readFileSync(localPath);

      // Clean up local temp file after reading into memory
      try {
        fs.unlinkSync(localPath);
      } catch (_) {}

      // Validate PNG signature & extract dimensions
      const dims = this.parsePngDimensions(buffer);
      if (!dims || dims.width <= 0 || dims.height <= 0) {
        throw new Error('Screenshot data is not a valid PNG image.');
      }

      const captureDurationMs = Date.now() - startTime;
      const screenshotData = {
        buffer,
        width: dims.width,
        height: dims.height,
        timestamp: Date.now(),
        captureDurationMs,
        sizeBytes: buffer.length
      };

      this.lastScreenshots.set(serial, screenshotData);
      return screenshotData;
    } catch (err) {
      // Clean up remote file if error occurred before cleanup
      this.runAdb(['-s', serial, 'shell', 'rm', '-f', remotePath], { timeout: 4000 }).catch(() => {});
      // Clean up local file if left behind
      if (fs.existsSync(localPath)) {
        try { fs.unlinkSync(localPath); } catch (_) {}
      }
      throw err;
    } finally {
      this.captureLocks.set(serial, false);
    }
  }

  /**
   * Returns the cached last valid screenshot, if available
   */
  getLastScreenshot(rawSerial) {
    const serial = this.validateSerial(rawSerial);
    return this.lastScreenshots.get(serial) || null;
  }

  /**
   * Execute an input action (tap, swipe, keyevent, text) with strict validation
   */
  async sendAction(rawSerial, payload) {
    const serial = this.validateSerial(rawSerial);
    if (!payload || typeof payload !== 'object') {
      throw new Error('Payload must be a JSON object.');
    }

    const { action } = payload;
    if (!action || typeof action !== 'string') {
      throw new Error('Action must be specified.');
    }

    const normalizedAction = action.trim().toLowerCase();

    switch (normalizedAction) {
      case 'tap': {
        const x = parseInt(payload.x, 10);
        const y = parseInt(payload.y, 10);
        if (Number.isNaN(x) || Number.isNaN(y) || x < 0 || y < 0) {
          throw new Error('Tap coordinates x and y must be non-negative integers.');
        }

        // Clamp to device dimensions if known
        let clampedX = x;
        let clampedY = y;
        const last = this.lastScreenshots.get(serial);
        if (last && last.width && last.height) {
          clampedX = Math.min(Math.max(0, x), last.width - 1);
          clampedY = Math.min(Math.max(0, y), last.height - 1);
        }

        await this.runAdb(['-s', serial, 'shell', 'input', 'tap', String(clampedX), String(clampedY)], { timeout: 5000 });
        return {
          success: true,
          action: 'tap',
          x: clampedX,
          y: clampedY
        };
      }

      case 'swipe': {
        const x1 = parseInt(payload.x1, 10);
        const y1 = parseInt(payload.y1, 10);
        const x2 = parseInt(payload.x2, 10);
        const y2 = parseInt(payload.y2, 10);

        if ([x1, y1, x2, y2].some(v => Number.isNaN(v) || v < 0)) {
          throw new Error('Swipe coordinates must be non-negative integers.');
        }

        let cx1 = x1, cy1 = y1, cx2 = x2, cy2 = y2;
        const last = this.lastScreenshots.get(serial);
        const screenW = (last && last.width) ? last.width : 480;
        const screenH = (last && last.height) ? last.height : 800;

        cx1 = Math.min(Math.max(0, x1), screenW - 1);
        cy1 = Math.min(Math.max(0, y1), screenH - 1);
        cx2 = Math.min(Math.max(0, x2), screenW - 1);
        cy2 = Math.min(Math.max(0, y2), screenH - 1);

        // Case 1: Pulling down from the top status bar (y <= 48px)
        if (cy1 <= 48 && cy2 > cy1 + 30) {
          await this.runAdb(['-s', serial, 'shell', 'service', 'call', 'statusbar', '1'], { timeout: 4000 });
          return {
            success: true,
            action: 'notifications',
            message: 'Notification shade opened'
          };
        }

        // Case 2: Swiping UP (cy2 < cy1)
        // If the notification shade is currently open, standard input swipe fails on Android 4.2.2
        // due to velocity tracking bug causing the shade to bounce back down.
        // Calling service call statusbar 2 reliably closes it completely!
        if (cy2 < cy1) {
          const isShadeOpen = await this.isNotificationShadeOpen(serial);
          if (isShadeOpen) {
            await this.runAdb(['-s', serial, 'shell', 'service', 'call', 'statusbar', '2'], { timeout: 4000 });
            return {
              success: true,
              action: 'notifications_collapse',
              message: 'Notification shade closed'
            };
          }
        }

        // Case 3: In-app downward swipe
        // To prevent accidentally catching the 38px status bar handle, clamp startY >= 52px
        let startY = cy1;
        if (cy2 > cy1 && startY < 52) {
          startY = 54;
        }

        // Case 4: Control swipe speed / distance to avoid the 50ms Android fling bug!
        // On Android 4.2.2, input swipe finishes in ~50ms regardless of distance.
        // A 400px+ drag creates an extreme 8000px/s velocity that overshoots violently.
        // Cap maximum distance per swipe to ~220px to produce a natural, readable scroll speed.
        const dx = cx2 - cx1;
        const dy = cy2 - startY;
        const dist = Math.hypot(dx, dy);
        const MAX_SWIPE_DIST = 220;

        let finalX2 = cx2;
        let finalY2 = cy2;
        if (dist > MAX_SWIPE_DIST) {
          const ratio = MAX_SWIPE_DIST / dist;
          finalX2 = Math.round(cx1 + dx * ratio);
          finalY2 = Math.round(startY + dy * ratio);
        }

        // On Android 4.2.2 (API 17), 'input swipe' takes strictly 4 arguments: <x1> <y1> <x2> <y2>.
        await this.runAdb([
          '-s', serial, 'shell', 'input', 'swipe',
          String(cx1), String(startY), String(finalX2), String(finalY2)
        ], { timeout: 6000 });

        return {
          success: true,
          action: 'swipe',
          x1: cx1,
          y1: startY,
          x2: finalX2,
          y2: finalY2
        };
      }

      case 'scroll': {
        const direction = String(payload.direction || 'down').toLowerCase();
        const last = this.lastScreenshots.get(serial);
        const w = (last && last.width) ? last.width : 480;
        const h = (last && last.height) ? last.height : 800;

        const cx = Math.round(w / 2);
        const cy = Math.round(h / 2);

        // Check if notification shade is open while scrolling UP
        if (direction === 'up') {
          const isShadeOpen = await this.isNotificationShadeOpen(serial);
          if (isShadeOpen) {
            await this.runAdb(['-s', serial, 'shell', 'service', 'call', 'statusbar', '2'], { timeout: 4000 });
            return { success: true, action: 'notifications_collapse', message: 'Closed notification shade' };
          }
        }

        // Calibrated gentle, natural scroll step (130px on 800px display)
        // 130px in 50ms is ~2500 px/s (natural 3-4 item scroll without crazy overshooting)
        const step = Math.round(h * 0.16); // ~128px
        let x1 = cx, y1 = cy, x2 = cx, y2 = cy;

        if (direction === 'down') {
          // Content scrolls down -> finger swipes UP
          y1 = cy + Math.round(step / 2); // e.g. 464
          y2 = cy - Math.round(step / 2); // e.g. 336
        } else if (direction === 'up') {
          // Content scrolls up -> finger swipes DOWN (safely around center, well below status bar!)
          y1 = cy - Math.round(step / 2); // e.g. 336
          y2 = cy + Math.round(step / 2); // e.g. 464
        } else if (direction === 'right') {
          x1 = cx + Math.round(w * 0.18);
          x2 = cx - Math.round(w * 0.18);
        } else if (direction === 'left') {
          x1 = cx - Math.round(w * 0.18);
          x2 = cx + Math.round(w * 0.18);
        } else {
          throw new Error(`Invalid scroll direction: ${direction}. Use 'up', 'down', 'left', or 'right'.`);
        }

        await this.runAdb([
          '-s', serial, 'shell', 'input', 'swipe',
          String(x1), String(y1), String(x2), String(y2)
        ], { timeout: 6000 });

        return {
          success: true,
          action: 'scroll',
          direction,
          x1,
          y1,
          x2,
          y2
        };
      }

      case 'notifications':
      case 'notifications_expand':
        // Service call statusbar 1 reliably opens the notification shade on Android 4.2.2
        await this.runAdb(['-s', serial, 'shell', 'service', 'call', 'statusbar', '1'], { timeout: 4000 });
        return { success: true, action: 'notifications', message: 'Expanded notification shade' };

      case 'notifications_collapse':
        // Service call statusbar 2 reliably closes the notification shade on Android 4.2.2
        await this.runAdb(['-s', serial, 'shell', 'service', 'call', 'statusbar', '2'], { timeout: 4000 });
        return { success: true, action: 'notifications_collapse', message: 'Collapsed notification shade' };

      case 'swipe_up': {
        const last = this.lastScreenshots.get(serial);
        const w = (last && last.width) ? last.width : 480;
        const h = (last && last.height) ? last.height : 800;
        const cx = Math.round(w / 2);
        const cy = Math.round(h / 2);

        // If notification shade is open, swipe up closes it cleanly!
        const isShadeOpen = await this.isNotificationShadeOpen(serial);
        if (isShadeOpen) {
          await this.runAdb(['-s', serial, 'shell', 'service', 'call', 'statusbar', '2'], { timeout: 4000 });
          return { success: true, action: 'notifications_collapse', message: 'Notification shade closed' };
        }

        // Calibrated half-screen swipe (220px) to prevent excessive fling speed
        const y1 = cy + 110;
        const y2 = cy - 110;
        await this.runAdb(['-s', serial, 'shell', 'input', 'swipe', String(cx), String(y1), String(cx), String(y2)], { timeout: 6000 });
        return { success: true, action: 'swipe_up', x1: cx, y1, x2: cx, y2 };
      }

      case 'swipe_down': {
        const last = this.lastScreenshots.get(serial);
        const w = (last && last.width) ? last.width : 480;
        const h = (last && last.height) ? last.height : 800;
        const cx = Math.round(w / 2);
        const cy = Math.round(h / 2);
        // Start safely at cy - 110 (290px), well below the 38px status bar!
        const y1 = cy - 110;
        const y2 = cy + 110;
        await this.runAdb(['-s', serial, 'shell', 'input', 'swipe', String(cx), String(y1), String(cx), String(y2)], { timeout: 6000 });
        return { success: true, action: 'swipe_down', x1: cx, y1, x2: cx, y2 };
      }

      case 'swipe_left': {
        const last = this.lastScreenshots.get(serial);
        const w = (last && last.width) ? last.width : 480;
        const h = (last && last.height) ? last.height : 800;
        const cy = Math.round(h / 2);
        const x1 = Math.round(w * 0.85);
        const x2 = Math.round(w * 0.15);
        await this.runAdb(['-s', serial, 'shell', 'input', 'swipe', String(x1), String(cy), String(x2), String(cy)], { timeout: 6000 });
        return { success: true, action: 'swipe_left', x1, y1: cy, x2, y2: cy };
      }

      case 'swipe_right': {
        const last = this.lastScreenshots.get(serial);
        const w = (last && last.width) ? last.width : 480;
        const h = (last && last.height) ? last.height : 800;
        const cy = Math.round(h / 2);
        const x1 = Math.round(w * 0.15);
        const x2 = Math.round(w * 0.85);
        await this.runAdb(['-s', serial, 'shell', 'input', 'swipe', String(x1), String(cy), String(x2), String(cy)], { timeout: 6000 });
        return { success: true, action: 'swipe_right', x1, y1: cy, x2, y2: cy };
      }

      case 'dpad_up':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '19'], { timeout: 4000 });
        return { success: true, action: 'dpad_up', keycode: 19 };

      case 'dpad_down':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '20'], { timeout: 4000 });
        return { success: true, action: 'dpad_down', keycode: 20 };

      case 'dpad_left':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '21'], { timeout: 4000 });
        return { success: true, action: 'dpad_left', keycode: 21 };

      case 'dpad_right':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '22'], { timeout: 4000 });
        return { success: true, action: 'dpad_right', keycode: 22 };

      case 'page_up':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '92'], { timeout: 4000 });
        return { success: true, action: 'page_up', keycode: 92 };

      case 'page_down':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '93'], { timeout: 4000 });
        return { success: true, action: 'page_down', keycode: 93 };

      case 'home':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '3'], { timeout: 4000 });
        return { success: true, action: 'home', keycode: 3 };

      case 'back':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '4'], { timeout: 4000 });
        return { success: true, action: 'back', keycode: 4 };

      case 'menu':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '82'], { timeout: 4000 });
        return { success: true, action: 'menu', keycode: 82 };

      case 'wake':
        // Try keyevent 224 (KEYCODE_WAKEUP); on some 4.2.2 devices it works, fallback/companion keyevent 26 can be used if screen is asleep
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '224'], { timeout: 4000 });
        return { success: true, action: 'wake', keycode: 224, message: 'Sent WAKEUP (keyevent 224)' };

      case 'power':
        // Keyevent 26 (POWER toggle)
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '26'], { timeout: 4000 });
        return { success: true, action: 'power', keycode: 26, message: 'Toggled POWER (keyevent 26)' };

      case 'volume_up':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '24'], { timeout: 4000 });
        return { success: true, action: 'volume_up', keycode: 24 };

      case 'volume_down':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '25'], { timeout: 4000 });
        return { success: true, action: 'volume_down', keycode: 25 };

      case 'enter':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '66'], { timeout: 4000 });
        return { success: true, action: 'enter', keycode: 66 };

      case 'backspace':
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', '67'], { timeout: 4000 });
        return { success: true, action: 'backspace', keycode: 67 };

      case 'keyevent': {
        const keycode = parseInt(payload.keycode, 10);
        if (Number.isNaN(keycode) || keycode < 0 || keycode > 300) {
          throw new Error('Keycode must be an integer between 0 and 300.');
        }
        await this.runAdb(['-s', serial, 'shell', 'input', 'keyevent', String(keycode)], { timeout: 4000 });
        return { success: true, action: 'keyevent', keycode };
      }

      case 'text': {
        if (typeof payload.text !== 'string' || !payload.text) {
          throw new Error('Text must be a non-empty string.');
        }
        // Sanitize text for Android 4.2.2 shell input
        // On Android 4.2.2, spaces must be passed as %s
        // Restrict to safe characters: alphanumeric, spaces, and basic punctuation
        const rawText = payload.text;
        if (rawText.length > 256) {
          throw new Error('Text exceeds maximum length of 256 characters.');
        }

        // Convert spaces to %s as expected by Android input text
        // Filter out characters that might cause shell issues or control codes
        const safeChars = /^[a-zA-Z0-9\s._\-/@:=+?]+$/;
        if (!safeChars.test(rawText)) {
          throw new Error('Text contains unsupported special characters. Please use alphanumeric, spaces, and basic punctuation (._-/@:=+?).');
        }

        const encodedText = rawText.replace(/ /g, '%s');
        await this.runAdb(['-s', serial, 'shell', 'input', 'text', encodedText], { timeout: 8000 });

        return {
          success: true,
          action: 'text',
          length: rawText.length
        };
      }

      default:
        throw new Error(`Unsupported action: ${action}`);
    }
  }
}

module.exports = AdbController;
