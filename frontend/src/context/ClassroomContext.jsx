import React, { createContext, useContext, useState, useCallback } from 'react';
import { storage } from '../utils/storage';

// ClassroomContext (plain JS) — hold classroom-scoped state and helpers
const ClassroomContext = createContext(undefined);

export const ClassroomProvider = ({ children }) => {
  const [activeClassroom, setActiveClassroomState] = useState(() => storage.get('activeClassroom', true) || null);
  const [announcements, setAnnouncementsState] = useState(() => storage.get('announcements_context', true) || []);
  const [studentGroups, setStudentGroupsState] = useState(() => storage.get('studentGroups_context', true) || []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const setActiveClassroom = useCallback((classroom) => {
    setActiveClassroomState(classroom);
    if (classroom) {
      storage.set('activeClassroom', classroom, 1800, true);
    } else {
      storage.remove('activeClassroom', true);
    }
  }, []);

  const setAnnouncements = useCallback((val) => {
    setAnnouncementsState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      storage.set('announcements_context', next, 1800, true);
      return next;
    });
  }, []);

  const setStudentGroups = useCallback((val) => {
    setStudentGroupsState((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      storage.set('studentGroups_context', next, 1800, true);
      return next;
    });
  }, []);

  const refreshClassroom = useCallback(async () => {
    // This will be called by hooks to refresh classroom data
    setIsLoading(true);
    try {
      // API calls will be handled by individual hooks
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addAnnouncement = useCallback((announcement) => {
    setAnnouncements(prev => [announcement, ...prev]);
  }, []);

  const removeAnnouncement = useCallback((announcementId) => {
    setAnnouncements(prev => prev.filter(a => a.announcement_id !== announcementId));
  }, []);

  const updateAnnouncement = useCallback((announcementId, updates) => {
    setAnnouncements(prev => 
      prev.map(a => a.announcement_id === announcementId ? { ...a, ...updates } : a)
    );
  }, []);

  const value = {
    activeClassroom,
    setActiveClassroom,
    announcements,
    setAnnouncements,
    studentGroups,
    setStudentGroups,
    isLoading,
    setIsLoading,
    error,
    setError,
    refreshClassroom,
    addAnnouncement,
    removeAnnouncement,
    updateAnnouncement,
  };

  return (
    <ClassroomContext.Provider value={value}>
      {children}
    </ClassroomContext.Provider>
  );
};

export const useClassroomContext = () => {
  const context = useContext(ClassroomContext);
  if (!context) {
    throw new Error('useClassroomContext must be used within ClassroomProvider');
  }
  return context;
};
