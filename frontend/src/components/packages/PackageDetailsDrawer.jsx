import React, { useState, useEffect } from 'react';
import { 
  X, 
  Package, 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  HardDrive, 
  Clock, 
  Key, 
  Layers, 
  Download, 
  Trash2, 
  PowerOff, 
  CheckCircle,
  Copy,
  Check,
  ExternalLink
} from 'lucide-react';
import { api } from '../../services/api';

export default function PackageDetailsDrawer({ 
  serial, 
  pkg, 
  isOpen, 
  onClose, 
  onActionClick,
  capabilities
}) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [permSearch, setPermSearch] = useState('');

  useEffect(() => {
    if (!isOpen || !pkg || !serial) {
      setDetails(null);
      return;
    }

    setLoading(true);
    api.getPackageDetails(serial, pkg.name)
      .then(res => {
        setDetails(res.details || null);
      })
      .catch(err => {
        console.error('Failed to load package details:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, pkg, serial]);

  if (!isOpen || !pkg) return null;

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (_) {}
  };

  const safety = pkg.knowledge?.safety || 'unknown';
  const filteredPerms = (details?.permissions || []).filter(p => 
    p.toLowerCase().includes(permSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs select-none">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col text-zinc-800 dark:text-zinc-200 overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between bg-zinc-50 dark:bg-zinc-950/60">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 mt-0.5">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  {pkg.knowledge?.label || pkg.name}
                </h3>
                {pkg.protected && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800">
                    Protected
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="font-mono text-xs text-zinc-500 break-all">{pkg.name}</span>
                <button 
                  onClick={() => handleCopy(pkg.name)}
                  title="Copy package name"
                  className="p-0.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* Safety & Knowledge Base Banner */}
          <div className={`p-3 rounded-lg border text-xs space-y-1.5 ${
            safety === 'essential'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200'
              : safety === 'caution'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
              : safety === 'safe'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
              : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
          }`}>
            <div className="flex items-center space-x-1.5 font-medium">
              {safety === 'essential' ? <ShieldAlert className="w-4 h-4 text-red-500" /> :
               safety === 'caution' ? <ShieldAlert className="w-4 h-4 text-amber-500" /> :
               safety === 'safe' ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> :
               <Shield className="w-4 h-4 text-zinc-400" />}
              <span className="capitalize">{safety} Removal Classification</span>
            </div>
            <p className="text-[11px] leading-relaxed opacity-90">
              {pkg.knowledge?.description || 'Not in knowledge base. Take caution and back up before disabling or removing.'}
            </p>
            {pkg.protected && pkg.protectedReason && (
              <div className="text-[11px] font-medium text-red-700 dark:text-red-400 pt-1 border-t border-red-200 dark:border-red-900/40">
                Guard: {pkg.protectedReason}
              </div>
            )}
          </div>

          {/* Quick Properties Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 space-y-1">
              <span className="text-[10px] uppercase font-medium text-zinc-400 block">Category</span>
              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                pkg.category === 'user' ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300' :
                pkg.category === 'system-updated' ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300' :
                'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'
              }`}>
                {pkg.category === 'user' ? 'User / 3rd Party' :
                 pkg.category === 'system-updated' ? 'System (Updated)' : 'System'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 space-y-1">
              <span className="text-[10px] uppercase font-medium text-zinc-400 block">State</span>
              <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${
                pkg.enabled 
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}>
                {pkg.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 space-y-1">
              <span className="text-[10px] uppercase font-medium text-zinc-400 block">Version</span>
              <span className="text-[11px] font-mono font-medium truncate block">
                {details?.versionName || pkg.versionName || 'Loading...'}
                {details?.versionCode ? ` (${details.versionCode})` : ''}
              </span>
            </div>

            <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 space-y-1">
              <span className="text-[10px] uppercase font-medium text-zinc-400 block">Total APK Size</span>
              <span className="text-[11px] font-mono font-medium block">
                {details?.sizeBytes ? `${(details.sizeBytes / (1024 * 1024)).toFixed(2)} MB` : (loading ? 'Measuring...' : 'N/A')}
              </span>
            </div>
          </div>

          {/* Dependency Group Info */}
          {details?.dependencyGroup && (
            <div className="p-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 space-y-1.5 text-indigo-950 dark:text-indigo-200">
              <div className="flex items-center space-x-1.5 font-medium text-xs">
                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Dependency Group: {details.dependencyGroup.name}</span>
              </div>
              <p className="text-[11px] opacity-90">{details.dependencyGroup.description}</p>
              <div className="pt-1">
                <span className="text-[10px] font-medium uppercase tracking-wider text-indigo-400 block mb-1">Group Members</span>
                <div className="flex flex-wrap gap-1">
                  {details.dependencyGroup.packages.map(p => (
                    <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      p === pkg.name 
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200'
                    }`}>
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* APK Paths on Device */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">APK File Paths</span>
              <span className="text-[10px] text-zinc-500 font-mono">
                {details?.paths?.length || pkg.paths?.length || 1} file(s)
              </span>
            </div>
            <div className="space-y-1 font-mono text-[11px]">
              {(details?.paths || pkg.paths || []).map((pathStr, i) => (
                <div key={i} className="p-2 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 break-all">
                  {pathStr}
                </div>
              ))}
            </div>
          </div>

          {/* Installation Dates */}
          {(details?.firstInstall || details?.lastUpdate) && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Timestamps</span>
              <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 text-[11px] space-y-1">
                {details.firstInstall && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">First Install:</span>
                    <span className="font-mono">{details.firstInstall}</span>
                  </div>
                )}
                {details.lastUpdate && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Last Update:</span>
                    <span className="font-mono">{details.lastUpdate}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Permissions */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">
                Permissions ({details?.permissions?.length || 0})
              </span>
            </div>

            {details?.permissions && details.permissions.length > 5 && (
              <input
                type="text"
                placeholder="Filter permissions..."
                value={permSearch}
                onChange={e => setPermSearch(e.target.value)}
                className="w-full bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-xs border border-zinc-200 dark:border-zinc-700 outline-none"
              />
            )}

            <div className="max-h-36 overflow-y-auto space-y-1 p-1 bg-zinc-50 dark:bg-zinc-950/40 rounded border border-zinc-200 dark:border-zinc-800">
              {loading ? (
                <div className="text-zinc-400 text-center py-2">Loading permissions...</div>
              ) : filteredPerms.length === 0 ? (
                <div className="text-zinc-400 text-center py-2">No permissions listed.</div>
              ) : (
                filteredPerms.map((perm, i) => (
                  <div key={i} className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 px-1 py-0.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 truncate">
                    {perm}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions Footer */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-between space-x-2">
          {/* Backup Button */}
          <button
            onClick={() => onActionClick('backup', [pkg.name])}
            className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs rounded transition font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Backup</span>
          </button>

          {/* Disable / Enable Button */}
          {pkg.enabled ? (
            <button
              disabled={pkg.protected}
              onClick={() => onActionClick('disable', [pkg.name])}
              className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-amber-100 dark:bg-amber-950/60 hover:bg-amber-200 text-amber-800 dark:text-amber-200 text-xs rounded transition font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Disable</span>
            </button>
          ) : (
            <button
              onClick={() => onActionClick('enable', [pkg.name])}
              className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-emerald-100 dark:bg-emerald-950/60 hover:bg-emerald-200 text-emerald-800 dark:text-emerald-200 text-xs rounded transition font-medium"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Enable</span>
            </button>
          )}

          {/* Uninstall or Delete Button */}
          {pkg.category === 'user' || pkg.category === 'system-updated' ? (
            <button
              disabled={pkg.protected}
              onClick={() => onActionClick('uninstall', [pkg.name])}
              className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-red-100 dark:bg-red-950/60 hover:bg-red-200 text-red-700 dark:text-red-300 text-xs rounded transition font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Uninstall</span>
            </button>
          ) : (
            <button
              disabled={pkg.protected || !capabilities?.rootAvailable}
              onClick={() => onActionClick('delete', [pkg.name])}
              title={!capabilities?.rootAvailable ? 'Permanent deletion requires root access' : ''}
              className="flex-1 flex items-center justify-center space-x-1.5 py-1.5 px-2 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete (Root)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

