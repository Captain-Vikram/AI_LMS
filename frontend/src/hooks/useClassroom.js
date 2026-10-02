import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';
import { storage } from '../utils/storage';

export const useClassroomDashboard = (classroomId) => {
  const [dashboard, setDashboard] = useState(() => storage.get(`dashboard_${classroomId}`) || null);
  const [overview, setOverview] = useState(() => storage.get(`overview_${classroomId}`) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async (useCache = true) => {
    if (!classroomId) return;
    
    if (useCache) {
      const cached = storage.get(`dashboard_${classroomId}`);
      if (cached) setDashboard(cached);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/api/classroom/${classroomId}/dashboard`);
      if (response.status === 'success') {
        setDashboard(response.data);
        storage.set(`dashboard_${classroomId}`, response.data, 300); // 5 min
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard');
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  const fetchOverview = useCallback(async (useCache = true) => {
    if (!classroomId) return;
    
    if (useCache) {
      const cached = storage.get(`overview_${classroomId}`);
      if (cached) setOverview(cached);
    }
    
    try {
      const response = await apiClient.get(`/api/classroom/${classroomId}/overview`);
      if (response.status === 'success') {
        setOverview(response.data);
        storage.set(`overview_${classroomId}`, response.data, 300); // 5 min
      }
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    }
  }, [classroomId]);

  useEffect(() => {
    fetchDashboard(true);
    fetchOverview(true);
    
    // Refresh every 30 seconds for student data
    const interval = setInterval(() => {
      fetchDashboard(false);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [classroomId, fetchDashboard, fetchOverview]);

  return {
    dashboard,
    overview,
    loading,
    error,
    refresh: () => fetchDashboard(false),
  };
};

export const useClassroomAnalytics = (classroomId) => {
  const [analytics, setAnalytics] = useState(() => storage.get(`analytics_${classroomId}`) || null);
  const [studentProgress, setStudentProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async (useCache = true) => {
    if (!classroomId) return;
    
    if (useCache) {
      const cached = storage.get(`analytics_${classroomId}`);
      if (cached) setAnalytics(cached);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/api/analytics/classroom/${classroomId}`);
      if (response.status === 'success') {
        setAnalytics(response.data);
        storage.set(`analytics_${classroomId}`, response.data, 300);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  const fetchStudentProgress = useCallback(async (studentId, useCache = true) => {
    if (!classroomId || !studentId) return;
    
    const cacheKey = `analytics_${classroomId}_student_${studentId}`;
    if (useCache) {
      const cached = storage.get(cacheKey);
      if (cached) setStudentProgress(cached);
    }
    
    try {
      const response = await apiClient.get(
        `/api/analytics/classroom/${classroomId}/student/${studentId}`
      );
      if (response.status === 'success') {
        setStudentProgress(response.data);
        storage.set(cacheKey, response.data, 300);
      }
    } catch (err) {
      console.error('Failed to fetch student progress:', err);
    }
  }, [classroomId]);

  const fetchMyProgress = useCallback(async (useCache = true) => {
    if (!classroomId) return;
    
    const cacheKey = `analytics_${classroomId}_my-progress`;
    if (useCache) {
      const cached = storage.get(cacheKey);
      if (cached) setStudentProgress(cached);
    }
    
    try {
      const response = await apiClient.get(
        `/api/analytics/classroom/${classroomId}/my-progress`
      );
      if (response.status === 'success') {
        setStudentProgress(response.data);
        storage.set(cacheKey, response.data, 300);
      }
    } catch (err) {
      console.error('Failed to fetch my progress:', err);
    }
  }, [classroomId]);

  useEffect(() => {
    fetchAnalytics(true);
    
    // Refresh every 2 minutes
    const interval = setInterval(() => fetchAnalytics(false), 120000);
    
    return () => clearInterval(interval);
  }, [classroomId, fetchAnalytics]);

  return {
    analytics,
    studentProgress,
    loading,
    error,
    fetchAnalytics: () => fetchAnalytics(false),
    fetchStudentProgress: (studentId) => fetchStudentProgress(studentId, false),
    fetchMyProgress: () => fetchMyProgress(false),
  };
};

export const useAnnouncements = (classroomId) => {
  const [announcements, setAnnouncements] = useState(() => storage.get(`announcements_${classroomId}`) || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnnouncements = useCallback(async (useCache = true) => {
    if (!classroomId) return;
    
    if (useCache) {
      const cached = storage.get(`announcements_${classroomId}`);
      if (cached) setAnnouncements(cached);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/api/classroom/${classroomId}/announcements`);
      if (response.status === 'success') {
        setAnnouncements(response.data);
        storage.set(`announcements_${classroomId}`, response.data, 120);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch announcements');
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  const createAnnouncement = useCallback(
    async (title, content, targetGroups = []) => {
      if (!classroomId) return null;
      
      try {
        const response = await apiClient.post(`/api/classroom/${classroomId}/announcements`, {
          title,
          content,
          target_groups: targetGroups,
          scheduled_date: null,
        });
        
        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          await fetchAnnouncements(false);
          return response.data;
        }
      } catch (err) {
        console.error('Failed to create announcement:', err);
        throw err;
      }
    },
    [classroomId, fetchAnnouncements]
  );

  const markAsViewed = useCallback(
    async (announcementId) => {
      if (!classroomId) return;
      
      try {
        await apiClient.post(
          `/api/classroom/${classroomId}/announcements/${announcementId}/view`
        );
        storage.clearClassroomCache(classroomId);
        await fetchAnnouncements(false);
      } catch (err) {
        console.error('Failed to mark announcement as viewed:', err);
      }
    },
    [classroomId, fetchAnnouncements]
  );

  const deleteAnnouncement = useCallback(
    async (announcementId) => {
      if (!classroomId) return;
      
      try {
        const response = await apiClient.delete(
          `/api/classroom/${classroomId}/announcements/${announcementId}`
        );
        
        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          setAnnouncements(prev => 
            prev.filter(a => a.announcement_id !== announcementId)
          );
        }
      } catch (err) {
        console.error('Failed to delete announcement:', err);
        throw err;
      }
    },
    [classroomId]
  );

  useEffect(() => {
    fetchAnnouncements(true);
    
    // Refresh every 15 seconds
    const interval = setInterval(() => fetchAnnouncements(false), 15000);
    
    return () => clearInterval(interval);
  }, [classroomId, fetchAnnouncements]);

  return {
    announcements,
    loading,
    error,
    createAnnouncement,
    markAsViewed,
    deleteAnnouncement,
    refresh: () => fetchAnnouncements(false),
  };
};

export const useEnrollment = (classroomId) => {
  const [roster, setRoster] = useState(() => storage.get(`roster_${classroomId}`) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRoster = useCallback(async (useCache = true) => {
    if (!classroomId) return;
    
    if (useCache) {
      const cached = storage.get(`roster_${classroomId}`);
      if (cached) setRoster(cached);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/api/classroom/${classroomId}/members`);
      if (response.status === 'success') {
        setRoster(response.data);
        storage.set(`roster_${classroomId}`, response.data, 300);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch roster');
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  const enrollStudent = useCallback(
    async (enrollmentCode) => {
      if (!classroomId) return null;
      
      try {
        const response = await apiClient.post(`/api/classroom/${classroomId}/enroll`, {
          enrollment_code: enrollmentCode,
        });
        
        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          await fetchRoster(false);
          return response.data;
        }
      } catch (err) {
        console.error('Failed to enroll:', err);
        throw err;
      }
    },
    [classroomId, fetchRoster]
  );

  const addStudent = useCallback(
    async (studentId) => {
      if (!classroomId) return;
      
      try {
        const response = await apiClient.post(
          `/api/classroom/${classroomId}/members/add`,
          { student_id: studentId }
        );
        
        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          await fetchRoster(false);
          return response.data;
        }
      } catch (err) {
        console.error('Failed to add student:', err);
        throw err;
      }
    },
    [classroomId, fetchRoster]
  );

  const bulkUpload = useCallback(
    async (file) => {
      if (!classroomId) return;
      
      try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await apiClient.post(
          `/api/classroom/${classroomId}/members/bulk-upload`,
          formData
        );
        
        if (response.status === 'upload_complete') {
          storage.clearClassroomCache(classroomId);
          await fetchRoster(false);
          return response.data;
        }
      } catch (err) {
        console.error('Failed to bulk upload:', err);
        throw err;
      }
    },
    [classroomId, fetchRoster]
  );

  const removeStudent = useCallback(
    async (studentId) => {
      if (!classroomId) return;
      
      try {
        const response = await apiClient.delete(
          `/api/classroom/${classroomId}/members/${studentId}`
        );
        
        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          await fetchRoster(false);
          return response.data;
        }
      } catch (err) {
        console.error('Failed to remove student:', err);
        throw err;
      }
    },
    [classroomId, fetchRoster]
  );

  useEffect(() => {
    fetchRoster(true);
  }, [classroomId, fetchRoster]);

  return {
    roster,
    loading,
    error,
    enrollStudent,
    addStudent,
    bulkUpload,
    removeStudent,
    refresh: () => fetchRoster(false),
  };
};

export const useStudentGroups = (classroomId) => {
  const [groups, setGroups] = useState(() => storage.get(`groups_${classroomId}`) || []);
  // eslint-disable-next-line no-unused-vars
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [error, setError] = useState(null);

  const fetchGroups = useCallback(async (useCache = true) => {
    if (!classroomId) return;
    
    if (useCache) {
      const cached = storage.get(`groups_${classroomId}`);
      if (cached) setGroups(cached);
    }
    
    try {
      const response = await apiClient.get(`/api/classroom/${classroomId}/members`);
      if (response.status === 'success' && response.data.student_groups) {
        setGroups(response.data.student_groups);
        storage.set(`groups_${classroomId}`, response.data.student_groups, 300);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  }, [classroomId]);

  const createGroup = useCallback(
    async (name, description = '', students = []) => {
      if (!classroomId) return null;
      
      try {
        const response = await apiClient.post(`/api/classroom/${classroomId}/groups`, {
          name,
          description,
          students,
        });
        
        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          await fetchGroups(false);
          return response.data;
        }
      } catch (err) {
        console.error('Failed to create group:', err);
        throw err;
      }
    },
    [classroomId, fetchGroups]
  );

  const addStudentToGroup = useCallback(
    async (groupId, studentId) => {
      if (!classroomId) return;
      
      try {
        const response = await apiClient.post(
          `/api/classroom/${classroomId}/groups/${groupId}/members`,
          { student_id: studentId }
        );
        
        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          await fetchGroups(false);
          return response.data;
        }
      } catch (err) {
        console.error('Failed to add student to group:', err);
        throw err;
      }
    },
    [classroomId, fetchGroups]
  );

  useEffect(() => {
    fetchGroups(true);
  }, [classroomId, fetchGroups]);

  return {
    groups,
    loading,
    error,
    createGroup,
    addStudentToGroup,
    refresh: () => fetchGroups(false),
  };
};

export const useLearningModules = (classroomId) => {
  const [modules, setModules] = useState(() => storage.get(`modules_${classroomId}`) || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchModules = useCallback(async (useCache = true) => {
    if (!classroomId) return;
    
    if (useCache) {
      const cached = storage.get(`modules_${classroomId}`);
      if (cached) setModules(cached);
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/api/classroom/${classroomId}/modules`);
      if (response.status === 'success') {
        const payload = Array.isArray(response.modules)
          ? response.modules
          : Array.isArray(response.data)
            ? response.data
            : [];
        setModules(payload);
        storage.set(`modules_${classroomId}`, payload, 300);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch modules');
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    fetchModules(true);
  }, [classroomId, fetchModules]);

  return {
    modules,
    loading,
    error,
    refresh: () => fetchModules(false),
  };
};

export const useClassroomResources = (classroomId, mode = 'class', enabled = true) => {
  const [resourcePayload, setResourcePayload] = useState(() => storage.get(`resources_${classroomId}_${mode}`) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [generationStatus, setGenerationStatus] = useState(null);

  const fetchResources = useCallback(
    async (targetMode = mode, useCache = true) => {
      if (!enabled || !classroomId) return;

      if (useCache) {
        const cached = storage.get(`resources_${classroomId}_${targetMode}`);
        if (cached) setResourcePayload(cached);
      }

      setLoading(true);
      setError(null);
      // We don't reset jobId/generationStatus here to allow persistent tracking 
      // of background jobs across refreshes/polling.

      try {
        const response = await apiClient.get(
          `/api/classroom/${classroomId}/resources?mode=${encodeURIComponent(targetMode)}`
        );
        
        if (response.status === 'success') {
          setResourcePayload(response);
          setJobId(null);
          setGenerationStatus(null);
          storage.set(`resources_${classroomId}_${targetMode}`, response, 300);
        } else if (response.status === 'generation_started' || response.status === 'generation_in_progress') {
          setJobId(response.job_id);
          setGenerationStatus(response.status);
          setResourcePayload(response);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch classroom resources');
      } finally {
        setLoading(false);
      }
    },
    [classroomId, mode, enabled]
  );

  const approveResource = useCallback(
    async (resourceId, approved = true) => {
      if (!enabled || !classroomId || !resourceId) return;

      await apiClient.patch(
        `/api/classroom/${classroomId}/resources/${resourceId}/approval`,
        { approved }
      );

      storage.clearClassroomCache(classroomId);
      await fetchResources('class', false);
    },
    [classroomId, fetchResources, enabled]
  );

  const addManualResource = useCallback(
    async (resourceData) => {
      if (!enabled || !classroomId) return;
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.post(
          `/api/classroom/${classroomId}/resources/manual`,
          resourceData
        );
        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          await fetchResources('class', false);
          return { success: true, resource: response.resource };
        }
        throw new Error(response.message || 'Failed to add resource');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error adding resource';
        setError(errorMessage);
        return { success: false, message: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [classroomId, fetchResources, enabled]
  );

  const regenerateResources = useCallback(
    async (file = null) => {
      if (!enabled || !classroomId) return;
      setLoading(true);
      setError(null);
      try {
        let response;
        if (file) {
          const formData = new FormData();
          formData.append('curriculum_pdf', file);
          response = await apiClient.post(
            `/api/classroom/${classroomId}/resources/generate?force=true`,
            formData
          );
        } else {
          response = await apiClient.post(
            `/api/classroom/${classroomId}/resources/generate?force=true`
          );
        }

        if (response.status === 'generation_started' || response.status === 'generation_in_progress') {
          setJobId(response.job_id);
          setGenerationStatus(response.status);
          return { success: true, status: response.status, job_id: response.job_id };
        } else if (response.status === 'syllabus_missing') {
          return { success: false, status: 'syllabus_missing', message: response.message };
        }
        throw new Error(response.message || 'Failed to start regeneration');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Error starting regeneration';
        setError(errorMessage);
        return { success: false, message: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [classroomId, enabled]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }
    fetchResources(mode, true);
  }, [classroomId, mode, fetchResources, enabled]);

  return {
    resourcePayload,
    resources: resourcePayload?.resources || [],
    summary: resourcePayload?.summary || {
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
    },
    loading,
    error,
    approveResource,
    addManualResource,
    regenerateResources,
    refresh: () => fetchResources(mode, false),
    fetchProgress: () => fetchResources(mode, false),
    jobId,
    generationStatus,
  };
};

export const useModuleProgress = (classroomId, moduleId, studentId = null) => {
  const [progress, setProgress] = useState(() => storage.get(`progress_${classroomId}_${moduleId}_${studentId || 'me'}`) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProgress = useCallback(async (useCache = true) => {
    if (!classroomId || !moduleId) return;

    if (useCache) {
      const cached = storage.get(`progress_${classroomId}_${moduleId}_${studentId || 'me'}`);
      if (cached) setProgress(cached);
    }

    setLoading(true);
    setError(null);

    try {
      const params = studentId ? `?student_id=${studentId}` : '';
      const response = await apiClient.get(
        `/api/classroom/${classroomId}/modules/${moduleId}/progress${params}`
      );
      if (response.status === 'success') {
        setProgress(response.progress);
        storage.set(`progress_${classroomId}_${moduleId}_${studentId || 'me'}`, response.progress, 300);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch module progress');
    } finally {
      setLoading(false);
    }
  }, [classroomId, moduleId, studentId]);

  useEffect(() => {
    fetchProgress(true);
  }, [classroomId, moduleId, studentId, fetchProgress]);

  return {
    progress,
    loading,
    error,
    refresh: () => fetchProgress(false),
  };
};

export const useResourceEngagement = (classroomId, moduleId, resourceId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const trackEngagement = useCallback(
    async (engagementData) => {
      if (!classroomId || !moduleId || !resourceId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post(
          `/api/classroom/${classroomId}/modules/${moduleId}/resources/${resourceId}/engagement`,
          engagementData
        );
        
        if (response.status === 'success') {
          return {
            success: true,
            message: response.message || 'Engagement tracked'
          };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to track engagement';
        setError(errorMsg);
        return {
          success: false,
          message: errorMsg
        };
      } finally {
        setLoading(false);
      }
    },
    [classroomId, moduleId, resourceId]
  );

  return {
    trackEngagement,
    loading,
    error,
  };
};

export const useModuleAnalytics = (classroomId, moduleId) => {
  const [analytics, setAnalytics] = useState(() => storage.get(`module_analytics_${classroomId}_${moduleId}`) || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async (useCache = true) => {
    if (!classroomId || !moduleId) return;

    if (useCache) {
      const cached = storage.get(`module_analytics_${classroomId}_${moduleId}`);
      if (cached) setAnalytics(cached);
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(
        `/api/classroom/${classroomId}/modules/${moduleId}/analytics`
      );
      if (response.status === 'success') {
        setAnalytics(response);
        storage.set(`module_analytics_${classroomId}_${moduleId}`, response, 300);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [classroomId, moduleId]);

  useEffect(() => {
    fetchAnalytics(true);
  }, [classroomId, moduleId, fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    refresh: () => fetchAnalytics(false),
  };
};

export const useAutoGenerateModules = (classroomId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateModules = useCallback(
    async (forceRegenerate = false) => {
      if (!classroomId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post(
          `/api/classroom/${classroomId}/modules/generate?force_regenerate=${forceRegenerate}`
        );
        
        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          const modulesCreated = Number(response.modules_created || 0);
          const modulesUpdated = Number(response.modules_updated || 0);
          const modulesProcessed = Number(
            response.modules_processed || modulesCreated + modulesUpdated
          );

          return {
            success: true,
            modulesCreated,
            modulesUpdated,
            modulesProcessed,
            modules: response.modules || [],
            message: response.message
          };
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to generate modules';
        setError(errorMsg);
        return {
          success: false,
          message: errorMsg
        };
      } finally {
        setLoading(false);
      }
    },
    [classroomId]
  );

  return {
    generateModules,
    loading,
    error,
  };
};

export const useCreateLearningModule = (classroomId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createModule = useCallback(
    async ({ name, description = '', status = 'published' }) => {
      if (!classroomId) {
        return { success: false, message: 'Missing classroom id' };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post(`/api/classroom/${classroomId}/modules`, {
          name,
          description,
          status,
        });

        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          return {
            success: true,
            module: response.module,
            message: response.message || 'Module created',
          };
        }

        return { success: false, message: 'Failed to create module' };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create module';
        setError(errorMessage);
        return { success: false, message: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [classroomId]
  );

  return {
    createModule,
    loading,
    error,
  };
};

export const useReorderLearningModules = (classroomId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reorderModules = useCallback(
    async (moduleIds) => {
      if (!classroomId) {
        return { success: false, message: 'Missing classroom id' };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.patch(
          `/api/classroom/${classroomId}/modules/reorder`,
          { module_ids: moduleIds }
        );

        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          return {
            success: true,
            modules: response.modules || [],
            message: response.message || 'Modules reordered',
          };
        }

        return { success: false, message: 'Failed to reorder modules' };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to reorder modules';
        setError(errorMessage);
        return { success: false, message: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [classroomId]
  );

  return {
    reorderModules,
    loading,
    error,
  };
};

export const useModuleApprovedResources = (classroomId, enabled = true) => {
  const [categories, setCategories] = useState(() => storage.get(`approved_resources_${classroomId}`) || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchApprovedResources = useCallback(async (useCache = true) => {
    if (!classroomId || !enabled) {
      setCategories([]);
      return;
    }

    if (useCache) {
      const cached = storage.get(`approved_resources_${classroomId}`);
      if (cached) setCategories(cached);
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(
        `/api/classroom/${classroomId}/modules/approved-resources`
      );

      if (response.status === 'success') {
        const payload = Array.isArray(response.categories) ? response.categories : [];
        setCategories(payload);
        storage.set(`approved_resources_${classroomId}`, payload, 300);
      } else {
        setCategories([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch approved resources');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [classroomId, enabled]);

  useEffect(() => {
    fetchApprovedResources(true);
  }, [fetchApprovedResources]);

  return {
    categories,
    loading,
    error,
    refresh: () => fetchApprovedResources(false),
  };
};

export const useAssignResourcesToModule = (classroomId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const assignResources = useCallback(
    async (moduleId, resourceIds) => {
      if (!classroomId || !moduleId) {
        return { success: false, message: 'Missing classroom or module id' };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.post(
          `/api/classroom/${classroomId}/modules/${moduleId}/resources/assign`,
          { resource_ids: resourceIds }
        );

        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          return {
            success: true,
            module: response.module,
            addedCount: Number(response.added_count || 0),
            skippedCount: Number(response.skipped_count || 0),
            message: response.message || 'Resources assigned successfully',
          };
        }

        return { success: false, message: 'Failed to assign resources' };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to assign resources';
        setError(errorMessage);
        return { success: false, message: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [classroomId]
  );

  return {
    assignResources,
    loading,
    error,
  };
};

export const useRemoveResourceFromModule = (classroomId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const removeResource = useCallback(
    async (moduleId, resourceId) => {
      if (!classroomId || !moduleId || !resourceId) {
        return { success: false, message: 'Missing required parameters' };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.delete(
          `/api/classroom/${classroomId}/modules/${moduleId}/resources/${resourceId}`
        );

        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          return {
            success: true,
            message: response.message || 'Resource removed successfully',
          };
        }

        return { success: false, message: 'Failed to remove resource' };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to remove resource';
        setError(errorMessage);
        return { success: false, message: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [classroomId]
  );

  return {
    removeResource,
    loading,
    error,
  };
};

export const useDeleteLearningModule = (classroomId) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const deleteModule = useCallback(
    async (moduleId) => {
      if (!classroomId || !moduleId) {
        return { success: false, message: 'Missing classroom or module id' };
      }

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.delete(
          `/api/classroom/${classroomId}/modules/${moduleId}`
        );

        if (response.status === 'success') {
          storage.clearClassroomCache(classroomId);
          return {
            success: true,
            message: response.message || 'Module deleted successfully',
          };
        }

        return { success: false, message: 'Failed to delete module' };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to delete module';
        setError(errorMessage);
        return { success: false, message: errorMessage };
      } finally {
        setLoading(false);
      }
    },
    [classroomId]
  );

  return {
    deleteModule,
    loading,
    error,
  };
};
