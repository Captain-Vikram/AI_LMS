import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IoArrowBackOutline,
  IoCheckmarkCircleOutline,
  IoLockClosedOutline,
  IoPulseOutline,
} from "react-icons/io5";
import apiClient from "../../services/apiClient";

const getModuleId = (module) => String(module?.module_id || module?._id || "").trim();

const getStatusMeta = (status) => {
  switch (status) {
    case "completed":
      return {
        label: "Completed",
        className: "text-emerald-300",
        icon: IoCheckmarkCircleOutline,
      };
    case "in_progress":
      return {
        label: "In Progress",
        className: "text-amber-300",
        icon: IoPulseOutline,
      };
    case "unlocked":
      return {
        label: "Unlocked",
        className: "text-cyan-300",
        icon: IoPulseOutline,
      };
    default:
      return {
        label: "Locked",
        className: "text-rose-300",
        icon: IoLockClosedOutline,
      };
  }
};

const StudentProgressTimeline = () => {
  const navigate = useNavigate();
  const { id: classroomId, studentId } = useParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [studentName, setStudentName] = useState("Student");
  const [timeline, setTimeline] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadTimeline = async () => {
      if (!classroomId || !studentId) return;

      setLoading(true);
      setError("");

      try {
        const [rosterResponse, modulesResponse] = await Promise.all([
          apiClient.get(`/api/classroom/${classroomId}/members`),
          apiClient.get(`/api/classroom/${classroomId}/modules`),
        ]);

        if (!isMounted) return;

        const rosterStudents = Array.isArray(rosterResponse?.data?.students)
          ? rosterResponse.data.students
          : Array.isArray(rosterResponse?.students)
            ? rosterResponse.students
            : [];

        const selectedStudent = rosterStudents.find(
          (student) => String(student?.user_id || student?.id || "") === String(studentId)
        );
        setStudentName(selectedStudent?.name || "Student");

        const modules = Array.isArray(modulesResponse?.modules)
          ? modulesResponse.modules
          : Array.isArray(modulesResponse?.data)
            ? modulesResponse.data
            : [];

        const sortedModules = [...modules].sort(
          (first, second) => Number(first?.order || 0) - Number(second?.order || 0)
        );

        const progressPayload = await Promise.all(
          sortedModules.map(async (module) => {
            const moduleId = getModuleId(module);
            if (!moduleId) return null;

            const progress = await apiClient.get(
              `/api/student/progress/${moduleId}?student_id=${encodeURIComponent(
                studentId
              )}&classroom_id=${encodeURIComponent(classroomId)}`
            );

            return {
              module,
              moduleId,
              progress,
            };
          })
        );

        if (!isMounted) return;

        setTimeline(progressPayload.filter(Boolean));
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load student timeline");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadTimeline();

    return () => {
      isMounted = false;
    };
  }, [classroomId, studentId]);

  const overallCompletion = useMemo(() => {
    if (timeline.length === 0) return 0;

    const ratios = timeline.map((item) => {
      const resources = Array.isArray(item?.progress?.resources) ? item.progress.resources : [];
      if (resources.length === 0) return 0;

      const completed = resources.filter((resource) => resource.status === "completed").length;
      return completed / resources.length;
    });

    const average = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
    return Math.round(average * 100);
  }, [timeline]);

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 text-gray-200">
        <p>Loading student timeline...</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-5 px-4 py-8">
      <header className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
        <button
          type="button"
          onClick={() => navigate(`/classroom/${classroomId}/roster`)}
          className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200"
        >
          <IoArrowBackOutline />
          Back to Roster
        </button>
        <h1 className="mt-2 text-2xl font-semibold text-gray-100">{studentName} - Progress Timeline</h1>
        <p className="mt-1 text-sm text-gray-400">Overall completion: {overallCompletion}%</p>
      </header>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {timeline.map((entry) => {
        const module = entry.module || {};
        const progress = entry.progress || {};
        const resources = Array.isArray(progress.resources) ? progress.resources : [];

        return (
          <article
            key={entry.moduleId}
            className="rounded-xl border border-gray-700 bg-gray-900/60 p-4"
          >
            <h2 className="text-lg font-semibold text-gray-100">{module.name || module.title || "Module"}</h2>
            <p className="mt-1 text-sm text-gray-400">{module.description || "No description"}</p>

            <div className="mt-3 space-y-2">
              {resources.map((resource) => {
                const meta = getStatusMeta(resource.status);
                const Icon = meta.icon;
                return (
                  <div
                    key={resource.resource_id}
                    className="rounded-lg border border-gray-700 bg-gray-950/60 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-gray-100">{resource.resource_title}</p>
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${meta.className}`}>
                        <Icon /> {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Tests: {resource.tests_taken || 0} • Passed: {resource.passed_tests_count || 0}/2
                      {resource.highest_score != null ? ` • Best score: ${Math.round(Number(resource.highest_score) * 100)}%` : ""}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-100">
              Final Assessment: {progress?.final_assessment?.status || "coming_soon"}
            </div>
          </article>
        );
      })}

      {timeline.length === 0 && !error ? (
        <p className="rounded-lg border border-dashed border-gray-700 px-4 py-5 text-sm text-gray-400">
          No module progress data available for this student yet.
        </p>
      ) : null}
    </section>
  );
};

export default StudentProgressTimeline;
