import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { api } from '../../services/api';
import KillProcessModal from './KillProcessModal';
import { 
  Search, 
  RefreshCw, 
  Skull, 
  Terminal, 
  ShieldAlert, 
  Pause, 
  Play, 
  AlertCircle,
  Cpu,
  Layers,
  ChevronDown
} from 'lucide-react';

const CATEGORIES = [
  { id: 'all', label: 'All Processes' },
  { id: 'user-app', label: 'User Apps' },
  { id: 'system-app', label: 'System Apps' },
  { id: 'daemon', label: 'Daemons / Native' },
  { id: 'kernel', label: 'Kernel' }
];

export default function ProcessManager({ serial, initialQuery = '' }) {
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Streaming & Live Refresh state
  const [isLive, setIsLive] = useState(true);
  const [intervalMs, setIntervalMs] = useState(2000);
  const [lastStreamTime, setLastStreamTime] = useState(null);

  // Kill Modal State
  const [processToKill, setProcessToKill] = useState(null);
  const [isKilling, setIsKilling] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  // Update query if initialQuery changes
  useEffect(() => {
    if (initialQuery) {
      setSearchQuery(initialQuery);
    }
  }, [initialQuery]);

  // Fallback direct fetcher
  const fetchProcesses = useCallback(async () => {
    if (!serial) return;
    try {
      setLoading(true);
      const res = await api.getProcesses(serial);
      if (res.processes) {
        setProcesses(res.processes);
        setError(null);
        setLastStreamTime(Date.now());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serial]);

  // Initial load
  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  // SSE Live Stream Connection
  useEffect(() => {
    if (!isLive || !serial) return;

    let es = null;
    try {
      const streamUrl = api.getProcessStreamUrl(serial, intervalMs);
      es = new EventSource(streamUrl);

      es.addEventListener('processes', (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.processes) {
            setProcesses(data.processes);
            setError(null);
            setLoading(false);
            setLastStreamTime(data.timestamp || Date.now());
          }
        } catch (_) {}
      });

      es.addEventListener('error', (e) => {
        // SSE error or reconnection
        if (es.readyState === EventSource.CLOSED) {
          // Closed by server or route error
        }
      });
    } catch (err) {
      console.warn('Failed to connect SSE stream:', err);
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [isLive, serial, intervalMs]);

  // Filtered & Searched processes
  const filteredProcesses = useMemo(() => {
    return processes.filter(p => {
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'daemon') {
          if (p.category !== 'daemon' && p.category !== 'system') return false;
        } else if (p.category !== selectedCategory) {
          return false;
        }
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        String(p.pid).includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.user.toLowerCase().includes(q)
      );
    });
  }, [processes, selectedCategory, searchQuery]);

  // Execute Kill
  const handleConfirmKill = async (options) => {
    if (!serial || !processToKill) return;
    setIsKilling(true);
    setFeedbackMessage(null);
    try {
      const res = await api.killProcess(serial, processToKill.pid, options);
      setFeedbackMessage({
        type: 'success',
        text: `Killed process ${processToKill.name} (PID ${processToKill.pid}) via ${res.result?.method || 'SIGKILL'}.`
      });
      setProcessToKill(null);
      // Immediate refresh
      fetchProcesses();
    } catch (err) {
      setFeedbackMessage({
        type: 'error',
        text: `Failed to terminate process: ${err.message}`
      });
    } finally {
      setIsKilling(false);
    }
  };

  const getCategoryBadge = (cat, isCritical) => {
    if (isCritical) {
      return (
        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <ShieldAlert className="w-2.5 h-2.5" />
          <span>critical</span>
        </span>
      );
    }
    switch (cat) {
      case 'user-app':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">app</span>;
      case 'system-app':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400">sys-app</span>;
      case 'kernel':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-500/10 text-zinc-600 dark:text-zinc-400">kernel</span>;
      default:
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-600 dark:text-slate-400">daemon</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Filter and Controls Bar */}
      <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by name, PID, or user (e.g. system, 1205, camera)..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-zinc-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                Clear
              </button>
            )}
          </div>

          {/* Live Stream Controls */}
          <div className="flex items-center space-x-2 self-end sm:self-center">
            {/* Live Indicator Button */}
            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs rounded-lg border transition ${
                isLive
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {isLive ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Live</span>
                </>
              ) : (
                <>
                  <Pause className="w-3 h-3" />
                  <span>Paused</span>
                </>
              )}
            </button>

            {/* Interval Selector */}
            {isLive && (
              <select
                value={intervalMs}
                onChange={(e) => setIntervalMs(Number(e.target.value))}
                className="text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-zinc-700 dark:text-zinc-300 outline-none"
              >
                <option value={1000}>1s</option>
                <option value={2000}>2s</option>
                <option value={5000}>5s</option>
              </select>
            )}

            {/* Refresh Manual Button */}
            <button
              onClick={fetchProcesses}
              title="Manual refresh"
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pt-1 pb-0.5 text-xs">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md transition font-medium whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
          <span className="text-[11px] text-zinc-400 ml-auto whitespace-nowrap pl-2">
            Showing {filteredProcesses.length} of {processes.length}
          </span>
        </div>
      </div>

      {/* Feedback Toast */}
      {feedbackMessage && (
        <div className={`p-3 rounded-lg text-xs flex items-center justify-between ${
          feedbackMessage.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
        }`}>
          <span>{feedbackMessage.text}</span>
          <button onClick={() => setFeedbackMessage(null)} className="text-[10px] underline ml-2">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Process Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 text-[11px] sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="py-2.5 px-4 font-medium">PID</th>
                <th className="py-2.5 px-3 font-medium">USER</th>
                <th className="py-2.5 px-3 font-medium">TYPE</th>
                <th className="py-2.5 px-4 font-medium">NAME / COMMAND</th>
                <th className="py-2.5 px-3 font-medium text-right">RSS (RAM)</th>
                <th className="py-2.5 px-3 font-medium text-right">VSZ</th>
                <th className="py-2.5 px-4 font-medium text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filteredProcesses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-400 text-xs">
                    {loading ? 'Scanning processes...' : 'No matching processes found.'}
                  </td>
                </tr>
              ) : (
                filteredProcesses.map((p) => {
                  const canKill = p.pid > 2;
                  return (
                    <tr 
                      key={p.pid} 
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition ${
                        p.isCritical ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      <td className="py-2 px-4 font-bold text-zinc-900 dark:text-zinc-100">{p.pid}</td>
                      <td className="py-2 px-3 text-zinc-500 truncate max-w-[80px]">{p.user}</td>
                      <td className="py-2 px-3">{getCategoryBadge(p.category, p.isCritical)}</td>
                      <td className="py-2 px-4 font-medium text-zinc-800 dark:text-zinc-200 break-all max-w-sm">
                        {p.name}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                        {p.rssFormatted}
                      </td>
                      <td className="py-2 px-3 text-right text-zinc-400">
                        {p.vszKb > 0 ? `${Math.round(p.vszKb / 1024)} MB` : '-'}
                      </td>
                      <td className="py-2 px-4 text-right">
                        {canKill ? (
                          <button
                            onClick={() => setProcessToKill(p)}
                            title={`Terminate process ${p.name} (${p.pid})`}
                            className="inline-flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-sans text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-300 dark:hover:border-rose-900/50 transition"
                          >
                            <Skull className="w-3 h-3" />
                            <span className="hidden sm:inline">Kill</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-zinc-400 italic">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kill Process Modal */}
      {processToKill && (
        <KillProcessModal
          process={processToKill}
          onClose={() => setProcessToKill(null)}
          onConfirm={handleConfirmKill}
          isKilling={isKilling}
        />
      )}
    </div>
  );
}

