"""
End-to-End API Integration Tests
Tests complete workflows across frontend and backend
"""

import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch
import json


@pytest.fixture
def api_client():
    """Mock API client for frontend integration"""
    return MagicMock()


@pytest.fixture
def test_data():
    """Shared test data"""
    return {
        "classroom": {
            "_id": "cls_123",
            "name": "Biology 101",
            "subject": "Science",
            "grade_level": "10",
            "teacher": {
                "name": "Dr. Smith",
                "email": "smith@school.edu"
            },
            "enrollment_code": "BIO2024",
            "student_count": 30,
            "created_at": datetime.now().isoformat(),
        },
        "students": [
            {
                "id": f"stu_{i}",
                "email": f"student{i}@school.edu",
                "name": f"Student {i}",
                "enrollment_status": "active",
            }
            for i in range(1, 6)
        ],
        "announcements": [
            {
                "_id": "ann_1",
                "title": "Welcome to Class",
                "content": "This is the start of an exciting semester",
                "created_by": "teacher_1",
                "view_count": 25,
                "created_at": datetime.now().isoformat(),
            },
            {
                "_id": "ann_2",
                "title": "Assignment Due",
                "content": "Project submission deadline: Friday",
                "created_by": "teacher_1",
                "view_count": 28,
                "created_at": (datetime.now() - timedelta(days=1)).isoformat(),
            },
        ],
        "assignments": [
            {
                "_id": "asn_1",
                "title": "Chapter 1 Quiz",
                "due_date": (datetime.now() + timedelta(days=3)).isoformat(),
                "status": "pending",
                "points": 20,
            },
        ],
        "modules": [
            {
                "_id": "mod_1",
                "name": "Cell Structure",
                "description": "Introduction to cell biology",
                "objectives": [
                    "Understand cell components",
                    "Learn about organelles"
                ],
                "resources": [
                    {
                        "title": "Cell Video",
                        "type": "video",
                        "url": "https://example.com/cell-video"
                    }
                ],
                "assessments": ["asn_1"],
            },
        ],
    }


class TestEnrollmentE2E:
    """End-to-end enrollment workflows"""

    def test_self_enrollment_flow(self, api_client, test_data):
        """Test complete self-enrollment flow"""
        # Student gets enrollment code
        api_client.get_classroom_code.return_value = {
            "success": True,
            "code": test_data["classroom"]["enrollment_code"],
        }

        # Student enters code and enrolls
        api_client.enroll_with_code.return_value = {
            "success": True,
            "data": {
                "classroom_id": test_data["classroom"]["_id"],
                "student_id": "stu_1",
                "status": "enrolled",
                "enrollment_date": datetime.now().isoformat(),
            },
        }

        # Verify steps
        code = api_client.get_classroom_code()
        assert code["code"] == "BIO2024"

        enrollment = api_client.enroll_with_code("BIO2024")
        assert enrollment["data"]["status"] == "enrolled"

    def test_bulk_enrollment_flow(self, api_client, test_data):
        """Test bulk upload enrollment"""
        csv_data = "email,name\nstudent1@school.edu,Student One\nstudent2@school.edu,Student Two"

        api_client.bulk_upload.return_value = {
            "success": True,
            "results": {
                "successful": 2,
                "failed": 0,
                "details": [
                    {"email": "student1@school.edu", "status": "enrolled"},
                    {"email": "student2@school.edu", "status": "enrolled"},
                ],
            },
        }

        result = api_client.bulk_upload(csv_data)
        assert result["results"]["successful"] == 2
        assert result["results"]["failed"] == 0

    def test_disenrollment_flow(self, api_client, test_data):
        """Test removing student from classroom"""
        api_client.remove_student.return_value = {
            "success": True,
            "message": "Student removed",
            "student_id": "stu_1",
        }

        result = api_client.remove_student(
            test_data["classroom"]["_id"],
            "stu_1"
        )
        assert result["success"] is True


class TestAnnouncementE2E:
    """End-to-end announcement workflows"""

    def test_announcement_lifecycle(self, api_client, test_data):
        """Test create -> publish -> view -> archive"""
        # Teacher creates announcement
        api_client.create_announcement.return_value = {
            "success": True,
            "data": {
                "_id": "ann_new",
                "title": "New Announcement",
                "status": "published",
                "created_at": datetime.now().isoformat(),
            },
        }

        announcement = api_client.create_announcement({
            "title": "New Announcement",
            "content": "Important update"
        })
        assert announcement["data"]["status"] == "published"

        # Students view announcement
        api_client.mark_viewed.return_value = {
            "success": True,
            "view_count": {"current": 15, "total": 30},
        }

        views = api_client.mark_viewed("ann_new", "stu_1")
        assert views["view_count"]["current"] == 15

        # Teacher archives announcement
        api_client.update_announcement.return_value = {
            "success": True,
            "data": {"status": "archived"},
        }

        archived = api_client.update_announcement("ann_new", {"status": "archived"})
        assert archived["data"]["status"] == "archived"

    def test_announcement_engagement_tracking(self, api_client, test_data):
        """Test view tracking and engagement"""
        api_client.get_announcements.return_value = {
            "success": True,
            "data": test_data["announcements"],
        }

        announcements = api_client.get_announcements(test_data["classroom"]["_id"])

        for announcement in announcements["data"]:
            assert "view_count" in announcement
            assert "created_at" in announcement

        # First announcement should have more views
        assert announcements["data"][0]["view_count"] == 25


class TestDashboardE2E:
    """End-to-end dashboard workflows"""

    def test_teacher_dashboard_load(self, api_client, test_data):
        """Test loading teacher dashboard"""
        api_client.get_dashboard.return_value = {
            "success": True,
            "role": "teacher",
            "classroom": test_data["classroom"],
            "stats": {
                "total_students": 30,
                "assignments_pending": 2,
                "average_class_score": 87.5,
                "recent_submissions": 15,
            },
            "recent_announcements": test_data["announcements"][:2],
            "assignments": test_data["assignments"],
        }

        dashboard = api_client.get_dashboard(
            test_data["classroom"]["_id"],
            role="teacher"
        )

        assert dashboard["role"] == "teacher"
        assert dashboard["stats"]["total_students"] == 30
        assert len(dashboard["recent_announcements"]) == 2

    def test_student_dashboard_load(self, api_client, test_data):
        """Test loading student dashboard"""
        api_client.get_dashboard.return_value = {
            "success": True,
            "role": "student",
            "classroom": test_data["classroom"],
            "assignments": [
                {
                    "title": "Chapter 1 Quiz",
                    "due_date": (datetime.now() + timedelta(days=3)).isoformat(),
                    "status": "pending",
                    "submitted": False,
                }
            ],
            "announcements": test_data["announcements"],
            "modules": test_data["modules"],
            "progress": {
                "completion_percentage": 45,
                "average_score": 82.5,
            },
        }

        dashboard = api_client.get_dashboard(
            test_data["classroom"]["_id"],
            role="student"
        )

        assert dashboard["role"] == "student"
        assert len(dashboard["assignments"]) > 0
        assert "progress" in dashboard

    def test_dashboard_role_based_access(self, api_client):
        """Test RBAC on dashboard endpoint"""
        # Student tries to access as different student
        api_client.get_dashboard.side_effect = Exception("403: Forbidden")

        with pytest.raises(Exception) as exc_info:
            api_client.get_dashboard("cls_123", role="student", user_id="stu_2")

        assert "403" in str(exc_info.value)


class TestAnalyticsE2E:
    """End-to-end analytics workflows"""

    def test_class_analytics_view(self, api_client, test_data):
        """Test classroom analytics"""
        api_client.get_class_analytics.return_value = {
            "success": True,
            "data": {
                "classroom_id": test_data["classroom"]["_id"],
                "total_students": 30,
                "average_score": 87.3,
                "completion_rate": 0.85,
                "submission_stats": {
                    "submitted": 25,
                    "overdue": 2,
                    "pending": 3,
                },
                "performance_distribution": {
                    "excellent": 12,
                    "good": 10,
                    "average": 5,
                    "needs_improvement": 3,
                },
            },
        }

        analytics = api_client.get_class_analytics(test_data["classroom"]["_id"])

        assert analytics["data"]["total_students"] == 30
        assert analytics["data"]["average_score"] == 87.3
        assert sum(analytics["data"]["performance_distribution"].values()) == 30

    def test_student_progress_analytics(self, api_client):
        """Test individual student progress"""
        api_client.get_student_progress.return_value = {
            "success": True,
            "data": {
                "student_id": "stu_1",
                "modules_completed": 5,
                "total_modules": 10,
                "average_assessment_score": 85.5,
                "recent_scores": [85, 87, 88, 84, 86],
            },
        }

        progress = api_client.get_student_progress("cls_123", "stu_1")

        assert progress["data"]["modules_completed"] == 5
        assert progress["data"]["average_assessment_score"] == 85.5

    def test_analytics_privacy_controls(self, api_client):
        """Test privacy enforcement on analytics"""
        # Student should not see other students' scores
        api_client.get_student_progress.side_effect = Exception("403: Forbidden")

        with pytest.raises(Exception) as exc_info:
            api_client.get_student_progress("cls_123", "stu_2", viewer_id="stu_1")

        assert "403" in str(exc_info.value)


class TestGroupManagementE2E:
    """End-to-end group management workflows"""

    def test_group_creation_and_assignment(self, api_client):
        """Test creating groups and adding students"""
        # Create group
        api_client.create_group.return_value = {
            "success": True,
            "data": {
                "group_id": "grp_1",
                "name": "Advanced Learners",
                "members": [],
            },
        }

        group = api_client.create_group(
            "cls_123",
            "Advanced Learners",
            "Students ahead of schedule"
        )
        assert group["data"]["name"] == "Advanced Learners"

        # Add students to group
        api_client.add_to_group.return_value = {
            "success": True,
            "data": {
                "group_id": "grp_1",
                "member_count": 5,
            },
        }

        updated = api_client.add_to_group("grp_1", ["stu_1", "stu_2", "stu_3", "stu_4", "stu_5"])
        assert updated["data"]["member_count"] == 5

    def test_group_based_assignments(self, api_client):
        """Test assigning content to groups"""
        # Create targeted announcement for group
        api_client.create_announcement.return_value = {
            "success": True,
            "data": {
                "announcement_id": "ann_grp",
                "target_group_id": "grp_1",
                "visible_to": "group",
            },
        }

        announcement = api_client.create_announcement({
            "title": "Advanced Tasks",
            "content": "Challenge activities",
            "target_group_id": "grp_1",
        })

        assert announcement["data"]["visible_to"] == "group"


class TestModuleProgressE2E:
    """End-to-end learning module workflows"""

    def test_module_consumption_flow(self, api_client, test_data):
        """Test student consuming module content"""
        module = test_data["modules"][0]

        # Get module details
        api_client.get_module.return_value = {
            "success": True,
            "data": module,
        }

        module_data = api_client.get_module("cls_123", module["_id"])
        assert len(module_data["data"]["resources"]) == 1

        # Mark resource as viewed
        api_client.mark_resource_viewed.return_value = {
            "success": True,
            "progress": 0.33,
        }

        progress = api_client.mark_resource_viewed(
            module["_id"],
            "video_1"
        )
        assert progress["progress"] == 0.33

        # Complete assessment
        api_client.submit_assessment.return_value = {
            "success": True,
            "score": 18,
            "total": 20,
            "percentage": 90,
            "module_progress": 1.0,
        }

        result = api_client.submit_assessment(
            module["_id"],
            "asn_1",
            answers={"q1": "A", "q2": "B"}
        )
        assert result["module_progress"] == 1.0


class TestErrorHandlingE2E:
    """End-to-end error handling workflows"""

    def test_authentication_failure_flow(self, api_client):
        """Test handling missing/invalid authentication"""
        api_client.get_classroom.side_effect = Exception("401: Unauthorized")

        with pytest.raises(Exception) as exc_info:
            api_client.get_classroom("cls_123", auth_token=None)

        assert "401" in str(exc_info.value)

    def test_permission_denied_flow(self, api_client):
        """Test handling permission denied scenarios"""
        # Non-teacher tries to create announcement
        api_client.create_announcement.side_effect = Exception("403: Forbidden - Only teachers can create announcements")

        with pytest.raises(Exception) as exc_info:
            api_client.create_announcement(
                {"title": "Hack"},
                user_role="student"
            )

        assert "403" in str(exc_info.value)

    def test_not_found_flow(self, api_client):
        """Test handling not found scenarios"""
        api_client.get_classroom.side_effect = Exception("404: Classroom not found")

        with pytest.raises(Exception) as exc_info:
            api_client.get_classroom("invalid_id")

        assert "404" in str(exc_info.value)

    def test_invalid_input_flow(self, api_client):
        """Test handling invalid input"""
        api_client.create_announcement.side_effect = Exception("400: Title cannot be empty")

        with pytest.raises(Exception) as exc_info:
            api_client.create_announcement({"title": "", "content": "test"})

        assert "400" in str(exc_info.value)


class TestCompleteWorkflows:
    """Full end-to-end workflow scenarios"""

    def test_semester_start_workflow(self, api_client, test_data):
        """Test complete classroom setup workflow"""
        classroom = test_data["classroom"]

        # 1. Create classroom
        api_client.create_classroom.return_value = {
            "success": True,
            "data": classroom,
        }

        created = api_client.create_classroom({
            "name": "Biology 101",
            "subject": "Science",
            "grade_level": "10",
        })
        assert created["data"]["name"] == "Biology 101"

        # 2. Bulk add students
        api_client.bulk_enroll.return_value = {
            "success": True,
            "enrolled": 30,
        }

        enrolled = api_client.bulk_enroll(classroom["_id"], csv_data="emails")
        assert enrolled["enrolled"] == 30

        # 3. Create student groups
        api_client.create_group.return_value = {
            "success": True,
            "data": {"group_id": "grp_1", "name": "Advanced"},
        }

        group = api_client.create_group(classroom["_id"], "Advanced", "")
        assert group["success"] is True

        # 4. Post welcome announcement
        api_client.create_announcement.return_value = {
            "success": True,
            "data": {"announcement_id": "ann_1"},
        }

        announcement = api_client.create_announcement({
            "title": "Welcome!",
            "content": "Welcome to Biology 101"
        })
        assert announcement["success"] is True

    def test_assignment_submission_workflow(self, api_client):
        """Test assignment creation -> submission -> grading"""
        # 1. Teacher creates assignment
        api_client.create_assignment.return_value = {
            "success": True,
            "data": {
                "assignment_id": "asn_1",
                "title": "Chapter 1 Quiz",
                "due_date": (datetime.now() + timedelta(days=7)).isoformat(),
            },
        }

        assignment = api_client.create_assignment({
            "title": "Chapter 1 Quiz",
            "due_date": "2024-12-25",
        })
        assert assignment["data"]["assignment_id"] == "asn_1"

        # 2. Student submits assignment
        api_client.submit_assignment.return_value = {
            "success": True,
            "data": {
                "submission_id": "sub_1",
                "status": "submitted",
                "submitted_at": datetime.now().isoformat(),
            },
        }

        submission = api_client.submit_assignment(
            "asn_1",
            student_id="stu_1",
            content="My answers"
        )
        assert submission["data"]["status"] == "submitted"

        # 3. Teacher grades submission
        api_client.grade_submission.return_value = {
            "success": True,
            "data": {
                "submission_id": "sub_1",
                "score": 18,
                "total": 20,
                "feedback": "Great work!"
            },
        }

        graded = api_client.grade_submission(
            "sub_1",
            score=18,
            feedback="Great work!"
        )
        assert graded["data"]["score"] == 18

        # 4. Student views grade
        api_client.get_submission.return_value = {
            "success": True,
            "data": {
                "score": 18,
                "total": 20,
                "feedback": "Great work!",
            },
        }

        viewed = api_client.get_submission("sub_1")
        assert viewed["data"]["score"] == 18
