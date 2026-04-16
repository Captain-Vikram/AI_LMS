import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  IoArrowForwardOutline,
  IoCheckmarkCircleOutline,
  IoGridOutline,
  IoLinkOutline,
  IoLogoYoutube,
  IoRefreshOutline,
  IoSparklesOutline,
} from "react-icons/io5";

import { useClassroomResources } from "../../hooks/useClassroom";
import { ErrorState, LoadingState } from "../../components/Classroom/DashboardCard";
import GlassDashboardShell from "../../components/UI/GlassDashboardShell";

const statusClassName = {
  approved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  pending: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  rejected: "bg-rose-500/20 text-rose-300 border-rose-500/40",
};

const DEFAULT_SKILL_LIMIT = 6;

const normalizeWhitespace = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "");

const toPreviewText = (value, maxChars = 220) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return { text: "No description provided.", isTruncated: false };
  }

  if (normalized.length <= maxChars) {
    return { text: normalized, isTruncated: false };
  }

  return {
    text: `${normalized.slice(0, maxChars).trimEnd()}...`,
    isTruncated: true,
  };
};

const normalizeUrl = (urlValue) => {
  if (!urlValue) return "";
  
  // Handle case where URL is a string representation of a Python list like "['https://...']"
  let url = urlValue;
  if (typeof url === "string" && url.startsWith("[") && url.endsWith("]")) {
    try {
      const parsed = JSON.parse(url.replace(/'/g, '"'));
      if (Array.isArray(parsed) && parsed.length > 0) {
        url = parsed[0];
      }
    } catch {
      // If parsing fails, try regex extraction
      const match = url.match(/https?:\/\/[^\s'"]+/);
      if (match) {
        url = match[0];
      }
    }
  }
  
  return String(url || "").trim();
};

const getSourceLabel = (url) => {
  if (!url || typeof url !== "string") return "";

  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
};

const ClassroomResources = () => {
  const { id: classroomId } = useParams();
  const navigate = useNavigate();

  const userRole = (localStorage.getItem("userRole") || "student").toLowerCase();
  const isTeacher = userRole === "teacher" || userRole === "admin";

  const [studentMode, setStudentMode] = useState("class");
  const [expandedSkill, setExpandedSkill] = useState(null);
  const [showAllBySkill, setShowAllBySkill] = useState({});
  const [expandedResource, setExpandedResource] = useState({});
  const [actingResourceId, setActingResourceId] = useState(null);
  const [actionError, setActionError] = useState("");

  const activeMode = isTeacher ? "class" : studentMode;

  const {
    resourcePayload,
    resources,
    summary,
    loading,
    error,
    approveResource,
    refresh,
  } = useClassroomResources(classroomId, activeMode);

  const groupedResources = useMemo(() => {
    const grouped = new Map();

    for (const item of resources || []) {
      const skill = (item?.module_name || item?.skill || "General").trim() || "General";
      if (!grouped.has(skill)) {
        grouped.set(skill, []);
      }
      grouped.get(skill).push(item);
    }

    return Array.from(grouped.entries());
  }, [resources]);

  useEffect(() => {
    if (!expandedSkill && groupedResources.length > 0) {
      setExpandedSkill(groupedResources[0][0]);
    }
  }, [expandedSkill, groupedResources]);

  const toggleShowAllForSkill = (skill) => {
    setShowAllBySkill((prev) => ({
      ...prev,
      [skill]: !prev[skill],
    }));
  };

  const toggleResourceExpansion = (resourceId) => {
    setExpandedResource((prev) => ({
      ...prev,
      [resourceId]: !prev[resourceId],
    }));
  };

  const handleApproval = async (resourceId, approved) => {
    setActionError("");
    setActingResourceId(resourceId);

    try {
      await approveResource(resourceId, approved);
    } catch (err) {
      setActionError(err?.message || "Failed to update resource status");
    } finally {
      setActingResourceId(null);
    }
  };

  if (loading) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <LoadingState message="Loading classroom resources..." />
      </GlassDashboardShell>
    );
  }

  if (error) {
    return (
      <GlassDashboardShell contentClassName="max-w-7xl">
        <ErrorState message={error} onRetry={() => refresh(activeMode)} />
      </GlassDashboardShell>
    );
  }

  return (
    <GlassDashboardShell contentClassName="max-w-7xl">
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-700/70 bg-gradient-to-r from-slate-900 via-gray-900 to-slate-800 p-6 shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-cyan-300">
                {isTeacher ? "Teacher Resource Review" : "Student Resource Hub"}
              </p>
              <h1 className="mt-2 text-3xl font-bold text-gray-100">Classroom Resources</h1>
              <p className="mt-2 text-sm text-gray-300">
                Curated resources by skill with compact previews and quick teacher review actions.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => refresh(activeMode)}
                className="inline-flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2 text-sm text-white hover:bg-gray-600"
              >
                <IoRefreshOutline />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => navigate(`/classroom/${classroomId}/dashboard`)}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm text-white hover:bg-cyan-500"
              >
                <IoGridOutline />
                Dashboard
              </button>
            </div>
          </div>
        </div>

        {!isTeacher && (
          <div className="flex justify-center">
            <div className="bg-gray-700/50 rounded-lg p-1 flex">
              <button
                type="button"
                className={`px-4 py-2 rounded-md flex items-center ${
                  activeMode === "class" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"
                }`}
                onClick={() => setStudentMode("class")}
              >
                <IoCheckmarkCircleOutline className="mr-2" />
                Class Mode
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-md flex items-center ${
                  activeMode === "personal" ? "bg-blue-600 text-white" : "text-gray-300 hover:text-white"
                }`}
                onClick={() => setStudentMode("personal")}
              >
                <IoSparklesOutline className="mr-2" />
                Personal Mode
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
            <p className="text-xs text-gray-400">Total</p>
            <p className="text-xl font-semibold text-cyan-300">{summary.total || 0}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
            <p className="text-xs text-gray-400">Approved</p>
            <p className="text-xl font-semibold text-emerald-300">{summary.approved || 0}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
            <p className="text-xs text-gray-400">Pending</p>
            <p className="text-xl font-semibold text-amber-300">{summary.pending || 0}</p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-3">
            <p className="text-xs text-gray-400">Rejected</p>
            <p className="text-xl font-semibold text-rose-300">{summary.rejected || 0}</p>
          </div>
        </div>

        {resourcePayload?.message && (
          <div className="rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">
            {resourcePayload.message}
          </div>
        )}

        {actionError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {actionError}
          </div>
        )}

        {groupedResources.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-600 p-8 text-center text-gray-400">
            No resources available yet for this mode.
          </div>
        ) : (
          <div className="space-y-6">
            {groupedResources.map(([skill, items], skillIndex) => (
              <div key={`${skill}-${skillIndex}`} className="border border-gray-700 rounded-xl overflow-hidden">
                {(() => {
                  const pendingCount = items.filter(
                    (item) => (item?.approval_status || "pending") === "pending"
                  ).length;

                  return (
                <button
                  type="button"
                  className="w-full bg-gray-700/50 p-4 flex items-center justify-between text-left"
                  onClick={() => setExpandedSkill(expandedSkill === skill ? null : skill)}
                >
                  <div>
                    <h3 className="text-lg font-medium text-white">{skill}</h3>
                    <p className="text-sm text-gray-400">
                      {items.length} resources
                      {pendingCount > 0 ? ` • ${pendingCount} pending` : ""}
                    </p>
                  </div>
                  <span className="text-blue-300">
                    {expandedSkill === skill ? "Hide" : "Show"}
                  </span>
                </button>
                  );
                })()}

                {expandedSkill === skill && (
                  <div className="bg-gray-800/70 p-4">
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {(showAllBySkill[skill] ? items : items.slice(0, DEFAULT_SKILL_LIMIT)).map((item) => {
                      const status = item?.approval_status || "pending";
                      const isProcessing = actingResourceId === item.resource_id;
                      const normalizedUrl = normalizeUrl(item?.url);
                      const sourceLabel = getSourceLabel(normalizedUrl);
                      const titlePreview = toPreviewText(item?.title, 120).text;
                      const descriptionPreview = toPreviewText(item?.description, 220);
                      const showFullDescription = !!expandedResource[item.resource_id] && descriptionPreview.isTruncated;

                      return (
                        <div
                          key={item.resource_id}
                          className="rounded-lg border border-gray-600/50 bg-gray-900/60 p-4 flex flex-col"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="font-medium text-white leading-snug">{titlePreview}</h4>
                            <span
                              className={`text-[11px] uppercase tracking-wide px-2 py-1 rounded border ${
                                statusClassName[status] || statusClassName.pending
                              }`}
                            >
                              {status}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <span className="inline-flex items-center gap-1 rounded-full border border-gray-600/80 bg-gray-800/80 px-2.5 py-1 text-gray-200">
                              {item.resource_type === "youtube" ? <IoLogoYoutube /> : <IoLinkOutline />}
                              {item.resource_type || "resource"}
                            </span>
                            {sourceLabel && (
                              <span className="rounded-full border border-gray-600/70 bg-gray-900/70 px-2.5 py-1 text-gray-300">
                                {sourceLabel}
                              </span>
                            )}
                          </div>

                          <div className="mt-3 flex-1">
                            {showFullDescription ? (
                              <div className="max-h-36 overflow-y-auto rounded-md border border-gray-700/80 bg-gray-950/60 p-3 text-sm text-gray-300 leading-relaxed">
                                {normalizeWhitespace(item?.description)}
                              </div>
                            ) : (
                              <p className="text-sm text-gray-300 leading-relaxed">{descriptionPreview.text}</p>
                            )}

                            {descriptionPreview.isTruncated && (
                              <button
                                type="button"
                                onClick={() => toggleResourceExpansion(item.resource_id)}
                                className="mt-2 text-xs font-medium text-cyan-300 hover:text-cyan-200"
                              >
                                {showFullDescription ? "Show less" : "Show full description"}
                              </button>
                            )}
                          </div>

                          <div className="mt-4 border-t border-gray-700/70 pt-3 flex flex-wrap gap-2">
                            {normalizedUrl ? (
                              <a
                                href={normalizedUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm inline-flex items-center"
                              >
                                Open Resource
                                <IoArrowForwardOutline className="ml-1" />
                              </a>
                            ) : null}

                            {isTeacher && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApproval(item.resource_id, true)}
                                  disabled={isProcessing || status === "approved"}
                                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm disabled:opacity-60"
                                >
                                  {isProcessing ? "Saving..." : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleApproval(item.resource_id, false)}
                                  disabled={isProcessing || status === "rejected"}
                                  className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-sm disabled:opacity-60"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    </div>

                    {items.length > DEFAULT_SKILL_LIMIT && (
                      <div className="mt-4 flex justify-center">
                        <button
                          type="button"
                          onClick={() => toggleShowAllForSkill(skill)}
                          className="rounded-md border border-gray-600 bg-gray-900/60 px-3 py-2 text-sm text-gray-200 hover:border-cyan-500/60 hover:text-cyan-200"
                        >
                          {showAllBySkill[skill]
                            ? `Show fewer resources`
                            : `Show all ${items.length} resources`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </GlassDashboardShell>
  );
};

export default ClassroomResources;
