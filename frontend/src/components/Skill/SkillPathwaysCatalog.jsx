import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../services/apiClient';
import { API_ENDPOINTS } from '../../config/api';
import AppBackButton from '../UI/AppBackButton';
import GlassDashboardShell from '../UI/GlassDashboardShell';
import { FiLoader, FiAlertTriangle, FiBookOpen, FiStar, FiCheck, FiArrowRight } from 'react-icons/fi';

const SkillPathwaysCatalog = () => {
  const navigate = useNavigate();
  const [pathways, setPathways] = useState([]);
  const [enrolledIds, setEnrolledIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enrolling, setEnrolling] = useState(null);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      try {
        const [catalogRes, enrolledRes] = await Promise.all([
          apiClient.get(API_ENDPOINTS.PATHWAYS_AVAILABLE),
          apiClient.get(API_ENDPOINTS.PATHWAYS_MY_PROGRESS)
        ]);

        if (catalogRes.status === 'success') {
          setPathways(catalogRes.data || []);
        }

        if (enrolledRes.status === 'success') {
           const myProgress = enrolledRes.data || [];
           setEnrolledIds(myProgress.map(p => p.pathway_id));
        }

      } catch (err) {
        setError(err.message || 'Failed to load skill pathways.');
      } finally {
        setLoading(false);
      }
    };

    fetchCatalog();
  }, []);

  const handleEnroll = async (pathwayId) => {
    setEnrolling(pathwayId);
    try {
      const res = await apiClient.post(API_ENDPOINTS.PATHWAY_ENROLL(pathwayId));
      if (res.status === 'success') {
        navigate(`/skill-pathway/${pathwayId}`);
      }
    } catch (err) {
      alert("Error enrolling: " + err.message);
      setEnrolling(null);
    }
  };

  if (loading) {
    return (
      <GlassDashboardShell contentClassName="max-w-6xl">
        <div className="flex justify-center items-center py-20 text-gray-400">
          <FiLoader className="animate-spin text-3xl mr-3" /> Loading standalone skills catalog...
        </div>
      </GlassDashboardShell>
    );
  }

  if (error) {
    return (
      <GlassDashboardShell contentClassName="max-w-6xl">
        <div className="bg-red-900/30 border border-red-700/50 p-6 rounded-lg text-red-200 flex items-center">
          <FiAlertTriangle className="text-2xl mr-3" /> {error}
        </div>
      </GlassDashboardShell>
    );
  }

  return (
    <GlassDashboardShell contentClassName="max-w-6xl">
      <div className="mb-5">
        <AppBackButton label="Back to Dashboard" fallbackTo="/dashboard" />
      </div>

      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 inline-block">Skill Pathways Catalog</h1>
        <p className="text-gray-300 max-w-2xl mx-auto text-lg leading-relaxed">
          Embark on highly specialized, AI-driven learning journeys independent of your classroom. Master topics through personalized content generation, hands-on tests, and curated learning nodes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {pathways.map((pathway, index) => {
          const pathwayId = String(pathway?._id || pathway?.id || '').trim();
          if (!pathwayId) {
            return null;
          }

          const isEnrolled = enrolledIds.includes(pathwayId);
          const totalStages = Number(pathway?.total_stages) || (Array.isArray(pathway?.stages) ? pathway.stages.length : 0);

          return (
            <div key={pathwayId || `pathway-${index}`} className="bg-gradient-to-b from-gray-800 to-gray-900 border border-gray-700 rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-indigo-500/10 hover:border-indigo-500/30 transition-all flex flex-col h-full group">
              <div className="h-32 bg-gradient-to-br from-indigo-900/60 to-purple-900/60 border-b border-gray-700/60 relative p-6 flex flex-col justify-end">
                <FiStar className="absolute top-4 right-4 text-indigo-300 opacity-50 text-2xl group-hover:opacity-100 transition-opacity" />
                <span className="inline-block px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-xs font-semibold text-indigo-300 max-w-max uppercase tracking-wider">
                  Self-Paced
                </span>
              </div>
              
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-2xl font-bold text-white mb-3 group-hover:text-indigo-400 transition-colors">{pathway.title}</h3>
                <p className="text-gray-400 text-sm mb-6 flex-1 line-clamp-4">{pathway.description}</p>
                
                <div className="bg-gray-800/80 rounded-xl p-4 mb-6 border border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-gray-300 mb-2">
                    <FiBookOpen className="text-indigo-400" />
                    <span className="font-medium">{totalStages} Mastery Stages</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mt-3">
                    <div className="bg-indigo-500 h-1.5 rounded-full w-1/3"></div>
                  </div>
                </div>

                {isEnrolled ? (
                  <button 
                    onClick={() => navigate(`/skill-pathway/${pathwayId}`)}
                    className="w-full py-3 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors font-semibold flex items-center justify-center"
                  >
                    <FiCheck className="mr-2 text-emerald-400" /> Currently Enrolled
                  </button>
                ) : (
                  <button 
                    onClick={() => handleEnroll(pathwayId)}
                    disabled={enrolling === pathwayId}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] font-bold shadow-lg shadow-indigo-600/20 flex items-center justify-center"
                  >
                    {enrolling === pathwayId ? (
                      <><FiLoader className="animate-spin mr-2" /> Enrolling...</>
                    ) : (
                      <>Enroll & Begin <FiArrowRight className="ml-2" /></>
                    )}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {pathways.length === 0 && (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 rounded-2xl border border-dashed border-gray-700 bg-gray-900/40 p-10 text-center">
            <p className="text-gray-300 text-lg font-semibold">No skill pathways available yet</p>
            <p className="text-gray-400 mt-2 text-sm">Pathway templates may still be seeding. Please refresh in a moment.</p>
          </div>
        )}
      </div>
    </GlassDashboardShell>
  );
};

export default SkillPathwaysCatalog;