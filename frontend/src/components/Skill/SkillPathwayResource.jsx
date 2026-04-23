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
  IoBookOutline,
  IoOpenOutline,
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
  const [hasAutoOpenedAssessment, setHasAutoOpenedAssessment] = useState(false);

  const resourceUrl = useMemo(
    () => normalizeResourceUrl(resource?.url || resource?.youtube_url || ""),
    [resource]
  );
  const isVideo = resource?.type === 'video';
  const youtubeId = useMemo(() => isVideo ? extractYouTubeId(resourceUrl) : null, [isVideo, resourceUrl]);

  const progressStatus = resourceProgress?.status;
  const passedCount = Number(resourceProgress?.passed_tests_count || 0);
  const passTarget = 2;
  const passProgress = Math.min(passedCount / passTarget, 1);

  const progressLabel = useMemo(() => {
    if (passedCount >= 2) return "Completed";
    return "In Progress";
  }, [passedCount]);

  const statusConfig = useMemo(() => {
    if (passedCount >= 2)
      return { color: "text-emerald-300", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: <IoCheckmarkCircle className="text-emerald-400" /> };
    return { color: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", icon: <IoTimeOutline className="text-amber-400" /> };
  }, [passedCount]);

  const loadProgress = async (selectedResourceId) => {
    if (!pathwayId || !stageIndex) return;

    try {
      const response = await apiClient.get(API_ENDPOINTS.PATHWAY_STAGE_DETAILS(pathwayId, stageIndex));
      const tracker = response?.data?.tracker || {};
      const resources = Array.isArray(tracker.resources) ? tracker.resources : [];
      const found = resources.find((item) => item.resource_id === selectedResourceId) || null;
      if (found) {
        setResourceProgress(found);
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

        const tracker = stageResponse?.data?.tracker || null;
        if (!tracker) {
          throw new Error("Stage tracker not found");
        }

        setModuleData({ name: `Stage ${stageIndex}` });

        const moduleResources = Array.isArray(tracker.resources) ? tracker.resources : [];
        const selectedResource = moduleResources.find((item) => getResourceId(item) === String(resourceId));

        if (!selectedResource) {
          throw new Error("Resource not found in this stage");
        }

        setResource(selectedResource);
        setResourceProgress(selectedResource);

        if (resolvedStudentId) {
          try {
            const chatResponse = await apiClient.get(
              `/api/resource/chat-history/${resourceId}/${resolvedStudentId}`
            );
            if (isMounted) {
              setChatHistory(Array.isArray(chatResponse?.chat_history) ? chatResponse.chat_history : []);
            }
          } catch {
            if (isMounted) setChatHistory([]);
          }
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

  const handleSummary = async () => {
    if (!resourceId || !resourceUrl) return;

    setSummaryLoading(true);
    setInfoMessage("");

    try {
      const response = await apiClient.post(API_ENDPOINTS.STUDIO_GENERATE, {
        type: "summary",
        resource_id: resourceId,
        resource_url: resourceUrl,
        force_refresh: false,
      });

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
    if (!question.trim() || !studentId || !resourceUrl) return;

    setAskingQuestion(true);
    setInfoMessage("");

    try {
      const response = await apiClient.post(`/api/resource/qa/ask`, {
        resource_id: resourceId,
        resource_url: resourceUrl,
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
    setLoading(true);
    setInfoMessage("");

    try {
      const response = await apiClient.get(API_ENDPOINTS.PATHWAY_GENERATE_TESTS(pathwayId, stageIndex, resourceId));
      if (response.status === 'success') {
        const tests = response.tests;
        // Logic: if passedCount < 1, show test_1, else show test_2
        const testToTake = passedCount < 1 ? tests.test_1 : tests.test_2;
        
        const transformedQuestions = testToTake.questions.map((q, idx) => ({
          id: `q-${idx}`,
          question_text: q.q,
          options: q.options,
          correct_answer: q.answer,
          points: 20
        }));

        setQuizSession({
          quizAttemptId: `pathway-test-${passedCount + 1}`,
          questions: transformedQuestions,
          totalPoints: 100,
          rawTestData: testToTake
        });
        setInfoMessage(`Skill assessment ${passedCount + 1} generated.`);
      }
    } catch (err) {
      setInfoMessage(err?.message || "Unable to generate assessment");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const shouldAutoOpenAssessment = searchParams.get("assessment") === "1";
    if (!shouldAutoOpenAssessment || hasAutoOpenedAssessment || loading) return;
    if (!resourceUrl || !studentId) return;

    setHasAutoOpenedAssessment(true);
    handleStartQuiz();

    const updatedParams = new URLSearchParams(searchParams);
    updatedParams.delete("assessment");
    setSearchParams(updatedParams, { replace: true });
  }, [searchParams, hasAutoOpenedAssessment, loading, resourceUrl, studentId, setSearchParams]);

  const handleSubmitQuiz = async (quizAttemptId, answers) => {
    setSubmittingQuiz(true);
    setInfoMessage("");

    try {
      // Grade locally
      let score = 0;
      const feedbackQuestions = quizSession.questions.map(q => {
        const studentAns = answers.find(a => a.question_id === q.id)?.answer;
        const isCorrect = String(studentAns).trim().toLowerCase() === String(q.correct_answer).trim().toLowerCase();
        if (isCorrect) score += q.points;
        return {
          question_text: q.question_text,
          your_answer: studentAns,
          correct_answer: q.correct_answer,
          is_correct: isCorrect,
          points: isCorrect ? q.points : 0
        };
      });

      const passed = score >= 80;
      
      // Submit to backend
      const response = await apiClient.post(API_ENDPOINTS.PATHWAY_SUBMIT_TEST(pathwayId, stageIndex), {
        resource_id: resourceId,
        score_percent: score
      });

      setQuizSession(null);
      setQuizFeedback({
        score_obtained: score,
        total_points: 100,
        score_percentage: score / 100,
        passed,
        ai_feedback: passed ? "Great job! You mastered this assessment." : "Keep studying and try again to reach 80%.",
        correct_answers: feedbackQuestions
      });
      
      await loadProgress(resourceId);
    } catch (err) {
      setInfoMessage(err?.message || "Unable to submit assessment");
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
          <p className="text-lg font-medium">Loading skill resource...</p>
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
        <p className="mt-1.5 text-base font-medium text-indigo-400">{moduleData?.name || `Stage ${stageIndex}`}</p>
      </header>

      {infoMessage && (
        <p className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-5 py-4 text-sm text-indigo-200 mb-2">
          {infoMessage}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 space-y-5">
          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/60 backdrop-blur-md p-5">
            {isVideo ? (
              youtubeId ? (
                <div className="aspect-video overflow-hidden rounded-lg border border-gray-700 bg-black">
                  <iframe
                    title={resource.title || "Lesson video"}
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-700 p-6 text-center">
                   <p className="text-gray-400 mb-4 text-sm">This video lecture could not be embedded directly.</p>
                   <a href={resourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg font-bold transition-all">
                     <IoOpenOutline /> View on YouTube
                   </a>
                </div>
              )
            ) : (
              <div className="bg-gray-900/40 rounded-xl p-8 border border-gray-700 text-center">
                 <IoBookOutline className="text-cyan-400 text-5xl mx-auto mb-4" />
                 <h2 className="text-xl font-bold text-white mb-2">Article Workspace</h2>
                 <p className="text-gray-400 mb-6 max-w-md mx-auto">DeepSearch has curated this comprehensive article to cover the stage subtopics. Open it in a new tab to study.</p>
                 <a href={resourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-cyan-600/20 transition-all hover:scale-105">
                   <IoOpenOutline /> Read Full Article
                 </a>
              </div>
            )}

            {/* Progress Card */}
            <div className={`mt-6 rounded-xl border ${statusConfig.border} ${statusConfig.bg} p-4`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {statusConfig.icon}
                  <span className={`text-sm font-semibold ${statusConfig.color}`}>{progressLabel}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <IoTrophyOutline className="text-emerald-400" />
                  <span>{passedCount} / {passTarget} assessments passed</span>
                </div>
              </div>

              <div className="mt-3">
                <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{ width: `${passProgress * 100}%` }}
                  />
                </div>
                {passedCount >= passTarget && (
                  <p className="mt-1.5 text-xs text-emerald-400 font-medium">
                    ✓ Requirement met — this resource is mastered.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSummary}
                disabled={summaryLoading || !resourceUrl}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-60 transition-all shadow-lg shadow-blue-600/20"
              >
                {summaryLoading ? <IoRefreshOutline className="animate-spin" /> : <IoSparklesOutline />}
                {summaryLoading ? "Generating..." : "AI Summary"}
              </button>

              <button
                type="button"
                onClick={handleStartQuiz}
                disabled={!resourceUrl || passedCount >= 2}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-60 transition-all shadow-lg shadow-indigo-600/20"
              >
                <IoHelpCircleOutline />
                {passedCount >= 2 ? "Mastered" : `Take Assessment ${passedCount + 1}`}
              </button>
            </div>

            {summary && (
              <div className="mt-6 rounded-xl border border-blue-500/30 bg-blue-900/20 p-5 shadow-inner">
                <h3 className="text-blue-300 font-bold mb-2 flex items-center gap-2 text-sm"><IoSparklesOutline /> AI Key Takeaways</h3>
                <p className="text-sm text-blue-100 leading-relaxed">{summary}</p>
              </div>
            )}
          </div>
        </div>

        <aside className="xl:col-span-4 rounded-2xl border border-gray-700/50 bg-gray-800/60 backdrop-blur-md p-5 flex flex-col h-full">
          <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-gray-100 mb-4">
            <IoChatbubbleEllipsesOutline className="text-cyan-300" />
            AI Study Assistant
          </h2>

          <div className="flex-1 max-h-[500px] space-y-3 overflow-y-auto pr-1 mb-4 scrollbar-thin scrollbar-thumb-gray-700">
            {chatHistory.length > 0 ? (
              chatHistory.map((item, index) => (
                <article
                  key={`${item.asked_at || index}-${index}`}
                  className="rounded-lg border border-gray-700 bg-gray-900/80 p-3 shadow-sm"
                >
                  <p className="text-xs font-bold text-cyan-400 mb-1">Question</p>
                  <p className="text-sm text-gray-200 mb-3">{item.question}</p>
                  <div className="h-px bg-gray-700/50 mb-2"></div>
                  <p className="text-xs font-bold text-emerald-400 mb-1">Answer</p>
                  <p className="text-sm text-gray-300 italic">{item.answer}</p>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center bg-gray-900/30">
                 <IoChatbubbleEllipsesOutline className="text-gray-600 text-3xl mx-auto mb-3" />
                 <p className="text-sm text-gray-400">Ask focused questions about this lesson to deepen your understanding.</p>
              </div>
            )}
          </div>

          <form onSubmit={handleAskQuestion} className="space-y-3 mt-auto">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={3}
              placeholder="How does X relate to Y? Explain in detail..."
              className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm text-gray-100 focus:border-cyan-500 focus:outline-none transition-all"
            />
            <button
              type="submit"
              disabled={askingQuestion || !question.trim() || !resourceUrl}
              className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 py-3 text-sm font-bold text-white transition-all shadow-lg shadow-cyan-600/20"
            >
              {askingQuestion ? "Analyzing..." : "Ask Question"}
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