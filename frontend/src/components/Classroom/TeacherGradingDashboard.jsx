import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IoCheckmarkCircleOutline,
  IoRefreshOutline,
} from "react-icons/io5";
import AppBackButton from "../UI/AppBackButton";
import apiClient from "../../services/apiClient";
import IconsCarousel from "../IconsCarousel";

const TeacherGradingDashboard = () => {
  const navigate = useNavigate();
  const { id: classroomId } = useParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingSubmissions, setPendingSubmissions] = useState([]);

  const [selectedSubmission, setSelectedSubmission] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detail, setDetail] = useState(null);

  const [grades, setGrades] = useState({});
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPending = async () => {
    if (!classroomId) return;

    setLoading(true);
    setError("");

    try {
      const response = await apiClient.get(`/api/module-assessment/pending-grades/${classroomId}`);
      setPendingSubmissions(
        Array.isArray(response?.pending_submissions) ? response.pending_submissions : []
      );
    } catch (err) {
      setError(err?.message || "Failed to load pending submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, [classroomId]);

  const loadSubmissionDetail = async (submissionId) => {
    setSelectedSubmission(submissionId);
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    setGrades({});
    setFeedback("");

    try {
      const response = await apiClient.get(`/api/module-assessment/submission/${submissionId}`);
      setDetail(response);
      setFeedback(response?.teacher_feedback || "");

      const initialGrades = {};
      (response?.manual_questions || []).forEach((question) => {
        initialGrades[question.question_id] = Number(question.points_awarded || 0);
      });
      setGrades(initialGrades);
    } catch (err) {
      setDetailError(err?.message || "Failed to load submission detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const manualTotal = useMemo(() => {
    const values = Object.values(grades);
    return values.reduce((sum, value) => sum + Number(value || 0), 0);
  }, [grades]);

  const handleGrade = async () => {
    if (!selectedSubmission || !detail) return;

    setSaving(true);
    setDetailError("");

    try {
      const gradePayload = (detail?.manual_questions || []).map((question) => {
        const awarded = Number(grades[question.question_id] || 0);
        return {
          question_id: question.question_id,
          points_awarded: awarded,
          teacher_comment: "",
        };
      });

      await apiClient.patch(
        `/api/module-assessment/submission/${selectedSubmission}/grade`,
        {
          submission_id: selectedSubmission,
          grades: gradePayload,
          overall_feedback: feedback,
        }
      );

      setDetail(null);
      setSelectedSubmission("");
      setGrades({});
      setFeedback("");
      await loadPending();
    } catch (err) {
      setDetailError(err?.message || "Failed to save grades");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="relative min-h-screen px-4 py-12 pt-28">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>

      <div className="container mx-auto relative z-10 max-w-7xl">
        <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-3xl p-5 md:p-8 shadow-2xl space-y-6">

      <header className="rounded-2xl border border-gray-700/50 bg-gray-800/60 backdrop-blur-md p-5 pb-6">
        <AppBackButton
          label="Back to Dashboard"
          fallbackTo={`/classroom/${classroomId}/dashboard`}
        />
        <h1 className="mt-4 text-3xl md:text-4xl font-bold text-white tracking-tight">Teacher Grading Dashboard</h1>
        <p className="mt-1.5 text-base font-medium text-emerald-400">
          Review submissions that require manual grading.
        </p>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm text-red-200 font-medium">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="xl:col-span-5 rounded-2xl border border-gray-700/50 bg-gray-800/60 backdrop-blur-md p-5 shadow-lg">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-100">Pending Submissions</h2>
            <button
              type="button"
              onClick={loadPending}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg bg-gray-700/50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-200 hover:bg-gray-600 transition-colors disabled:opacity-60"
            >
              <IoRefreshOutline size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {loading ? <p className="text-sm text-gray-400">Loading pending submissions...</p> : null}

          {!loading && pendingSubmissions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-700 px-3 py-4 text-sm text-gray-400">
              No submissions are waiting for manual grading.
            </p>
          ) : null}

          <div className="space-y-3 mt-4">
            {pendingSubmissions.map((item) => (
              <button
                key={item.submission_id}
                type="button"
                onClick={() => loadSubmissionDetail(item.submission_id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                  selectedSubmission === item.submission_id
                    ? "border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "border-gray-700/50 bg-gray-900/40 hover:border-cyan-500/30 hover:bg-gray-800/60"
                }`}
              >
                <p className="text-base font-semibold text-gray-100">{item.student_name}</p>
                <p className="text-sm font-medium text-gray-400 mt-0.5">{item.module_title}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-cyan-500">
                  Pending questions: {item.pending_questions_count || 0}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="xl:col-span-7 rounded-2xl border border-gray-700/50 bg-gray-800/60 backdrop-blur-md p-5 shadow-lg">
          <h2 className="text-xl font-bold tracking-tight text-white">Manual Grading</h2>

          {detailLoading ? <p className="mt-3 text-sm text-gray-400">Loading submission detail...</p> : null}
          {detailError ? (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {detailError}
            </p>
          ) : null}

          {!detailLoading && !detail ? (
            <p className="mt-3 rounded-lg border border-dashed border-gray-700 px-3 py-4 text-sm text-gray-400">
              Select a pending submission to grade subjective answers.
            </p>
          ) : null}

          {detail ? (
            <div className="space-y-5 mt-4">
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-5 py-4 text-sm text-gray-300 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="flex gap-6">
                  <p className="uppercase tracking-wider text-xs font-bold text-gray-400">Auto: <span className="font-semibold text-lg text-gray-100 ml-1 block sm:inline">{detail.auto_graded_score}</span></p>
                  <p className="uppercase tracking-wider text-xs font-bold text-gray-400">Current: <span className="font-semibold text-lg text-gray-100 ml-1 block sm:inline">{detail.manual_graded_score}</span></p>
                </div>
                <p className="text-cyan-400 font-bold uppercase tracking-wider text-xs bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20">Draft Score: <span className="text-lg">{manualTotal}</span></p>
              </div>

              {(detail.manual_questions || []).map((question) => (
                <article
                  key={question.question_id}
                  className="rounded-xl border border-gray-700/50 bg-gray-900/40 p-5 shadow-inner"
                >
                  <p className="text-base font-medium text-gray-100">{question.question_text}</p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-widest text-indigo-400">Student answer:</p>
                  <div className="mt-1.5 rounded-lg border border-gray-700/30 bg-gray-800/50 p-3">
                    <p className="text-sm font-medium leading-relaxed text-gray-300">{question.student_answer || "No answer"}</p>
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Points</label>
                    <input
                      type="number"
                      min={0}
                      max={Number(question.max_points || 0)}
                      value={grades[question.question_id] ?? 0}
                      onChange={(event) =>
                        setGrades((previous) => ({
                          ...previous,
                          [question.question_id]: Number(event.target.value || 0),
                        }))
                      }
                      className="w-24 rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-base font-semibold text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all"
                    />
                    <span className="text-sm font-semibold text-gray-500">/ {question.max_points}</span>
                  </div>
                </article>
              ))}

              <label className="block mt-4">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Overall Feedback</span>
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  rows={4}
                  placeholder="Provide constructive feedback for the student..."
                  className="mt-2 w-full rounded-xl border border-gray-700/50 bg-gray-900/50 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all"
                />
              </label>

              <button
                type="button"
                onClick={handleGrade}
                disabled={saving}
                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-cyan-500 transition-colors disabled:opacity-60 shadow-lg shadow-cyan-900/50"
              >
                <IoCheckmarkCircleOutline size={20} />
                {saving ? "Saving Grades..." : "Finalize Grades"}
              </button>
            </div>
          ) : null}
        </section>
      </div>

      </div>
        </div>
    </section>
  );
};

export default TeacherGradingDashboard;
