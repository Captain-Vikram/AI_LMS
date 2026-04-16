// Classroom Types & Interfaces

export interface User {
  user_id: string;
  email: string;
  name: string;
  role: 'student' | 'teacher' | 'admin';
}

export interface StudentGroup {
  _id: string;
  name: string;
  description?: string;
  students: string[];
  created_date: string;
}

export interface Classroom {
  _id: string;
  name: string;
  subject: string;
  grade_level: string;
  teacher_id: string;
  students: string[];
  student_groups: StudentGroup[];
  enrollment_code: string;
  status: 'active' | 'archived';
  created_date: string;
  description?: string;
}

export interface Assignment {
  assignment_id: string;
  title: string;
  description: string;
  due_date: string;
  total_points: number;
  status: 'draft' | 'published' | 'closed';
}

export interface Announcement {
  announcement_id: string;
  title: string;
  content: string;
  created_by: string;
  created_date: string;
  views: number;
  viewed_by: string[];
  target_groups?: string[];
}

export interface TeacherDashboard {
  classroom_id: string;
  classroom_name: string;
  classroom_subject: string;
  classroom_grade: string;
  student_count: number;
  recent_submissions: SubmissionInfo[];
  pending_assignments: Assignment[];
  recent_announcements: Announcement[];
}

export interface StudentDashboard {
  classroom_id: string;
  classroom_name: string;
  classroom_subject: string;
  teacher_name: string;
  pending_assignments: AssignmentWithStatus[];
  announcements: Announcement[];
  modules: LearningModule[];
}

export interface SubmissionInfo {
  assignment_id: string;
  student_id: string;
  status: string;
  submitted_date: string;
}

export interface AssignmentWithStatus {
  assignment_id: string;
  title: string;
  description?: string;
  due_date: string;
  points: number;
  submission_status: {
    submitted: boolean;
    status: string;
    score: number | null;
  };
}

export interface LearningModule {
  module_id: string;
  name: string;
  order: number;
  description?: string;
  estimated_hours: number;
  difficulty_level: 'easy' | 'medium' | 'hard';
  objectives?: LearningObjective[];
  resources?: ModuleResource[];
}

export interface LearningObjective {
  id: string;
  title: string;
  description: string;
  bloom_level: string;
}

export interface ModuleResource {
  id: string;
  title: string;
  resource_type: 'video' | 'document' | 'link' | 'quiz';
  url: string;
  description?: string;
}

export interface ClassroomOverview {
  classroom_id: string;
  name: string;
  subject: string;
  grade_level: string;
  student_count: number;
  assignment_count: number;
  module_count: number;
  status: string;
  created_date: string;
}

export interface StudentProgress {
  student_id: string;
  classroom_id: string;
  total_earned_points: number;
  total_possible_points: number;
  average_score_percentage: number;
  assignments_completed: number;
  module_progress: ModuleProgress[];
}

export interface ModuleProgress {
  module_id: string;
  module_name: string;
  completed_assessments: number;
  total_assessments: number;
  completion_percentage: number;
}

export interface ClassroomAnalytics {
  classroom_id: string;
  classroom_name: string;
  total_students: number;
  average_class_score: number;
  assignment_completion_rate: number;
  student_analytics: StudentProgress[];
}

export interface RosterStudent {
  user_id: string;
  email: string;
  name: string;
  role: string;
}

export interface EnrollmentResponse {
  classroom_id: string;
  student_id: string;
  status: string;
}

export interface BulkEnrollmentResponse {
  success: number;
  failed: number;
  errors: Array<{ student_id: string; error: string }>;
}
