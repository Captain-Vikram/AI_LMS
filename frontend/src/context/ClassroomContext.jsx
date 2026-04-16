import React, { createContext, useContext, useState, useCallback } from 'react';

// ClassroomContext (plain JS) — hold classroom-scoped state and helpers
const ClassroomContext = createContext(undefined);

export const ClassroomProvider = ({ children }) => {
  const [activeClassroom, setActiveClassroom] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [studentGroups, setStudentGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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
