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
    if (status === "locked") {
      return;
    }
    navigate(`/classroom/${classroomId}/modules/${moduleId}/learn/${resourceId}`);
  };

  const launchAssessment = (moduleId, assessmentId) => {
    if (!assessmentId || !studentId) return;
    setActiveAssessment({ moduleId, assessmentId });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-5">
        <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-cyan-100">
          <IoSchoolOutline />
          Student Learning Flow
        </h2>
        <p className="mt-1 text-sm text-cyan-100/80">
          Complete each resource in order. Pass 2 quizzes with at least 80% to unlock the next resource.
        </p>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading module progress...</p> : null}

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

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
        const canTakeFinal =
          assessment?.published && completedCount === resources.length && resources.length > 0;

        return (
          <article key={moduleId} className="rounded-xl border border-gray-700 bg-gray-900/60 p-5">
            <h3 className="text-lg font-semibold text-gray-100">{module.name || module.title || "Module"}</h3>
            <p className="mt-1 text-sm text-gray-400">{module.description || "No module description"}</p>

            <div className="mt-4 space-y-2">
              {resources.map((resource, index) => {
                const resourceId = getResourceId(resource);
                const resourceProgress = progressMap.get(resourceId);
                const status = resolveStatus(resourceProgress, index);

                return (
                  <div
                    key={resourceId || index}
                    className="rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-gray-100">{resource.title || "Resource"}</p>
                        <p className="mt-1 text-xs text-gray-400">
                          Passed quizzes: {Number(resourceProgress?.passed_tests_count || 0)}/2
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                            status === "completed"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : status === "in_progress" || status === "unlocked"
                                ? "bg-cyan-500/20 text-cyan-300"
                                : "bg-rose-500/20 text-rose-300"
                          }`}
                        >
                          {status === "completed" ? (
                            <IoCheckmarkCircleOutline />
                          ) : status === "locked" ? (
                            <IoLockClosedOutline />
                          ) : (
                            <IoPlayCircleOutline />
                          )}
                          {status.replace("_", " ")}
                        </span>
                        <button
                          type="button"
                          onClick={() => openResource(moduleId, resourceId, status)}
                          disabled={status === "locked"}
                          className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
                        >
                          {status === "locked" ? "Locked" : "Open Lesson"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-3">
              <p className="text-sm font-medium text-blue-100">Final Module Assessment</p>
              {assessment?.status === "completed" ? (
                <p className="mt-1 text-sm text-emerald-200">
                  Completed. Score: {Math.round(Number(assessment?.score || 0) * 100)}%
                </p>
              ) : canTakeFinal ? (
                <button
                  type="button"
                  onClick={() => launchAssessment(moduleId, assessment.assessment_id)}
                  className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  Take Final Assessment
                </button>
              ) : (
                <p className="mt-1 text-sm text-blue-100/80">
                  {assessment?.published
                    ? "Complete all resources first to unlock the final assessment."
                    : "Coming soon. Your teacher has not published this assessment yet."}
                </p>
              )}
            </div>
          </article>
        );
      })}

      {activeAssessment ? (
        <StudentAssessmentTaker
          assessmentId={activeAssessment.assessmentId}
          studentId={studentId}
          onClose={() => setActiveAssessment(null)}
          onSubmitted={() => {
            setActiveAssessment(null);
            setRefreshTick((value) => value + 1);
          }}
        />
      ) : null}
    </div>
  );
};

export default LearningModulesStudent;
