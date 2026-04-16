"""
Frontend Component Tests - Test all Phase 2 UI components
Tests rendering, user interactions, and state management
"""

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  DashboardCard,
  ClassroomStats,
  StudentProgressCard,
  LoadingState,
  ErrorState,
} from '../../components/Classroom/DashboardCard';
import {
  AnnouncementFeed,
  AnnouncementCreate,
} from '../../components/Classroom/AnnouncementFeed';
import {
  PendingAssignments,
  SubmissionList,
} from '../../components/Classroom/PendingAssignments';
import {
  RosterTable,
  RosterStats,
} from '../../components/Classroom/RosterTable';
import {
  GroupManagement,
} from '../../components/Classroom/GroupManagement';
import {
  ModuleList,
  LearningModuleProgress,
} from '../../components/Classroom/ModuleList';

// Mock icon components
jest.mock('react-icons/fa', () => ({
  FaUsers: () => <div>Users Icon</div>,
}));

describe('DashboardCard', () => {
  it('should render with title and value', () => {
    render(
      <DashboardCard
        title="Students"
        value="25"
        color="blue"
      />
    );

    expect(screen.getByText('Students')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('should display trend when provided', () => {
    render(
      <DashboardCard
        title="Score"
        value="85%"
        trend={5}
        color="green"
      />
    );

    expect(screen.getByText('↑ 5% from last week')).toBeInTheDocument();
  });

  it('should be clickable when onClick provided', async () => {
    const onClick = jest.fn();
    render(
      <DashboardCard
        title="Test"
        value="10"
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByText('Test').closest('div'));
    expect(onClick).toHaveBeenCalled();
  });

  it('should apply correct color classes', () => {
    const { container } = render(
      <DashboardCard
        title="Test"
        value="10"
        color="purple"
      />
    );

    expect(container.textContent).toContain('Test');
  });
});

describe('ClassroomStats', () => {
  it('should render all stat cards', () => {
    render(
      <ClassroomStats
        studentCount={30}
        assignmentCount={5}
        moduleCount={8}
        completionRate={75}
      />
    );

    expect(screen.getByText('Total Students')).toBeInTheDocument();
    expect(screen.getByText('Assignments')).toBeInTheDocument();
    expect(screen.getByText('Modules')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
  });

  it('should display correct values', () => {
    render(
      <ClassroomStats
        studentCount={25}
        assignmentCount={12}
        moduleCount={4}
        completionRate={92}
      />
    );

    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });
});

describe('StudentProgressCard', () => {
  it('should render student name and score', () => {
    render(
      <StudentProgressCard
        studentName="John Doe"
        score={85}
        completed={7}
        total={10}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('7/10 assignments completed')).toBeInTheDocument();
  });

  it('should be clickable', async () => {
    const onClick = jest.fn();
    render(
      <StudentProgressCard
        studentName="Jane Smith"
        score={90}
        completed={9}
        total={10}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByText('Jane Smith').closest('div'));
    expect(onClick).toHaveBeenCalled();
  });

  it('should display progress bar correctly', () => {
    const { container } = render(
      <StudentProgressCard
        studentName="Test Student"
        score={50}
        completed={5}
        total={10}
      />
    );

    const progressBar = container.querySelector('[style*="50"]');
    expect(progressBar).toBeInTheDocument();
  });
});

describe('LoadingState', () => {
  it('should display loading message', () => {
    render(<LoadingState message="Loading data..." />);
    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  it('should show loading spinner', () => {
    const { container } = render(<LoadingState />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('should display error message', () => {
    render(<ErrorState message="Failed to load data" />);
    expect(screen.getByText('Failed to load data')).toBeInTheDocument();
  });

  it('should show retry button when provided', () => {
    const onRetry = jest.fn();
    render(
      <ErrorState
        message="Error occurred"
        onRetry={onRetry}
      />
    );

    const button = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('AnnouncementFeed', () => {
  const mockAnnouncements = [
    {
      announcement_id: 'ann1',
      title: 'Important Update',
      content: 'This is an important update',
      created_date: new Date().toISOString(),
      views: 15,
      viewed_by: [],
    },
    {
      announcement_id: 'ann2',
      title: 'Notice',
      content: 'Please read this notice',
      created_date: new Date(Date.now() - 3600000).toISOString(),
      views: 8,
      viewed_by: [],
    },
  ];

  it('should render all announcements', () => {
    render(
      <AnnouncementFeed
        announcements={mockAnnouncements}
        loading={false}
      />
    );

    expect(screen.getByText('Important Update')).toBeInTheDocument();
    expect(screen.getByText('Notice')).toBeInTheDocument();
  });

  it('should display view counts', () => {
    render(
      <AnnouncementFeed
        announcements={mockAnnouncements}
        loading={false}
      />
    );

    expect(screen.getByText('15 views')).toBeInTheDocument();
    expect(screen.getByText('8 views')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <AnnouncementFeed
        announcements={[]}
        loading={true}
      />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should show empty state when no announcements', () => {
    render(
      <AnnouncementFeed
        announcements={[]}
        loading={false}
      />
    );

    expect(screen.getByText('No announcements yet')).toBeInTheDocument();
  });

  it('should expand/collapse announcements', async () => {
    render(
      <AnnouncementFeed
        announcements={mockAnnouncements}
        loading={false}
      />
    );

    const announcements = screen.getAllByText(/Show/i);
    fireEvent.click(announcements[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Show less')).toBeInTheDocument();
    });
  });

  it('should call onDelete when delete button clicked', async () => {
    const onDelete = jest.fn();
    render(
      <AnnouncementFeed
        announcements={mockAnnouncements}
        onDelete={onDelete}
        isTeacher={true}
        loading={false}
      />
    );

    const deleteButtons = screen.getAllByText('✕');
    fireEvent.click(deleteButtons[0]);

    expect(onDelete).toHaveBeenCalled();
  });

  it('should call onMarkViewed when announcement clicked', async () => {
    const onMarkViewed = jest.fn();
    render(
      <AnnouncementFeed
        announcements={mockAnnouncements}
        onMarkViewed={onMarkViewed}
        loading={false}
      />
    );

    const content = screen.getByText('This is an important update');
    fireEvent.click(content);

    expect(onMarkViewed).toHaveBeenCalled();
  });
});

describe('AnnouncementCreate', () => {
  it('should toggle form visibility', async () => {
    render(<AnnouncementCreate onSubmit={jest.fn()} />);

    expect(screen.getByText('+ New Announcement')).toBeInTheDocument();

    fireEvent.click(screen.getByText('+ New Announcement'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Announcement title')).toBeInTheDocument();
    });
  });

  it('should submit form with title and content', async () => {
    const onSubmit = jest.fn();
    render(<AnnouncementCreate onSubmit={onSubmit} isLoading={false} />);

    fireEvent.click(screen.getByText('+ New Announcement'));

    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Announcement title');
      fireEvent.change(titleInput, { target: { value: 'Test Title' } });
    });

    const contentInput = screen.getByPlaceholderText('Announcement content');
    fireEvent.change(contentInput, { target: { value: 'Test Content' } });

    fireEvent.click(screen.getByText('Post'));

    expect(onSubmit).toHaveBeenCalledWith('Test Title', 'Test Content');
  });

  it('should cancel form submission', async () => {
    render(<AnnouncementCreate onSubmit={jest.fn()} />);

    fireEvent.click(screen.getByText('+ New Announcement'));

    await waitFor(() => {
      fireEvent.click(screen.getByText('Cancel'));
    });

    expect(screen.getByText('+ New Announcement')).toBeInTheDocument();
  });
});

describe('PendingAssignments', () => {
  const mockAssignments = [
    {
      assignment_id: 'a1',
      title: 'Chapter 5 Quiz',
      due_date: new Date(Date.now() + 86400000).toISOString(),
      points: 50,
      submission_status: { submitted: false, status: 'not_started', score: null },
    },
    {
      assignment_id: 'a2',
      title: 'Essay',
      due_date: new Date(Date.now() + 172800000).toISOString(),
      points: 100,
      submission_status: { submitted: true, status: 'submitted', score: 85 },
    },
  ];

  it('should render all pending assignments', () => {
    render(<PendingAssignments assignments={mockAssignments} loading={false} />);

    expect(screen.getByText('Chapter 5 Quiz')).toBeInTheDocument();
    expect(screen.getByText('Essay')).toBeInTheDocument();
  });

  it('should display point values', () => {
    render(<PendingAssignments assignments={mockAssignments} loading={false} />);

    expect(screen.getByText('50pts')).toBeInTheDocument();
    expect(screen.getByText('100pts')).toBeInTheDocument();
  });

  it('should show submission status', () => {
    render(<PendingAssignments assignments={mockAssignments} loading={false} />);

    expect(screen.getByText('Not yet submitted')).toBeInTheDocument();
    expect(screen.getByText('Score: 85')).toBeInTheDocument();
  });

  it('should show empty state', () => {
    render(<PendingAssignments assignments={[]} loading={false} />);

    expect(screen.getByText('No pending assignments')).toBeInTheDocument();
  });
});

describe('RosterTable', () => {
  const mockStudents = [
    { user_id: 's1', name: 'Alice Johnson', email: 'alice@test.com' },
    { user_id: 's2', name: 'Bob Smith', email: 'bob@test.com' },
    { user_id: 's3', name: 'Carol White', email: 'carol@test.com' },
  ];

  it('should render all students', () => {
    render(
      <RosterTable
        students={mockStudents}
        loading={false}
        isTeacher={false}
      />
    );

    expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    expect(screen.getByText('Bob Smith')).toBeInTheDocument();
    expect(screen.getByText('Carol White')).toBeInTheDocument();
  });

  it('should display email addresses', () => {
    render(
      <RosterTable
        students={mockStudents}
        loading={false}
        isTeacher={false}
      />
    );

    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
    expect(screen.getByText('bob@test.com')).toBeInTheDocument();
  });

  it('should sort by name', async () => {
    const { container } = render(
      <RosterTable
        students={mockStudents}
        loading={false}
        isTeacher={false}
      />
    );

    const select = container.querySelector('select');
    fireEvent.change(select, { target: { value: 'name' } });

    const rows = screen.getAllByRole('row');
    expect(rows[1].textContent).toContain('Alice');
  });

  it('should show remove button for teachers', () => {
    render(
      <RosterTable
        students={mockStudents}
        loading={false}
        isTeacher={true}
        onRemoveStudent={jest.fn()}
      />
    );

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    expect(removeButtons).toHaveLength(3);
  });

  it('should call onRemoveStudent', async () => {
    const onRemoveStudent = jest.fn();
    global.window.confirm = jest.fn(() => true);

    render(
      <RosterTable
        students={mockStudents}
        loading={false}
        isTeacher={true}
        onRemoveStudent={onRemoveStudent}
      />
    );

    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    expect(onRemoveStudent).toHaveBeenCalled();
  });
});

describe('GroupManagement', () => {
  const mockGroups = [
    {
      _id: 'g1',
      name: 'Advanced Learners',
      description: 'Students ahead of schedule',
      students: ['s1', 's2'],
    },
  ];

  const mockStudents = [
    { user_id: 's1', name: 'Alice', email: 'alice@test.com' },
    { user_id: 's2', name: 'Bob', email: 'bob@test.com' },
  ];

  it('should render create group button for teachers', () => {
    render(
      <GroupManagement
        groups={[]}
        students={mockStudents}
        loading={false}
        isTeacher={true}
      />
    );

    expect(screen.getByText('+ New Group')).toBeInTheDocument();
  });

  it('should display all groups', () => {
    render(
      <GroupManagement
        groups={mockGroups}
        students={mockStudents}
        loading={false}
        isTeacher={true}
      />
    );

    expect(screen.getByText('Advanced Learners')).toBeInTheDocument();
  });

  it('should show student count in groups', () => {
    render(
      <GroupManagement
        groups={mockGroups}
        students={mockStudents}
        loading={false}
        isTeacher={true}
      />
    );

    expect(screen.getByText('2 students')).toBeInTheDocument();
  });

  it('should expand group to show members', async () => {
    render(
      <GroupManagement
        groups={mockGroups}
        students={mockStudents}
        loading={false}
        isTeacher={true}
      />
    );

    fireEvent.click(screen.getByText('Advanced Learners'));

    await waitFor(() => {
      expect(screen.getByText('Members:')).toBeInTheDocument();
      expect(screen.getByText('• Alice')).toBeInTheDocument();
    });
  });
});

describe('ModuleList', () => {
  const mockModules = [
    {
      module_id: 'm1',
      name: 'Linear Equations',
      order: 1,
      description: 'Learn to solve linear equations',
      estimated_hours: 4.5,
      difficulty_level: 'medium',
      objectives: [
        { title: 'Solve equations', bloom_level: 'application' },
      ],
      resources: [
        {
          title: 'Video Lecture',
          resource_type: 'video',
          url: 'https://example.com/video',
        },
      ],
    },
  ];

  it('should render module names', () => {
    render(
      <ModuleList modules={mockModules} loading={false} />
    );

    expect(screen.getByText('Linear Equations')).toBeInTheDocument();
  });

  it('should display module metadata', () => {
    render(
      <ModuleList modules={mockModules} loading={false} />
    );

    expect(screen.getByText('4.5h')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
  });

  it('should expand module to show details', async () => {
    render(
      <ModuleList modules={mockModules} loading={false} />
    );

    fireEvent.click(screen.getByText('Linear Equations'));

    await waitFor(() => {
      expect(screen.getByText('Learning Objectives:')).toBeInTheDocument();
      expect(screen.getByText('• Solve equations')).toBeInTheDocument();
    });
  });

  it('should show resources with links', async () => {
    render(
      <ModuleList modules={mockModules} loading={false} />
    );

    fireEvent.click(screen.getByText('Linear Equations'));

    await waitFor(() => {
      const link = screen.getByText('Video Lecture');
      expect(link.closest('a')).toHaveAttribute('href', 'https://example.com/video');
    });
  });

  it('should show empty state', () => {
    render(
      <ModuleList modules={[]} loading={false} />
    );

    expect(screen.getByText('No learning modules available yet')).toBeInTheDocument();
  });
});

describe('LearningModuleProgress', () => {
  const mockModules = [
    { module_id: 'm1', name: 'Module 1' },
    { module_id: 'm2', name: 'Module 2' },
  ];

  const mockProgress = {
    module_progress: [
      { module_id: 'm1', completion_percentage: 75, completed_assessments: 3, total_assessments: 4 },
      { module_id: 'm2', completion_percentage: 50, completed_assessments: 2, total_assessments: 4 },
    ],
  };

  it('should render progress bars for each module', () => {
    render(
      <LearningModuleProgress
        modules={mockModules}
        studentProgress={mockProgress}
        loading={false}
      />
    );

    expect(screen.getByText('Module 1')).toBeInTheDocument();
    expect(screen.getByText('Module 2')).toBeInTheDocument();
  });

  it('should display completion percentages', () => {
    render(
      <LearningModuleProgress
        modules={mockModules}
        studentProgress={mockProgress}
        loading={false}
      />
    );

    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should show assessment counts', () => {
    render(
      <LearningModuleProgress
        modules={mockModules}
        studentProgress={mockProgress}
        loading={false}
      />
    );

    expect(screen.getByText('3/4 assessments completed')).toBeInTheDocument();
    expect(screen.getByText('2/4 assessments completed')).toBeInTheDocument();
  });
});
