import React, { useEffect, useMemo, useState } from "react";
import {
  IoBuildOutline,
  IoCheckmarkCircleOutline,
  IoChevronDownOutline,
  IoChevronUpOutline,
  IoRefreshOutline,
  IoRocketOutline,
  IoSaveOutline,
} from "react-icons/io5";
import apiClient from "../../services/apiClient";

const toLocalInputValue = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const normalizeQuestion = (question) => ({
  id: question.id,
  type: question.type || "mcq",
  question_text: question.question_text || "",
  options: Array.isArray(question.options) ? question.options : null,
  correct_answer: question.correct_answer || "",
  points: Number(question.points || 10),
  expected_length: question.expected_length || null,
  rubric: question.rubric || null,
});

const toIsoStringSafe = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const sanitizeQuestionsForSave = (questionList = []) =>
  questionList
    .map((question) => {
      const normalizedType = String(question.type || "mcq").trim().toLowerCase();
      const normalizedQuestionText = String(question.question_text || "").trim();
      const normalizedPoints = Number(question.points || 0);
      const normalizedOptions = Array.isArray(question.options)
        ? question.options.map((option) => String(option || "").trim()).filter(Boolean)
        : null;

      return {
        id: question.id,
        type: normalizedType,
        question_text: normalizedQuestionText,
        options: normalizedType === "mcq" ? normalizedOptions : null,
        correct_answer: String(question.correct_answer || "").trim(),
        points: Number.isFinite(normalizedPoints) && normalizedPoints > 0 ? normalizedPoints : 1,
        expected_length: question.expected_length || null,
        rubric: question.rubric || null,
      };
    })
    .filter((question) => question.id && question.question_text);

const toDisplayDateTime = (value) => {
  if (!value) {
    return "Not set";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Not set";
  }

  return parsed.toLocaleString();
};

const ModuleAssessmentEditor = ({ classroomId, moduleId, onPublished }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [assessmentId, setAssessmentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [passingScore, setPassingScore] = useState(0.7);
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [questions, setQuestions] = useState([]);
  const [published, setPublished] = useState(false);
  const [isDraftCollapsed, setIsDraftCollapsed] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadLatestAssessment = async () => {
      if (!moduleId) {
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await apiClient.get(`/api/module-assessment/module/${moduleId}/latest`);
        const latestAssessment = response?.assessment;

        if (!isMounted || !latestAssessment) {
          return;
        }

        setAssessmentId(latestAssessment.assessment_id || "");
        setTitle(latestAssessment.title || "Final Assessment");
        setDescription(latestAssessment.description || "Final assessment for this module");
        setTimeLimitMinutes(Number(latestAssessment.time_limit_minutes || 60));
        setPassingScore(Number(latestAssessment.passing_score_percentage || 0.7));
        setValidFrom(toLocalInputValue(latestAssessment.valid_from));
        setValidUntil(toLocalInputValue(latestAssessment.valid_until));
        setQuestions((latestAssessment.questions || []).map(normalizeQuestion));
        setPublished(Boolean(latestAssessment.is_published));
        setIsDraftCollapsed(false);
        setMessage(
          latestAssessment.is_draft
            ? "Loaded existing draft for this module."
            : "Loaded latest published assessment."
        );
      } catch {
        if (isMounted) {
          // Ignore not-found style cases and allow creating a fresh draft.
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadLatestAssessment();

    return () => {
      isMounted = false;
    };
  }, [moduleId]);

  const totalPoints = useMemo(
    () => questions.reduce((sum, question) => sum + Number(question.points || 0), 0),
    [questions]
  );

  const handleGenerateDraft = async () => {
    if (!moduleId) {
      setError("Select a module before generating an assessment draft.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await apiClient.post(`/api/module-assessment/draft-generate`, {
        module_id: moduleId,
        num_questions: 20,
        question_types: ["mcq", "fill_blank", "short_answer"],
      });

      const now = new Date();
      const plusSeven = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      setAssessmentId(response?.assessment_id || "");
      setQuestions((response?.questions || []).map(normalizeQuestion));
      setTitle(`${response?.assessment_title || "Final Assessment"}`);
      setDescription("Final assessment for this module");
      setTimeLimitMinutes(60);
      setPassingScore(0.7);
      setValidFrom(toLocalInputValue(now));
      setValidUntil(toLocalInputValue(plusSeven));
      setPublished(false);
      setIsDraftCollapsed(false);
      setLastSavedAt("");

      setMessage(response?.message || "Draft generated.");
    } catch (err) {
      setError(err?.message || "Failed to generate draft");
    } finally {
      setLoading(false);
    }
  };

  const handleQuestionField = (questionId, field, value) => {
    setQuestions((previous) =>
      previous.map((question) =>
        question.id === questionId
          ? {
              ...question,
              [field]: field === "points" ? Number(value || 0) : value,
            }
          : question
      )
    );
  };

  const handleSaveDraft = async () => {
    if (!assessmentId) {
      setError("Generate an assessment draft first.");
      return;
    }

    const validFromIso = toIsoStringSafe(validFrom || Date.now());
    const validUntilIso = toIsoStringSafe(validUntil || Date.now());

    if (!validFromIso || !validUntilIso) {
      setError("Please provide valid start and end date-time values.");
      return;
    }

    if (new Date(validUntilIso).getTime() <= new Date(validFromIso).getTime()) {
      setError("Valid Until must be after Valid From.");
      return;
    }

    const sanitizedQuestions = sanitizeQuestionsForSave(questions);
    if (sanitizedQuestions.length === 0) {
      setError("Add at least one valid question before saving.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await apiClient.patch(`/api/module-assessment/${assessmentId}`, {
        title: String(title || "").trim() || "Final Assessment",
        description: String(description || "").trim() || "Final assessment for this module",
        time_limit_minutes: Number(timeLimitMinutes || 60),
        valid_from: validFromIso,
        valid_until: validUntilIso,
        passing_score_percentage: Number(passingScore || 0.7),
        questions: sanitizedQuestions,
      });

      setMessage(response?.message || "Draft saved.");
      if (response?.assessment) {
        setQuestions((response.assessment.questions || []).map(normalizeQuestion));
      }
      setLastSavedAt(new Date().toISOString());
      setIsDraftCollapsed(true);
    } catch (err) {
      setError(err?.message || "Failed to save draft");
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!assessmentId) {
      setError("Generate and save an assessment before publishing.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await apiClient.post(`/api/module-assessment/${assessmentId}/publish`, {});
      setPublished(true);
      setMessage(response?.message || "Assessment published.");
      onPublished?.(response);
    } catch (err) {
      setError(err?.message || "Failed to publish assessment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-purple-100">
            <IoBuildOutline />
            Final Assessment Builder
          </h3>
          <p className="mt-1 text-sm text-purple-100/80">
            Generate a draft, edit questions, then publish when ready.
          </p>
        </div>

        <button
          type="button"
          onClick={handleGenerateDraft}
          disabled={loading || !moduleId}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600 disabled:opacity-60"
        >
          {loading ? <IoRefreshOutline className="animate-spin" /> : <IoRocketOutline />}
          Generate Draft
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="mt-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {message}
        </p>
      ) : null}

      {assessmentId ? (
        <div className="mt-4 space-y-4">
          {isDraftCollapsed ? (
            <button
              type="button"
              onClick={() => setIsDraftCollapsed(false)}
              className="w-full rounded-lg border border-purple-300/30 bg-gray-900/60 p-4 text-left hover:border-purple-300/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-purple-100">{title || "Final Assessment"}</p>
                  <p className="mt-1 text-xs text-purple-200/90">
                    {questions.length} questions • {totalPoints} total points • Passing score {Math.round(
                      Number(passingScore || 0) * 100
                    )}%
                  </p>
                  <p className="mt-2 text-xs text-purple-200/80">
                    Valid from: {toDisplayDateTime(validFrom)}
                  </p>
                  <p className="text-xs text-purple-200/80">
                    Valid until: {toDisplayDateTime(validUntil)}
                  </p>
                  <p className="mt-2 text-xs text-emerald-200">
                    {lastSavedAt
                      ? `Draft compressed after save at ${toDisplayDateTime(lastSavedAt)}.`
                      : "Draft is currently collapsed."}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-purple-300/30 px-2 py-1 text-xs text-purple-100">
                  <IoChevronDownOutline /> Open Full Draft
                </span>
              </div>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setIsDraftCollapsed(true)}
                className="inline-flex items-center gap-1 self-start rounded-md border border-purple-300/30 bg-gray-900/50 px-2 py-1 text-xs text-purple-100 hover:border-purple-300/60"
              >
                <IoChevronUpOutline /> Collapse Draft
              </button>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-sm text-purple-100">
                  Title
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-purple-300/30 bg-gray-900/60 px-3 py-2 text-sm text-white focus:border-purple-300 focus:outline-none"
                  />
                </label>

                <label className="text-sm text-purple-100">
                  Time Limit (minutes)
                  <input
                    type="number"
                    min={10}
                    value={timeLimitMinutes}
                    onChange={(event) => setTimeLimitMinutes(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-purple-300/30 bg-gray-900/60 px-3 py-2 text-sm text-white focus:border-purple-300 focus:outline-none"
                  />
                </label>

                <label className="text-sm text-purple-100 md:col-span-2">
                  Description
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-lg border border-purple-300/30 bg-gray-900/60 px-3 py-2 text-sm text-white focus:border-purple-300 focus:outline-none"
                  />
                </label>

                <label className="text-sm text-purple-100">
                  Valid From
                  <input
                    type="datetime-local"
                    value={validFrom}
                    onChange={(event) => setValidFrom(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-purple-300/30 bg-gray-900/60 px-3 py-2 text-sm text-white focus:border-purple-300 focus:outline-none"
                  />
                </label>

                <label className="text-sm text-purple-100">
                  Valid Until
                  <input
                    type="datetime-local"
                    value={validUntil}
                    onChange={(event) => setValidUntil(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-purple-300/30 bg-gray-900/60 px-3 py-2 text-sm text-white focus:border-purple-300 focus:outline-none"
                  />
                </label>

                <label className="text-sm text-purple-100">
                  Passing Score (0-1)
                  <input
                    type="number"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={passingScore}
                    onChange={(event) => setPassingScore(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-purple-300/30 bg-gray-900/60 px-3 py-2 text-sm text-white focus:border-purple-300 focus:outline-none"
                  />
                </label>

                <div className="rounded-lg border border-purple-300/30 bg-gray-900/60 px-3 py-2 text-sm text-purple-100">
                  Total Points: <span className="font-semibold">{totalPoints}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-purple-100">Questions</h4>
                {questions.map((question, index) => (
                  <article
                    key={question.id}
                    className="rounded-lg border border-purple-300/20 bg-gray-900/50 px-3 py-3"
                  >
                    <p className="text-xs text-purple-200">Question {index + 1}</p>
                    <textarea
                      value={question.question_text}
                      onChange={(event) =>
                        handleQuestionField(question.id, "question_text", event.target.value)
                      }
                      rows={2}
                      className="mt-1 w-full rounded-md border border-purple-300/20 bg-gray-950 px-3 py-2 text-sm text-white focus:border-purple-300 focus:outline-none"
                    />
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        value={question.type}
                        onChange={(event) =>
                          handleQuestionField(question.id, "type", event.target.value)
                        }
                        className="rounded-md border border-purple-300/20 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-300 focus:outline-none"
                      />
                      <input
                        type="number"
                        min={1}
                        value={question.points}
                        onChange={(event) =>
                          handleQuestionField(question.id, "points", event.target.value)
                        }
                        className="rounded-md border border-purple-300/20 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-300 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={question.correct_answer || ""}
                        onChange={(event) =>
                          handleQuestionField(question.id, "correct_answer", event.target.value)
                        }
                        placeholder="Correct answer"
                        className="rounded-md border border-purple-300/20 bg-gray-950 px-3 py-2 text-xs text-white focus:border-purple-300 focus:outline-none"
                      />
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={loading || !assessmentId}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              <IoSaveOutline /> Save Draft
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={loading || published}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              <IoCheckmarkCircleOutline /> {published ? "Published" : "Publish"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default ModuleAssessmentEditor;
