import React, { useState } from 'react';

const getModuleId = (module, idx) =>
  module?.module_id || module?._id || `${module?.order || 'mod'}-${idx}`;

const getModuleName = (module) => module?.name || module?.title || 'Untitled Module';

const normalizeResourceUrl = (urlValue) => {
  if (!urlValue) {
    return '';
  }

  const unwrapQuotes = (value) => {
    let text = String(value || '').trim();
    while (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1).trim();
    }
    return text;
  };

  let raw = urlValue;
  if (Array.isArray(raw)) {
    raw = raw.find((item) => typeof item === 'string' && item.trim()) || '';
  }

  let text = unwrapQuotes(raw);
  if (!text) {
    return '';
  }

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text.replace(/'/g, '"'));
      if (Array.isArray(parsed)) {
        text = unwrapQuotes(parsed.find((item) => typeof item === 'string' && item.trim()) || '');
      }
    } catch {
      // Continue with regex extraction.
    }
  }

  text = unwrapQuotes(text).replace(/\\u0026/g, '&').replace(/&amp;/gi, '&');
  const matched = text.match(/https?:\/\/[^\s'"\]]+/i);
  if (matched) {
    text = matched[0].trim();
  }

  if (!/^https?:\/\//i.test(text) && /^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(text)) {
    text = `https://${text}`;
  }

  return /^https?:\/\//i.test(text) ? text : '';
};

const toPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

export const ModuleList = ({ modules = [], loading = false, moduleActions = null }) => {
  const [expandedId, setExpandedId] = useState(null);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-700 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (!modules || modules.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No learning modules available yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {modules.map((module, idx) => {
        const moduleId = getModuleId(module, idx);
        const moduleName = getModuleName(module);

        return (
        <div
          key={moduleId}
          className="p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-blue-500 transition-colors"
        >
          <div
            className="flex items-start justify-between cursor-pointer"
            onClick={() =>
              setExpandedId(
                expandedId === moduleId ? null : moduleId
              )
            }
          >
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                  Module {module.order || idx + 1}
                </span>
                <h4 className="font-semibold text-gray-100">{moduleName}</h4>
              </div>
              {module.description && (
                <p className="text-sm text-gray-400 mt-2 line-clamp-2">
                  {module.description}
                </p>
              )}
            </div>
            <div className="text-right ml-4 flex flex-col items-end gap-2">
              {typeof moduleActions === 'function' && (
                <div
                  className="flex items-center gap-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  {moduleActions(module)}
                </div>
              )}

              <span className="text-xs text-gray-400">
                {module.estimated_hours || 0}h
              </span>
              <div className="text-xs mt-1">
                <span
                  className={`px-2 py-1 rounded ${
                    module.difficulty_level === 'hard'
                      ? 'bg-red-500/20 text-red-400'
                      : module.difficulty_level === 'medium'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-green-500/20 text-green-400'
                  }`}
                >
                  {module.difficulty_level || 'standard'}
                </span>
              </div>
            </div>
          </div>

          {expandedId === moduleId && (
            <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
              {module.objectives && module.objectives.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-300 mb-2">
                    Learning Objectives:
                  </h5>
                  <ul className="space-y-1">
                    {module.objectives.map((obj, idx) => (
                      <li key={idx} className="text-xs text-gray-400">
                        • {obj.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {module.resources && module.resources.length > 0 && (
                <div>
                  <h5 className="text-sm font-medium text-gray-300 mb-2">
                    Resources:
                  </h5>
                  <div className="space-y-2">
                    {module.resources.map((resource, idx) => {
                      const link = normalizeResourceUrl(resource?.url);
                      const className =
                        'block text-xs p-2 bg-gray-700/50 rounded transition-colors';

                      if (!link) {
                        return (
                          <div key={idx} className={`${className} text-gray-300`}>
                            <div className="font-medium">{resource.title}</div>
                            <div className="text-gray-500 text-xs mt-1">
                              {resource.resource_type}
                            </div>
                          </div>
                        );
                      }

                      return (
                        <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${className} text-blue-400 hover:text-blue-300 hover:bg-gray-700`}
                        >
                          <div className="font-medium">{resource.title}</div>
                          <div className="text-gray-500 text-xs mt-1">
                            {resource.resource_type}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      );
      })}
    </div>
  );
};

export const LearningModuleProgress = ({ 
  modules = [], 
  studentProgress = null,
  loading = false 
}) => {
  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading progress...</div>;
  }

  if (!modules || modules.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No modules to track</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {modules.map((module, idx) => {
        const moduleId = getModuleId(module, idx);
        const moduleName = getModuleName(module);
        const progress = studentProgress?.module_progress?.find(
          (p) => p.module_id === moduleId
        );

        const percentage = progress ? toPercent(progress.completion_percentage || 0) : 0;

        return (
          <div key={moduleId} className="p-3 rounded-lg bg-gray-800 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-gray-100">{moduleName}</h4>
              <span className="text-sm font-semibold text-blue-400">
                {percentage}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
            </div>
            {progress && (
              <p className="text-xs text-gray-400 mt-2">
                {progress.completed_assessments}/{progress.total_assessments}{' '}
                assessments completed
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};
