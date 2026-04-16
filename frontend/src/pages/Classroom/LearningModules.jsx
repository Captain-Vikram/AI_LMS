import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IoBookOutline,
  IoCheckmarkCircleOutline,
  IoGridOutline,
  IoPeopleOutline,
  IoRefreshOutline,
  IoSettingsOutline,
  IoSparklesOutline,
} from 'react-icons/io5';
import {
  useAssignResourcesToModule,
  useAutoGenerateModules,
  useClassroomAnalytics,
  useCreateLearningModule,
  useLearningModules,
  useModuleApprovedResources,
  useReorderLearningModules,
} from '../../hooks/useClassroom';
import { LoadingState, ErrorState } from '../../components/Classroom/DashboardCard';
import { ModuleList, LearningModuleProgress } from '../../components/Classroom/ModuleList';
import GlassDashboardShell from '../../components/UI/GlassDashboardShell';

const getModuleId = (module) => module?.module_id || module?._id || '';

const getModuleName = (module) => module?.name || module?.title || 'Untitled Module';

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
  const navigate = useNavigate();
  const [userRole] = useState((localStorage.getItem('userRole') || 'student').toLowerCase());
  const canManageModules = userRole === 'teacher' || userRole === 'admin';

  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleDescription, setNewModuleDescription] = useState('');
  const [activeModuleForResources, setActiveModuleForResources] = useState(null);
  const [selectedResourceIds, setSelectedResourceIds] = useState([]);
  const [generationMessage, setGenerationMessage] = useState('');
  const [managementMessage, setManagementMessage] = useState('');
  const [showGenerationSuccess, setShowGenerationSuccess] = useState(false);

  const {
    modules,
    loading: modulesLoading,
    error: modulesError,
    refresh: refreshModules,
  } = useLearningModules(classroomId);

  const { studentProgress, loading: analyticsLoading } = useClassroomAnalytics(classroomId);

  const {
    generateModules,
    loading: generatingModules,
    error: generationError,
  } = useAutoGenerateModules(classroomId);

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

  const handleAutoGenerate = async () => {
    setGenerationMessage('');
    setManagementMessage('');

    const result = await generateModules();
    if (result?.success) {
      const processed = Number(
        result.modulesProcessed || (result.modulesCreated || 0) + (result.modulesUpdated || 0)
      );
      const created = Number(result.modulesCreated || 0);
      const updated = Number(result.modulesUpdated || 0);

      setGenerationMessage(
        `Module generation complete: ${processed} processed (${created} created, ${updated} updated).`
      );
      setShowGenerationSuccess(true);
      refreshModules();
      if (canManageModules) {
        refreshApprovedResources();
      }
      setTimeout(() => setShowGenerationSuccess(false), 5000);
      return;
    }

    setGenerationMessage(`Failed to generate modules: ${result?.message || 'Unknown error'}`);
    setShowGenerationSuccess(false);
  };

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
          </>
        );
      }
    : null;

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

            <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-4">
              {canManageModules && (
                <button
                  onClick={handleAutoGenerate}
                  disabled={generatingModules}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-amber-500 px-3 py-2 font-medium text-white transition-colors hover:bg-amber-600 disabled:bg-gray-500"
                  title="Auto-generate modules from approved resources"
                >
                  {generatingModules ? (
                    <IoRefreshOutline className="animate-spin" />
                  ) : (
                    <IoSparklesOutline />
                  )}
                  <span className="hidden sm:inline">Generate</span>
                </button>
              )}
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

        {showGenerationSuccess && (
          <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4">
            <p className="text-sm text-emerald-200">{generationMessage}</p>
          </div>
        )}

        {!showGenerationSuccess && generationMessage && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <p className="text-sm text-red-200">{generationMessage}</p>
          </div>
        )}

        {generationError && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <p className="text-sm text-red-200">{generationError}</p>
          </div>
        )}

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
                ? 'Create one manually above or run auto-generation from approved resources.'
                : 'Your teacher will publish modules soon.'}
            </p>
          </div>
        )}
      </div>
    </GlassDashboardShell>
  );
};

export default LearningModulesPage;
