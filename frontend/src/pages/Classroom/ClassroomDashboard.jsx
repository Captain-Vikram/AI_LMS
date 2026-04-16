import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useClassroomDashboard,
  useClassroomAnalytics,
  useAnnouncements,
  useLearningModules,
} from '../../hooks/useClassroom';
import { LoadingState, ErrorState, ClassroomStats } from '../../components/Classroom/DashboardCard';
import { AnnouncementFeed, AnnouncementCreate } from '../../components/Classroom/AnnouncementFeed';
import { PendingAssignments, SubmissionList } from '../../components/Classroom/PendingAssignments';
import { ModuleList, LearningModuleProgress } from '../../components/Classroom/ModuleList';
import GlassDashboardShell from '../../components/UI/GlassDashboardShell';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import {
  IoBarChartOutline,
  IoBookOutline,
  IoCheckmarkCircleOutline,
  IoFlameOutline,
  IoGridOutline,
  IoRocketOutline,
  IoSparklesOutline,
  IoTimeOutline,
  IoArrowForwardOutline,
  IoAlertCircleOutline,
} from 'react-icons/io5';

const clampPercent = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(numeric)));
};

const parseResponseData = (response) => {
  if (response && typeof response === 'object') {
    if (response.status === 'success' && response.data) {
      return response.data;
    }
    if ('data' in response && response.data && typeof response.data === 'object') {
      return response.data;
    }
  }
  return response;
};

const normalizeEnrollmentList = (response) => {
  const raw = Array.isArray(response?.data?.classrooms)
    ? response.data.classrooms
    : Array.isArray(response?.classrooms)
      ? response.classrooms
      : [];

  return raw
    .map((room) => ({
      classroom_id: String(room?.classroom_id || room?._id || room?.id || ''),
      name: room?.name || room?.classroom_name || 'Classroom',
      subject: room?.subject || room?.classroom_subject || 'Subject',
      grade_level: room?.grade_level || room?.classroom_grade || '',
    }))
    .filter((room) => room.classroom_id);
};

const ClassroomDashboard = () => {
  const { id: classroomId } = useParams();
  const navigate = useNavigate();
  const sessionRole = (localStorage.getItem('userRole') || 'student').toLowerCase();
  const normalizedSessionRole = sessionRole === 'admin' ? 'teacher' : sessionRole;
  const [userRole, setUserRole] = useState(
    normalizedSessionRole === 'teacher' || normalizedSessionRole === 'student'
      ? normalizedSessionRole
      : 'student'
  );
  const [studentClassrooms, setStudentClassrooms] = useState([]);
  const [studentClassProgress, setStudentClassProgress] = useState({});
  const [classContextLoading, setClassContextLoading] = useState(false);
  const [classContextError, setClassContextError] = useState('');

  // Fetch dashboard data
  const { dashboard, overview, loading: dashboardLoading, error: dashboardError } =
    useClassroomDashboard(classroomId);

  // Fetch analytics
  const { analytics, studentProgress, fetchMyProgress } = useClassroomAnalytics(classroomId);

  // Fetch announcements
  const { 
    announcements, 
    loading: announcementsLoading,
    createAnnouncement,
    markAsViewed,
    deleteAnnouncement,
  } = useAnnouncements(classroomId);

  // Fetch modules
  const { modules, loading: modulesLoading } = useLearningModules(classroomId);

  useEffect(() => {
    if (!dashboard) {
      return;
    }

    if (normalizedSessionRole === 'teacher' || normalizedSessionRole === 'student') {
      setUserRole(normalizedSessionRole);
      return;
    }

    setUserRole('student_count' in dashboard ? 'teacher' : 'student');
  }, [dashboard, normalizedSessionRole]);

  useEffect(() => {
    if (dashboard && userRole === 'student') {
      fetchMyProgress();
    }
  }, [dashboard, userRole, fetchMyProgress]);

  useEffect(() => {
    let isMounted = true;

    const loadStudentClassContext = async () => {
      if (!dashboard || userRole !== 'student') {
        return;
      }

      setClassContextLoading(true);
      setClassContextError('');

      try {
        const enrollmentResponse = await apiClient.get(API_ENDPOINTS.CLASSROOM_MY_ENROLLMENTS);
        const enrolledClassrooms = normalizeEnrollmentList(enrollmentResponse);

        if (!isMounted) {
          return;
        }

        setStudentClassrooms(enrolledClassrooms);

        if (enrolledClassrooms.length === 0) {
          setStudentClassProgress({});
          return;
        }

        const progressEntries = await Promise.all(
          enrolledClassrooms.map(async (room) => {
            try {
              const response = await apiClient.get(
                `/api/analytics/classroom/${room.classroom_id}/my-progress`
              );
              const progress = parseResponseData(response) || {};

              const averageScore = clampPercent(progress.average_score_percentage || 0);
              const earnedPoints = Number(progress.total_earned_points || 0);
              const totalPossiblePoints = Number(progress.total_possible_points || 0);
              const pointsRate =
                totalPossiblePoints > 0
                  ? clampPercent((earnedPoints / totalPossiblePoints) * 100)
                  : 0;

              const moduleProgress = Array.isArray(progress.module_progress)
                ? progress.module_progress
                : [];
              const moduleAverage = moduleProgress.length
                ? clampPercent(
                    moduleProgress.reduce(
                      (sum, module) => sum + Number(module?.completion_percentage || 0),
                      0
                    ) / moduleProgress.length
                  )
                : 0;

              return [
                room.classroom_id,
                {
                  averageScore,
                  assignmentsCompleted: Number(progress.assignments_completed || 0),
                  earnedPoints,
                  totalPossiblePoints,
                  pointsRate,
                  moduleAverage,
                  overallProgress: clampPercent(
                    averageScore * 0.5 + pointsRate * 0.3 + moduleAverage * 0.2
                  ),
                },
              ];
            } catch {
              return [
                room.classroom_id,
                {
                  averageScore: 0,
                  assignmentsCompleted: 0,
                  earnedPoints: 0,
                  totalPossiblePoints: 0,
                  pointsRate: 0,
                  moduleAverage: 0,
                  overallProgress: 0,
                },
              ];
            }
          })
        );

        if (!isMounted) {
          return;
        }

        setStudentClassProgress(Object.fromEntries(progressEntries));
      } catch (err) {
        if (!isMounted) {
          return;
        }

        setClassContextError(err?.message || 'Failed to load classroom context');
        setStudentClassrooms([]);
        setStudentClassProgress({});
      } finally {
        if (isMounted) {
          setClassContextLoading(false);
        }
      }
    };

    loadStudentClassContext();

    return () => {
      isMounted = false;
    };
  }, [dashboard, userRole, classroomId]);

  if (dashboardLoading) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <LoadingState message="Loading classroom dashboard..." />
      </GlassDashboardShell>
    );
  }

  if (dashboardError) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <ErrorState
          message={dashboardError}
          onRetry={() => window.location.reload()}
        />
      </GlassDashboardShell>
    );
  }

  if (!dashboard) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <ErrorState message="Classroom not found" />
      </GlassDashboardShell>
    );
  }

  // Render teacher dashboard
  if (userRole === 'teacher') {
    const teacherDashboard = dashboard;
    const totalStudents = teacherDashboard.student_count || 0;
    const totalAnnouncements = announcements?.length || 0;
    const totalSubmissions = teacherDashboard.recent_submissions?.length || 0;
    const totalAssignments = overview?.assignment_count || 0;
    const moduleCount = overview?.module_count || 0;

    const totalViews = (announcements || []).reduce(
      (sum, ann) => sum + Number(ann?.views || 0),
      0
    );
    const engagementDenominator = Math.max(1, totalStudents * Math.max(1, totalAnnouncements));
    const engagementRate = Math.min(100, Math.round((totalViews / engagementDenominator) * 100));

    const submissionVelocity = totalStudents
      ? Math.min(100, Math.round((totalSubmissions / totalStudents) * 100))
      : 0;

    const rawCompletionRate = Number(analytics?.assignment_completion_rate || 0);
    const completionRate = Number.isFinite(rawCompletionRate)
      ? Math.max(0, Math.min(100, Math.round(rawCompletionRate)))
      : 0;

    const actionItems = [
      {
        icon: IoRocketOutline,
        label: 'Publish a kickoff announcement',
        done: totalAnnouncements > 0,
      },
      {
        icon: IoBookOutline,
        label: 'Create your first assignment set',
        done: totalAssignments > 0,
      },
      {
        icon: IoGridOutline,
        label: 'Add at least one learning module',
        done: moduleCount > 0,
      },
      {
        icon: IoTimeOutline,
        label: 'Collect first student submissions',
        done: totalSubmissions > 0,
      },
    ];

    const teacherResourceSummary = teacherDashboard?.resource_summary || {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    };

    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-700/70 bg-gradient-to-r from-slate-900 via-gray-900 to-slate-800 p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-300 mb-2">
                {sessionRole === 'admin' ? 'Admin Command Center' : 'Teacher Command Center'}
              </p>
              <h1 className="text-3xl font-bold text-gray-100">
                {teacherDashboard.classroom_name}
              </h1>
              <p className="text-gray-400 mt-2">
                {teacherDashboard.classroom_subject} • {teacherDashboard.classroom_grade}
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300">{totalStudents} learners</span>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300">{totalAssignments} assignments</span>
                <span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300">{moduleCount} modules</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
              <button
                onClick={() => navigate(`/classroom/${classroomId}/roster`)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                Open Roster
              </button>
              <button
                onClick={() => navigate(`/classroom/${classroomId}/resources`)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-500 hover:bg-purple-600 text-white transition-colors"
              >
                Open Resource Hub
              </button>
              <button
                onClick={() => navigate(`/classroom/${classroomId}/modules`)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
              >
                Open Modules
              </button>
              <button
                onClick={() => navigate(`/classroom/${classroomId}/settings`)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                Settings
              </button>
            </div>
          </div>
        </div>

        <ClassroomStats
          studentCount={totalStudents}
          assignmentCount={totalAssignments}
          moduleCount={moduleCount}
          completionRate={completionRate}
        />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <div className="xl:col-span-8 space-y-6">
            <div className="p-6 rounded-xl bg-gray-800/60 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-100">Announcement Studio</h2>
                <span className="text-xs px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-300">{totalAnnouncements} live</span>
              </div>
              <AnnouncementCreate
                onSubmit={createAnnouncement}
                isLoading={announcementsLoading}
              />
              <AnnouncementFeed
                announcements={announcements}
                onMarkViewed={markAsViewed}
                onDelete={deleteAnnouncement}
                isTeacher={true}
                loading={announcementsLoading}
              />
            </div>

            <div className="p-6 rounded-xl bg-gray-800/60 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-100">Submission Flow</h2>
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">{totalSubmissions} recent</span>
              </div>

              {teacherDashboard.recent_submissions?.length > 0 ? (
                <SubmissionList
                  submissions={teacherDashboard.recent_submissions}
                  loading={false}
                />
              ) : (
                <div className="rounded-lg border border-dashed border-gray-600 p-5 text-gray-400">
                  <p className="font-medium text-gray-200">No submissions yet</p>
                  <p className="text-sm mt-1">Once students submit, this panel becomes your grading launchpad.</p>
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
            <div className="p-6 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30">
              <h3 className="font-semibold text-gray-100 mb-4">Class Pulse</h3>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                    <span className="flex items-center gap-1"><IoFlameOutline /> Engagement</span>
                    <span>{engagementRate}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${engagementRate}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                    <span className="flex items-center gap-1"><IoBarChartOutline /> Submission Velocity</span>
                    <span>{submissionVelocity}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-emerald-500 to-green-500" style={{ width: `${submissionVelocity}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                    <span className="flex items-center gap-1"><IoCheckmarkCircleOutline /> Assignment Completion</span>
                    <span>{completionRate}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${completionRate}%` }} />
                  </div>
                </div>

                {analytics && (
                  <div className="rounded-lg bg-gray-900/50 border border-gray-700 p-3">
                    <p className="text-xs text-gray-400">Average Class Score</p>
                    <p className="text-2xl font-bold text-cyan-300">{Number(analytics.average_class_score || 0).toFixed(1)}%</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 rounded-xl bg-gray-800/60 border border-gray-700">
              <h3 className="font-semibold text-gray-100 mb-4">Action Queue</h3>
              <div className="space-y-3">
                {actionItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className={`mt-0.5 ${item.done ? 'text-emerald-400' : 'text-amber-400'}`}>
                        <Icon />
                      </div>
                      <div>
                        <p className={`text-sm ${item.done ? 'text-gray-200' : 'text-gray-300'}`}>{item.label}</p>
                        <p className="text-xs text-gray-500">{item.done ? 'Completed' : 'Recommended next step'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 rounded-xl bg-gray-800/60 border border-gray-700">
              <h3 className="font-semibold text-gray-100 mb-4">Resource Hub</h3>

              <p className="text-sm text-gray-400 mb-4">
                Review and approve resources in the dedicated Resource Hub (same student resource pattern).
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                <div className="rounded-md border border-gray-700 bg-gray-900/50 px-2.5 py-2 text-gray-300">
                  Total: <span className="text-cyan-300">{Number(teacherResourceSummary.total || 0)}</span>
                </div>
                <div className="rounded-md border border-gray-700 bg-gray-900/50 px-2.5 py-2 text-gray-300">
                  Pending: <span className="text-amber-300">{Number(teacherResourceSummary.pending || 0)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/classroom/${classroomId}/resources`)}
                className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                Open Resource Hub
                <IoArrowForwardOutline />
              </button>
            </div>

            <div className="p-6 rounded-xl bg-gray-800/60 border border-gray-700">
              <h3 className="font-semibold text-gray-100 mb-4">Upcoming Assignments</h3>
              {teacherDashboard.pending_assignments?.length > 0 ? (
                <PendingAssignments
                  assignments={teacherDashboard.pending_assignments}
                  loading={false}
                />
              ) : (
                <div className="text-sm text-gray-400 flex items-start gap-2">
                  <IoAlertCircleOutline className="mt-0.5 text-amber-400" />
                  <span>No upcoming assignments. Create one to activate student workflows.</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-gray-800/60 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-100">Module Snapshot</h3>
            <button
              onClick={() => navigate(`/classroom/${classroomId}/modules`)}
              className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
            >
              Open full modules <IoArrowForwardOutline />
            </button>
          </div>
          <ModuleList modules={modules.slice(0, 3)} loading={modulesLoading} />
        </div>
      </div>
      </GlassDashboardShell>
    );
  }

  // Render student dashboard
  const studentDashboard = dashboard;
  const studentResourceSummary = studentDashboard?.class_resource_summary || {
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
  };

  const currentProgress = studentProgress || {};
  const averageScore = clampPercent(currentProgress.average_score_percentage || 0);
  const assignmentsCompleted = Number(currentProgress.assignments_completed || 0);
  const earnedPoints = Number(currentProgress.total_earned_points || 0);
  const totalPossiblePoints = Number(currentProgress.total_possible_points || 0);
  const pointsAttainment =
    totalPossiblePoints > 0
      ? clampPercent((earnedPoints / totalPossiblePoints) * 100)
      : 0;

  const moduleProgressList = Array.isArray(currentProgress.module_progress)
    ? currentProgress.module_progress
    : [];
  const moduleCompletionAverage = moduleProgressList.length
    ? clampPercent(
        moduleProgressList.reduce(
          (sum, module) => sum + Number(module?.completion_percentage || 0),
          0
        ) / moduleProgressList.length
      )
    : 0;

  const classCoreProgress = clampPercent(
    averageScore * 0.45 + pointsAttainment * 0.35 + moduleCompletionAverage * 0.2
  );

  const classroomIndex = studentClassrooms.findIndex(
    (room) => room.classroom_id === classroomId
  );
  const totalClassrooms = studentClassrooms.length || 1;
  const roomsForDisplay =
    studentClassrooms.length > 0
      ? studentClassrooms
      : [
          {
            classroom_id: classroomId,
            name: studentDashboard.classroom_name,
            subject: studentDashboard.classroom_subject,
            grade_level: '',
          },
        ];

  const modulesForProgress =
    Array.isArray(studentDashboard.modules) && studentDashboard.modules.length > 0
      ? studentDashboard.modules
      : modules;

  return (
    <GlassDashboardShell contentClassName="max-w-7xl">
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-700/70 bg-gradient-to-r from-slate-900 via-gray-900 to-slate-800 p-6 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-300 mb-2">
              Student Learning Command Center
            </p>
            <h1 className="text-3xl font-bold text-gray-100">
              {studentDashboard.classroom_name}
            </h1>
            <p className="text-gray-400 mt-2">
              {studentDashboard.classroom_subject} • Taught by {studentDashboard.teacher_name}
            </p>

            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300">
                Core progress: {classCoreProgress}%
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
                Avg score: {averageScore}%
              </span>
              <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-300">
                Class {classroomIndex >= 0 ? classroomIndex + 1 : 1} of {totalClassrooms}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
            <button
              onClick={() => navigate('/classrooms')}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-700 hover:bg-gray-600 text-white transition-colors"
            >
              All Classrooms
            </button>
            <button
              onClick={() => navigate(`/classroom/${classroomId}/resources`)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-purple-500 hover:bg-purple-600 text-white transition-colors"
            >
              Open Resource Hub
            </button>
            <button
              onClick={() => navigate(`/classroom/${classroomId}/modules`)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition-colors"
            >
              Open Modules
            </button>
          </div>
        </div>
      </div>

      <div className="p-5 rounded-xl bg-gray-800/60 border border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h2 className="text-lg font-semibold text-gray-100">My Classroom Network</h2>
          <p className="text-xs text-gray-400">
            Switch classes quickly while keeping each class progress accurate.
          </p>
        </div>

        {classContextError && (
          <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {classContextError}
          </div>
        )}

        {classContextLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 animate-pulse">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="h-24 rounded-lg bg-gray-700/70" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {roomsForDisplay.map((room) => {
              const isActive = room.classroom_id === classroomId;
              const roomProgress = studentClassProgress[room.classroom_id] || {
                averageScore: isActive ? averageScore : 0,
                assignmentsCompleted: isActive ? assignmentsCompleted : 0,
                moduleAverage: isActive ? moduleCompletionAverage : 0,
                overallProgress: isActive ? classCoreProgress : 0,
              };

              return (
                <button
                  key={room.classroom_id}
                  type="button"
                  onClick={() => navigate(`/classroom/${room.classroom_id}/dashboard`)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    isActive
                      ? 'border-cyan-500/60 bg-cyan-500/10'
                      : 'border-gray-700 bg-gray-900/50 hover:border-cyan-500/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-100">{room.name}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {room.subject} {room.grade_level ? `• ${room.grade_level}` : ''}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-cyan-300">
                      {roomProgress.overallProgress}%
                    </span>
                  </div>

                  <div className="mt-3 w-full h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className="h-1.5 bg-gradient-to-r from-cyan-500 to-blue-500"
                      style={{ width: `${roomProgress.overallProgress}%` }}
                    />
                  </div>

                  <p className="mt-2 text-[11px] text-gray-400">
                    Score {roomProgress.averageScore}% • Assignments {roomProgress.assignmentsCompleted} • Module {roomProgress.moduleAverage}%
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
          <p className="text-xs text-gray-400">Core Progress</p>
          <p className="text-xl font-semibold text-cyan-300">{classCoreProgress}%</p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
          <p className="text-xs text-gray-400">Average Score</p>
          <p className="text-xl font-semibold text-emerald-300">{averageScore}%</p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
          <p className="text-xs text-gray-400">Points Earned</p>
          <p className="text-xl font-semibold text-blue-300">{earnedPoints}/{totalPossiblePoints || 0}</p>
        </div>
        <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
          <p className="text-xs text-gray-400">Assignments Done</p>
          <p className="text-xl font-semibold text-purple-300">{assignmentsCompleted}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-lg bg-gray-800/50 border border-gray-700">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">
              My Assignments
            </h2>
            <PendingAssignments
              assignments={studentDashboard.pending_assignments}
              loading={false}
            />
          </div>

          <div className="p-6 rounded-lg bg-gray-800/50 border border-gray-700">
            <h2 className="text-xl font-semibold text-gray-100 mb-4">
              Class Announcements
            </h2>
            <AnnouncementFeed
              announcements={studentDashboard.announcements}
              onMarkViewed={markAsViewed}
              isTeacher={false}
              loading={announcementsLoading}
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-lg bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/30">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">Progress Graphs</h3>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                  <span className="flex items-center gap-1"><IoBarChartOutline /> Score Accuracy</span>
                  <span>{averageScore}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-emerald-500 to-green-500" style={{ width: `${averageScore}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                  <span className="flex items-center gap-1"><IoFlameOutline /> Points Attainment</span>
                  <span>{pointsAttainment}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-cyan-500 to-blue-500" style={{ width: `${pointsAttainment}%` }} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                  <span className="flex items-center gap-1"><IoCheckmarkCircleOutline /> Module Completion</span>
                  <span>{moduleCompletionAverage}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-700 overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${moduleCompletionAverage}%` }} />
                </div>
              </div>
            </div>

            {moduleProgressList.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700/70 space-y-2">
                <p className="text-xs text-gray-400">Module Completion Breakdown</p>
                {moduleProgressList.slice(0, 4).map((module) => (
                  <div key={module.module_id}>
                    <div className="flex items-center justify-between text-xs text-gray-300 mb-1">
                      <span className="truncate pr-2">{module.module_name}</span>
                      <span>{clampPercent(module.completion_percentage)}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className="h-1.5 bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                        style={{ width: `${clampPercent(module.completion_percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-6 rounded-lg bg-gray-800/50 border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">
              Curriculum Modules
            </h3>
            <LearningModuleProgress
              modules={modulesForProgress}
              studentProgress={currentProgress}
              loading={modulesLoading}
            />
          </div>

          <div className="p-6 rounded-xl bg-gray-800/60 border border-gray-700">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
                  <IoSparklesOutline className="text-cyan-300" />
                  AI Learning Resources
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  Browse class and personal resources from the dedicated Resource Hub.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/classroom/${classroomId}/resources`)}
                className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                Open Resource Hub
                <IoArrowForwardOutline />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-gray-200">
                <p className="text-gray-400">Total</p>
                <p className="text-lg font-semibold text-cyan-300">{studentResourceSummary.total || 0}</p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-gray-200">
                <p className="text-gray-400">Approved</p>
                <p className="text-lg font-semibold text-emerald-300">{studentResourceSummary.approved || 0}</p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-gray-200">
                <p className="text-gray-400">Pending</p>
                <p className="text-lg font-semibold text-amber-300">{studentResourceSummary.pending || 0}</p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-gray-200">
                <p className="text-gray-400">Rejected</p>
                <p className="text-lg font-semibold text-rose-300">{studentResourceSummary.rejected || 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {modules.length > 0 && (
        <div className="text-center pt-4">
          <button
            onClick={() => navigate(`/classroom/${classroomId}/modules`)}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            View Full Curriculum
          </button>
        </div>
      )}
    </div>
    </GlassDashboardShell>
  );
};

export default ClassroomDashboard;
