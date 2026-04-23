import React, { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { IoDocumentTextOutline } from 'react-icons/io5';
import ModuleAssessmentWorkflowPrototype from '../../components/Classroom/ModuleAssessmentWorkflowPrototype';
import { LoadingState, ErrorState } from '../../components/Classroom/DashboardCard';
import AppBackButton from '../../components/UI/AppBackButton';
import GlassDashboardShell from '../../components/UI/GlassDashboardShell';
import { useLearningModules } from '../../hooks/useClassroom';

const getModuleId = (module) => module?.module_id || module?._id || '';
const getModuleName = (module) => module?.name || module?.title || 'Untitled Module';

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

const ModuleAssessmentBuilderPage = () => {
  const { id: classroomId, moduleId } = useParams();
  const [publishMessage, setPublishMessage] = useState('');
  const [userRole] = useState(normalizeClassroomRole(localStorage.getItem('userRole')));
  const canManageModules = userRole === 'teacher' || userRole === 'admin';

  const {
    modules,
    loading: modulesLoading,
    error: modulesError,
  } = useLearningModules(classroomId);

  const activeModule = useMemo(
    () => modules.find((module) => getModuleId(module) === moduleId) || null,
    [modules, moduleId]
  );

  if (!canManageModules) {
    return <Navigate to={`/classroom/${classroomId}/modules`} replace />;
  }

  if (modulesLoading) {
    return (
      <GlassDashboardShell contentClassName="max-w-5xl">
        <LoadingState message="Loading module assessment workspace..." />
      </GlassDashboardShell>
    );
  }

  if (modulesError) {
    return (
      <GlassDashboardShell contentClassName="max-w-5xl">
        <ErrorState message={modulesError} />
      </GlassDashboardShell>
    );
  }

  if (!activeModule) {
    return (
      <GlassDashboardShell contentClassName="max-w-5xl">
        <div className="space-y-4">
          <ErrorState message="Module not found for this classroom." />
          <AppBackButton
            label="Back to Modules"
            fallbackTo={`/classroom/${classroomId}/modules`}
          />
        </div>
      </GlassDashboardShell>
    );
  }

  return (
    <GlassDashboardShell contentClassName="max-w-5xl">
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-700/70 bg-gradient-to-r from-slate-900 via-gray-900 to-slate-800 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-purple-300">Module Assessment Workspace</p>
              <h1 className="mt-2 inline-flex items-center gap-2 text-2xl font-bold text-gray-100">
                <IoDocumentTextOutline />
                {getModuleName(activeModule)}
              </h1>
              <p className="mt-2 text-sm text-gray-300">
                Build, edit, and publish a 4-mode assessment workflow with one final category.
              </p>
            </div>
            <AppBackButton
              label="Back to Modules"
              fallbackTo={`/classroom/${classroomId}/modules`}
            />
          </div>
        </div>

        {publishMessage ? (
          <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-4">
            <p className="text-sm text-emerald-100">{publishMessage}</p>
          </div>
        ) : null}

        <ModuleAssessmentWorkflowPrototype
          moduleId={moduleId}
          module={activeModule}
          onPublished={(payload) => {
            const category = payload?.response?.workflow?.final_category || payload?.final_category;
            if (category) {
              setPublishMessage(`Assessment workflow published with final category: ${category}.`);
              return;
            }
            setPublishMessage('Assessment workflow published successfully.');
          }}
        />
      </div>
    </GlassDashboardShell>
  );
};

export default ModuleAssessmentBuilderPage;
