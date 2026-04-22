import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useClassroomDashboard,
  useClassroomAnalytics,
  useAnnouncements,
  useLearningModules,
} from '../../hooks/useClassroom';
import { LoadingState, ErrorState } from '../../components/Classroom/DashboardCard';
import { AnnouncementFeed, AnnouncementCreate } from '../../components/Classroom/AnnouncementFeed';
import { PendingAssignments, SubmissionList } from '../../components/Classroom/PendingAssignments';
import { ModuleList } from '../../components/Classroom/ModuleList';
import ModuleQuestionHeatmap from '../../components/Classroom/ModuleQuestionHeatmap';
import ActivityFeed from '../../components/Classroom/ActivityFeed';
import AppBackButton from '../../components/UI/AppBackButton';
import GlassDashboardShell from '../../components/UI/GlassDashboardShell';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import { normalizeClassroomRole } from '../../utils/classroomRoles';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  IoBarChartOutline,
  IoCheckmarkCircleOutline,
  IoFlameOutline,
  IoSchoolOutline,
  IoPeopleOutline,
  IoLayersOutline,
  IoNotificationsOutline,
} from 'react-icons/io5';

/* ─── Utilities ──────────────────────────────────────────────────── */
const clamp = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0; };
const parseData = (r) => { if (r && typeof r === 'object') { if (r.status === 'success' && r.data) return r.data; if ('data' in r && r.data) return r.data; } return r; };
const normalizeEnrollments = (res) => {
  const raw = Array.isArray(res?.data?.classrooms) ? res.data.classrooms : Array.isArray(res?.classrooms) ? res.classrooms : [];
  return raw.map((r) => ({ classroom_id: String(r?.classroom_id || r?._id || r?.id || ''), name: r?.name || r?.classroom_name || 'Classroom', subject: r?.subject || r?.classroom_subject || 'Subject', grade_level: r?.grade_level || r?.classroom_grade || '' })).filter((r) => r.classroom_id);
};
const shortLabel = (label, max = 18) => {
  const text = String(label || '').trim();
  if (!text) return 'Module';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const buildScoreDistributionData = (studentAnalytics = []) => {
  const students = Array.isArray(studentAnalytics) ? studentAnalytics : [];
  const bands = [
    { name: '85-100', min: 85, max: 101, color: '#34d399' },
    { name: '70-84', min: 70, max: 85, color: '#22d3ee' },
    { name: '50-69', min: 50, max: 70, color: '#fbbf24' },
    { name: '0-49', min: 0, max: 50, color: '#f87171' },
  ];

  return bands.map((band) => ({
    ...band,
    value: students.filter((student) => {
      const score = Number(student?.average_score_percentage || 0);
      return score >= band.min && score < band.max;
    }).length,
  }));
};
const buildModuleCompletionData = (studentAnalytics = []) => {
  const aggregate = new Map();

  (Array.isArray(studentAnalytics) ? studentAnalytics : []).forEach((student) => {
    (Array.isArray(student?.module_progress) ? student.module_progress : []).forEach((module) => {
      const key = String(module?.module_id || module?.module_name || 'module').trim();
      const name = String(module?.module_name || 'Module').trim();
      const completion = clamp(module?.completion_percentage || 0);

      if (!aggregate.has(key)) {
        aggregate.set(key, { module: name, total: 0, count: 0 });
      }

      const entry = aggregate.get(key);
      entry.total += completion;
      entry.count += 1;
    });
  });

  return Array.from(aggregate.values())
    .map((entry) => ({
      module: shortLabel(entry.module),
      completion: Math.round(entry.total / Math.max(entry.count, 1)),
    }))
    .sort((a, b) => a.module.localeCompare(b.module));
};
const hasMeaningfulModuleProgress = (module = {}) => {
  const completion = Number(module?.completion_percentage || 0);
  const totalAssessments = Number(module?.total_assessments || 0);
  const completedAssessments = Number(module?.completed_assessments || 0);
  const totalResources = Number(module?.total_resources || 0);
  const viewedResources = Number(module?.viewed_resources || 0);
  const attemptedResources = Number(module?.attempted_resources || 0);
  const passedResources = Number(module?.passed_resources || 0);

  return (
    completion > 0 ||
    totalAssessments > 0 ||
    completedAssessments > 0 ||
    totalResources > 0 ||
    viewedResources > 0 ||
    attemptedResources > 0 ||
    passedResources > 0
  );
};

/* ─── Atoms ──────────────────────────────────────────────────────── */

/**
 * Pill button used INSIDE the hero action bar.
 * Lives inline — wraps on narrow screens, stays on one row on wide screens.
 */
const ActionPill = ({ label, onClick, variant = 'ghost', badge }) => {
  const styles = {
    ghost:   'bg-white/[0.07] hover:bg-white/[0.13] text-slate-200 border border-white/10',
    blue:    'bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 shadow-blue-900/40 shadow-md',
    violet:  'bg-violet-600 hover:bg-violet-500 text-white border border-violet-500 shadow-violet-900/40 shadow-md',
    emerald: 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 shadow-emerald-900/40 shadow-md',
    amber:   'bg-amber-500 hover:bg-amber-400 text-white border border-amber-400 shadow-amber-900/40 shadow-md',
  };
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold tracking-wide transition-all duration-150 active:scale-[0.96] ${styles[variant]}`}
    >
      {label}
      {badge != null && badge > 0 && (
        <span className="rounded-full bg-black/30 px-1.5 text-[10px] font-extrabold">{badge}</span>
      )}
    </button>
  );
};

const StatChip = ({ icon: Icon, label, color }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${color}`}>
    <Icon className="text-[11px]" />{label}
  </span>
);

const Panel = ({ children, className = '' }) => (
  <div className={`rounded-2xl border border-white/[0.07] bg-[#0f1623]/90 p-5 ${className}`}>
    {children}
  </div>
);

const SectionLabel = ({ children, right }) => (
  <div className="mb-4 flex items-center justify-between gap-2">
    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">{children}</span>
    {right && <div className="text-[10px] text-slate-600">{right}</div>}
  </div>
);

const Kpi = ({ label, value, sub, accent }) => (
  <div className={`flex flex-col gap-1 rounded-xl border p-4 transition-colors ${accent}`}>
    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">{label}</span>
    <span className="text-2xl font-extrabold tabular-nums text-white">{value}</span>
    {sub && <span className="text-[10px] text-slate-700">{sub}</span>}
  </div>
);

const Bar = ({ label, icon: Icon, pct, from, to }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">{Icon && <Icon />}{label}</span>
      <span className="text-[11px] font-bold tabular-nums text-white">{pct}%</span>
    </div>
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
      <div className={`h-full rounded-full bg-gradient-to-r ${from} ${to} transition-[width] duration-700`} style={{ width:`${pct}%` }} />
    </div>
  </div>
);

/* ─── Main ───────────────────────────────────────────────────────── */
const ClassroomDashboard = () => {
  const { id: classroomId } = useParams();
  const navigate = useNavigate();
  const sessionRole = localStorage.getItem('userRole') || 'student';
  const normalizedSessionRole = normalizeClassroomRole(sessionRole);
  const [userRole, setUserRole] = useState(
    normalizedSessionRole === 'teacher' || normalizedSessionRole === 'admin'
      ? 'teacher'
      : 'student'
  );
  const [studentClassrooms, setStudentClassrooms] = useState([]);
  const [studentClassProgress, setStudentClassProgress] = useState({});
  const [classContextLoading, setClassContextLoading] = useState(false);
  const [classContextError, setClassContextError] = useState('');
  const [pendingGradingCount, setPendingGradingCount] = useState(0);
  const [studentActivityStats, setStudentActivityStats] = useState({
    aiQuestionsAsked: 0,
    quizEvents: 0,
  });
  const [teacherQuestionHeatmap, setTeacherQuestionHeatmap] = useState(null);
  const [studentQuestionHeatmap, setStudentQuestionHeatmap] = useState(null);
  const [teacherHeatmapLoading, setTeacherHeatmapLoading] = useState(false);
  const [studentHeatmapLoading, setStudentHeatmapLoading] = useState(false);

  const { dashboard, overview, loading: dashLoad, error: dashErr } = useClassroomDashboard(classroomId);
  const { analytics, studentProgress, fetchMyProgress } = useClassroomAnalytics(classroomId);
  const { announcements, loading: annLoad, createAnnouncement, markAsViewed, deleteAnnouncement } = useAnnouncements(classroomId);
  const { modules, loading: modLoad } = useLearningModules(classroomId);

  useEffect(() => {
    if (!dashboard) {
      return;
    }

    if (normalizedSessionRole === 'teacher' || normalizedSessionRole === 'admin') {
      setUserRole('teacher');
      return;
    }

    if (normalizedSessionRole === 'student') {
      setUserRole('student');
      return;
    }

    setUserRole('student_count' in dashboard ? 'teacher' : 'student');
  }, [dashboard, normalizedSessionRole]);

  useEffect(() => { if (dashboard && userRole === 'student') fetchMyProgress(); }, [dashboard, userRole, fetchMyProgress]);

  useEffect(() => {
    let ok = true;
    (async () => {
      if (!dashboard || userRole !== 'student') return;
      setClassContextLoading(true);
      try {
        const res = await apiClient.get(API_ENDPOINTS.CLASSROOM_MY_ENROLLMENTS);
        const list = normalizeEnrollments(res);
        if (!ok) return;
        setStudentClassrooms(list);
        if (!list.length) { setStudentClassProgress({}); return; }
        const entries = await Promise.all(list.map(async (room) => {
          try {
            const r = await apiClient.get(`/api/analytics/classroom/${room.classroom_id}/my-progress`);
            const p = parseData(r) || {};
            const avg = clamp(p.average_score_percentage || 0);
            const earned = Number(p.total_earned_points || 0), total = Number(p.total_possible_points || 0);
            const pts = total > 0 ? clamp((earned/total)*100) : 0;
            const ml = Array.isArray(p.module_progress) ? p.module_progress : [];
            const mAvg = ml.length ? clamp(ml.reduce((s, m) => s + Number(m?.completion_percentage||0),0)/ml.length) : 0;
            return [room.classroom_id, { averageScore:avg, assignmentsCompleted:Number(p.assignments_completed||0), earnedPoints:earned, totalPossiblePoints:total, pointsRate:pts, moduleAverage:mAvg, overallProgress:clamp(avg*0.5+pts*0.3+mAvg*0.2) }];
          } catch { return [room.classroom_id, { averageScore:0,assignmentsCompleted:0,earnedPoints:0,totalPossiblePoints:0,pointsRate:0,moduleAverage:0,overallProgress:0 }]; }
        }));
        if (ok) setStudentClassProgress(Object.fromEntries(entries));
      } catch (e) {
        if (ok) { setClassContextError(e?.message||'Failed to load'); setStudentClassrooms([]); setStudentClassProgress({}); }
      } finally { if (ok) setClassContextLoading(false); }
    })();
    return () => { ok = false; };
  }, [dashboard, userRole, classroomId]);

  useEffect(() => {
    let ok = true;
    const go = async () => {
      if (!classroomId || userRole !== 'teacher') return;
      try { const r = await apiClient.get(`/api/classroom/${classroomId}/pending-grading-count`); if (ok) setPendingGradingCount(Number(r?.pending_count||0)); }
      catch { if (ok) setPendingGradingCount(0); }
    };
    go(); const iv = setInterval(go, 20000);
    return () => { ok = false; clearInterval(iv); };
  }, [classroomId, userRole]);

  useEffect(() => {
    let active = true;

    const loadTeacherHeatmap = async () => {
      if (!classroomId || userRole !== 'teacher') {
        if (active) {
          setTeacherQuestionHeatmap(null);
          setTeacherHeatmapLoading(false);
        }
        return;
      }

      setTeacherHeatmapLoading(true);
      try {
        const response = await apiClient.get(`/api/analytics/classroom/${classroomId}/ai-questions-by-module`);
        if (active) {
          setTeacherQuestionHeatmap(parseData(response) || null);
        }
      } catch {
        if (active) {
          setTeacherQuestionHeatmap(null);
        }
      } finally {
        if (active) {
          setTeacherHeatmapLoading(false);
        }
      }
    };

    loadTeacherHeatmap();

    return () => {
      active = false;
    };
  }, [classroomId, userRole]);

  useEffect(() => {
    let active = true;

    const loadStudentHeatmap = async () => {
      if (!classroomId || userRole !== 'student' || !studentProgress?.student_id) {
        if (active) {
          setStudentQuestionHeatmap(null);
          setStudentHeatmapLoading(false);
        }
        return;
      }

      setStudentHeatmapLoading(true);
      try {
        const response = await apiClient.get(
          `/api/analytics/classroom/${classroomId}/ai-questions-by-module?student_id=${encodeURIComponent(studentProgress.student_id)}`
        );
        if (active) {
          setStudentQuestionHeatmap(parseData(response) || null);
        }
      } catch {
        if (active) {
          setStudentQuestionHeatmap(null);
        }
      } finally {
        if (active) {
          setStudentHeatmapLoading(false);
        }
      }
    };

    loadStudentHeatmap();

    return () => {
      active = false;
    };
  }, [classroomId, userRole, studentProgress?.student_id]);

  useEffect(() => {
    let active = true;

    const loadStudentActivityStats = async () => {
      if (!classroomId || userRole !== 'student' || !studentProgress?.student_id) {
        if (active) {
          setStudentActivityStats({ aiQuestionsAsked: 0, quizEvents: 0 });
        }
        return;
      }

      try {
        const response = await apiClient.get(`/api/classroom/${classroomId}/activity-feed?limit=200`);
        const items = Array.isArray(response?.items) ? response.items : [];
        const myId = String(studentProgress.student_id || '').trim();

        const mine = items.filter((item) => {
          const studentId = String(item?.student_id || '').trim();
          const actorId = String(item?.action_performed_by_id || '').trim();
          return studentId === myId || actorId === myId;
        });

        const aiQuestionsAsked = mine.filter((item) => item?.action_type === 'ai_question_asked').length;
        const quizEvents = mine.filter((item) => item?.action_type === 'quiz_passed' || item?.action_type === 'quiz_failed').length;

        if (active) {
          setStudentActivityStats({ aiQuestionsAsked, quizEvents });
        }
      } catch {
        if (active) {
          setStudentActivityStats({ aiQuestionsAsked: 0, quizEvents: 0 });
        }
      }
    };

    loadStudentActivityStats();

    return () => {
      active = false;
    };
  }, [classroomId, userRole, studentProgress?.student_id]);

  if (dashLoad) return <GlassDashboardShell contentClassName="max-w-7xl"><LoadingState message="Loading…" /></GlassDashboardShell>;
  if (dashErr || !dashboard) return <GlassDashboardShell contentClassName="max-w-7xl"><ErrorState message={dashErr||'Not found'} onRetry={() => window.location.reload()} /></GlassDashboardShell>;

  /* ════ TEACHER ════ */
  if (userRole === 'teacher') {
    const td = dashboard;
    const totalStudents  = td.student_count || 0;
    const totalAnn       = announcements?.length || 0;
    const totalSubs      = td.recent_submissions?.length || 0;
    const totalAssign    = overview?.assignment_count || 0;
    const modCount       = overview?.module_count || 0;
    const totalViews     = (announcements||[]).reduce((s,a)=>s+Number(a?.views||0),0);
    const engRate        = Math.min(100, Math.round((totalViews / Math.max(1, totalStudents*Math.max(1,totalAnn)))*100));
    const subVel         = totalStudents ? Math.min(100, Math.round((totalSubs/totalStudents)*100)) : 0;
    const compRate       = clamp(analytics?.assignment_completion_rate||0);
    const studentAnalytics = Array.isArray(analytics?.student_analytics) ? analytics.student_analytics : [];
    const scoreDistributionData = buildScoreDistributionData(studentAnalytics);
    const moduleCompletionData = buildModuleCompletionData(studentAnalytics);

    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <div className="space-y-5 px-3 py-5 sm:px-5">
          <AppBackButton
            label="Back to Classrooms"
            fallbackTo="/classrooms/"
          />

          {/* ── HERO ─────────────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#060c18] via-[#0a1020] to-[#0c1428] shadow-2xl">
            <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage:'radial-gradient(#60a5fa 1px,transparent 1px)', backgroundSize:'22px 22px' }} />
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-500/10 blur-3xl" />

            <div className="relative px-6 pt-6 pb-5 space-y-4">

              {/* Top: role label */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/[0.09] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-400">
                <IoSchoolOutline /> {sessionRole === 'admin' ? 'Admin Command Center' : 'Teacher Workspace'}
              </span>

              {/* Middle: classroom name + subject */}
              <div>
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl leading-tight">
                  {td.classroom_name}
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {td.classroom_subject}{td.classroom_grade ? ` · Grade ${td.classroom_grade}` : ''}
                </p>
              </div>

              {/* Stat chips */}
              <div className="flex flex-wrap gap-2">
                <StatChip icon={IoPeopleOutline}           label={`${totalStudents} learners`}  color="border-blue-500/20 bg-blue-500/10 text-blue-300" />
                <StatChip icon={IoCheckmarkCircleOutline}  label={`${totalAssign} assignments`} color="border-emerald-500/20 bg-emerald-500/10 text-emerald-300" />
                <StatChip icon={IoLayersOutline}           label={`${modCount} modules`}         color="border-cyan-500/20 bg-cyan-500/10 text-cyan-300" />
              </div>

              {/* ── ACTION BAR: horizontal pill row, pinned to bottom of hero ── */}
              <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-4">
                <ActionPill label="Roster"        onClick={() => navigate(`/classroom/${classroomId}/roster`)}     variant="blue" />
                <ActionPill label="Resource Hub"  onClick={() => navigate(`/classroom/${classroomId}/resources`)}  variant="violet" />
                <ActionPill label="Modules"       onClick={() => navigate(`/classroom/${classroomId}/modules`)}    variant="emerald" />
                <ActionPill
                  label="Grade Queue"
                  badge={pendingGradingCount}
                  onClick={() => navigate(`/classroom/${classroomId}/grading`)}
                  variant={pendingGradingCount > 0 ? 'amber' : 'ghost'}
                />
                <ActionPill label="Settings"      onClick={() => navigate(`/classroom/${classroomId}/settings`)}   variant="ghost" />
              </div>
            </div>
          </div>

          {/* ── KPI STRIP ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Students"    value={totalStudents}        accent="border-blue-500/20 bg-blue-500/[0.05]" />
            <Kpi label="Assignments" value={totalAssign}          accent="border-emerald-500/20 bg-emerald-500/[0.05]" />
            <Kpi label="Modules"     value={modCount}             accent="border-cyan-500/20 bg-cyan-500/[0.05]" />
            <Kpi label="Completion"  value={`${compRate}%`}       accent="border-violet-500/20 bg-violet-500/[0.05]" />
          </div>
          {/* ── BODY GRID ── */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="space-y-5 xl:col-span-8">

              <Panel>
                <SectionLabel right={<span className="rounded-full bg-blue-500/15 px-2 py-0.5 font-bold text-blue-400">{totalAnn} active</span>}>
                  Announcement Studio
                </SectionLabel>
                <AnnouncementCreate onSubmit={createAnnouncement} isLoading={annLoad} />
                <AnnouncementFeed
                  announcements={announcements}
                  onMarkViewed={markAsViewed}
                  onDelete={deleteAnnouncement}
                  isTeacher
                  loading={annLoad}
                />
              </Panel>

              <Panel>
                <SectionLabel right={<span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-400">{totalSubs} recent</span>}>
                  Submission Flow
                </SectionLabel>
                {td.recent_submissions?.length > 0
                  ? <SubmissionList submissions={td.recent_submissions} loading={false} />
                  : <div className="rounded-xl border border-dashed border-white/[0.07] p-6 text-center">
                      <p className="text-sm font-semibold text-white">No submissions yet</p>
                      <p className="mt-1 text-xs text-slate-600">Once students submit, this becomes your grading launchpad.</p>
                    </div>
                }
              </Panel>

              <Panel>
                <SectionLabel right={<span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-semibold text-slate-500">Top 3 modules</span>}>
                  Module Snapshot
                </SectionLabel>
                <ModuleList modules={modules.slice(0,3)} loading={modLoad} />
              </Panel>
            </div>

            <div className="space-y-5 xl:col-span-4">

              <Panel className="!border-blue-500/10 bg-gradient-to-br from-blue-500/[0.06] to-indigo-500/[0.06]">
                <SectionLabel>Class Pulse</SectionLabel>
                <div className="space-y-4">
                  <Bar label="Engagement"            icon={IoFlameOutline}            pct={engRate}  from="from-cyan-500"    to="to-blue-500" />
                  <Bar label="Submission Velocity"   icon={IoBarChartOutline}         pct={subVel}   from="from-emerald-500" to="to-green-400" />
                  <Bar label="Assignment Completion" icon={IoCheckmarkCircleOutline}  pct={compRate} from="from-violet-500"  to="to-pink-500" />
                </div>
                {analytics && (
                  <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">Avg Class Score</p>
                    <p className="text-2xl font-extrabold text-cyan-300">{Number(analytics.average_class_score||0).toFixed(1)}%</p>
                  </div>
                )}
              </Panel>

              <Panel>
                <SectionLabel right={
                  pendingGradingCount > 0 && (
                    <span className="font-bold text-amber-400">{pendingGradingCount} pending</span>
                  )
                }>Activity Feed</SectionLabel>
                <ActivityFeed classroomId={classroomId} limit={12} compact />
              </Panel>
            </div>
          </div>

          <Panel className="!border-cyan-500/10 bg-gradient-to-br from-cyan-500/[0.06] to-slate-500/[0.05]">
            <SectionLabel right={<span className="rounded-full bg-cyan-500/15 px-2 py-0.5 font-bold text-cyan-300">{studentAnalytics.length} learners</span>}>
              Student Insights
            </SectionLabel>

            <div className="space-y-4">
              {studentAnalytics.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Score Distribution</p>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={scoreDistributionData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={72}
                            innerRadius={42}
                          >
                            {scoreDistributionData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#0b1220',
                              borderColor: 'rgba(148, 163, 184, 0.25)',
                              color: '#e2e8f0',
                            }}
                            formatter={(value, name) => [`${value} students`, name]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {scoreDistributionData.map((entry) => (
                        <div key={entry.name} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
                          <span className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            {entry.name}
                          </span>
                          <span className="text-xs font-bold text-slate-200">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Module Completion Trend</p>
                    {moduleCompletionData.length > 0 ? (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={moduleCompletionData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                            <XAxis
                              dataKey="module"
                              tick={{ fill: '#94a3b8', fontSize: 10 }}
                              interval={0}
                              angle={-14}
                              textAnchor="end"
                              height={52}
                            />
                            <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#0b1220',
                                borderColor: 'rgba(148, 163, 184, 0.25)',
                                color: '#e2e8f0',
                              }}
                              formatter={(value) => [`${value}%`, 'Avg completion']}
                            />
                            <Line
                              type="monotone"
                              dataKey="completion"
                              stroke="#22d3ee"
                              strokeWidth={2.5}
                              dot={{ r: 3, fill: '#22d3ee' }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-500">
                        Module completion trend appears once students interact with published modules.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-xs text-slate-500">
                  Student analytics charts appear after learners submit assignments and module progress data is recorded.
                </p>
              )}

              <ModuleQuestionHeatmap
                data={teacherQuestionHeatmap}
                loading={teacherHeatmapLoading}
                title="Ask AI Doubts Heatmap (All Students)"
                emptyMessage="Heatmap appears once students ask AI questions inside module resources."
              />
            </div>
          </Panel>
        </div>
      </GlassDashboardShell>
    );
  }

  /* ════ STUDENT ════ */
  const sd = dashboard;
  const cp = studentProgress || {};
  const avgScore  = clamp(cp.average_score_percentage||0);
  const doneCount = Number(cp.assignments_completed||0);
  const earned    = Number(cp.total_earned_points||0);
  const totalPts  = Number(cp.total_possible_points||0);
  const ptsAtt    = totalPts > 0 ? clamp((earned/totalPts)*100) : 0;
  const modList   = Array.isArray(cp.module_progress) ? cp.module_progress : [];
  const meaningfulModuleList = modList.filter((module) => hasMeaningfulModuleProgress(module));
  const activeModulePreview = meaningfulModuleList;
  const modAvg    = modList.length ? clamp(modList.reduce((s,m)=>s+Number(m?.completion_percentage||0),0)/modList.length) : 0;
  const totalResourcesViewed = modList.reduce((sum, module) => sum + Number(module?.viewed_resources || 0), 0);
  const totalSourceTestsAttempted = modList.reduce((sum, module) => sum + Number(module?.attempted_resources || 0), 0);
  const totalSourceTestsPassed = modList.reduce((sum, module) => sum + Number(module?.passed_resources || 0), 0);
  const weightedResourceScore = modList.reduce((sum, module) => {
    const attempted = Number(module?.attempted_resources || 0);
    const avg = Number(module?.average_resource_test_score || 0);
    return sum + (attempted > 0 ? attempted * avg : 0);
  }, 0);
  const avgSourceTestScore = totalSourceTestsAttempted > 0 ? clamp(weightedResourceScore / totalSourceTestsAttempted) : 0;
  const sourceTestSuccess = totalSourceTestsAttempted > 0
    ? clamp((totalSourceTestsPassed / totalSourceTestsAttempted) * 100)
    : 0;
  const studentAiQuestionTotal = Number(studentQuestionHeatmap?.total_questions || studentActivityStats.aiQuestionsAsked || 0);
  const showDetailedProgressStats = (
    totalSourceTestsAttempted > 0 ||
    totalSourceTestsPassed > 0 ||
    avgSourceTestScore > 0 ||
    studentAiQuestionTotal > 0 ||
    (studentActivityStats?.quizEvents || 0) > 0 ||
    totalResourcesViewed > 0
  );
  const coreProgress = clamp(avgScore*0.45+ptsAtt*0.35+modAvg*0.2);
  const roomIdx   = studentClassrooms.findIndex((r)=>r.classroom_id===classroomId);
  const totalRooms = studentClassrooms.length || 1;
  const roomsDisplay = studentClassrooms.length > 0 ? studentClassrooms : [{ classroom_id:classroomId, name:sd.classroom_name, subject:sd.classroom_subject, grade_level:'' }];

  return (
    <GlassDashboardShell contentClassName="max-w-7xl">
      <div className="space-y-5 px-3 py-5 sm:px-5">
        <AppBackButton
          label="Back to Classrooms"
          fallbackTo="/classrooms"
        />

        {/* ── STUDENT HERO ── */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-[#070816] via-[#09091e] to-[#0b0e22] shadow-2xl">
          <div className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ backgroundImage:'radial-gradient(#818cf8 1px,transparent 1px)', backgroundSize:'22px 22px' }} />
          <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
          {/* Decorative ring */}
          <div className="pointer-events-none absolute right-6 top-5 hidden h-20 w-20 lg:block opacity-[0.18]">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="#818cf8" strokeWidth="8" strokeOpacity="0.25"/>
              <circle cx="50" cy="50" r="42" fill="none" stroke="#818cf8" strokeWidth="8"
                strokeDasharray={`${(coreProgress/100)*263.89} 263.89`} strokeLinecap="round"/>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold text-white">{coreProgress}%</span>
          </div>

          <div className="relative px-6 pt-6 pb-5 space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/25 bg-indigo-500/[0.09] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-400">
              <IoSchoolOutline /> Student Learning Center
            </span>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl leading-tight">{sd.classroom_name}</h1>
              <p className="mt-1 text-sm text-slate-500">
                {sd.classroom_subject}{sd.teacher_name ? <> · Taught by <span className="text-slate-400">{sd.teacher_name}</span></> : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatChip icon={IoFlameOutline}    label={`Core ${coreProgress}%`}   color="border-indigo-500/20 bg-indigo-500/10 text-indigo-300" />
              <StatChip icon={IoBarChartOutline} label={`Score ${avgScore}%`}       color="border-emerald-500/20 bg-emerald-500/10 text-emerald-300" />
              <StatChip icon={IoLayersOutline}   label={`Class ${roomIdx>=0?roomIdx+1:1} of ${totalRooms}`} color="border-slate-500/20 bg-slate-500/10 text-slate-400" />
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-4">
              <ActionPill label="Personal Resources" onClick={() => navigate(`/classroom/${classroomId}/personal-resources`)} variant="violet" />
              <ActionPill label="Open Modules"       onClick={() => navigate(`/classroom/${classroomId}/modules`)} variant="emerald" />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <Kpi label="Core Progress"    value={`${coreProgress}%`}  accent="border-indigo-500/20 bg-indigo-500/[0.05]" />
          <Kpi label="Average Score"    value={`${avgScore}%`}       accent="border-emerald-500/20 bg-emerald-500/[0.05]" />
          <Kpi label="Points Earned"    value={earned} sub={`of ${totalPts}`} accent="border-blue-500/20 bg-blue-500/[0.05]" />
          <Kpi label="Assignments Done" value={doneCount}             accent="border-violet-500/20 bg-violet-500/[0.05]" />
          <Kpi label="Source Tests"     value={totalSourceTestsAttempted} accent="border-cyan-500/20 bg-cyan-500/[0.05]" />
          <Kpi label="AI Questions"     value={studentAiQuestionTotal} accent="border-fuchsia-500/20 bg-fuchsia-500/[0.05]" />
        </div>

        {/* Network */}
        <Panel>
          {/* Module Snapshot — individual horizontal blocks */}
          {activeModulePreview.length > 0 && (
            <div >
              <p className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-600">Module Snapshot</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {activeModulePreview.map((module, index) => {
                  const moduleName = String(module?.module_name || `Module ${index + 1}`).trim();
                  const completion = clamp(module?.completion_percentage || 0);
                  const totalCheckpoints = Number(module?.total_assessments || module?.total_resources || 0);
                  const completedCheckpoints = Number(module?.completed_assessments || module?.passed_resources || 0);
                  const attemptedResources = Number(module?.attempted_resources || 0);
                  const passedResources = Number(module?.passed_resources || 0);
                  const averageResourceScore = clamp(module?.average_resource_test_score || 0);

                  return (
                    <div
                      key={`${module?.module_id || moduleName}-${index}`}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-[11px] font-semibold text-slate-200 leading-snug">{moduleName}</p>
                        <span className="shrink-0 text-[11px] font-bold tabular-nums text-indigo-300">{completion}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-[width] duration-700"
                          style={{ width: `${completion}%` }}
                        />
                      </div>
                      {totalCheckpoints > 0 && (
                        <p className="mt-1.5 text-[10px] text-slate-600">{completedCheckpoints}/{totalCheckpoints} checkpoints completed</p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-600">
                        Tests {attemptedResources} · Passed {passedResources} · Avg {averageResourceScore}%
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Panel>

        <Panel className="!border-fuchsia-500/10 bg-gradient-to-br from-fuchsia-500/[0.06] to-indigo-500/[0.06]">
          <SectionLabel right={<span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 font-bold text-fuchsia-300">{studentAiQuestionTotal} questions</span>}>
            Ask AI Doubts Heatmap
          </SectionLabel>
          <ModuleQuestionHeatmap
            data={studentQuestionHeatmap}
            loading={studentHeatmapLoading}
            title="My Questions by Module and Source"
            emptyMessage="Ask AI questions on module resources to populate your personal heatmap."
          />
        </Panel>

        {/* Content */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <Panel>
              <SectionLabel>My Assignments</SectionLabel>
              <PendingAssignments assignments={sd.pending_assignments} loading={false} />
            </Panel>
            <Panel>
              <SectionLabel right={<span className="inline-flex items-center gap-1 text-slate-700"><IoNotificationsOutline /> updates</span>}>
                Announcements
              </SectionLabel>
              <AnnouncementFeed announcements={sd.announcements} onMarkViewed={markAsViewed} isTeacher={false} loading={annLoad} />
            </Panel>
          </div>
          <div className="space-y-5">
            <Panel className="!border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.06] to-blue-500/[0.06]">
              <SectionLabel>My Progress</SectionLabel>
              <div className="space-y-4">
                <Bar label="Score Accuracy"    icon={IoBarChartOutline}       pct={avgScore} from="from-emerald-500" to="to-green-400" />
                <Bar label="Source Test Success" icon={IoFlameOutline}        pct={sourceTestSuccess} from="from-cyan-500" to="to-blue-500" />
                <Bar label="Module Completion" icon={IoCheckmarkCircleOutline} pct={modAvg}  from="from-violet-500" to="to-pink-500" />
              </div>
              {showDetailedProgressStats && (
                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
                  <p className="text-[10px] text-slate-600">Tests Taken</p>
                  <p className="text-sm font-bold text-indigo-300">{totalSourceTestsAttempted}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
                  <p className="text-[10px] text-slate-600">Tests Passed</p>
                  <p className="text-sm font-bold text-blue-300">{totalSourceTestsPassed}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
                  <p className="text-[10px] text-slate-600">Avg Test Score</p>
                  <p className="text-sm font-bold text-cyan-300">{avgSourceTestScore}%</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
                  <p className="text-[10px] text-slate-600">AI Questions</p>
                  <p className="text-sm font-bold text-fuchsia-300">{studentAiQuestionTotal}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
                  <p className="text-[10px] text-slate-600">Quiz Events</p>
                  <p className="text-sm font-bold text-emerald-300">{studentActivityStats.quizEvents}</p>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-center">
                  <p className="text-[10px] text-slate-600">Sources Viewed</p>
                  <p className="text-sm font-bold text-amber-300">{totalResourcesViewed}</p>
                </div>
              </div>
              )}
            </Panel>
          </div>
        </div>

      </div>
    </GlassDashboardShell>
  );
};

export default ClassroomDashboard;