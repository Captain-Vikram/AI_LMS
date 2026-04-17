import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  IoArrowBackOutline,
  IoBookOutline,
  IoConstructOutline,
  IoDocumentTextOutline,
  IoMapOutline,
  IoSparklesOutline,
} from 'react-icons/io5';
import GlassDashboardShell from '../../components/UI/GlassDashboardShell';

const plannedItems = [
  {
    title: 'Personal NotebookLM-style AI Workspace',
    description:
      'A private assistant for each student with context-aware chat across personal notes and files.',
    icon: IoSparklesOutline,
  },
  {
    title: 'PDF and Notes RAG',
    description:
      'Upload personal PDFs, summarize key ideas, ask questions, and build revision notes with citations.',
    icon: IoDocumentTextOutline,
  },
  {
    title: 'Personal Learning Pathway',
    description:
      'Planned integration with roadmap.sh pathways to generate structured self-learning tracks.',
    icon: IoMapOutline,
  },
];

const StudentPersonalResourcesPage = () => {
  const navigate = useNavigate();
  const { id: classroomId } = useParams();

  return (
    <GlassDashboardShell contentClassName="max-w-6xl">
      <div className="space-y-6">
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 p-6 shadow-2xl">
          <p className="text-xs uppercase tracking-widest text-cyan-300">Student Personal Resources</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-100">Personal AI Learning Workspace</h1>
          <p className="mt-2 text-sm text-gray-300">
            This is separate from teacher-assigned classroom modules and resource notes.
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 p-5">
          <div className="flex items-start gap-3">
            <IoConstructOutline className="mt-0.5 text-xl text-amber-300" />
            <div>
              <h2 className="text-lg font-semibold text-amber-100">Coming Soon</h2>
              <p className="mt-1 text-sm text-amber-100/85">
                The personal workspace is under active development. The plan below outlines what will be added next.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {plannedItems.map((item) => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="rounded-xl border border-gray-700 bg-gray-900/60 p-5"
              >
                <Icon className="text-xl text-cyan-300" />
                <h3 className="mt-3 text-base font-semibold text-gray-100">{item.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{item.description}</p>
                <p className="mt-3 inline-flex rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-amber-200">
                  Coming Soon
                </p>
              </article>
            );
          })}
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
          <h2 className="text-lg font-semibold text-gray-100">Current Access</h2>
          <p className="mt-2 text-sm text-gray-400">
            Teacher-assigned modules, quizzes, and classroom progression remain available in the Modules section.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate(`/classroom/${classroomId}/dashboard`)}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
            >
              <IoArrowBackOutline /> Back to Dashboard
            </button>
            <button
              type="button"
              onClick={() => navigate(`/classroom/${classroomId}/modules`)}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
            >
              <IoBookOutline /> Open Classroom Modules
            </button>
          </div>
        </div>
      </div>
    </GlassDashboardShell>
  );
};

export default StudentPersonalResourcesPage;
