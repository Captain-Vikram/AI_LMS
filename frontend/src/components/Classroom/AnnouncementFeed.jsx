import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

export const AnnouncementFeed = ({ 
  announcements = [], 
  onMarkViewed, 
  onDelete,
  isTeacher = false,
  loading = false 
}) => {
  const [expandedId, setExpandedId] = useState(null);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-700 rounded-lg"></div>
        ))}
      </div>
    );
  }

  if (!announcements || announcements.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No announcements yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {announcements.map((announcement) => (
        <div
          key={announcement.announcement_id}
          className="p-4 rounded-lg bg-gray-800 border border-gray-700 hover:border-blue-500 transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-100 line-clamp-2">
                {announcement.title}
              </h4>
              <p className="text-xs text-gray-500 mt-1">
                {formatDistanceToNow(new Date(announcement.created_date), { 
                  addSuffix: true 
                })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isTeacher && (
                <button
                  onClick={() => onDelete?.(announcement.announcement_id)}
                  className="p-1 text-red-400 hover:bg-red-500/10 rounded hover:text-red-300 transition-colors"
                  title="Delete announcement"
                >
                  ✕
                </button>
              )}
              <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                {announcement.views} views
              </span>
            </div>
          </div>

          <p
            className={`text-sm text-gray-300 cursor-pointer ${
              expandedId === announcement.announcement_id ? '' : 'line-clamp-2'
            }`}
            onClick={() => {
              setExpandedId(expandedId === announcement.announcement_id ? null : announcement.announcement_id);
              if (!announcement.viewed_by?.includes(localStorage.getItem('userId'))) {
                onMarkViewed?.(announcement.announcement_id);
              }
            }}
          >
            {announcement.content}
          </p>

          {announcements.length > 2 && (
            <button
              className="text-xs text-blue-400 hover:text-blue-300 mt-2 transition-colors"
              onClick={() => setExpandedId(expandedId === announcement.announcement_id ? null : announcement.announcement_id)}
            >
              {expandedId === announcement.announcement_id ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export const AnnouncementCreate = ({ onSubmit, isLoading = false }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (title.trim() && content.trim()) {
      await onSubmit(title, content);
      setTitle('');
      setContent('');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors mb-4"
      >
        + New Announcement
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mb-4 p-4 rounded-lg bg-gray-800 border border-gray-700">
      <input
        type="text"
        placeholder="Announcement title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 mb-3 focus:outline-none focus:border-blue-500"
      />
      <textarea
        placeholder="Announcement content"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows="4"
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 mb-3 focus:outline-none focus:border-blue-500"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded font-medium transition-colors"
        >
          {isLoading ? 'Posting...' : 'Post'}
        </button>
        <button
          type="button"
          onClick={() => {
            setIsOpen(false);
            setTitle('');
            setContent('');
          }}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
