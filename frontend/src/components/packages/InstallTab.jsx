import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Trash2, 
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../../services/api';

export default function InstallTab({
  serial,
  capabilities,
  onInstallSuccess
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState(null);
  const [showRawDetails, setShowRawDetails] = useState(false);

  // Install flags
  const [replace, setReplace] = useState(true);
  const [downgrade, setDowngrade] = useState(false);
  const [grantPermissions, setGrantPermissions] = useState(false);
  const [allowTest, setAllowTest] = useState(false);
  const [installAsSystem, setInstallAsSystem] = useState(false);

  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.apk'));
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      setInstallResult(null);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter(f => f.name.endsWith('.apk'));
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      setInstallResult(null);
    }
    e.target.value = '';
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const totalBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);
  const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
  const dataFreeBytes = capabilities?.freeSpace?.data?.freeBytes || 0;
  const isStorageTight = dataFreeBytes > 0 && dataFreeBytes < (totalBytes * 2);

  const handleInstall = async () => {
    if (selectedFiles.length === 0 || !serial) return;
    setInstalling(true);
    setInstallResult(null);

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('apks', file);
    });

    formData.append('replace', String(replace));
    formData.append('downgrade', String(downgrade));
    formData.append('grantPermissions', String(grantPermissions));
    formData.append('allowTest', String(allowTest));
    formData.append('installAsSystem', String(installAsSystem));

    try {
      const res = await api.installApks(serial, formData);
      setInstallResult(res);
      if (res.success) {
        setSelectedFiles([]);
        if (onInstallSuccess) onInstallSuccess();
      }
    } catch (err) {
      setInstallResult({
        success: false,
        error: err.message,
        rawOutput: err.message
      });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-4 space-y-4 text-xs">
      {/* Upload Zone */}
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition select-none ${
          isDragging 
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20' 
            : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".apk"
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 mb-3">
          <Upload className="w-6 h-6" />
        </div>
        <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
          Drop APK files here, or click to browse
        </h4>
        <p className="text-zinc-500 text-xs mt-1 max-w-sm">
          Supports single APKs and split APK sets. Files are verified and installed through ADB.
        </p>
      </div>

      {/* Selected Files List & Storage Pre-flight */}
      {selectedFiles.length > 0 && (
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
              Selected Files ({selectedFiles.length}) • Total: {totalMB} MB
            </span>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-[11px] text-zinc-400 hover:text-red-500 transition"
            >
              Clear All
            </button>
          </div>

          {/* Pre-flight storage warning */}
          {isStorageTight && (
            <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-[11px]">
                Low Storage Warning: Free space on device <span className="font-mono">/data</span> is low ({capabilities?.freeSpace?.data?.freeText} free). Installation requires temporary staging space (~2x APK size).
              </div>
            </div>
          )}

          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {selectedFiles.map((f, idx) => (
              <div
                key={idx}
                className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between font-mono text-[11px]"
              >
                <div className="flex items-center space-x-2 truncate">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="truncate text-zinc-800 dark:text-zinc-200">{f.name}</span>
                </div>
                <div className="flex items-center space-x-3 shrink-0">
                  <span className="text-zinc-400">{(f.size / (1024 * 1024)).toFixed(2)} MB</span>
                  <button
                    onClick={() => removeFile(idx)}
                    className="text-zinc-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Installation Options */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
        <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider block">
          Installation Flags & Settings
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <label className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <input
              type="checkbox"
              checked={replace}
              onChange={e => setReplace(e.target.checked)}
              className="rounded border-zinc-300 text-zinc-900 focus:ring-0 dark:bg-zinc-800"
            />
            <div>
              <span className="font-medium">Replace existing (-r)</span>
              <p className="text-[10px] text-zinc-500">Overwrites existing package if already installed.</p>
            </div>
          </label>

          <label className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <input
              type="checkbox"
              checked={downgrade}
              onChange={e => setDowngrade(e.target.checked)}
              className="rounded border-zinc-300 text-zinc-900 focus:ring-0 dark:bg-zinc-800"
            />
            <div>
              <span className="font-medium">Allow version downgrade (-d)</span>
              <p className="text-[10px] text-zinc-500">Permits installing older version over newer one.</p>
            </div>
          </label>

          {capabilities?.apiLevel >= 23 && (
            <label className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
              <input
                type="checkbox"
                checked={grantPermissions}
                onChange={e => setGrantPermissions(e.target.checked)}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-0 dark:bg-zinc-800"
              />
              <div>
                <span className="font-medium">Grant all permissions (-g)</span>
                <p className="text-[10px] text-zinc-500">Auto-grants runtime permissions on Android 6.0+.</p>
              </div>
            </label>
          )}

          <label className="flex items-center space-x-2 cursor-pointer p-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800">
            <input
              type="checkbox"
              checked={allowTest}
              onChange={e => setAllowTest(e.target.checked)}
              className="rounded border-zinc-300 text-zinc-900 focus:ring-0 dark:bg-zinc-800"
            />
            <div>
              <span className="font-medium">Allow test packages (-t)</span>
              <p className="text-[10px] text-zinc-500">Allows APKs built with testOnly flag.</p>
            </div>
          </label>
        </div>

        {/* Install as system app (root only) */}
        {capabilities?.rootAvailable && (
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <label className="flex items-start space-x-2 cursor-pointer p-2 rounded bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/40">
              <input
                type="checkbox"
                checked={installAsSystem}
                onChange={e => setInstallAsSystem(e.target.checked)}
                className="mt-0.5 rounded border-purple-400 text-purple-600 focus:ring-0"
              />
              <div>
                <span className="font-semibold text-purple-900 dark:text-purple-200">
                  Advanced: Push as System Application (/system/app)
                </span>
                <p className="text-[10px] text-purple-800/80 dark:text-purple-300/80">
                  Remounts /system read-write, copies APK, sets chmod 644 permissions, and requires a reboot to take effect.
                </p>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Install Button */}
      <div>
        <button
          onClick={handleInstall}
          disabled={selectedFiles.length === 0 || installing}
          className="w-full flex items-center justify-center space-x-2 py-2.5 rounded-xl font-semibold text-xs bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
        >
          {installing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Installing APK(s) to phone over ADB...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              <span>Install {selectedFiles.length > 0 ? `${selectedFiles.length} Package(s)` : ''}</span>
            </>
          )}
        </button>
      </div>

      {/* Result Card */}
      {installResult && (
        <div className={`p-4 rounded-xl border space-y-2 text-xs ${
          installResult.success 
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
            : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
        }`}>
          <div className="flex items-center space-x-2 font-semibold">
            {installResult.success ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span>{installResult.success ? 'Installation Successful' : 'Installation Failed'}</span>
          </div>

          <p className="text-[11px] leading-relaxed">
            {installResult.message || installResult.error}
          </p>

          {installResult.rawOutput && (
            <div className="pt-2">
              <button
                onClick={() => setShowRawDetails(!showRawDetails)}
                className="flex items-center space-x-1 text-[10px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                <span>Raw Output Details</span>
                {showRawDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {showRawDetails && (
                <pre className="mt-1 p-2 rounded bg-zinc-950 text-zinc-300 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
                  {installResult.rawOutput}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
