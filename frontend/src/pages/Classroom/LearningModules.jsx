import React, { useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  IoBookOutline,
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoGridOutline,
  IoLinkOutline,
  IoPeopleOutline,
  IoRefreshOutline,
  IoSettingsOutline,
} from 'react-icons/io5';
import {
  useAssignResourcesToModule,
  useClassroomAnalytics,
  useClassroomResources,
  useCreateLearningModule,
  useLearningModules,
  useModuleApprovedResources,
  useReorderLearningModules,
} from '../../hooks/useClassroom';
import { LoadingState, ErrorState } from '../../components/Classroom/DashboardCard';
import { ModuleList, LearningModuleProgress } from '../../components/Classroom/ModuleList';
import LearningModulesStudent from '../../components/Classroom/LearningModulesStudent';
import AppBackButton from '../../components/UI/AppBackButton';
import GlassDashboardShell from '../../components/UI/GlassDashboardShell';

const getModuleId = (module) => module?.module_id || module?._id || '';

const getModuleName = (module) => module?.name || module?.title || 'Untitled Module';

const normalizeResourceLink = (urlValue) => {
  if (!urlValue) return '';
  const unwrapQuotes = (value) => {
    let text = String(value || '').trim();
    while (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      text = text.slice(1, -1).trim();
    }
    return text;
  };
  let raw = urlValue;
  if (Array.isArray(raw)) raw = raw.find((item) => typeof item === 'string' && item.trim()) || '';
  let text = unwrapQuotes(raw);
  if (!text) return '';
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text.replace(/'/g, '"'));
      if (Array.isArray(parsed))
        text = unwrapQuotes(parsed.find((item) => typeof item === 'string' && item.trim()) || '');
    } catch {}
  }
  text = unwrapQuotes(text).replace(/\\u0026/g, '&').replace(/&amp;/gi, '&');
  const matched = text.match(/https?:\/\/[^\s'"\]]+/i);
  if (matched) text = matched[0].trim();
  if (!/^https?:\/\//i.test(text) && /^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(text))
    text = `https://${text}`;
  return /^https?:\/\//i.test(text) ? text : '';
};

const getLinkCategory = (resource) => {
  const rawType = String(resource?.resource_type || '').trim().toLowerCase();
  const rawSource = String(resource?.source || '').trim().toLowerCase();
  const link = normalizeResourceLink(resource?.url).toLowerCase();
  if (rawType.includes('youtube') || link.includes('youtube.com') || link.includes('youtu.be'))
    return 'youtube';
  if (
    rawType.includes('blog') ||
    rawSource.includes('blog') ||
    link.includes('medium.com') ||
    link.includes('substack.com') ||
    link.includes('dev.to') ||
    link.includes('hashnode.') ||
    link.includes('wordpress.') ||
    link.includes('blogger.')
  )
    return 'blog';
  return 'article';
};

const toShortTitle = (value, maxLength = 80) => {
  const title = String(value || '').replace(/\s+/g, ' ').trim();
  if (!title) return 'Untitled Resource';
  if (title.length <= maxLength) return title;
  return `${title.slice(0, maxLength - 1).trim()}...`;
};

const getApprovalStatusLabel = (status) => {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
};

// ─── Status pill styles ───────────────────────────────────────────────────────
const statusPillClasses = {
  approved: 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  rejected: 'border border-rose-500/40 bg-rose-500/10 text-rose-400',
  pending: 'border border-amber-500/40 bg-amber-500/10 text-amber-400',
};
const getStatusPillClass = (status) => statusPillClasses[status] ?? statusPillClasses.pending;

const normalizeClassroomRole = (rawRole) => {
  const role = String(rawRole || '').trim().toLowerCase();
  if (role === 'teacher' || role === 'admin' || role === 'student') return role;
  if (role === 'educator' || role === 'instructor' || role === 'faculty') return 'teacher';
  return 'student';
};

const getSortedModules = (modules = []) =>
  [...modules].sort((a, b) => {
    const ao = Number(a?.order || 0);
    const bo = Number(b?.order || 0);
    if (ao !== bo) return ao - bo;
    return getModuleName(a).localeCompare(getModuleName(b));
  });

// ─── Resource card (modern glassmorphic) ────────────────────────────────────
const ResourceCard = ({ resource, actionPendingId, onApprove, onReject, groupKey }) => {
  const resourceId = resource?.resource_id;
  const status = String(resource?.approval_status || 'pending').toLowerCase();
  const link = normalizeResourceLink(resource?.url);
  const isPending = actionPendingId === resourceId;
  const isApproved = status === 'approved';
  const isRejected = status === 'rejected';

  const neonGlow = {
    youtube: 'hover:border-rose-500/60 hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]',
    article: 'hover:border-cyan-500/60 hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]',
    blog: 'hover:border-amber-500/60 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
  }[groupKey] ?? 'hover:border-gray-400/60';

  const Wrapper = link && (groupKey === 'youtube' || link.includes('youtube.com') || link.includes('youtu.be')) ? 'a' : 'article';

  const wrapperProps = Wrapper === 'a'
    ? { href: link, target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <Wrapper {...wrapperProps} className={`group relative flex flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.02] p-5 backdrop-blur-md transition-all duration-300 ${neonGlow}`}>
      {/* Thumbnail (if available) */}
      {resource?.thumbnail_url ? (
        <div className="mb-3">
          <img
            src={resource.thumbnail_url}
            alt={resource?.title || 'resource thumbnail'}
            loading="lazy"
            className="h-36 w-full rounded-md object-cover bg-gray-800"
            onError={(e) => {
              try {
                const img = e.currentTarget;
                const src = img.getAttribute('src') || '';
                if (src.includes('maxresdefault')) {
                  img.src = src.replace('maxresdefault', 'hqdefault');
                  return;
                }
                if (src.includes('hqdefault')) {
                  img.src = src.replace('hqdefault', 'mqdefault');
                  return;
                }
                if (src.includes('mqdefault')) {
                  img.src = src.replace('mqdefault', 'default');
                  return;
                }
                img.style.display = 'none';
              } catch (_err) {
                try { e.currentTarget.style.display = 'none'; } catch (_e) {}
              }
            }}
          />
        </div>
      ) : null}

      <div className="flex items-start justify-between mb-3">
        <span className="rounded-full bg-white/5 px-2.5 py-1 font-mono text-[10px] tracking-wider text-gray-400">
          {resource?.skill || resource?.source || 'GENERAL'}
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusPillClass(status)}`}>
          {getApprovalStatusLabel(status)}
        </span>
      </div>

      <div className="mb-6 flex-1">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug text-gray-100">
          {toShortTitle(resource?.title, 100)}
        </h3>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-4">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { e.stopPropagation(); }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-gray-400 transition-colors hover:bg-cyan-500/20 hover:text-cyan-300"
            title="Open Link"
          >
            <IoLinkOutline className="text-lg" />
          </a>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onApprove(resourceId); }}
            disabled={isPending || isApproved}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <IoCheckmarkCircleOutline className="text-sm" />
            {isApproved ? 'Approved' : 'Approve'}
          </button>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReject(resourceId); }}
            disabled={isPending || isRejected}
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 transition-all hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <IoCloseCircleOutline className="text-sm" />
            {isRejected ? 'Rejected' : 'Reject'}
          </button>
        </div>
      </div>
    </Wrapper>
  );
};

// ─── Resource section (grid with fade reveal) ───────────────────────────────
const ResourceSection = ({ groupKey, label, items, actionPendingId, onApprove, onReject }) => {
  if (!items.length) return null;

  const [expanded, setExpanded] = useState(false);
  const visibleLimit = 6;
  const visibleItems = expanded ? items : items.slice(0, visibleLimit);
  const hasMore = items.length > visibleLimit;

  const accentColors = {
    youtube: 'bg-rose-500',
    article: 'bg-cyan-500',
    blog: 'bg-amber-500',
  }[groupKey] ?? 'bg-gray-400';

  return (
    <section className="relative mb-8 rounded-2xl border border-white/10 bg-[#0B0F19]/60 p-6 backdrop-blur-xl">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-2.5 w-2.5 rounded-full ${accentColors}`} />
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-200">
            {label}
          </h2>
        </div>
        <span className="rounded-full bg-white/5 px-3 py-1 font-mono text-xs text-gray-400 border border-white/5">
          {items.length} Total
        </span>
      </div>

      <div className={`relative grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${!expanded && hasMore ? 'pb-10' : ''}`}>
        {visibleItems.map((resource) => (
          <ResourceCard
            key={resource?.resource_id}
            resource={resource}
            groupKey={groupKey}
            actionPendingId={actionPendingId}
            onApprove={onApprove}
            onReject={onReject}
          />
        ))}

        {!expanded && hasMore && (
          <div className="absolute bottom-0 left-0 right-0 flex h-40 items-end justify-center bg-gradient-to-t from-[#0B0F19] via-[#0B0F19]/80 to-transparent pb-4">
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="group relative inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-all hover:border-white/40 hover:bg-white/10"
            >
              <span>Reveal {items.length - visibleLimit} more</span>
              <IoGridOutline className=" transition-transform group-hover:scale-110" />
            </button>
          </div>
        )}
      </div>

      {expanded && hasMore && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-full border border-white/10 px-6 py-2 text-xs font-medium uppercase tracking-widest text-gray-400 transition-colors hover:border-white/30 hover:text-gray-200"
          >
            Show Less
          </button>
        </div>
      )}
    </section>
  );
};

// ─── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, colorClass, borderClass }) => (
  <div className={`rounded-xl border ${borderClass} bg-gray-900/60 p-4`}>
    <p className={`text-[10.5px] font-medium uppercase tracking-widest ${colorClass} opacity-70`}>
      {label}
    </p>
    <p className={`mt-2 font-mono text-3xl font-semibold tabular-nums ${colorClass}`}>{value}</p>
  </div>
);

// ─── Filter chip ──────────────────────────────────────────────────────────────
const FilterChip = ({ label, active, activeClass, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-3.5 py-1 text-xs font-medium transition-colors ${
      active
        ? activeClass
        : 'border-white/10 bg-transparent text-gray-400 hover:border-white/20 hover:text-gray-300'
    }`}
  >
    {label}
  </button>
);

// ─── Main page ────────────────────────────────────────────────────────────────
const LearningModulesPage = () => {
  const { id: classroomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [userRole] = useState(normalizeClassroomRole(localStorage.getItem('userRole')));
  const canManageModules = userRole === 'teacher' || userRole === 'admin';
  const isResourceHubRoute = location.pathname.toLowerCase().includes('/resources');

  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleDescription, setNewModuleDescription] = useState('');
  const [activeModuleForResources, setActiveModuleForResources] = useState(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [managementMessage, setManagementMessage] = useState('');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [linkCategoryFilter, setLinkCategoryFilter] = useState('all');
  const [resourceActionPendingId, setResourceActionPendingId] = useState('');
  const [resourceActionMessage, setResourceActionMessage] = useState('');
  const [resourceActionError, setResourceActionError] = useState('');

  const { modules, loading: modulesLoading, error: modulesError, refresh: refreshModules } =
    useLearningModules(classroomId);
  const { studentProgress, loading: analyticsLoading } = useClassroomAnalytics(classroomId);
  const {
    resources: classResources,
    summary: classResourceSummary,
    loading: classResourcesLoading,
    error: classResourcesError,
    approveResource,
    refresh: refreshClassResources,
  } = useClassroomResources(classroomId, 'class', isResourceHubRoute && canManageModules);
  const { createModule, loading: creatingModule, error: createModuleError } =
    useCreateLearningModule(classroomId);
  const { reorderModules, loading: reorderingModules, error: reorderModulesError } =
    useReorderLearningModules(classroomId);
  const {
    categories: approvedResourceCategories,
    loading: approvedResourcesLoading,
    error: approvedResourcesError,
    refresh: refreshApprovedResources,
  } = useModuleApprovedResources(classroomId, canManageModules);
  const { assignResources, loading: assigningResources, error: assignResourcesError } =
    useAssignResourcesToModule(classroomId);

  const orderedModules = useMemo(() => getSortedModules(modules), [modules]);
  const activeModule = useMemo(
    () => orderedModules.find((m) => getModuleId(m) === activeModuleForResources) || null,
    [orderedModules, activeModuleForResources]
  );

  const assignableCategories = useMemo(() => {
    if (!activeModule) return [];
    const existingIds = new Set(
      (activeModule.resources || []).map((r) => r?.id || r?.resource_id).filter(Boolean)
    );
    return (approvedResourceCategories || [])
      .map((cat) => ({
        ...cat,
        resources: (cat.resources || []).filter((r) => !existingIds.has(r.resource_id)),
      }))
      .filter((cat) => cat.resources.length > 0);
  }, [activeModule, approvedResourceCategories]);

  const completionPercentage = useMemo(() => {
    if (!studentProgress?.module_progress?.length) return 0;
    const sum = studentProgress.module_progress.reduce(
      (total, item) => total + Number(item.completion_percentage || 0),
      0
    );
    return Math.round(sum / studentProgress.module_progress.length);
  }, [studentProgress]);

  const totalEstimatedHours = useMemo(
    () => modules.reduce((sum, m) => sum + Number(m.estimated_hours || 0), 0),
    [modules]
  );

  const orderedClassResources = useMemo(() => {
    const w = { pending: 0, approved: 1, rejected: 2 };
    return [...(classResources || [])].sort((a, b) => {
      const as = String(a?.approval_status || 'pending').toLowerCase();
      const bs = String(b?.approval_status || 'pending').toLowerCase();
      const aw = w[as] ?? 3;
      const bw = w[bs] ?? 3;
      if (aw !== bw) return aw - bw;
      return String(a?.title || '').localeCompare(String(b?.title || ''));
    });
  }, [classResources]);

  const visibleClassResources = useMemo(() => {
    let filtered = orderedClassResources;
    if (resourceFilter !== 'all')
      filtered = filtered.filter(
        (r) => String(r?.approval_status || 'pending').toLowerCase() === resourceFilter
      );
    if (linkCategoryFilter !== 'all')
      filtered = filtered.filter((r) => getLinkCategory(r) === linkCategoryFilter);
    return filtered;
  }, [orderedClassResources, resourceFilter, linkCategoryFilter]);

  const groupedResourceLinks = useMemo(() => {
    const groups = { youtube: [], article: [], blog: [] };
    for (const r of visibleClassResources) {
      const cat = getLinkCategory(r);
      if (groups[cat]) groups[cat].push(r);
    }
    return [
      { key: 'youtube', label: 'YouTube Links', items: groups.youtube },
      { key: 'article', label: 'Article Links', items: groups.article },
      { key: 'blog', label: 'Blog Links', items: groups.blog },
    ];
  }, [visibleClassResources]);

  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!newModuleName.trim()) { setManagementMessage('Module name is required.'); return; }
    const result = await createModule({
      name: newModuleName.trim(),
      description: newModuleDescription.trim(),
      status: 'published',
    });
    if (result?.success) {
      setManagementMessage('Module created successfully.');
      setNewModuleName('');
      setNewModuleDescription('');
      refreshModules();
      refreshApprovedResources();
      return;
    }
    setManagementMessage(result?.message || 'Failed to create module.');
  };

  const handleMoveModule = async (moduleId, direction) => {
    const ids = orderedModules.map(getModuleId).filter(Boolean);
    const idx = ids.indexOf(moduleId);
    if (idx < 0) return;
    const target = idx + direction;
    if (target < 0 || target >= ids.length) return;
    const reordered = [...ids];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    const result = await reorderModules(reordered);
    setManagementMessage(result?.success ? 'Module order updated.' : result?.message || 'Failed to reorder modules.');
    if (result?.success) refreshModules();
  };

  const handleOpenResourcePicker = (moduleId) => {
    if (activeModuleForResources === moduleId) {
      setActiveModuleForResources(null);
      setSelectedResourceIds([]);
      return;
    }
    setActiveModuleForResources(moduleId);
    setSelectedResourceIds([]);
    refreshApprovedResources();
  };

  const toggleResourceSelection = (resourceId) => {
    setSelectedResourceIds((prev) =>
      prev.includes(resourceId) ? prev.filter((id) => id !== resourceId) : [...prev, resourceId]
    );
  };

  const handleAssignSelectedResources = async () => {
    if (!activeModuleForResources || selectedResourceIds.length === 0) return;
    const result = await assignResources(activeModuleForResources, selectedResourceIds);
    if (result?.success) {
      setManagementMessage(`Assigned ${Number(result.addedCount || 0)} resources to module.`);
      setSelectedResourceIds([]);
      refreshModules();
      refreshApprovedResources();
      return;
    }
    setManagementMessage(result?.message || 'Failed to assign resources.');
  };

  const handleUpdateResourceApproval = async (resourceId, approved) => {
    if (!resourceId) return;
    setResourceActionPendingId(resourceId);
    setResourceActionMessage('');
    setResourceActionError('');
    try {
      await approveResource(resourceId, approved);
      setResourceActionMessage(approved ? 'Resource approved successfully.' : 'Resource rejected successfully.');
    } catch (err) {
      setResourceActionError(err instanceof Error ? err.message : 'Failed to update resource approval status.');
    } finally {
      setResourceActionPendingId('');
    }
  };

  const renderModuleActions = canManageModules
    ? (module) => {
        const moduleId = getModuleId(module);
        const idx = orderedModules.findIndex((m) => getModuleId(m) === moduleId);
        const isActive = moduleId === activeModuleForResources;
        return (
          <>
            <button
              type="button"
              onClick={() => handleMoveModule(moduleId, -1)}
              disabled={idx <= 0 || reorderingModules}
              className="rounded border border-gray-600 px-2 py-1 text-[11px] text-gray-300 hover:border-cyan-500 disabled:opacity-50"
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => handleMoveModule(moduleId, 1)}
              disabled={idx < 0 || idx >= orderedModules.length - 1 || reorderingModules}
              className="rounded border border-gray-600 px-2 py-1 text-[11px] text-gray-300 hover:border-cyan-500 disabled:opacity-50"
            >
              Down
            </button>
            <button
              type="button"
              onClick={() => handleOpenResourcePicker(moduleId)}
              className={`rounded border px-2 py-1 text-[11px] ${
                isActive
                  ? 'border-cyan-500 bg-cyan-500/20 text-cyan-200'
                  : 'border-gray-600 text-gray-300 hover:border-cyan-500'
              }`}
            >
              {isActive ? 'Close' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/classroom/${classroomId}/modules/${moduleId}/assessment-builder`)}
              className="rounded border border-gray-600 px-2 py-1 text-[11px] text-gray-300 hover:border-purple-500"
            >
              Assessment
            </button>
          </>
        );
      }
    : null;

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (isResourceHubRoute && !canManageModules)
    return <Navigate to={`/classroom/${classroomId}/personal-resources`} replace />;

  // ── Resource Hub (Teacher) ──────────────────────────────────────────────────
  if (isResourceHubRoute && canManageModules) {
    const summary = classResourceSummary || { total: 0, approved: 0, pending: 0, rejected: 0 };

    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <div className="space-y-5">
          <AppBackButton
            label="Back to Dashboard"
            fallbackTo={`/classroom/${classroomId}/dashboard`}
          />

          {/* ── Header band ────────────────────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[#1a1230] via-[#130f1e] to-[#0d1520] p-7 shadow-2xl">
            {/* Glow orb */}
            <div className="pointer-events-none absolute -right-10 -top-14 h-56 w-56 rounded-full bg-purple-600/10 blur-3xl" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[3px] text-purple-400">
                  Teacher Resource Hub
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-gray-100">
                  Classroom Resource Review
                </h1>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-gray-400">
                  Review incoming AI resources, approve what fits your syllabus, and reject low-quality entries.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => navigate(`/classroom/${classroomId}/dashboard`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-500/20"
                >
                  <IoGridOutline /> Dashboard
                </button>
                <button
                  onClick={() => navigate(`/classroom/${classroomId}/modules`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20"
                >
                  <IoBookOutline /> Modules
                </button>
                <button
                  onClick={() => refreshClassResources('class')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-medium text-purple-300 transition-colors hover:bg-purple-500/20"
                >
                  <IoRefreshOutline /> Refresh
                </button>
              </div>
            </div>
          </div>

          {/* ── Feedback banner ─────────────────────────────────────────────── */}
          {(resourceActionMessage || resourceActionError || classResourcesError) && (
            <div
              className={`rounded-xl border p-4 text-sm ${
                resourceActionError || classResourcesError
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              }`}
            >
              {resourceActionError || classResourcesError || resourceActionMessage}
            </div>
          )}

          {/* ── Stat cards ──────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Total" value={Number(summary.total || 0)} colorClass="text-cyan-400" borderClass="border-cyan-500/20" />
            <StatCard label="Approved" value={Number(summary.approved || 0)} colorClass="text-emerald-400" borderClass="border-emerald-500/20" />
            <StatCard label="Pending" value={Number(summary.pending || 0)} colorClass="text-amber-400" borderClass="border-amber-500/20" />
            <StatCard label="Rejected" value={Number(summary.rejected || 0)} colorClass="text-rose-400" borderClass="border-rose-500/20" />
          </div>

          {/* ── Filters ─────────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-white/[0.07] bg-gray-900/60 px-5 py-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[10.5px] uppercase tracking-widest text-gray-500">Status</span>
              {[
                { value: 'all', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ].map((opt) => (
                <FilterChip
                  key={opt.value}
                  label={opt.label}
                  active={resourceFilter === opt.value}
                  activeClass="border-purple-500/40 bg-purple-500/15 text-purple-300"
                  onClick={() => setResourceFilter(opt.value)}
                />
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[10.5px] uppercase tracking-widest text-gray-500">Type</span>
              {[
                { value: 'all', label: 'All links' },
                { value: 'youtube', label: 'YouTube' },
                { value: 'article', label: 'Articles' },
                { value: 'blog', label: 'Blogs' },
              ].map((opt) => (
                <FilterChip
                  key={opt.value}
                  label={opt.label}
                  active={linkCategoryFilter === opt.value}
                  activeClass="border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                  onClick={() => setLinkCategoryFilter(opt.value)}
                />
              ))}
            </div>
          </div>

          {/* ── Resource list ────────────────────────────────────────────────── */}
          {classResourcesLoading ? (
            <LoadingState message="Loading classroom resources..." />
          ) : visibleClassResources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-10 text-center">
              <p className="text-gray-300">No resources match this filter.</p>
              <p className="mt-1.5 text-sm text-gray-500">
                Try switching filters or generate new resources from your dashboard.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupedResourceLinks.map((group) => (
                <ResourceSection
                  key={group.key}
                  groupKey={group.key}
                  label={group.label}
                  items={group.items}
                  actionPendingId={resourceActionPendingId}
                  onApprove={(id) => handleUpdateResourceApproval(id, true)}
                  onReject={(id) => handleUpdateResourceApproval(id, false)}
                />
              ))}
            </div>
          )}
        </div>
      </GlassDashboardShell>
    );
  }

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (modulesLoading)
    return <GlassDashboardShell contentClassName="max-w-7xl"><LoadingState message="Loading curriculum modules..." /></GlassDashboardShell>;
  if (modulesError)
    return <GlassDashboardShell contentClassName="max-w-7xl"><ErrorState message={modulesError} /></GlassDashboardShell>;

  // ── Student view ───────────────────────────────────────────────────────────
  if (!canManageModules)
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <div className="space-y-4">
          <AppBackButton
            label="Back to Dashboard"
            fallbackTo={`/classroom/${classroomId}/dashboard`}
          />
          <LearningModulesStudent classroomId={classroomId} modules={orderedModules} />
        </div>
      </GlassDashboardShell>
    );

  // ── Teacher modules view ───────────────────────────────────────────────────
  return (
    <GlassDashboardShell contentClassName="max-w-7xl">
      <div className="space-y-6">
        <AppBackButton
          label="Back to Dashboard"
          fallbackTo={`/classroom/${classroomId}/dashboard`}
        />

        <div className="rounded-2xl border border-slate-700/70 bg-gradient-to-r from-slate-900 via-gray-900 to-slate-800 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-300">
                {canManageModules ? 'Teacher and Admin Modules' : 'Student Modules'}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-gray-100">Learning Curriculum</h1>
              <p className="mt-2 text-sm text-gray-300">
                {modules.length} modules available across your classroom pathway.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              <button onClick={() => navigate(`/classroom/${classroomId}/dashboard`)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-cyan-500 px-3 py-2 font-medium text-white transition-colors hover:bg-cyan-600">
                <IoGridOutline /> Dashboard
              </button>
              <button onClick={() => navigate(`/classroom/${classroomId}/roster`)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 font-medium text-white transition-colors hover:bg-emerald-600">
                <IoPeopleOutline /> Roster
              </button>
              <button onClick={() => navigate(`/classroom/${classroomId}/settings`)} className="inline-flex items-center justify-center gap-1 rounded-lg bg-gray-700 px-3 py-2 font-medium text-white transition-colors hover:bg-gray-600">
                <IoSettingsOutline /> Settings
              </button>
            </div>
          </div>
        </div>

        {managementMessage && (
          <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
            <p className="text-sm text-blue-100">{managementMessage}</p>
          </div>
        )}

        {(createModuleError || reorderModulesError || approvedResourcesError || assignResourcesError) && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <p className="text-sm text-red-200">
              {createModuleError || reorderModulesError || approvedResourcesError || assignResourcesError}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
            <p className="text-xs text-cyan-200/80">Total Modules</p>
            <p className="mt-1 text-2xl font-bold text-cyan-100">{modules.length}</p>
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
            <p className="text-xs text-blue-200/80">Estimated Hours</p>
            <p className="mt-1 text-2xl font-bold text-blue-100">{totalEstimatedHours.toFixed(1)}</p>
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-xs text-emerald-200/80">
              {canManageModules ? 'Class Completion Signal' : 'My Completion'}
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-100">{completionPercentage}%</p>
          </div>
        </div>

        {canManageModules && (
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-6">
            <h2 className="text-xl font-semibold text-gray-100">Manage Modules</h2>
            <p className="mt-1 text-sm text-gray-400">
              Create modules manually, reorder them, and attach approved resources to any module.
            </p>
            <form onSubmit={handleCreateModule} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-12">
              <input type="text" value={newModuleName} onChange={(e) => setNewModuleName(e.target.value)} placeholder="Module name" className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none md:col-span-4" />
              <input type="text" value={newModuleDescription} onChange={(e) => setNewModuleDescription(e.target.value)} placeholder="Module description (optional)" className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none md:col-span-6" />
              <button type="submit" disabled={creatingModule} className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60 md:col-span-2">
                {creatingModule ? 'Adding...' : 'Add Module'}
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8 rounded-xl border border-gray-700 bg-gray-900/50 p-6">
            <h2 className="text-xl font-semibold text-gray-100">Published Modules</h2>
            <p className="mt-1 text-sm text-gray-400">Open any module card for objectives, resources, and difficulty details.</p>
            <div className="mt-5">
              <ModuleList modules={modules} loading={modulesLoading} moduleActions={renderModuleActions} />
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
            {userRole === 'student' && studentProgress ? (
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-6">
                <h3 className="text-lg font-semibold text-cyan-100">My Progress</h3>
                <p className="mt-1 text-sm text-cyan-100/80">Track completion and assessment coverage by module.</p>
                <div className="mt-4">
                  <LearningModuleProgress modules={modules} studentProgress={studentProgress} loading={analyticsLoading} />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-6">
                <h3 className="text-lg font-semibold text-emerald-100">Instructor Guidance</h3>
                <ul className="mt-3 space-y-2 text-sm text-emerald-100/90">
                  <li className="flex items-start gap-2"><IoCheckmarkCircleOutline className="mt-0.5" /> Keep module titles aligned to syllabus outcomes.</li>
                  <li className="flex items-start gap-2"><IoCheckmarkCircleOutline className="mt-0.5" /> Use Add on each module to attach approved resources.</li>
                  <li className="flex items-start gap-2"><IoCheckmarkCircleOutline className="mt-0.5" /> Sort modules with Up and Down controls.</li>
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-blue-500/25 bg-blue-500/10 p-6">
              <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-blue-100">
                <IoBookOutline /> Curriculum Workflow
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-blue-100/90">
                <li>1. Review module order and required outcomes.</li>
                <li>2. Attach approved resources to each module.</li>
                <li>3. Monitor completion trends before publishing new content.</li>
              </ul>
            </div>
          </div>
        </div>

        {canManageModules && activeModule && (
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-purple-100">
                  Add Approved Resources to {getModuleName(activeModule)}
                </h3>
                <p className="text-sm text-purple-100/80">Resources are grouped by syllabus category. Select and assign to this module.</p>
              </div>
              <button type="button" onClick={refreshApprovedResources} className="inline-flex items-center gap-1 rounded-lg border border-purple-300/30 bg-purple-900/30 px-3 py-2 text-sm text-purple-100 hover:bg-purple-800/40">
                <IoRefreshOutline /> Refresh
              </button>
            </div>

            {approvedResourcesLoading ? (
              <div className="mt-4 text-sm text-purple-100/80">Loading approved resources...</div>
            ) : assignableCategories.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-purple-300/30 p-4 text-sm text-purple-100/90">
                No unassigned approved resources are available for this module.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {assignableCategories.map((category, i) => (
                  <div key={`${category.category}-${i}`} className="rounded-lg border border-purple-300/30 bg-gray-900/40 p-4">
                    <h4 className="text-sm font-semibold text-purple-100">{category.category}</h4>
                    <div className="mt-3 space-y-2">
                      {(category.resources || []).map((resource) => (
                        <label key={resource.resource_id} className="flex items-start gap-2 rounded border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-gray-200">
                          <input type="checkbox" checked={selectedResourceIds.includes(resource.resource_id)} onChange={() => toggleResourceSelection(resource.resource_id)} className="mt-0.5" />
                          <div>
                            <p className="font-medium text-gray-100">{resource.title}</p>
                            <p className="text-xs text-gray-400">{resource.resource_type}{resource.skill ? ` | ${resource.skill}` : ''}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={handleAssignSelectedResources} disabled={assigningResources || selectedResourceIds.length === 0} className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-60">
                {assigningResources ? 'Assigning...' : `Add Selected (${selectedResourceIds.length})`}
              </button>
              <button type="button" onClick={() => { setSelectedResourceIds([]); setActiveModuleForResources(null); }} className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700">
                Close
              </button>
            </div>
          </div>
        )}

        {modules.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-600 p-6 text-center text-gray-300">
            <p className="text-lg">No learning modules available yet.</p>
            <p className="mt-2 text-sm text-gray-400">
              {canManageModules
                ? 'Create your first module manually above. Classroom creation AI also seeds modules from curriculum focus areas.'
                : 'Your teacher will publish modules soon.'}
            </p>
          </div>
        )}
      </div>
    </GlassDashboardShell>
  );
};

export default LearningModulesPage;