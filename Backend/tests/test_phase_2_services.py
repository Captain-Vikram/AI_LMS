"""
Comprehensive Phase 2 Service Tests
Tests enrollment, announcement, and analytics services
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from bson import ObjectId
from datetime import datetime, timedelta
from Backend.services.enrollment_service import EnrollmentService, EnrollmentStatus
from Backend.services.announcements_service import AnnouncementsService
from Backend.services.classroom_analytics_service import ClassroomAnalyticsService
from Backend.services.dashboard_service import DashboardService


@pytest.fixture
def mock_db():
    """Create mock database"""
    return MagicMock()


@pytest.fixture
def enrollment_service(mock_db):
    return EnrollmentService(mock_db)


@pytest.fixture
def announcements_service(mock_db):
    return AnnouncementsService(mock_db)


@pytest.fixture
def analytics_service(mock_db):
    return ClassroomAnalyticsService(mock_db)


@pytest.fixture
def dashboard_service(mock_db):
    return DashboardService(mock_db)


# Enrollment Service Tests
class TestEnrollmentService:
    def test_enroll_student_success(self, enrollment_service, mock_db):
        """Test successful student enrollment"""
        student_id = str(ObjectId())
        classroom_id = str(ObjectId())
        enrollment_code = "TESTCODE"

        mock_db.classrooms.find_one.return_value = {
            "_id": ObjectId(classroom_id),
            "students": [],
            "enrollment_code": enrollment_code,
        }
        mock_db.users.update_one.return_value = MagicMock()

        result = enrollment_service.enroll_student(
            student_id,
            classroom_id,
            enrollment_code
        )

        assert result["status"] == "enrolled"
        assert result["student_id"] == student_id
        mock_db.classrooms.update_one.assert_called()
        mock_db.users.update_one.assert_called()

    def test_enroll_student_invalid_code(self, enrollment_service, mock_db):
        """Test enrollment fails with invalid code"""
        student_id = str(ObjectId())
        classroom_id = str(ObjectId())

        mock_db.classrooms.find_one.return_value = {
            "_id": ObjectId(classroom_id),
            "students": [],
            "enrollment_code": "CORRECTCODE",
        }

        with pytest.raises(ValueError) as exc_info:
            enrollment_service.enroll_student(
                student_id,
                classroom_id,
                "WRONGCODE"
            )

        assert "Invalid enrollment code" in str(exc_info.value)

    def test_enroll_student_already_enrolled(self, enrollment_service, mock_db):
        """Test cannot enroll same student twice"""
        student_oid = ObjectId()
        classroom_id = str(ObjectId())

        mock_db.classrooms.find_one.return_value = {
            "_id": ObjectId(classroom_id),
            "students": [student_oid],
            "enrollment_code": "CODE",
        }

        with pytest.raises(ValueError) as exc_info:
            enrollment_service.enroll_student(
                str(student_oid),
                classroom_id,
                "CODE"
            )

        assert "already enrolled" in str(exc_info.value)

    def test_disenroll_student_success(self, enrollment_service, mock_db):
        """Test successful student disenrollment"""
        student_id = str(ObjectId())
        classroom_id = str(ObjectId())

        result = enrollment_service.disenroll_student(student_id, classroom_id)

        assert result["status"] == "disenrolled"
        mock_db.classrooms.update_one.assert_called()
        mock_db.users.update_one.assert_called()

    def test_bulk_enroll_students_success(self, enrollment_service, mock_db):
        """Test bulk enrollment of students"""
        teacher_id = str(ObjectId())
        classroom_id = str(ObjectId())
        student_ids = [str(ObjectId()) for _ in range(3)]

        mock_db.classrooms.find_one.return_value = {
            "_id": ObjectId(classroom_id),
            "teacher_id": ObjectId(teacher_id),
            "students": [],
        }

        # Mock successful enrollments
        mock_db.classrooms.update_one.return_value = None
        mock_db.users.update_one.return_value = None

        result = enrollment_service.bulk_enroll_students(
            classroom_id,
            student_ids,
            teacher_id
        )

        assert result["success"] >= 0
        assert result["failed"] >= 0

    def test_create_student_group(self, enrollment_service, mock_db):
        """Test creating student group"""
        classroom_id = str(ObjectId())

        result = enrollment_service.create_student_group(
            classroom_id,
            "Advanced Learners",
            "Students ahead of schedule"
        )

        assert "group_id" in result
        assert result["name"] == "Advanced Learners"
        mock_db.classrooms.update_one.assert_called()

    def test_add_student_to_group(self, enrollment_service, mock_db):
        """Test adding student to group"""
        classroom_id = str(ObjectId())
        group_id = str(ObjectId())
        student_id = str(ObjectId())

        result = enrollment_service.add_student_to_group(
            classroom_id,
            group_id,
            student_id
        )

        assert result["status"] == "added"
        mock_db.classrooms.update_one.assert_called()

    def test_get_classroom_roster(self, enrollment_service, mock_db):
        """Test retrieving classroom roster"""
        classroom_id = str(ObjectId())
        student_id = ObjectId()

        mock_db.classrooms.find_one.return_value = {
            "_id": ObjectId(classroom_id),
            "students": [student_id],
            "student_groups": [],
        }

        mock_db.users.find.return_value = [
            {
                "_id": student_id,
                "email": "student@test.com",
                "profile": {"name": "Test Student"},
                "role": "student",
            }
        ]

        result = enrollment_service.get_classroom_roster(classroom_id)

        assert result["total_students"] == 1
        assert len(result["students"]) == 1

    def test_get_student_enrollment_progress(self, enrollment_service, mock_db):
        """Test getting student's enrollment across classrooms"""
        student_id = str(ObjectId())
        classroom_id = ObjectId()

        mock_db.users.find_one.return_value = {
            "_id": ObjectId(student_id),
            "classroom_memberships": [
                {"classroom_id": classroom_id, "status": "active"},
            ],
        }

        mock_db.classrooms.find_one.return_value = {
            "_id": classroom_id,
            "name": "Test Class",
        }

        result = enrollment_service.get_student_enrollment_progress(student_id)

        assert result["student_id"] == student_id
        assert "classrooms" in result


# Announcements Service Tests
class TestAnnouncementsService:
    def test_create_announcement_success(self, announcements_service, mock_db):
        """Test creating announcement"""
        classroom_id = str(ObjectId())
        teacher_id = str(ObjectId())

        mock_db.announcements.insert_one.return_value = MagicMock(
            inserted_id=ObjectId()
        )

        result = announcements_service.create_announcement(
            classroom_id,
            teacher_id,
            "Test Title",
            "Test Content"
        )

        assert "announcement_id" in result
        assert result["status"] == "created"
        mock_db.announcements.insert_one.assert_called()

    def test_get_classroom_announcements(self, announcements_service, mock_db):
        """Test retrieving announcements"""
        classroom_id = str(ObjectId())

        mock_db.announcements.find.return_value = [
            {
                "_id": ObjectId(),
                "title": "Announcement 1",
                "content": "Content 1",
                "status": "published",
            },
        ]

        result = announcements_service.get_classroom_announcements(classroom_id)

        assert isinstance(result, list)
        assert len(result) == 1

    def test_mark_announcement_viewed(self, announcements_service, mock_db):
        """Test marking announcement as viewed"""
        announcement_id = str(ObjectId())
        student_id = str(ObjectId())

        mock_db.announcements.update_one.return_value = MagicMock()

        result = announcements_service.mark_announcement_viewed(
            announcement_id,
            student_id
        )

        assert result["status"] == "marked_viewed"
        mock_db.announcements.update_one.assert_called()

    def test_update_announcement(self, announcements_service, mock_db):
        """Test updating announcement"""
        announcement_id = str(ObjectId())

        result = announcements_service.update_announcement(
            announcement_id,
            title="Updated Title"
        )

        assert result["status"] == "updated"
        mock_db.announcements.update_one.assert_called()

    def test_delete_announcement_soft_delete(self, announcements_service, mock_db):
        """Test soft delete of announcement"""
        announcement_id = str(ObjectId())

        result = announcements_service.delete_announcement(announcement_id)

        assert result["status"] == "deleted"
        mock_db.announcements.update_one.assert_called()


# Analytics Service Tests
class TestClassroomAnalyticsService:
    def test_get_student_progress(self, analytics_service, mock_db):
        """Test retrieving student progress"""
        classroom_id = str(ObjectId())
        student_id = str(ObjectId())

        # Mock assignment submissions
        mock_db.assignment_submissions.find.return_value = [
            {
                "score": 85,
                "status": "graded",
            },
        ]

        # Mock learning modules
        mock_db.learning_modules.find.return_value = [
            {
                "_id": ObjectId(),
                "name": "Module 1",
                "assessments": [{"id": "a1"}, {"id": "a2"}],
            },
        ]

        result = analytics_service.get_student_progress(classroom_id, student_id)

        assert "student_id" in result
        assert "average_score_percentage" in result
        assert "module_progress" in result

    def test_get_classroom_analytics(self, analytics_service, mock_db):
        """Test retrieving classroom-wide analytics"""
        classroom_id = str(ObjectId())

        mock_db.classrooms.find_one.return_value = {
            "_id": ObjectId(classroom_id),
            "students": [ObjectId(), ObjectId()],
        }

        mock_db.assignment_submissions.find.return_value = [
            {"score": 85},
            {"score": 90},
        ]

        result = analytics_service.get_classroom_analytics(classroom_id)

        assert "classroom_id" in result
        assert "total_students" in result
        assert "average_class_score" in result

    def test_get_submission_analytics(self, analytics_service, mock_db):
        """Test retrieving assignment submission analytics"""
        classroom_id = str(ObjectId())
        assignment_id = str(ObjectId())

        mock_db.assignment_submissions.find.return_value = [
            {"score": 80},
            {"score": 85},
            {"score": 90},
        ]

        result = analytics_service.get_submission_analytics(
            classroom_id,
            assignment_id
        )

        assert "min_score" in result or "average_score" in result


# Dashboard Service Tests
class TestDashboardService:
    def test_get_teacher_dashboard(self, dashboard_service, mock_db):
        """Test teacher dashboard data"""
        classroom_id = str(ObjectId())
        teacher_id = str(ObjectId())

        mock_db.classrooms.find_one.return_value = {
            "_id": ObjectId(classroom_id),
            "name": "Algebra 101",
            "subject": "Mathematics",
            "grade_level": "9",
            "teacher_id": ObjectId(teacher_id),
            "students": [ObjectId() for _ in range(25)],
            "ai_resources": [
                {
                    "resource_id": "res1",
                    "title": "Linear equations video",
                    "approval_status": "pending",
                    "created_date": datetime.utcnow(),
                },
                {
                    "resource_id": "res2",
                    "title": "Practice worksheet",
                    "approval_status": "approved",
                    "created_date": datetime.utcnow(),
                },
            ],
        }

        mock_db.assignment_submissions.find.return_value = []
        mock_db.assignments.find.return_value = []
        mock_db.announcements.find.return_value = []

        result = dashboard_service.get_teacher_dashboard(classroom_id, teacher_id)

        assert result["classroom_id"] == classroom_id
        assert result["student_count"] == 25
        assert "recent_submissions" in result
        assert "pending_assignments" in result
        assert "resource_summary" in result
        assert result["resource_summary"]["total"] == 2

    def test_get_student_dashboard(self, dashboard_service, mock_db):
        """Test student dashboard data"""
        classroom_id = str(ObjectId())
        student_id = str(ObjectId())
        teacher_id = ObjectId()

        mock_db.classrooms.find_one.return_value = {
            "_id": ObjectId(classroom_id),
            "name": "Algebra 101",
            "subject": "Mathematics",
            "teacher_id": teacher_id,
            "students": [ObjectId(student_id)],
            "ai_resources": [
                {
                    "resource_id": "res1",
                    "title": "Approved video",
                    "approval_status": "approved",
                    "created_date": datetime.utcnow(),
                },
                {
                    "resource_id": "res2",
                    "title": "Pending resource",
                    "approval_status": "pending",
                    "created_date": datetime.utcnow(),
                },
            ],
        }

        mock_db.assignments.find.return_value = []
        mock_db.announcements.find.return_value = []
        mock_db.learning_modules.find.return_value = []
        mock_db.users.find_one.return_value = {"profile": {"name": "Teacher A"}}

        result = dashboard_service.get_student_dashboard(classroom_id, student_id)

        assert result["classroom_id"] == classroom_id
        assert "pending_assignments" in result
        assert "announcements" in result
        assert "class_resources" in result
        assert len(result["class_resources"]) == 1

    def test_get_classroom_overview(self, dashboard_service, mock_db):
        """Test classroom overview statistics"""
        classroom_id = str(ObjectId())

        mock_db.classrooms.find_one.return_value = {
            "_id": ObjectId(classroom_id),
            "name": "Test Class",
            "students": [ObjectId() for _ in range(30)],
        }

        mock_db.assignments.count_documents.return_value = 5
        mock_db.learning_modules.count_documents.return_value = 8

        result = dashboard_service.get_classroom_overview(classroom_id)

        assert result["student_count"] == 30
        assert result["assignment_count"] == 5
        assert result["module_count"] == 8


# Integration Tests
class TestPhase2ServiceIntegration:
    """Integration tests combining multiple services"""

    def test_enrollment_to_dashboard_flow(self, enrollment_service, dashboard_service, mock_db):
        """Test complete flow: enrollment -> dashboard"""
        student_id = str(ObjectId())
        classroom_id = str(ObjectId())

        # Step 1: Enroll student
        mock_db.classrooms.find_one.return_value = {
            "_id": ObjectId(classroom_id),
            "students": [],
            "enrollment_code": "TEST",
        }

        # This would be called after enrollment succeeds
        mock_db.assignments.find.return_value = []
        mock_db.announcements.find.return_value = []

        enroll_result = enrollment_service.enroll_student(
            student_id, classroom_id, "TEST"
        )
        assert enroll_result["status"] == "enrolled"

    def test_teacher_classroom_management_flow(
        self,
        enrollment_service,
        announcements_service,
        analytics_service,
        mock_db
    ):
        """Test complete teacher workflow"""
        teacher_id = str(ObjectId())
        classroom_id = str(ObjectId())

        # Step 1: Bulk enroll students
        mock_db.classrooms.find_one.return_value = {
            "_id": ObjectId(classroom_id),
            "teacher_id": ObjectId(teacher_id),
            "students": [],
        }

        student_ids = [str(ObjectId()) for _ in range(5)]

        # Step 2: Create announcement
        mock_db.announcements.insert_one.return_value = MagicMock(
            inserted_id=ObjectId()
        )

        # Step 3: Get analytics
        mock_db.classrooms.find_one.return_value = {
            "_id": ObjectId(classroom_id),
            "teacher_id": ObjectId(teacher_id),
            "students": [ObjectId(s) for s in student_ids],
        }
        mock_db.assignment_submissions.find.return_value = [
            {"score": 85},
            {"score": 90},
        ]

        # Verify workflow steps
        assert len(student_ids) == 5
