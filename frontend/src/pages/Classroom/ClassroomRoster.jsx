import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IoArrowForwardOutline,
  IoCloudUploadOutline,
  IoGridOutline,
  IoPeopleOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
import { useEnrollment, useStudentGroups } from '../../hooks/useClassroom';
import { LoadingState, ErrorState } from '../../components/Classroom/DashboardCard';
import { RosterTable, RosterStats } from '../../components/Classroom/RosterTable';
import { GroupManagement } from '../../components/Classroom/GroupManagement';
import GlassDashboardShell from '../../components/UI/GlassDashboardShell';

const ClassroomRoster = () => {
  const { id: classroomId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('roster');
  const userRole = (localStorage.getItem('userRole') || 'student').toLowerCase();
  const canManage = userRole === 'teacher' || userRole === 'admin';

  // Fetch roster
  const {
    roster,
    loading: enrollmentLoading,
    error: enrollmentError,
    bulkUpload,
    removeStudent,
  } = useEnrollment(classroomId);

  // Fetch groups
  const {
    groups,
    loading: groupsLoading,
    createGroup,
    addStudentToGroup,
  } = useStudentGroups(classroomId);

  const [fileInput, setFileInput] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!fileInput) return;

    setBulkLoading(true);
    setBulkMessage('');

    try {
      const result = await bulkUpload(fileInput);
      if (result) {
        setBulkMessage(
          `Successfully enrolled ${result.success} students. ${
            result.failed > 0 ? `${result.failed} failed.` : ''
          }`
        );
      }
    } catch (err) {
      setBulkMessage(`Error: ${err.message}`);
    } finally {
      setBulkLoading(false);
      setFileInput(null);
    }
  };

  if (enrollmentLoading && !roster) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <LoadingState message="Loading roster..." />
      </GlassDashboardShell>
    );
  }

  if (enrollmentError) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <ErrorState message={enrollmentError} />
      </GlassDashboardShell>
    );
  }

  const students = roster?.students || [];
  const totalStudents = students.length;

  return (
    <GlassDashboardShell contentClassName="max-w-7xl">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-700/70 bg-gradient-to-r from-slate-900 via-gray-900 to-slate-800 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-300">Roster Management</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-100">Classroom Roster</h1>
              <p className="mt-2 text-sm text-gray-300">
                Keep your learner list clean, organize collaborative groups, and monitor class composition.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <button
                onClick={() => navigate(`/classroom/${classroomId}/dashboard`)}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-cyan-500 px-3 py-2 font-medium text-white transition-colors hover:bg-cyan-600"
              >
                <IoGridOutline />
                Dashboard
              </button>
              <button
                onClick={() => navigate(`/classroom/${classroomId}/modules`)}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 font-medium text-white transition-colors hover:bg-emerald-600"
              >
                <IoArrowForwardOutline />
                Modules
              </button>
              <button
                onClick={() => navigate(`/classroom/${classroomId}/settings`)}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-gray-700 px-3 py-2 font-medium text-white transition-colors hover:bg-gray-600"
              >
                <IoSettingsOutline />
                Settings
              </button>
            </div>
          </div>
        </div>

        <RosterStats totalStudents={totalStudents} groupCount={groups.length} />

        <div className="inline-flex w-full rounded-xl border border-gray-700 bg-gray-900/50 p-1 sm:w-auto">
          <button
            onClick={() => setActiveTab('roster')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'roster'
                ? 'bg-cyan-500/20 text-cyan-200'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <span className="inline-flex items-center gap-1">
              <IoPeopleOutline /> Students ({totalStudents})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('groups')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'groups'
                ? 'bg-emerald-500/20 text-emerald-200'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Groups ({groups.length})
          </button>
        </div>

        {activeTab === 'roster' ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            {canManage && (
              <div className="xl:col-span-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5">
                <h3 className="text-lg font-semibold text-emerald-100">Bulk Enroll Students</h3>
                <p className="mt-1 text-sm text-emerald-100/80">
                  Upload a CSV with email or student_email to enroll multiple learners quickly.
                </p>

                <form onSubmit={handleBulkUpload} className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm text-emerald-100/80">CSV file</label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => setFileInput(e.target.files?.[0])}
                      className="w-full rounded-lg border border-emerald-300/30 bg-gray-900/60 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!fileInput || bulkLoading}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
                  >
                    <IoCloudUploadOutline />
                    {bulkLoading ? 'Uploading CSV...' : 'Upload CSV'}
                  </button>

                  {bulkMessage && (
                    <p className={`text-sm ${bulkMessage.includes('Error') ? 'text-red-300' : 'text-emerald-100'}`}>
                      {bulkMessage}
                    </p>
                  )}
                </form>
              </div>
            )}

            <div className={canManage ? 'xl:col-span-8' : 'xl:col-span-12'}>
              <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-6">
                <h3 className="text-lg font-semibold text-gray-100">Student List</h3>
                <p className="mt-1 text-sm text-gray-400">Sort by name or email and remove entries when needed.</p>
                <div className="mt-5">
                  <RosterTable
                    students={students}
                    loading={enrollmentLoading}
                    onRemoveStudent={removeStudent}
                    isTeacher={canManage}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-6">
            {!canManage && (
              <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Group editing is available to teacher and admin roles only.
              </p>
            )}
            <GroupManagement
              groups={groups}
              students={students}
              loading={groupsLoading}
              onCreateGroup={createGroup}
              onAddToGroup={addStudentToGroup}
              isTeacher={canManage}
            />
          </div>
        )}
      </div>
    </GlassDashboardShell>
  );
};

export default ClassroomRoster;
