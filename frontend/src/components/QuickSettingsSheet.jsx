import React, { useState } from 'react';
import { useDevice } from '../context/DeviceContext';
import { 
  ArrowLeft, 
  Circle, 
  Square, 
  Bell, 
  BellOff, 
  Sun, 
  Power, 
  Volume1, 
  Volume2, 
  CornerDownLeft, 
  Delete, 
  Send,
  X,
  Monitor,
  Play,
  Square as StopSquare
} from 'lucide-react';

export default function QuickSettingsSheet({ isOpen, onClose }) {
  const { 
    sendAction, 
    deviceInfo, 
    scrcpySession, 
    launchScrcpy, 
    stopScrcpy 
  } = useDevice();

  const [textInput, setTextInput] = useState('');
  const [showPowerConfirm, setShowPowerConfirm] = useState(false);

  const handleSendText = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    try {
      await sendAction({ action: 'text', text: textInput.trim() }, `Sent text: "${textInput.trim()}"`);
      setTextInput('');
    } catch (_) {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-xs select-none">
      {/* Click outside to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg bg-white dark:bg-zinc-900 border-t md:border border-zinc-200 dark:border-zinc-800 md:rounded-xl shadow-xl max-h-[85vh] overflow-y-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center space-x-2">
            <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100">Quick Controls</span>
            {deviceInfo && (
              <span className="text-[11px] text-zinc-500 font-mono">
                {deviceInfo.model || 'Android'} (v{deviceInfo.androidVersion})
              </span>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Soft Keys */}
        <div>
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-2">Navigation</span>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => sendAction({ action: 'back' }, 'Back (Keyevent 4)')}
              className="flex flex-col items-center justify-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <ArrowLeft className="w-4 h-4 mb-1" />
              <span className="text-[11px]">Back</span>
            </button>

            <button
              onClick={() => sendAction({ action: 'home' }, 'Home (Keyevent 3)')}
              className="flex flex-col items-center justify-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <Circle className="w-4 h-4 mb-1" />
              <span className="text-[11px]">Home</span>
            </button>

            <button
              onClick={() => sendAction({ action: 'menu' }, 'Menu (Keyevent 82)')}
              className="flex flex-col items-center justify-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <Square className="w-4 h-4 mb-1" />
              <span className="text-[11px]">Recents</span>
            </button>

            <button
              onClick={() => sendAction({ action: 'notifications' }, 'Notification shade')}
              className="flex flex-col items-center justify-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <Bell className="w-4 h-4 mb-1" />
              <span className="text-[11px]">Notify</span>
            </button>
          </div>
        </div>

        {/* Hardware & Power Keys */}
        <div>
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-2">Device Hardware</span>
          <div className="grid grid-cols-4 gap-2">
            <button
              onClick={() => sendAction({ action: 'wake' }, 'Screen Wake (Keyevent 224)')}
              className="flex flex-col items-center justify-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <Sun className="w-4 h-4 mb-1" />
              <span className="text-[11px]">Wake Up</span>
            </button>

            <button
              onClick={() => setShowPowerConfirm(true)}
              className="flex flex-col items-center justify-center p-2 rounded bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-100 transition"
            >
              <Power className="w-4 h-4 mb-1" />
              <span className="text-[11px]">Power</span>
            </button>

            <button
              onClick={() => sendAction({ action: 'volume_up' }, 'Volume Up')}
              className="flex flex-col items-center justify-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <Volume2 className="w-4 h-4 mb-1" />
              <span className="text-[11px]">Vol +</span>
            </button>

            <button
              onClick={() => sendAction({ action: 'volume_down' }, 'Volume Down')}
              className="flex flex-col items-center justify-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            >
              <Volume1 className="w-4 h-4 mb-1" />
              <span className="text-[11px]">Vol -</span>
            </button>
          </div>
        </div>

        {/* Remote Text Injection */}
        <div>
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block mb-2">Remote Text Input</span>
          <form onSubmit={handleSendText} className="flex space-x-1.5">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type message or URL..."
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 px-3 py-2 rounded border border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 text-xs rounded hover:opacity-90 transition flex items-center"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => sendAction({ action: 'backspace' }, 'Backspace')}
              className="px-2.5 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 transition"
              title="Backspace"
            >
              <Delete className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => sendAction({ action: 'enter' }, 'Enter (Keyevent 66)')}
              className="px-2.5 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 transition"
              title="Enter"
            >
              <CornerDownLeft className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Modern Scrcpy Toggle (for API 21+ devices) */}
        {deviceInfo && !deviceInfo.isLegacy && (
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Monitor className="w-4 h-4 text-zinc-500" />
                <span className="text-xs text-zinc-700 dark:text-zinc-300">scrcpy Modern Mirror</span>
              </div>
              {scrcpySession?.running ? (
                <button
                  onClick={stopScrcpy}
                  className="flex items-center space-x-1.5 text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 px-2.5 py-1 rounded hover:bg-red-100 transition"
                >
                  <StopSquare className="w-3 h-3" />
                  <span>Stop Session</span>
                </button>
              ) : (
                <button
                  onClick={() => launchScrcpy()}
                  className="flex items-center space-x-1.5 text-xs bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 px-2.5 py-1 rounded hover:opacity-90 transition"
                >
                  <Play className="w-3 h-3" />
                  <span>Launch scrcpy</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Power Confirmation Alert */}
        {showPowerConfirm && (
          <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 rounded text-xs space-y-2">
            <div className="font-medium text-red-800 dark:text-red-300">Toggle Power Key (Keyevent 26)?</div>
            <p className="text-red-700 dark:text-red-400">
              Sending Power may turn off the device screen and interrupt preview.
            </p>
            <div className="flex justify-end space-x-2 pt-1">
              <button
                onClick={() => setShowPowerConfirm(false)}
                className="px-2.5 py-1 text-xs rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowPowerConfirm(false);
                  sendAction({ action: 'power' }, 'Power key sent');
                }}
                className="px-2.5 py-1 text-xs rounded bg-red-600 text-white font-medium hover:bg-red-700 transition"
              >
                Confirm Power
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
