import React, { useState } from 'react';
import { useDevice } from '../context/DeviceContext';
import { useTheme } from '../context/ThemeContext';
import { 
  Smartphone, 
  RefreshCw, 
  Sun, 
  Moon, 
  Wifi, 
  Check, 
  Settings, 
  Play, 
  Pause,
  ExternalLink
} from 'lucide-react';

export default function Header({ onOpenSettings }) {
  const { 
    devices, 
    selectedSerial, 
    setSelectedSerial, 
    refreshDevices, 
    isPolling, 
    setIsPolling, 
    pollingInterval, 
    setPollingInterval,
    captureFrame,
    networkInfo,
    deviceInfo,
    scrcpySession
  } = useDevice();

  const { theme, toggleTheme } = useTheme();
  const [copiedLan, setCopiedLan] = useState(false);

  const handleCopyLan = async () => {
    if (!networkInfo || !networkInfo.networkUrls || networkInfo.networkUrls.length === 0) return;
    const url = networkInfo.networkUrls[0].url;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLan(true);
      setTimeout(() => setCopiedLan(false), 2000);
    } catch (_) {}
  };

  const primaryLan = networkInfo?.networkUrls?.[0]?.url;

  return (
    <header className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 flex items-center justify-between select-none">
      {/* Brand & Device Picker */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <Smartphone className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 tracking-tight">mobiCraft</span>
        </div>

        {/* Device Select */}
        <div className="relative flex items-center pl-3 border-l border-zinc-200 dark:border-zinc-800">
          <select
            value={selectedSerial || ''}
            onChange={(e) => setSelectedSerial(e.target.value)}
            className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded px-2.5 py-1.5 pr-7 border border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400"
          >
            {devices.length === 0 ? (
              <option value="">No devices found</option>
            ) : (
              devices.map((d) => (
                <option key={d.serial} value={d.serial} disabled={!d.authorized}>
                  {d.model || d.serial} {!d.authorized ? '(unauthorized)' : ''}
                </option>
              ))
            )}
          </select>

          <button
            onClick={refreshDevices}
            title="Scan for connected devices"
            className="ml-1.5 p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Device Mode Tag */}
        {deviceInfo && (
          <div className="hidden sm:flex items-center text-[11px] px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400">
            {deviceInfo.isLegacy ? (
              <span>Android {deviceInfo.androidVersion} (Legacy ADB)</span>
            ) : scrcpySession?.running ? (
              <span className="text-emerald-600 dark:text-emerald-400">scrcpy running</span>
            ) : (
              <span>Android {deviceInfo.androidVersion} (API {deviceInfo.apiLevel})</span>
            )}
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center space-x-2">
        {/* LAN Wi-Fi Access Share */}
        {primaryLan && (
          <button
            onClick={handleCopyLan}
            title="Copy local network Wi-Fi URL to open on other devices"
            className="hidden md:flex items-center space-x-1.5 text-xs px-2.5 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
          >
            {copiedLan ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">Copied URL</span>
              </>
            ) : (
              <>
                <Wifi className="w-3.5 h-3.5 text-zinc-500" />
                <span className="font-mono text-[11px]">LAN: {networkInfo.networkUrls[0].address}</span>
              </>
            )}
          </button>
        )}

        {/* Stream Refresh Toggle & Interval */}
        <div className="hidden lg:flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-800 rounded p-0.5 border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setIsPolling(!isPolling)}
            title={isPolling ? 'Pause mirror' : 'Resume live mirror'}
            className={`flex items-center space-x-1 text-xs px-2 py-1 rounded transition ${
              isPolling
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            {isPolling ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isPolling ? 'Live' : 'Paused'}</span>
          </button>

          <select
            value={pollingInterval}
            onChange={(e) => setPollingInterval(Number(e.target.value))}
            className="text-[11px] bg-transparent text-zinc-700 dark:text-zinc-300 outline-none px-1 py-1"
          >
            <option value={500}>500ms</option>
            <option value={1000}>1000ms</option>
            <option value={2000}>2000ms</option>
            <option value={5000}>5000ms</option>
          </select>

          <button
            onClick={captureFrame}
            title="Refresh single frame"
            className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Open settings & documentation"
          className="p-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
