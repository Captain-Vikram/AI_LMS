import React, { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import { Link } from 'react-router-dom';
import GlassDashboardShell from '../UI/GlassDashboardShell';
import ClassroomCard from './ClassroomCard';
import { FiPlus, FiLogIn, FiAlertTriangle, FiCheckCircle, FiLoader, FiGrid, FiList } from 'react-icons/fi';

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
      if (!silent) setLoading(true);
      setError(null);

      if (userRole === 'student') {
        const res = await apiClient.get(API_ENDPOINTS.CLASSROOM_MY_ENROLLMENTS);
        const list = Array.isArray(res?.data?.classrooms) ? res.data.classrooms : Array.isArray(res?.classrooms) ? res.classrooms : [];
        setEnrolledClassrooms(list);
        setClassrooms({ as_teacher: [], as_student: [] });
      } else {
        const res = await apiClient.get(API_ENDPOINTS.CLASSROOM_LIST);
        const payload = res?.data || res || {};
        setClassrooms({
          as_teacher: Array.isArray(payload.as_teacher) ? payload.as_teacher : [],
          as_student: Array.isArray(payload.as_student) ? payload.as_student : [],
        });
        setEnrolledClassrooms([]);
      }
    } catch (e) {
      setError(e.message || 'Failed to load classrooms');
    } finally {
      if (!silent) setLoading(false);
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
  const studentHasClasses = enrolledClassrooms.length > 0;
  const canBootstrap = isEducator && teacherCount === 0;

  const Header = () => (
    <div className="rounded-2xl p-4 sm:p-6 bg-gradient-to-br from-gray-900/80 via-slate-900/70 to-gray-800/80 border border-gray-700/60 shadow-xl backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-3">
            <FiGrid />
            {userRole === 'student' ? 'My Classes' : 'Classroom Workspace'}
          </h2>
          <p className="text-gray-400 mt-2 text-sm sm:text-base">
            {userRole === 'student'
              ? 'Your enrolled classes at a glance.'
              : 'Manage teaching spaces and student cohorts.'}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 mt-4 sm:mt-0">
          {isEducator && (
            <Link to="/classroom/create" className="flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg transition-colors font-semibold text-sm">
              <FiPlus /> Create
            </Link>
          )}
          { (isEducator || (userRole === 'student' && studentHasClasses)) && (
            <Link to="/classroom/join" className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg transition-colors font-semibold text-sm">
              <FiLogIn /> Join
            </Link>
          )}
        </div>
      </div>
      {userRole !== 'student' && (
        <div className="mt-5 flex gap-2 sm:gap-4 text-xs sm:text-sm">
          <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">Teaching: {teacherCount}</span>
          <span className="px-3 py-1 sm:px-4 sm:py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">Enrolled: {enrolledCount}</span>
        </div>
      )}
      {bootstrapMessage && (
        <div className="mt-4 text-sm rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-200 px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-3">
          <FiCheckCircle /> {bootstrapMessage}
        </div>
      )}
    </div>
  );

  const Section = ({ title, children }) => (
    <div>
      <h3 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2"><FiList /> {title}</h3>
      {children}
    </div>
  );

  if (error) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <div className="rounded-xl border border-red-700/50 bg-red-900/30 text-red-100 px-5 py-4 flex items-center gap-3">
          <FiAlertTriangle /> {error}
        </div>
      </GlassDashboardShell>
    );
  }

  if (loading) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <div className="p-5 text-gray-300 flex items-center gap-3">
          <FiLoader className="animate-spin" /> Loading classrooms...
        </div>
      </GlassDashboardShell>
    );
  }

  return (
    <GlassDashboardShell contentClassName="max-w-7xl">
      <div className="space-y-8">
        <Header />

        {userRole === 'student' ? (
          studentHasClasses ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledClassrooms.map((c) => <ClassroomCard key={c.classroom_id} classroom={c} role="student" />)}
            </div>
          ) : (
            <div className="text-center rounded-2xl border-2 border-dashed border-gray-700 bg-gray-900/50 p-12">
              <h3 className="text-2xl font-bold text-white mb-2">No Enrolled Classes Yet</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">Join a class using an enrollment code to unlock your student dashboard and start learning.</p>
              <Link to="/classroom/join" className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg text-base font-semibold">
                <FiLogIn /> Join with Code
              </Link>
            </div>
          )
        ) : (
          <div className="space-y-8">
            <Section title="My Teaching Spaces">
              {classrooms.as_teacher.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {classrooms.as_teacher.map((c) => <ClassroomCard key={c._id} classroom={c} role="teacher" />)}
                </div>
              ) : (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
                  <h4 className="text-xl text-amber-200 font-semibold">No Teaching Classes Found</h4>
                  <p className="text-amber-100/80 text-sm mt-2 mb-5 max-w-lg mx-auto">
                    Create your first classroom or generate a demo to explore teacher features like roster management, announcements, and analytics.
                  </p>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Link to="/classroom/create" className="bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold">Create Classroom</Link>
                    {canBootstrap && (
                      <button
                        onClick={handleBootstrapDemo}
                        disabled={bootstrappingDemo}
                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-sm font-semibold"
                      >
                        {bootstrappingDemo ? 'Preparing Demo...' : 'Generate Demo Class'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Section>

            <Section title="My Enrolled Classes">
              {classrooms.as_student.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {classrooms.as_student.map((c) => <ClassroomCard key={c._id} classroom={c} role="student" />)}
                </div>
              ) : (
                <p className="text-gray-400 italic px-4">No enrolled classes. Join another teacher's class with a code if you're co-learning.</p>
              )}
            </Section>
          </div>
        )}
      </div>
    </GlassDashboardShell>
  );
};

export default ClassroomList;
