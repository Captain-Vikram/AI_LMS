import React, { useState } from 'react';

export const GroupManagement = ({ 
  groups = [], 
  students = [],
  loading = false,
  onCreateGroup,
  onAddToGroup,
  isTeacher = false
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (newGroupName.trim()) {
      await onCreateGroup?.(newGroupName, newGroupDesc, selectedStudents);
      setNewGroupName('');
      setNewGroupDesc('');
      setSelectedStudents([]);
      setIsCreating(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Loading groups...</div>;
  }

  if (!isTeacher) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>Groups manage is teacher-only</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isCreating ? (
        <form onSubmit={handleCreateGroup} className="p-4 rounded-lg bg-gray-800 border border-gray-700">
          <input
            type="text"
            placeholder="Group name"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 mb-3 focus:outline-none focus:border-blue-500"
          />
          <textarea
            placeholder="Group description (optional)"
            value={newGroupDesc}
            onChange={(e) => setNewGroupDesc(e.target.value)}
            rows="2"
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 mb-3 focus:outline-none focus:border-blue-500"
          />
          <div className="mb-3">
            <p className="text-sm text-gray-400 mb-2">Add students to group:</p>
            <div className="max-h-40 overflow-y-auto space-y-2">
              {students.map((student) => (
                <label key={student.user_id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedStudents.includes(student.user_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStudents([...selectedStudents, student.user_id]);
                      } else {
                        setSelectedStudents(
                          selectedStudents.filter((id) => id !== student.user_id)
                        );
                      }
                    }}
                    className="w-4 h-4 bg-gray-700 border border-gray-600 rounded focus:outline-none"
                  />
                  <span className="ml-2 text-sm text-gray-300">{student.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded font-medium transition-colors"
            >
              Create Group
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewGroupName('');
                setNewGroupDesc('');
                setSelectedStudents([]);
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors mb-4"
        >
          + New Group
        </button>
      )}

      {groups.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>No student groups yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => (
            <div
              key={group._id}
              className="p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-blue-500 transition-colors cursor-pointer"
              onClick={() =>
                setSelectedGroupId(
                  selectedGroupId === group._id ? null : group._id
                )
              }
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-100">{group.name}</h4>
                  {group.description && (
                    <p className="text-xs text-gray-400 mt-1">
                      {group.description}
                    </p>
                  )}
                </div>
                <span className="text-sm px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                  {group.students?.length || 0} students
                </span>
              </div>

              {selectedGroupId === group._id && group.students && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">Members:</p>
                  <ul className="space-y-1 text-xs">
                    {group.students.map((studentId) => {
                      const student = students.find(s => s.user_id === studentId);
                      return (
                        <li key={studentId} className="text-gray-300">
                          • {student?.name || studentId}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
