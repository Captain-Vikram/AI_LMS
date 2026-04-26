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
  IoAdd,
  IoInformationCircleOutline,
  IoLayersOutline,
  IoArrowUpOutline,
  IoArrowDownOutline,
  IoStatsChartOutline,
  IoTimeOutline,
  IoCreateOutline,
  IoSparklesOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import {
  useAssignResourcesToModule,
  useClassroomAnalytics,
  useClassroomResources,
  useCreateLearningModule,
  useLearningModules,
  useModuleApprovedResources,
  useReorderLearningModules,
  useDeleteLearningModule,
  useRemoveResourceFromModule,
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

const ResourceSection = ({ groupKey, label, items, actionPendingId, onApprove, onReject }) => {
  const [expanded, setExpanded] = useState(false);
  
  if (!items.length) return null;

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

const StatCard = ({ label, value, icon: Icon, colorClass, borderClass }) => (
  <div className={`group relative rounded-2xl border ${borderClass} bg-gray-900/40 p-5 backdrop-blur-sm transition-all duration-300 hover:bg-gray-900/60`}>
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${colorClass} opacity-60`}>
          {label}
        </p>
        <p className={`mt-1 font-mono text-3xl font-black tabular-nums ${colorClass}`}>{value}</p>
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 transition-transform group-hover:scale-110`}>
        <Icon className={`text-xl ${colorClass}`} />
      </div>
    </div>
  </div>
);

const FilterChip = ({ label, active, activeClass, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full border px-4 py-1.5 text-xs font-bold transition-all ${
      active
        ? activeClass
        : 'border-white/5 bg-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300'
    }`}
  >
    {label}
  </button>
);

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

  const [isManualResourceModalOpen, setIsManualResourceModalOpen] = useState(false);
  const [manualResourceData, setManualResourceData] = useState({
    title: '',
    url: '',
    resource_type: 'youtube',
    skill: 'General',
  });

  const { modules, loading: modulesLoading, error: modulesError, refresh: refreshModules } =
    useLearningModules(classroomId);
  const { studentProgress, loading: analyticsLoading } = useClassroomAnalytics(classroomId);
  const {
    resources: classResources,
    summary: classResourceSummary,
    loading: classResourcesLoading,
    error: classResourcesError,
    approveResource,
    addManualResource,
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
  const { deleteModule, loading: deletingModule } = useDeleteLearningModule(classroomId);
  const { removeResource: removeResourceFromModule, loading: removingResource } = useRemoveResourceFromModule(classroomId);

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

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Are you sure you want to remove this module? Resources will be unlinked.')) return;
    const result = await deleteModule(moduleId);
    if (result?.success) {
      setManagementMessage('Module removed successfully.');
      refreshModules();
      if (activeModuleForResources === moduleId) {
        setActiveModuleForResources(null);
        setSelectedResourceIds([]);
      }
      return;
    }
    setManagementMessage(result?.message || 'Failed to remove module.');
  };

  const handleRemoveResource = async (moduleId, resourceId) => {
    if (!window.confirm('Are you sure you want to remove this resource from the module?')) return;
    const result = await removeResourceFromModule(moduleId, resourceId);
    if (result?.success) {
      setManagementMessage('Resource removed from module.');
      refreshModules();
      return;
    }
    setManagementMessage(result?.message || 'Failed to remove resource.');
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

  const handleAddManualResource = async (e) => {
    e.preventDefault();
    if (!manualResourceData.title.trim() || !manualResourceData.url.trim()) {
      setResourceActionError('Title and URL are required.');
      return;
    }
    const result = await addManualResource({
      title: manualResourceData.title.trim(),
      url: manualResourceData.url.trim(),
      resource_type: manualResourceData.resource_type,
      skill: manualResourceData.skill.trim() || 'General',
    });
    if (result?.success) {
      setResourceActionMessage('Resource added successfully.');
      setIsManualResourceModalOpen(false);
      setManualResourceData({
        title: '',
        url: '',
        resource_type: 'youtube',
        skill: 'General',
      });
      refreshClassResources('class');
      return;
    }
    setResourceActionError(result?.message || 'Failed to add resource.');
  };

  const renderModuleActions = canManageModules
    ? (module) => {
        const moduleId = getModuleId(module);
        const idx = orderedModules.findIndex((m) => getModuleId(m) === moduleId);
        const isActive = moduleId === activeModuleForResources;
        return (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleMoveModule(moduleId, -1)}
              disabled={idx <= 0 || reorderingModules}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/5 bg-white/5 text-gray-400 transition-all hover:border-cyan-500/50 hover:text-cyan-400 disabled:opacity-30"
              title="Move Up"
            >
              <IoArrowUpOutline />
            </button>
            <button
              type="button"
              onClick={() => handleMoveModule(moduleId, 1)}
              disabled={idx < 0 || idx >= orderedModules.length - 1 || reorderingModules}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/5 bg-white/5 text-gray-400 transition-all hover:border-cyan-500/50 hover:text-cyan-400 disabled:opacity-30"
              title="Move Down"
            >
              <IoArrowDownOutline />
            </button>
            <button
              type="button"
              onClick={() => handleOpenResourcePicker(moduleId)}
              className={`flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${
                isActive
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                  : 'border-white/5 bg-white/5 text-gray-400 hover:border-emerald-500/50 hover:text-emerald-400'
              }`}
            >
              <IoAdd className="text-sm" />
              {isActive ? 'Active' : 'Add'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/classroom/${classroomId}/modules/${moduleId}/assessment-builder`)}
              className="flex h-7 items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2.5 text-[10px] font-black uppercase tracking-widest text-gray-400 transition-all hover:border-purple-500/50 hover:text-purple-400"
            >
              <IoStatsChartOutline className="text-[10px]" />
              Assess
            </button>
            <button
              type="button"
              onClick={() => handleDeleteModule(moduleId)}
              disabled={deletingModule}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/5 bg-white/5 text-gray-400 transition-all hover:border-rose-500/50 hover:text-rose-400 disabled:opacity-30"
              title="Remove Module"
            >
              <IoTrashOutline />
            </button>
          </div>
        );
      }
    : null;

  if (isResourceHubRoute && !canManageModules)
    return <Navigate to={`/classroom/${classroomId}/personal-resources`} replace />;

  if (isResourceHubRoute && canManageModules) {
    const summary = classResourceSummary || { total: 0, approved: 0, pending: 0, rejected: 0 };

    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <div className="space-y-6">
          <AppBackButton
            label="Back to Dashboard"
            fallbackTo={`/classroom/${classroomId}/dashboard`}
          />

          <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gray-900/40 p-8 backdrop-blur-md shadow-2xl">
            <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-purple-600/10 blur-[100px]" />
            <div className="pointer-events-none absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-cyan-600/10 blur-[100px]" />

            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                   <div className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-400">
                     Management Hub
                   </p>
                </div>
                <h1 className="text-4xl font-black tracking-tight text-white">
                  Classroom Resource Review
                </h1>
                <p className="mt-2 max-w-xl text-base text-gray-400">
                  Audit incoming AI-generated materials, verify syllabus alignment, and certify content for module distribution.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate(`/classroom/${classroomId}/dashboard`)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-bold text-gray-200 transition-all hover:bg-white/10 hover:scale-105 active:scale-95"
                >
                  <IoGridOutline /> Dashboard
                </button>
                <button
                  onClick={() => navigate(`/classroom/${classroomId}/modules`)}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 text-sm font-bold text-emerald-300 transition-all hover:bg-emerald-500/20 hover:scale-105 active:scale-95"
                >
                  <IoBookOutline /> Modules
                </button>
                <button
                  onClick={() => refreshClassResources('class')}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-purple-500/20 bg-purple-500/10 px-5 text-sm font-bold text-purple-300 transition-all hover:bg-purple-500/20 hover:scale-105 active:scale-95"
                >
                  <IoRefreshOutline /> Refresh
                </button>
              </div>
            </div>
          </div>

          {(resourceActionMessage || resourceActionError || classResourcesError) && (
            <div
              className={`rounded-2xl border p-5 animate-in slide-in-from-top-4 duration-300 ${
                resourceActionError || classResourcesError
                  ? 'border-rose-500/30 bg-rose-500/5 text-rose-300'
                  : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <IoInformationCircleOutline className="text-xl" />
                <p className="text-sm font-medium">{resourceActionError || classResourcesError || resourceActionMessage}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Total Hub" value={Number(summary.total || 0)} icon={IoLayersOutline} colorClass="text-gray-200" borderClass="border-white/5" />
            <StatCard label="Approved" value={Number(summary.approved || 0)} icon={IoCheckmarkCircleOutline} colorClass="text-emerald-400" borderClass="border-emerald-500/20" />
            <StatCard label="Pending" value={Number(summary.pending || 0)} icon={IoTimeOutline} colorClass="text-amber-400" borderClass="border-amber-500/20" />
            <StatCard label="Rejected" value={Number(summary.rejected || 0)} icon={IoCloseCircleOutline} colorClass="text-rose-400" borderClass="border-rose-500/20" />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-4 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-3">
              <span className="mr-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Filter Status</span>
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
                  activeClass="border-purple-500/50 bg-purple-500/20 text-purple-200"
                  onClick={() => setResourceFilter(opt.value)}
                />
              ))}
            </div>

            <div className="h-6 w-px bg-white/5 hidden md:block" />

            <div className="flex flex-wrap items-center gap-3">
              <span className="mr-2 text-[10px] font-black uppercase tracking-widest text-gray-500">Content Type</span>
              {[
                { value: 'all', label: 'Any' },
                { value: 'youtube', label: 'YouTube' },
                { value: 'article', label: 'Articles' },
                { value: 'blog', label: 'Blogs' },
              ].map((opt) => (
                <FilterChip
                  key={opt.value}
                  label={opt.label}
                  active={linkCategoryFilter === opt.value}
                  activeClass="border-cyan-500/50 bg-cyan-500/20 text-cyan-200"
                  onClick={() => setLinkCategoryFilter(opt.value)}
                />
              ))}
              
              {canManageModules && (
                <button
                  onClick={() => setIsManualResourceModalOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-purple-500/40 bg-purple-500/10 text-purple-400 transition-all hover:bg-purple-500/20"
                  title="Add Custom Resource"
                >
                  <IoAdd size={18} />
                </button>
              )}
            </div>
          </div>

          {/* ── Manual Resource Modal ────────────────────────────────────── */}
          {isManualResourceModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0B0F19] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                     <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                        <IoAdd className="text-2xl" />
                     </div>
                     <h3 className="text-xl font-black text-gray-100">Add Custom Resource</h3>
                  </div>
                  <button
                    onClick={() => setIsManualResourceModalOpen(false)}
                    className="text-gray-500 hover:text-gray-200 transition-colors"
                  >
                    <IoCloseCircleOutline size={28} />
                  </button>
                </div>

                <form onSubmit={handleAddManualResource} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                      Resource Title
                    </label>
                    <input
                      type="text"
                      required
                      value={manualResourceData.title}
                      onChange={(e) => setManualResourceData({ ...manualResourceData, title: e.target.value })}
                      placeholder="e.g. Advanced React Patterns"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-700 focus:border-purple-500/50 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                      Resource URL
                    </label>
                    <input
                      type="url"
                      required
                      value={manualResourceData.url}
                      onChange={(e) => setManualResourceData({ ...manualResourceData, url: e.target.value })}
                      placeholder="https://youtube.com/... or https://blog..."
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-700 focus:border-purple-500/50 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                        Type
                      </label>
                      <select
                        value={manualResourceData.resource_type}
                        onChange={(e) => setManualResourceData({ ...manualResourceData, resource_type: e.target.value })}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-purple-500/50 focus:outline-none appearance-none cursor-pointer"
                      >
                        <option value="youtube" className="bg-[#0B0F19]">YouTube</option>
                        <option value="article" className="bg-[#0B0F19]">Article</option>
                        <option value="blog" className="bg-[#0B0F19]">Blog</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">
                        Skill Tag
                      </label>
                      <input
                        type="text"
                        value={manualResourceData.skill}
                        onChange={(e) => setManualResourceData({ ...manualResourceData, skill: e.target.value })}
                        placeholder="General"
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-700 focus:border-purple-500/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsManualResourceModalOpen(false)}
                      className="flex-1 rounded-2xl border border-white/10 bg-transparent py-3.5 text-sm font-black text-gray-400 transition-colors hover:bg-white/5"
                    >
                      CANCEL
                    </button>
                    <button
                      type="submit"
                      className="flex-1 rounded-2xl bg-purple-600 py-3.5 text-sm font-black text-white transition-all hover:bg-purple-500 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]"
                    >
                      ADD RESOURCE
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {classResourcesLoading ? (
            <LoadingState message="Scanning classroom resources..." />
          ) : visibleClassResources.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/5 p-20 text-center bg-white/[0.01]">
              <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-6">
                 <IoLayersOutline className="text-3xl text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-300">Archive Empty</h3>
              <p className="mt-2 max-w-xs text-sm text-gray-500 leading-relaxed">
                No resources match your current workspace filters. Try broadening your criteria.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
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

  if (modulesLoading)
    return <GlassDashboardShell contentClassName="max-w-7xl"><LoadingState message="Mapping curriculum modules..." /></GlassDashboardShell>;
  if (modulesError)
    return <GlassDashboardShell contentClassName="max-w-7xl"><ErrorState message={modulesError} /></GlassDashboardShell>;

  if (!canManageModules)
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <div className="space-y-6">
          <AppBackButton
            label="Back to Dashboard"
            fallbackTo={`/classroom/${classroomId}/dashboard`}
          />
          <LearningModulesStudent classroomId={classroomId} modules={orderedModules} />
        </div>
      </GlassDashboardShell>
    );

  return (
    <GlassDashboardShell contentClassName="max-w-7xl">
      <div className="space-y-8 pb-20">
        <AppBackButton
          label="Back to Dashboard"
          fallbackTo={`/classroom/${classroomId}/dashboard`}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 relative overflow-hidden rounded-3xl border border-white/5 bg-gray-900/40 p-10 backdrop-blur-md shadow-2xl">
            <div className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-cyan-600/10 blur-[100px]" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div>
                <div className="flex items-center gap-2 mb-2">
                   <div className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">
                     Curriculum Core
                   </p>
                </div>
                <h1 className="text-4xl font-black tracking-tight text-white">Learning Modules</h1>
                <p className="mt-2 max-w-md text-base text-gray-400 leading-relaxed">
                  Orchestrate your classroom's educational journey by structuring modules and assigning verified resources.
                </p>
              </div>
              
              <div className="flex flex-col gap-2">
                <button onClick={() => navigate(`/classroom/${classroomId}/dashboard`)} className="group flex h-11 items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-6 text-sm font-bold text-gray-200 transition-all hover:bg-white/10 hover:scale-105 active:scale-95">
                  <IoGridOutline className="group-hover:text-cyan-400 transition-colors" /> Dashboard
                </button>
                <div className="flex gap-2">
                   <button onClick={() => navigate(`/classroom/${classroomId}/roster`)} className="group flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-bold text-emerald-300 transition-all hover:bg-emerald-500/20 hover:scale-105">
                     <IoPeopleOutline /> Roster
                   </button>
                   <button onClick={() => navigate(`/classroom/${classroomId}/settings`)} className="group flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-gray-300 transition-all hover:bg-white/10 hover:scale-105">
                     <IoSettingsOutline />
                   </button>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 grid grid-cols-1 gap-4">
             <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 backdrop-blur-sm relative group overflow-hidden">
                <IoLayersOutline className="absolute -right-4 -bottom-4 text-8xl text-cyan-500/5 transition-transform group-hover:scale-110" />
                <p className="text-[10px] font-black uppercase tracking-widest text-cyan-500/60 mb-2">Structure</p>
                <p className="text-3xl font-black text-white">{modules.length} <span className="text-lg font-bold text-cyan-400/60 ml-1">Modules</span></p>
             </div>
             <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6 backdrop-blur-sm relative group overflow-hidden">
                <IoTimeOutline className="absolute -right-4 -bottom-4 text-8xl text-purple-500/5 transition-transform group-hover:scale-110" />
                <p className="text-[10px] font-black uppercase tracking-widest text-purple-500/60 mb-2">Duration</p>
                <p className="text-3xl font-black text-white">{totalEstimatedHours.toFixed(1)} <span className="text-lg font-bold text-purple-400/60 ml-1">Hours</span></p>
             </div>
          </div>
        </div>

        {managementMessage && (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 text-cyan-300">
               <IoInformationCircleOutline className="text-xl" />
               <p className="text-sm font-medium">{managementMessage}</p>
            </div>
          </div>
        )}

        {(createModuleError || reorderModulesError || approvedResourcesError || assignResourcesError) && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 text-rose-300">
               <IoCloseCircleOutline className="text-xl" />
               <p className="text-sm font-medium">{createModuleError || reorderModulesError || approvedResourcesError || assignResourcesError}</p>
            </div>
          </div>
        )}

        {canManageModules && (
          <div className="relative group rounded-3xl border border-white/5 bg-white/[0.01] p-8 transition-all hover:bg-white/[0.02]">
            <div className="flex items-center gap-3 mb-6">
               <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                  <IoCreateOutline className="text-xl" />
               </div>
               <div>
                  <h2 className="text-lg font-black text-gray-100">Manual Module Construction</h2>
                  <p className="text-xs text-gray-500 font-medium">Seed new learning blocks directly into the curriculum sequence.</p>
               </div>
            </div>
            
            <form onSubmit={handleCreateModule} className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-4 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Module Identity</label>
                <input 
                  type="text" 
                  value={newModuleName} 
                  onChange={(e) => setNewModuleName(e.target.value)} 
                  placeholder="e.g. Advanced Thermodynamics" 
                  className="w-full rounded-2xl border border-white/5 bg-gray-950/60 px-4 py-3.5 text-sm text-white placeholder-gray-700 transition-all focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 outline-none" 
                />
              </div>
              <div className="lg:col-span-6 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">Scope & Objectives</label>
                <input 
                  type="text" 
                  value={newModuleDescription} 
                  onChange={(e) => setNewModuleDescription(e.target.value)} 
                  placeholder="Summarize the core learning outcomes..." 
                  className="w-full rounded-2xl border border-white/5 bg-gray-950/60 px-4 py-3.5 text-sm text-white placeholder-gray-700 transition-all focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 outline-none" 
                />
              </div>
              <button 
                type="submit" 
                disabled={creatingModule} 
                className="lg:col-span-2 group relative h-12 inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-6 text-sm font-black text-white transition-all hover:bg-cyan-500 active:scale-95 disabled:opacity-50"
              >
                {creatingModule ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <IoAdd className="text-lg" /> 
                    ADD UNIT
                  </>
                )}
                <div className="absolute inset-0 rounded-2xl bg-cyan-400/0 blur-xl group-hover:bg-cyan-400/10 transition-all" />
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-12">
          <div className="xl:col-span-8 space-y-6">
            <div className="rounded-3xl border border-white/5 bg-gray-900/20 p-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black text-white">Active Curriculum</h2>
                  <p className="mt-1 text-xs text-gray-500 font-medium tracking-wide">Manage the sequential learning path and resource mapping.</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-gray-600">
                   <IoLayersOutline />
                </div>
              </div>
              
              <div className="min-h-[400px]">
                <ModuleList 
                  modules={modules} 
                  loading={modulesLoading} 
                  moduleActions={renderModuleActions} 
                  activeModuleId={activeModuleForResources}
                  onRemoveResource={canManageModules ? handleRemoveResource : null}
                  activeModuleContent={
                    activeModule && (
                      <div className="space-y-8">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                               <div className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-pulse" />
                               <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-purple-400">
                                 Mapping Workspace
                               </h3>
                            </div>
                            <h2 className="text-xl font-black text-white">
                              Map Resources
                            </h2>
                          </div>
                          <div className="flex gap-2">
                             <button type="button" onClick={refreshApprovedResources} className="flex h-9 items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 text-xs font-bold text-gray-300 hover:bg-white/10 transition-all">
                              <IoRefreshOutline className={approvedResourcesLoading ? 'animate-spin' : ''} />
                             </button>
                             <button type="button" onClick={() => { setSelectedResourceIds([]); setActiveModuleForResources(null); }} className="flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-bold text-gray-400 hover:bg-white/10 transition-all">
                              <IoCloseCircleOutline /> Exit
                             </button>
                          </div>
                        </div>

                        {approvedResourcesLoading ? (
                          <div className="flex flex-col items-center justify-center py-10 bg-white/[0.01] rounded-2xl border border-white/5">
                             <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-purple-500 border-r-purple-500/30 mb-3" />
                             <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Scanning Catalog...</p>
                          </div>
                        ) : assignableCategories.length === 0 ? (
                          <div className="rounded-2xl border-2 border-dashed border-white/5 p-10 text-center bg-white/[0.01]">
                             <IoLayersOutline className="mx-auto text-3xl text-gray-700 mb-4" />
                             <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed font-medium">
                               All certified resources are already mapped. Generate more from the Resource Hub.
                             </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {assignableCategories.map((category, i) => (
                              <div key={`${category.category}-${i}`} className="flex flex-col rounded-2xl border border-white/5 bg-gray-900/40 p-5 backdrop-blur-sm">
                                <div className="flex items-center gap-2 mb-4">
                                   <div className="h-1 w-1 rounded-full bg-purple-400" />
                                   <h4 className="text-[9px] font-black uppercase tracking-widest text-purple-400/80">{category.category}</h4>
                                </div>
                                
                                <div className="space-y-2 flex-1 overflow-y-auto max-h-[250px] pr-1 custom-scrollbar">
                                  {(category.resources || []).map((resource) => {
                                    const isSelected = selectedResourceIds.includes(resource.resource_id);
                                    return (
                                      <label 
                                        key={resource.resource_id} 
                                        className={`group flex items-start gap-3 rounded-xl border p-3 transition-all cursor-pointer ${
                                          isSelected 
                                            ? 'border-purple-500 bg-purple-500/10' 
                                            : 'border-white/5 bg-gray-950/40 hover:border-white/10 hover:bg-gray-950/60'
                                        }`}
                                      >
                                        <div className="relative mt-0.5">
                                          <input 
                                            type="checkbox" 
                                            checked={isSelected} 
                                            onChange={() => toggleResourceSelection(resource.resource_id)} 
                                            className="hidden" 
                                          />
                                          <div className={`h-4 w-4 rounded-md border-2 transition-all flex items-center justify-center ${isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-700 group-hover:border-gray-500'}`}>
                                             {isSelected && <IoCheckmarkCircleOutline className="text-white text-[10px]" />}
                                          </div>
                                        </div>
                                        <div className="flex-1">
                                          <p className={`text-xs font-bold leading-tight transition-colors ${isSelected ? 'text-white' : 'text-gray-300 group-hover:text-gray-100'}`}>
                                            {resource.title}
                                          </p>
                                          <p className="mt-1 text-[9px] font-black text-gray-500 uppercase tracking-widest">
                                            {resource.resource_type}
                                          </p>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/5 pt-6">
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                            {selectedResourceIds.length > 0 
                               ? `${selectedResourceIds.length} items ready for mapping` 
                               : "Select items from the catalog"}
                          </p>
                          
                          <button 
                            type="button" 
                            onClick={handleAssignSelectedResources} 
                            disabled={assigningResources || selectedResourceIds.length === 0} 
                            className="group relative h-11 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 text-xs font-black text-gray-950 transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                          >
                            {assigningResources ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-950/30 border-t-gray-950" />
                            ) : (
                              <>
                                <IoAdd className="text-lg" />
                                MAP TO UNIT
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  }
                />
              </div>
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
            {userRole === 'student' && studentProgress ? (
              <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-8 backdrop-blur-md">
                <div className="flex items-center gap-3 mb-6">
                   <div className="h-10 w-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                      <IoStatsChartOutline className="text-xl text-cyan-400" />
                   </div>
                   <h3 className="text-lg font-black text-white leading-tight">Sync Progress</h3>
                </div>
                <div className="mt-6">
                  <LearningModuleProgress modules={modules} studentProgress={studentProgress} loading={analyticsLoading} />
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-8 backdrop-blur-md">
                <div className="flex items-center gap-3 mb-6">
                   <div className="h-10 w-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <IoInformationCircleOutline className="text-xl text-emerald-400" />
                   </div>
                   <h3 className="text-lg font-black text-white leading-tight">Instructor Guide</h3>
                </div>
                <ul className="space-y-5">
                  {[
                    "Align module outcomes with the primary syllabus.",
                    "Map exactly 3-5 high-quality resources per module.",
                    "Utilize reordering to maintain conceptual flow."
                  ].map((text, i) => (
                    <li key={i} className="flex items-start gap-4 text-sm text-emerald-100/70 group">
                      <div className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-black text-emerald-400 transition-all group-hover:bg-emerald-500 group-hover:text-white">
                        {i + 1}
                      </div>
                      <p className="leading-relaxed">{text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-3xl border border-indigo-500/20 bg-indigo-500/5 p-8 backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6">
                 <div className="h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                    <IoBookOutline className="text-xl text-indigo-400" />
                 </div>
                 <h3 className="text-lg font-black text-white leading-tight">Workflow Hub</h3>
              </div>
              <div className="space-y-6">
                {[
                   { t: "Validation", d: "Verify AI-scraped resources in the hub." },
                   { t: "Mapping", d: "Assign certified content to specific units." },
                   { t: "Assessment", d: "Configure AI-powered defenses per module." }
                ].map((item, i) => (
                  <div key={i} className="relative pl-6 border-l border-white/10 group">
                    <div className="absolute left-[-1px] top-0 h-4 w-px bg-indigo-500 group-hover:h-full transition-all duration-500" />
                    <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">{item.t}</p>
                    <p className="mt-1 text-sm text-gray-400 font-medium">{item.d}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {modules.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 rounded-[2.5rem] border-2 border-dashed border-white/5 bg-white/[0.01] text-center">
             <div className="relative mb-8">
                <div className="h-24 w-24 rounded-full bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                   <IoLayersOutline className="text-4xl text-cyan-400" />
                </div>
                <div className="absolute -top-2 -right-2 h-10 w-10 rounded-full bg-indigo-500/20 backdrop-blur-md flex items-center justify-center border border-indigo-500/30">
                   <IoSparklesOutline className="text-indigo-400" />
                </div>
             </div>
            <h3 className="text-2xl font-black text-white tracking-tight">Curriculum Not Found</h3>
            <p className="mt-3 max-w-sm text-base text-gray-500 leading-relaxed font-medium">
              {canManageModules
                ? 'Your classroom structure is a blank canvas. Start construction by seeding your first module above.'
                : 'Your instructor is currently architecting the course journey. Check back shortly.'}
            </p>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </GlassDashboardShell>
  );
};

export default LearningModulesPage;
