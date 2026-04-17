import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IoArrowBackOutline,
  IoChatbubbleEllipsesOutline,
  IoHelpCircleOutline,
  IoRefreshOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import apiClient from "../../services/apiClient";
import { API_ENDPOINTS } from "../../config/api";
import QuizModal from "./QuizModal";
import QuizFeedbackModal from "./QuizFeedbackModal";

const getResourceId = (resource) => String(resource?.id || resource?.resource_id || "").trim();

const normalizeResourceUrl = (rawValue) => {
  if (Array.isArray(rawValue)) {
    const firstValid = rawValue.find(
      (item) => typeof item === "string" && item.trim().length > 0
    );
    return firstValid ? firstValid.trim() : "";
  }

  const text = String(rawValue || "").trim();
  if (!text) return "";

  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text.replace(/'/g, '"'));
      if (Array.isArray(parsed)) {
        const firstValid = parsed.find(
          (item) => typeof item === "string" && item.trim().length > 0
        );
        if (firstValid) {
          return firstValid.trim();
        }
      }
    } catch {
      // Fall through to regex extraction.
    }
  }

  const match = text.match(/https?:\/\/[^\s'\"]+/i);
  if (match) {
    return match[0].replace(/\\u0026/g, "&").trim();
  }

  return text.replace(/^['"]+|['"]+$/g, "").replace(/\\u0026/g, "&").trim();
};

const extractYouTubeId = (url) => {
  if (!url || typeof url !== "string") return null;
  const expression =
    /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(expression);
  return match && match[2].length === 11 ? match[2] : null;
};

const toPercent = (value) => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) return 0;
  return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
};

const InteractiveLessonViewer = () => {
  const navigate = useNavigate();
  const { id: classroomId, moduleId, resourceId } = useParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [studentId, setStudentId] = useState("");
  const [moduleData, setModuleData] = useState(null);
  const [resource, setResource] = useState(null);
  const [resourceProgress, setResourceProgress] = useState(null);

  const [summary, setSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [question, setQuestion] = useState("");
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  const [quizSession, setQuizSession] = useState(null);
  const [submittingQuiz, setSubmittingQuiz] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState(null);

  const [infoMessage, setInfoMessage] = useState("");

  const videoUrl = useMemo(
    () => normalizeResourceUrl(resource?.url || resource?.youtube_url || ""),
    [resource]
  );
  const videoId = useMemo(() => extractYouTubeId(videoUrl), [videoUrl]);

  const progressLabel = useMemo(() => {
    const status = resourceProgress?.status;
    if (status === "completed") return "Completed";
    if (status === "in_progress") return "In Progress";
    if (status === "unlocked") return "Unlocked";
    if (status === "locked") return "Locked";
    return "Not Started";
  }, [resourceProgress]);

  const loadProgress = async (targetStudentId, selectedResourceId) => {
    if (!targetStudentId || !moduleId || !classroomId) return;

    const response = await apiClient.get(
      `/api/student/progress/${moduleId}?student_id=${encodeURIComponent(
        targetStudentId
      )}&classroom_id=${encodeURIComponent(classroomId)}`
    );

    const resources = Array.isArray(response?.resources) ? response.resources : [];
    const found = resources.find((item) => item.resource_id === selectedResourceId) || null;
    setResourceProgress(found);
  };

  useEffect(() => {
    let isMounted = true;

    const loadContext = async () => {
      if (!classroomId || !moduleId || !resourceId) return;

      setLoading(true);
      setError("");
      setInfoMessage("");

      try {
        const [profileResponse, moduleResponse] = await Promise.all([
          apiClient.get(API_ENDPOINTS.AUTH_USER_PROFILE),
          apiClient.get(`/api/classroom/${classroomId}/modules/${moduleId}`),
        ]);

        if (!isMounted) return;

        const resolvedStudentId = String(
          profileResponse?.user_id || profileResponse?.id || profileResponse?._id || ""
        ).trim();
        setStudentId(resolvedStudentId);

        const modulePayload = moduleResponse?.module || moduleResponse?.data?.module || null;
        if (!modulePayload) {
          throw new Error("Module not found");
        }

        setModuleData(modulePayload);
        const moduleResources = Array.isArray(modulePayload.resources)
          ? [...modulePayload.resources].sort(
              (first, second) => Number(first?.order || 0) - Number(second?.order || 0)
            )
          : [];

        const selectedResource = moduleResources.find(
          (item) => getResourceId(item) === resourceId
        );

        if (!selectedResource) {
          throw new Error("Resource not found in this module");
        }

        setResource(selectedResource);

        if (resolvedStudentId) {
          await Promise.all([
            loadProgress(resolvedStudentId, resourceId),
            (async () => {
              try {
                const chatResponse = await apiClient.get(
                  `/api/resource/chat-history/${resourceId}/${resolvedStudentId}`
                );
                if (!isMounted) return;
                setChatHistory(
                  Array.isArray(chatResponse?.chat_history) ? chatResponse.chat_history : []
                );
              } catch {
                if (isMounted) {
                  setChatHistory([]);
                }
              }
            })(),
          ]);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load lesson");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [classroomId, moduleId, resourceId]);

  const handleSummary = async () => {
    if (!resourceId || !videoUrl) return;

    setSummaryLoading(true);
    setInfoMessage("");

    try {
      const response = await apiClient.get(
        `/api/resource/summary/get-or-create?resource_id=${encodeURIComponent(
          resourceId
        )}&resource_url=${encodeURIComponent(videoUrl)}`
      );

      setSummary(response?.summary || "Summary unavailable.");
      setInfoMessage(response?.is_cached ? "Loaded cached summary." : "Generated new summary.");
    } catch (err) {
      setInfoMessage(err?.message || "Failed to generate summary");
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleAskQuestion = async (event) => {
    event.preventDefault();
    if (!question.trim() || !studentId || !videoUrl) return;

    setAskingQuestion(true);
    setInfoMessage("");

    try {
      const response = await apiClient.post(`/api/resource/qa/ask`, {
        resource_id: resourceId,
        resource_url: videoUrl,
        student_id: studentId,
        module_id: moduleId,
        classroom_id: classroomId,
        question: question.trim(),
      });

      setChatHistory(Array.isArray(response?.chat_history) ? response.chat_history : []);
      setQuestion("");
    } catch (err) {
      setInfoMessage(err?.message || "Failed to ask question");
    } finally {
      setAskingQuestion(false);
    }
  };

  const handleStartQuiz = async () => {
    if (!videoUrl || !studentId) return;

    setInfoMessage("");

    try {
      const response = await apiClient.post(API_ENDPOINTS.YOUTUBE_QUIZ_GENERATE, {
        youtube_url: videoUrl,
        resource_id: resourceId,
        module_id: moduleId,
        classroom_id: classroomId,
        student_id: studentId,
      });

      setQuizSession({
        quizAttemptId: response?.quiz_attempt_id,
        questions: Array.isArray(response?.questions) ? response.questions : [],
        totalPoints: Number(response?.total_points || 0),
      });
    } catch (err) {
      setInfoMessage(err?.message || "Unable to generate quiz");
    }
  };

  const handleSubmitQuiz = async (quizAttemptId, answers) => {
    setSubmittingQuiz(true);
    setInfoMessage("");

    try {
      const response = await apiClient.post(API_ENDPOINTS.YOUTUBE_QUIZ_SUBMIT, {
        quiz_attempt_id: quizAttemptId,
        student_id: studentId,
        answers,
      });

      setQuizSession(null);
      setQuizFeedback(response);
      await loadProgress(studentId, resourceId);
    } catch (err) {
      setInfoMessage(err?.message || "Unable to submit quiz");
    } finally {
      setSubmittingQuiz(false);
    }
  };

  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8 text-gray-200">
        <p>Loading lesson...</p>
      </section>
    );
  }

  if (error || !resource) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-8 text-gray-200">
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200">
          {error || "Resource not found."}
        </p>
        <button
          type="button"
          onClick={() => navigate(`/classroom/${classroomId}/modules`)}
          className="mt-4 rounded-lg bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
        >
          Back to Modules
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <header className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
        <button
          type="button"
          onClick={() => navigate(`/classroom/${classroomId}/modules`)}
          className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
        >
          <IoArrowBackOutline />
          Back to Modules
        </button>
        <h1 className="mt-2 text-2xl font-semibold text-gray-100">{resource.title || "Resource"}</h1>
        <p className="mt-1 text-sm text-gray-400">{moduleData?.name || "Module"}</p>
      </header>

      {infoMessage && (
        <p className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
          {infoMessage}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-4">
          <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
            {videoId ? (
              <div className="aspect-video overflow-hidden rounded-lg border border-gray-700 bg-black">
                <iframe
                  title={resource.title || "Lesson video"}
                  src={`https://www.youtube.com/embed/${videoId}`}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-700 p-6 text-sm text-gray-400">
                Unable to embed this resource. Please verify the saved YouTube URL.
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-gray-700 bg-gray-950/50 px-3 py-2">
                <p className="text-xs text-gray-400">Status</p>
                <p className="text-sm font-medium text-cyan-200">{progressLabel}</p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-950/50 px-3 py-2">
                <p className="text-xs text-gray-400">Tests Taken</p>
                <p className="text-sm font-medium text-gray-100">{Number(resourceProgress?.tests_taken || 0)}</p>
              </div>
              <div className="rounded-lg border border-gray-700 bg-gray-950/50 px-3 py-2">
                <p className="text-xs text-gray-400">Passed (Need 2)</p>
                <p className="text-sm font-medium text-emerald-300">
                  {Number(resourceProgress?.passed_tests_count || 0)}/2
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSummary}
                disabled={summaryLoading || !videoUrl}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-60"
              >
                {summaryLoading ? <IoRefreshOutline className="animate-spin" /> : <IoSparklesOutline />}
                {summaryLoading ? "Generating Summary..." : "Generate Summary"}
              </button>

              <button
                type="button"
                onClick={handleStartQuiz}
                disabled={!videoUrl}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
              >
                <IoHelpCircleOutline />
                Take Test
              </button>
            </div>

            {summary && (
              <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <p className="text-sm text-blue-100">{summary}</p>
              </div>
            )}
          </div>
        </div>

        <aside className="xl:col-span-4 rounded-xl border border-gray-700 bg-gray-900/60 p-4">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-gray-100">
            <IoChatbubbleEllipsesOutline className="text-cyan-300" />
            Ask AI
          </h2>

          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
            {chatHistory.length > 0 ? (
              chatHistory.map((item, index) => (
                <article
                  key={`${item.asked_at || index}-${index}`}
                  className="rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2"
                >
                  <p className="text-xs text-cyan-200">Q: {item.question}</p>
                  <p className="mt-1 text-sm text-gray-100">A: {item.answer}</p>
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-gray-700 px-3 py-4 text-sm text-gray-400">
                Ask focused questions about this lesson. Each answer is stored in your resource chat history.
              </p>
            )}
          </div>

          <form onSubmit={handleAskQuestion} className="mt-4 space-y-2">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={3}
              placeholder="Ask about a concept in this video..."
              className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={askingQuestion || !question.trim() || !videoUrl}
              className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
            >
              {askingQuestion ? "Asking..." : "Ask Question"}
            </button>
          </form>
        </aside>
      </div>

      {quizSession && (
        <QuizModal
          quizAttemptId={quizSession.quizAttemptId}
          questions={quizSession.questions}
          totalPoints={quizSession.totalPoints}
          onSubmit={handleSubmitQuiz}
          onClose={() => setQuizSession(null)}
          loading={submittingQuiz}
        />
      )}

      {quizFeedback && (
        <QuizFeedbackModal feedback={quizFeedback} onClose={() => setQuizFeedback(null)} />
      )}
    </section>
  );
};

export default InteractiveLessonViewer;
