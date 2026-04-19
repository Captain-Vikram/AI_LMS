import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { IoArrowForwardOutline, IoCopyOutline, IoGridOutline, IoPeopleOutline, IoSettingsOutline, IoSparklesOutline } from 'react-icons/io5';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import GlassDashboardShell from '../UI/GlassDashboardShell';
import { canManageClassroom } from '../../utils/classroomRoles';

const ClassroomPage = () => {
  const { id } = useParams();
  const [classroom, setClassroom] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const navigate = useNavigate();
  const userRole = (localStorage.getItem('userRole') || 'student').toLowerCase();
  const canManage = canManageClassroom(userRole);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const res = await apiClient.get(`${API_ENDPOINTS.CLASSROOM_GET}${id}`);
        if (!mounted) return;
        setClassroom(res?.data || res);
      } catch (e) {
        setError(e.message || 'Failed to load classroom');
      }
    };
    fetch();
    return () => (mounted = false);
  }, [id]);

  const enterClassroom = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post(`${API_ENDPOINTS.AUTH_SET_ACTIVE_CLASSROOM}${id}`);
      const token = res.access_token || res.token;
      if (token) {
        localStorage.setItem('token', token);
        localStorage.setItem('isLoggedIn', 'true');
      }
      navigate(`/classroom/${id}/dashboard`);
    } catch (e) {
      setError(e.message || 'Failed to enter classroom');
    } finally {
      setLoading(false);
    }
  };

  const copyEnrollmentCode = async () => {
    const code = classroom?.enrollment_code || '';
    if (!code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setCopyMessage('Enrollment code copied');
    } catch {
      setCopyMessage('Unable to copy code automatically');
    }
  };

  if (error) {
    return (
      <GlassDashboardShell contentClassName="max-w-4xl">
        <div className="rounded-xl border border-red-700/50 bg-red-900/30 px-4 py-3 text-red-100">
          {error}
        </div>
      </GlassDashboardShell>
    );
  }

  if (!classroom) {
    return (
      <GlassDashboardShell contentClassName="max-w-4xl">
        <div className="p-4 text-gray-300">Loading classroom details...</div>
      </GlassDashboardShell>
    );
  }

  return (
    <GlassDashboardShell contentClassName="max-w-6xl">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-700/70 bg-gradient-to-r from-slate-900 via-gray-900 to-slate-800 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-300">
                {canManage ? 'Teacher and Admin Workspace' : 'Student Classroom'}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-gray-100">{classroom.name}</h1>
              <p className="mt-2 text-sm text-gray-300">
                {classroom.subject || 'General'} {classroom.grade_level ? `• Grade ${classroom.grade_level}` : ''}
              </p>
            </div>

            <button
              onClick={enterClassroom}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
            >
              {loading ? 'Entering Workspace...' : 'Enter Classroom'}
              {!loading && <IoArrowForwardOutline />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8 rounded-xl border border-gray-700 bg-gray-900/50 p-6">
            <h2 className="text-lg font-semibold text-gray-100">Classroom Overview</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Subject</p>
                <p className="mt-1 text-sm text-gray-200">{classroom.subject || 'Not set'}</p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">Grade Level</p>
                <p className="mt-1 text-sm text-gray-200">{classroom.grade_level || 'Not set'}</p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-800/60 p-4 sm:col-span-2">
                <p className="text-xs uppercase tracking-wide text-gray-400">Description</p>
                <p className="mt-1 text-sm text-gray-300">
                  {classroom.description || 'No classroom description has been added yet.'}
                </p>
              </div>
            </div>
          </div>

          <aside className="xl:col-span-4 space-y-4">
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
              <p className="text-sm font-semibold text-blue-200">Enrollment Code</p>
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="text"
                  value={classroom.enrollment_code || 'Not available'}
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
              {copyMessage && <p className="mt-2 text-xs text-blue-200">{copyMessage}</p>}
            </div>

            <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-5">
              <p className="text-sm font-semibold text-gray-100">Quick Navigation</p>
              <div className="mt-3 space-y-2 text-sm">
                <button
                  onClick={() => navigate(`/classroom/${id}/dashboard`)}
                  className="flex w-full items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-cyan-200 transition-colors hover:bg-cyan-500/20"
                >
                  <span className="inline-flex items-center gap-2"><IoGridOutline /> Dashboard</span>
                  <IoArrowForwardOutline />
                </button>
                {canManage && (
                  <>
                    <button
                      onClick={() => navigate(`/classroom/${id}/resources`)}
                      className="flex w-full items-center justify-between rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-purple-200 transition-colors hover:bg-purple-500/20"
                    >
                      <span className="inline-flex items-center gap-2"><IoSparklesOutline /> Resources</span>
                      <IoArrowForwardOutline />
                    </button>
                    <button
                      onClick={() => navigate(`/classroom/${id}/roster`)}
                      className="flex w-full items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-200 transition-colors hover:bg-emerald-500/20"
                    >
                      <span className="inline-flex items-center gap-2"><IoPeopleOutline /> Roster</span>
                      <IoArrowForwardOutline />
                    </button>
                    <button
                      onClick={() => navigate(`/classroom/${id}/settings`)}
                      className="flex w-full items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-200 transition-colors hover:bg-amber-500/20"
                    >
                      <span className="inline-flex items-center gap-2"><IoSettingsOutline /> Settings</span>
                      <IoArrowForwardOutline />
                    </button>
                  </>
                )}
                {!canManage && (
                  <button
                    onClick={() => navigate(`/classroom/${id}/resources`)}
                    className="flex w-full items-center justify-between rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-purple-200 transition-colors hover:bg-purple-500/20"
                  >
                    <span className="inline-flex items-center gap-2"><IoSparklesOutline /> Resources</span>
                    <IoArrowForwardOutline />
                  </button>
                )}
              </div>
            </div>
          </aside>
        </div>

        <div>
          <Link
            to="/classrooms"
            className="text-sm text-gray-400 transition-colors hover:text-gray-200"
          >
            Back to all classrooms
          </Link>
        </div>
      </div>
    </GlassDashboardShell>
  );
};

export default ClassroomPage;
