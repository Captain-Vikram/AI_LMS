import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IoArrowBackOutline,
  IoCheckmarkCircleOutline,
  IoRefreshOutline,
} from "react-icons/io5";
import apiClient from "../../services/apiClient";

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
    <section className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <header className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
        <button
          type="button"
          onClick={() => navigate(`/classroom/${classroomId}/dashboard`)}
          className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
        >
          <IoArrowBackOutline />
          Back to Dashboard
        </button>
        <h1 className="mt-2 text-2xl font-semibold text-gray-100">Teacher Grading Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Review submissions that require manual grading.
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section className="xl:col-span-5 rounded-xl border border-gray-700 bg-gray-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-100">Pending Submissions</h2>
            <button
              type="button"
              onClick={loadPending}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-md bg-gray-800 px-2 py-1 text-xs text-gray-200 hover:bg-gray-700 disabled:opacity-60"
            >
              <IoRefreshOutline className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {loading ? <p className="text-sm text-gray-400">Loading pending submissions...</p> : null}

          {!loading && pendingSubmissions.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-700 px-3 py-4 text-sm text-gray-400">
              No submissions are waiting for manual grading.
            </p>
          ) : null}

          <div className="space-y-2">
            {pendingSubmissions.map((item) => (
              <button
                key={item.submission_id}
                type="button"
                onClick={() => loadSubmissionDetail(item.submission_id)}
                className={`w-full rounded-lg border px-3 py-2 text-left ${
                  selectedSubmission === item.submission_id
                    ? "border-cyan-500 bg-cyan-500/10"
                    : "border-gray-700 bg-gray-950/60 hover:border-cyan-500/40"
                }`}
              >
                <p className="text-sm font-medium text-gray-100">{item.student_name}</p>
                <p className="text-xs text-gray-400">{item.module_title}</p>
                <p className="mt-1 text-xs text-gray-500">
                  Pending questions: {item.pending_questions_count || 0}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="xl:col-span-7 rounded-xl border border-gray-700 bg-gray-900/60 p-4">
          <h2 className="text-lg font-semibold text-gray-100">Manual Grading</h2>

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
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2 text-sm text-gray-300">
                <p>Auto-graded score: {detail.auto_graded_score}</p>
                <p>Manual score (current): {detail.manual_graded_score}</p>
                <p className="text-cyan-300">Manual score (draft): {manualTotal}</p>
              </div>

              {(detail.manual_questions || []).map((question) => (
                <article
                  key={question.question_id}
                  className="rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-3"
                >
                  <p className="text-sm text-gray-100">{question.question_text}</p>
                  <p className="mt-1 text-xs text-gray-400">Student answer:</p>
                  <p className="text-sm text-gray-300">{question.student_answer || "No answer"}</p>

                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-xs text-gray-400">Points</label>
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
                      className="w-24 rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-sm text-gray-100 focus:border-cyan-500 focus:outline-none"
                    />
                    <span className="text-xs text-gray-500">/ {question.max_points}</span>
                  </div>
                </article>
              ))}

              <label className="block text-sm text-gray-300">
                Overall Feedback
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-cyan-500 focus:outline-none"
                />
              </label>

              <button
                type="button"
                onClick={handleGrade}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
              >
                <IoCheckmarkCircleOutline />
                {saving ? "Saving Grades..." : "Finalize Grades"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  );
};

export default TeacherGradingDashboard;
