import React, { useMemo } from 'react';

const formatSourceLabel = (source) => {
  const text = String(source || 'unknown').trim();
  if (!text) return 'Unknown';
  return text
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');
};

const shortLabel = (value, max = 18) => {
  const text = String(value || '').trim();
  if (!text) return 'Module';
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
};

const getHeatColor = (count, maxCount) => {
  if (!count || maxCount <= 0) {
    return 'rgba(148, 163, 184, 0.14)';
  }

  const ratio = Math.max(0, Math.min(1, count / maxCount));
  const hue = Math.round(120 - (120 * ratio));
  const saturation = 85;
  const lightness = Math.round(35 + (18 * (1 - ratio)));

  return `hsl(${hue} ${saturation}% ${lightness}%)`;
};

const ModuleQuestionHeatmap = ({
  data,
  loading = false,
  title = 'Ask AI Question Heatmap',
  emptyMessage = 'Heatmap appears once ask-AI activity is available for this classroom.',
}) => {
  const modules = Array.isArray(data?.modules) ? data.modules : [];
  const sources = Array.isArray(data?.sources) ? data.sources : [];
  const cells = Array.isArray(data?.cells) ? data.cells : [];

  const maxCount = Number(data?.max_count || 0);
  const totalQuestions = Number(data?.total_questions || 0);

  const cellLookup = useMemo(() => {
    const map = new Map();
    cells.forEach((cell) => {
      const moduleId = String(cell?.module_id || '').trim();
      const source = String(cell?.source || '').trim();
      if (!moduleId || !source) return;
      map.set(`${source}::${moduleId}`, Number(cell?.count || 0));
    });
    return map;
  }, [cells]);

  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-xs text-slate-500">
        Loading ask-AI heatmap...
      </div>
    );
  }

  if (!modules.length || !sources.length) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-4 text-xs text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
          <p className="mt-1 text-xs text-slate-500">Module x source intensity for ask-AI questions.</p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-right">
          <p className="text-[10px] uppercase tracking-wide text-slate-600">Total Questions</p>
          <p className="text-sm font-bold text-cyan-300">{totalQuestions}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[680px] gap-2"
          style={{ gridTemplateColumns: `minmax(140px, 180px) repeat(${modules.length}, minmax(84px, 1fr))` }}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Source</div>
          {modules.map((module) => (
            <div key={module.module_id} className="text-center text-[10px] font-bold uppercase tracking-wide text-slate-600" title={module.module_name}>
              <div>{shortLabel(module.module_name, 14)}</div>
              <div className="mt-0.5 text-[10px] text-slate-500">{Number(module.total_questions || 0)}</div>
            </div>
          ))}

          {sources.map((sourceItem) => {
            const sourceName = String(sourceItem?.source || 'unknown');
            return (
              <React.Fragment key={sourceName}>
                <div className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-2">
                  <p className="text-[11px] font-semibold text-slate-300">{formatSourceLabel(sourceName)}</p>
                  <p className="text-[10px] text-slate-500">{Number(sourceItem?.total_questions || 0)} questions</p>
                </div>

                {modules.map((module) => {
                  const count = Number(cellLookup.get(`${sourceName}::${module.module_id}`) || 0);
                  const backgroundColor = getHeatColor(count, maxCount);
                  return (
                    <div
                      key={`${sourceName}-${module.module_id}`}
                      className="flex h-11 items-center justify-center rounded-md border border-white/[0.06] text-sm font-bold tabular-nums text-white"
                      style={{ backgroundColor }}
                      title={`${formatSourceLabel(sourceName)} - ${module.module_name}: ${count} question${count === 1 ? '' : 's'}`}
                    >
                      {count}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-[10px] text-slate-500">
        <span>Less</span>
        <div className="h-2 w-24 rounded-full bg-gradient-to-r from-[#22c55e] via-[#facc15] to-[#ef4444]" />
        <span>More</span>
      </div>
    </div>
  );
};

export default ModuleQuestionHeatmap;
