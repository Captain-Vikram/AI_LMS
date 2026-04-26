import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IoCheckmarkCircleOutline,
  IoRefreshOutline,
  IoTimeOutline,
  IoCheckmarkDoneOutline,
  IoDocumentTextOutline,
  IoCloudDownloadOutline,
} from "react-icons/io5";
import AppBackButton from "../UI/AppBackButton";
import apiClient from "../../services/apiClient";
import IconsCarousel from "../IconsCarousel";

const TeacherGradingDashboard = () => {
  const navigate = useNavigate();
  const { id: classroomId } = useParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [gradedSubmissions, setGradedSubmissions] = useState([]);

  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [selectedSubmissionType, setSelectedSubmissionType] = useState("standard");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detail, setDetail] = useState(null);

  const [grades, setGrades] = useState({});
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);

  const loadSubmissions = async () => {
    if (!classroomId) return;

    setLoading(true);
    setError("");

    try {
      const [pendingRes, gradedRes] = await Promise.all([
        apiClient.get(`/api/module-assessment/pending-grades/${classroomId}?status=pending`),
        apiClient.get(`/api/module-assessment/pending-grades/${classroomId}?status=graded`)
      ]);
      
      setPendingSubmissions(pendingRes?.pending_submissions || []);
      setGradedSubmissions(gradedRes?.graded_submissions || []);
    } catch (err) {
      setError(err?.message || "Failed to load submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
    setSelectedSubmissionId("");
    setDetail(null);
  }, [classroomId]);

  const loadSubmissionDetail = async (item) => {
    setSelectedSubmissionId(item.submission_id);
    setSelectedSubmissionType(item.type || "standard");
    setDetailLoading(true);
    setDetailError("");
    setDetail(null);
    setGrades({});
    setFeedback("");

    try {
      const endpoint = item.type === "workflow"
        ? `/api/module-assessment/workflow/submission/${item.submission_id}`
        : `/api/module-assessment/submission/${item.submission_id}`;
      
      const response = await apiClient.get(endpoint);
      setDetail(response);
      
      if (item.type === "workflow") {
        setFeedback(response?.teacher_review?.teacher_comment || "");
        setGrades({
          points: Number(response?.teacher_review?.points_awarded || response?.teacher_score || 0)
        });
      } else {
        setFeedback(response?.teacher_feedback || "");
        const initialGrades = {};
        (response?.manual_questions || []).forEach((question) => {
          initialGrades[question.question_id] = Number(question.points_awarded || 0);
        });
        setGrades(initialGrades);
      }
    } catch (err) {
      setDetailError(err?.message || "Failed to load submission detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const manualTotal = useMemo(() => {
    const values = Object.values(grades);
    return values.reduce((sum, value) => sum + Number(value || 0), 0);
  }, [grades]);

  const isGraded = useMemo(() => {
    return detail?.grading_status === "fully_graded";
  }, [detail]);

  const handleGrade = async () => {
    if (!selectedSubmissionId || !detail) return;

    setSaving(true);
    setDetailError("");

    try {
      if (selectedSubmissionType === "workflow") {
        await apiClient.patch(
          `/api/module-assessment/workflow/submission/${selectedSubmissionId}/teacher-review`,
          {
            points_awarded: grades.points || 0,
            max_points: 100,
            teacher_comment: feedback,
          }
        );
      } else {
        const gradePayload = (detail?.manual_questions || []).map((question) => {
          const awarded = Number(grades[question.question_id] || 0);
          return {
            question_id: question.question_id,
            points_awarded: awarded,
            teacher_comment: "",
          };
        });

        await apiClient.patch(
          `/api/module-assessment/submission/${selectedSubmissionId}/grade`,
          {
            submission_id: selectedSubmissionId,
            grades: gradePayload,
            overall_feedback: feedback,
          }
        );
      }

      await loadSubmissions();
      // Reload detail to show updated state
      const item = [...pendingSubmissions, ...gradedSubmissions].find(s => s.submission_id === selectedSubmissionId);
      if (item) {
        await loadSubmissionDetail(item);
      } else {
        setDetail(null);
        setSelectedSubmissionId("");
      }
    } catch (err) {
      setDetailError(err?.message || "Failed to save grades");
    } finally {
      setSaving(false);
    }
  };

  const renderWorkflowContent = (submission) => {
    const category = submission.category;
    const content = submission.content || {};

    if (category === 'scenario') {
      const answers = content.answers || [];
      return (
        <div className="space-y-4">
          {answers.map((answer, index) => (
            <div key={index} className="rounded-lg border border-gray-700/30 bg-gray-800/30 p-4">
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Question {index + 1}</p>
              <p className="text-sm text-gray-200 mb-3">{answer.question_text || "Scenario Question"}</p>
              <div className="bg-gray-900/50 rounded p-3 border border-gray-700/50">
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{answer.student_answer || "No answer provided"}</p>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (category === 'article') {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-700/30 bg-gray-800/30 p-4">
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">Article Link</p>
            <a href={content.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline break-all">
              {content.url}
            </a>
            {content.topic_title && (
              <p className="mt-2 text-sm text-gray-400">Topic: <span className="text-gray-200">{content.topic_title}</span></p>
            )}
          </div>
          {submission.ai_evaluation && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">AI Evaluation</p>
              <p className="text-sm text-gray-300 italic">"{submission.ai_evaluation.feedback || submission.ai_evaluation.summary}"</p>
            </div>
          )}
        </div>
      );
    }

    if (category === 'ppt' || category === 'research') {
      return (
        <div className="space-y-4">
          <div className="rounded-lg border border-gray-700/30 bg-gray-800/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">Uploaded Artifact</p>
                <p className="text-sm text-gray-200">{content.file_name || "Assessment File"}</p>
                {content.topic_title && (
                  <p className="mt-1 text-xs text-gray-400">Topic: {content.topic_title}</p>
                )}
              </div>
              <button 
                onClick={() => window.open(`/api/module-assessment/workflow/submission/${submission.submission_id}/download`, '_blank')}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-bold text-white transition-colors"
              >
                <IoCloudDownloadOutline size={16} /> Download
              </button>
            </div>
          </div>
          {submission.ai_evaluation && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">AI Analysis</p>
              <p className="text-sm text-gray-300 italic">"{submission.ai_evaluation.partial_feedback || submission.ai_evaluation.summary || "Content analyzed by AI."}"</p>
            </div>
          )}
        </div>
      );
    }

    return <p className="text-sm text-gray-400 italic">Unsupported workflow category: {category}</p>;
  };

  const SubmissionList = ({ title, items, emptyMessage, variant }) => (
    <div className="space-y-3">
      <h3 className={`text-xs font-bold uppercase tracking-widest px-1 ${variant === 'pending' ? 'text-cyan-500' : 'text-emerald-500'}`}>
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-700 px-3 py-4 text-xs text-gray-500 italic">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <button
              key={item.submission_id}
              type="button"
              onClick={() => loadSubmissionDetail(item)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-all duration-200 ${
                selectedSubmissionId === item.submission_id
                  ? variant === "pending" 
                    ? "border-cyan-500/50 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                    : "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : "border-gray-700/50 bg-gray-900/40 hover:border-cyan-500/30 hover:bg-gray-800/60"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-semibold text-gray-100">{item.student_name}</p>
                  <p className="text-[11px] font-medium text-gray-400 mt-0.5">{item.module_title}</p>
                </div>
                {item.type === "workflow" && (
                  <span className="bg-indigo-500/20 text-indigo-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-indigo-500/30 uppercase tracking-tighter">
                    Workflow
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-end mt-2">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${variant === "pending" ? "text-cyan-500" : "text-emerald-500"}`}>
                  {variant === "pending" 
                    ? `Tasks: ${item.pending_questions_count || 1}`
                    : `Score: ${Math.round((item.score_percentage || 0) * 100)}%`}
                </p>
                <p className="text-[9px] text-gray-500 italic">
                  {new Date(item.submitted_at).toLocaleDateString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <section className="relative min-h-screen px-4 py-12 pt-28">
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <IconsCarousel backgroundColor="rgba(17, 24, 39, 0.8)" iconColor="gray-500/30" />
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 to-gray-800/90" />
      </div>

      <div className="container mx-auto relative z-10 max-w-7xl">
        <div className="bg-gray-800/60 backdrop-blur-lg border border-gray-700/50 rounded-3xl p-5 md:p-8 shadow-2xl space-y-6">

      <header className="rounded-2xl border border-gray-700/50 bg-gray-800/60 backdrop-blur-md p-5 pb-6">
        <AppBackButton
          label="Back to Dashboard"
          fallbackTo={`/classroom/${classroomId}/dashboard`}
        />
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mt-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Grading Dashboard</h1>
            <p className="mt-1.5 text-base font-medium text-emerald-400">
              Review and manage student assessment submissions.
            </p>
          </div>
          
          <button
            type="button"
            onClick={loadSubmissions}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gray-700/50 px-4 py-2 text-sm font-bold text-gray-200 hover:bg-gray-600 transition-colors disabled:opacity-60 border border-gray-600/50"
          >
            <IoRefreshOutline size={18} className={loading ? "animate-spin" : ""} /> Refresh List
          </button>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-sm text-red-200 font-medium">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <aside className="xl:col-span-4 space-y-8 rounded-2xl border border-gray-700/50 bg-gray-800/60 backdrop-blur-md p-5 shadow-lg max-h-[800px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
          <SubmissionList 
            title="Awaiting Grading" 
            items={pendingSubmissions} 
            emptyMessage="No submissions waiting for grading."
            variant="pending"
          />
          
          <div className="border-t border-gray-700/50 pt-6">
            <SubmissionList 
              title="Recently Graded" 
              items={gradedSubmissions} 
              emptyMessage="No graded assessments found."
              variant="graded"
            />
          </div>
        </aside>

        <section className="xl:col-span-8 rounded-2xl border border-gray-700/50 bg-gray-800/60 backdrop-blur-md p-5 shadow-lg min-h-[600px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight text-white">
              {isGraded ? "Grading Review" : "Manual Grading"}
            </h2>
            {detail && selectedSubmissionType === "workflow" && (
              <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold rounded-lg uppercase tracking-widest">
                {detail.category} variant
              </span>
            )}
          </div>

          {detailLoading ? <p className="mt-3 text-sm text-gray-400">Loading submission detail...</p> : null}
          {detailError ? (
            <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {detailError}
            </p>
          ) : null}

          {!detailLoading && !detail ? (
            <div className="mt-8 flex flex-col items-center justify-center text-center space-y-4 py-24">
              <IoDocumentTextOutline size={64} className="text-gray-700" />
              <p className="max-w-xs text-sm text-gray-400">
                Select a student submission from the sidebar to review answers and provide grades.
              </p>
            </div>
          ) : null}

          {detail ? (
            <div className="space-y-5 mt-4">
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-5 py-4 text-sm text-gray-300 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="flex gap-6">
                  <p className="uppercase tracking-wider text-[10px] font-bold text-gray-500">
                    {selectedSubmissionType === "workflow" ? "AI Evaluation" : "Auto Score"}: 
                    <span className="font-bold text-base text-gray-200 ml-1 block sm:inline">
                      {selectedSubmissionType === "workflow" ? detail.ai_score : detail.auto_graded_score}
                    </span>
                  </p>
                  <p className="uppercase tracking-wider text-[10px] font-bold text-gray-500">
                    {isGraded ? "Final Score" : "Manual Points"}: 
                    <span className="font-bold text-base text-gray-200 ml-1 block sm:inline">
                      {selectedSubmissionType === "workflow" ? detail.total_score : (isGraded ? detail.manual_graded_score : manualTotal)}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                    Current Percentage
                  </p>
                  <p className="text-2xl font-black text-white">
                    {Math.round((detail.score_percentage || 0) * 100)}%
                  </p>
                </div>
              </div>

              {selectedSubmissionType === "standard" && (detail.all_questions || detail.manual_questions || []).map((question) => (
                <article
                  key={question.question_id}
                  className={`rounded-xl border p-5 shadow-inner ${
                    question.is_manual 
                      ? "border-gray-700/50 bg-gray-900/40" 
                      : "border-emerald-500/20 bg-emerald-500/5"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-base font-medium text-gray-100">{question.question_text}</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      question.is_manual 
                        ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" 
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}>
                      {question.is_manual ? "Manual Grade" : "Auto Graded"}
                    </span>
                  </div>

                  <p className="mt-3 text-xs font-bold uppercase tracking-widest text-indigo-400">Student answer:</p>
                  <div className="mt-1.5 rounded-lg border border-gray-700/30 bg-gray-800/50 p-3">
                    <p className={`text-sm font-medium leading-relaxed whitespace-pre-wrap ${
                      !question.is_manual && question.is_correct === false ? "text-red-400" : "text-gray-300"
                    }`}>
                      {question.student_answer || "No answer provided"}
                    </p>
                  </div>

                  {!question.is_manual && (
                    <div className="mt-3 flex flex-col gap-1.5">
                      <p className="text-xs font-bold uppercase tracking-widest text-emerald-500">Correct answer:</p>
                      <div className="rounded-lg border border-emerald-500/10 bg-emerald-500/5 p-3">
                        <p className="text-sm font-medium text-emerald-300/80">{question.correct_answer}</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                      {question.is_manual ? "Points Awarded" : "Auto Score"}
                    </label>
                    {question.is_manual ? (
                      <input
                        type="number"
                        min={0}
                        max={Number(question.max_points || 0)}
                        disabled={isGraded || saving}
                        value={grades[question.question_id] ?? 0}
                        onChange={(event) =>
                          setGrades((previous) => ({
                            ...previous,
                            [question.question_id]: Number(event.target.value || 0),
                          }))
                        }
                        className="w-24 rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-base font-semibold text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all disabled:opacity-60"
                      />
                    ) : (
                      <div className={`w-24 rounded-lg border px-3 py-1.5 text-center font-bold ${
                        question.is_correct ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-400"
                      }`}>
                        {question.points_awarded}
                      </div>
                    )}
                    <span className="text-sm font-semibold text-gray-500">/ {question.max_points}</span>
                  </div>
                </article>
              ))}

              {selectedSubmissionType === "workflow" && (
                <article className="rounded-xl border border-gray-700/50 bg-gray-900/40 p-5 shadow-inner">
                  {renderWorkflowContent(detail)}
                  
                  <div className="mt-6 pt-6 border-t border-gray-700/50 flex items-center gap-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Final Competency Score</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      disabled={isGraded || saving}
                      value={grades.points ?? 0}
                      onChange={(event) =>
                        setGrades({ points: Number(event.target.value || 0) })
                      }
                      className="w-24 rounded-lg border border-gray-600 bg-gray-800 px-3 py-1.5 text-base font-semibold text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all disabled:opacity-60"
                    />
                    <span className="text-sm font-semibold text-gray-500">/ 100</span>
                    <p className="text-[10px] text-gray-500 ml-2">Note: Adjust the AI score based on your review.</p>
                  </div>
                </article>
              )}

              <div className="pt-4 border-t border-gray-700/50">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    {isGraded ? "Submitted Feedback" : "Teacher Feedback"}
                  </span>
                  <textarea
                    value={feedback}
                    disabled={isGraded || saving}
                    onChange={(event) => setFeedback(event.target.value)}
                    rows={4}
                    placeholder="Provide constructive feedback for the student..."
                    className="mt-2 w-full rounded-xl border border-gray-700/50 bg-gray-900/50 px-4 py-3 text-sm text-gray-100 placeholder:text-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none transition-all disabled:opacity-60"
                  />
                </label>

                {!isGraded && (
                  <button
                    type="button"
                    onClick={handleGrade}
                    disabled={saving}
                    className="mt-6 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-cyan-600 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white hover:bg-cyan-500 transition-colors disabled:opacity-60 shadow-lg shadow-cyan-900/50"
                  >
                    <IoCheckmarkCircleOutline size={20} />
                    {saving ? "Saving Grades..." : "Finalize & Notify Student"}
                  </button>
                )}
                
                {isGraded && (
                   <div className="mt-6 flex items-center gap-2 text-emerald-400 font-bold text-sm bg-emerald-500/5 px-4 py-3 rounded-xl border border-emerald-500/20">
                      <IoCheckmarkDoneOutline size={20} />
                      This assessment has been graded and the student has been notified.
                   </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>

      </div>
        </div>
    </section>
  );
};

export default TeacherGradingDashboard;
