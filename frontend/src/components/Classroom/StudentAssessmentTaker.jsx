import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  IoCloseOutline,
  IoSendOutline,
  IoTimeOutline,
  IoLinkOutline,
  IoCloudUploadOutline,
  IoDocumentTextOutline,
  IoCheckmarkCircleOutline,
  IoSparklesOutline,
  IoAlertCircleOutline,
  IoSaveOutline,
  IoCheckmarkDoneOutline,
} from "react-icons/io5";
import apiClient from "../../services/apiClient";

const StudentAssessmentTaker = ({ assessmentId, studentId, onClose, onSubmitted }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submission, setSubmission] = useState(null);
  const [assessmentPayload, setAssessmentPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [articleUrl, setArticleUrl] = useState("");
  const [file, setFile] = useState(null);
  const [summaryText, setSummaryText] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(3600);
  const [result, setResult] = useState(null);

  // Autosave states
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const startAssessment = async () => {
      try {
        setLoading(true);
        // Try workflow first
        const response = await apiClient.post(`/api/module-assessment/workflow/submission/start`, {
          workflow_id: assessmentId,
          student_id: studentId,
        });

        if (!isMounted) return;

        setSubmission(response);
        setAssessmentPayload(response.assessment_payload);
        
        // Load draft answers if any
        if (response.draft_answers) {
          setAnswers(response.draft_answers);
        }

        const expiresAt = response?.expires_at 
          ? new Date(response.expires_at) 
          : new Date(Date.now() + 60 * 60 * 1000);
          
        const now = new Date();
        const initialSeconds = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
        setSecondsLeft(initialSeconds);
      } catch (err) {
        try {
          const legacyResponse = await apiClient.post(`/api/module-assessment/submission/start`, {
            assessment_id: assessmentId,
            student_id: studentId,
          });
          if (!isMounted) return;
          setSubmission(legacyResponse);
          
          // Load draft answers if any
          if (legacyResponse.draft_answers) {
            setAnswers(legacyResponse.draft_answers);
          }

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

  // Auto-save logic
  const handleSaveDraft = useCallback(async (isAuto = false) => {
    if (!submission?.submission_id || result || loading) return;
    
    // Only scenario and standard assessments currently support text-based draft saving
    if (category !== "scenario" && category !== "standard") return;

    // Check if there is anything to save
    if (Object.keys(answers).length === 0) return;

    setIsSaving(true);
    try {
      const payloadAnswers = Object.entries(answers).map(([qid, val]) => ({
        question_id: qid,
        answer: String(val || "").trim(),
      }));

      const endpoint = category === "scenario"
        ? `/api/module-assessment/workflow/submission/${submission.submission_id}/save-draft`
        : `/api/module-assessment/submission/${submission.submission_id}/save-draft`;

      await apiClient.post(endpoint, { 
        submission_id: submission.submission_id,
        answers: payloadAnswers 
      });
      
      setLastSaved(new Date());
    } catch (err) {
      console.error("Draft save failed:", err);
      if (!isAuto) setError("Failed to save draft. Check your connection.");
    } finally {
      setIsSaving(false);
    }
  }, [submission, answers, category, result, loading]);

  // Autosave interval: 30 seconds
  useEffect(() => {
    if (!submission?.submission_id || result) return undefined;
    
    const interval = setInterval(() => {
      handleSaveDraft(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [submission, answers, handleSaveDraft, result]);

  const unansweredCount = useMemo(() => {
    if (category === "scenario") {
      const questions = assessmentPayload?.selected_scenario_set?.questions || [];
      return questions.filter((q) => !String(answers[q.id] || "").trim()).length;
    }
    if (category === "article") return articleUrl.trim() ? 0 : 1;
    if (category === "ppt") return (file && summaryText.trim()) ? 0 : 1;
    if (category === "research") return file ? 0 : 1;
    
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
    if (event) event.preventDefault();
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
      <div className="space-y-8">
        <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-6 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-2">
            <IoSparklesOutline className="text-indigo-400 text-xl" />
            <h4 className="text-lg font-bold text-white">Scenario Prompt</h4>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed italic">
            {assessmentPayload?.selected_scenario_set?.review_note || "Analyze the following complex scenario and provide detailed evidence-backed responses."}
          </p>
        </div>

        {questions.map((q, idx) => (
          <div key={q.id} className="relative group animate-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${idx * 150}ms` }}>
            <div className="flex items-start gap-4 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 font-black text-indigo-400 text-lg">
                {idx + 1}
              </div>
              <div className="flex-grow pt-1">
                 <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2 py-0.5 bg-gray-800 text-[10px] font-bold text-gray-400 rounded uppercase tracking-widest border border-gray-700">
                      Bloom Level {q.bloom_level}
                    </span>
                    <span className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-widest">
                       • {q.marks} Points
                    </span>
                 </div>
                 <h5 className="text-gray-100 font-semibold text-lg leading-snug">{q.prompt}</h5>
              </div>
            </div>
            
            <textarea
              value={answers[q.id] || ""}
              onChange={(e) => handleAnswer(q.id, e.target.value)}
              placeholder="Type your response here... (Minimum 200 words recommended)"
              rows={6}
              className="w-full rounded-2xl border border-gray-800 bg-gray-950/40 p-5 text-gray-200 placeholder:text-gray-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 focus:outline-none transition-all resize-none shadow-inner"
            />
            
            {q.rubric_hint && (
              <div className="mt-2 flex items-start gap-2 px-1 text-[11px] text-gray-500">
                <IoAlertCircleOutline className="mt-0.5" />
                <p>Focus on: {q.rubric_hint}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderArticle = () => (
    <div className="space-y-8 py-4">
      <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6">
        <h4 className="text-xl font-bold text-white mb-2">Publishing Assessment</h4>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          {assessmentPayload?.format_guide || "Create a comprehensive article or blog post based on your assigned topic."}
        </p>
        <div className="flex flex-col gap-4">
           <div className="bg-gray-900/80 rounded-xl p-4 border border-gray-800">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Assigned Topic</p>
              <p className="text-lg font-bold text-indigo-400">{assessmentPayload?.selected_topic?.title}</p>
              <p className="text-xs text-gray-400 mt-2">{assessmentPayload?.selected_topic?.scope}</p>
           </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="block">
          <span className="text-sm font-bold text-gray-300 uppercase tracking-widest ml-1">Article Public URL</span>
          <div className="mt-3 relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-indigo-400 transition-colors">
              <IoLinkOutline size={20} />
            </div>
            <input
              type="url"
              value={articleUrl}
              onChange={(e) => setArticleUrl(e.target.value)}
              placeholder="https://medium.com/@username/your-article-slug"
              className="w-full rounded-2xl border border-gray-800 bg-gray-950/40 py-4 pl-12 pr-6 text-gray-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 focus:outline-none transition-all shadow-inner"
            />
          </div>
        </label>
        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-xl flex gap-3">
          <IoAlertCircleOutline className="text-amber-500 mt-0.5" size={18} />
          <p className="text-xs text-amber-200/60 leading-relaxed">
            Ensure the article is set to <strong>Public</strong> or has <strong>Shareable Link</strong> access enabled so our AI evaluation engine can scan the content.
          </p>
        </div>
      </div>
    </div>
  );

  const renderArtifact = () => (
    <div className="space-y-8 py-4">
       <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-6">
        <h4 className="text-xl font-bold text-white mb-2">Technical Artifact Submission</h4>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
          {assessmentPayload?.format_guide || "Upload your completed presentation or research document for evaluation."}
        </p>
        <div className="flex flex-col gap-4">
           <div className="bg-gray-900/80 rounded-xl p-4 border border-gray-800">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Assigned Topic</p>
              <p className="text-lg font-bold text-indigo-400">{assessmentPayload?.selected_topic?.title}</p>
              <p className="text-xs text-gray-400 mt-2">{assessmentPayload?.selected_topic?.scope}</p>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <span className="text-sm font-bold text-gray-300 uppercase tracking-widest ml-1">Upload File</span>
          <div 
            className={`mt-2 relative h-48 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all ${file ? "border-emerald-500/30 bg-emerald-500/5" : "border-gray-800 bg-gray-950/20 hover:border-indigo-500/30 hover:bg-gray-950/40"}`}
          >
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {file ? (
              <>
                <IoCheckmarkCircleOutline className="text-4xl text-emerald-400 mb-3" />
                <p className="text-sm font-bold text-emerald-400 truncate max-w-[80%]">{file.name}</p>
                <p className="text-[10px] text-gray-500 mt-1 uppercase font-black">Ready for upload</p>
              </>
            ) : (
              <>
                <IoCloudUploadOutline className="text-4xl text-gray-700 mb-3" />
                <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Click or Drag to Upload</p>
                <p className="text-[10px] text-gray-600 mt-2">PDF, PPTX, or TEX (Max 8MB)</p>
              </>
            )}
          </div>
        </div>

        {category === "ppt" && (
          <div className="space-y-4">
            <span className="text-sm font-bold text-gray-300 uppercase tracking-widest ml-1">Concept Summary</span>
            <textarea
              value={summaryText}
              onChange={(e) => setSummaryText(e.target.value)}
              placeholder="Provide a 200-300 word executive summary of your presentation key points..."
              rows={6}
              className="mt-2 w-full h-48 rounded-3xl border border-gray-800 bg-gray-950/40 p-5 text-gray-200 placeholder:text-gray-600 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 focus:outline-none transition-all resize-none shadow-inner"
            />
          </div>
        )}
      </div>
    </div>
  );

  const renderStandard = () => {
    const questions = Array.isArray(submission?.questions) ? submission.questions : [];
    return (
      <div className="space-y-12">
        {questions.map((q, idx) => (
          <div key={q.id} className="animate-in fade-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
            <div className="flex items-start gap-4 mb-4">
               <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center font-bold text-gray-500 border border-gray-700">
                  {idx + 1}
               </span>
               <h5 className="text-lg font-bold text-gray-100">{q.question_text}</h5>
            </div>

            <div className="ml-12 space-y-4">
              {q.type === "mcq" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(q.options || []).map((option, oIdx) => (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => handleAnswer(q.id, option)}
                      className={`flex items-center gap-4 px-6 py-4 rounded-2xl border text-left transition-all ${answers[q.id] === option ? "border-indigo-500 bg-indigo-500/10 text-white shadow-[0_0_20px_rgba(79,70,229,0.15)]" : "border-gray-800 bg-gray-950/40 text-gray-400 hover:border-gray-700 hover:bg-gray-900/60"}`}
                    >
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${answers[q.id] === option ? "border-indigo-500 bg-indigo-500" : "border-gray-700"}`}>
                        {answers[q.id] === option && <div className="h-2 w-2 rounded-full bg-white" />}
                      </div>
                      <span className="font-semibold text-sm">{option}</span>
                    </button>
                  ))}
                </div>
              )}

              {q.type === "short_answer" && (
                <textarea
                  value={answers[q.id] || ""}
                  onChange={(e) => handleAnswer(q.id, e.target.value)}
                  placeholder="Enter your response..."
                  className="w-full rounded-2xl border border-gray-800 bg-gray-950/40 p-5 text-gray-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 focus:outline-none transition-all resize-none"
                  rows={4}
                />
              )}

              {q.type === "fill_blank" && (
                <input
                  type="text"
                  value={answers[q.id] || ""}
                  onChange={(e) => handleAnswer(q.id, e.target.value)}
                  placeholder="Type the answer here..."
                  className="w-full sm:w-1/2 rounded-xl border border-gray-800 bg-gray-950/40 px-6 py-4 text-gray-200 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 focus:outline-none transition-all"
                />
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Immersive Background */}
      <div className="absolute inset-0 z-0 opacity-40">
        <div className="absolute top-0 -left-1/4 w-[80%] h-full bg-indigo-900/20 blur-[150px] rounded-full" />
        <div className="absolute bottom-0 -right-1/4 w-[80%] h-full bg-purple-900/20 blur-[150px] rounded-full" />
      </div>

      {/* Modern High-Contrast Navbar */}
      <nav className="relative z-50 flex-shrink-0 flex items-center justify-between px-8 py-6 border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <button
            onClick={onClose}
            className="group flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 hover:bg-rose-500/10 border border-gray-800 hover:border-rose-500/50 transition-all text-gray-500 hover:text-rose-400"
          >
            <IoCloseOutline size={24} className="group-hover:rotate-90 transition-transform duration-300" />
          </button>
          <div>
            <h3 className="text-xl font-black tracking-tight text-white uppercase italic">
              {category === "standard" ? "Final Assessment" : "Certification Workflow"}
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{submission?.submission_id?.slice(-8) || "..."}</span>
              <span className="h-1 w-1 rounded-full bg-gray-800" />
              <div className="flex items-center gap-1.5 text-indigo-400">
                <IoSparklesOutline size={12} className="animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest">Encrypted Session</span>
              </div>
              {lastSaved && (
                <>
                  <span className="h-1 w-1 rounded-full bg-gray-800" />
                  <div className="flex items-center gap-1.5 text-emerald-400 animate-in fade-in duration-500">
                    <IoCheckmarkDoneOutline size={12} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Draft Saved</span>
                  </div>
                </>
              )}
              {isSaving && (
                 <>
                  <span className="h-1 w-1 rounded-full bg-gray-800" />
                  <div className="flex items-center gap-1.5 text-amber-400">
                    <div className="h-2 w-2 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Saving...</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-4 px-6 py-2.5 rounded-2xl border transition-all duration-500 ${secondsLeft < 300 ? "border-rose-500/50 bg-rose-500/10 text-rose-400 animate-pulse" : "border-gray-800 bg-gray-900/50 text-indigo-400"}`}>
            <IoTimeOutline size={20} className={secondsLeft < 300 ? "animate-bounce" : ""} />
            <span className="text-2xl font-black tabular-nums tracking-tight">
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="relative z-10 flex-grow overflow-y-auto custom-scrollbar">
        <div className="container mx-auto px-6 py-12">
          {loading ? (
            <div className="flex h-96 flex-col items-center justify-center space-y-6">
              <div className="relative">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-indigo-500/20 border-t-indigo-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                   <div className="h-8 w-8 animate-ping rounded-full bg-indigo-500/20" />
                </div>
              </div>
              <div className="text-center">
                 <h4 className="font-bold text-gray-300 uppercase tracking-widest">Initializing Environment</h4>
                 <p className="text-sm text-gray-500">Syncing with our AI evaluation engine...</p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mb-8 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3 text-rose-400 mb-2">
                 <IoAlertCircleOutline className="text-2xl" />
                 <h4 className="font-bold uppercase tracking-widest text-xs">Access Denied / System Error</h4>
              </div>
              <p className="text-sm text-rose-200/80 ml-9">{error}</p>
            </div>
          ) : null}

          {result ? (
            <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in-95 duration-700">
              <div className="relative mb-10">
                <div className="h-24 w-24 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                  <IoCheckmarkCircleOutline className="text-6xl text-emerald-400" />
                </div>
                <div className="absolute -top-2 -right-2 h-10 w-10 rounded-full bg-indigo-500/20 backdrop-blur-md flex items-center justify-center border border-indigo-500/30 animate-bounce">
                   <IoSparklesOutline className="text-indigo-400" />
                </div>
              </div>
              
              <h4 className="text-4xl font-black text-white mb-4 tracking-tight">{result.message || "Assessment Secured"}</h4>
              <p className="text-gray-400 max-w-lg mx-auto text-base leading-relaxed">
                Excellent work. Your submission has been captured. 
                {category === "article" || category === "research" 
                  ? " Our AI analysis is now scanning your work for conceptual depth and accuracy." 
                  : " Your responses are queued for manual expert review."}
              </p>
              
              <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-lg">
                 <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-6 backdrop-blur-sm group hover:border-indigo-500/30 transition-all">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Preliminary AI Score</p>
                    <p className="text-4xl font-black text-indigo-400 tabular-nums">{result.ai_score || 0}<span className="text-lg font-bold text-gray-600">%</span></p>
                 </div>
                 <div className="rounded-2xl border border-gray-800 bg-gray-950/60 p-6 backdrop-blur-sm group hover:border-indigo-500/30 transition-all">
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-2">Grading Status</p>
                    <p className={`text-xl font-black uppercase tracking-tight mt-2 ${result.grading_status === 'fully_graded' ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {result.grading_status === 'fully_graded' ? 'CERTIFIED' : 'PENDING REVIEW'}
                    </p>
                 </div>
              </div>

              <button
                onClick={onClose}
                className="mt-16 group relative inline-flex items-center justify-center gap-3 rounded-2xl bg-white px-12 py-5 text-sm font-black text-gray-950 transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
              >
                RETURN TO CLASSROOM
                <div className="absolute inset-0 rounded-2xl border-2 border-white/0 group-hover:border-white/20 transition-all" />
              </button>
            </div>
          ) : null}

          {!result && submission ? (
            <form onSubmit={handleSubmit} className="space-y-12 pb-20 max-w-5xl mx-auto">
              {category === "scenario" && renderScenario()}
              {category === "article" && renderArticle()}
              {(category === "ppt" || category === "research") && renderArtifact()}
              {category === "standard" && renderStandard()}
            </form>
          ) : null}
        </div>

        {/* Dynamic Sticky Footer */}
        {!result && submission && (
          <footer className="relative z-20 border-t border-gray-800 bg-gray-900/90 backdrop-blur-xl px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_-20px_40px_rgba(0,0,0,0.4)]">
            <div className="flex items-center gap-4 bg-gray-950/50 px-6 py-3 rounded-2xl border border-gray-800">
              <div className={`h-3 w-3 rounded-full transition-all duration-500 ${unansweredCount > 0 ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse" : "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"}`} />
              <div>
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Readiness Status</p>
                <p className="text-sm font-bold text-gray-200">
                  {unansweredCount > 0
                    ? `${unansweredCount} REQUIREMENT${unansweredCount > 1 ? 'S' : ''} MISSING`
                    : "OPTIMAL • READY FOR SUBMISSION"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto">
              {(category === "scenario" || category === "standard") && (
                <button
                  type="button"
                  onClick={() => handleSaveDraft(false)}
                  disabled={loading || isSaving}
                  className="flex items-center justify-center gap-2 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-gray-400 hover:text-white bg-gray-800/40 hover:bg-gray-800 rounded-2xl border border-gray-800 transition-all"
                >
                  <IoSaveOutline size={18} className={isSaving ? "animate-spin" : ""} />
                  {isSaving ? "Saving..." : "Save Draft"}
                </button>
              )}
              
              <button
                type="submit"
                onClick={handleSubmit}
                disabled={loading || secondsLeft === 0 || unansweredCount > 0}
                className={`group relative flex-grow sm:flex-grow-0 inline-flex items-center justify-center gap-4 rounded-2xl px-12 py-4 text-sm font-black text-white transition-all active:scale-95 shadow-lg ${
                  unansweredCount > 0 
                    ? 'bg-gray-800 cursor-not-allowed opacity-50' 
                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/25'
                }`}
              >
                {loading ? (
                   <>
                     <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                     PROCESSING...
                   </>
                ) : (
                  <>
                    <IoSendOutline className="text-xl group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                    FINALIZE & SUBMIT
                  </>
                )}
                {!loading && unansweredCount === 0 && (
                  <div className="absolute inset-0 -z-10 rounded-2xl bg-indigo-500/0 blur-xl group-hover:bg-indigo-500/20 transition-all duration-500" />
                )}
              </button>
            </div>
          </footer>
        )}
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1f2937;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #374151;
        }
      `}</style>
    </div>
  );
};

export default StudentAssessmentTaker;
