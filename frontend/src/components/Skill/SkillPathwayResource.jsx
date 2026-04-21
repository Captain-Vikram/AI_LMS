import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  IoArrowBackOutline,
  IoChatbubbleEllipsesOutline,
  IoHelpCircleOutline,
  IoRefreshOutline,
  IoSparklesOutline,
} from "react-icons/io5";
import apiClient from "../../services/apiClient";
import { API_ENDPOINTS } from "../../config/api";
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

const normalizePodcastJob = (payload) => {
  const source = payload && typeof payload === "object" ? payload : {};
  return {
    id: String(source.job_id || source.id || "").trim(),
    status: String(source.status || "").trim().toLowerCase(),
    message: String(source.message || "").trim(),
    result:
      source.result && typeof source.result === "object"
        ? source.result
        : source.result
          ? { value: source.result }
          : null,
    error: String(source.error || "").trim(),
  };
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

  const [podcastEpisodeName, setPodcastEpisodeName] = useState("");
  const [podcastEpisodeProfile, setPodcastEpisodeProfile] = useState("default");
  const [podcastSpeakerProfile, setPodcastSpeakerProfile] = useState("default");
  const [podcastBriefingSuffix, setPodcastBriefingSuffix] = useState("");
  const [podcastSubmitting, setPodcastSubmitting] = useState(false);
  const [podcastRefreshing, setPodcastRefreshing] = useState(false);
  const [podcastJob, setPodcastJob] = useState(null);

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

  const podcastJobId = useMemo(
    () => String(podcastJob?.id || "").trim(),
    [podcastJob?.id]
  );

  const isPodcastRunning = useMemo(() => {
    const status = String(podcastJob?.status || "").toLowerCase();
    return ["queued", "running", "submitted", "pending"].includes(status);
  }, [podcastJob?.status]);

  const loadProgress = async (targetStudentId, selectedResourceId) => {
    if (!targetStudentId || !pathwayId || !stageIndex) return;

    try {
      const response = await apiClient.get(API_ENDPOINTS.PATHWAY_STAGE_DETAILS(pathwayId, stageIndex));
      const tracker = response?.data?.tracker || {};
      const resources = Array.isArray(tracker.resources) ? tracker.resources : [];
      const found = resources.find((item) => item.resource_id === selectedResourceId) || null;
      if (found) {
         // Mock resourceProgress to match what InteractiveLessonViewer expects
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
  }, [pathwayId, stageIndex, resourceId]);

  useEffect(() => {
    setHasAutoOpenedAssessment(false);
  }, [pathwayId, stageIndex, resourceId]);

  useEffect(() => {
    if (!podcastJobId || !isPodcastRunning) {
      return undefined;
    }

    let isCancelled = false;
    const timer = setInterval(async () => {
      try {
        const statusResponse = await apiClient.get(
          `${API_ENDPOINTS.PORTABLE_RAG_PODCAST_JOB_PREFIX}${encodeURIComponent(
            podcastJobId
          )}`
        );

        if (!isCancelled) {
          setPodcastJob(normalizePodcastJob(statusResponse));
        }
      } catch {
        // Keep auto-polling silent. Manual refresh shows explicit failures.
      }
    }, 5000);

    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [podcastJobId, isPodcastRunning]);

  const buildPodcastContent = () => {
    const blocks = [];

    const summaryText = String(summary || "").trim();
    if (summaryText) {
      blocks.push(`Summary:\n${summaryText}`);
    }

    const descriptionText = String(resource?.description || resource?.content || "").trim();
    if (descriptionText) {
      blocks.push(`Lesson Details:\n${descriptionText}`);
    }

    if (videoUrl) {
      blocks.push(`Source URL:\n${videoUrl}`);
    }

    if (!blocks.length) {
      blocks.push(`Lesson title: ${resource?.title || "Untitled lesson"}`);
    }

    return blocks.join("\n\n");
  };

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
      const cacheMessage = response?.is_cached
        ? "Loaded cached summary."
        : "Generated new summary.";
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
    if (!shouldAutoOpenAssessment || hasAutoOpenedAssessment || loading) {
      return;
    }

    if (!videoUrl || !studentId) {
      return;
    }

    setHasAutoOpenedAssessment(true);
    handleStartQuiz();

    const updatedParams = new URLSearchParams(searchParams);
    updatedParams.delete("assessment");
    setSearchParams(updatedParams, { replace: true });
  }, [
    searchParams,
    hasAutoOpenedAssessment,
    loading,
    videoUrl,
    studentId,
    setSearchParams,
    stageQuizPrompt,
  ]);

  const handleGeneratePodcast = async () => {
    if (!resource || !videoUrl) return;

    setPodcastSubmitting(true);
    setInfoMessage("");

    try {
      const episodeName =
        String(podcastEpisodeName || "").trim() ||
        `${resource?.title || "Lesson"} Audio Overview`;

      const response = await apiClient.post(
        API_ENDPOINTS.PORTABLE_RAG_PODCAST_GENERATE,
        {
          episode_profile: String(podcastEpisodeProfile || "default").trim() || "default",
          speaker_profile: String(podcastSpeakerProfile || "default").trim() || "default",
          episode_name: episodeName,
          content: buildPodcastContent(),
          briefing_suffix: String(podcastBriefingSuffix || "").trim() || undefined,
        }
      );

      const normalizedJob = normalizePodcastJob(response);
      setPodcastJob(normalizedJob);
      setInfoMessage(
        normalizedJob.id
          ? `Podcast job submitted: ${normalizedJob.id}`
          : response?.message || "Podcast job submitted."
      );
    } catch (err) {
      setInfoMessage(err?.message || "Unable to generate podcast");
    } finally {
      setPodcastSubmitting(false);
    }
  };

  const handleRefreshPodcastStatus = async () => {
    if (!podcastJobId) {
      setInfoMessage("Generate a podcast first to check status.");
      return;
    }

    setPodcastRefreshing(true);
    setInfoMessage("");

    try {
      const response = await apiClient.get(
        `${API_ENDPOINTS.PORTABLE_RAG_PODCAST_JOB_PREFIX}${encodeURIComponent(
          podcastJobId
        )}`
      );
      const normalizedJob = normalizePodcastJob(response);
      setPodcastJob(normalizedJob);
      setInfoMessage(`Podcast job status: ${normalizedJob.status || "unknown"}.`);
    } catch (err) {
      setInfoMessage(err?.message || "Unable to fetch podcast status");
    } finally {
      setPodcastRefreshing(false);
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
          onClick={() => navigate(`/skill-pathway/${pathwayId}`)}
          className="mt-4 rounded-lg bg-gray-700 px-4 py-2 text-sm text-white hover:bg-gray-600"
        >
          Back to Pathway
        </button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <header className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
        <button
          type="button"
          onClick={() => navigate(`/skill-pathway/${pathwayId}`)}
          className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
        >
          <IoArrowBackOutline />
          Back to Pathway
        </button>
        <h1 className="mt-2 text-2xl font-semibold text-gray-100">{resource.title || "Resource"}</h1>
        <p className="mt-1 text-sm text-gray-400">{moduleData?.name || `Stage ${stageIndex}`}</p>
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

            <div className="mt-4 rounded-lg border border-violet-500/30 bg-violet-500/10 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-violet-100">
                  Podcast Generator (Portable RAG)
                </h3>
                {isPodcastRunning && (
                  <span className="text-xs text-violet-200">Auto-refreshing every 5s</span>
                )}
              </div>

              <p className="mt-1 text-xs text-violet-200/90">
                Creates a podcast-style audio overview job from this lesson.
              </p>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  value={podcastEpisodeName}
                  onChange={(event) => setPodcastEpisodeName(event.target.value)}
                  className="rounded-md border border-violet-400/30 bg-gray-950/70 px-3 py-2 text-sm text-gray-100 focus:border-violet-300 focus:outline-none"
                  placeholder="Episode name (optional)"
                />
                <input
                  value={podcastEpisodeProfile}
                  onChange={(event) => setPodcastEpisodeProfile(event.target.value)}
                  className="rounded-md border border-violet-400/30 bg-gray-950/70 px-3 py-2 text-sm text-gray-100 focus:border-violet-300 focus:outline-none"
                  placeholder="Episode profile (default)"
                />
                <input
                  value={podcastSpeakerProfile}
                  onChange={(event) => setPodcastSpeakerProfile(event.target.value)}
                  className="rounded-md border border-violet-400/30 bg-gray-950/70 px-3 py-2 text-sm text-gray-100 focus:border-violet-300 focus:outline-none"
                  placeholder="Speaker profile (default)"
                />
                <input
                  value={podcastBriefingSuffix}
                  onChange={(event) => setPodcastBriefingSuffix(event.target.value)}
                  className="rounded-md border border-violet-400/30 bg-gray-950/70 px-3 py-2 text-sm text-gray-100 focus:border-violet-300 focus:outline-none"
                  placeholder="Briefing suffix (optional)"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleGeneratePodcast}
                  disabled={podcastSubmitting || !videoUrl}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
                >
                  {podcastSubmitting ? <IoRefreshOutline className="animate-spin" /> : <IoSparklesOutline />}
                  {podcastSubmitting ? "Submitting Podcast Job..." : "Generate Podcast"}
                </button>

                <button
                  type="button"
                  onClick={handleRefreshPodcastStatus}
                  disabled={podcastRefreshing || !podcastJobId}
                  className="inline-flex items-center gap-2 rounded-lg bg-violet-900/60 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-800/70 disabled:opacity-60"
                >
                  {podcastRefreshing ? <IoRefreshOutline className="animate-spin" /> : <IoRefreshOutline />}
                  Refresh Job Status
                </button>
              </div>

              {podcastJob && (
                <div className="mt-3 rounded-lg border border-violet-400/25 bg-black/30 p-3 text-xs text-violet-100">
                  <p>
                    <span className="font-semibold text-violet-200">Job ID:</span>{" "}
                    {podcastJob.id || "Not provided"}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-violet-200">Status:</span>{" "}
                    {podcastJob.status || "unknown"}
                  </p>
                  {podcastJob.message && (
                    <p className="mt-1">
                      <span className="font-semibold text-violet-200">Message:</span>{" "}
                      {podcastJob.message}
                    </p>
                  )}
                  {podcastJob.error && (
                    <p className="mt-1 text-rose-200">
                      <span className="font-semibold text-rose-100">Error:</span> {podcastJob.error}
                    </p>
                  )}
                  {podcastJob.result && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-violet-400/20 bg-gray-950/70 p-2 text-[11px] text-violet-100">
                      {JSON.stringify(podcastJob.result, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
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

export default SkillPathwayResource;
