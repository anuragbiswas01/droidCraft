import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../services/api';
import { 
  Cpu, 
  RefreshCw, 
  Database, 
  Layers, 
  HardDrive, 
  Activity, 
  AlertCircle,
  Clock,
  ArrowUpRight
} from 'lucide-react';

export default function MemoryMonitor({ serial, onSelectProcess }) {
  const [stats, setStats] = useState(null);
  const [topProcesses, setTopProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(3000);
  const timerRef = useRef(null);

  const fetchStats = useCallback(async () => {
    if (!serial) return;
    try {
      const [memRes, topRes] = await Promise.allSettled([
        api.getMemoryStats(serial),
        api.getTopMemoryProcesses(serial, 10)
      ]);

      if (memRes.status === 'fulfilled' && memRes.value.stats) {
        setStats(memRes.value.stats);
        setError(null);
      } else if (memRes.status === 'rejected') {
        throw new Error(memRes.reason?.message || 'Failed to fetch memory statistics');
      }

      if (topRes.status === 'fulfilled' && topRes.value.top) {
        setTopProcesses(topRes.value.top);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [serial]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(fetchStats, refreshInterval);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, refreshInterval, fetchStats]);

  const getMeterColor = (pct) => {
    if (pct >= 85) return 'bg-rose-500';
    if (pct >= 65) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getMeterTextColor = (pct) => {
    if (pct >= 85) return 'text-rose-600 dark:text-rose-400';
    if (pct >= 65) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-indigo-500" />
            <span>RAM & Memory Monitor</span>
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Real-time memory diagnostics from <code className="font-mono text-[11px]">/proc/meminfo</code> and <code className="font-mono text-[11px]">dumpsys meminfo</code>
          </p>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-center">
          <label className="flex items-center space-x-1.5 text-xs text-zinc-600 dark:text-zinc-300 mr-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-0"
            />
            <span>Live Auto-refresh</span>
          </label>

          {autoRefresh && (
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="text-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-md px-2 py-1 text-zinc-700 dark:text-zinc-300 outline-none"
            >
              <option value={2000}>2s</option>
              <option value={3000}>3s</option>
              <option value={5000}>5s</option>
            </select>
          )}

          <button
            onClick={fetchStats}
            title="Refresh memory metrics"
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {stats ? (
        <>
          {/* Main RAM & Swap Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* RAM Utilization Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center space-x-1.5">
                  <Database className="w-4 h-4 text-indigo-500" />
                  <span>Physical RAM</span>
                </span>
                <span className={`text-xs font-semibold ${getMeterTextColor(stats.ram.usedPercentage)}`}>
                  {stats.ram.usedPercentage}% used
                </span>
              </div>

              <div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono tracking-tight">
                  {stats.ram.usedFormatted}
                  <span className="text-xs font-normal text-zinc-400 ml-1.5">/ {stats.ram.totalFormatted}</span>
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Available: <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{stats.ram.availableFormatted}</strong> ({stats.ram.freePercentage}%)
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getMeterColor(stats.ram.usedPercentage)}`}
                  style={{ width: `${Math.min(100, Math.max(0, stats.ram.usedPercentage))}%` }}
                />
              </div>

              <div className="flex justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                <span>Free: {stats.ram.freeFormatted}</span>
                <span>Buffers: {stats.ram.buffersFormatted}</span>
                <span>Cached: {stats.ram.cachedFormatted}</span>
              </div>
            </div>

            {/* Swap / ZRAM Card */}
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center space-x-1.5">
                  <HardDrive className="w-4 h-4 text-cyan-500" />
                  <span>Swap / ZRAM</span>
                </span>
                <span className={`text-xs font-semibold ${getMeterTextColor(stats.swap.usedPercentage)}`}>
                  {stats.swap.usedPercentage}% used
                </span>
              </div>

              <div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono tracking-tight">
                  {stats.swap.usedFormatted}
                  <span className="text-xs font-normal text-zinc-400 ml-1.5">/ {stats.swap.totalFormatted}</span>
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Free: <strong className="text-zinc-700 dark:text-zinc-300 font-mono">{stats.swap.freeFormatted}</strong>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${getMeterColor(stats.swap.usedPercentage)}`}
                  style={{ width: `${Math.min(100, Math.max(0, stats.swap.usedPercentage))}%` }}
                />
              </div>

              <div className="text-[11px] text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800">
                {stats.swap.totalBytes > 0 
                  ? 'ZRAM compressed swap enabled' 
                  : 'No active swap configured'}
              </div>
            </div>

            {/* Kernel & Page Cache Breakdown */}
            <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center space-x-1.5">
                  <Layers className="w-4 h-4 text-emerald-500" />
                  <span>Memory Breakdown</span>
                </span>
                <span className="text-[11px] font-mono text-zinc-400 flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(stats.timestamp).toLocaleTimeString()}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] text-zinc-400">Active RAM</div>
                  <div className="font-semibold font-mono text-zinc-800 dark:text-zinc-200">{stats.details.active}</div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] text-zinc-400">Inactive RAM</div>
                  <div className="font-semibold font-mono text-zinc-800 dark:text-zinc-200">{stats.details.inactive}</div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] text-zinc-400">Kernel Slab</div>
                  <div className="font-semibold font-mono text-zinc-800 dark:text-zinc-200">{stats.details.slab}</div>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950 p-2 rounded-lg border border-zinc-200 dark:border-zinc-800">
                  <div className="text-[11px] text-zinc-400">Page Tables</div>
                  <div className="font-semibold font-mono text-zinc-800 dark:text-zinc-200">{stats.details.pageTables}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Memory Consuming Processes */}
          {topProcesses.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
              <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">Top Memory Consumers (dumpsys meminfo)</h3>
                </div>
                <span className="text-[11px] text-zinc-400">Sorted by PSS (Proportional Set Size)</span>
              </div>

              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-4 font-medium">#</th>
                      <th className="py-2.5 px-4 font-medium">Process Name / App</th>
                      <th className="py-2.5 px-4 font-medium">PID</th>
                      <th className="py-2.5 px-4 font-medium text-right">RAM Used</th>
                      <th className="py-2.5 px-4 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {topProcesses.map((p, idx) => (
                      <tr key={p.name + idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                        <td className="py-2 px-4 text-zinc-400">{idx + 1}</td>
                        <td className="py-2 px-4 font-medium text-zinc-900 dark:text-zinc-100 break-all">
                          {p.name}
                        </td>
                        <td className="py-2 px-4 text-zinc-500">{p.pid || '-'}</td>
                        <td className="py-2 px-4 text-right font-bold text-zinc-800 dark:text-zinc-200">
                          {p.pssFormatted}
                        </td>
                        <td className="py-2 px-4 text-right">
                          {onSelectProcess && (
                            <button
                              onClick={() => onSelectProcess(p.name)}
                              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-sans text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition"
                            >
                              <span>View</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="p-12 text-center text-zinc-400 text-xs">
          Loading device memory metrics...
        </div>
      )}
    </div>
  );
}

