import pytest
from bson import ObjectId
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

# Phase 2 Integration Tests

@pytest.fixture
def mock_db():
    """Mock MongoDB database"""
    db = MagicMock()
    
    # Mock collections
    db.classrooms = MagicMock()
    db.users = MagicMock()
    db.announcements = MagicMock()
    db.assignments = MagicMock()
    db.assignment_submissions = MagicMock()
    db.learning_modules = MagicMock()
    
    return db


@pytest.fixture
def sample_teacher_id():
    return str(ObjectId())


@pytest.fixture
def sample_student_ids():
    return [str(ObjectId()) for _ in range(3)]


@pytest.fixture
def sample_classroom_id():
    return str(ObjectId())


class TestEnrollmentService:
    """Tests for enrollment workflows"""
    
    def test_enroll_student_with_code(self, mock_db, sample_student_ids, sample_classroom_id):
        """Student can enroll in classroom with enrollment code"""
        from services.enrollment_service import EnrollmentService
        
        # Setup mock
        classroom = {
            "_id": ObjectId(sample_classroom_id),
            "students": [],
            "enrollment_code": "ABC123",
        }
        mock_db.classrooms.find_one.return_value = classroom
        
        service = EnrollmentService(mock_db)
        result = service.enroll_student(sample_student_ids[0], sample_classroom_id, "ABC123")
        
        assert result["status"] == "enrolled"
        assert mock_db.classrooms.update_one.called
        assert mock_db.users.update_one.called
    
    def test_enroll_student_invalid_code(self, mock_db, sample_student_ids, sample_classroom_id):
        """Student gets error with invalid enrollment code"""
        from services.enrollment_service import EnrollmentService
        
        classroom = {
            "_id": ObjectId(sample_classroom_id),
            "students": [],
            "enrollment_code": "CORRECT",
        }
        mock_db.classrooms.find_one.return_value = classroom
        
        service = EnrollmentService(mock_db)
        
        with pytest.raises(ValueError, match="Invalid enrollment code"):
            service.enroll_student(sample_student_ids[0], sample_classroom_id, "WRONG")
    
    def test_bulk_enroll_students(self, mock_db, sample_teacher_id, sample_classroom_id, sample_student_ids):
        """Teacher can bulk enroll multiple students"""
        from services.enrollment_service import EnrollmentService
        
        classroom = {
            "_id": ObjectId(sample_classroom_id),
            "teacher_id": ObjectId(sample_teacher_id),
            "students": [],
        }
        mock_db.classrooms.find_one.return_value = classroom
        
        service = EnrollmentService(mock_db)
        result = service.bulk_enroll_students(sample_classroom_id, sample_student_ids, sample_teacher_id)
        
        assert result["success"] > 0
        assert result["failed"] == 0
    
    def test_create_student_group(self, mock_db, sample_classroom_id):
        """Teacher can create student groups for differentiation"""
        from services.enrollment_service import EnrollmentService
        
        service = EnrollmentService(mock_db)
        result = service.create_student_group(
            sample_classroom_id,
            "Advanced Learners",
            "Higher difficulty content",
            []
        )
        
        assert result["group_id"] is not None
        assert result["name"] == "Advanced Learners"
        assert mock_db.classrooms.update_one.called


class TestDashboardService:
    """Tests for classroom dashboards"""
    
    def test_get_teacher_dashboard(self, mock_db, sample_teacher_id, sample_classroom_id):
        """Teacher gets customized dashboard with class stats"""
        from services.dashboard_service import DashboardService
        
        classroom = {
            "_id": ObjectId(sample_classroom_id),
            "teacher_id": ObjectId(sample_teacher_id),
            "name": "Math 101",
            "subject": "Mathematics",
            "grade_level": "10th",
            "students": [ObjectId() for _ in range(5)],
        }
        mock_db.classrooms.find_one.return_value = classroom
        mock_db.assignment_submissions.find = MagicMock(return_value=MagicMock(__iter__=lambda self: iter([]), sort=lambda *args: self))
        mock_db.assignments.find = MagicMock(return_value=MagicMock(__iter__=lambda self: iter([]), sort=lambda *args, **kwargs: self, limit=lambda self, n: self))
        mock_db.announcements.find = MagicMock(return_value=MagicMock(__iter__=lambda self: iter([]), sort=lambda *args, **kwargs: self, limit=lambda self, n: self))
        
        service = DashboardService(mock_db)
        dashboard = service.get_teacher_dashboard(sample_classroom_id, sample_teacher_id)
        
        assert dashboard["classroom_name"] == "Math 101"
        assert dashboard["student_count"] == 5
        assert "recent_submissions" in dashboard
    
    def test_get_student_dashboard(self, mock_db, sample_student_ids, sample_classroom_id):
        """Student gets personalized dashboard with assignments"""
        from services.dashboard_service import DashboardService
        
        classroom = {
            "_id": ObjectId(sample_classroom_id),
            "students": [ObjectId(sample_student_ids[0])],
            "name": "Physics 101",
            "subject": "Physics",
            "teacher_id": ObjectId(),
        }
        mock_db.classrooms.find_one.return_value = classroom
        mock_db.assignments.find = MagicMock(return_value=MagicMock(__iter__=lambda self: iter([]), sort=lambda *args, **kwargs: self))
        mock_db.assignment_submissions.find_one.return_value = None
        mock_db.announcements.find = MagicMock(return_value=MagicMock(__iter__=lambda self: iter([]), sort=lambda *args, **kwargs: self, limit=lambda self, n: self))
        mock_db.learning_modules.find = MagicMock(return_value=MagicMock(__iter__=lambda self: iter([]), sort=lambda *args, **kwargs: self))
        mock_db.users.find_one.return_value = {"profile": {"name": "Mr. Smith"}}
        
        service = DashboardService(mock_db)
        dashboard = service.get_student_dashboard(sample_classroom_id, sample_student_ids[0])
        
        assert dashboard["classroom_name"] == "Physics 101"
        assert "pending_assignments" in dashboard
        assert "announcements" in dashboard


class TestAnnouncementsService:
    """Tests for classroom announcements"""
    
    def test_create_announcement(self, mock_db, sample_teacher_id, sample_classroom_id):
        """Teacher can create classroom-wide announcement"""
        from services.announcements_service import AnnouncementsService
        
        mock_db.announcements.insert_one.return_value.inserted_id = ObjectId()
        
        service = AnnouncementsService(mock_db)
        result = service.create_announcement(
            sample_classroom_id,
            sample_teacher_id,
            "Important Update",
            "Please read the syllabus"
        )
        
        assert result["status"] == "created"
        assert mock_db.announcements.insert_one.called
    
    def test_mark_announcement_viewed(self, mock_db):
        """Student's viewing is tracked"""
        from services.announcements_service import AnnouncementsService
        
        service = AnnouncementsService(mock_db)
        result = service.mark_announcement_viewed(
            str(ObjectId()),
            str(ObjectId())
        )
        
        assert result["status"] == "marked_viewed"
        assert mock_db.announcements.update_one.called


class TestAnalyticsService:
    """Tests for classroom analytics"""
    
    def test_get_student_progress(self, mock_db, sample_student_ids, sample_classroom_id):
        """Teacher can view student progress breakdown"""
        from services.classroom_analytics_service import ClassroomAnalyticsService
        
        mock_db.assignment_submissions.find.return_value = []
        mock_db.learning_modules.find.return_value = []
        
        service = ClassroomAnalyticsService(mock_db)
        progress = service.get_student_progress(sample_classroom_id, sample_student_ids[0])
        
        assert progress["student_id"] == sample_student_ids[0]
        assert progress["classroom_id"] == sample_classroom_id
        assert "average_score_percentage" in progress
    
    def test_get_classroom_analytics(self, mock_db, sample_teacher_id, sample_classroom_id, sample_student_ids):
        """Teacher gets aggregate class statistics"""
        from services.classroom_analytics_service import ClassroomAnalyticsService
        
        classroom = {
            "_id": ObjectId(sample_classroom_id),
            "name": "History 101",
            "students": [ObjectId(sid) for sid in sample_student_ids],
        }
        mock_db.classrooms.find_one.return_value = classroom
        mock_db.assignment_submissions.find.return_value = []
        mock_db.assignment_submissions.count_documents.return_value = 0
        mock_db.assignments.count_documents.return_value = 5
        mock_db.learning_modules.find.return_value = []
        
        service = ClassroomAnalyticsService(mock_db)
        analytics = service.get_classroom_analytics(sample_classroom_id)
        
        assert analytics["classroom_name"] == "History 101"
        assert analytics["total_students"] == len(sample_student_ids)
        assert "student_analytics" in analytics


class TestRBACIntegration:
    """Tests for role-based access control with Phase 2"""
    
    def test_teacher_can_manage_enrollment(self, mock_db, sample_teacher_id, sample_classroom_id):
        """Teacher can manage classroom enrollment"""
        from services.rbac_service import RBACService
        
        classroom = {
            "_id": ObjectId(sample_classroom_id),
            "teacher_id": ObjectId(sample_teacher_id),
        }
        mock_db.classrooms.find_one.return_value = classroom
        
        rbac = RBACService(mock_db)
        is_teacher = rbac.is_teacher(sample_teacher_id, sample_classroom_id)
        
        assert is_teacher is True
    
    def test_student_cannot_create_announcement(self, mock_db, sample_student_ids, sample_classroom_id):
        """Student cannot create announcements (no permission)"""
        from services.rbac_service import RBACService, Permission
        
        classroom = {
            "_id": ObjectId(sample_classroom_id),
            "students": [ObjectId(sample_student_ids[0])],
        }
        mock_db.classrooms.find_one.return_value = classroom
        
        rbac = RBACService(mock_db)
        has_perm = rbac.has_permission(sample_student_ids[0], sample_classroom_id, Permission.CREATE_ASSIGNMENT)
        
        assert has_perm is False


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
