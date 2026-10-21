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

  // Load detailed device info when selectedSerial changes
  useEffect(() => {
    if (!selectedSerial) {
      setDeviceInfo(null);
      setScrcpySession(null);
      return;
    }

    let isMounted = true;
    api.getDeviceInfo(selectedSerial)
      .then(info => {
        if (!isMounted) return;
        setDeviceInfo(info);
        setScrcpySession(info.scrcpySession || null);

        // Auto mode selection: if device is legacy (API < 21), use legacy mode
        if (info.isLegacy) {
          setMode('legacy');
        } else if (scrcpyAvailable) {
          setMode('auto');
        }
        addLog(`Connected to ${info.model || selectedSerial} (Android ${info.androidVersion || 'Legacy'})`, 'success');
      })
      .catch(err => {
        if (!isMounted) return;
        addLog(`Could not query device info: ${err.message}`, 'warn');
      });

    return () => { isMounted = false; };
  }, [selectedSerial, scrcpyAvailable, addLog]);

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

  // Screen Polling Loop
  useEffect(() => {
    if (!isPolling || !selectedSerial) {
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
      return;
    }

    let isCancelled = false;

    const poll = async () => {
      await captureFrame();
      if (!isCancelled && isPolling) {
        pollingTimerRef.current = setTimeout(poll, pollingInterval);
      }
    };

    poll();

    return () => {
      isCancelled = true;
      if (pollingTimerRef.current) clearTimeout(pollingTimerRef.current);
    };
  }, [isPolling, pollingInterval, selectedSerial, captureFrame]);

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
