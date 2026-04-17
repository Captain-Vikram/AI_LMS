import React, { useEffect, useMemo, useState } from "react";
import {
  IoCheckmarkCircleOutline,
  IoChatbubbleEllipsesOutline,
  IoCloseCircleOutline,
  IoDocumentTextOutline,
  IoDocumentOutline,
  IoFlashOutline,
  IoTimeOutline,
} from "react-icons/io5";
import apiClient from "../../services/apiClient";

const actionMeta = {
  quiz_passed: {
    icon: IoCheckmarkCircleOutline,
    color: "text-emerald-300",
    label: "passed a quiz",
  },
  quiz_failed: {
    icon: IoCloseCircleOutline,
    color: "text-rose-300",
    label: "attempted a quiz",
  },
  resource_unlocked: {
    icon: IoFlashOutline,
    color: "text-cyan-300",
    label: "unlocked a new resource",
  },
  ai_question_asked: {
    icon: IoChatbubbleEllipsesOutline,
    color: "text-blue-300",
    label: "asked an AI question",
  },
  assessment_submitted: {
    icon: IoDocumentOutline,
    color: "text-amber-300",
    label: "submitted an assessment",
  },
  assessment_graded: {
    icon: IoDocumentTextOutline,
    color: "text-purple-300",
    label: "received graded feedback",
  },
};

const formatTime = (isoValue) => {
  if (!isoValue) return "Unknown time";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
};

const buildMessage = (item) => {
  const meta = actionMeta[item.action_type] || {
    label: item.action_type || "performed an action",
  };

  const studentName = item.student_name || "A student";
  const score = item.details?.score;

  if (item.action_type === "quiz_passed" && typeof score === "number") {
    return `${studentName} passed a quiz (${score.toFixed(1)}%).`;
  }

  if (item.action_type === "quiz_failed" && typeof score === "number") {
    return `${studentName} scored ${score.toFixed(1)}% on a quiz attempt.`;
  }

  if (item.action_type === "ai_question_asked" && item.details?.question) {
    return `${studentName} asked: "${item.details.question}"`;
  }

  return `${studentName} ${meta.label}.`;
};

const ActivityFeed = ({ classroomId, limit = 10, compact = false }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const fetchFeed = async () => {
      if (!classroomId) return;

      setLoading(true);
      setError("");

      try {
        const response = await apiClient.get(
          `/api/classroom/${classroomId}/activity-feed?limit=${limit}`
        );

        if (!isMounted) return;

        const nextItems = Array.isArray(response?.items) ? response.items : [];
        setItems(nextItems);
      } catch (err) {
        if (!isMounted) return;
        setError(err?.message || "Failed to load activity feed");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchFeed();
    const interval = setInterval(fetchFeed, 20000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [classroomId, limit]);

  const preparedItems = useMemo(
    () =>
      items.map((item) => {
        const meta = actionMeta[item.action_type] || {
          icon: IoTimeOutline,
          color: "text-gray-300",
          label: item.action_type || "activity",
        };

        return {
          ...item,
          meta,
          message: buildMessage(item),
        };
      }),
    [items]
  );

  if (loading && items.length === 0) {
    return <p className="text-sm text-gray-400">Loading activity feed...</p>;
  }

  if (error && items.length === 0) {
    return (
      <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
        {error}
      </p>
    );
  }

  if (preparedItems.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        No activity yet. Student quiz attempts and AI interactions will appear here.
      </p>
    );
  }

  return (
    <div className={`space-y-2 ${compact ? "max-h-56 overflow-y-auto" : "max-h-96 overflow-y-auto"}`}>
      {preparedItems.map((item) => {
        const Icon = item.meta.icon;
        return (
          <article
            key={item.id}
            className="rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2"
          >
            <div className="flex items-start gap-2">
              <Icon className={`mt-0.5 ${item.meta.color}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-100">{item.message}</p>
                <p className="mt-1 text-xs text-gray-400">{formatTime(item.created_at)}</p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default ActivityFeed;
