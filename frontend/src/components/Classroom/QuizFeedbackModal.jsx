import React from "react";
import {
  IoCheckmarkCircleOutline,
  IoCloseCircleOutline,
  IoCloseOutline,
} from "react-icons/io5";

const toPercent = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
};

const QuizFeedbackModal = ({ feedback, onClose }) => {
  if (!feedback) return null;

  const percent = toPercent(feedback.score_percentage);
  const passed = Boolean(feedback.passed);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Quiz Feedback</h3>
            <p className="text-xs text-gray-400">Review answers before moving to the next step.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          >
            <IoCloseOutline className="text-xl" />
          </button>
        </header>

        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">
          <section
            className={`rounded-lg border px-4 py-3 ${
              passed
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-rose-500/40 bg-rose-500/10"
            }`}
          >
            <div className="flex items-center gap-2">
              {passed ? (
                <IoCheckmarkCircleOutline className="text-lg text-emerald-300" />
              ) : (
                <IoCloseCircleOutline className="text-lg text-rose-300" />
              )}
              <p className="text-sm font-medium text-gray-100">
                Score: {feedback.score_obtained}/{feedback.total_points} ({percent}%)
              </p>
            </div>
            <p className="mt-2 text-sm text-gray-200">{feedback.ai_feedback}</p>
            {feedback.progress_update?.message && (
              <p className="mt-2 text-sm text-cyan-200">{feedback.progress_update.message}</p>
            )}
          </section>

          <section className="mt-4">
            <h4 className="text-sm font-semibold text-gray-200">Answer Review</h4>
            <div className="mt-2 space-y-2">
              {(feedback.correct_answers || []).map((item) => (
                <article
                  key={item.question_id}
                  className="rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2"
                >
                  <p className="text-sm text-gray-100">{item.question_text}</p>
                  <p className="mt-1 text-xs text-gray-300">Your answer: {String(item.your_answer || "-")}</p>
                  <p className="text-xs text-gray-400">
                    Correct answer: {String(item.correct_answer || "-")}
                  </p>
                  <p
                    className={`mt-1 text-xs font-medium ${
                      item.is_correct ? "text-emerald-300" : "text-rose-300"
                    }`}
                  >
                    {item.is_correct ? "Correct" : "Needs review"}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizFeedbackModal;
