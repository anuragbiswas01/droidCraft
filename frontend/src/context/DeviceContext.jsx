import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../services/api';

const DeviceContext = createContext();

export function DeviceProvider({ children }) {
  const [devices, setDevices] = useState([]);
  const [selectedSerial, setSelectedSerial] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [scrcpyAvailable, setScrcpyAvailable] = useState(false);
  const [scrcpyVersion, setScrcpyVersion] = useState(null);
  const [scrcpySession, setScrcpySession] = useState(null);
  const [mode, setMode] = useState('auto'); // 'auto', 'scrcpy', 'legacy'
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'mirror' | 'apps' | 'system' | 'deck' | 'settings'
  const [capabilities, setCapabilities] = useState(null);

  const [isPolling, setIsPolling] = useState(true);
  const [pollingInterval, setPollingInterval] = useState(1000);
  const [screenBlobUrl, setScreenBlobUrl] = useState(null);
  const [latency, setLatency] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [networkInfo, setNetworkInfo] = useState(null);
  const [logs, setLogs] = useState([]);
  const [errorBanner, setErrorBanner] = useState(null);

  const isCapturingRef = useRef(false);
  const pollingTimerRef = useRef(null);

  // Add an entry to action logs
  const addLog = useCallback((message, type = 'info') => {
    const timeFormatted = new Date().toLocaleTimeString();
    setLogs(prev => [
      { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), timeFormatted, type, message },
      ...prev.slice(0, 49)
    ]);
  }, []);

  // Fetch connected devices & system status
  const refreshDevices = useCallback(async () => {
    try {
      const data = await api.getDevices();
      setScrcpyAvailable(!!data.scrcpyAvailable);
      setScrcpyVersion(data.scrcpyVersion || null);

      const devList = data.devices || [];
      setDevices(devList);

      // Select first authorized device if none is selected or current disconnected
      const currentValid = devList.find(d => d.serial === selectedSerial && d.authorized);
      if (!currentValid) {
        const firstAuth = devList.find(d => d.authorized);
        if (firstAuth) {
          setSelectedSerial(firstAuth.serial);
        } else if (devList.length > 0) {
          setSelectedSerial(devList[0].serial);
        } else {
          setSelectedSerial(null);
          setDeviceInfo(null);
        }
      }

      // Fetch network settings
      const settingsData = await api.getSettings().catch(() => null);
      if (settingsData && settingsData.network) {
        setNetworkInfo(settingsData.network);
      }
    } catch (err) {
      setErrorBanner(`Device discovery failed: ${err.message}`);
      addLog(`Failed to scan devices: ${err.message}`, 'error');
    }
  }, [selectedSerial, addLog]);

  // Load detailed device info & capabilities when selectedSerial changes
  const refreshCapabilities = useCallback(async (force = false) => {
    if (!selectedSerial) {
      setCapabilities(null);
      return null;
    }
    try {
      const data = await api.getDeviceCapabilities(selectedSerial, force);
      if (data.capabilities) {
        setCapabilities(data.capabilities);
        return data.capabilities;
      }
    } catch (err) {
      console.warn('Could not query device capabilities:', err.message);
    }
    return null;
  }, [selectedSerial]);

  // Capture screen frame via legacy ADB
  const captureFrame = useCallback(async () => {
    if (!selectedSerial || isCapturingRef.current) return;
    isCapturingRef.current = true;

    const start = Date.now();
    try {
      const res = await fetch(`/api/screen?serial=${encodeURIComponent(selectedSerial)}&_=${Date.now()}`);
      if (!res.ok) {
        if (res.status === 429) return; // Busy, skip gracefully
        throw new Error(`HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const newUrl = URL.createObjectURL(blob);

      setScreenBlobUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return newUrl;
      });

      const dur = Date.now() - start;
      setLatency(dur);
      setLastUpdated(Date.now());
      setErrorBanner(null);
    } catch (err) {
      setErrorBanner(`Screen mirror dropped: ${err.message}. Showing last known frame.`);
    } finally {
      isCapturingRef.current = false;
    }
  }, [selectedSerial]);

  // Send Touch / Key / Text Actions
  const sendAction = useCallback(async (payload, desc = '') => {
    if (!selectedSerial) return;
    try {
      const res = await api.sendAction(selectedSerial, payload);
      if (desc) addLog(desc, 'info');

      // Refresh frame after action
      setTimeout(captureFrame, 150);
      return res;
    } catch (err) {
      addLog(`Action failed: ${err.message}`, 'error');
      throw err;
    }
  }, [selectedSerial, addLog, captureFrame]);

  // Scrcpy Controls
  const launchScrcpy = useCallback(async (options = {}) => {
    if (!selectedSerial) return;
    try {
      addLog(`Starting scrcpy session for ${selectedSerial}...`, 'info');
      const res = await api.startScrcpy({ serial: selectedSerial, ...options });
      setScrcpySession(res);
      addLog(`scrcpy running on host (PID: ${res.pid})`, 'success');
      return res;
    } catch (err) {
      addLog(`scrcpy start failed: ${err.message}`, 'error');
      throw err;
    }
  }, [selectedSerial, addLog]);

  const stopScrcpy = useCallback(async () => {
    if (!selectedSerial) return;
    try {
      await api.stopScrcpy(selectedSerial);
      setScrcpySession(null);
      addLog(`scrcpy session stopped for ${selectedSerial}`, 'info');
    } catch (err) {
      addLog(`scrcpy stop failed: ${err.message}`, 'error');
    }
  }, [selectedSerial, addLog]);

  const focusScrcpy = useCallback(async () => {
    if (!selectedSerial) return;
    try {
      await api.focusScrcpy(selectedSerial);
      addLog(`Brought scrcpy window to front for ${selectedSerial}`, 'info');
    } catch (_) {}
  }, [selectedSerial, addLog]);

  // Query Device Info on selectedSerial change
  useEffect(() => {
    if (!selectedSerial) {
      setDeviceInfo(null);
      setScrcpySession(null);
      setCapabilities(null);
      return;
    }

    let isMounted = true;
    api.getDeviceInfo(selectedSerial)
      .then(info => {
        if (!isMounted) return;
        setDeviceInfo(info);
        setScrcpySession(info.scrcpySession || null);

        // Auto mode selection: if device is legacy (API < 21), use legacy mode; otherwise scrcpy
        if (info.isLegacy) {
          setMode('legacy');
        } else if (scrcpyAvailable) {
          setMode('scrcpy');
        }
        addLog(`Connected to ${info.model || selectedSerial} (Android ${info.androidVersion || 'Legacy'})`, 'success');
      })
      .catch(err => {
        if (!isMounted) return;
        addLog(`Could not query device info: ${err.message}`, 'warn');
      });

    refreshCapabilities(false);

    return () => { isMounted = false; };
  }, [selectedSerial, scrcpyAvailable, addLog, refreshCapabilities]);

  // Auto-launch scrcpy for modern Android devices (API >= 21) when scrcpy is available
  useEffect(() => {
    if (!selectedSerial || !deviceInfo || !scrcpyAvailable) return;

    const isModern = !deviceInfo.isLegacy && deviceInfo.apiLevel >= 21;
    if (isModern && (mode === 'scrcpy' || mode === 'auto')) {
      if (!scrcpySession?.running) {
        launchScrcpy().catch(err => {
          console.warn('Auto-launch scrcpy notice:', err.message);
        });
      }
    }
  }, [selectedSerial, deviceInfo, scrcpyAvailable, mode, scrcpySession?.running, launchScrcpy]);

  // Capture single initial frame when device connects
  useEffect(() => {
    if (selectedSerial) {
      captureFrame();
    }
  }, [selectedSerial, captureFrame]);

  // Screen Polling Loop - only active for legacy Android (API < 21) or when explicitly in 'legacy' mode
  useEffect(() => {
    const isModern = deviceInfo && !deviceInfo.isLegacy && deviceInfo.apiLevel >= 21;
    const isScrcpyActive = (mode === 'scrcpy' || mode === 'auto') && isModern && (scrcpyAvailable || scrcpySession?.running);

    // If modern device using scrcpy, do NOT poll slow screencaps
    if (isScrcpyActive || !isPolling || !selectedSerial) {
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
      return;
    }

    let isCancelled = false;

    const poll = async () => {
      await captureFrame();
      if (!isCancelled && isPolling && !isScrcpyActive) {
        pollingTimerRef.current = setTimeout(poll, pollingInterval);
      }
    };

    poll();

    return () => {
      isCancelled = true;
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    };
  }, [isPolling, pollingInterval, selectedSerial, captureFrame, deviceInfo, mode, scrcpyAvailable, scrcpySession?.running]);

  // Initial load
  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  return (
    <DeviceContext.Provider value={{
      devices,
      selectedSerial,
      setSelectedSerial,
      deviceInfo,
      scrcpyAvailable,
      scrcpyVersion,
      scrcpySession,
      mode,
      setMode,
      activeTab,
      setActiveTab,
      capabilities,
      setCapabilities,
      refreshCapabilities,
      isPolling,
      setIsPolling,
      pollingInterval,
      setPollingInterval,
      screenBlobUrl,
      latency,
      lastUpdated,
      networkInfo,
      logs,
      errorBanner,
      setErrorBanner,
      refreshDevices,
      captureFrame,
      sendAction,
      launchScrcpy,
      stopScrcpy,
      focusScrcpy,
      addLog
    }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const context = useContext(DeviceContext);
  if (!context) throw new Error('useDevice must be used within DeviceProvider');
  return context;
}
