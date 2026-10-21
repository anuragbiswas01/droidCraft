/**
 * mobiCraft - Legacy Android 4.2.2 Browser Controller
 * High-performance, coordinate-mapped ADB screen preview and controller.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const deviceSelect = document.getElementById('device-select');
  const btnRescanDevices = document.getElementById('btn-rescan-devices');
  const statusIndicator = document.getElementById('status-indicator');
  const errorBanner = document.getElementById('error-banner');
  const errorBannerText = document.getElementById('error-banner-text');
  const btnDismissError = document.getElementById('btn-dismiss-error');

  const viewportContainer = document.getElementById('viewport-container');
  const screenImg = document.getElementById('screen-image');
  const screenLoadingOverlay = document.getElementById('screen-loading-overlay');
  const screenPlaceholder = document.getElementById('screen-placeholder');
  const interactionOverlay = document.getElementById('interaction-overlay');
  const scrollHud = document.getElementById('scroll-hud');
  const scrollHudText = document.getElementById('scroll-hud-text');

  // Swipe & Scroll Gesture Elements
  const btnSwipeUp = document.getElementById('btn-swipe-up');
  const btnSwipeDown = document.getElementById('btn-swipe-down');
  const btnSwipeLeft = document.getElementById('btn-swipe-left');
  const btnSwipeRight = document.getElementById('btn-swipe-right');
  const btnScrollDown = document.getElementById('btn-scroll-down');
  const btnScrollUp = document.getElementById('btn-scroll-up');
  const btnPageDown = document.getElementById('btn-page-down');
  const btnPageUp = document.getElementById('btn-page-up');

  const btnTogglePolling = document.getElementById('btn-toggle-polling');
  const togglePollingIcon = document.getElementById('toggle-polling-icon');
  const togglePollingLabel = document.getElementById('toggle-polling-label');
  const selectInterval = document.getElementById('select-interval');
  const btnManualRefresh = document.getElementById('btn-manual-refresh');

  // Metrics
  const valResolution = document.getElementById('val-resolution');
  const valLatency = document.getElementById('val-latency');
  const valUpdated = document.getElementById('val-updated');
  const valStreamStatus = document.getElementById('val-stream-status');

  // Device Info
  const infoDeviceName = document.getElementById('info-device-name');
  const infoOsVersion = document.getElementById('info-os-version');
  const infoSerial = document.getElementById('info-serial');

  // Control Buttons
  const btnActionWake = document.getElementById('btn-action-wake');
  const btnActionPower = document.getElementById('btn-action-power');
  const btnActionHome = document.getElementById('btn-action-home');
  const btnActionBack = document.getElementById('btn-action-back');
  const btnActionMenu = document.getElementById('btn-action-menu');
  const btnActionVolup = document.getElementById('btn-action-volup');
  const btnActionVoldown = document.getElementById('btn-action-voldown');
  const btnActionEnter = document.getElementById('btn-action-enter');

  // Soft Phone Keys
  const btnSoftMenu = document.getElementById('btn-soft-menu');
  const btnSoftHome = document.getElementById('btn-soft-home');
  const btnSoftBack = document.getElementById('btn-soft-back');

  // Text Entry
  const formSendText = document.getElementById('form-send-text');
  const inputTextPayload = document.getElementById('input-text-payload');
  const btnKeyBackspace = document.getElementById('btn-key-backspace');
  const btnKeyEnterForm = document.getElementById('btn-key-enter-form');
  const btnClearText = document.getElementById('btn-clear-text');

  // Activity Log
  const logOutput = document.getElementById('log-output');
  const btnClearLog = document.getElementById('btn-clear-log');

  // Settings Modal
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnCancelSettings = document.getElementById('btn-cancel-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const inputAdbPath = document.getElementById('input-adb-path');
  const btnLanShare = document.getElementById('btn-lan-share');
  const lanShareLabel = document.getElementById('lan-share-label');
  const inputLanUrl = document.getElementById('input-lan-url');
  const btnCopyLanUrl = document.getElementById('btn-copy-lan-url');
  let activeLanUrl = null;

  // Power Warning Modal
  const powerConfirmModal = document.getElementById('power-confirm-modal');
  const btnClosePowerModal = document.getElementById('btn-close-power-modal');
  const btnCancelPower = document.getElementById('btn-cancel-power');
  const btnConfirmPower = document.getElementById('btn-confirm-power');

  // App State
  let currentSerial = null;
  let isPollingActive = true;
  let pollingIntervalMs = 1000;
  let pollingTimer = null;
  let isCaptureInFlight = false;
  let lastCaptureTimestamp = 0;
  let currentBlobUrl = null;
  let freshnessTimer = null;

  // Pointer Interaction Tracking
  let pointerStart = null;

  // =========================================================================
  // Logging Helper
  // =========================================================================
  function log(message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${time}] ${message}`;
    logOutput.appendChild(entry);
    logOutput.scrollTop = logOutput.scrollHeight;
  }

  btnClearLog.addEventListener('click', () => {
    logOutput.innerHTML = '';
  });

  // =========================================================================
  // Error Banner Helper
  // =========================================================================
  function showError(msg) {
    errorBannerText.textContent = msg;
    errorBanner.classList.remove('hidden');
    valStreamStatus.textContent = 'Error';
    valStreamStatus.className = 'metric-value status-badge error';
  }

  function hideError() {
    errorBanner.classList.add('hidden');
  }

  btnDismissError.addEventListener('click', hideError);

  // =========================================================================
  // Device Discovery & Status
  // =========================================================================
  async function refreshDevices() {
    try {
      log('Scanning for connected ADB devices...', 'info');
      const res = await fetch('/api/status');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to reach backend.`);

      const data = await res.json();
      if (data.network) {
        updateNetworkDisplay(data.network);
      }

      if (!data.success && data.error) {
        showError(data.error);
        log(data.error, 'error');
        statusIndicator.className = 'status-indicator-dot offline';
        return;
      }

      deviceSelect.innerHTML = '';
      const devices = data.devices || [];

      if (devices.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No ADB devices found';
        deviceSelect.appendChild(opt);
        statusIndicator.className = 'status-indicator-dot offline';
        showError('No authorized ADB device detected. Ensure USB debugging is active.');
        log('No devices detected by ADB.', 'warn');
        screenPlaceholder.classList.remove('hidden');
        screenLoadingOverlay.classList.add('hidden');
        return;
      }

      let selectedOpt = null;
      devices.forEach(dev => {
        const opt = document.createElement('option');
        opt.value = dev.serial;
        const stateLabel = dev.authorized ? 'authorized' : dev.state;
        opt.textContent = `${dev.model ? dev.model + ' (' + dev.serial + ')' : dev.serial} [${stateLabel}]`;
        if (!dev.authorized) {
          opt.disabled = true;
        }
        deviceSelect.appendChild(opt);

        if (dev.authorized && !selectedOpt) {
          selectedOpt = dev.serial;
        }
      });

      // Preserve previously selected serial if still present and authorized
      const matchingDev = devices.find(d => d.serial === currentSerial && d.authorized);
      if (matchingDev) {
        deviceSelect.value = currentSerial;
      } else if (selectedOpt) {
        deviceSelect.value = selectedOpt;
        onDeviceSelected(selectedOpt);
      } else {
        statusIndicator.className = 'status-indicator-dot warning';
        showError('Device is unauthorized or offline. Check USB authorization prompt.');
        return;
      }

      statusIndicator.className = 'status-indicator-dot online';
      log(`Found ${devices.length} device(s). Selected: ${deviceSelect.value}`, 'success');
    } catch (err) {
      showError(`ADB connection error: ${err.message}`);
      log(`Device check failed: ${err.message}`, 'error');
      statusIndicator.className = 'status-indicator-dot offline';
    }
  }

  async function onDeviceSelected(serial) {
    if (!serial) return;
    currentSerial = serial;
    infoSerial.textContent = serial;
    log(`Connecting to device ${serial}...`, 'info');

    // Fetch device info
    try {
      const res = await fetch(`/api/device-info?serial=${encodeURIComponent(serial)}`);
      if (res.ok) {
        const info = await res.json();
        infoDeviceName.textContent = `${info.brand || ''} ${info.model || 'Android'}`.trim();
        infoOsVersion.textContent = `Android ${info.androidVersion || '4.2.2'}`;
        if (info.screenWidth && info.screenHeight) {
          valResolution.textContent = `${info.screenWidth} x ${info.screenHeight}`;
        }
      }
    } catch (err) {
      log(`Could not load detailed device info: ${err.message}`, 'warn');
    }

    // Trigger initial screenshot capture
    screenLoadingOverlay.classList.remove('hidden');
    screenPlaceholder.classList.add('hidden');
    await captureScreen();
    startPolling();
  }

  deviceSelect.addEventListener('change', (e) => {
    onDeviceSelected(e.target.value);
  });

  btnRescanDevices.addEventListener('click', () => {
    refreshDevices();
  });

  // =========================================================================
  // Screenshot Capture & Streaming
  // =========================================================================
  let refreshPendingAfterCapture = false;

  async function captureScreen() {
    if (!currentSerial) return;
    if (isCaptureInFlight) {
      // Overlap prevention: queue a fresh capture once the current one completes
      refreshPendingAfterCapture = true;
      return;
    }

    isCaptureInFlight = true;
    valStreamStatus.textContent = isPollingActive ? 'Streaming' : 'Manual';
    valStreamStatus.className = 'metric-value status-badge streaming';

    try {
      const url = `/api/screen.png?serial=${encodeURIComponent(currentSerial)}&_t=${Date.now()}`;
      const res = await fetch(url);

      if (res.status === 429) {
        // Capture busy, skip gracefully without dropping last frame
        isCaptureInFlight = false;
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error('Received 0-byte screenshot.');
      }

      // Read dimensions and performance headers
      const width = res.headers.get('X-Screen-Width');
      const height = res.headers.get('X-Screen-Height');
      const durationMs = res.headers.get('X-Capture-Duration-Ms');
      const timestamp = parseInt(res.headers.get('X-Capture-Timestamp') || Date.now(), 10);

      if (width && height) {
        valResolution.textContent = `${width} x ${height}`;
      }
      if (durationMs) {
        valLatency.textContent = `${durationMs} ms`;
      }

      lastCaptureTimestamp = timestamp;
      updateFreshnessDisplay();

      // Revoke previous blob URL to prevent memory leaks
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
      currentBlobUrl = URL.createObjectURL(blob);
      screenImg.src = currentBlobUrl;

      screenLoadingOverlay.classList.add('hidden');
      screenPlaceholder.classList.add('hidden');
      hideError();
    } catch (err) {
      log(`Screen capture error: ${err.message}`, 'error');
      showError(`Screen capture failed: ${err.message} (retaining last known frame)`);
    } finally {
      isCaptureInFlight = false;
      if (refreshPendingAfterCapture) {
        refreshPendingAfterCapture = false;
        setTimeout(captureScreen, 80);
      }
    }
  }

  // Freshness timer updater
  function updateFreshnessDisplay() {
    if (!lastCaptureTimestamp) {
      valUpdated.textContent = '--';
      return;
    }
    const elapsedSec = Math.floor((Date.now() - lastCaptureTimestamp) / 1000);
    if (elapsedSec < 2) {
      valUpdated.textContent = 'Live';
    } else {
      valUpdated.textContent = `${elapsedSec}s ago`;
    }
  }

  freshnessTimer = setInterval(updateFreshnessDisplay, 1000);

  // Polling loop
  function startPolling() {
    if (pollingTimer) clearInterval(pollingTimer);
    if (!isPollingActive) return;

    pollingTimer = setInterval(() => {
      if (isPollingActive && currentSerial && !isCaptureInFlight) {
        captureScreen();
      }
    }, pollingIntervalMs);
  }

  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
    valStreamStatus.textContent = 'Paused';
    valStreamStatus.className = 'metric-value status-badge paused';
  }

  btnTogglePolling.addEventListener('click', () => {
    isPollingActive = !isPollingActive;
    if (isPollingActive) {
      btnTogglePolling.classList.add('active');
      togglePollingIcon.textContent = '⏸';
      togglePollingLabel.textContent = 'Live';
      log('Screen auto-refresh resumed.', 'info');
      startPolling();
      captureScreen();
    } else {
      btnTogglePolling.classList.remove('active');
      togglePollingIcon.textContent = '▶';
      togglePollingLabel.textContent = 'Paused';
      log('Screen auto-refresh paused.', 'info');
      stopPolling();
    }
  });

  selectInterval.addEventListener('change', (e) => {
    pollingIntervalMs = parseInt(e.target.value, 10) || 1000;
    log(`Refresh interval set to ${pollingIntervalMs} ms`, 'info');
    if (isPollingActive) {
      startPolling();
    }
  });

  btnManualRefresh.addEventListener('click', () => {
    log('Triggered manual screen refresh...', 'info');
    captureScreen();
  });

  // =========================================================================
  // Action Dispatcher (POST /api/action)
  // =========================================================================
  async function sendAction(payload, actionDescription) {
    if (!currentSerial) {
      showError('Please select a connected device first.');
      return;
    }

    try {
      log(`Action: ${actionDescription}...`, 'action');
      const res = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial: currentSerial, ...payload })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Action failed on device.');
      }

      log(`✓ ${actionDescription} successful`, 'success');

      // Schedule a screen refresh after action to capture UI changes quickly
      setTimeout(() => {
        if (!isCaptureInFlight) captureScreen();
      }, 350);
    } catch (err) {
      log(`Action failed (${actionDescription}): ${err.message}`, 'error');
      showError(`Command failed: ${err.message}`);
    }
  }

  // =========================================================================
  // Mouse & Touch Coordinate Mapping (Letterboxing aware)
  // =========================================================================
  function getDeviceCoordinates(clientX, clientY, clamp = false) {
    if (!screenImg || !screenImg.naturalWidth || !screenImg.naturalHeight) {
      return null;
    }

    const rect = screenImg.getBoundingClientRect();
    const naturalW = screenImg.naturalWidth;
    const naturalH = screenImg.naturalHeight;
    const displayW = rect.width;
    const displayH = rect.height;

    if (displayW <= 0 || displayH <= 0) return null;

    const naturalAspect = naturalW / naturalH;
    const displayAspect = displayW / displayH;

    let renderW, renderH, offsetX, offsetY;

    if (displayAspect > naturalAspect) {
      // Container is wider than aspect ratio: Letterbox on left and right
      renderH = displayH;
      renderW = displayH * naturalAspect;
      offsetX = (displayW - renderW) / 2;
      offsetY = 0;
    } else {
      // Container is taller than aspect ratio: Letterbox on top and bottom
      renderW = displayW;
      renderH = displayW / naturalAspect;
      offsetX = 0;
      offsetY = (displayH - renderH) / 2;
    }

    let clickX = clientX - rect.left - offsetX;
    let clickY = clientY - rect.top - offsetY;

    if (clamp) {
      clickX = Math.min(Math.max(0, clickX), renderW - 1);
      clickY = Math.min(Math.max(0, clickY), renderH - 1);
    } else {
      // Reject clicks in the letterbox band
      if (clickX < 0 || clickX > renderW || clickY < 0 || clickY > renderH) {
        return null;
      }
    }

    const deviceX = Math.round((clickX / renderW) * naturalW);
    const deviceY = Math.round((clickY / renderH) * naturalH);

    return {
      deviceX: Math.min(Math.max(0, deviceX), naturalW - 1),
      deviceY: Math.min(Math.max(0, deviceY), naturalH - 1),
      viewportX: clientX - viewportContainer.getBoundingClientRect().left,
      viewportY: clientY - viewportContainer.getBoundingClientRect().top
    };
  }

  // Visual HUD for Scroll Feedback
  let scrollHudTimer = null;
  function showScrollHud(text) {
    if (!scrollHud || !scrollHudText) return;
    scrollHudText.textContent = text;
    scrollHud.classList.remove('hidden');
    if (scrollHudTimer) clearTimeout(scrollHudTimer);
    scrollHudTimer = setTimeout(() => {
      scrollHud.classList.add('hidden');
    }, 650);
  }

  // Visual Ripple Feedback
  function createTapRipple(viewportX, viewportY) {
    const ripple = document.createElement('div');
    ripple.className = 'tap-ripple';
    ripple.style.left = `${viewportX}px`;
    ripple.style.top = `${viewportY}px`;
    interactionOverlay.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }

  // Visual Swipe Trail Feedback
  function createSwipeTrail(x1, y1, x2, y2) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.pointerEvents = 'none';

    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('class', 'swipe-trail');

    svg.appendChild(line);
    interactionOverlay.appendChild(svg);
    setTimeout(() => svg.remove(), 700);
  }

  // Pointer Event Listeners for Tap & Drag/Swipe
  viewportContainer.addEventListener('pointerdown', (e) => {
    // Only handle left mouse button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const coords = getDeviceCoordinates(e.clientX, e.clientY);
    if (!coords) return;

    pointerStart = {
      clientX: e.clientX,
      clientY: e.clientY,
      viewportX: coords.viewportX,
      viewportY: coords.viewportY,
      deviceX: coords.deviceX,
      deviceY: coords.deviceY,
      time: Date.now()
    };

    viewportContainer.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  viewportContainer.addEventListener('pointerup', (e) => {
    if (!pointerStart) return;

    const startX = pointerStart.clientX;
    const startY = pointerStart.clientY;
    const endX = e.clientX;
    const endY = e.clientY;

    const distPx = Math.hypot(endX - startX, endY - startY);

    if (distPx < 8) {
      // Tap Action
      const tapX = pointerStart.deviceX;
      const tapY = pointerStart.deviceY;
      createTapRipple(pointerStart.viewportX, pointerStart.viewportY);
      sendAction({ action: 'tap', x: tapX, y: tapY }, `Tap at (${tapX}, ${tapY})`);
    } else {
      // Swipe Action: accurately clamped to phone display dimensions
      const endCoords = getDeviceCoordinates(endX, endY, true);
      const targetX2 = endCoords ? endCoords.deviceX : pointerStart.deviceX;
      const targetY2 = endCoords ? endCoords.deviceY : pointerStart.deviceY;

      const viewportEnd = {
        x: e.clientX - viewportContainer.getBoundingClientRect().left,
        y: e.clientY - viewportContainer.getBoundingClientRect().top
      };

      createSwipeTrail(pointerStart.viewportX, pointerStart.viewportY, viewportEnd.x, viewportEnd.y);

      // If drag started from top status bar (y <= 45px) and moved downwards:
      if (pointerStart.deviceY <= 45 && targetY2 > pointerStart.deviceY + 30) {
        showScrollHud('🔔 Notice');
        sendAction({ action: 'notifications' }, 'Open Notification Shade');
      } else {
        sendAction({
          action: 'swipe',
          x1: pointerStart.deviceX,
          y1: pointerStart.deviceY,
          x2: targetX2,
          y2: targetY2
        }, `Swipe (${pointerStart.deviceX},${pointerStart.deviceY}) ➔ (${targetX2},${targetY2})`);
      }
    }

    try {
      viewportContainer.releasePointerCapture(e.pointerId);
    } catch (_) {}
    pointerStart = null;
    e.preventDefault();
  });

  viewportContainer.addEventListener('pointercancel', () => {
    pointerStart = null;
  });

  // =========================================================================
  // Mouse Wheel / Trackpad Natural Scroll Feature
  // =========================================================================
  const phoneFrame = document.querySelector('.phone-frame');
  let isScrollActionInProgress = false;
  let wheelTimeout = null;
  let accumulatedWheelY = 0;
  let accumulatedWheelX = 0;

  function handleWheelScroll(e) {
    e.preventDefault();
    accumulatedWheelY += e.deltaY;
    accumulatedWheelX += e.deltaX;

    if (isScrollActionInProgress) return;

    if (!wheelTimeout) {
      wheelTimeout = setTimeout(async () => {
        const dy = accumulatedWheelY;
        const dx = accumulatedWheelX;
        accumulatedWheelY = 0;
        accumulatedWheelX = 0;
        wheelTimeout = null;

        if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;

        if (Math.abs(dy) >= Math.abs(dx)) {
          const direction = dy > 0 ? 'down' : 'up';
          showScrollHud(direction === 'down' ? 'Scroll ⬇️' : 'Scroll ⬆️');
          isScrollActionInProgress = true;
          try {
            await sendAction({ action: 'scroll', direction }, `Scroll ${direction}`);
          } finally {
            setTimeout(() => { isScrollActionInProgress = false; }, 80);
          }
        } else {
          const direction = dx > 0 ? 'right' : 'left';
          showScrollHud(direction === 'right' ? 'Scroll ➡️' : 'Scroll ⬅️');
          isScrollActionInProgress = true;
          try {
            await sendAction({ action: 'scroll', direction }, `Scroll ${direction}`);
          } finally {
            setTimeout(() => { isScrollActionInProgress = false; }, 80);
          }
        }
      }, 100);
    }
  }

  if (phoneFrame) {
    phoneFrame.addEventListener('wheel', handleWheelScroll, { passive: false });
  }
  viewportContainer.addEventListener('wheel', handleWheelScroll, { passive: false });

  // =========================================================================
  // Swipe & Scroll Control Buttons
  // =========================================================================
  btnSwipeUp.addEventListener('click', () => {
    showScrollHud('Swipe ▲');
    sendAction({ action: 'swipe_up' }, 'Swipe Up');
  });

  btnSwipeDown.addEventListener('click', () => {
    showScrollHud('Swipe ▼');
    sendAction({ action: 'swipe_down' }, 'Swipe Down');
  });

  btnSwipeLeft.addEventListener('click', () => {
    showScrollHud('Swipe ◀');
    sendAction({ action: 'swipe_left' }, 'Swipe Left');
  });

  btnSwipeRight.addEventListener('click', () => {
    showScrollHud('Swipe ▶');
    sendAction({ action: 'swipe_right' }, 'Swipe Right');
  });

  btnScrollDown.addEventListener('click', () => {
    showScrollHud('Scroll ⬇️');
    sendAction({ action: 'scroll', direction: 'down' }, 'Scroll Down');
  });

  btnScrollUp.addEventListener('click', () => {
    showScrollHud('Scroll ⬆️');
    sendAction({ action: 'scroll', direction: 'up' }, 'Scroll Up');
  });

  btnPageDown.addEventListener('click', () => sendAction({ action: 'page_down' }, 'Page Down'));
  btnPageUp.addEventListener('click', () => sendAction({ action: 'page_up' }, 'Page Up'));

  // Keyboard Arrow Key Navigation
  window.addEventListener('keydown', (e) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) {
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      showScrollHud('Scroll ⬆️');
      sendAction({ action: 'scroll', direction: 'up' }, 'ArrowUp Scroll');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      showScrollHud('Scroll ⬇️');
      sendAction({ action: 'scroll', direction: 'down' }, 'ArrowDown Scroll');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      showScrollHud('Swipe ◀');
      sendAction({ action: 'swipe_right' }, 'ArrowLeft');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      showScrollHud('Swipe ▶');
      sendAction({ action: 'swipe_left' }, 'ArrowRight');
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      sendAction({ action: 'page_down' }, 'Page Down');
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      sendAction({ action: 'page_up' }, 'Page Up');
    }
  });

  // =========================================================================
  // Control Console Actions
  // =========================================================================
  btnActionWake.addEventListener('click', () => sendAction({ action: 'wake' }, 'Wake Screen (Keyevent 224)'));
  btnActionHome.addEventListener('click', () => sendAction({ action: 'home' }, 'Home (Keyevent 3)'));
  btnActionBack.addEventListener('click', () => sendAction({ action: 'back' }, 'Back (Keyevent 4)'));
  btnActionMenu.addEventListener('click', () => sendAction({ action: 'menu' }, 'Menu (Keyevent 82)'));
  btnActionVolup.addEventListener('click', () => sendAction({ action: 'volume_up' }, 'Volume Up (Keyevent 24)'));
  btnActionVoldown.addEventListener('click', () => sendAction({ action: 'volume_down' }, 'Volume Down (Keyevent 25)'));
  btnActionEnter.addEventListener('click', () => sendAction({ action: 'enter' }, 'Enter (Keyevent 66)'));

  const btnActionNotifications = document.getElementById('btn-action-notifications');
  const btnActionCloseNotifications = document.getElementById('btn-action-close-notifications');

  if (btnActionNotifications) {
    btnActionNotifications.addEventListener('click', () => {
      showScrollHud('🔔 Notice');
      sendAction({ action: 'notifications' }, 'Open Notification Shade');
    });
  }

  if (btnActionCloseNotifications) {
    btnActionCloseNotifications.addEventListener('click', () => {
      showScrollHud('🔕 Dismiss');
      sendAction({ action: 'notifications_collapse' }, 'Close Notification Shade');
    });
  }

  // Soft Phone Keys
  btnSoftMenu.addEventListener('click', () => sendAction({ action: 'menu' }, 'Soft Menu'));
  btnSoftHome.addEventListener('click', () => sendAction({ action: 'home' }, 'Soft Home'));
  btnSoftBack.addEventListener('click', () => sendAction({ action: 'back' }, 'Soft Back'));

  // Power Button Modal Handling (Safety requirement from brief)
  btnActionPower.addEventListener('click', () => {
    powerConfirmModal.classList.remove('hidden');
  });

  btnClosePowerModal.addEventListener('click', () => powerConfirmModal.classList.add('hidden'));
  btnCancelPower.addEventListener('click', () => powerConfirmModal.classList.add('hidden'));
  btnConfirmPower.addEventListener('click', () => {
    powerConfirmModal.classList.add('hidden');
    sendAction({ action: 'power' }, 'Power Key Toggle (Keyevent 26)');
  });

  // Text Entry Form
  formSendText.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = inputTextPayload.value.trim();
    if (!text) return;
    sendAction({ action: 'text', text }, `Send text "${text}"`);
    inputTextPayload.value = '';
  });

  btnKeyBackspace.addEventListener('click', () => sendAction({ action: 'backspace' }, 'Backspace (Keyevent 67)'));
  btnKeyEnterForm.addEventListener('click', () => sendAction({ action: 'enter' }, 'Enter (Keyevent 66)'));
  btnClearText.addEventListener('click', () => { inputTextPayload.value = ''; });

  // =========================================================================
  // Settings Modal (Custom ADB Path)
  // =========================================================================
  btnOpenSettings.addEventListener('click', () => {
    settingsModal.classList.remove('hidden');
  });

  function closeSettings() {
    settingsModal.classList.add('hidden');
  }

  btnCloseSettings.addEventListener('click', closeSettings);
  btnCancelSettings.addEventListener('click', closeSettings);

  btnSaveSettings.addEventListener('click', async () => {
    const adbPath = inputAdbPath.value.trim();
    if (!adbPath) {
      closeSettings();
      return;
    }

    try {
      log(`Updating ADB executable path to: ${adbPath}`, 'info');
      const res = await fetch('/api/adb-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adbPath })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update ADB path');
      }

      log(`ADB path updated successfully: ${data.adbPath}`, 'success');
      closeSettings();
      refreshDevices();
    } catch (err) {
      log(`Failed to update ADB path: ${err.message}`, 'error');
      alert(`Error updating ADB path: ${err.message}`);
    }
  });

  // =========================================================================
  // Local Network (LAN) URL Sharing
  // =========================================================================
  function updateNetworkDisplay(network) {
    if (!network) return;
    if (network.networkUrls && network.networkUrls.length > 0) {
      activeLanUrl = network.networkUrls[0].url;
      if (lanShareLabel) {
        lanShareLabel.textContent = `LAN: ${network.networkUrls[0].address}:${network.port}`;
      }
      if (inputLanUrl) {
        inputLanUrl.value = network.networkUrls[0].url;
      }
    } else {
      activeLanUrl = network.localUrl || `http://localhost:${network.port || 3000}`;
      if (lanShareLabel) {
        lanShareLabel.textContent = `Local: :${network.port || 3000}`;
      }
      if (inputLanUrl) {
        inputLanUrl.value = activeLanUrl;
      }
    }
  }

  async function copyLanUrl(buttonElement) {
    const urlToCopy = (inputLanUrl && inputLanUrl.value) ? inputLanUrl.value : (activeLanUrl || window.location.origin);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(urlToCopy);
      } else {
        throw new Error('Clipboard API not available');
      }
      log(`Copied LAN URL to clipboard: ${urlToCopy}`, 'success');
      if (buttonElement) {
        const origContent = buttonElement.innerHTML;
        buttonElement.textContent = '✓ Copied!';
        setTimeout(() => {
          buttonElement.innerHTML = origContent;
        }, 2200);
      }
    } catch (err) {
      if (inputLanUrl) {
        inputLanUrl.select();
        document.execCommand('copy');
        log(`Copied LAN URL to clipboard: ${urlToCopy}`, 'success');
        if (buttonElement) {
          const origContent = buttonElement.innerHTML;
          buttonElement.textContent = '✓ Copied!';
          setTimeout(() => {
            buttonElement.innerHTML = origContent;
          }, 2200);
        }
      }
    }
  }

  if (btnLanShare) {
    btnLanShare.addEventListener('click', () => copyLanUrl(btnLanShare));
  }
  if (btnCopyLanUrl) {
    btnCopyLanUrl.addEventListener('click', () => copyLanUrl(btnCopyLanUrl));
  }

  // Initial Boot
  refreshDevices();
});
