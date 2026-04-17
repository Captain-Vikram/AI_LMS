import React, { useMemo, useState } from "react";
import { IoCloseOutline, IoSendOutline } from "react-icons/io5";

const QuizModal = ({
  quizAttemptId,
  questions = [],
  totalPoints = 0,
  onSubmit,
  onClose,
  loading = false,
}) => {
  const [answers, setAnswers] = useState({});

  const unansweredCount = useMemo(
    () => questions.filter((question) => !String(answers[question.id] || "").trim()).length,
    [questions, answers]
  );

  const handleChange = (questionId, value) => {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const payload = questions.map((question) => ({
      question_id: question.id,
      answer: String(answers[question.id] || "").trim(),
    }));
    onSubmit?.(quizAttemptId, payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-4xl rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-700 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-100">Resource Quiz</h3>
            <p className="text-xs text-gray-400">
              {questions.length} question(s) • {totalPoints} points
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          >
            <IoCloseOutline className="text-xl" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="max-h-[75vh] overflow-y-auto px-5 py-4">
          <div className="space-y-5">
            {questions.map((question, index) => {
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
                            onChange={(event) => handleChange(question.id, event.target.value)}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={value}
                      onChange={(event) => handleChange(question.id, event.target.value)}
                      rows={3}
                      className="mt-3 w-full rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-100 focus:border-cyan-500 focus:outline-none"
                      placeholder="Type your answer"
                    />
                  )}
                </article>
              );
            })}
          </div>

          <footer className="mt-5 flex items-center justify-between border-t border-gray-700 pt-4">
            <p className="text-sm text-gray-400">
              {unansweredCount > 0
                ? `${unansweredCount} question(s) still unanswered.`
                : "All questions answered."}
            </p>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              <IoSendOutline />
              {loading ? "Submitting..." : "Submit Quiz"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
};

export default QuizModal;
