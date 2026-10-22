import React, { useState } from 'react';
import { useDevice } from '../context/DeviceContext';
import { 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  ChevronsDown, 
  ChevronsUp, 
  Circle, 
  Square, 
  Sun, 
  Power, 
  Volume1, 
  Volume2, 
  Send, 
  CornerDownLeft, 
  Delete, 
  Bell, 
  BellOff, 
  Monitor, 
  Play, 
  Square as StopSquare,
  Activity,
  Trash2
} from 'lucide-react';

export default function SidebarControls() {
  const { 
    sendAction, 
    deviceInfo, 
    scrcpySession, 
    launchScrcpy, 
    stopScrcpy, 
    logs,
    selectedSerial
  } = useDevice();

  const [textInput, setTextInput] = useState('');
  const [showPowerConfirm, setShowPowerConfirm] = useState(false);

  const screenW = deviceInfo?.screenWidth || 480;
  const screenH = deviceInfo?.screenHeight || 800;
  const midX = Math.round(screenW / 2);
  const midY = Math.round(screenH / 2);
  const swipeDeltaX = Math.round(screenW * 0.35); // 35% of screen width
  const swipeDeltaY = Math.round(screenH * 0.25); // 25% of screen height

  const handleSendText = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    try {
      await sendAction({ action: 'text', text: textInput.trim() }, `Typed: "${textInput.trim()}"`);
      setTextInput('');
    } catch (_) {}
  };

  return (
    <div className="w-80 flex flex-col h-full border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 select-none overflow-y-auto p-4 space-y-4">
      {/* Device Summary Card */}
      <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100">
            {deviceInfo?.model || selectedSerial || 'No Device'}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-500 font-mono">
            {deviceInfo?.screenWidth ? `${deviceInfo.screenWidth}×${deviceInfo.screenHeight}` : '480×800'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>OS: Android {deviceInfo?.androidVersion || '4.2.2'}</span>
          <span>{deviceInfo?.isLegacy ? 'Legacy Engine' : 'Modern Engine'}</span>
        </div>
      </div>

      {/* Scrcpy Controller for Modern Devices */}
      {deviceInfo && !deviceInfo.isLegacy && (
        <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <Monitor className="w-3.5 h-3.5 text-zinc-500" />
              <span className="font-medium text-xs text-zinc-800 dark:text-zinc-200">scrcpy Window</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
              scrcpySession?.running 
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' 
                : 'text-zinc-400'
            }`}>
              {scrcpySession?.running ? `PID: ${scrcpySession.pid}` : 'Standby'}
            </span>
          </div>

          {scrcpySession?.running ? (
            <button
              onClick={stopScrcpy}
              className="w-full flex items-center justify-center space-x-1.5 text-xs bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 py-1.5 rounded hover:bg-red-100 transition"
            >
              <StopSquare className="w-3.5 h-3.5" />
              <span>Stop scrcpy Session</span>
            </button>
          ) : (
            <button
              onClick={() => launchScrcpy()}
              className="w-full flex items-center justify-center space-x-1.5 text-xs bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 py-1.5 rounded hover:opacity-90 transition font-medium"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Launch scrcpy Window</span>
            </button>
          )}
        </div>
      )}

      {/* Directional Pad & Quick Scroll */}
      <div className="space-y-2">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Directional & Scroll</span>
        <div className="grid grid-cols-3 gap-1.5 max-w-[200px] mx-auto">
          <div />
          <button
            onClick={() => sendAction({ action: 'swipe', x1: midX, y1: midY + swipeDeltaY, x2: midX, y2: midY - swipeDeltaY }, 'Swipe Up')}
            className="flex items-center justify-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            title="Swipe Up"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <div />

          <button
            onClick={() => sendAction({ action: 'swipe', x1: midX + swipeDeltaX, y1: midY, x2: midX - swipeDeltaX, y2: midY }, 'Swipe Left')}
            className="flex items-center justify-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            title="Swipe Left"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => sendAction({ action: 'tap', x: midX, y: midY }, 'Center Tap')}
            className="flex items-center justify-center p-2 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition"
            title="Center Tap"
          >
            <Circle className="w-3 h-3 fill-current" />
          </button>
          <button
            onClick={() => sendAction({ action: 'swipe', x1: midX - swipeDeltaX, y1: midY, x2: midX + swipeDeltaX, y2: midY }, 'Swipe Right')}
            className="flex items-center justify-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            title="Swipe Right"
          >
            <ArrowRight className="w-4 h-4" />
          </button>

          <div />
          <button
            onClick={() => sendAction({ action: 'swipe', x1: midX, y1: midY - swipeDeltaY, x2: midX, y2: midY + swipeDeltaY }, 'Swipe Down')}
            className="flex items-center justify-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
            title="Swipe Down"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <div />
        </div>

        {/* Quick Scroll Step */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={() => sendAction({ action: 'scroll', direction: 'down' }, 'Scroll Down')}
            className="flex items-center justify-center space-x-1.5 p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs transition"
          >
            <ChevronsDown className="w-3.5 h-3.5" />
            <span>Scroll Down</span>
          </button>
          <button
            onClick={() => sendAction({ action: 'scroll', direction: 'up' }, 'Scroll Up')}
            className="flex items-center justify-center space-x-1.5 p-1.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs transition"
          >
            <ChevronsUp className="w-3.5 h-3.5" />
            <span>Scroll Up</span>
          </button>
        </div>
      </div>

      {/* Navigation & Notifications */}
      <div className="space-y-2">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">System Navigation</span>
        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={() => sendAction({ action: 'back' }, 'Back')}
            className="flex flex-col items-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5 mb-0.5" />
            <span>Back</span>
          </button>
          <button
            onClick={() => sendAction({ action: 'home' }, 'Home')}
            className="flex flex-col items-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] transition"
          >
            <Circle className="w-3.5 h-3.5 mb-0.5" />
            <span>Home</span>
          </button>
          <button
            onClick={() => sendAction({ action: 'menu' }, 'Recents')}
            className="flex flex-col items-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] transition"
          >
            <Square className="w-3.5 h-3.5 mb-0.5" />
            <span>Recents</span>
          </button>
          <button
            onClick={() => sendAction({ action: 'notifications' }, 'Notification Shade')}
            className="flex flex-col items-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] transition"
          >
            <Bell className="w-3.5 h-3.5 mb-0.5" />
            <span>Shade</span>
          </button>
        </div>
      </div>

      {/* Device Hardware Keys */}
      <div className="space-y-2">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Hardware Controls</span>
        <div className="grid grid-cols-4 gap-1.5">
          <button
            onClick={() => sendAction({ action: 'wake' }, 'Screen Wake')}
            className="flex flex-col items-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] transition"
          >
            <Sun className="w-3.5 h-3.5 mb-0.5" />
            <span>Wake</span>
          </button>
          <button
            onClick={() => setShowPowerConfirm(true)}
            className="flex flex-col items-center p-2 rounded bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-100 text-[11px] transition"
          >
            <Power className="w-3.5 h-3.5 mb-0.5" />
            <span>Power</span>
          </button>
          <button
            onClick={() => sendAction({ action: 'volume_up' }, 'Volume Up')}
            className="flex flex-col items-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] transition"
          >
            <Volume2 className="w-3.5 h-3.5 mb-0.5" />
            <span>Vol +</span>
          </button>
          <button
            onClick={() => sendAction({ action: 'volume_down' }, 'Volume Down')}
            className="flex flex-col items-center p-2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-[11px] transition"
          >
            <Volume1 className="w-3.5 h-3.5 mb-0.5" />
            <span>Vol -</span>
          </button>
        </div>
      </div>

      {/* Remote Text Entry */}
      <div className="space-y-2">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Remote Text Input</span>
        <form onSubmit={handleSendText} className="flex space-x-1.5">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type text or URL..."
            className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 px-2.5 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 outline-none focus:border-zinc-400"
          />
          <button
            type="submit"
            className="px-2.5 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 text-xs rounded hover:opacity-90 transition"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
        <div className="flex space-x-1.5">
          <button
            type="button"
            onClick={() => sendAction({ action: 'backspace' }, 'Backspace')}
            className="flex-1 flex items-center justify-center space-x-1 p-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 transition"
          >
            <Delete className="w-3 h-3" />
            <span>Backspace</span>
          </button>
          <button
            type="button"
            onClick={() => sendAction({ action: 'enter' }, 'Enter')}
            className="flex-1 flex items-center justify-center space-x-1 p-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[11px] rounded border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 transition"
          >
            <CornerDownLeft className="w-3 h-3" />
            <span>Enter</span>
          </button>
        </div>
      </div>

      {/* Activity Log Mini Stream */}
      <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Activity</span>
          <Activity className="w-3 h-3 text-zinc-400" />
        </div>
        <div className="h-32 overflow-y-auto space-y-1 text-[11px] font-mono bg-zinc-50 dark:bg-zinc-950 p-2 rounded border border-zinc-200 dark:border-zinc-800">
          {logs.length === 0 ? (
            <div className="text-zinc-400">Ready for commands.</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="text-zinc-600 dark:text-zinc-400 leading-tight">
                <span className="text-zinc-400 select-none">[{log.timeFormatted}] </span>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Power Confirm Modal */}
      {showPowerConfirm && (
        <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 rounded text-xs space-y-2">
          <div className="font-medium text-red-800 dark:text-red-300">Toggle Power (Keyevent 26)?</div>
          <p className="text-red-700 dark:text-red-400 text-[11px]">
            May turn off display backlight and cause screen mirror to go black.
          </p>
          <div className="flex justify-end space-x-2 pt-1">
            <button
              onClick={() => setShowPowerConfirm(false)}
              className="px-2 py-0.5 text-xs rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowPowerConfirm(false);
                sendAction({ action: 'power' }, 'Power toggle');
              }}
              className="px-2 py-0.5 text-xs rounded bg-red-600 text-white font-medium hover:bg-red-700 transition"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
