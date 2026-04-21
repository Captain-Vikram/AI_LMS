import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import GlassDashboardShell from '../UI/GlassDashboardShell';
import { FiLoader, FiAlertTriangle, FiBook, FiCheckCircle, FiPlayCircle, FiMessageCircle, FiRefreshCw, FiCheck } from 'react-icons/fi';

const SkillPathwayTracker = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [dashboardData, setDashboardData] = useState(null);
  const [currentStageIndex, setCurrentStageIndex] = useState(1);
  const [stageDetails, setStageDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchProgress = async () => {
      setLoading(true);
      try {
        const pgRes = await apiClient.get(API_ENDPOINTS.PATHWAYS_MY_PROGRESS);
        if (pgRes.status === 'success') {
          const pathwayList = Array.isArray(pgRes?.data) ? pgRes.data : [];
          const matched = pathwayList.find((p) => p?.pathway_id === id);
          if (!matched) {
            setError("You are not enrolled in this pathway.");
            setLoading(false);
            return;
          }
          setDashboardData(matched);
          
          // Determine active stage
          const stageProgress = Array.isArray(matched?.stage_progress) ? matched.stage_progress : [];
          const activeStage = stageProgress.find((s) => s.status === 'in-progress') || stageProgress[0];
          setCurrentStageIndex(Number(activeStage?.stage_index || 1));
        }
      } catch (err) {
        setError(err.message || 'Failed to load pathway progress.');
      } finally {
        setLoading(false);
      }
    };
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
    try {
      const res = await apiClient.post(API_ENDPOINTS.PATHWAY_GENERATE_RESOURCES(id, currentStageIndex));
      if (res.status === 'success') {
        // Refresh component
        window.location.reload();
      }
    } catch (err) {
      alert("Failed generating resources: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleTakeTest = (resource_id) => {
    navigate(`/skill-pathway/${id}/stage/${currentStageIndex}/resource/${resource_id}?assessment=1`);
  };

  if (loading || !dashboardData) {
    return (
      <GlassDashboardShell contentClassName="max-w-6xl">
        <div className="flex justify-center items-center py-20 text-gray-400">
          <FiLoader className="animate-spin text-3xl mr-3" /> Loading standalone skills tracker...
        </div>
      </GlassDashboardShell>
    );
  }

  if (error) {
    return (
      <GlassDashboardShell contentClassName="max-w-6xl">
         <div className="bg-red-900/30 border border-red-700/50 p-6 rounded-lg text-red-200">
          <div className="flex items-center"><FiAlertTriangle className="mr-3 text-2xl"/> {error}</div>
          <button onClick={() => navigate('/skills')} className="mt-4 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700">Back to Skills</button>
        </div>
      </GlassDashboardShell>
    );
  }

  const tracker = stageDetails?.tracker;
  const trackerResources = Array.isArray(tracker?.resources) ? tracker.resources : [];
  const projectPrompt = stageDetails?.project_prompt;

  return (
    <GlassDashboardShell contentClassName="max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
         <h1 className="text-3xl font-bold text-white">{dashboardData.pathway_details?.title || 'Skill Pathway'}</h1>
         <div className="flex items-center space-x-4 bg-gray-800/80 px-4 py-2 rounded-xl border border-gray-700/60 shadow-inner">
            <div className="text-gray-400 font-medium">Stage {currentStageIndex} of {dashboardData.pathway_details?.total_stages}</div>
            <div className="w-px h-6 bg-gray-700"></div>
            <div className="text-emerald-400 font-bold flex items-center gap-2"><FiCheckCircle /> {tracker?.status || 'locked'}</div>
         </div>
      </div>
      
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
               <h3 className="text-lg font-semibold text-indigo-200 mb-3">Project Assessment</h3>
               <p className="text-sm text-indigo-300/80 italic">{projectPrompt || "Follow along with the generated resources."}</p>
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