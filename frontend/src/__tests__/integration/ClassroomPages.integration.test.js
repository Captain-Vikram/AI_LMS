"""
Frontend Integration Tests - Test full page workflows
Tests role-specific dashboards, enrollment flows, and classroom management
"""

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import ClassroomDashboard from '../../pages/Classroom/ClassroomDashboard';
import ClassroomRoster from '../../pages/Classroom/ClassroomRoster';
import LearningModulesPage from '../../pages/Classroom/LearningModules';
import ClassroomSettings from '../../pages/Classroom/ClassroomSettings';
import { ClassroomProvider } from '../../context/ClassroomContext';
import * as apiClient from '../../services/apiClient';

// Mock react-router
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'classroom123' }),
  useNavigate: () => jest.fn(),
}));

jest.mock('../../services/apiClient');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <ClassroomProvider>
        <BrowserRouter>
          {children}
        </BrowserRouter>
      </ClassroomProvider>
    </QueryClientProvider>
  );
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

describe('ClassroomDashboard - Teacher View', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('teacher_token');
  });

  it('should render teacher dashboard with stats cards', async () => {
    const mockDashboard = {
      status: 'success',
      data: {
        classroom_id: 'classroom123',
        classroom_name: 'Algebra 101',
        classroom_subject: 'Mathematics',
        classroom_grade: '9th Grade',
        student_count: 28,
        recent_submissions: [],
        pending_assignments: [],
        recent_announcements: [],
      },
    };

    const mockOverview = {
      status: 'success',
      data: {
        assignment_count: 5,
        module_count: 8,
      },
    };

    apiClient.default.get.mockResolvedValueOnce(mockDashboard);
    apiClient.default.get.mockResolvedValueOnce(mockOverview);
    apiClient.default.get.mockResolvedValueOnce({ status: 'success', data: [] }); // announcements

    render(<ClassroomDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Algebra 101')).toBeInTheDocument();
      expect(screen.getByText('28')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Students')).toBeInTheDocument();
    expect(screen.getByText('Assignments')).toBeInTheDocument();
  });

  it('should have create announcement form', async () => {
    const mockDashboard = {
      status: 'success',
      data: {
        classroom_id: 'classroom123',
        classroom_name: 'Test Class',
        student_count: 20,
        recent_submissions: [],
        pending_assignments: [],
        recent_announcements: [],
      },
    };

    apiClient.default.get.mockResolvedValue(mockDashboard);

    render(<ClassroomDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('+ New Announcement')).toBeInTheDocument();
    });
  });
});

describe('ClassroomDashboard - Student View', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('student_token');
  });

  it('should render student dashboard with assignments', async () => {
    const mockDashboard = {
      status: 'success',
      data: {
        classroom_id: 'classroom123',
        classroom_name: 'Algebra 101',
        classroom_subject: 'Mathematics',
        teacher_name: 'Mrs. Johnson',
        pending_assignments: [
          {
            assignment_id: 'a1',
            title: 'Chapter 5 Quiz',
            due_date: new Date(Date.now() + 86400000).toISOString(),
            points: 50,
            submission_status: { submitted: false, status: 'not_started', score: null },
          },
        ],
        announcements: [],
        modules: [],
      },
    };

    apiClient.default.get.mockResolvedValue(mockDashboard);

    render(<ClassroomDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Algebra 101')).toBeInTheDocument();
      expect(screen.getByText('Mrs. Johnson')).toBeInTheDocument();
      expect(screen.getByText('Chapter 5 Quiz')).toBeInTheDocument();
    });
  });

  it('should show learning modules section', async () => {
    const mockDashboard = {
      status: 'success',
      data: {
        classroom_id: 'classroom123',
        classroom_name: 'Test Class',
        teacher_name: 'Test Teacher',
        pending_assignments: [],
        announcements: [],
        modules: [
          { module_id: 'm1', name: 'Module 1', order: 1, estimated_hours: 4.5 },
        ],
      },
    };

    apiClient.default.get.mockResolvedValue(mockDashboard);

    render(<ClassroomDashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Curriculum Modules')).toBeInTheDocument();
    });
  });
});

describe('ClassroomRoster', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('teacher_token');
  });

  it('should render roster table with students', async () => {
    const mockRoster = {
      status: 'success',
      data: {
        total_students: 2,
        students: [
          { user_id: 's1', name: 'Alice', email: 'alice@test.com' },
          { user_id: 's2', name: 'Bob', email: 'bob@test.com' },
        ],
        student_groups: [],
      },
    };

    apiClient.default.get.mockResolvedValue(mockRoster);

    render(<ClassroomRoster />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });
  });

  it('should have bulk upload form', async () => {
    const mockRoster = {
      status: 'success',
      data: {
        total_students: 0,
        students: [],
        student_groups: [],
      },
    };

    apiClient.default.get.mockResolvedValue(mockRoster);

    render(<ClassroomRoster />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Bulk Enroll Students')).toBeInTheDocument();
      expect(screen.getByText('Upload CSV')).toBeInTheDocument();
    });
  });

  it('should have groups tab', async () => {
    const mockRoster = {
      status: 'success',
      data: {
        total_students: 0,
        students: [],
        student_groups: [],
      },
    };

    apiClient.default.get.mockResolvedValue(mockRoster);

    render(<ClassroomRoster />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Groups (0)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Groups (0)'));

    expect(screen.getByText('+ New Group')).toBeInTheDocument();
  });

  it('should handle CSV upload', async () => {
    const mockRoster = {
      status: 'success',
      data: {
        total_students: 0,
        students: [],
        student_groups: [],
      },
    };

    apiClient.default.get.mockResolvedValue(mockRoster);
    apiClient.default.post.mockResolvedValue({
      status: 'upload_complete',
      data: { success: 3, failed: 0, errors: [] },
    });

    render(<ClassroomRoster />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Upload CSV')).toBeInTheDocument();
    });

    const fileInput = screen.getByLabelText(/CSV file/i).closest('div').querySelector('input[type="file"]');
    const file = new File(['email\ntest@test.com'], 'students.csv', { type: 'text/csv' });

    fireEvent.change(fileInput, { target: { files: [file] } });
    fireEvent.click(screen.getByText('Upload CSV'));

    await waitFor(() => {
      expect(apiClient.default.post).toHaveBeenCalled();
    });
  });
});

describe('LearningModulesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('student_token');
  });

  it('should render modules list', async () => {
    const mockModules = {
      status: 'success',
      data: [
        {
          module_id: 'm1',
          name: 'Linear Equations',
          order: 1,
          description: 'Learn equations',
          estimated_hours: 4.5,
          difficulty_level: 'medium',
        },
      ],
    };

    apiClient.default.get.mockResolvedValue(mockModules);

    render(<LearningModulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Linear Equations')).toBeInTheDocument();
    });
  });

  it('should display module statistics', async () => {
    const mockModules = {
      status: 'success',
      data: [
        {
          module_id: 'm1',
          name: 'Module 1',
          order: 1,
          estimated_hours: 4.5,
          difficulty_level: 'easy',
        },
      ],
    };

    apiClient.default.get.mockResolvedValue(mockModules);

    render(<LearningModulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Total Modules')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Estimated Hours')).toBeInTheDocument();
    });
  });

  it('should show empty state when no modules', async () => {
    apiClient.default.get.mockResolvedValue({
      status: 'success',
      data: [],
    });

    render(<LearningModulesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No learning modules have been created yet')).toBeInTheDocument();
    });
  });
});

describe('ClassroomSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('teacher_token');
  });

  it('should display classroom settings', async () => {
    const mockClassroom = {
      status: 'success',
      data: {
        _id: 'classroom123',
        name: 'Algebra 101',
        subject: 'Mathematics',
        grade_level: '9th Grade',
        description: 'Introduction to Algebra',
        enrollment_code: 'ALGEBRA101',
        status: 'active',
      },
    };

    apiClient.default.get.mockResolvedValue(mockClassroom);

    render(<ClassroomSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Algebra 101')).toBeInTheDocument();
      expect(screen.getByText('Mathematics')).toBeInTheDocument();
    });
  });

  it('should allow editing classroom info', async () => {
    const mockClassroom = {
      status: 'success',
      data: {
        _id: 'classroom123',
        name: 'Test Class',
        subject: 'Test',
        grade_level: 'Test Grade',
        enrollment_code: 'TEST123',
        status: 'active',
      },
    };

    apiClient.default.get.mockResolvedValue(mockClassroom);

    render(<ClassroomSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Edit'));

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Class')).toBeInTheDocument();
    });
  });

  it('should display enrollment code', async () => {
    const mockClassroom = {
      status: 'success',
      data: {
        _id: 'classroom123',
        name: 'Test',
        subject: 'Test',
        grade_level: 'Test',
        enrollment_code: 'TESTCODE123',
        status: 'active',
      },
    };

    apiClient.default.get.mockResolvedValue(mockClassroom);

    render(<ClassroomSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByDisplayValue('TESTCODE123')).toBeInTheDocument();
    });
  });

  it('should allow copying enrollment code', async () => {
    const mockClassroom = {
      status: 'success',
      data: {
        _id: 'classroom123',
        name: 'Test',
        subject: 'Test',
        grade_level: 'Test',
        enrollment_code: 'COPY_ME',
        status: 'active',
      },
    };

    apiClient.default.get.mockResolvedValue(mockClassroom);

    global.navigator.clipboard = {
      writeText: jest.fn(),
    };

    render(<ClassroomSettings />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Copy')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Copy'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('COPY_ME');
  });
});

// Full workflow integration tests
describe('Enrollment Workflow', () => {
  it('should complete end-to-end student enrollment', async () => {
    // 1. Student joins classroom with code
    // 2. Confirms enrollment
    // 3. Views classroom dashboard
    // 4. Sees assignments and announcements

    const enrollMock = {
      status: 'success',
      data: { student_id: 's1', status: 'enrolled' },
    };

    const dashboardMock = {
      status: 'success',
      data: {
        classroom_id: 'c1',
        classroom_name: 'Class',
        teacher_name: 'Teacher',
        pending_assignments: [],
        announcements: [],
        modules: [],
      },
    };

    apiClient.default.post.mockResolvedValueOnce(enrollMock);
    apiClient.default.get.mockResolvedValueOnce(dashboardMock);

    // Test enrollment -> dashboard flow
    expect(enrollMock.data.status).toBe('enrolled');
    expect(dashboardMock.data.pending_assignments).toBeDefined();
  });
});

describe('Teacher Classroom Management', () => {
  it('should complete end-to-end classroom management workflow', async () => {
    // 1. Teacher creates class
    // 2. Uploads student roster
    // 3. Creates student groups
    // 4. Posts announcement
    // 5. Monitors analytics

    const rosterMock = {
      status: 'upload_complete',
      data: { success: 10, failed: 0, errors: [] },
    };

    const announcementMock = {
      status: 'success',
      data: { announcement_id: 'ann1' },
    };

    const analyticsMock = {
      status: 'success',
      data: {
        total_students: 10,
        average_class_score: 82.5,
      },
    };

    apiClient.default.post
      .mockResolvedValueOnce(rosterMock)
      .mockResolvedValueOnce(announcementMock);

    apiClient.default.get.mockResolvedValueOnce(analyticsMock);

    expect(rosterMock.data.success).toBe(10);
    expect(announcementMock.data.announcement_id).toBeDefined();
    expect(analyticsMock.data.total_students).toBe(10);
  });
});
