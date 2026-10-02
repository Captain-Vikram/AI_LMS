import React from 'react';
import { IoSparklesOutline, IoCloseCircleOutline, IoSettingsOutline, IoWarningOutline } from 'react-icons/io5';
import { useAIJobStatus } from '../../hooks/useAIJob';

const GenerationBanner = ({ jobId, title = 'AI is Building Content', className = '', onReady }) => {
  const { status, progress, error, warning, isReady, stopJob, retryJob, updateConfig, config } = useAIJobStatus(jobId);
  const [showConfig, setShowConfig] = React.useState(false);
  const [showPopup, setShowPopup] = React.useState(false);
  const [localCfg, setLocalCfg] = React.useState({
    search_timeout: config?.search_timeout || 600,
    poll_interval: config?.poll_interval || 3000,
  });

  React.useEffect(() => {
    setLocalCfg({
      search_timeout: config?.search_timeout || 600,
      poll_interval: config?.poll_interval || 3000,
    });
  }, [config]);

  React.useEffect(() => {
    if (warning) {
      setShowPopup(true);
    }
  }, [warning]);

  const hasCalledReady = React.useRef(false);

  React.useEffect(() => {
    if (isReady) {
      if (!hasCalledReady.current && onReady) {
        hasCalledReady.current = true;
        onReady();
      }
    } else {
      hasCalledReady.current = false;
    }
  }, [isReady, onReady]);

  if (isReady || !status || status === 'ready') return null;

  return (
    <>
      {/* Toast/Popup Notification for Exhausted API Keys */}
      {showPopup && warning && (
        <div className="fixed top-6 right-6 z-[9999] max-w-sm w-full bg-slate-950/95 border border-amber-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-right-8 fade-in">
          <div className="flex items-start gap-3.5">
            <div className="flex-shrink-0 bg-amber-500/20 p-2.5 rounded-xl text-amber-400 border border-amber-500/30">
              <IoWarningOutline className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white">API Quota Warning</h4>
                <button 
                  onClick={() => setShowPopup(false)}
                  className="text-slate-400 hover:text-white text-lg transition-colors p-1"
                  title="Close popup"
                >
                  &times;
                </button>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                {warning} Please check your API configuration or system environment keys.
              </p>
              <div className="mt-3.5 flex gap-2">
                <button 
                  onClick={() => setShowPopup(false)} 
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition-all shadow-md"
                >
                  Okay, Got it
                </button>
                <button 
                  onClick={() => setShowPopup(false)} 
                  className="border border-slate-700 hover:bg-white/5 text-slate-300 px-3 py-1.5 rounded-lg text-xs transition-all"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`mb-6 rounded-2xl border p-4 backdrop-blur-md transition-all duration-500 animate-in fade-in slide-in-from-top-4 ${
        status === 'failed' ? 'border-rose-500/30 bg-rose-500/10' : 'border-cyan-500/30 bg-cyan-500/10'
      } ${className}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 shrink-0">
              {status === 'failed' ? (
                 <IoCloseCircleOutline className="h-full w-full text-rose-500" />
              ) : (
                <>
                  <IoSparklesOutline className="absolute inset-0 h-full w-full animate-pulse text-cyan-400" />
                  <div className="absolute inset-0 flex items-center justify-center">
                     <span className="text-[10px] font-black text-cyan-200">{progress}%</span>
                  </div>
                </>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {status === 'failed' ? 'AI Generation Failed' : title}
              </h3>
              <p className="text-xs text-slate-400">
                {status === 'failed' ? error : `Current Phase: ${status.charAt(0).toUpperCase() + status.slice(1)}...`}
              </p>
              {warning && (
                <p className="text-[11px] text-amber-400 mt-1 font-medium bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  ⚠️ {warning}
                </p>
              )}
            </div>
          </div>
          {status !== 'failed' && (
            <div className="h-2 w-full sm:w-64 overflow-hidden rounded-full bg-white/5">
               <div 
                 className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-1000" 
                 style={{ width: `${progress}%` }} 
               />
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="rounded-md p-1 text-slate-300 hover:text-white"
              title="Job settings"
            >
              <IoSettingsOutline className="h-5 w-5" />
            </button>
            {status !== 'failed' && status !== 'ready' && (
              <button onClick={() => stopJob && stopJob()} className="bg-rose-600/20 text-rose-200 px-3 py-1 rounded-md text-xs">Stop</button>
            )}
            {status === 'failed' && (
              <button onClick={() => retryJob && retryJob()} className="bg-cyan-600/20 text-cyan-200 px-3 py-1 rounded-md text-xs">Retry</button>
            )}
          </div>
          {showConfig && (
            <div className="mt-3 grid grid-cols-2 gap-2 w-full sm:w-80">
              <div>
                <label className="text-xs text-slate-400">Search timeout (s)</label>
                <input
                  type="number"
                  value={localCfg.search_timeout}
                  onChange={(e) => setLocalCfg({...localCfg, search_timeout: parseInt(e.target.value || 0)})}
                  className="mt-1 w-full rounded-md bg-white/5 p-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Poll interval (ms)</label>
                <input
                  type="number"
                  value={localCfg.poll_interval}
                  onChange={(e) => setLocalCfg({...localCfg, poll_interval: parseInt(e.target.value || 0)})}
                  className="mt-1 w-full rounded-md bg-white/5 p-2 text-sm"
                />
              </div>
              <div className="col-span-2 flex gap-2 justify-end">
                <button
                  onClick={() => setShowConfig(false)}
                  className="text-xs px-3 py-1 rounded bg-white/5 text-slate-300"
                >Cancel</button>
                <button
                  onClick={async () => {
                    try {
                      await updateConfig && updateConfig({
                        search_timeout: Number(localCfg.search_timeout),
                        poll_interval: Number(localCfg.poll_interval),
                      });
                      setShowConfig(false);
                    // eslint-disable-next-line no-unused-vars
                    } catch (e) {
                      // ignore - use hook to surface errors
                    }
                  }}
                  className="text-xs px-3 py-1 rounded bg-cyan-600/20 text-cyan-200"
                >Save</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GenerationBanner;
