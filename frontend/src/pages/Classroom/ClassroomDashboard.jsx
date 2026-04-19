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
import ActivityFeed from '../../components/Classroom/ActivityFeed';
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
  IoTimeOutline,
  IoArrowForwardOutline,
  IoAlertCircleOutline,
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

  const sessionRole = (localStorage.getItem('userRole') || 'student').toLowerCase();
  const normRole = sessionRole === 'admin' ? 'teacher' : sessionRole;
  const [userRole, setUserRole] = useState(['teacher','student'].includes(normRole) ? normRole : 'student');
  const [studentClassrooms, setStudentClassrooms] = useState([]);
  const [studentClassProgress, setStudentClassProgress] = useState({});
  const [classContextLoading, setClassContextLoading] = useState(false);
  const [classContextError, setClassContextError] = useState('');
  const [pendingGradingCount, setPendingGradingCount] = useState(0);

  const { dashboard, overview, loading: dashLoad, error: dashErr } = useClassroomDashboard(classroomId);
  const { analytics, studentProgress, fetchMyProgress } = useClassroomAnalytics(classroomId);
  const { announcements, loading: annLoad, createAnnouncement, markAsViewed, deleteAnnouncement } = useAnnouncements(classroomId);
  const { modules, loading: modLoad } = useLearningModules(classroomId);

  useEffect(() => {
    if (!dashboard) return;
    if (['teacher','student'].includes(normRole)) { setUserRole(normRole); return; }
    setUserRole('student_count' in dashboard ? 'teacher' : 'student');
  }, [dashboard, normRole]);

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
    const resSum         = td?.resource_summary||{total:0,pending:0};
    const checklist      = [
      { icon: IoRocketOutline, label:'Publish a kickoff announcement', done: totalAnn>0 },
      { icon: IoBookOutline,   label:'Create your first assignment',   done: totalAssign>0 },
      { icon: IoGridOutline,   label:'Add at least one module',        done: modCount>0 },
      { icon: IoTimeOutline,   label:'Collect first submissions',      done: totalSubs>0 },
    ];

    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <div className="space-y-5 px-3 py-5 sm:px-5">

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

          <ClassroomStats studentCount={totalStudents} assignmentCount={totalAssign} moduleCount={modCount} completionRate={compRate} />

          {/* ── BODY GRID ── */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
            <div className="space-y-5 xl:col-span-8">

              <Panel>
                <SectionLabel right={<span className="rounded-full bg-cyan-500/15 px-2 py-0.5 font-bold text-cyan-400">{totalAnn} live</span>}>
                  Announcement Studio
                </SectionLabel>
                <AnnouncementCreate onSubmit={createAnnouncement} isLoading={annLoad} />
                <div className="mt-4">
                  <AnnouncementFeed announcements={announcements} onMarkViewed={markAsViewed} onDelete={deleteAnnouncement} isTeacher loading={annLoad} />
                </div>
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
                <SectionLabel right={
                  <button onClick={() => navigate(`/classroom/${classroomId}/modules`)}
                    className="inline-flex items-center gap-1 font-bold text-blue-400 hover:text-blue-300">
                    View all <IoArrowForwardOutline />
                  </button>
                }>Module Snapshot</SectionLabel>
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
                    <button onClick={() => navigate(`/classroom/${classroomId}/grading`)}
                      className="font-bold text-amber-400 hover:text-amber-300">{pendingGradingCount} pending</button>
                  )
                }>Activity Feed</SectionLabel>
                <ActivityFeed classroomId={classroomId} limit={12} compact />
              </Panel>

              <Panel>
                <SectionLabel>Setup Checklist</SectionLabel>
                <div className="space-y-2">
                  {checklist.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${item.done ? 'border-emerald-500/20 bg-emerald-500/[0.05]' : 'border-white/[0.05] bg-white/[0.02]'}`}>
                        <Icon className={`shrink-0 text-base ${item.done ? 'text-emerald-400' : 'text-amber-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-slate-300">{item.label}</p>
                          <p className={`text-[10px] ${item.done ? 'text-emerald-600' : 'text-slate-700'}`}>{item.done ? 'Complete' : 'Recommended'}</p>
                        </div>
                        {item.done && <span className="text-[10px] font-extrabold text-emerald-500">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel>
                <SectionLabel>Resource Hub</SectionLabel>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                    <p className="text-[10px] text-slate-600">Total</p>
                    <p className="text-xl font-extrabold text-cyan-300">{Number(resSum.total||0)}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                    <p className="text-[10px] text-slate-600">Pending</p>
                    <p className="text-xl font-extrabold text-amber-300">{Number(resSum.pending||0)}</p>
                  </div>
                </div>
                <button onClick={() => navigate(`/classroom/${classroomId}/resources`)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-500 transition-colors">
                  Open Resource Hub <IoArrowForwardOutline />
                </button>
              </Panel>

              <Panel>
                <SectionLabel>Upcoming Assignments</SectionLabel>
                {td.pending_assignments?.length > 0
                  ? <PendingAssignments assignments={td.pending_assignments} loading={false} />
                  : <div className="flex items-start gap-2 text-xs text-slate-600">
                      <IoAlertCircleOutline className="mt-0.5 shrink-0 text-amber-500" />
                      No upcoming assignments. Create one to activate student workflows.
                    </div>
                }
              </Panel>
            </div>
          </div>
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
  const modAvg    = modList.length ? clamp(modList.reduce((s,m)=>s+Number(m?.completion_percentage||0),0)/modList.length) : 0;
  const coreProgress = clamp(avgScore*0.45+ptsAtt*0.35+modAvg*0.2);
  const roomIdx   = studentClassrooms.findIndex((r)=>r.classroom_id===classroomId);
  const totalRooms = studentClassrooms.length || 1;
  const roomsDisplay = studentClassrooms.length > 0 ? studentClassrooms : [{ classroom_id:classroomId, name:sd.classroom_name, subject:sd.classroom_subject, grade_level:'' }];
  const modsForProgress = Array.isArray(sd.modules) && sd.modules.length > 0 ? sd.modules : modules;

  return (
    <GlassDashboardShell contentClassName="max-w-7xl">
      <div className="space-y-5 px-3 py-5 sm:px-5">

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
              <ActionPill label="All Classrooms"     onClick={() => navigate('/classrooms')} variant="ghost" />
              <ActionPill label="Personal Resources" onClick={() => navigate(`/classroom/${classroomId}/personal-resources`)} variant="violet" />
              <ActionPill label="Open Modules"       onClick={() => navigate(`/classroom/${classroomId}/modules`)} variant="emerald" />
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Core Progress"    value={`${coreProgress}%`}  accent="border-indigo-500/20 bg-indigo-500/[0.05]" />
          <Kpi label="Average Score"    value={`${avgScore}%`}       accent="border-emerald-500/20 bg-emerald-500/[0.05]" />
          <Kpi label="Points Earned"    value={earned} sub={`of ${totalPts}`} accent="border-blue-500/20 bg-blue-500/[0.05]" />
          <Kpi label="Assignments Done" value={doneCount}             accent="border-violet-500/20 bg-violet-500/[0.05]" />
        </div>

        {/* Network */}
        <Panel>
          <SectionLabel right={classContextError && <span className="text-red-400">{classContextError}</span>}>
            My Classroom Network
          </SectionLabel>
          {classContextLoading
            ? <div className="grid animate-pulse grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{[...Array(3)].map((_,i)=><div key={i} className="h-20 rounded-xl bg-white/[0.04]" />)}</div>
            : <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {roomsDisplay.map((room) => {
                  const active = room.classroom_id === classroomId;
                  const rp = studentClassProgress[room.classroom_id] || { averageScore:active?avgScore:0, assignmentsCompleted:active?doneCount:0, moduleAverage:active?modAvg:0, overallProgress:active?coreProgress:0 };
                  return (
                    <button key={room.classroom_id} onClick={() => navigate(`/classroom/${room.classroom_id}/dashboard`)}
                      className={`group rounded-xl border p-4 text-left transition-all duration-150 hover:-translate-y-[1px] hover:shadow-lg ${active ? 'border-indigo-500/40 bg-indigo-500/[0.07]' : 'border-white/[0.06] bg-white/[0.02] hover:border-indigo-500/25'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-white">{room.name}</p>
                          <p className="truncate text-[11px] text-slate-600 mt-0.5">{room.subject}{room.grade_level?` · ${room.grade_level}`:''}</p>
                        </div>
                        <span className="shrink-0 text-sm font-extrabold tabular-nums text-indigo-300">{rp.overallProgress}%</span>
                      </div>
                      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-[width] duration-700" style={{ width:`${rp.overallProgress}%` }} />
                      </div>
                      <p className="mt-2 text-[10px] text-slate-700">Score {rp.averageScore}% · Done {rp.assignmentsCompleted} · Modules {rp.moduleAverage}%</p>
                    </button>
                  );
                })}
              </div>
          }
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
                <Bar label="Points Attainment" icon={IoFlameOutline}          pct={ptsAtt}   from="from-cyan-500"   to="to-blue-500" />
                <Bar label="Module Completion" icon={IoCheckmarkCircleOutline} pct={modAvg}  from="from-violet-500" to="to-pink-500" />
              </div>
              {modList.length > 0 && (
                <div className="mt-5 space-y-3 border-t border-white/[0.06] pt-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700">Module Breakdown</p>
                  {modList.slice(0,4).map((m) => (
                    <div key={m.module_id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="max-w-[72%] truncate text-[11px] text-slate-500">{m.module_name}</span>
                        <span className="text-[11px] font-bold tabular-nums text-white">{clamp(m.completion_percentage)}%</span>
                      </div>
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
                        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 transition-[width] duration-700" style={{ width:`${clamp(m.completion_percentage)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
            <Panel>
              <SectionLabel>Curriculum Modules</SectionLabel>
              <LearningModuleProgress modules={modsForProgress} studentProgress={cp} loading={modLoad} />
            </Panel>
          </div>
        </div>

        {modules.length > 0 && (
          <div className="flex justify-center pt-1">
            <button onClick={() => navigate(`/classroom/${classroomId}/modules`)}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:brightness-110 active:scale-[0.98]">
              View Full Curriculum <IoArrowForwardOutline />
            </button>
          </div>
        )}
      </div>
    </GlassDashboardShell>
  );
};

export default ClassroomDashboard;