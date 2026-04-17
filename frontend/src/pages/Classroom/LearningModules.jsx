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
import GlassDashboardShell from '../../components/UI/GlassDashboardShell';

const getModuleId = (module) => module?.module_id || module?._id || '';

const getModuleName = (module) => module?.name || module?.title || 'Untitled Module';

const normalizeResourceLink = (urlValue) => {
  if (!urlValue) {
    return '';
  }

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
  if (Array.isArray(raw)) {
    raw = raw.find((item) => typeof item === 'string' && item.trim()) || '';
  }

  let text = unwrapQuotes(raw);
  if (!text) {
    return '';
  }

  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text.replace(/'/g, '"'));
      if (Array.isArray(parsed)) {
        text = unwrapQuotes(parsed.find((item) => typeof item === 'string' && item.trim()) || '');
      }
    } catch {
      // Keep current text and continue with regex extraction.
    }
  }

  text = unwrapQuotes(text).replace(/\\u0026/g, '&').replace(/&amp;/gi, '&');

  const matched = text.match(/https?:\/\/[^\s'"\]]+/i);
  if (matched) {
    text = matched[0].trim();
  }

  if (!/^https?:\/\//i.test(text) && /^[\w.-]+\.[a-z]{2,}(?:\/|$)/i.test(text)) {
    text = `https://${text}`;
  }

  return /^https?:\/\//i.test(text) ? text : '';
};

const getLinkCategory = (resource) => {
  const rawType = String(resource?.resource_type || '').trim().toLowerCase();
  const rawSource = String(resource?.source || '').trim().toLowerCase();
  const link = normalizeResourceLink(resource?.url).toLowerCase();

  if (rawType.includes('youtube') || link.includes('youtube.com') || link.includes('youtu.be')) {
    return 'youtube';
  }

  if (
    rawType.includes('blog') ||
    rawSource.includes('blog') ||
    link.includes('medium.com') ||
    link.includes('substack.com') ||
    link.includes('dev.to') ||
    link.includes('hashnode.') ||
    link.includes('wordpress.') ||
    link.includes('blogger.')
  ) {
    return 'blog';
  }

  return 'article';
};

const toShortTitle = (value, maxLength = 80) => {
  const title = String(value || '').replace(/\s+/g, ' ').trim();
  if (!title) {
    return 'Untitled Resource';
  }

  if (title.length <= maxLength) {
    return title;
  }

  return `${title.slice(0, maxLength - 1).trim()}...`;
};

const getApprovalStatusLabel = (status) => {
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
};

const getApprovalStatusClasses = (status) => {
  if (status === 'approved') {
    return 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200';
  }
  if (status === 'rejected') {
    return 'border-rose-500/40 bg-rose-500/15 text-rose-200';
  }
  return 'border-amber-500/40 bg-amber-500/15 text-amber-200';
};

const normalizeClassroomRole = (rawRole) => {
  const role = String(rawRole || '').trim().toLowerCase();
  if (role === 'teacher' || role === 'admin' || role === 'student') {
    return role;
  }

  if (role === 'educator' || role === 'instructor' || role === 'faculty') {
    return 'teacher';
  }

  return 'student';
};

const getSortedModules = (modules = []) =>
  [...modules].sort((first, second) => {
    const firstOrder = Number(first?.order || 0);
    const secondOrder = Number(second?.order || 0);
    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }

    return getModuleName(first).localeCompare(getModuleName(second));
  });

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

  const {
    modules,
    loading: modulesLoading,
    error: modulesError,
    refresh: refreshModules,
  } = useLearningModules(classroomId);

  const { studentProgress, loading: analyticsLoading } = useClassroomAnalytics(classroomId);

  const {
    resources: classResources,
    summary: classResourceSummary,
    loading: classResourcesLoading,
    error: classResourcesError,
    approveResource,
    refresh: refreshClassResources,
  } = useClassroomResources(classroomId, 'class', isResourceHubRoute && canManageModules);

  const {
    createModule,
    loading: creatingModule,
    error: createModuleError,
  } = useCreateLearningModule(classroomId);

  const {
    reorderModules,
    loading: reorderingModules,
    error: reorderModulesError,
  } = useReorderLearningModules(classroomId);

  const {
    categories: approvedResourceCategories,
    loading: approvedResourcesLoading,
    error: approvedResourcesError,
    refresh: refreshApprovedResources,
  } = useModuleApprovedResources(classroomId, canManageModules);

  const {
    assignResources,
    loading: assigningResources,
    error: assignResourcesError,
  } = useAssignResourcesToModule(classroomId);

  const orderedModules = useMemo(() => getSortedModules(modules), [modules]);

  const activeModule = useMemo(
    () => orderedModules.find((module) => getModuleId(module) === activeModuleForResources) || null,
    [orderedModules, activeModuleForResources]
  );

  const assignableCategories = useMemo(() => {
    if (!activeModule) {
      return [];
    }

    const existingResourceIds = new Set(
      (activeModule.resources || [])
        .map((resource) => resource?.id || resource?.resource_id)
        .filter(Boolean)
    );

    return (approvedResourceCategories || [])
      .map((category) => ({
        ...category,
        resources: (category.resources || []).filter(
          (resource) => !existingResourceIds.has(resource.resource_id)
        ),
      }))
      .filter((category) => (category.resources || []).length > 0);
  }, [activeModule, approvedResourceCategories]);

  const completionPercentage = useMemo(() => {
    if (!studentProgress?.module_progress?.length) {
      return 0;
    }

    const sum = studentProgress.module_progress.reduce(
      (total, item) => total + Number(item.completion_percentage || 0),
      0
    );

    return Math.round(sum / studentProgress.module_progress.length);
  }, [studentProgress]);

  const totalEstimatedHours = useMemo(
    () => modules.reduce((sum, moduleItem) => sum + Number(moduleItem.estimated_hours || 0), 0),
    [modules]
  );

  const orderedClassResources = useMemo(() => {
    const weightByStatus = {
      pending: 0,
      approved: 1,
      rejected: 2,
    };

    return [...(classResources || [])].sort((first, second) => {
      const firstStatus = String(first?.approval_status || 'pending').toLowerCase();
      const secondStatus = String(second?.approval_status || 'pending').toLowerCase();
      const firstWeight = weightByStatus[firstStatus] ?? 3;
      const secondWeight = weightByStatus[secondStatus] ?? 3;

      if (firstWeight !== secondWeight) {
        return firstWeight - secondWeight;
      }

      const firstTitle = String(first?.title || '').trim();
      const secondTitle = String(second?.title || '').trim();
      return firstTitle.localeCompare(secondTitle);
    });
  }, [classResources]);

  const visibleClassResources = useMemo(() => {
    let filtered = orderedClassResources;

    if (resourceFilter !== 'all') {
      filtered = filtered.filter(
        (resource) => String(resource?.approval_status || 'pending').toLowerCase() === resourceFilter
      );
    }

    if (linkCategoryFilter === 'all') {
      return filtered;
    }

    return filtered.filter((resource) => getLinkCategory(resource) === linkCategoryFilter);
  }, [orderedClassResources, resourceFilter, linkCategoryFilter]);

  const groupedResourceLinks = useMemo(() => {
    const groups = {
      youtube: [],
      article: [],
      blog: [],
    };

    for (const resource of visibleClassResources) {
      const category = getLinkCategory(resource);
      if (groups[category]) {
        groups[category].push(resource);
      }
    }

    return [
      { key: 'youtube', label: 'YouTube Links', items: groups.youtube },
      { key: 'article', label: 'Article Links', items: groups.article },
      { key: 'blog', label: 'Blog Links', items: groups.blog },
    ];
  }, [visibleClassResources]);

  const handleCreateModule = async (event) => {
    event.preventDefault();
    if (!newModuleName.trim()) {
      setManagementMessage('Module name is required.');
      return;
    }

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
    const moduleIds = orderedModules.map((module) => getModuleId(module)).filter(Boolean);
    const currentIndex = moduleIds.indexOf(moduleId);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= moduleIds.length) {
      return;
    }

    const reorderedIds = [...moduleIds];
    [reorderedIds[currentIndex], reorderedIds[targetIndex]] = [
      reorderedIds[targetIndex],
      reorderedIds[currentIndex],
    ];

    const result = await reorderModules(reorderedIds);
    if (result?.success) {
      setManagementMessage('Module order updated.');
      refreshModules();
      return;
    }

    setManagementMessage(result?.message || 'Failed to reorder modules.');
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
    setSelectedResourceIds((previousIds) => {
      if (previousIds.includes(resourceId)) {
        return previousIds.filter((id) => id !== resourceId);
      }
      return [...previousIds, resourceId];
    });
  };

  const handleAssignSelectedResources = async () => {
    if (!activeModuleForResources || selectedResourceIds.length === 0) {
      return;
    }

    const result = await assignResources(activeModuleForResources, selectedResourceIds);
    if (result?.success) {
      const addedCount = Number(result.addedCount || 0);
      setManagementMessage(`Assigned ${addedCount} resources to module.`);
      setSelectedResourceIds([]);
      refreshModules();
      refreshApprovedResources();
      return;
    }

    setManagementMessage(result?.message || 'Failed to assign resources.');
  };

  const handleUpdateResourceApproval = async (resourceId, approved) => {
    if (!resourceId) {
      return;
    }

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
        const currentIndex = orderedModules.findIndex((item) => getModuleId(item) === moduleId);
        const canMoveUp = currentIndex > 0;
        const canMoveDown = currentIndex >= 0 && currentIndex < orderedModules.length - 1;
        const isActive = moduleId === activeModuleForResources;

        return (
          <>
            <button
              type="button"
              onClick={() => handleMoveModule(moduleId, -1)}
              disabled={!canMoveUp || reorderingModules}
              className="rounded border border-gray-600 px-2 py-1 text-[11px] text-gray-300 hover:border-cyan-500 disabled:opacity-50"
            >
              Up
            </button>
            <button
              type="button"
              onClick={() => handleMoveModule(moduleId, 1)}
              disabled={!canMoveDown || reorderingModules}
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
              onClick={() =>
                navigate(`/classroom/${classroomId}/modules/${moduleId}/assessment-builder`)
              }
              className="rounded border border-gray-600 px-2 py-1 text-[11px] text-gray-300 hover:border-purple-500"
            >
              Assessment
            </button>
          </>
        );
      }
    : null;

  if (isResourceHubRoute && !canManageModules) {
    return <Navigate to={`/classroom/${classroomId}/personal-resources`} replace />;
  }

  if (isResourceHubRoute && canManageModules) {
    const summary = classResourceSummary || { total: 0, approved: 0, pending: 0, rejected: 0 };

    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <div className="space-y-6">
          <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-r from-slate-900 via-purple-950/40 to-slate-900 p-6 shadow-2xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-purple-200">Teacher Resource Hub</p>
                <h1 className="mt-2 text-3xl font-bold text-gray-100">Classroom Resource Review</h1>
                <p className="mt-2 text-sm text-gray-300">
                  Review incoming AI resources, approve what fits your syllabus, and reject low-quality entries.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                <button
                  onClick={() => navigate(`/classroom/${classroomId}/dashboard`)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-cyan-500 px-3 py-2 font-medium text-white transition-colors hover:bg-cyan-600"
                >
                  <IoGridOutline /> Dashboard
                </button>
                <button
                  onClick={() => navigate(`/classroom/${classroomId}/modules`)}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 font-medium text-white transition-colors hover:bg-emerald-600"
                >
                  <IoBookOutline /> Modules
                </button>
                <button
                  onClick={() => refreshClassResources('class')}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-purple-600 px-3 py-2 font-medium text-white transition-colors hover:bg-purple-500"
                >
                  <IoRefreshOutline /> Refresh
                </button>
              </div>
            </div>
          </div>

          {(resourceActionMessage || resourceActionError || classResourcesError) && (
            <div
              className={`rounded-lg border p-4 text-sm ${
                resourceActionError || classResourcesError
                  ? 'border-red-500/50 bg-red-500/10 text-red-200'
                  : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-100'
              }`}
            >
              {resourceActionError || classResourcesError || resourceActionMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-4">
              <p className="text-xs text-cyan-200/80">Total</p>
              <p className="mt-1 text-2xl font-bold text-cyan-100">{Number(summary.total || 0)}</p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-xs text-emerald-200/80">Approved</p>
              <p className="mt-1 text-2xl font-bold text-emerald-100">{Number(summary.approved || 0)}</p>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="text-xs text-amber-200/80">Pending</p>
              <p className="mt-1 text-2xl font-bold text-amber-100">{Number(summary.pending || 0)}</p>
            </div>
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4">
              <p className="text-xs text-rose-200/80">Rejected</p>
              <p className="mt-1 text-2xl font-bold text-rose-100">{Number(summary.rejected || 0)}</p>
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { value: 'all', label: 'All Status' },
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ].map((option) => {
                const selected = resourceFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setResourceFilter(option.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-purple-400 bg-purple-500/20 text-purple-100'
                        : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-purple-400'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {[
                { value: 'all', label: 'All Links' },
                { value: 'youtube', label: 'YouTube' },
                { value: 'article', label: 'Articles' },
                { value: 'blog', label: 'Blogs' },
              ].map((option) => {
                const selected = linkCategoryFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLinkCategoryFilter(option.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selected
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-100'
                        : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-cyan-400'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {classResourcesLoading ? (
            <LoadingState message="Loading classroom resources..." />
          ) : visibleClassResources.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-600 p-6 text-center text-gray-300">
              <p className="text-lg">No resources found for this filter.</p>
              <p className="mt-2 text-sm text-gray-400">
                Try switching filters or generate new classroom resources from your dashboard.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedResourceLinks.map((group) => {
                if (group.items.length === 0) {
                  return null;
                }

                return (
                  <section key={group.key} className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-200">{group.label}</h2>
                      <span className="text-xs text-gray-400">{group.items.length} link(s)</span>
                    </div>

                    <div className="space-y-2">
                      {group.items.map((resource) => {
                        const resourceId = resource?.resource_id;
                        const status = String(resource?.approval_status || 'pending').toLowerCase();
                        const link = normalizeResourceLink(resource?.url);
                        const actionPending = resourceActionPendingId === resourceId;

                        return (
                          <article
                            key={resourceId}
                            className="rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 transition-colors hover:border-purple-400/50"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-medium text-gray-100">{toShortTitle(resource?.title)}</p>
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getApprovalStatusClasses(status)}`}>
                                    {getApprovalStatusLabel(status)}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400">{resource?.skill || 'General'}</p>
                              </div>

                              <div className="flex flex-wrap gap-2 sm:justify-end">
                                {link ? (
                                  <a
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
                                  >
                                    <IoLinkOutline /> Open Link
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => handleUpdateResourceApproval(resourceId, true)}
                                  disabled={actionPending || status === 'approved'}
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                                >
                                  <IoCheckmarkCircleOutline />
                                  {status === 'approved' ? 'Approved' : 'Approve'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUpdateResourceApproval(resourceId, false)}
                                  disabled={actionPending || status === 'rejected'}
                                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-rose-500 disabled:opacity-60"
                                >
                                  <IoCloseCircleOutline />
                                  {status === 'rejected' ? 'Rejected' : 'Reject'}
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </GlassDashboardShell>
    );
  }

  if (modulesLoading) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <LoadingState message="Loading curriculum modules..." />
      </GlassDashboardShell>
    );
  }

  if (modulesError) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <ErrorState message={modulesError} />
      </GlassDashboardShell>
    );
  }

  if (!canManageModules) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <LearningModulesStudent classroomId={classroomId} modules={orderedModules} />
      </GlassDashboardShell>
    );
  }

  return (
    <GlassDashboardShell contentClassName="max-w-7xl">
      <div className="space-y-6">
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
              <button
                onClick={() => navigate(`/classroom/${classroomId}/dashboard`)}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-cyan-500 px-3 py-2 font-medium text-white transition-colors hover:bg-cyan-600"
              >
                <IoGridOutline /> Dashboard
              </button>
              <button
                onClick={() => navigate(`/classroom/${classroomId}/roster`)}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 font-medium text-white transition-colors hover:bg-emerald-600"
              >
                <IoPeopleOutline /> Roster
              </button>
              <button
                onClick={() => navigate(`/classroom/${classroomId}/settings`)}
                className="inline-flex items-center justify-center gap-1 rounded-lg bg-gray-700 px-3 py-2 font-medium text-white transition-colors hover:bg-gray-600"
              >
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
              <input
                type="text"
                value={newModuleName}
                onChange={(event) => setNewModuleName(event.target.value)}
                placeholder="Module name"
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none md:col-span-4"
              />
              <input
                type="text"
                value={newModuleDescription}
                onChange={(event) => setNewModuleDescription(event.target.value)}
                placeholder="Module description (optional)"
                className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none md:col-span-6"
              />
              <button
                type="submit"
                disabled={creatingModule}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60 md:col-span-2"
              >
                {creatingModule ? 'Adding...' : 'Add Module'}
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="xl:col-span-8 rounded-xl border border-gray-700 bg-gray-900/50 p-6">
            <h2 className="text-xl font-semibold text-gray-100">Published Modules</h2>
            <p className="mt-1 text-sm text-gray-400">
              Open any module card for objectives, resources, and difficulty details.
            </p>
            <div className="mt-5">
              <ModuleList
                modules={modules}
                loading={modulesLoading}
                moduleActions={renderModuleActions}
              />
            </div>
          </div>

          <div className="xl:col-span-4 space-y-6">
            {userRole === 'student' && studentProgress ? (
              <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-6">
                <h3 className="text-lg font-semibold text-cyan-100">My Progress</h3>
                <p className="mt-1 text-sm text-cyan-100/80">
                  Track completion and assessment coverage by module.
                </p>
                <div className="mt-4">
                  <LearningModuleProgress
                    modules={modules}
                    studentProgress={studentProgress}
                    loading={analyticsLoading}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-6">
                <h3 className="text-lg font-semibold text-emerald-100">Instructor Guidance</h3>
                <ul className="mt-3 space-y-2 text-sm text-emerald-100/90">
                  <li className="flex items-start gap-2">
                    <IoCheckmarkCircleOutline className="mt-0.5" />
                    Keep module titles aligned to syllabus outcomes.
                  </li>
                  <li className="flex items-start gap-2">
                    <IoCheckmarkCircleOutline className="mt-0.5" />
                    Use Add on each module to attach approved resources.
                  </li>
                  <li className="flex items-start gap-2">
                    <IoCheckmarkCircleOutline className="mt-0.5" />
                    Sort modules with Up and Down controls.
                  </li>
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
                <p className="text-sm text-purple-100/80">
                  Resources are grouped by syllabus category. Select and assign to this module.
                </p>
              </div>

              <button
                type="button"
                onClick={() => refreshApprovedResources()}
                className="inline-flex items-center gap-1 rounded-lg border border-purple-300/30 bg-purple-900/30 px-3 py-2 text-sm text-purple-100 hover:bg-purple-800/40"
              >
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
                {assignableCategories.map((category, categoryIndex) => (
                  <div
                    key={`${category.category}-${categoryIndex}`}
                    className="rounded-lg border border-purple-300/30 bg-gray-900/40 p-4"
                  >
                    <h4 className="text-sm font-semibold text-purple-100">{category.category}</h4>
                    <div className="mt-3 space-y-2">
                      {(category.resources || []).map((resource) => {
                        const checked = selectedResourceIds.includes(resource.resource_id);
                        return (
                          <label
                            key={resource.resource_id}
                            className="flex items-start gap-2 rounded border border-gray-700 bg-gray-900/60 px-3 py-2 text-sm text-gray-200"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleResourceSelection(resource.resource_id)}
                              className="mt-0.5"
                            />
                            <div>
                              <p className="font-medium text-gray-100">{resource.title}</p>
                              <p className="text-xs text-gray-400">
                                {resource.resource_type} {resource.skill ? `| ${resource.skill}` : ''}
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

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleAssignSelectedResources}
                disabled={assigningResources || selectedResourceIds.length === 0}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-60"
              >
                {assigningResources
                  ? 'Assigning...'
                  : `Add Selected (${selectedResourceIds.length})`}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedResourceIds([]);
                  setActiveModuleForResources(null);
                }}
                className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700"
              >
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
