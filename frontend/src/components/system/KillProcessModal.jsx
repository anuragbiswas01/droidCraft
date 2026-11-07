import React, { useState } from 'react';
import { AlertTriangle, Skull, X, ShieldAlert } from 'lucide-react';

export default function KillProcessModal({ process, onClose, onConfirm, isKilling }) {
  const [signal, setSignal] = useState('9'); // '9' (SIGKILL) or '15' (SIGTERM)
  const [forceStopApp, setForceStopApp] = useState(true);

  if (!process) return null;

  const isApp = process.category === 'user-app' || process.category === 'system-app';
  const isCritical = process.isCritical || process.pid <= 2;

  const handleKill = () => {
    onConfirm({
      pid: process.pid,
      signal,
      packageName: isApp && forceStopApp ? process.name.split(':')[0] : undefined,
      name: process.name
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400">
            <Skull className="w-5 h-5" />
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Terminate Process</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isKilling}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Target Process Card */}
          <div className="bg-zinc-50 dark:bg-zinc-950 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5 font-mono">
            <div className="flex justify-between items-center text-zinc-500">
              <span>PID: <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{process.pid}</strong></span>
              <span>USER: <strong className="text-zinc-800 dark:text-zinc-200">{process.user}</strong></span>
              <span>RSS: <strong className="text-zinc-800 dark:text-zinc-200">{process.rssFormatted}</strong></span>
            </div>
            <div className="text-zinc-900 dark:text-zinc-100 font-medium break-all text-xs pt-1 border-t border-zinc-200 dark:border-zinc-800">
              {process.name}
            </div>
          </div>

          {/* Critical Warning */}
          {isCritical && (
            <div className="flex items-start space-x-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block mb-0.5">Critical System Process</span>
                Terminating this core Android process ({process.name}) may cause the OS, user interface, or phone to crash and reboot immediately.
              </div>
            </div>
          )}

          {/* Signal Options */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block">
              Termination Signal
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setSignal('9')}
                className={`px-3 py-2 rounded-lg border text-left transition ${
                  signal === '9'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-medium'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <div className="font-semibold">SIGKILL (-9)</div>
                <div className="text-[11px] opacity-80">Immediate termination</div>
              </button>

              <button
                type="button"
                onClick={() => setSignal('15')}
                className={`px-3 py-2 rounded-lg border text-left transition ${
                  signal === '15'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium'
                    : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <div className="font-semibold">SIGTERM (-15)</div>
                <div className="text-[11px] opacity-80">Graceful shutdown request</div>
              </button>
            </div>
          </div>

          {/* App Force-Stop Option */}
          {isApp && (
            <label className="flex items-center space-x-2.5 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={forceStopApp}
                onChange={(e) => setForceStopApp(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0"
              />
              <span>Also invoke <code className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">am force-stop</code> to prevent Android from restarting it</span>
            </label>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isKilling}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleKill}
            disabled={isKilling}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Skull className="w-3.5 h-3.5" />
            <span>{isKilling ? 'Killing...' : 'Kill Process'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

