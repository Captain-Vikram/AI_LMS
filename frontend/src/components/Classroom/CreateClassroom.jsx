import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  IoCheckmarkCircleOutline,
  IoCloudUploadOutline,
  IoSchoolOutline,
  IoSparklesOutline,
} from 'react-icons/io5';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import AppBackButton from '../UI/AppBackButton';
import GlassDashboardShell from '../UI/GlassDashboardShell';

const CreateClassroom = () => {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [grade, setGrade] = useState('');
  const [subjectDescription, setSubjectDescription] = useState('');
  const [studentExpectations, setStudentExpectations] = useState('');
  const [curriculumFile, setCurriculumFile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const checklist = useMemo(
    () => [
      { label: 'Classroom name', done: Boolean(name.trim()) },
      { label: 'Subject focus', done: Boolean(subject.trim()) },
      { label: 'Grade level', done: Boolean(grade.trim()) },
      { label: 'Subject description', done: Boolean(subjectDescription.trim()) },
      { label: 'Student expectations', done: Boolean(studentExpectations.trim()) },
      { label: 'Subject PDF (10 pages max)', done: Boolean(curriculumFile) },
    ],
    [curriculumFile, grade, name, studentExpectations, subject, subjectDescription]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!curriculumFile) {
      setError('Please upload a subject PDF before creating the classroom.');
      return;
    }
    if (!curriculumFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }
    if (curriculumFile.size > 10 * 1024 * 1024) {
      setError('PDF file must be 10MB or smaller.');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('subject', subject.trim());
      formData.append('grade_level', grade.trim());
      formData.append('subject_description', subjectDescription.trim());
      formData.append('student_expectations', studentExpectations.trim());
      formData.append('description', subjectDescription.trim());
      formData.append('require_approval', 'true');
      formData.append('curriculum_pdf', curriculumFile);

      const res = await apiClient.post(API_ENDPOINTS.CLASSROOM_CREATE, formData);
      localStorage.setItem("onboardingComplete", "true");
      navigate(`/classroom/${res.classroom_id}/dashboard`);
    } catch (err) {
      setError(err.message || 'Failed to create classroom');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassDashboardShell contentClassName="max-w-6xl">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-700/70 bg-gradient-to-r from-slate-900 via-gray-900 to-slate-800 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-300">Teacher and Admin Workspace</p>
              <h1 className="mt-2 text-3xl font-bold text-gray-100">Create a New Classroom</h1>
              <p className="mt-2 max-w-2xl text-sm text-gray-300">
                Set up the core details once, then launch directly into your dashboard to manage roster,
                announcements, and learning modules.
              </p>
            </div>
            <AppBackButton label="Back to Classrooms" fallbackTo="/classrooms" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <form
            onSubmit={handleSubmit}
            className="xl:col-span-8 rounded-xl border border-gray-700 bg-gray-900/50 p-6"
          >
            <h2 className="text-lg font-semibold text-gray-100">Classroom Details</h2>
            <p className="mt-1 text-sm text-gray-400">
              Collect the core subject context once. AI drafts resources, then teacher approval controls what students can view.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-gray-300">Class Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Grade 9 - Foundations of Algebra"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-300">Subject</label>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Mathematics"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-300">Grade Level</label>
                <input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="9"
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-gray-300">Subject Description</label>
                <textarea
                  value={subjectDescription}
                  onChange={(e) => setSubjectDescription(e.target.value)}
                  placeholder="Describe what this subject covers for this classroom."
                  rows={3}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-gray-300">Expected Student Outcomes</label>
                <textarea
                  value={studentExpectations}
                  onChange={(e) => setStudentExpectations(e.target.value)}
                  placeholder="List what students are expected to complete, build, or demonstrate."
                  rows={3}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-gray-300">Subject PDF (Required, max 10 pages)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setCurriculumFile(e.target.files?.[0] || null)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white file:mr-3 file:rounded file:border-0 file:bg-cyan-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
                  required
                />
                <p className="mt-2 text-xs text-gray-400 flex items-center gap-2">
                  <IoCloudUploadOutline className="text-cyan-300" />
                  Backend validation enforces PDF type and 10-page maximum.
                </p>
                {curriculumFile && (
                  <p className="mt-1 text-xs text-cyan-200">Selected: {curriculumFile.name}</p>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-lg border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm text-red-100">
                {error}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-60"
              >
                {loading ? 'Generating AI Resources...' : 'Create Classroom'}
              </button>
              <Link
                to="/classrooms"
                className="rounded-lg border border-gray-600 bg-gray-800 px-5 py-2.5 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700"
              >
                Cancel
              </Link>
            </div>
          </form>

          <aside className="xl:col-span-4 space-y-4">
            <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-cyan-300">Setup Checklist</h3>
              <div className="mt-3 space-y-3">
                {checklist.map((item) => (
                  <div key={item.label} className="flex items-center gap-2">
                    <IoCheckmarkCircleOutline
                      className={item.done ? 'text-emerald-400' : 'text-gray-600'}
                    />
                    <span className={item.done ? 'text-gray-200 text-sm' : 'text-gray-400 text-sm'}>
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-blue-200">
                <IoSchoolOutline />
                What happens next
              </p>
              <ul className="mt-3 space-y-2 text-sm text-blue-100/90">
                <li>1. AI drafts classroom YouTube videos and learning resources.</li>
                <li>2. Teacher approves resources before students can access them.</li>
                <li>3. Students get class mode and personal mode recommendations in dashboard.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
                <IoSparklesOutline />
                AI Input Quality Tip
              </p>
              <p className="mt-2 text-sm text-cyan-100/90">
                The clearer your subject description and outcomes, the more useful the first batch of AI-generated resources.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </GlassDashboardShell>
  );
};

export default CreateClassroom;
