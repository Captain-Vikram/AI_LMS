import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import AppBackButton from '../UI/AppBackButton';
import GlassDashboardShell from '../UI/GlassDashboardShell';
import { FiLoader, FiAlertTriangle, FiBook, FiCheckCircle, FiPlayCircle, FiMessageCircle, FiRefreshCw, FiCheck, FiX, FiUploadCloud, FiGithub, FiAward, FiCpu } from 'react-icons/fi';

const SkillPathwayTracker = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [dashboardData, setDashboardData] = useState(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(1);
  const [stageDetails, setStageDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [generationError, setGenerationError] = useState(null);
  const [stageMessage, setStageMessage] = useState(null);
  const [confirmCompletion, setConfirmCompletion] = useState(false);
  const [completing, setCompleting] = useState(false);

  // Project Analyzer submission state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitMode, setSubmitMode] = useState('zip');
  const [projectZip, setProjectZip] = useState(null);
  const [projectRepoUrl, setProjectRepoUrl] = useState('');
  const [projectBranch, setProjectBranch] = useState('main');
  const [submittingProject, setSubmittingProject] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [projectReport, setProjectReport] = useState(null);

  const fetchProgress = async () => {
    setLoading(true);
    setError(null);
    try {
      const pgRes = await apiClient.get(API_ENDPOINTS.PATHWAY_GET_PROGRESS(id));
      if (pgRes.status === 'success') {
        const matched = pgRes.data;
        setDashboardData(matched);
        
        // Determine active stage
        const stageProgress = Array.isArray(matched?.stage_progress) ? matched.stage_progress : [];
        const activeStage = stageProgress.find((s) => s.status === 'in-progress') || stageProgress[0];
        setCurrentStageIndex(Number(activeStage?.stage_index || 1));
      } else {
        setError('Failed to load pathway progress. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load pathway progress.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress();
  }, [id]);

  useEffect(() => {
    if (!dashboardData) return;
    
    const fetchStageDetails = async () => {
      try {
        const detailsRes = await apiClient.get(API_ENDPOINTS.PATHWAY_STAGE_DETAILS(id, currentStageIndex));
        if (detailsRes.status === 'success') {
           setStageDetails(detailsRes.data);
        }
      } catch(err) {
         console.error('Failed to load stage blueprint:', err);
      }
    };
    
    fetchStageDetails();
  }, [id, currentStageIndex, dashboardData]);

  const handleGenerateResources = async () => {
    setGenerating(true);
    setGenerationError(null);
    try {
      const res = await apiClient.post(API_ENDPOINTS.PATHWAY_GENERATE_RESOURCES(id, currentStageIndex));
      if (res.status === 'success') {
        await fetchProgress();
      } else {
        setGenerationError(res.message || "Failed to generate resources.");
      }
    } catch (err) {
      setGenerationError(err.message || "An unexpected error occurred during generation.");
    } finally {
      setGenerating(false);
    }
  };

  const handleCompleteStage = async () => {
    setConfirmCompletion(false);
    setCompleting(true);
    setStageMessage(null);
    try {
      const res = await apiClient.post(API_ENDPOINTS.PATHWAY_COMPLETE_STAGE(id, currentStageIndex));
      if (res.status === 'success') {
        setStageMessage({ type: 'success', text: res.message || 'Stage marked as complete! Moving to next stage.' });
        await fetchProgress();
      } else {
        setStageMessage({ type: 'error', text: res.message || 'Failed to complete stage.' });
      }
    } catch (err) {
      setStageMessage({ type: 'error', text: 'Error completing stage: ' + err.message });
    } finally {
      setCompleting(false);
    }
  };

  const handleProjectSubmit = async () => {
    setSubmitError(null);
    setSubmittingProject(true);
    try {
      const formData = new FormData();
      if (submitMode === 'zip') {
        if (!projectZip) {
          setSubmitError('Please select a project ZIP file.');
          setSubmittingProject(false);
          return;
        }
        formData.append('file', projectZip);
      } else {
        if (!projectRepoUrl.trim()) {
          setSubmitError('Please enter a GitHub repository URL.');
          setSubmittingProject(false);
          return;
        }
        formData.append('repo_url', projectRepoUrl.trim());
        formData.append('branch', projectBranch.trim() || 'main');
      }

      const res = await apiClient.post(API_ENDPOINTS.PATHWAY_SUBMIT_PROJECT(id, currentStageIndex), formData);
      if (res.status === 'success') {
        setProjectReport(res.report);
        if (res.passed) {
          setStageMessage({ type: 'success', text: `Project Passed with Score ${res.score}/100 (Grade ${res.grade})! Moving to next stage.` });
          await fetchProgress();
        } else {
          setSubmitError(`Project scored ${res.score}/100 (Grade ${res.grade}). 60% required to complete this stage. Check the review report below.`);
        }
      } else {
        setSubmitError(res.message || 'Analysis failed. Please try again.');
      }
    } catch (err) {
      setSubmitError(err.message || 'Error submitting project.');
    } finally {
      setSubmittingProject(false);
    }
  };

  const handleTakeTest = (resource_id) => {
    navigate(`/skill-pathway/${id}/stage/${currentStageIndex}/resource/${resource_id}?assessment=1`);
  };

  if (loading) {
    return (
      <GlassDashboardShell contentClassName="max-w-6xl">
        <div className="flex flex-col justify-center items-center py-20 text-gray-400">
          <FiLoader className="animate-spin text-4xl mb-4 text-indigo-400" />
          <p className="text-lg">Loading your skills tracker...</p>
        </div>
      </GlassDashboardShell>
    );
  }

  if (error || (!loading && !dashboardData)) {
    return (
      <GlassDashboardShell contentClassName="max-w-6xl">
         <div className="bg-red-900/30 border border-red-700/50 p-8 rounded-2xl text-red-200 text-center">
          <FiAlertTriangle className="mx-auto text-5xl mb-4 text-red-400"/>
          <h2 className="text-2xl font-bold mb-2">Connection Error</h2>
          <p className="text-red-200/70 max-w-md mx-auto mb-8">{error || "We couldn't retrieve your pathway data. The server might be temporarily unavailable."}</p>
          <div className="flex justify-center gap-4">
            <button 
              onClick={fetchProgress}
              className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-all"
            >
              Retry Connection
            </button>
            <AppBackButton fallbackTo="/skills" />
          </div>
        </div>
      </GlassDashboardShell>
    );
  }

  const tracker = stageDetails?.tracker;
  const trackerResources = Array.isArray(tracker?.resources) ? tracker.resources : [];
  const projectPrompt = stageDetails?.project_prompt;

  return (
    <GlassDashboardShell contentClassName="max-w-6xl">
      <div className="mb-4">
        <AppBackButton fallbackTo="/skills" />
      </div>

      <div className="mb-6 flex items-center justify-between">
         <h1 className="text-3xl font-bold text-white">{dashboardData.pathway_details?.title || 'Skill Pathway'}</h1>
         <div className="flex items-center space-x-4 bg-gray-800/80 px-4 py-2 rounded-xl border border-gray-700/60 shadow-inner">
            <div className="text-gray-400 font-medium">Stage {currentStageIndex} of {dashboardData.pathway_details?.total_stages}</div>
            <div className="w-px h-6 bg-gray-700"></div>
            <div className="text-emerald-400 font-bold flex items-center gap-2"><FiCheckCircle /> {tracker?.status || 'locked'}</div>
         </div>
      </div>

      {stageMessage && (
        <div className={`mb-6 flex items-center justify-between p-4 rounded-xl border ${stageMessage.type === 'success' ? 'bg-emerald-900/30 border-emerald-700/50 text-emerald-200' : 'bg-red-900/30 border-red-700/50 text-red-200'}`}>
          <div className="flex items-center gap-3">
            {stageMessage.type === 'success' ? <FiCheckCircle className="text-xl text-emerald-400 shrink-0" /> : <FiAlertTriangle className="text-xl text-red-400 shrink-0" />}
            <span className="text-sm font-medium">{stageMessage.text}</span>
          </div>
          <button onClick={() => setStageMessage(null)} className="text-current opacity-60 hover:opacity-100 px-2"><FiX /></button>
        </div>
      )}

      {generationError && (
        <div className="mb-6 bg-amber-900/30 border border-amber-700/50 p-4 rounded-xl text-amber-200 flex items-center justify-between">
          <div className="flex items-center">
            <FiAlertTriangle className="mr-3 text-xl text-amber-400" />
            <span>{generationError}</span>
          </div>
          <button onClick={() => setGenerationError(null)} className="text-amber-400 hover:text-amber-300 font-bold px-2">✕</button>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         {/* Sidebar: Subtopics / Blueprint */}
         <div className="col-span-1 space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
               <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><FiBook /> Learning Objectives</h3>
               <ul className="space-y-3">
                 {stageDetails?.blueprint_topics?.map((topic, i) => (
                    <li key={i} className="text-sm text-gray-300">
                       <span className="block font-semibold text-indigo-400 mb-1">{topic.name}</span>
                       <ul className="list-disc pl-4 text-gray-500 space-y-1">
                      {(Array.isArray(topic?.subtopics) ? topic.subtopics : []).map((s, idx) => <li key={idx}>{s}</li>)}
                       </ul>
                    </li>
                 ))}
               </ul>
            </div>

            <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-xl p-5">
               <div className="flex items-center justify-between mb-2">
                 <h3 className="text-lg font-semibold text-indigo-200 flex items-center gap-1.5"><FiCpu className="text-indigo-400" /> Project Assessment</h3>
                 {tracker?.project_completed && (
                   <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">PASSED</span>
                 )}
               </div>
               <p className="text-sm text-indigo-300/80 italic mb-4">{projectPrompt || "Follow along with the generated resources."}</p>

               {tracker?.project_completed ? (
                 <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center space-y-2">
                   <p className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1"><FiCheckCircle /> Stage Project Verified & Passed</p>
                   {tracker?.project_score && (
                     <p className="text-[11px] text-gray-400">Score: <span className="font-bold text-white">{tracker.project_score}/100</span> (Grade {tracker.project_grade || 'A'})</p>
                   )}
                   {(tracker?.project_review || projectReport) && (
                     <button
                       onClick={() => setShowSubmitModal(!showSubmitModal)}
                       className="w-full py-1.5 px-2 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-300 rounded text-xs font-medium transition-all flex items-center justify-center gap-1 mt-1"
                     >
                       <FiBook /> {showSubmitModal ? "Hide AI Report" : "View AI Evaluation Report"}
                     </button>
                   )}
                 </div>
               ) : (
                 <div className="space-y-3">
                   <button 
                    onClick={() => setShowSubmitModal(!showSubmitModal)}
                    className="w-full py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-sm font-bold shadow-lg shadow-purple-600/20 transition-all flex items-center justify-center gap-2"
                   >
                     <FiAward size={16} /> {showSubmitModal ? "Hide Submission Panel" : "Submit Project for AI Review"}
                   </button>
                 </div>
               )}

               {showSubmitModal && (tracker?.project_review || projectReport) && (
                 <div className="mt-3 p-3 rounded-lg bg-gray-950/80 border border-indigo-700/50 text-left space-y-2">
                   <div className="flex items-center justify-between">
                     <span className="text-[11px] font-bold text-white">AI Feedback & Code Review</span>
                     <span className="text-[10px] text-indigo-400 font-semibold">{tracker?.project_review?.final_verdict?.grade || projectReport?.final_verdict?.grade || 'Passed'}</span>
                   </div>
                   <p className="text-[11px] text-gray-300 leading-relaxed">
                     {tracker?.project_review?.executive_summary?.overall_assessment || projectReport?.executive_summary?.overall_assessment || 'Project met stage objectives.'}
                   </p>
                   {(tracker?.project_review?.final_verdict?.next_steps || projectReport?.final_verdict?.next_steps) && (
                     <p className="text-[10px] text-indigo-300 border-t border-gray-800 pt-1.5">
                       <span className="font-bold">Next Steps:</span> {tracker?.project_review?.final_verdict?.next_steps || projectReport?.final_verdict?.next_steps}
                     </p>
                   )}
                 </div>
               )}

               {showSubmitModal && !tracker?.project_completed && (
                 <div className="mt-4 pt-4 border-t border-indigo-700/40 space-y-3">
                   <div className="flex rounded-lg border border-indigo-700/50 bg-gray-900/50 p-0.5">
                     <button
                       onClick={() => setSubmitMode('zip')}
                       className={`flex-1 py-1.5 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-all ${submitMode === 'zip' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                     >
                       <FiUploadCloud size={12} /> ZIP
                     </button>
                     <button
                       onClick={() => setSubmitMode('github')}
                       className={`flex-1 py-1.5 text-xs font-semibold rounded flex items-center justify-center gap-1 transition-all ${submitMode === 'github' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'}`}
                     >
                       <FiGithub size={12} /> GitHub
                     </button>
                   </div>

                   {submitMode === 'zip' ? (
                     <div className="space-y-2">
                       <label className="block text-[11px] font-semibold text-gray-300">Upload Project .zip</label>
                       <input
                         type="file"
                         accept=".zip"
                         onChange={(e) => setProjectZip(e.target.files?.[0] || null)}
                         className="w-full text-xs text-gray-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                       />
                     </div>
                   ) : (
                     <div className="space-y-2">
                       <div>
                         <label className="block text-[11px] font-semibold text-gray-300 mb-1">GitHub Repo URL</label>
                         <input
                           type="url"
                           value={projectRepoUrl}
                           onChange={(e) => setProjectRepoUrl(e.target.value)}
                           placeholder="https://github.com/user/repo"
                           className="w-full bg-gray-900/60 border border-indigo-700/40 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                         />
                       </div>
                       <div>
                         <label className="block text-[11px] font-semibold text-gray-300 mb-1">Branch</label>
                         <input
                           type="text"
                           value={projectBranch}
                           onChange={(e) => setProjectBranch(e.target.value)}
                           placeholder="main"
                           className="w-full bg-gray-900/60 border border-indigo-700/40 rounded px-2.5 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-indigo-500"
                         />
                       </div>
                     </div>
                   )}

                   {submitError && (
                     <div className="p-2.5 rounded bg-red-900/40 border border-red-700/50 text-red-200 text-xs flex items-start gap-1.5">
                       <FiAlertTriangle className="shrink-0 mt-0.5" />
                       <span>{submitError}</span>
                     </div>
                   )}

                   <button
                     onClick={handleProjectSubmit}
                     disabled={submittingProject}
                     className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20"
                   >
                     {submittingProject ? (
                       <><FiLoader className="animate-spin" /> Analyzing Project...</>
                     ) : (
                       <><FiCheckCircle /> Submit & Verify</>
                     )}
                   </button>
                 </div>
               )}
            </div>
         </div>

         {/* Main Content: Resources Grid */}
         <div className="col-span-3 space-y-6">
          {trackerResources.length === 0 ? (
               <div className="bg-gray-800/80 border border-dashed border-gray-700 rounded-2xl p-12 text-center shadow-lg">
                  <div className="bg-indigo-900/40 p-5 rounded-full inline-block mb-4">
                     <FiPlayCircle className="text-indigo-400 text-4xl" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-3">Ready to Begin Phase {currentStageIndex}?</h2>
                  <p className="text-gray-400 max-w-lg mx-auto mb-6">
                     Generate your highly personalized, AI-curated curriculum of 5 videos and 5 articles to master these specific subtopics.
                  </p>
                  <button 
                    onClick={handleGenerateResources} 
                    disabled={generating}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center mx-auto transition-transform active:scale-95"
                  >
                     {generating ? <><FiLoader className="animate-spin mr-2"/> Generating AI Curriculum...</> : <><FiRefreshCw className="mr-2" /> Generate Study Material</>}
                  </button>
                  <div className="mt-4 text-xs font-semibold text-gray-500">Regenerations used: {tracker?.regenerations_used || 0}/3</div>
               </div>
            ) : (
               <div className="space-y-6">
                  {/* Videos */}
                  <h3 className="text-xl font-bold text-white flex items-center gap-2"><FiPlayCircle className="text-rose-400" /> Curated Video Lectures</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {trackerResources.filter(r => r.type === 'video').map((r, i) => (
                        <div key={i} className="bg-gray-800/80 border border-gray-700 hover:border-gray-500 p-4 rounded-xl flex flex-col justify-between h-full group transition-all">
                           <div>
                              <h4 className="text-white font-semibold text-sm mb-2">{r.title}</h4>
                                {(() => {
                                  const ytMatch = r.url?.match(/[?&]v=([^&#]+)/);
                                  const ytId = ytMatch ? ytMatch[1] : null;
                                  if (ytId) {
                                    return (
                                      <div className="w-full aspect-video rounded-lg overflow-hidden mb-4 border border-gray-600 bg-black">
                                        <iframe src={`https://www.youtube.com/embed/${ytId}`} className="w-full h-full" frameBorder="0" allowFullScreen></iframe>
                                      </div>
                                    );
                                  }
                                  return <a href={r.url} target="_blank" rel="noreferrer" className="text-rose-400 text-xs hover:underline break-all block mb-4">{r.url}</a>;
                                  })()}
                             </div>
                             <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-700/50">
                              <span className="text-xs text-gray-400">Tests Passed: <span className={r.passed_tests_count >= 2 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>{r.passed_tests_count}/2</span></span>
                              <div className="flex gap-2">
                                  <button onClick={() => navigate(`/skill-pathway/${id}/stage/${currentStageIndex}/resource/${r.resource_id}`)} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-xs text-white rounded font-medium flex items-center gap-1">
                                    <FiPlayCircle /> Study
                                  </button>
                                <button onClick={() => handleTakeTest(r.resource_id)} className="bg-gray-700 hover:bg-gray-600 px-3 py-1 text-xs text-white rounded font-medium disabled:opacity-30 flex items-center gap-1" disabled={r.passed_tests_count >= 2}>
                                   {r.passed_tests_count >= 2 ? <><FiCheck /> Mastered</> : "Take Test"}
                                </button>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>

                  {/* Articles */}
                  <h3 className="text-xl font-bold text-white flex items-center gap-2 mt-8"><FiBook className="text-cyan-400" /> DeepSearch Articles</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {trackerResources.filter(r => r.type === 'article').map((r, i) => (
                        <div key={i} className="bg-gray-800/80 border border-gray-700 hover:border-gray-500 p-4 rounded-xl flex flex-col justify-between h-full group transition-all">
                           <div>
                              <h4 className="text-white font-semibold text-sm mb-2">{r.title}</h4>
                                <div className="mb-4">
                                  <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-gray-700/50 hover:bg-gray-600/60 transition-all text-cyan-300 text-xs px-3 py-2 rounded-lg break-all">
                                    <FiBook className="shrink-0 text-cyan-400" />
                                    Read Full Article
                                  </a>
                                </div>
                           </div>
                           <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-700/50">
                              <span className="text-xs text-gray-400">Tests Passed: <span className={r.passed_tests_count >= 2 ? 'text-emerald-400 font-bold' : 'text-amber-400'}>{r.passed_tests_count}/2</span></span>
                              <div className="flex gap-2">
                                  <button onClick={() => navigate(`/skill-pathway/${id}/stage/${currentStageIndex}/resource/${r.resource_id}`)} className="bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-xs text-white rounded font-medium flex items-center gap-1">
                                    <FiPlayCircle /> Study
                                  </button>
                                <button onClick={() => handleTakeTest(r.resource_id)} className="bg-gray-700 hover:bg-gray-600 px-3 py-1 text-xs text-white rounded font-medium disabled:opacity-30 flex items-center gap-1" disabled={r.passed_tests_count >= 2}>
                                   {r.passed_tests_count >= 2 ? <><FiCheck /> Mastered</> : "Take Test"}
                                </button>
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            )}
         </div>
      </div>
    </GlassDashboardShell>
  );
};

export default SkillPathwayTracker;