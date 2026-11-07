import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  ShieldAlert, 
  ShieldCheck, 
  Check, 
  Download, 
  Trash2, 
  Play, 
  HelpCircle,
  Eye,
  Info
} from 'lucide-react';
import { api } from '../../services/api';

export default function PackagePlanModal({
  isOpen,
  onClose,
  serial,
  action,
  packages = [],
  capabilities,
  onExecute
}) {
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);

  // Form options
  const [backupFirst, setBackupFirst] = useState(true);
  const [keepData, setKeepData] = useState(false);
  const [ackConfirmed, setAckConfirmed] = useState(false);
  const [modelInput, setModelInput] = useState('');
  const [isDryRunView, setIsDryRunView] = useState(false);

  useEffect(() => {
    if (!isOpen || !serial || !action || packages.length === 0) {
      setPlan(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setAckConfirmed(false);
    setModelInput('');
    setIsDryRunView(false);
    setBackupFirst(action === 'disable' || action === 'uninstall' || action === 'delete');

    api.createPackagePlan(serial, { action, packages, options: { backupFirst: true } })
      .then(res => {
        setPlan(res.plan || null);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [isOpen, serial, action, packages]);

  if (!isOpen) return null;

  const deviceModel = capabilities?.model || plan?.device?.model || 'Device';
  const isDelete = action === 'delete';
  const requiresModel = plan?.requiresModelConfirmation || isDelete;

  const isModelMatched = !requiresModel || 
    modelInput.trim().toUpperCase() === deviceModel.trim().toUpperCase() ||
    modelInput.trim().toUpperCase() === 'REMOVE';

  const canRun = !plan?.blocked && isModelMatched;

  const handleRun = () => {
    if (!canRun) return;
    onExecute(plan, {
      backupFirst,
      keepData
    });
  };

  const handleDryRun = () => {
    setIsDryRunView(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] text-zinc-800 dark:text-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/60">
          <div className="flex items-center space-x-2">
            <span className={`p-1.5 rounded-md ${
              isDelete ? 'bg-red-100 text-red-600 dark:bg-red-950/80 dark:text-red-300' :
              action === 'disable' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/80 dark:text-amber-300' :
              action === 'uninstall' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/80 dark:text-orange-300' :
              'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
                Review & Confirm: {action} {packages.length} Package{packages.length !== 1 ? 's' : ''}
              </h2>
              <span className="text-[11px] text-zinc-500">
                Target Device: {deviceModel} ({serial})
              </span>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {loading ? (
            <div className="py-12 text-center text-zinc-400 space-y-2">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-zinc-400 border-t-transparent rounded-full" />
              <div>Computing execution plan and safety checks...</div>
            </div>
          ) : error ? (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300">
              <div className="font-semibold text-xs mb-1">Failed to generate plan</div>
              <p className="text-[11px]">{error}</p>
            </div>
          ) : (
            <>
              {/* Blocked Alert */}
              {plan?.blocked && (
                <div className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 space-y-1.5">
                  <div className="flex items-center space-x-1.5 font-semibold text-xs text-red-700 dark:text-red-300">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Action Blocked by Safety Guard</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] pl-1">
                    {plan.blockedReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Dry Run Simulation Banner */}
              {isDryRunView && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 flex items-start space-x-2">
                  <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <span className="font-semibold">Dry Run Active:</span> The simulated steps below demonstrate exactly what commands will run on the phone. Nothing has been modified.
                  </div>
                </div>
              )}

              {/* Grouped Warnings */}
              {plan?.warnings && plan.warnings.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
                  <div className="flex items-center space-x-1.5 font-medium text-xs text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Warnings & System Impacts</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    {plan.warnings.map((w, i) => (
                      <div key={i} className="flex items-start space-x-1.5">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{w.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Planned Steps & Packages List */}
              <div className="space-y-2">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">
                  Target Packages ({plan?.packages?.length || 0})
                </span>
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                  <div className="max-h-48 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800">
                    {plan?.packages?.map(pkg => (
                      <div key={pkg.name} className="p-2.5 flex items-center justify-between text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-zinc-900 dark:text-zinc-100">
                              {pkg.knowledge?.label || pkg.name}
                            </span>
                            {pkg.protected && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-300 font-medium">
                                Protected
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[10px] text-zinc-500 block truncate max-w-sm">
                            {pkg.name}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${
                            pkg.safety === 'essential' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                            pkg.safety === 'caution' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                            pkg.safety === 'safe' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' :
                            'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}>
                            {pkg.safety}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                            {pkg.category}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Options */}
              <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 space-y-2">
                <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">Options</span>

                {/* Back up first (default ON) */}
                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupFirst}
                    onChange={e => setBackupFirst(e.target.checked)}
                    className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-0 dark:bg-zinc-800"
                  />
                  <div>
                    <span className="font-medium text-xs text-zinc-900 dark:text-zinc-100">
                      Back up APKs to host PC before proceeding (Recommended)
                    </span>
                    {!backupFirst && (
                      <p className="text-amber-600 dark:text-amber-400 text-[10px] mt-0.5">
                        Warning: Without a host backup, this package cannot be automatically restored!
                      </p>
                    )}
                  </div>
                </label>

                {/* Keep Data (for uninstall) */}
                {action === 'uninstall' && (
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={keepData}
                      onChange={e => setKeepData(e.target.checked)}
                      className="rounded border-zinc-300 text-zinc-900 focus:ring-0 dark:bg-zinc-800"
                    />
                    <span className="text-xs text-zinc-700 dark:text-zinc-300">
                      Keep application cache and data (-k flag)
                    </span>
                  </label>
                )}
              </div>

              {/* Confirmations Required */}
              <div className="space-y-3 pt-1">
                {requiresModel && (
                  <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 space-y-1.5">
                    <div className="font-medium text-red-900 dark:text-red-200 text-xs">
                      Permanent Deletion Guard: Type device model <span className="font-mono font-bold">{deviceModel}</span> (or <span className="font-mono font-bold">REMOVE</span>) to confirm:
                    </div>
                    <input
                      type="text"
                      placeholder={`Type "${deviceModel}" or "REMOVE"`}
                      value={modelInput}
                      onChange={e => setModelInput(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-800 text-xs px-2.5 py-1.5 rounded border border-red-300 dark:border-red-800 outline-none font-mono"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2">
            {/* Dry Run Button */}
            <button
              onClick={handleDryRun}
              disabled={loading || plan?.blocked}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-medium transition disabled:opacity-40"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Dry Run</span>
            </button>

            {/* Run Action Button */}
            <button
              onClick={handleRun}
              disabled={loading || !canRun}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white transition ${
                isDelete ? 'bg-red-600 hover:bg-red-700' :
                action === 'disable' ? 'bg-amber-600 hover:bg-amber-700' :
                'bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run {action.charAt(0).toUpperCase() + action.slice(1)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

