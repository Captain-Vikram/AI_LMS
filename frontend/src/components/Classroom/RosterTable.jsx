import React, { useState } from 'react';
import { IoChevronDownOutline, IoAnalyticsOutline, IoTrashOutline } from 'react-icons/io5';

export const RosterTable = ({ 
  students = [], 
  loading = false,
  onRemoveStudent,
  onViewProgress,
  isTeacher = false 
}) => {
  const [sortBy, setSortBy] = useState('name');
  const [expandedId, setExpandedId] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(10);

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-700 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (!students || students.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No students in this classroom</p>
      </div>
    );
  }

  const sorted = [...students].sort((a, b) => {
    if (sortBy === 'name') {
      return (a.name || '').localeCompare(b.name || '');
    }
    return (a.email || '').localeCompare(b.email || '');
  });

  return (
    <div>
      <div className="mb-4">
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="name">Sort by Name</option>
          <option value="email">Sort by Email</option>
        </select>
      </div>

      <div className="space-y-3 mt-4">
        {sorted.slice(0, displayLimit).map((student) => {
          const isExpanded = expandedId === student.user_id;
          return (
            <div 
              key={student.user_id} 
              className={`rounded-2xl border transition-all duration-300 ${
                isExpanded 
                  ? 'border-indigo-500/40 bg-indigo-500/[0.03] shadow-[0_4px_20px_rgba(99,102,241,0.1)]' 
                  : 'border-slate-700/40 bg-slate-800/20 hover:border-slate-500/40 hover:bg-slate-800/40'
              }`}
            >
              <div 
                className="flex items-center justify-between p-4 sm:px-6 cursor-pointer select-none"
                onClick={() => toggleExpand(student.user_id)}
              >
                <div className="flex items-center gap-4">
                  <div className={`h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg transition-colors ${
                    isExpanded ? 'bg-gradient-to-br from-indigo-500 to-cyan-500' : 'bg-slate-700'
                  }`}>
                    {(student.name || 'N').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-100 tracking-wide">{student.name || 'N/A'}</h4>
                    <p className="text-sm font-medium text-slate-400">{student.email}</p>
                  </div>
                </div>
                {isTeacher && (
                  <div className="text-slate-400 shrink-0 bg-slate-800/50 p-2 rounded-full border border-slate-700/50">
                    <IoChevronDownOutline className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-400' : ''}`} />
                  </div>
                )}
              </div>

              {isTeacher && (
                <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <div className="p-4 sm:px-6 bg-slate-900/30 border-t border-slate-700/30">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        {onViewProgress && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onViewProgress(student); }}
                            className="flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-widest font-bold bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500 hover:text-white border border-cyan-500/30 hover:border-cyan-500 rounded-xl transition-all shadow-md"
                          >
                            <IoAnalyticsOutline size={16} /> Progress
                          </button>
                        )}
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            if (window.confirm(`Are you sure you want to remove ${student.name} from the classroom?`)) {
                              onRemoveStudent?.(student.user_id);
                            }
                          }}
                          className="flex items-center gap-2 px-5 py-2.5 text-xs uppercase tracking-widest font-bold bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 hover:border-red-500 rounded-xl transition-all shadow-md"
                        >
                          <IoTrashOutline size={16} /> Remove
                        </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {sorted.length > displayLimit && (
          <div className="flex justify-center pt-4 mb-2">
            <button
              onClick={() => setDisplayLimit((prev) => prev + 20)}
              className="px-6 py-2.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-bold uppercase tracking-wider hover:bg-indigo-500 hover:text-white hover:border-indigo-500 transition-all shadow-md active:scale-95"
            >
              Load More Students ({sorted.length - displayLimit} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const RosterStats = ({ totalStudents, groupCount }) => {
  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <p className="text-xs text-gray-400 mb-1">Total Students</p>
        <p className="text-2xl font-bold text-blue-400">{totalStudents}</p>
      </div>
      <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
        <p className="text-xs text-gray-400 mb-1">Groups</p>
        <p className="text-2xl font-bold text-purple-400">{groupCount}</p>
      </div>
    </div>
  );
};
