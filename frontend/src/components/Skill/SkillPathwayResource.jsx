import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import IconsCarousel from "../IconsCarousel";
import {
  IoChatbubbleEllipsesOutline,
  IoCheckmarkCircle,
  IoHelpCircleOutline,
  IoRefreshOutline,
  IoSparklesOutline,
  IoTimeOutline,
  IoTrophyOutline,
} from "react-icons/io5";
import apiClient from "../../services/apiClient";
import { API_ENDPOINTS } from "../../config/api";
import AppBackButton from "../UI/AppBackButton";
import QuizModal from "../Classroom/QuizModal";
import QuizFeedbackModal from "../Classroom/QuizFeedbackModal";

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

const SkillPathwayResource = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: pathwayId, stageIndex, resourceId } = useParams();
  const classroomId = "standalone";
  const moduleId = "standalone";

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
  const [stageQuizPrompt, setStageQuizPrompt] = useState("");
  const [hasAutoOpenedAssessment, setHasAutoOpenedAssessment] = useState(false);

  const videoUrl = useMemo(
    () => normalizeResourceUrl(resource?.url || resource?.youtube_url || ""),
    [resource]
  );
  const videoId = useMemo(() => extractYouTubeId(videoUrl), [videoUrl]);

  const progressStatus = resourceProgress?.status;
  const testsTaken = Number(resourceProgress?.tests_taken || 0);
  const passedCount = Number(resourceProgress?.passed_tests_count || 0);
  const passTarget = 2;
  const passProgress = Math.min(passedCount / passTarget, 1);

  const progressLabel = useMemo(() => {
    if (progressStatus === "completed") return "Completed";
    if (progressStatus === "in_progress") return "In Progress";
    if (progressStatus === "unlocked") return "Unlocked";
    if (progressStatus === "locked") return "Locked";
    return "Not Started";
  }, [progressStatus]);

  const statusConfig = useMemo(() => {
    if (progressStatus === "completed")
      return { color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: <IoCheckmarkCircle className="text-emerald-400" /> };
    if (progressStatus === "in_progress")
      return { color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: <IoTimeOutline className="text-amber-400" /> };
    return { color: "text-gray-400", bg: "bg-gray-800/50", border: "border-gray-700", icon: <IoTimeOutline className="text-gray-500" /> };
  }, [progressStatus]);

  const loadProgress = async (targetStudentId, selectedResourceId) => {
    if (!targetStudentId || !pathwayId || !stageIndex) return;

    try {
      const response = await apiClient.get(API_ENDPOINTS.PATHWAY_STAGE_DETAILS(pathwayId, stageIndex));
      const tracker = response?.data?.tracker || {};
      const resources = Array.isArray(tracker.resources) ? tracker.resources : [];
      const found = resources.find((item) => item.resource_id === selectedResourceId) || null;
      if (found) {
        setResourceProgress({
          ...found,
          status: found.passed_tests_count >= 2 ? "completed" : "in_progress",
        });
      } else {
        setResourceProgress(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadContext = async () => {
      if (!pathwayId || !stageIndex || !resourceId) return;

      setLoading(true);
      setError("");
      setInfoMessage("");

      try {
        const [profileResponse, stageResponse] = await Promise.all([
          apiClient.get(API_ENDPOINTS.AUTH_USER_PROFILE),
          apiClient.get(API_ENDPOINTS.PATHWAY_STAGE_DETAILS(pathwayId, stageIndex)),
        ]);

        if (!isMounted) return;

        const resolvedStudentId = String(
          profileResponse?.user_id || profileResponse?.id || profileResponse?._id || ""
        ).trim();
        setStudentId(resolvedStudentId);

        const modulePayload = stageResponse?.data?.tracker || null;
        if (!modulePayload) {
          throw new Error("Stage tracker not found");
        }

        setStageQuizPrompt(String(stageResponse?.data?.quiz_prompt || "").trim());
        setModuleData({ name: `Stage ${stageIndex}` });

        const moduleResources = Array.isArray(modulePayload.resources)
          ? modulePayload.resources
          : [];

        const selectedResource = moduleResources.find(
          (item) => getResourceId(item) === String(resourceId)
        );

        if (!selectedResource) {
          throw new Error("Resource not found in this stage");
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
                if (isMounted) setChatHistory([]);
              }
            })(),
          ]);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load lesson");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadContext();

    return () => {
      isMounted = false;
    };
  }, [pathwayId, stageIndex, resourceId]);

  useEffect(() => {
    setHasAutoOpenedAssessment(false);
  }, [pathwayId, stageIndex, resourceId]);

  const toQuizSession = (response) => ({
    quizAttemptId: response?.quiz_attempt_id,
    questions: Array.isArray(response?.questions) ? response.questions : [],
    totalPoints: Number(response?.total_points || 0),
  });

  const handleSummary = async () => {
    if (!resourceId || !videoUrl) return;

    setSummaryLoading(true);
    setInfoMessage("");

    try {
      let response;
      let sourceLabel = "studio";

      try {
        response = await apiClient.post(API_ENDPOINTS.STUDIO_GENERATE, {
          type: "summary",
          resource_id: resourceId,
          resource_url: videoUrl,
          force_refresh: false,
        });
      } catch {
        sourceLabel = "resource endpoint";
        response = await apiClient.get(
          `${API_ENDPOINTS.RESOURCE_SUMMARY_GET_OR_CREATE}?resource_id=${encodeURIComponent(
            resourceId
          )}&resource_url=${encodeURIComponent(videoUrl)}`
        );
      }

      setSummary(response?.summary || "Summary unavailable.");
      const cacheMessage = response?.is_cached ? "Loaded cached summary." : "Generated new summary.";
      setInfoMessage(`${cacheMessage} (${sourceLabel})`);
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
      let response;
      let sourceLabel = "studio";

      try {
        response = await apiClient.post(API_ENDPOINTS.STUDIO_GENERATE, {
          type: "quiz",
          resource_url: videoUrl,
          resource_id: resourceId,
          module_id: moduleId,
          classroom_id: classroomId,
          student_id: studentId,
          pathway_quiz_prompt: stageQuizPrompt || undefined,
        });
      } catch {
        sourceLabel = "quiz endpoint";
        response = await apiClient.post(API_ENDPOINTS.YOUTUBE_QUIZ_GENERATE, {
          youtube_url: videoUrl,
          resource_id: resourceId,
          module_id: moduleId,
          classroom_id: classroomId,
          student_id: studentId,
          pathway_quiz_prompt: stageQuizPrompt || undefined,
        });
      }

      setQuizSession(toQuizSession(response));
      setInfoMessage(`Quiz generated via ${sourceLabel}.`);
    } catch (err) {
      setInfoMessage(err?.message || "Unable to generate quiz");
    }
  };

  useEffect(() => {
    const shouldAutoOpenAssessment = searchParams.get("assessment") === "1";
    if (!shouldAutoOpenAssessment || hasAutoOpenedAssessment || loading) return;
    if (!videoUrl || !studentId) return;

    setHasAutoOpenedAssessment(true);
    handleStartQuiz();

    const updatedParams = new URLSearchParams(searchParams);
    updatedParams.delete("assessment");
    setSearchParams(updatedParams, { replace: true });
  }, [searchParams, hasAutoOpenedAssessment, loading, videoUrl, studentId, setSearchParams, stageQuizPrompt]);

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
      <section className="relative min-h-screen flex items-center justify-center pt-28 text-gray-200">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
        </div>
        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-t-cyan-500 border-b-indigo-500 border-l-transparent border-r-transparent rounded-full animate-spin"></div>
          <p className="text-lg font-medium">Loading lesson...</p>
        </div>
      </section>
    );
  }

  if (error || !resource) {
    return (
      <section className="relative min-h-screen flex items-center justify-center pt-28 px-4 text-gray-200">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
        </div>
        <div className="relative z-10 bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-2xl p-8 shadow-xl max-w-xl w-full text-center">
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-4 text-red-200 mb-6 font-medium">
            {error || "Resource not found."}
          </p>
          <div className="flex justify-center">
            <AppBackButton
              label="Back to Pathway"
              fallbackTo={`/skill-pathway/${pathwayId}/resources`}
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative min-h-screen px-4 py-12 pt-28">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>

      <div className="container mx-auto relative z-10 max-w-7xl">
        <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-3xl p-5 md:p-8 shadow-2xl space-y-6">
          
      <header className="rounded-2xl border border-gray-700/50 bg-gray-800/60 backdrop-blur-md p-5 pb-6">
        <AppBackButton
          label="Back to Pathway"
          fallbackTo={`/skill-pathway/${pathwayId}/resources`}
        />
        <h1 className="mt-4 text-3xl md:text-4xl font-bold text-white tracking-tight">{resource.title || "Resource"}</h1>
        <p className="mt-1.5 text-base font-medium text-emerald-400">{moduleData?.name || `Stage ${stageIndex}`}</p>
      </header>

      {infoMessage && (
        <p className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-5 py-4 text-sm text-indigo-200 mb-2">
          {infoMessage}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-5">
          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/60 backdrop-blur-md p-5">
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

            {/* Progress Card */}
            <div className={`mt-4 rounded-xl border ${statusConfig.border} ${statusConfig.bg} p-4`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {statusConfig.icon}
                  <span className={`text-sm font-semibold ${statusConfig.color}`}>{progressLabel}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <IoTimeOutline className="shrink-0" />
                  <span>{testsTaken} attempt{testsTaken !== 1 ? "s" : ""} taken</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <IoTrophyOutline className="text-emerald-400" />
                    Tests passed
                  </span>
                  <span className="text-xs font-semibold text-emerald-300">
                    {passedCount} / {passTarget}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${passProgress * 100}%` }}
                  />
                </div>
                {passedCount >= passTarget && (
                  <p className="mt-1.5 text-xs text-emerald-400 font-medium">
                    ✓ Requirement met — this resource is complete.
                  </p>
                )}
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
                {summaryLoading ? "Generating Summary..." : "Generate Summary (Studio)"}
              </button>

              <button
                type="button"
                onClick={handleStartQuiz}
                disabled={!videoUrl}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
              >
                <IoHelpCircleOutline />
                Take Test (Studio)
              </button>
            </div>

            {summary && (
              <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
                <p className="text-sm text-blue-100">{summary}</p>
              </div>
            )}
          </div>
        </div>

        <aside className="xl:col-span-4 rounded-2xl border border-gray-700/50 bg-gray-800/60 backdrop-blur-md p-5">
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

      </div>
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

export default SkillPathwayResource;