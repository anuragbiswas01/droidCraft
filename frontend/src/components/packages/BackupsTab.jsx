import React, { useState, useEffect } from 'react';
import { 
  Archive, 
  Download, 
  Trash2, 
  RotateCcw, 
  Calendar, 
  ChevronDown, 
  ChevronRight, 
  RefreshCw,
  FolderArchive
} from 'lucide-react';
import { api } from '../../services/api';

export default function BackupsTab({
  serial,
  capabilities,
  onRestoreBackup,
  onBackupCategory
}) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [selectedPackages, setSelectedPackages] = useState({}); // backupId -> Set of pkgNames
  const [deletingId, setDeletingId] = useState(null);

  const loadBackups = async () => {
    if (!serial) return;
    setLoading(true);
    try {
      const res = await api.getBackups(serial);
      setBackups(res.backups || []);
    } catch (err) {
      console.error('Failed to load backups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, [serial]);

  const toggleExpand = (backupId) => {
    setExpandedId(prev => prev === backupId ? null : backupId);
  };

  const togglePackageSelection = (backupId, pkgName) => {
    setSelectedPackages(prev => {
      const currentSet = new Set(prev[backupId] || []);
      if (currentSet.has(pkgName)) {
        currentSet.delete(pkgName);
      } else {
        currentSet.add(pkgName);
      }
      return { ...prev, [backupId]: currentSet };
    });
  };

  const toggleSelectAllInBackup = (backup) => {
    setSelectedPackages(prev => {
      const currentSet = new Set(prev[backup.backupId] || []);
      const allPkgs = (backup.packages || []).map(p => p.name);
      if (currentSet.size === allPkgs.length) {
        return { ...prev, [backup.backupId]: new Set() };
      } else {
        return { ...prev, [backup.backupId]: new Set(allPkgs) };
      }
    });
  };

  const handleDelete = async (backupId) => {
    if (!window.confirm(`Are you sure you want to permanently delete backup session "${backupId}" from host PC?`)) {
      return;
    }
    setDeletingId(backupId);
    try {
      await api.deleteBackup(serial, backupId);
      setBackups(prev => prev.filter(b => b.backupId !== backupId));
    } catch (err) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadZip = (backupId) => {
    const url = api.getBackupDownloadUrl(serial, backupId);
    window.open(url, '_blank');
  };

  const handleRestore = (backup) => {
    const selected = Array.from(selectedPackages[backup.backupId] || []);
    const pkgsToRestore = selected.length > 0 
      ? selected 
      : (backup.packages || []).map(p => p.name);

    if (pkgsToRestore.length === 0) {
      alert('Please select at least one package to restore.');
      return;
    }

    onRestoreBackup(backup.backupId, pkgsToRestore);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 space-y-4 text-xs">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Archive className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
              Host Backup Archives
            </h3>
          </div>
          <p className="text-zinc-500 text-[11px]">
            Backups are pulled directly to host PC storage with SHA-256 integrity verification.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Quick Category Backup Presets */}
          <button
            onClick={() => onBackupCategory('system')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition font-medium text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Back Up All System Apps</span>
          </button>

          <button
            onClick={() => onBackupCategory('user')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition font-medium text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Back Up User Apps</span>
          </button>

          <button
            onClick={loadBackups}
            title="Refresh backups list"
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Backups List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {loading && backups.length === 0 ? (
          <div className="py-16 text-center text-zinc-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-zinc-400" />
            <p>Scanning host backup repository...</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="py-16 text-center rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 p-8 space-y-2 bg-zinc-50/50 dark:bg-zinc-950/30">
            <FolderArchive className="w-8 h-8 mx-auto text-zinc-400 stroke-1" />
            <h4 className="font-medium text-sm text-zinc-800 dark:text-zinc-200">No backups found for this device</h4>
            <p className="text-zinc-500 text-xs max-w-sm mx-auto">
              Select packages in the Packages tab and click "Backup" or use the quick buttons above to create your first safe restore copy.
            </p>
          </div>
        ) : (
          backups.map(backup => {
            const isExpanded = expandedId === backup.backupId;
            const currentSelected = selectedPackages[backup.backupId] || new Set();
            const allCount = backup.packages ? backup.packages.length : 0;
            const sizeMB = (backup.totalBytes / (1024 * 1024)).toFixed(2);

            return (
              <div 
                key={backup.backupId}
                className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs overflow-hidden transition"
              >
                {/* Session Card Header */}
                <div 
                  onClick={() => toggleExpand(backup.backupId)}
                  className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <div className="flex items-center space-x-3">
                    <button className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 font-mono">
                          {backup.backupId}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          {backup.packageCount} package{backup.packageCount !== 1 ? 's' : ''}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
                          {sizeMB} MB
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[11px] text-zinc-500 mt-0.5">
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(backup.createdAt).toLocaleString()}</span>
                        </span>
                        <span>•</span>
                        <span>OS: Android {backup.device?.android || capabilities?.androidVersion}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this session */}
                  <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleDownloadZip(backup.backupId)}
                      title="Export backup as ZIP file"
                      className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>ZIP</span>
                    </button>

                    <button
                      onClick={() => handleRestore(backup)}
                      className="flex items-center space-x-1 px-2.5 py-1 text-xs rounded bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 font-medium hover:opacity-90 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>
                        Restore {currentSelected.size > 0 ? `(${currentSelected.size})` : 'All'}
                      </span>
                    </button>

                    <button
                      onClick={() => handleDelete(backup.backupId)}
                      disabled={deletingId === backup.backupId}
                      title="Delete backup from host"
                      className="p-1.5 text-zinc-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Packages Table */}
                {isExpanded && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={currentSelected.size === allCount && allCount > 0}
                          onChange={() => toggleSelectAllInBackup(backup)}
                          className="rounded border-zinc-300 text-zinc-900 focus:ring-0 dark:bg-zinc-800"
                        />
                        <span>Select All Packages ({allCount})</span>
                      </div>
                      <span>Click checkboxes to selectively restore individual apps</span>
                    </div>

                    <div className="max-h-60 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800">
                      {(backup.packages || []).map(pkg => (
                        <div 
                          key={pkg.name}
                          className="p-2 flex items-center justify-between text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                        >
                          <label className="flex items-center space-x-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={currentSelected.has(pkg.name)}
                              onChange={() => togglePackageSelection(backup.backupId, pkg.name)}
                              className="rounded border-zinc-300 text-zinc-900 focus:ring-0 dark:bg-zinc-800"
                            />
                            <div className="space-y-0.5">
                              <span className="font-mono text-zinc-800 dark:text-zinc-200 block truncate max-w-sm">
                                {pkg.name}
                              </span>
                              <span className="text-[10px] text-zinc-400">
                                {pkg.versionName || 'v?'} • {pkg.fileCount || 1} file(s)
                              </span>
                            </div>
                          </label>

                          <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                            pkg.category === 'user' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                            pkg.category === 'system-updated' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                            'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                          }`}>
                            {pkg.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
