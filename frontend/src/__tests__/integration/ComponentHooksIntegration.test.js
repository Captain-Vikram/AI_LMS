"""
Frontend Integration Tests - Hooks + Components
Tests complex interactions between components and hooks
"""

import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderHook, act } from '@testing-library/react-hooks';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClassroomDashboard from '../pages/Classroom/ClassroomDashboard';
import ClassroomRoster from '../pages/Classroom/ClassroomRoster';
import LearningModules from '../pages/Classroom/LearningModules';
import ClassroomSettings from '../pages/Classroom/ClassroomSettings';
import { ClassroomProvider } from '../context/ClassroomContext';
import * as useClassroomHooks from '../hooks/useClassroom';

// Mock API client
jest.mock('../services/apiClient');
import apiClient from '../services/apiClient';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Test data
const mockClassroom = {
  _id: 'cls_123',
  name: 'Biology 101',
  subject: 'Science',
  grade_level: '10',
  teacher_id: 'teacher_1',
  students: ['stu_1', 'stu_2', 'stu_3'],
};

const mockDashboard = {
  classroom_id: 'cls_123',
  role: 'teacher',
  stats: {
    total_students: 3,
    submissions_pending: 2,
    average_score: 87.5,
  },
  announcements: [
    {
      _id: 'ann_1',
      title: 'Welcome',
      content: 'Welcome to class',
      view_count: 3,
    },
  ],
};

const mockAnnouncements = [
  {
    _id: 'ann_1',
    title: 'First Announcement',
    content: 'Content 1',
    view_count: 10,
  },
  {
    _id: 'ann_2',
    title: 'Second Announcement',
    content: 'Content 2',
    view_count: 8,
  },
];

const mockStudents = [
  { _id: 'stu_1', name: 'Student 1', email: 'stu1@test.com', role: 'student' },
  { _id: 'stu_2', name: 'Student 2', email: 'stu2@test.com', role: 'student' },
  { _id: 'stu_3', name: 'Student 3', email: 'stu3@test.com', role: 'student' },
];

const mockModules = [
  {
    _id: 'mod_1',
    name: 'Cell Structure',
    description: 'Understanding cells',
    objectives: ['Learn about cells'],
    resources: [
      { type: 'video', title: 'Cell Video', url: 'http://example.com/video' },
    ],
  },
];

const createQueryClient = () => new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('Frontend Integration - Hooks + Components', () => {
  let queryClient;

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient = createQueryClient();
    localStorage.clear();
  });

  // ============================================================
  // Teacher Dashboard Integration Tests
  // ============================================================

  describe('Teacher Dashboard Integration', () => {
    it('should load and display teacher dashboard with all data', async () => {
      jest.spyOn(useClassroomHooks, 'useClassroomDashboard').mockReturnValue({
        loading: false,
        error: null,
        dashboard: mockDashboard,
        refresh: jest.fn(),
      });

      jest.spyOn(useClassroomHooks, 'useAnnouncements').mockReturnValue({
        announcements: mockAnnouncements,
        loading: false,
        error: null,
        createAnnouncement: jest.fn(),
        deleteAnnouncement: jest.fn(),
        markViewed: jest.fn(),
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomDashboard classroomId="cls_123" userRole="teacher" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Biology 101')).toBeInTheDocument();
        expect(screen.getByText('Welcome')).toBeInTheDocument();
        expect(screen.getByText('Class Statistics')).toBeInTheDocument();
      });
    });

    it('should create announcement on form submit', async () => {
      const createAnnouncement = jest.fn().mockResolvedValue({ _id: 'ann_new' });

      jest.spyOn(useClassroomHooks, 'useClassroomDashboard').mockReturnValue({
        loading: false,
        error: null,
        dashboard: mockDashboard,
        refresh: jest.fn(),
      });

      jest.spyOn(useClassroomHooks, 'useAnnouncements').mockReturnValue({
        announcements: mockAnnouncements,
        loading: false,
        error: null,
        createAnnouncement,
        deleteAnnouncement: jest.fn(),
        markViewed: jest.fn(),
      });

      const { getByText, getByPlaceholderText } = render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomDashboard classroomId="cls_123" userRole="teacher" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      // Expand create form
      const createButton = screen.getByText('Create Announcement');
      fireEvent.click(createButton);

      await waitFor(() => {
        const titleInput = screen.getByPlaceholderText('Announcement title');
        const contentInput = screen.getByPlaceholderText('Content');

        fireEvent.change(titleInput, { target: { value: 'New Announcement' } });
        fireEvent.change(contentInput, { target: { value: 'Important message' } });

        const submitButton = screen.getByText('Post');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(createAnnouncement).toHaveBeenCalledWith({
          title: 'New Announcement',
          content: 'Important message',
        });
      });
    });

    it('should delete announcement with confirmation', async () => {
      const deleteAnnouncement = jest.fn().mockResolvedValue({ success: true });

      jest.spyOn(useClassroomHooks, 'useClassroomDashboard').mockReturnValue({
        loading: false,
        error: null,
        dashboard: mockDashboard,
        refresh: jest.fn(),
      });

      jest.spyOn(useClassroomHooks, 'useAnnouncements').mockReturnValue({
        announcements: mockAnnouncements,
        loading: false,
        error: null,
        createAnnouncement: jest.fn(),
        deleteAnnouncement,
        markViewed: jest.fn(),
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomDashboard classroomId="cls_123" userRole="teacher" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const deleteButtons = screen.getAllByText('Delete');
        fireEvent.click(deleteButtons[0]);
      });

      await waitFor(() => {
        expect(deleteAnnouncement).toHaveBeenCalledWith('ann_1');
      });
    });
  });

  // ============================================================
  // Student Dashboard Integration Tests
  // ============================================================

  describe('Student Dashboard Integration', () => {
    it('should display student-specific dashboard view', async () => {
      const studentDashboard = {
        ...mockDashboard,
        role: 'student',
        assignments: [
          { _id: 'asn_1', title: 'Quiz 1', due_date: '2024-12-25', status: 'pending' },
        ],
      };

      jest.spyOn(useClassroomHooks, 'useClassroomDashboard').mockReturnValue({
        loading: false,
        error: null,
        dashboard: studentDashboard,
        refresh: jest.fn(),
      });

      jest.spyOn(useClassroomHooks, 'useAnnouncements').mockReturnValue({
        announcements: mockAnnouncements,
        loading: false,
        error: null,
        createAnnouncement: jest.fn(),
        deleteAnnouncement: jest.fn(),
        markViewed: jest.fn(),
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomDashboard classroomId="cls_123" userRole="student" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Pending Assignments')).toBeInTheDocument();
        expect(screen.getByText('Quiz 1')).toBeInTheDocument();
      });

      // Verify "Create Announcement" button doesn't exist for student
      expect(screen.queryByText('Create Announcement')).not.toBeInTheDocument();
    });

    it('should track announcement views for students', async () => {
      const markViewed = jest.fn().mockResolvedValue({ success: true });

      jest.spyOn(useClassroomHooks, 'useClassroomDashboard').mockReturnValue({
        loading: false,
        error: null,
        dashboard: mockDashboard,
        refresh: jest.fn(),
      });

      jest.spyOn(useClassroomHooks, 'useAnnouncements').mockReturnValue({
        announcements: mockAnnouncements,
        loading: false,
        error: null,
        createAnnouncement: jest.fn(),
        deleteAnnouncement: jest.fn(),
        markViewed,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomDashboard classroomId="cls_123" userRole="student" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const announcements = screen.getAllByText(/Announcement/);
        fireEvent.click(announcements[0]);
      });

      await waitFor(() => {
        expect(markViewed).toHaveBeenCalled();
      });
    });
  });

  // ============================================================
  // Roster Management Integration Tests
  // ============================================================

  describe('Roster Management Integration', () => {
    it('should load and display student roster', async () => {
      jest.spyOn(useClassroomHooks, 'useEnrollment').mockReturnValue({
        roster: mockStudents,
        loading: false,
        error: null,
        enrollStudent: jest.fn(),
        removeStudent: jest.fn(),
        bulkUpload: jest.fn(),
        getRoster: jest.fn(),
      });

      jest.spyOn(useClassroomHooks, 'useStudentGroups').mockReturnValue({
        groups: [],
        loading: false,
        error: null,
        createGroup: jest.fn(),
        addToGroup: jest.fn(),
        getGroups: jest.fn(),
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomRoster classroomId="cls_123" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Student 1')).toBeInTheDocument();
        expect(screen.getByText('stu1@test.com')).toBeInTheDocument();
        expect(screen.getByText('Student 2')).toBeInTheDocument();
        expect(screen.getByText('Student 3')).toBeInTheDocument();
      });
    });

    it('should remove student from roster', async () => {
      const removeStudent = jest.fn().mockResolvedValue({ success: true });

      jest.spyOn(useClassroomHooks, 'useEnrollment').mockReturnValue({
        roster: mockStudents,
        loading: false,
        error: null,
        enrollStudent: jest.fn(),
        removeStudent,
        bulkUpload: jest.fn(),
        getRoster: jest.fn(),
      });

      jest.spyOn(useClassroomHooks, 'useStudentGroups').mockReturnValue({
        groups: [],
        loading: false,
        error: null,
        createGroup: jest.fn(),
        addToGroup: jest.fn(),
        getGroups: jest.fn(),
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomRoster classroomId="cls_123" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const removeButtons = screen.getAllByText('Remove');
        fireEvent.click(removeButtons[0]);
      });

      await waitFor(() => {
        expect(removeStudent).toHaveBeenCalledWith('cls_123', 'stu_1');
      });
    });

    it('should handle bulk CSV upload', async () => {
      const bulkUpload = jest.fn().mockResolvedValue({
        success: 2,
        failed: 0,
      });

      jest.spyOn(useClassroomHooks, 'useEnrollment').mockReturnValue({
        roster: mockStudents,
        loading: false,
        error: null,
        enrollStudent: jest.fn(),
        removeStudent: jest.fn(),
        bulkUpload,
        getRoster: jest.fn(),
      });

      jest.spyOn(useClassroomHooks, 'useStudentGroups').mockReturnValue({
        groups: [],
        loading: false,
        error: null,
        createGroup: jest.fn(),
        addToGroup: jest.fn(),
        getGroups: jest.fn(),
      });

      const { getByText, getByLabelText } = render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomRoster classroomId="cls_123" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      // Create mock file
      const file = new File(
        ['email,name\nnew1@test.com,New Student 1\nnew2@test.com,New Student 2'],
        'students.csv',
        { type: 'text/csv' }
      );

      await waitFor(() => {
        const fileInput = getByLabelText('Upload CSV');
        fireEvent.change(fileInput, { target: { files: [file] } });

        const uploadButton = getByText('Upload Students');
        fireEvent.click(uploadButton);
      });

      await waitFor(() => {
        expect(bulkUpload).toHaveBeenCalled();
      });
    });

    it('should create and manage student groups', async () => {
      const createGroup = jest.fn().mockResolvedValue({
        group_id: 'grp_1',
        name: 'Advanced',
      });

      const addToGroup = jest.fn().mockResolvedValue({ success: true });

      jest.spyOn(useClassroomHooks, 'useEnrollment').mockReturnValue({
        roster: mockStudents,
        loading: false,
        error: null,
        enrollStudent: jest.fn(),
        removeStudent: jest.fn(),
        bulkUpload: jest.fn(),
        getRoster: jest.fn(),
      });

      jest.spyOn(useClassroomHooks, 'useStudentGroups').mockReturnValue({
        groups: [{ _id: 'grp_1', name: 'Advanced', members: [] }],
        loading: false,
        error: null,
        createGroup,
        addToGroup,
        getGroups: jest.fn(),
      });

      const { getByText, getByPlaceholderText } = render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomRoster classroomId="cls_123" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      // Switch to Groups tab
      const groupsTab = screen.getByText('Groups');
      fireEvent.click(groupsTab);

      await waitFor(() => {
        const createGroupButton = screen.getByText('Create Group');
        fireEvent.click(createGroupButton);
      });

      await waitFor(() => {
        const groupNameInput = getByPlaceholderText('Group name');
        fireEvent.change(groupNameInput, { target: { value: 'Advanced' } });

        const submitButton = screen.getByText('Create');
        fireEvent.click(submitButton);
      });

      await waitFor(() => {
        expect(createGroup).toHaveBeenCalledWith(
          'cls_123',
          'Advanced',
          expect.any(String)
        );
      });
    });
  });

  // ============================================================
  // Learning Modules Integration Tests
  // ============================================================

  describe('Learning Modules Integration', () => {
    it('should load and display learning modules', async () => {
      jest.spyOn(useClassroomHooks, 'useLearningModules').mockReturnValue({
        modules: mockModules,
        loading: false,
        error: null,
      });

      jest.spyOn(useClassroomHooks, 'useClassroomAnalytics').mockReturnValue({
        analytics: {
          total_modules: 1,
          modules_completed: 0,
          estimated_hours: 5,
        },
        loading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <LearningModules classroomId="cls_123" studentId="stu_1" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Cell Structure')).toBeInTheDocument();
        expect(screen.getByText('Understanding cells')).toBeInTheDocument();
      });
    });

    it('should expand module to show resources', async () => {
      jest.spyOn(useClassroomHooks, 'useLearningModules').mockReturnValue({
        modules: mockModules,
        loading: false,
        error: null,
      });

      jest.spyOn(useClassroomHooks, 'useClassroomAnalytics').mockReturnValue({
        analytics: {
          total_modules: 1,
          modules_completed: 0,
          estimated_hours: 5,
        },
        loading: false,
        error: null,
      });

      const { getByText, getByPlaceholderText } = render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <LearningModules classroomId="cls_123" studentId="stu_1" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const expandButton = screen.getByText('Expand');
        fireEvent.click(expandButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Cell Video')).toBeInTheDocument();
      });
    });

    it('should display progress statistics', async () => {
      jest.spyOn(useClassroomHooks, 'useLearningModules').mockReturnValue({
        modules: mockModules,
        loading: false,
        error: null,
      });

      jest.spyOn(useClassroomHooks, 'useClassroomAnalytics').mockReturnValue({
        analytics: {
          total_modules: 1,
          modules_completed: 0,
          estimated_hours: 5,
          completion_percentage: 0,
        },
        loading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <LearningModules classroomId="cls_123" studentId="stu_1" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument(); // total modules
        expect(screen.getByText('5 hours')).toBeInTheDocument(); // estimated hours
      });
    });
  });

  // ============================================================
  // Settings Integration Tests
  // ============================================================

  describe('Classroom Settings Integration', () => {
    it('should load and display classroom settings', async () => {
      apiClient.get.mockResolvedValue({
        data: mockClassroom,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomSettings classroomId="cls_123" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByDisplayValue('Biology 101')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Science')).toBeInTheDocument();
      });
    });

    it('should display enrollment code', async () => {
      apiClient.get.mockResolvedValue({
        data: {
          ...mockClassroom,
          enrollment_code: 'BIO2024',
        },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomSettings classroomId="cls_123" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('BIO2024')).toBeInTheDocument();
      });
    });

    it('should copy enrollment code to clipboard', async () => {
      const clipboardMock = jest.fn();
      Object.assign(navigator, { clipboard: { writeText: clipboardMock } });

      apiClient.get.mockResolvedValue({
        data: {
          ...mockClassroom,
          enrollment_code: 'BIO2024',
        },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomSettings classroomId="cls_123" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const copyButton = screen.getByText('Copy');
        fireEvent.click(copyButton);
      });

      await waitFor(() => {
        expect(clipboardMock).toHaveBeenCalledWith('BIO2024');
      });
    });

    it('should edit classroom settings', async () => {
      apiClient.get.mockResolvedValue({
        data: mockClassroom,
      });

      apiClient.put.mockResolvedValue({
        data: { ...mockClassroom, name: 'Advanced Biology 101' },
      });

      const { getByDisplayValue } = render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomSettings classroomId="cls_123" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        const nameInput = getByDisplayValue('Biology 101');
        fireEvent.change(nameInput, { target: { value: 'Advanced Biology 101' } });

        const saveButton = screen.getByText('Save Changes');
        fireEvent.click(saveButton);
      });

      await waitFor(() => {
        expect(apiClient.put).toHaveBeenCalled();
      });
    });
  });

  // ============================================================
  // Analytics Integration Tests
  // ============================================================

  describe('Analytics Integration', () => {
    it('should load teacher analytics data', async () => {
      jest.spyOn(useClassroomHooks, 'useClassroomAnalytics').mockReturnValue({
        analytics: {
          classroom_id: 'cls_123',
          total_students: 3,
          average_score: 87.5,
          completion_rate: 0.85,
        },
        loading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomDashboard classroomId="cls_123" userRole="teacher" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('87.5')).toBeInTheDocument(); // average score
        expect(screen.getByText('85%')).toBeInTheDocument(); // completion rate
      });
    });

    it('should show student progress analytics', async () => {
      const studentAnalytics = {
        student_id: 'stu_1',
        modules_completed: 7,
        total_modules: 10,
        average_score: 88.5,
      };

      jest.spyOn(useClassroomHooks, 'useClassroomAnalytics').mockReturnValue({
        analytics: studentAnalytics,
        loading: false,
        error: null,
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <LearningModules classroomId="cls_123" studentId="stu_1" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('7 of 10')).toBeInTheDocument(); // progress
        expect(screen.getByText('88.5%')).toBeInTheDocument(); // average score
      });
    });
  });

  // ============================================================
  // Error Handling Integration Tests
  // ============================================================

  describe('Error Handling Integration', () => {
    it('should display error state when data fetch fails', async () => {
      jest.spyOn(useClassroomHooks, 'useClassroomDashboard').mockReturnValue({
        loading: false,
        error: 'Failed to load classroom',
        dashboard: null,
        refresh: jest.fn(),
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomDashboard classroomId="cls_123" userRole="teacher" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching', async () => {
      jest.spyOn(useClassroomHooks, 'useClassroomDashboard').mockReturnValue({
        loading: true,
        error: null,
        dashboard: null,
        refresh: jest.fn(),
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomDashboard classroomId="cls_123" userRole="teacher" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });

    it('should handle permission errors gracefully', async () => {
      jest.spyOn(useClassroomHooks, 'useEnrollment').mockReturnValue({
        roster: [],
        loading: false,
        error: '403: Only teachers can manage roster',
        enrollStudent: jest.fn(),
        removeStudent: jest.fn(),
        bulkUpload: jest.fn(),
        getRoster: jest.fn(),
      });

      render(
        <QueryClientProvider client={queryClient}>
          <ClassroomProvider>
            <ClassroomRoster classroomId="cls_123" />
          </ClassroomProvider>
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Only teachers/i)).toBeInTheDocument();
      });
    });
  });
});
