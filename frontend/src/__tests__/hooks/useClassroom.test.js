"""
Frontend Hook Tests - Test all custom hooks (useClassroom.js)
Tests data fetching, state management, and error handling
"""

import { renderHook, act, waitFor } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useClassroomDashboard,
  useClassroomAnalytics,
  useAnnouncements,
  useEnrollment,
  useStudentGroups,
  useLearningModules,
  useClassroomResources,
} from '../../hooks/useClassroom';
import * as apiClient from '../../services/apiClient';

// Mock the apiClient
jest.mock('../../services/apiClient');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useClassroomDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch dashboard data on mount', async () => {
    const mockDashboard = {
      status: 'success',
      data: {
        classroom_id: '123',
        classroom_name: 'Test Class',
        student_count: 25,
        recent_submissions: [],
      },
    };

    apiClient.default.get.mockResolvedValue(mockDashboard);

    const { result } = renderHook(
      () => useClassroomDashboard('123'),
      { wrapper: createWrapper() }
    );

    // Initially loading
    expect(result.current.loading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.dashboard).toEqual(mockDashboard.data);
    expect(result.current.error).toBeNull();
  });

  it('should handle errors gracefully', async () => {
    const error = new Error('Failed to fetch');
    apiClient.default.get.mockRejectedValue(error);

    const { result } = renderHook(
      () => useClassroomDashboard('123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to fetch');
  });

  it('should handle empty classroomId', () => {
    const { result } = renderHook(
      () => useClassroomDashboard(''),
      { wrapper: createWrapper() }
    );

    expect(result.current.dashboard).toBeNull();
  });

  it('should refresh dashboard data', async () => {
    const mockDashboard = {
      status: 'success',
      data: { classroom_id: '123' },
    };

    apiClient.default.get.mockResolvedValue(mockDashboard);

    const { result } = renderHook(
      () => useClassroomDashboard('123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const initialCallCount = apiClient.default.get.mock.calls.length;

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(apiClient.default.get.mock.calls.length).toBeGreaterThan(
        initialCallCount
      );
    });
  });
});

describe('useClassroomAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch analytics data', async () => {
    const mockAnalytics = {
      status: 'success',
      data: {
        classroom_id: '123',
        average_class_score: 85.5,
        total_students: 25,
      },
    };

    apiClient.default.get.mockResolvedValue(mockAnalytics);

    const { result } = renderHook(
      () => useClassroomAnalytics('123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.analytics).toEqual(mockAnalytics.data);
  });

  it('should fetch individual student progress', async () => {
    const mockProgress = {
      status: 'success',
      data: {
        student_id: 'student123',
        average_score_percentage: 78.5,
      },
    };

    apiClient.default.get.mockResolvedValue(mockProgress);

    const { result } = renderHook(
      () => useClassroomAnalytics('123'),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.fetchStudentProgress('student123');
    });

    expect(result.current.studentProgress).toEqual(mockProgress.data);
  });

  it('should fetch student own progress', async () => {
    const mockProgress = {
      status: 'success',
      data: {
        average_score_percentage: 82.0,
      },
    };

    apiClient.default.get.mockResolvedValue(mockProgress);

    const { result } = renderHook(
      () => useClassroomAnalytics('123'),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.fetchMyProgress();
    });

    expect(result.current.studentProgress).toEqual(mockProgress.data);
  });
});

describe('useAnnouncements', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch announcements on mount', async () => {
    const mockResponse = {
      status: 'success',
      data: [
        {
          announcement_id: '1',
          title: 'Test Announcement',
          content: 'Test content',
        },
      ],
    };

    apiClient.default.get.mockResolvedValue(mockResponse);

    const { result } = renderHook(
      () => useAnnouncements('123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.announcements).toHaveLength(1);
    expect(result.current.announcements[0].title).toBe('Test Announcement');
  });

  it('should create announcement', async () => {
    const mockResponse = {
      status: 'success',
      data: { announcement_id: 'ann1' },
    };

    apiClient.default.post.mockResolvedValue(mockResponse);
    apiClient.default.get.mockResolvedValue({
      status: 'success',
      data: [],
    });

    const { result } = renderHook(
      () => useAnnouncements('123'),
      { wrapper: createWrapper() }
    );

    const response = await act(async () => {
      return await result.current.createAnnouncement(
        'New Title',
        'New Content'
      );
    });

    expect(response.announcement_id).toBe('ann1');
  });

  it('should mark announcement as viewed', async () => {
    apiClient.default.post.mockResolvedValue({ status: 'success' });
    apiClient.default.get.mockResolvedValue({
      status: 'success',
      data: [],
    });

    const { result } = renderHook(
      () => useAnnouncements('123'),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.markAsViewed('ann123');
    });

    expect(apiClient.default.post).toHaveBeenCalled();
  });

  it('should delete announcement', async () => {
    const mockAnnouncements = [
      {
        announcement_id: 'ann1',
        title: 'Test',
      },
      {
        announcement_id: 'ann2',
        title: 'Test 2',
      },
    ];

    apiClient.default.get.mockResolvedValue({
      status: 'success',
      data: mockAnnouncements,
    });

    apiClient.default.delete.mockResolvedValue({
      status: 'success',
    });

    const { result } = renderHook(
      () => useAnnouncements('123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.announcements).toHaveLength(2);
    });

    await act(async () => {
      await result.current.deleteAnnouncement('ann1');
    });

    expect(result.current.announcements).toHaveLength(1);
  });
});

describe('useEnrollment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch roster on mount', async () => {
    const mockRoster = {
      status: 'success',
      data: {
        total_students: 2,
        students: [
          { user_id: 's1', name: 'Student 1', email: 's1@test.com' },
          { user_id: 's2', name: 'Student 2', email: 's2@test.com' },
        ],
      },
    };

    apiClient.default.get.mockResolvedValue(mockRoster);

    const { result } = renderHook(
      () => useEnrollment('123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.roster.total_students).toBe(2);
    expect(result.current.roster.students).toHaveLength(2);
  });

  it('should enroll student', async () => {
    apiClient.default.post.mockResolvedValue({
      status: 'success',
      data: { student_id: 's1', status: 'enrolled' },
    });

    apiClient.default.get.mockResolvedValue({
      status: 'success',
      data: { students: [], total_students: 0 },
    });

    const { result } = renderHook(
      () => useEnrollment('123'),
      { wrapper: createWrapper() }
    );

    const response = await act(async () => {
      return await result.current.enrollStudent('ENROLLCODE');
    });

    expect(response.status).toBe('enrolled');
  });

  it('should add student manually', async () => {
    apiClient.default.post.mockResolvedValue({
      status: 'success',
      data: { student_id: 's1' },
    });

    apiClient.default.get.mockResolvedValue({
      status: 'success',
      data: { students: [], total_students: 0 },
    });

    const { result } = renderHook(
      () => useEnrollment('123'),
      { wrapper: createWrapper() }
    );

    const response = await act(async () => {
      return await result.current.addStudent('student_id_123');
    });

    expect(response).toBeDefined();
  });

  it('should bulk upload students', async () => {
    const mockFile = new File(['test'], 'students.csv');

    apiClient.default.post.mockResolvedValue({
      status: 'upload_complete',
      data: { success: 3, failed: 0, errors: [] },
    });

    apiClient.default.get.mockResolvedValue({
      status: 'success',
      data: { students: [], total_students: 0 },
    });

    const { result } = renderHook(
      () => useEnrollment('123'),
      { wrapper: createWrapper() }
    );

    const response = await act(async () => {
      return await result.current.bulkUpload(mockFile);
    });

    expect(response.success).toBe(3);
  });

  it('should remove student', async () => {
    apiClient.default.delete.mockResolvedValue({
      status: 'success',
    });

    apiClient.default.get.mockResolvedValue({
      status: 'success',
      data: { students: [], total_students: 0 },
    });

    const { result } = renderHook(
      () => useEnrollment('123'),
      { wrapper: createWrapper() }
    );

    const response = await act(async () => {
      return await result.current.removeStudent('student_id_123');
    });

    expect(response).toBeDefined();
  });
});

describe('useStudentGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch groups on mount', async () => {
    const mockRoster = {
      status: 'success',
      data: {
        student_groups: [
          {
            _id: 'g1',
            name: 'Advanced',
            students: ['s1', 's2'],
          },
        ],
      },
    };

    apiClient.default.get.mockResolvedValue(mockRoster);

    const { result } = renderHook(
      () => useStudentGroups('123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.groups).toHaveLength(1);
    });

    expect(result.current.groups[0].name).toBe('Advanced');
  });

  it('should create group', async () => {
    apiClient.default.post.mockResolvedValue({
      status: 'success',
      data: { group_id: 'g1' },
    });

    apiClient.default.get.mockResolvedValue({
      status: 'success',
      data: { student_groups: [] },
    });

    const { result } = renderHook(
      () => useStudentGroups('123'),
      { wrapper: createWrapper() }
    );

    const response = await act(async () => {
      return await result.current.createGroup('New Group', 'Description', []);
    });

    expect(response.group_id).toBe('g1');
  });

  it('should add student to group', async () => {
    apiClient.default.post.mockResolvedValue({
      status: 'success',
    });

    apiClient.default.get.mockResolvedValue({
      status: 'success',
      data: { student_groups: [] },
    });

    const { result } = renderHook(
      () => useStudentGroups('123'),
      { wrapper: createWrapper() }
    );

    const response = await act(async () => {
      return await result.current.addStudentToGroup('group123', 'student123');
    });

    expect(response).toBeDefined();
  });
});

describe('useLearningModules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch modules on mount', async () => {
    const mockModules = {
      status: 'success',
      data: [
        {
          module_id: 'm1',
          name: 'Module 1',
          estimated_hours: 4.5,
        },
      ],
    };

    apiClient.default.get.mockResolvedValue(mockModules);

    const { result } = renderHook(
      () => useLearningModules('123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.modules).toHaveLength(1);
    });

    expect(result.current.modules[0].name).toBe('Module 1');
  });

  it('should handle no modules gracefully', async () => {
    apiClient.default.get.mockRejectedValue(new Error('Not found'));

    const { result } = renderHook(
      () => useLearningModules('123'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.modules).toHaveLength(0);
  });
});

describe('useClassroomResources', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch class resources on mount', async () => {
    const mockResources = {
      status: 'success',
      mode: 'class',
      summary: { total: 2, approved: 1, pending: 1, rejected: 0 },
      resources: [
        { resource_id: 'r1', title: 'Video 1', approval_status: 'approved' },
        { resource_id: 'r2', title: 'Article 1', approval_status: 'pending' },
      ],
    };

    apiClient.default.get.mockResolvedValue(mockResources);

    const { result } = renderHook(
      () => useClassroomResources('123', 'class'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.resources).toHaveLength(2);
    expect(result.current.summary.total).toBe(2);
  });

  it('should approve a resource and refetch class mode', async () => {
    apiClient.default.get.mockResolvedValue({
      status: 'success',
      mode: 'class',
      summary: { total: 1, approved: 0, pending: 1, rejected: 0 },
      resources: [{ resource_id: 'r1', title: 'Resource A', approval_status: 'pending' }],
    });
    apiClient.default.patch.mockResolvedValue({
      status: 'success',
      resource_id: 'r1',
      approval_status: 'approved',
    });

    const { result } = renderHook(
      () => useClassroomResources('123', 'class'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.approveResource('r1', true);
    });

    expect(apiClient.default.patch).toHaveBeenCalledWith(
      '/api/classroom/123/resources/r1/approval',
      { approved: true }
    );
  });
});
