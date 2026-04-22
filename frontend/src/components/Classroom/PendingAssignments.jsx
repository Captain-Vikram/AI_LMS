import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

export const PendingAssignments = ({ assignments = [], loading = false }) => {
  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-700 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No pending assignments</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {assignments.map((assignment, idx) => {
        const dueDate = assignment?.due_date ? new Date(assignment.due_date) : null;
        const hasValidDueDate = !!dueDate && !Number.isNaN(dueDate.getTime());
        const isOverdue = hasValidDueDate ? dueDate < new Date() : false;
        const isSubmitted = assignment.submission_status?.submitted || false;
        const assignmentKey =
          assignment.assignment_id ||
          assignment._id ||
          `${assignment?.title || 'assignment'}-${idx}`;
        const points = Number(assignment?.points ?? assignment?.total_points ?? 0);
        
        return (
          <div
            key={assignmentKey}
            className={`p-3 rounded-lg border transition-colors ${
              isOverdue
                ? 'bg-red-500/10 border-red-500/20'
                : 'bg-gray-800 border-gray-700 hover:border-blue-500'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-medium text-gray-100">{assignment.title || 'Assignment'}</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Due{' '}
                  {hasValidDueDate
                    ? formatDistanceToNow(dueDate, {
                        addSuffix: true,
                      })
                    : 'No due date'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-yellow-400">
                  {points}pts
                </span>
                {isSubmitted && (
                  <div className="text-xs mt-1">
                    {assignment.submission_status?.score !== null ? (
                      <span className="text-green-400">
                        Score: {assignment.submission_status.score}
                      </span>
                    ) : (
                      <span className="text-blue-400">Submitted</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {!isSubmitted && (
              <div className="text-xs text-orange-400">Not yet submitted</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const SubmissionList = ({ submissions = [], loading = false }) => {
  const [displayLimit, setDisplayLimit] = useState(3);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-700 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (!submissions || submissions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No submissions</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {submissions.slice(0, displayLimit).map((submission, idx) => (
        <div
          key={`${submission.assignment_id || 'sub'}-${idx}`}
          className="p-3 rounded-lg bg-gray-800 border border-gray-700 hover:border-emerald-500/50 transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h4 className="font-medium text-gray-100">
                {submission.assignment_title || 'Assignment'}
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                Submitted{' '}
                {formatDistanceToNow(new Date(submission.submitted_date), {
                  addSuffix: true,
                })}
              </p>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${
              submission.status === 'graded'
                ? 'bg-green-500/20 text-green-400'
                : submission.status === 'submitted'
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {submission.status}
            </span>
          </div>
        </div>
      ))}

      {submissions.length > displayLimit && (
        <div className="pt-2 text-center">
          <button
            onClick={() => setDisplayLimit((prev) => prev + 5)}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 px-4 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors shadow-sm active:scale-95"
          >
            Show {Math.min(5, submissions.length - displayLimit)} More
          </button>
        </div>
      )}
    </div>
  );
};
