import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  RefreshCw, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Terminal,
  Clock
} from 'lucide-react';
import { api } from '../../services/api';

export default function AuditLogTab({ serial }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = async () => {
    if (!serial) return;
    setLoading(true);
    try {
      const res = await api.getAuditLogs(serial, 150);
      setLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [serial]);

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (log.package && log.package.toLowerCase().includes(term)) ||
      (log.action && log.action.toLowerCase().includes(term)) ||
      (log.command && log.command.toLowerCase().includes(term)) ||
      (log.result && log.result.toLowerCase().includes(term))
    );
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4 text-xs">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              Mutating Operations Audit Trail
            </h3>
          </div>
          <p className="text-zinc-500 text-[11px]">
            Immutable record of all modifying commands (disable, uninstall, delete, restore, install) executed on this phone.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search audit trail..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-zinc-100 dark:bg-zinc-800 text-xs pl-8 pr-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 outline-none w-48 focus:border-zinc-400"
            />
          </div>

          <button
            onClick={loadLogs}
            title="Refresh audit log"
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
        {loading && logs.length === 0 ? (
          <div className="py-16 text-center text-zinc-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-zinc-400 mb-2" />
            <p>Loading audit logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-zinc-400">
            <p>No audit log entries recorded yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 font-mono text-[11px]">
            {filteredLogs.map((entry, idx) => {
              const isSuccess = entry.status === 'success';
              const isFailed = entry.status === 'failed';
              const isWarn = entry.status === 'warn';

              return (
                <div key={idx} className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {isSuccess ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : isFailed ? (
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}

                      <span className={`px-1.5 py-0.2 rounded font-semibold text-[10px] uppercase tracking-wider ${
                        entry.action.includes('delete') ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                        entry.action.includes('disable') ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                        entry.action.includes('uninstall') ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                        'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}>
                        {entry.action}
                      </span>

                      {entry.package && (
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-sans text-xs">
                          {entry.package}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] text-zinc-400">
                      {entry.timestamp ? new Date(entry.timestamp).toLocaleString() : ''}
                    </span>
                  </div>

                  {entry.command && (
                    <div className="text-zinc-500 dark:text-zinc-400 pl-5 text-[10px] truncate">
                      Command: <span className="text-zinc-700 dark:text-zinc-300">{entry.command}</span>
                    </div>
                  )}

                  {entry.result && (
                    <div className="text-zinc-500 dark:text-zinc-400 pl-5 text-[10px]">
                      Result: <span className="text-emerald-600 dark:text-emerald-400">{entry.result}</span>
                    </div>
                  )}

                  {entry.error && (
                    <div className="text-red-600 dark:text-red-400 pl-5 text-[10px]">
                      Error: {entry.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

