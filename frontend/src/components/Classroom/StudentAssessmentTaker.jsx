import React, { useEffect, useMemo, useState } from "react";
import {
  IoCloseOutline,
  IoSendOutline,
  IoTimeOutline,
  IoLinkOutline,
  IoCloudUploadOutline,
  IoDocumentTextOutline,
  IoCheckmarkCircleOutline,
  IoDownloadOutline,
} from "react-icons/io5";
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
  const [assessmentPayload, setAssessmentPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState(null);

  // For Article/Blog
  const [articleUrl, setArticleUrl] = useState("");

  // For PPT/Research
  const [file, setFile] = useState(null);
  const [summaryText, setSummaryText] = useState("");

  useEffect(() => {
    let isMounted = true;

    const startAssessment = async () => {
      if (!assessmentId || !studentId) return;

      setLoading(true);
      setError("");

      try {
        // We try the workflow endpoint first as per new requirements
        const response = await apiClient.post(`/api/module-assessment/workflow/submission/start`, {
          workflow_id: assessmentId,
          student_id: studentId,
        });

        if (!isMounted) return;

        setSubmission(response);
        setAssessmentPayload(response.assessment_payload);

        // Workflow submission timer
        const expiresAt = response?.expires_at 
          ? new Date(response.expires_at) 
          : new Date(Date.now() + 60 * 60 * 1000);
          
        const now = new Date();
        const initialSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
        setSecondsLeft(initialSeconds);
      } catch (err) {
        // Fallback to legacy assessment if workflow fails
        try {
          const legacyResponse = await apiClient.post(`/api/module-assessment/submission/start`, {
            assessment_id: assessmentId,
            student_id: studentId,
          });
          if (!isMounted) return;
          setSubmission(legacyResponse);
          const expiresAt = new Date(legacyResponse?.expires_at || Date.now());
          const now = new Date();
          const initialSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
          setSecondsLeft(initialSeconds);
        } catch (legacyErr) {
          if (!isMounted) return;
          setError(err?.message || "Unable to start assessment");
        }
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
    if (!submission?.submission_id) return undefined;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [submission]);

  const category = assessmentPayload?.category || "standard";

  const unansweredCount = useMemo(() => {
    if (category === "scenario") {
      const questions = assessmentPayload?.selected_scenario_set?.questions || [];
      return questions.filter((q) => !String(answers[q.id] || "").trim()).length;
    }
    if (category === "article") return articleUrl.trim() ? 0 : 1;
    if (category === "ppt") return (file && summaryText.trim()) ? 0 : 1;
    if (category === "research") return file ? 0 : 1;
    
    // Legacy
    const questions = Array.isArray(submission?.questions) ? submission.questions : [];
    return questions.filter((question) => !String(answers[question.id] || "").trim()).length;
  }, [submission, assessmentPayload, answers, articleUrl, file, summaryText, category]);

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
      let response;
      if (category === "scenario") {
        const questions = assessmentPayload?.selected_scenario_set?.questions || [];
        const payloadAnswers = questions.map((q) => ({
          question_id: q.id,
          answer: String(answers[q.id] || "").trim(),
        }));
        response = await apiClient.post(
          `/api/module-assessment/workflow/submission/${submission.submission_id}/submit-scenario`,
          { answers: payloadAnswers }
        );
      } else if (category === "article") {
        response = await apiClient.post(
          `/api/module-assessment/workflow/submission/${submission.submission_id}/submit-article-link`,
          { url: articleUrl, topic_title: assessmentPayload?.selected_topic?.title }
        );
      } else if (category === "ppt" || category === "research") {
        const formData = new FormData();
        formData.append("file", file);
        if (category === "ppt") {
          formData.append("summary_text", summaryText);
        }
        formData.append("topic_title", assessmentPayload?.selected_topic?.title);
        
        response = await apiClient.post(
          `/api/module-assessment/workflow/submission/${submission.submission_id}/submit-artifact`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
      } else {
        // Legacy
        const questionList = Array.isArray(submission?.questions) ? submission.questions : [];
        const payloadAnswers = questionList.map((question) => ({
          question_id: question.id,
          answer: String(answers[question.id] || "").trim(),
        }));

        response = await apiClient.post(
          `/api/module-assessment/submission/${submission.submission_id}/submit`,
          {
            submission_id: submission.submission_id,
            answers: payloadAnswers,
          }
        );
      }

      setResult(response);
      onSubmitted?.(response);
    } catch (err) {
      setError(err?.message || "Failed to submit assessment");
    } finally {
      setLoading(false);
    }
  };

  const renderScenario = () => {
    const questions = assessmentPayload?.selected_scenario_set?.questions || [];
    return (
      <div className="space-y-6">
        {questions.map((question, index) => (
          <article key={question.id} className="rounded-xl border border-gray-700 bg-gray-950/60 p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-xs font-bold text-cyan-400">
                {index + 1}
              </span>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-100">{question.prompt}</p>
                <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <span>Marks: {question.marks}</span>
                  <span>Expected: {question.expected_length}</span>
                </div>
              </div>
            </div>
            <textarea
              value={answers[question.id] || ""}
              onChange={(e) => handleAnswer(question.id, e.target.value)}
              rows={6}
              className="mt-4 w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/20"
              placeholder="Write your detailed response here..."
            />
          </article>
        ))}
      </div>
    );
  };

  const renderArticle = () => (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
        <h4 className="text-sm font-bold text-blue-300 uppercase tracking-wide">Selected Topic</h4>
        <p className="mt-1 text-lg font-semibold text-white">{assessmentPayload?.selected_topic?.title}</p>
        <p className="mt-2 text-xs text-blue-200/60 leading-relaxed">{assessmentPayload?.selected_topic?.scope}</p>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-950/40 p-5">
        <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
          <IoDocumentTextOutline /> Format Guide
        </h4>
        <p className="mt-2 text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">
          {assessmentPayload?.format_guide || "Submit a public URL to your article or blog post."}
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">Article / Blog URL</label>
        <div className="relative">
          <IoLinkOutline className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg" />
          <input
            type="url"
            value={articleUrl}
            onChange={(e) => setArticleUrl(e.target.value)}
            className="w-full rounded-xl border border-gray-700 bg-gray-900 py-3.5 pl-11 pr-4 text-sm text-gray-100 focus:border-blue-500 focus:outline-none"
            placeholder="https://medium.com/@username/your-post-title"
          />
        </div>
        <p className="text-[11px] text-gray-500">Ensure the link is public and accessible for AI evaluation.</p>
      </div>
    </div>
  );

  const renderArtifact = () => {
    const isResearch = category === "research";
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <h4 className="text-sm font-bold text-indigo-300 uppercase tracking-wide">Submission Topic</h4>
          <p className="mt-1 text-lg font-semibold text-white">{assessmentPayload?.selected_topic?.title}</p>
          <p className="mt-2 text-xs text-indigo-200/60 leading-relaxed">{assessmentPayload?.selected_topic?.scope}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="rounded-xl border border-gray-700 bg-gray-950/40 p-5">
            <h4 className="text-sm font-bold text-gray-300 flex items-center gap-2">
              <IoDocumentTextOutline /> Format Guide
            </h4>
            <p className="mt-2 text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">
              {assessmentPayload?.format_guide}
            </p>
            {isResearch && (
              <button
                type="button"
                onClick={async () => {
                   try {
                     const response = await apiClient.get(`/api/module-assessment/workflow/${submission.workflow_id}/latex-template/download`, { responseType: 'blob' });
                     const url = window.URL.createObjectURL(new Blob([response]));
                     const link = document.createElement('a');
                     link.href = url;
                     link.setAttribute('download', 'template.tex');
                     document.body.appendChild(link);
                     link.click();
                     link.remove();
                   } catch (err) {
                     setError("Failed to download template");
                   }
                }}
                className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                <IoDownloadOutline /> DOWNLOAD LATEX TEMPLATE
              </button>
            )}
          </div>

          <div className="space-y-5">
            {!isResearch && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Executive Summary</label>
                <textarea
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
                  placeholder="Provide a brief summary of your presentation..."
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {isResearch ? "LaTeX File (.tex)" : "Presentation Deck (PDF)" }
              </label>
              <div className="relative h-32 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-700 bg-gray-900/40 hover:bg-gray-900/60 transition-all">
                <input
                  type="file"
                  accept={isResearch ? ".tex" : ".pdf"}
                  onChange={(e) => setFile(e.target.files[0])}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <IoCloudUploadOutline className="text-3xl text-gray-500 mb-2" />
                <p className="text-xs text-gray-400 font-medium px-4 text-center truncate w-full">
                  {file ? file.name : `Click or drag ${isResearch ? ".tex" : ".pdf"} file`}
                </p>
                {file && <p className="mt-1 text-[10px] text-emerald-400 font-bold">READY TO UPLOAD</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStandard = () => (
    <div className="space-y-4">
      {(submission.questions || []).map((question, index) => {
        const value = answers[question.id] || "";
        const isMCQ = Array.isArray(question.options) && question.options.length > 0;

        return (
          <article key={question.id} className="rounded-lg border border-gray-700 bg-gray-950/60 px-4 py-3">
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
    </div>
  );

  const getTitle = () => {
    if (category === "scenario") return "Scenario Based Assessment";
    if (category === "article") return "Article / Blog Assessment";
    if (category === "ppt") return "Presentation Assessment";
    if (category === "research") return "Research Paper Assessment";
    return "Final Module Assessment";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 overflow-y-auto">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />

      <div className="relative z-10 w-full max-w-5xl rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl flex flex-col my-auto max-h-[90vh]">
        <header className="flex items-center justify-between border-b border-gray-800 px-6 py-5">
          <div>
            <h3 className="text-xl font-bold text-gray-100">{getTitle()}</h3>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Complete all requirements before final submission.</p>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold border ${
              secondsLeft <= 300
                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
            }`}>
              <IoTimeOutline className="text-lg" />
              {formatRemaining(secondsLeft)}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-gray-500 hover:bg-gray-800 hover:text-white transition-all"
            >
              <IoCloseOutline className="text-2xl" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent">
          {loading && !submission ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-cyan-500"></div>
              <p className="text-sm font-medium text-gray-400">Syncing with assessment engine...</p>
            </div>
          ) : null}

          {error ? (
            <div className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              <p className="font-bold mb-1">Error encountered</p>
              <p>{error}</p>
            </div>
          ) : null}

          {result ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-20 w-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                <IoCheckmarkCircleOutline className="text-5xl text-emerald-400" />
              </div>
              <h4 className="text-2xl font-bold text-white mb-2">{result.message || "Submission Successful"}</h4>
              <p className="text-gray-400 max-w-md mx-auto">
                Your assessment has been recorded. 
                {category === "article" || category === "research" 
                  ? " AI is currently evaluating your content against module topics and sources." 
                  : " It is now pending teacher review."}
              </p>
              
              <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-sm">
                 <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">AI Score</p>
                    <p className="text-xl font-bold text-cyan-400">{result.ai_score || 0}%</p>
                 </div>
                 <div className="rounded-xl border border-gray-800 bg-gray-950/40 p-4">
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Status</p>
                    <p className="text-xl font-bold text-white">{result.grading_status === 'fully_graded' ? 'GRADED' : 'PENDING'}</p>
                 </div>
              </div>

              <button
                onClick={onClose}
                className="mt-10 rounded-xl bg-gray-800 px-8 py-3 text-sm font-bold text-white hover:bg-gray-700 transition-all"
              >
                BACK TO CLASSROOM
              </button>
            </div>
          ) : null}

          {!result && submission ? (
            <form onSubmit={handleSubmit} className="space-y-8 pb-10">
              {category === "scenario" && renderScenario()}
              {category === "article" && renderArticle()}
              {(category === "ppt" || category === "research") && renderArtifact()}
              {category === "standard" && renderStandard()}

              <footer className="sticky bottom-0 mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-800 bg-gray-900 pt-6">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${unansweredCount > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500"}`} />
                  <p className="text-sm font-medium text-gray-400">
                    {unansweredCount > 0
                      ? `${unansweredCount} requirement(s) missing`
                      : "Ready for final submission"}
                  </p>
                </div>
                
                <button
                  type="submit"
                  disabled={loading || secondsLeft === 0 || unansweredCount > 0}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-10 py-4 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                     <>
                       <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                       SUBMITTING...
                     </>
                  ) : (
                    <>
                      <IoSendOutline className="text-lg" />
                      SUBMIT ASSESSMENT
                    </>
                  )}
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
