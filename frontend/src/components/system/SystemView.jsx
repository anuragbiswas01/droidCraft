import React, { useState } from 'react';
import { 
  Cpu, 
  Terminal, 
  ShieldCheck, 
  ShieldAlert, 
  Smartphone,
  HardDrive
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import MemoryMonitor from './MemoryMonitor';
import ProcessManager from './ProcessManager';

export default function SystemView() {
  const { selectedSerial, capabilities } = useDevice();
  const [subTab, setSubTab] = useState('memory'); // 'memory' | 'processes'
  const [targetProcessFilter, setTargetProcessFilter] = useState('');

  const handleSelectProcessFromMemory = (procName) => {
    setTargetProcessFilter(procName);
    setSubTab('processes');
  };

  if (!selectedSerial) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-zinc-400">
        <Smartphone className="w-12 h-12 stroke-[1.5] mb-3 opacity-30" />
        <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No Device Selected</h3>
        <p className="text-xs text-zinc-500 mt-1">Connect or choose an authorized Android device from the header</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Top Bar: Device Info Banner & Subtabs */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          {/* Device Model & Root status */}
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-sm text-[var(--text-primary)]">
              {capabilities?.model || 'Android Device'}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)]">
              Android {capabilities?.release || '?'} (API {capabilities?.sdk || '?'})
            </span>
            {capabilities?.rootAvailable ? (
              <span className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                <span>Rooted</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-[11px] px-2 py-0.5 rounded-full font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                <ShieldAlert className="w-3 h-3" />
                <span>Unrooted</span>
              </span>
            )}
          </div>
        </div>

        {/* Subtabs Switcher */}
        <div className="flex items-center space-x-1 bg-[var(--bg-surface-subtle)] p-1 rounded-2xl border border-[var(--border-subtle)] text-xs font-medium">
          <button
            onClick={() => setSubTab('memory')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition ${
              subTab === 'memory'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-[var(--accent-color)]" />
            <span>Memory & RAM</span>
          </button>

          <button
            onClick={() => setSubTab('processes')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl transition ${
              subTab === 'processes'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-semibold'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-500" />
            <span>Processes</span>
          </button>
        </div>
      </div>

      {/* Main Subview Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-7xl w-full mx-auto">
        {subTab === 'memory' ? (
          <MemoryMonitor
            serial={selectedSerial}
            onSelectProcess={handleSelectProcessFromMemory}
          />
        ) : (
          <ProcessManager
            serial={selectedSerial}
            initialQuery={targetProcessFilter}
          />
        )}
      </div>
    </div>
  );
}

