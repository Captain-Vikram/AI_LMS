import React from 'react';
import { IoSparklesOutline, IoCloseCircleOutline, IoSettingsOutline } from 'react-icons/io5';
import { useAIJobStatus } from '../../hooks/useAIJob';

const GenerationBanner = ({ jobId, title = 'AI is Building Content', className = '', onReady }) => {
  const { status, progress, error, isReady, stopJob, retryJob, updateConfig, config } = useAIJobStatus(jobId);
  const [showConfig, setShowConfig] = React.useState(false);
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
    if (isReady && onReady) {
      onReady();
    }
  }, [isReady, onReady]);

  if (isReady || !status || status === 'ready') return null;

  return (
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
  );
};

export default GenerationBanner;
