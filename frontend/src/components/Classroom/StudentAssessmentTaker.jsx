import React, { useEffect, useMemo, useState } from "react";
import { IoCloseOutline, IoSendOutline, IoTimeOutline } from "react-icons/io5";
import apiClient from "../../services/apiClient";

const formatRemaining = (seconds) => {
  const safe = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
};

const StudentAssessmentTaker = ({ assessmentId, studentId, onClose, onSubmitted }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submission, setSubmission] = useState(null);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const startAssessment = async () => {
      if (!assessmentId || !studentId) return;

      setLoading(true);
      setError("");

      try {
        const response = await apiClient.post(`/api/module-assessment/submission/start`, {
          assessment_id: assessmentId,
          student_id: studentId,
        });

        if (!isMounted) return;

        setSubmission(response);

        const expiresAt = new Date(response?.expires_at || Date.now());
        const now = new Date();
        const initialSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
        setSecondsLeft(initialSeconds);
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Unable to start assessment");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    startAssessment();

    return () => {
      isMounted = false;
    };
  }, [assessmentId, studentId]);

  useEffect(() => {
    if (!submission?.expires_at) return undefined;

    const expiresAt = new Date(submission.expires_at).getTime();
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [submission]);

  const unansweredCount = useMemo(() => {
    const questions = Array.isArray(submission?.questions) ? submission.questions : [];
    return questions.filter((question) => !String(answers[question.id] || "").trim()).length;
  }, [submission, answers]);

  const handleAnswer = (questionId, value) => {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!submission?.submission_id) return;

    setLoading(true);
    setError("");

    try {
      const questionList = Array.isArray(submission?.questions) ? submission.questions : [];
      const payloadAnswers = questionList.map((question) => ({
        question_id: question.id,
        answer: String(answers[question.id] || "").trim(),
      }));

      const response = await apiClient.post(
        `/api/module-assessment/submission/${submission.submission_id}/submit`,
        {
          submission_id: submission.submission_id,
          answers: payloadAnswers,
        }
      );

      setResult(response);
      onSubmitted?.(response);
    } catch (err) {
      setError(err?.message || "Failed to submit assessment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-5xl rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Final Module Assessment</h3>
            <p className="text-xs text-gray-400">Complete all answers before submitting.</p>
          </div>

          <div className="flex items-center gap-3">
            <p
              className={`inline-flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-medium ${
                secondsLeft <= 300
                  ? "bg-rose-500/20 text-rose-200"
                  : "bg-cyan-500/20 text-cyan-200"
              }`}
            >
              <IoTimeOutline />
              {formatRemaining(secondsLeft)}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            >
              <IoCloseOutline className="text-xl" />
            </button>
          </div>
        </header>

        <div className="max-h-[78vh] overflow-y-auto px-5 py-4">
          {loading && !submission ? (
            <p className="text-sm text-gray-400">Preparing assessment...</p>
          ) : null}

          {error ? (
            <p className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          ) : null}

          {result ? (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              <p>{result.message || "Assessment submitted successfully."}</p>
              <p className="mt-1">
                Auto-graded score: {result.auto_graded_score} • Pending manual grading: {result.pending_manual_grade_count || 0}
              </p>
            </div>
          ) : null}

          {!result && submission ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {(submission.questions || []).map((question, index) => {
                const value = answers[question.id] || "";
                const isMCQ = Array.isArray(question.options) && question.options.length > 0;

                return (
                  <article
                    key={question.id}
                    className="rounded-lg border border-gray-700 bg-gray-950/60 px-4 py-3"
                  >
                    <p className="text-sm text-gray-100">
                      <span className="mr-2 text-cyan-300">Q{index + 1}.</span>
                      {question.question_text}
                    </p>

                    {isMCQ ? (
                      <div className="mt-3 space-y-2">
                        {question.options.map((option, optionIndex) => (
                          <label
                            key={`${question.id}-${optionIndex}`}
                            className="flex cursor-pointer items-center gap-2 rounded-md border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-200 hover:border-cyan-500/50"
                          >
                            <input
                              type="radio"
                              name={question.id}
                              value={String(option)}
                              checked={String(value) === String(option)}
                              onChange={(event) => handleAnswer(question.id, event.target.value)}
                            />
                            <span>{option}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={value}
                        onChange={(event) => handleAnswer(question.id, event.target.value)}
                        rows={4}
                        className="mt-3 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-cyan-500 focus:outline-none"
                        placeholder="Write your answer"
                      />
                    )}
                  </article>
                );
              })}

              <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-700 pt-4">
                <p className="text-sm text-gray-400">
                  {unansweredCount > 0
                    ? `${unansweredCount} question(s) unanswered`
                    : "All questions answered"}
                </p>
                <button
                  type="submit"
                  disabled={loading || secondsLeft === 0}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
                >
                  <IoSendOutline />
                  {loading ? "Submitting..." : "Submit Assessment"}
                </button>
              </footer>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default StudentAssessmentTaker;
