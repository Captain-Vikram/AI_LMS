import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

export const useClassroomDashboard = (classroomId) => {
  const [dashboard, setDashboard] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    if (!classroomId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/api/classroom/${classroomId}/dashboard`);
      if (response.status === 'success') {
        setDashboard(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard');
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  const fetchOverview = useCallback(async () => {
    if (!classroomId) return;
    
    try {
      const response = await apiClient.get(`/api/classroom/${classroomId}/overview`);
      if (response.status === 'success') {
        setOverview(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    }
  }, [classroomId]);

  useEffect(() => {
    fetchDashboard();
    fetchOverview();
    
    // Refresh every 30 seconds for student data
    const interval = setInterval(() => {
      fetchDashboard();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [classroomId, fetchDashboard, fetchOverview]);

  return {
    dashboard,
    overview,
    loading,
    error,
    refresh: fetchDashboard,
  };
};

export const useClassroomAnalytics = (classroomId) => {
  const [analytics, setAnalytics] = useState(null);
  const [studentProgress, setStudentProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    if (!classroomId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/api/analytics/classroom/${classroomId}`);
      if (response.status === 'success') {
        setAnalytics(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  const fetchStudentProgress = useCallback(async (studentId) => {
    if (!classroomId || !studentId) return;
    
    try {
      const response = await apiClient.get(
        `/api/analytics/classroom/${classroomId}/student/${studentId}`
      );
      if (response.status === 'success') {
        setStudentProgress(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch student progress:', err);
    }
  }, [classroomId]);

  const fetchMyProgress = useCallback(async () => {
    if (!classroomId) return;
    
    try {
      const response = await apiClient.get(
        `/api/analytics/classroom/${classroomId}/my-progress`
      );
      if (response.status === 'success') {
        setStudentProgress(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch my progress:', err);
    }
  }, [classroomId]);

  useEffect(() => {
    fetchAnalytics();
    
    // Refresh every 2 minutes
    const interval = setInterval(fetchAnalytics, 120000);
    
    return () => clearInterval(interval);
  }, [classroomId, fetchAnalytics]);

  return {
    analytics,
    studentProgress,
    loading,
    error,
    fetchAnalytics,
    fetchStudentProgress,
    fetchMyProgress,
  };
};

export const useAnnouncements = (classroomId) => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnnouncements = useCallback(async () => {
    if (!classroomId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/api/classroom/${classroomId}/announcements`);
      if (response.status === 'success') {
        setAnnouncements(response.data);
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
          await fetchAnnouncements();
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
      } catch (err) {
        console.error('Failed to mark announcement as viewed:', err);
      }
    },
    [classroomId]
  );

  const deleteAnnouncement = useCallback(
    async (announcementId) => {
      if (!classroomId) return;
      
      try {
        const response = await apiClient.delete(
          `/api/classroom/${classroomId}/announcements/${announcementId}`
        );
        
        if (response.status === 'success') {
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
    fetchAnnouncements();
    
    // Refresh every 15 seconds
    const interval = setInterval(fetchAnnouncements, 15000);
    
    return () => clearInterval(interval);
  }, [classroomId, fetchAnnouncements]);

  return {
    announcements,
    loading,
    error,
    createAnnouncement,
    markAsViewed,
    deleteAnnouncement,
    refresh: fetchAnnouncements,
  };
};

export const useEnrollment = (classroomId) => {
  const [roster, setRoster] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRoster = useCallback(async () => {
    if (!classroomId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiClient.get(`/api/classroom/${classroomId}/members`);
      if (response.status === 'success') {
        setRoster(response.data);
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
          await fetchRoster();
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
          await fetchRoster();
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
          formData,
          { 'Content-Type': 'multipart/form-data' }
        );
        
        if (response.status === 'upload_complete') {
          await fetchRoster();
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
          await fetchRoster();
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
    fetchRoster();
  }, [classroomId, fetchRoster]);

  return {
    roster,
    loading,
    error,
    enrollStudent,
    addStudent,
    bulkUpload,
    removeStudent,
    refresh: fetchRoster,
  };
};

export const useStudentGroups = (classroomId) => {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchGroups = useCallback(async () => {
    if (!classroomId) return;
    
    try {
      const response = await apiClient.get(`/api/classroom/${classroomId}/members`);
      if (response.status === 'success' && response.data.student_groups) {
        setGroups(response.data.student_groups);
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
          await fetchGroups();
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
          await fetchGroups();
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
    fetchGroups();
  }, [classroomId, fetchGroups]);

  return {
    groups,
    loading,
    error,
    createGroup,
    addStudentToGroup,
    refresh: fetchGroups,
  };
};

export const useLearningModules = (classroomId) => {
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchModules = useCallback(async () => {
    if (!classroomId) return;
    
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch modules');
      setModules([]);
    } finally {
      setLoading(false);
    }
  }, [classroomId]);

  useEffect(() => {
    fetchModules();
  }, [classroomId, fetchModules]);

  return {
    modules,
    loading,
    error,
    refresh: fetchModules,
  };
};

export const useClassroomResources = (classroomId, mode = 'class', enabled = true) => {
  const [resourcePayload, setResourcePayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchResources = useCallback(
    async (targetMode = mode) => {
      if (!enabled || !classroomId) return;

      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get(
          `/api/classroom/${classroomId}/resources?mode=${encodeURIComponent(targetMode)}`
        );
        if (response.status === 'success') {
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

      await fetchResources('class');
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
          await fetchResources('class');
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

  useEffect(() => {
    if (!enabled) {
      return;
    }
    fetchResources(mode);
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
    refresh: fetchResources,
  };
};

export const useModuleProgress = (classroomId, moduleId, studentId = null) => {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProgress = useCallback(async () => {
    if (!classroomId || !moduleId) return;

    setLoading(true);
    setError(null);

    try {
      const params = studentId ? `?student_id=${studentId}` : '';
      const response = await apiClient.get(
        `/api/classroom/${classroomId}/modules/${moduleId}/progress${params}`
      );
      if (response.status === 'success') {
        setProgress(response.progress);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch module progress');
    } finally {
      setLoading(false);
    }
  }, [classroomId, moduleId, studentId]);

  useEffect(() => {
    fetchProgress();
  }, [classroomId, moduleId, studentId, fetchProgress]);

  return {
    progress,
    loading,
    error,
    refresh: fetchProgress,
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
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    if (!classroomId || !moduleId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(
        `/api/classroom/${classroomId}/modules/${moduleId}/analytics`
      );
      if (response.status === 'success') {
        setAnalytics(response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  }, [classroomId, moduleId]);

  useEffect(() => {
    fetchAnalytics();
  }, [classroomId, moduleId, fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    refresh: fetchAnalytics,
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
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchApprovedResources = useCallback(async () => {
    if (!classroomId || !enabled) {
      setCategories([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(
        `/api/classroom/${classroomId}/modules/approved-resources`
      );

      if (response.status === 'success') {
        setCategories(Array.isArray(response.categories) ? response.categories : []);
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
    fetchApprovedResources();
  }, [fetchApprovedResources]);

  return {
    categories,
    loading,
    error,
    refresh: fetchApprovedResources,
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
