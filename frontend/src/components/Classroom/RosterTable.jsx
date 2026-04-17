import React, { useState } from 'react';

export const RosterTable = ({ 
  students = [], 
  loading = false,
  onRemoveStudent,
  onViewProgress,
  isTeacher = false 
}) => {
  const [sortBy, setSortBy] = useState('name');

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

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Email
              </th>
              {isTeacher && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((student) => (
              <tr
                key={student.user_id}
                className="border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors"
              >
                <td className="px-4 py-3 text-sm text-gray-100">
                  {student.name || 'N/A'}
                </td>
                <td className="px-4 py-3 text-sm text-gray-400">
                  {student.email}
                </td>
                {isTeacher && (
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-2">
                      {onViewProgress && (
                        <button
                          onClick={() => onViewProgress(student)}
                          className="px-3 py-1 text-xs bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 rounded transition-colors"
                        >
                          Progress
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove ${student.name} from classroom?`)) {
                            onRemoveStudent?.(student.user_id);
                          }
                        }}
                        className="px-3 py-1 text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
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
