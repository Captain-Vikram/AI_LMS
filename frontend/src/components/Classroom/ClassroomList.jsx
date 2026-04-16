import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import { Link } from 'react-router-dom';
import GlassDashboardShell from '../UI/GlassDashboardShell';

const ClassroomList = () => {
  const [classrooms, setClassrooms] = useState({ as_teacher: [], as_student: [] });
  const [enrolledClassrooms, setEnrolledClassrooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bootstrappingDemo, setBootstrappingDemo] = useState(false);
  const [bootstrapMessage, setBootstrapMessage] = useState('');
  const userRole = (localStorage.getItem('userRole') || 'student').toLowerCase();
  const isEducator = userRole === 'teacher' || userRole === 'admin';

  const loadClassrooms = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);

      if (userRole === 'student') {
        const res = await apiClient.get(API_ENDPOINTS.CLASSROOM_MY_ENROLLMENTS);
        const list = Array.isArray(res?.data?.classrooms)
          ? res.data.classrooms
          : Array.isArray(res?.classrooms)
            ? res.classrooms
            : [];
        setEnrolledClassrooms(list);
        setClassrooms({ as_teacher: [], as_student: [] });
        return;
      }

      const res = await apiClient.get(API_ENDPOINTS.CLASSROOM_LIST);
      const payload = res?.data || res || {};
      setClassrooms({
        as_teacher: Array.isArray(payload.as_teacher) ? payload.as_teacher : [],
        as_student: Array.isArray(payload.as_student) ? payload.as_student : [],
      });
      setEnrolledClassrooms([]);
    } catch (e) {
      setError(e.message || 'Failed to load classrooms');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [userRole]);

  useEffect(() => {
    loadClassrooms(false);
  }, [loadClassrooms]);

  const handleBootstrapDemo = useCallback(async () => {
    setBootstrappingDemo(true);
    setBootstrapMessage('');
    try {
      const response = await apiClient.post(API_ENDPOINTS.CLASSROOM_BOOTSTRAP_DEMO, {});
      setBootstrapMessage(response?.message || 'Demo classroom created successfully.');
      await loadClassrooms(true);
    } catch (e) {
      setBootstrapMessage(e.message || 'Could not bootstrap demo classroom.');
    } finally {
      setBootstrappingDemo(false);
    }
  }, [loadClassrooms]);

  const teacherCount = useMemo(() => classrooms.as_teacher.length, [classrooms.as_teacher]);
  const enrolledCount = useMemo(() => classrooms.as_student.length, [classrooms.as_student]);
  const canBootstrap = isEducator && teacherCount === 0;

  if (error) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <div className="rounded-xl border border-red-700/50 bg-red-900/30 text-red-100 px-4 py-3">
          {error}
        </div>
      </GlassDashboardShell>
    );
  }

  if (loading) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <div className="p-4 text-gray-300">Loading classrooms...</div>
      </GlassDashboardShell>
    );
  }

  return (
    <GlassDashboardShell contentClassName="max-w-7xl">
      <div className="space-y-6">
        <div className="rounded-2xl p-6 bg-gradient-to-br from-gray-900 via-slate-900 to-gray-800 border border-gray-700/60 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">
          {userRole === 'student'
            ? 'My Enrolled Classes'
            : userRole === 'admin'
              ? 'Admin Classroom Workspace'
              : 'Teacher Classroom Workspace'}
            </h2>
            <p className="text-gray-400 mt-1">
              {userRole === 'student'
                ? 'Track your active classes and jump back into learning quickly.'
                : 'Manage teaching spaces, student cohorts, and classroom operations from one place.'}
            </p>
          </div>

          <div className="space-x-2">
            {isEducator && (
              <Link to="/classroom/create" className="bg-cyan-500 hover:bg-cyan-600 text-white px-3 py-1 rounded transition-colors">Create</Link>
            )}
            <Link to="/classroom/join" className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded transition-colors">Join by Code</Link>
          </div>
        </div>

        {userRole !== 'student' && (
          <div className="mt-4 flex gap-3 text-xs">
            <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300">Teaching: {teacherCount}</span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300">Enrolled: {enrolledCount}</span>
          </div>
        )}

        {bootstrapMessage && (
          <div className="mt-4 text-sm rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 px-3 py-2">
            {bootstrapMessage}
          </div>
        )}
      </div>

      {userRole === 'student' ? (
        enrolledClassrooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrolledClassrooms.map((c) => (
              <div key={c.classroom_id} className="p-4 bg-gray-800 rounded-lg border border-gray-700/60 hover:border-blue-500/50 transition-colors">
                <h3 className="text-lg font-bold text-white">{c.name}</h3>
                <p className="text-gray-400">{c.subject} {c.grade_level ? `• ${c.grade_level}` : ''}</p>
                <Link to={`/classroom/${c.classroom_id}`} className="mt-2 inline-block text-blue-400">Open</Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-6 text-gray-300">
            <p className="text-lg font-semibold text-white mb-1">No enrolled classes yet</p>
            <p className="text-gray-400 mb-4">Join a class using an enrollment code to unlock your student dashboard.</p>
            <Link to="/classroom/join" className="inline-block bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Join with Code</Link>
          </div>
        )
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Teaching</h3>
            {classrooms.as_teacher.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classrooms.as_teacher.map((c) => (
                  <div key={c._id} className="p-4 bg-gray-800 rounded-lg border border-gray-700/60 hover:border-blue-500/50 transition-colors">
                    <h4 className="text-lg font-bold text-white">{c.name}</h4>
                    <p className="text-gray-400">{c.subject}</p>
                    <Link to={`/classroom/${c._id}`} className="mt-2 inline-block text-blue-400">Open</Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
                <p className="text-amber-200 font-semibold">No teaching classes found.</p>
                <p className="text-amber-100/80 text-sm mt-1 mb-3">
                  Start with a demo classroom to preview roster, announcements, and teacher dashboard blocks instantly.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link to="/classroom/create" className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded text-sm">Create Classroom</Link>
                  {canBootstrap && (
                    <button
                      onClick={handleBootstrapDemo}
                      disabled={bootstrappingDemo}
                      className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white px-3 py-1.5 rounded text-sm"
                    >
                      {bootstrappingDemo ? 'Preparing Demo...' : 'Generate Demo Class'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Enrolled</h3>
            {classrooms.as_student.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classrooms.as_student.map((c) => (
                  <div key={c._id} className="p-4 bg-gray-800 rounded-lg border border-gray-700/60 hover:border-emerald-500/50 transition-colors">
                    <h4 className="text-lg font-bold text-white">{c.name}</h4>
                    <p className="text-gray-400">{c.subject}</p>
                    <Link to={`/classroom/${c._id}`} className="mt-2 inline-block text-blue-400">Open</Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400">No enrolled classes found. Join with a code if you are co-learning in another teacher's class.</p>
            )}
          </div>
        </div>
      )}
    </div>
    </GlassDashboardShell>
  );
};

export default ClassroomList;
