import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FiArrowRight,
  FiCopy,
  FiGrid,
  FiUsers,
  FiSettings,
  FiBookOpen,
  FiAlertCircle,
  FiLoader,
  FiChevronLeft,
  FiCheck,
} from 'react-icons/fi';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import GlassDashboardShell from '../UI/GlassDashboardShell';
import { canManageClassroom } from '../../utils/classroomRoles';

/* ─── Tiny helpers ─────────────────────────────────────────────── */

const InfoCard = ({ title, value, fullWidth = false }) => (
  <div
    className={`flex flex-col gap-1 rounded-xl border border-white/[0.07] bg-white/[0.04] px-4 py-3 transition-colors hover:bg-white/[0.06] ${
      fullWidth ? 'col-span-full' : ''
    }`}
  >
    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
      {title}
    </span>
    <span className="text-sm font-medium leading-relaxed text-gray-200">
      {value || <span className="italic text-gray-500">Not set</span>}
    </span>
  </div>
);

const NAV_COLORS = {
  cyan: {
    border: 'border-cyan-500/20',
    bg: 'bg-cyan-500/[0.08] hover:bg-cyan-500/[0.14]',
    icon: 'text-cyan-400',
    badge: 'bg-cyan-500/15 text-cyan-300',
    arrow: 'text-cyan-400',
  },
  purple: {
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/[0.08] hover:bg-purple-500/[0.14]',
    icon: 'text-purple-400',
    badge: 'bg-purple-500/15 text-purple-300',
    arrow: 'text-purple-400',
  },
  emerald: {
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14]',
    icon: 'text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-300',
    arrow: 'text-emerald-400',
  },
  amber: {
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/[0.08] hover:bg-amber-500/[0.14]',
    icon: 'text-amber-400',
    badge: 'bg-amber-500/15 text-amber-300',
    arrow: 'text-amber-400',
  },
};

const NavCard = ({ icon, title, description, onClick, color }) => {
  const c = NAV_COLORS[color];
  return (
    <button
      onClick={onClick}
      className={`group flex w-full flex-col gap-3 rounded-2xl border ${c.border} ${c.bg} p-5 text-left transition-all duration-200 hover:-translate-y-[2px] hover:shadow-lg`}
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-lg ${c.icon}`}>
        {icon}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-white">{title}</span>
        <span className={`text-xs leading-snug ${c.badge.split(' ')[1]}`}>{description}</span>
      </div>
      <div className={`mt-auto flex items-center gap-1 text-xs font-semibold ${c.arrow}`}>
        Open
        <FiArrowRight className="transition-transform duration-200 group-hover:translate-x-1" />
      </div>
    </button>
  );
};

/* ─── Main Page ─────────────────────────────────────────────────── */

const ClassroomPage = () => {
  const { id } = useParams();
  const [classroom, setClassroom] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const userRole = (localStorage.getItem('userRole') || 'student').toLowerCase();
  const canManage = canManageClassroom(userRole);

  /* fetch */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`${API_ENDPOINTS.CLASSROOM_GET}${id}`);
        if (mounted) setClassroom(res?.data || res);
      } catch (e) {
        if (mounted) setError(e.message || 'Failed to load classroom');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [id]);

  /* enter */
  const enterClassroom = useCallback(async () => {
    setActionLoading(true);
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
      setActionLoading(false);
    }
  }, [id, navigate]);

  /* copy */
  const copyEnrollmentCode = useCallback(async () => {
    if (copied) return;
    try {
      await navigator.clipboard.writeText(classroom?.enrollment_code || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [classroom, copied]);

  /* ── States ── */
  if (loading) {
    return (
      <GlassDashboardShell contentClassName="max-w-6xl">
        <div className="flex h-64 items-center justify-center gap-3 text-sm text-gray-400">
          <FiLoader className="animate-spin" /> Loading classroom…
        </div>
      </GlassDashboardShell>
    );
  }

  if (error || !classroom) {
    return (
      <GlassDashboardShell contentClassName="max-w-6xl">
        <div className="m-6 flex items-start gap-3 rounded-xl border border-red-700/40 bg-red-900/20 px-5 py-4 text-sm text-red-200">
          <FiAlertCircle className="mt-0.5 shrink-0" />
          <span>{error || 'Classroom not found.'}</span>
        </div>
      </GlassDashboardShell>
    );
  }

  const navItems = [
    {
      key: 'dashboard',
      icon: <FiGrid />,
      title: 'Dashboard',
      description: 'View analytics and activity',
      color: 'cyan',
      onClick: () => navigate(`/classroom/${id}/dashboard`),
    },
    {
      key: 'resources',
      icon: <FiBookOpen />,
      title: 'Resources',
      description: 'Access learning materials',
      color: 'purple',
      onClick: () => navigate(`/classroom/${id}/resources`),
    },
    ...(canManage
      ? [
          {
            key: 'roster',
            icon: <FiUsers />,
            title: 'Roster',
            description: 'Manage students and groups',
            color: 'emerald',
            onClick: () => navigate(`/classroom/${id}/roster`),
          },
          {
            key: 'settings',
            icon: <FiSettings />,
            title: 'Settings',
            description: 'Adjust classroom details',
            color: 'amber',
            onClick: () => navigate(`/classroom/${id}/settings`),
          },
        ]
      : []),
  ];

  return (
    <GlassDashboardShell contentClassName="max-w-6xl">
      <div className="space-y-6 px-4 py-6 sm:px-6">

        {/* ── Back link ── */}
        <Link
          to="/classrooms"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-cyan-400"
        >
          <FiChevronLeft size={14} /> Back to all classrooms
        </Link>

        {/* ── Hero header ── */}
        <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-slate-800/70 to-slate-900/80 p-6 shadow-xl backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
              {canManage ? 'Teacher Workspace' : 'Student Classroom'}
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {classroom.name}
            </h1>
            {classroom.subject && (
              <p className="text-sm text-gray-400">{classroom.subject}</p>
            )}
          </div>

          <button
            onClick={enterClassroom}
            disabled={actionLoading}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-200 hover:brightness-110 disabled:opacity-50"
          >
            {actionLoading ? (
              <><FiLoader className="animate-spin" /> Entering…</>
            ) : (
              <>Enter Classroom <FiArrowRight /></>
            )}
          </button>
        </div>

        {/* ── Body: two-column layout ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Left – nav cards + details */}
          <div className="space-y-6 lg:col-span-2">

            {/* Nav grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-2">
              {navItems.map((item) => (
                <NavCard key={item.key} {...item} />
              ))}
            </div>

            {/* Classroom details */}
            <div className="rounded-2xl border border-white/[0.07] bg-slate-900/50 p-5">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-gray-400">
                Classroom Details
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <InfoCard title="Subject" value={classroom.subject} />
                <InfoCard title="Grade Level" value={classroom.grade_level} />
                <InfoCard
                  title="Description"
                  value={classroom.description || 'No description added yet.'}
                  fullWidth
                />
              </div>
            </div>
          </div>

          {/* Right – sidebar */}
          <aside className="flex flex-col gap-4">
            {canManage && (
              <div className="rounded-2xl border border-blue-500/20 bg-blue-900/10 p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-300">
                  Enrollment Code
                </p>
                <div className="mb-3 rounded-xl border border-dashed border-blue-400/30 bg-slate-800/50 px-4 py-3 text-center">
                  <span className="font-mono text-xl font-bold tracking-[0.2em] text-white">
                    {classroom.enrollment_code || 'N/A'}
                  </span>
                </div>
                <button
                  onClick={copyEnrollmentCode}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-500'
                  }`}
                >
                  {copied ? <><FiCheck /> Copied!</> : <><FiCopy /> Copy Code</>}
                </button>
              </div>
            )}

            {/* Quick stats placeholder – keeps sidebar from looking sparse */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
                Quick Info
              </p>
              <div className="space-y-2.5 text-sm text-gray-400">
                <div className="flex items-center justify-between">
                  <span>Role</span>
                  <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-xs font-medium capitalize text-gray-200">
                    {userRole}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Grade</span>
                  <span className="rounded-full bg-white/[0.07] px-2.5 py-0.5 text-xs font-medium text-gray-200">
                    {classroom.grade_level || '—'}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </GlassDashboardShell>
  );
};

export default ClassroomPage;