import React, { useState, useEffect } from 'react';
import { useDevice } from '../context/DeviceContext';
import { api } from '../services/api';
import { 
  X, 
  Wifi, 
  Copy, 
  Check, 
  Terminal, 
  Monitor, 
  Info, 
  Trash2,
  Save
} from 'lucide-react';

export default function SettingsModal({ isOpen, onClose }) {
  const { networkInfo, refreshDevices, addLog } = useDevice();
  const [adbPath, setAdbPath] = useState('adb');
  const [scrcpyPath, setScrcpyPath] = useState('scrcpy');
  const [scrcpyStatus, setScrcpyStatus] = useState(null);
  const [copiedLan, setCopiedLan] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    api.getSettings().then(data => {
      if (data.settings) {
        setAdbPath(data.settings.adbPath || 'adb');
        setScrcpyPath(data.settings.scrcpyPath || 'scrcpy');
      }
      if (data.scrcpy) {
        setScrcpyStatus(data.scrcpy);
      }
    }).catch(() => {});
  }, [isOpen]);

  const handleCopyLan = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLan(true);
      setTimeout(() => setCopiedLan(false), 2000);
    } catch (_) {}
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      await api.updateSettings({ adbPath, scrcpyPath });
      setSaveSuccess(true);
      addLog('Saved ADB and scrcpy path settings', 'success');
      refreshDevices();
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      addLog(`Failed to save settings: ${err.message}`, 'error');
    }
  };

  const handleClearLogs = async () => {
    try {
      await api.clearLogs();
      addLog('Action history cleared', 'info');
    } catch (_) {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs select-none p-4">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden text-zinc-800 dark:text-zinc-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">DroidCraft Settings</span>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Local Network Exposure */}
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50 space-y-2">
            <div className="flex items-center space-x-1.5 font-medium text-zinc-900 dark:text-zinc-100">
              <Wifi className="w-4 h-4 text-zinc-500" />
              <span>Local Network Access (Wi-Fi)</span>
            </div>
            <p className="text-zinc-500 text-[11px]">
              Access DroidCraft from other smartphones, tablets, or computers on your Wi-Fi:
            </p>
            {networkInfo?.networkUrls?.length > 0 ? (
              networkInfo.networkUrls.map(net => (
                <div key={net.address} className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    readOnly
                    value={net.url}
                    className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-2.5 py-1.5 font-mono text-[11px] text-zinc-800 dark:text-zinc-200"
                  />
                  <button
                    onClick={() => handleCopyLan(net.url)}
                    className="px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded flex items-center space-x-1"
                  >
                    {copiedLan ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLan ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              ))
            ) : (
              <div className="text-zinc-400 font-mono text-[11px]">http://localhost:3000</div>
            )}
          </div>

          {/* ADB & Scrcpy Paths Form */}
          <form onSubmit={handleSaveSettings} className="space-y-3">
            <div>
              <label className="flex items-center space-x-1.5 font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                <Terminal className="w-3.5 h-3.5 text-zinc-500" />
                <span>ADB Executable Path</span>
              </label>
              <input
                type="text"
                value={adbPath}
                onChange={(e) => setAdbPath(e.target.value)}
                placeholder="adb or C:\platform-tools\adb.exe"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-zinc-800 dark:text-zinc-200 outline-none focus:border-zinc-400"
              />
            </div>

            <div>
              <label className="flex items-center justify-between font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                <span className="flex items-center space-x-1.5">
                  <Monitor className="w-3.5 h-3.5 text-zinc-500" />
                  <span>scrcpy Executable Path</span>
                </span>
                {scrcpyStatus?.available ? (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    Detected v{scrcpyStatus.version}
                  </span>
                ) : (
                  <span className="text-[10px] text-zinc-400">Optional (for Android 5.0+)</span>
                )}
              </label>
              <input
                type="text"
                value={scrcpyPath}
                onChange={(e) => setScrcpyPath(e.target.value)}
                placeholder="scrcpy or C:\Tools\scrcpy\scrcpy.exe"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2.5 py-1.5 font-mono text-zinc-800 dark:text-zinc-200 outline-none focus:border-zinc-400"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleClearLogs}
                className="flex items-center space-x-1 text-zinc-500 hover:text-red-500 transition text-[11px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Action Logs</span>
              </button>

              <button
                type="submit"
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 rounded font-medium hover:opacity-90 transition"
              >
                {saveSuccess ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saveSuccess ? 'Saved' : 'Save Changes'}</span>
              </button>
            </div>
          </form>

          {/* Engine Specs Note */}
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 text-zinc-500 text-[11px] space-y-1">
            <div className="flex items-center space-x-1 text-zinc-700 dark:text-zinc-300 font-medium">
              <Info className="w-3.5 h-3.5" />
              <span>Multi-Generation Architecture</span>
            </div>
            <p>• <strong>Android 4.2.2 (API 17)</strong>: Staged in <code>/data/local/tmp</code> with ADB pull & mutex locking.</p>
            <p>• <strong>Android 5.0+ (API 21+)</strong>: High-speed hardware-accelerated scrcpy mirror.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
