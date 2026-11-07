import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  RotateCw, 
  ChevronDown, 
  ChevronUp, 
  Terminal,
  Activity,
  Smartphone
} from 'lucide-react';
import { api } from '../../services/api';

export default function JobProgressModal({
  isOpen,
  onClose,
  serial,
  jobId,
  onJobComplete,
  onDeviceReboot
}) {
  const [events, setEvents] = useState([]);
  const [isDone, setIsDone] = useState(false);
  const [jobStatus, setJobStatus] = useState('running'); // 'running', 'completed', 'failed', 'cancelled'
  const [currentStep, setCurrentStep] = useState('Starting job...');
  const [summary, setSummary] = useState(null);
  const [rebootRecommended, setRebootRecommended] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);
  const [rebootMsg, setRebootMsg] = useState(null);
  const [showRawDetails, setShowRawDetails] = useState(false);

  const eventSourceRef = useRef(null);
  const logEndRef = useRef(null);
  const onJobCompleteRef = useRef(onJobComplete);

  useEffect(() => {
    onJobCompleteRef.current = onJobComplete;
  }, [onJobComplete]);

  useEffect(() => {
    if (!isOpen || !jobId || !serial) {
      setEvents([]);
      setIsDone(false);
      setJobStatus('running');
      setSummary(null);
      setRebootRecommended(false);
      setIsRebooting(false);
      setRebootMsg(null);
      return;
    }

    const streamUrl = api.getJobStreamUrl(serial, jobId);
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setEvents(prev => {
          // Avoid duplicate events if replayed or reconnected
          const exists = prev.some(item => 
            item.timestamp === data.timestamp && 
            item.step === data.step && 
            item.message === data.message
          );
          if (exists) return prev;

          const last = prev[prev.length - 1];
          if (last && last.message === data.message && last.status === data.status && last.step === data.step) {
            return prev;
          }
          return [...prev, data];
        });

        if (data.message) {
          setCurrentStep(data.message);
        }

        if (data.done) {
          setIsDone(true);
          setJobStatus(data.status === 'done' || data.status === 'completed' ? 'completed' : 'failed');
          if (data.summary) {
            setSummary(data.summary);
            if (data.summary.rebootRecommended) {
              setRebootRecommended(true);
            }
          }
          if (onJobCompleteRef.current) {
            onJobCompleteRef.current(data);
          }
        }
      } catch (_) {}
    };

    es.onerror = () => {
      // Check if job completed
      es.close();
    };

    return () => {
      if (es) es.close();
    };
  }, [isOpen, jobId, serial]);

  // Auto-scroll log
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events]);

  const handleReboot = async () => {
    if (!serial) return;
    setIsRebooting(true);
    setRebootMsg('Sending reboot signal to device...');

    try {
      await api.rebootDevice(serial);
      setRebootMsg('Phone is rebooting. Waiting for ADB reconnection...');
      if (onDeviceReboot) {
        onDeviceReboot();
      }
    } catch (err) {
      setRebootMsg(`Reboot failed: ${err.message}`);
      setIsRebooting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none p-4">
      <div className="relative z-10 w-full max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[85vh] text-zinc-800 dark:text-zinc-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/60">
          <div className="flex items-center space-x-2.5">
            {!isDone ? (
              <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
            ) : jobStatus === 'completed' ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {!isDone ? 'Executing Package Operation' : 
                 jobStatus === 'completed' ? 'Operation Completed' : 'Operation Failed'}
              </h2>
              <span className="text-[11px] text-zinc-500 font-mono">Job ID: {jobId}</span>
            </div>
          </div>

          {isDone && (
            <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Status banner */}
          <div className={`p-3 rounded-lg border flex items-center justify-between ${
            !isDone ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200' :
            jobStatus === 'completed' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200' :
            'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/60 text-red-900 dark:text-red-200'
          }`}>
            <span className="font-medium text-xs truncate mr-2">{currentStep}</span>
            {!isDone && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-200 dark:bg-indigo-800 text-indigo-900 dark:text-indigo-100 animate-pulse">
                IN PROGRESS
              </span>
            )}
          </div>

          {/* Summary stats if finished */}
          {summary && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40">
                <span className="text-[10px] text-zinc-400 uppercase font-medium block">Total</span>
                <span className="text-base font-semibold">{summary.total || 0}</span>
              </div>
              <div className="p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300">
                <span className="text-[10px] uppercase font-medium block">Success</span>
                <span className="text-base font-semibold">{summary.succeeded || 0}</span>
              </div>
              <div className="p-2.5 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 text-red-700 dark:text-red-300">
                <span className="text-[10px] uppercase font-medium block">Failed</span>
                <span className="text-base font-semibold">{summary.failed || 0}</span>
              </div>
            </div>
          )}

          {/* Reboot prompt if recommended */}
          {rebootRecommended && (
            <div className="p-3.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 space-y-2">
              <div className="flex items-center space-x-1.5 font-semibold text-xs text-amber-800 dark:text-amber-300">
                <RotateCw className="w-4 h-4" />
                <span>Reboot Recommended</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                System packages were deleted or updated. A device reboot is needed to reload Dalvik/ART caches and refresh the package manager.
              </p>
              {rebootMsg ? (
                <div className="text-[11px] font-mono text-zinc-600 dark:text-zinc-300 p-2 rounded bg-amber-100/60 dark:bg-amber-900/40">
                  {rebootMsg}
                </div>
              ) : (
                <button
                  onClick={handleReboot}
                  disabled={isRebooting}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs transition"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Reboot Phone Now</span>
                </button>
              )}
            </div>
          )}

          {/* Live Progress Log */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Operation Log</span>
              <button
                onClick={() => setShowRawDetails(!showRawDetails)}
                className="flex items-center space-x-1 text-[11px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                <span>{showRawDetails ? 'Simple Log' : 'Detailed Log'}</span>
                {showRawDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            <div className="h-56 overflow-y-auto p-3 rounded-lg bg-zinc-950 text-zinc-300 font-mono text-[11px] space-y-1 border border-zinc-800">
              {events.length === 0 ? (
                <div className="text-zinc-500 italic">Waiting for events from device...</div>
              ) : (
                events.map((ev, i) => (
                  <div key={i} className="flex items-start space-x-2 leading-relaxed">
                    <span className="text-zinc-500 select-none text-[10px]">
                      {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : ''}
                    </span>
                    <span className="shrink-0 mt-0.5">
                      {ev.status === 'done' ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 inline" />
                      ) : ev.status === 'failed' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 inline" />
                      ) : (
                        <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin inline" />
                      )}
                    </span>
                    <span className="break-all flex-1 text-zinc-200">
                      {ev.message || ev.step}
                    </span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 flex items-center justify-end space-x-2">
          {isDone ? (
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-zinc-100 dark:text-zinc-900 hover:opacity-90 transition"
            >
              Done & Close
            </button>
          ) : (
            <span className="text-xs text-zinc-400 flex items-center space-x-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Job running on device...</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

