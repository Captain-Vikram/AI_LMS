import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IoCheckmarkCircleOutline,
  IoLockClosedOutline,
  IoPlayCircleOutline,
  IoSchoolOutline,
} from "react-icons/io5";
import apiClient from "../../services/apiClient";
import { API_ENDPOINTS } from "../../config/api";
import StudentAssessmentTaker from "./StudentAssessmentTaker";

const getModuleId = (module) => String(module?.module_id || module?._id || "").trim();
const getResourceId = (resource) => String(resource?.id || resource?.resource_id || "").trim();

const getProgressByResource = (progressResources = []) => {
  const map = new Map();
  progressResources.forEach((item) => {
    if (item?.resource_id) {
      map.set(item.resource_id, item);
    }
  });
  return map;
};

const resolveStatus = (resourceProgress, index) => {
  if (resourceProgress?.status) {
    return resourceProgress.status;
  }
  return index === 0 ? "unlocked" : "locked";
};

const LearningModulesStudent = ({ classroomId, modules = [] }) => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentId, setStudentId] = useState("");
  const [progressByModule, setProgressByModule] = useState({});
  const [refreshTick, setRefreshTick] = useState(0);

  const [activeAssessment, setActiveAssessment] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadProgress = async () => {
      if (!classroomId || modules.length === 0) return;

      setLoading(true);
      setError("");

      try {
        const profile = await apiClient.get(API_ENDPOINTS.AUTH_USER_PROFILE);
        const resolvedStudentId = String(
          profile?.user_id || profile?.id || profile?._id || ""
        ).trim();

        if (!resolvedStudentId) {
          throw new Error("Unable to determine student identity");
        }

        if (!isMounted) return;

        setStudentId(resolvedStudentId);

        const payload = await Promise.all(
          modules.map(async (module) => {
            const moduleId = getModuleId(module);
            if (!moduleId) return ["", null];

            const progress = await apiClient.get(
              `/api/student/progress/${moduleId}?student_id=${encodeURIComponent(
                resolvedStudentId
              )}&classroom_id=${encodeURIComponent(classroomId)}`
            );

            return [moduleId, progress];
          })
        );

        if (!isMounted) return;

        const mapped = {};
        payload.forEach(([moduleId, progress]) => {
          if (moduleId) {
            mapped[moduleId] = progress;
          }
        });

        setProgressByModule(mapped);
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load student progress");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProgress();

    return () => {
      isMounted = false;
    };
  }, [classroomId, modules, refreshTick]);

  const orderedModules = useMemo(
    () =>
      [...modules].sort((first, second) => Number(first?.order || 0) - Number(second?.order || 0)),
    [modules]
  );

  const openResource = (moduleId, resourceId, status) => {
    if (status === "locked") return;
    navigate(`/classroom/${classroomId}/modules/${moduleId}/learn/${resourceId}`);
  };

  const launchAssessment = (moduleId, assessmentId) => {
    if (!assessmentId || !studentId) return;
    setActiveAssessment({ moduleId, assessmentId });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      
      {/* ── Glassmorphic Header Banner ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-[#0B0F19] to-cyan-950/30 p-8 shadow-[0_0_40px_rgba(6,182,212,0.1)] backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-600/10 blur-3xl" />
        
        <h2 className="font-['Poppins',sans-serif] flex items-center gap-3 text-2xl font-bold tracking-wide text-cyan-50">
          <IoSchoolOutline className="text-3xl text-cyan-400" />
          Student Learning Flow
        </h2>
        <p className="font-['Inter',sans-serif] mt-2 max-w-2xl text-sm leading-relaxed text-cyan-100/70">
          Complete each resource in order. Pass 2 quizzes with at least 80% to unlock the next lesson. Your journey is tracked in real-time.
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-t-2 border-cyan-400"></div>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-5 text-sm font-medium text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.1)]">
          {error}
        </p>
      )}

      {/* ── Modules List ──────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        {orderedModules.map((module) => {
          const moduleId = getModuleId(module);
          const progress = progressByModule[moduleId] || {};
          const resources = Array.isArray(module?.resources) ? [...module.resources] : [];
          resources.sort((first, second) => Number(first?.order || 0) - Number(second?.order || 0));

          const progressMap = getProgressByResource(progress?.resources || []);
          const completedCount = resources.filter((resource, index) => {
            const status = resolveStatus(progressMap.get(getResourceId(resource)), index);
            return status === "completed";
          }).length;

          const assessment = progress?.final_assessment || {};
          const canTakeFinal = assessment?.published && completedCount === resources.length && resources.length > 0;

          return (
            <article 
              key={moduleId} 
              className="group relative overflow-hidden rounded-3xl border border-white/5 bg-[#0A0D14]/80 p-7 shadow-xl backdrop-blur-2xl transition-all duration-300 hover:border-white/10"
            >
              {/* Module Header */}
              <div className="mb-6 border-b border-white/5 pb-5">
                <h3 className="font-['Poppins',sans-serif] text-xl font-semibold tracking-wide text-gray-100">
                  {module.name || module.title || "Untitled Module"}
                </h3>
                <p className="font-['Inter',sans-serif] mt-1.5 text-sm text-gray-400">
                  {module.description || "Complete the lessons below to unlock the final assessment."}
                </p>
              </div>

              {/* Resources Path */}
              <div className="space-y-3">
                {resources.map((resource, index) => {
                  const resourceId = getResourceId(resource);
                  const resourceProgress = progressMap.get(resourceId);
                  const status = resolveStatus(resourceProgress, index);

                  // Neon status themes
                  const isCompleted = status === "completed";
                  const isLocked = status === "locked";
                  const isActive = status === "in_progress" || status === "unlocked";

                  const themeClasses = isCompleted
                    ? "border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50 hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                    : isActive
                    ? "border-cyan-500/40 bg-cyan-500/10 hover:border-cyan-400/60 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                    : "border-white/5 bg-white/[0.02] opacity-60 grayscale-[50%]";

                  const iconColor = isCompleted ? "text-emerald-400" : isActive ? "text-cyan-400" : "text-gray-500";

                  return (
                    <div
                      key={resourceId || index}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border px-5 py-4 transition-all duration-300 ${themeClasses}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#0A0D14] shadow-inner ${iconColor}`}>
                          {isCompleted ? <IoCheckmarkCircleOutline size={20} /> : isLocked ? <IoLockClosedOutline size={20} /> : <IoPlayCircleOutline size={20} />}
                        </div>
                        <div>
                          <p className="font-['Inter',sans-serif] text-sm font-medium text-gray-200">
                            {resource.title || "Resource material"}
                          </p>
                          <p className="font-mono mt-1 text-[10px] uppercase tracking-widest text-gray-500">
                            Passed Quizzes: {Number(resourceProgress?.passed_tests_count || 0)}/2
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openResource(moduleId, resourceId, status)}
                        disabled={isLocked}
                        className={`font-['Poppins',sans-serif] shrink-0 rounded-xl px-5 py-2 text-xs font-semibold tracking-wide transition-all ${
                          isLocked
                            ? "cursor-not-allowed bg-gray-800 text-gray-500"
                            : isActive
                            ? "bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        }`}
                      >
                        {isLocked ? "LOCKED" : "OPEN LESSON"}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Final Assessment Gate */}
              <div className={`mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border p-5 backdrop-blur-md transition-all ${
                canTakeFinal || assessment?.status === "completed" 
                  ? "border-indigo-500/40 bg-indigo-500/10 hover:shadow-[0_0_25px_rgba(99,102,241,0.2)]" 
                  : "border-white/5 bg-[#0B0F19]/50"
              }`}>
                <div>
                  <p className="font-['Poppins',sans-serif] text-sm font-bold tracking-wide text-indigo-300">
                    FINAL MODULE ASSESSMENT
                  </p>
                  <p className="font-['Inter',sans-serif] mt-1 text-xs text-gray-400">
                    {assessment?.status === "completed"
                      ? "Module completed successfully."
                      : assessment?.published
                      ? "Complete all resources first to unlock."
                      : "Coming soon. Teacher has not published."}
                  </p>
                </div>

                {assessment?.status === "completed" ? (
                  <span className="font-mono rounded-lg bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400 border border-emerald-500/20">
                    SCORE: {Math.round(Number(assessment?.score || 0) * 100)}%
                  </span>
                ) : canTakeFinal ? (
                  <button
                    type="button"
                    onClick={() => launchAssessment(moduleId, assessment.assessment_id)}
                    className="font-['Poppins',sans-serif] shrink-0 rounded-xl bg-indigo-600 px-6 py-2.5 text-xs font-bold tracking-widest text-white shadow-[0_0_15px_rgba(79,70,229,0.5)] transition-colors hover:bg-indigo-500"
                  >
                    START TEST
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {activeAssessment && (
        <StudentAssessmentTaker
          assessmentId={activeAssessment.assessmentId}
          studentId={studentId}
          onClose={() => setActiveAssessment(null)}
          onSubmitted={() => {
            setActiveAssessment(null);
            setRefreshTick((value) => value + 1);
          }}
        />
      )}
    </div>
  );
};

export default LearningModulesStudent;