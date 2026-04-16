import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import { LoadingState, ErrorState } from '../../components/Classroom/DashboardCard';
import GlassDashboardShell from '../../components/UI/GlassDashboardShell';
import {
  IoCheckmarkCircleOutline,
  IoCopyOutline,
  IoGridOutline,
  IoPeopleOutline,
  IoWarningOutline,
} from 'react-icons/io5';

const ClassroomSettings = () => {
  const { id: classroomId } = useParams();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ tone: 'info', text: '' });

  useEffect(() => {
    const fetchClassroom = async () => {
      try {
        const response = await apiClient.get(`${API_ENDPOINTS.CLASSROOM_GET}${classroomId}`);
        if (response.status === 'success') {
          setClassroom(response.data);
          setFormData(response.data);
        } else if (response?.data) {
          setClassroom(response.data);
          setFormData(response.data);
        } else {
          setClassroom(response);
          setFormData(response);
        }
      } catch (err) {
        setError(err.message || 'Failed to load classroom settings');
      } finally {
        setLoading(false);
      }
    };

    fetchClassroom();
  }, [classroomId]);

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback({ tone: 'info', text: '' });

    try {
      const response = await apiClient.put(`${API_ENDPOINTS.CLASSROOM_GET}${classroomId}`, formData);
      if (response.status === 'success') {
        setClassroom(response.data);
        setIsEditing(false);
        setFeedback({ tone: 'success', text: 'Classroom settings updated successfully.' });
      }
    } catch (err) {
      setFeedback({ tone: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const copyEnrollmentCode = async () => {
    const code = classroom?.enrollment_code || '';
    if (!code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setFeedback({ tone: 'success', text: 'Enrollment code copied to clipboard.' });
    } catch {
      setFeedback({ tone: 'error', text: 'Unable to copy enrollment code automatically.' });
    }
  };

  if (loading) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <LoadingState message="Loading classroom settings..." />
      </GlassDashboardShell>
    );
  }

  if (error) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <ErrorState message={error} />
      </GlassDashboardShell>
    );
  }

  if (!classroom) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <ErrorState message="Classroom not found" />
      </GlassDashboardShell>
    );
  }

  return (
    <GlassDashboardShell contentClassName="max-w-7xl">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-700/70 bg-gradient-to-r from-slate-900 via-gray-900 to-slate-800 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-300">Teacher and Admin Controls</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-100">Classroom Settings</h1>
              <p className="mt-2 text-sm text-gray-300">
                Maintain classroom details, enrollment access, and status from one workspace.
              </p>
            </div>
            <button
              onClick={() => navigate(`/classroom/${classroomId}/dashboard`)}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-600"
            >
              <IoGridOutline />
              Back to Dashboard
            </button>
          </div>
        </div>

        {feedback.text && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              feedback.tone === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                : feedback.tone === 'error'
                  ? 'border-red-500/40 bg-red-500/10 text-red-100'
                  : 'border-blue-500/40 bg-blue-500/10 text-blue-100'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8 rounded-xl border border-gray-700 bg-gray-900/50 p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-100">General Details</h2>
              <button
                onClick={() => {
                  setIsEditing((prev) => !prev);
                  setFeedback({ tone: 'info', text: '' });
                }}
                className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
              >
                {isEditing ? 'Stop Editing' : 'Edit Details'}
              </button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-gray-300">Classroom Name</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-300">Description</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows="3"
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm text-gray-300">Subject</label>
                    <input
                      type="text"
                      value={formData.subject || ''}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-gray-300">Grade Level</label>
                    <input
                      type="text"
                      value={formData.grade_level || ''}
                      onChange={(e) => setFormData({ ...formData, grade_level: e.target.value })}
                      className="w-full rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-500 px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-60"
                  >
                    {isSaving ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setFormData(classroom);
                      setFeedback({ tone: 'info', text: '' });
                    }}
                    className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Classroom Name</p>
                  <p className="mt-1 text-gray-100">{classroom.name || 'Not set'}</p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Description</p>
                  <p className="mt-1 text-gray-300">
                    {classroom.description || 'No classroom description added yet.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Subject</p>
                    <p className="mt-1 text-sm text-gray-200">{classroom.subject || 'Not set'}</p>
                  </div>
                  <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-400">Grade Level</p>
                    <p className="mt-1 text-sm text-gray-200">{classroom.grade_level || 'Not set'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="xl:col-span-4 space-y-6">
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
              <h2 className="text-lg font-semibold text-blue-100">Enrollment Code</h2>
              <p className="mt-1 text-xs text-blue-100/80">
                Share this code with students to allow self-enrollment.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={classroom.enrollment_code || ''}
                  readOnly
                  className="w-full rounded-lg border border-blue-500/30 bg-gray-900/60 px-3 py-2 font-mono text-sm text-blue-100"
                />
                <button
                  onClick={copyEnrollmentCode}
                  className="rounded-lg bg-blue-500/30 p-2 text-blue-100 transition-colors hover:bg-blue-500/40"
                  title="Copy enrollment code"
                >
                  <IoCopyOutline />
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-5">
              <h2 className="text-lg font-semibold text-gray-100">Status</h2>
              <div className="mt-3 flex items-center gap-3">
                <div
                  className={`h-3 w-3 rounded-full ${
                    classroom.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <span className="text-sm capitalize text-gray-300">{classroom.status || 'unknown'}</span>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                {classroom.status === 'active'
                  ? 'Students can access the classroom normally.'
                  : 'Classroom is currently not active for normal access.'}
              </p>
            </div>

            <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-5">
              <h2 className="text-lg font-semibold text-gray-100">Quick Actions</h2>
              <div className="mt-3 space-y-2">
                <button
                  onClick={() => navigate(`/classroom/${classroomId}/roster`)}
                  className="flex w-full items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 transition-colors hover:bg-emerald-500/20"
                >
                  <span className="inline-flex items-center gap-2"><IoPeopleOutline /> Manage Roster</span>
                  <IoCheckmarkCircleOutline />
                </button>
                <button
                  onClick={() => navigate(`/classroom/${classroomId}/dashboard`)}
                  className="flex w-full items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 transition-colors hover:bg-cyan-500/20"
                >
                  <span className="inline-flex items-center gap-2"><IoGridOutline /> View Dashboard</span>
                  <IoCheckmarkCircleOutline />
                </button>
              </div>

              <p className="mt-4 inline-flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                <IoWarningOutline className="mt-0.5" />
                Any setting changes affect all current and future classroom members.
              </p>
            </div>
          </div>
        </div>
      </div>
    </GlassDashboardShell>
  );
};

export default ClassroomSettings;
