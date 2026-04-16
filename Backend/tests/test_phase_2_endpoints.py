"""
Comprehensive Phase 2 API Endpoint Tests
Tests all enrollment, dashboard, announcements, and analytics endpoints
"""

import pytest
import json
from datetime import datetime, timedelta
from bson import ObjectId
import csv
import io

# Assuming pytest fixtures are configured to use test database
# These tests validate all Phase 2 backend endpoints


class TestEnrollmentEndpoints:
    """Test all enrollment-related endpoints"""

    def test_student_self_enroll_with_code(self, client, test_classroom, test_student):
        """Test student can enroll using enrollment code"""
        response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/enroll',
            json={'enrollment_code': test_classroom['enrollment_code']},
            headers={'Authorization': f'Bearer {test_student["token"]}'}
        )
        
        assert response.status_code == 200
        assert response.json()['status'] == 'success'
        assert response.json()['data']['status'] == 'enrolled'
        
        # Verify student was added to classroom
        classroom = client.get(
            f'/api/classroom/{test_classroom["_id"]}',
            headers={'Authorization': f'Bearer {test_student["token"]}'}
        ).json()
        assert str(test_student['_id']) in [str(s) for s in classroom['data'].get('students', [])]

    def test_student_enroll_with_invalid_code(self, client, test_classroom, test_student):
        """Test enrollment fails with invalid code"""
        response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/enroll',
            json={'enrollment_code': 'WRONGCODE'},
            headers={'Authorization': f'Bearer {test_student["token"]}'}
        )
        
        assert response.status_code == 400
        assert 'Invalid enrollment code' in response.json()['detail']

    def test_student_cannot_enroll_twice(self, client, test_classroom, test_enrolled_student):
        """Test student cannot enroll in same classroom twice"""
        response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/enroll',
            json={'enrollment_code': test_classroom['enrollment_code']},
            headers={'Authorization': f'Bearer {test_enrolled_student["token"]}'}
        )
        
        assert response.status_code == 400
        assert 'already enrolled' in response.json()['detail'].lower()

    def test_teacher_add_student_manually(self, client, test_classroom, test_teacher, test_student):
        """Test teacher can manually add student to classroom"""
        response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/members/add',
            json={'student_id': str(test_student['_id'])},
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200
        assert response.json()['status'] == 'success'

    def test_student_cannot_add_others(self, client, test_classroom, test_student, other_student):
        """Test student cannot manually add other students"""
        response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/members/add',
            json={'student_id': str(other_student['_id'])},
            headers={'Authorization': f'Bearer {test_student["token"]}'}
        )
        
        assert response.status_code == 403
        assert 'teacher' in response.json()['detail'].lower()

    def test_teacher_bulk_upload_csv(self, client, test_classroom, test_teacher, test_students):
        """Test teacher can bulk upload student roster from CSV"""
        # Create CSV file content
        csv_content = io.StringIO()
        writer = csv.writer(csv_content)
        writer.writerow(['email', 'name'])
        for student in test_students[:3]:
            writer.writerow([student['email'], student['name']])
        
        csv_file = (io.BytesIO(csv_content.getvalue().encode()), 'students.csv')
        
        response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/members/bulk-upload',
            data={'file': csv_file},
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200
        assert response.json()['status'] == 'upload_complete'
        assert response.json()['data']['success'] >= 1

    def test_bulk_upload_with_partial_failures(self, client, test_classroom, test_teacher):
        """Test bulk upload handles partial failures gracefully"""
        csv_content = io.StringIO()
        writer = csv.writer(csv_content)
        writer.writerow(['email'])
        writer.writerow(['nonexistent@example.com'])
        writer.writerow(['fake@test.com'])
        
        csv_file = (io.BytesIO(csv_content.getvalue().encode()), 'students.csv')
        
        response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/members/bulk-upload',
            data={'file': csv_file},
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200
        assert response.json()['data']['failed'] > 0
        assert len(response.json()['data']['errors']) > 0

    def test_get_classroom_roster(self, client, test_classroom, test_teacher):
        """Test getting full classroom roster"""
        response = client.get(
            f'/api/classroom/{test_classroom["_id"]}/members',
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200
        data = response.json()['data']
        assert 'total_students' in data
        assert 'students' in data
        assert isinstance(data['students'], list)

    def test_teacher_remove_student(self, client, test_classroom, test_teacher, test_enrolled_student):
        """Test teacher can remove student from classroom"""
        response = client.delete(
            f'/api/classroom/{test_classroom["_id"]}/members/{test_enrolled_student["_id"]}',
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200
        
        # Verify student was removed
        roster = client.get(
            f'/api/classroom/{test_classroom["_id"]}/members',
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        ).json()['data']
        student_ids = [s['user_id'] for s in roster['students']]
        assert str(test_enrolled_student['_id']) not in student_ids

    def test_teacher_create_student_group(self, client, test_classroom, test_teacher):
        """Test teacher can create student groups"""
        response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/groups',
            json={
                'name': 'Advanced Learners',
                'description': 'Accelerated learning group',
                'students': []
            },
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200
        assert response.json()['status'] == 'success'
        assert 'group_id' in response.json()['data']

    def test_teacher_add_student_to_group(self, client, test_classroom, test_teacher, test_enrolled_student):
        """Test teacher can add student to group"""
        # First create group
        group_response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/groups',
            json={'name': 'Test Group', 'description': '', 'students': []},
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        group_id = group_response.json()['data']['group_id']
        
        # Then add student
        response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/groups/{group_id}/members',
            json={'student_id': str(test_enrolled_student['_id'])},
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200


class TestDashboardEndpoints:
    """Test dashboard endpoints"""

    def test_teacher_dashboard_structure(self, client, test_classroom, test_teacher):
        """Test teacher dashboard returns correct structure"""
        response = client.get(
            f'/api/classroom/{test_classroom["_id"]}/dashboard',
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200
        data = response.json()['data']
        
        # Verify teacher dashboard structure
        assert data['classroom_id'] == str(test_classroom['_id'])
        assert 'classroom_name' in data
        assert 'student_count' in data
        assert 'recent_submissions' in data
        assert 'pending_assignments' in data
        assert 'recent_announcements' in data

    def test_student_dashboard_structure(self, client, test_classroom, test_enrolled_student):
        """Test student dashboard returns correct structure"""
        response = client.get(
            f'/api/classroom/{test_classroom["_id"]}/dashboard',
            headers={'Authorization': f'Bearer {test_enrolled_student["token"]}'}
        )
        
        assert response.status_code == 200
        data = response.json()['data']
        
        # Verify student dashboard structure
        assert data['classroom_id'] == str(test_classroom['_id'])
        assert 'teacher_name' in data
        assert 'pending_assignments' in data
        assert 'announcements' in data
        assert 'modules' in data

    def test_non_member_cannot_access_dashboard(self, client, test_classroom, test_student):
        """Test non-member cannot access classroom dashboard"""
        response = client.get(
            f'/api/classroom/{test_classroom["_id"]}/dashboard',
            headers={'Authorization': f'Bearer {test_student["token"]}'}
        )
        
        assert response.status_code == 403

    def test_get_classroom_overview(self, client, test_classroom, test_teacher):
        """Test getting classroom overview statistics"""
        response = client.get(
            f'/api/classroom/{test_classroom["_id"]}/overview',
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200
        data = response.json()['data']
        assert 'classroom_id' in data
        assert 'name' in data
        assert 'student_count' in data
        assert 'assignment_count' in data
        assert 'module_count' in data


class TestAnnouncementsEndpoints:
    """Test announcements endpoints"""

    def test_teacher_create_announcement(self, client, test_classroom, test_teacher):
        """Test teacher can create announcement"""
        response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/announcements',
            json={
                'title': 'Important Update',
                'content': 'Please read this announcement carefully.',
                'target_groups': [],
                'scheduled_date': None
            },
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200
        assert response.json()['status'] == 'success'
        assert 'announcement_id' in response.json()['data']

    def test_student_cannot_create_announcement(self, client, test_classroom, test_enrolled_student):
        """Test student cannot create announcements"""
        response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/announcements',
            json={
                'title': 'Test',
                'content': 'Test content',
                'target_groups': [],
                'scheduled_date': None
            },
            headers={'Authorization': f'Bearer {test_enrolled_student["token"]}'}
        )
        
        assert response.status_code == 403

    def test_get_announcements(self, client, test_classroom, test_teacher, test_announcement):
        """Test getting announcements for classroom"""
        response = client.get(
            f'/api/classroom/{test_classroom["_id"]}/announcements',
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200
        announcements = response.json()['data']
        assert isinstance(announcements, list)

    def test_mark_announcement_viewed(self, client, test_classroom, test_enrolled_student, test_announcement):
        """Test marking announcement as viewed"""
        response = client.post(
            f'/api/classroom/{test_classroom["_id"]}/announcements/{test_announcement["_id"]}/view',
            headers={'Authorization': f'Bearer {test_enrolled_student["token"]}'}
        )
        
        assert response.status_code == 200
        assert response.json()['status'] == 'success'

    def test_teacher_update_announcement(self, client, test_classroom, test_teacher, test_announcement):
        """Test teacher can update announcement"""
        response = client.put(
            f'/api/classroom/{test_classroom["_id"]}/announcements/{test_announcement["_id"]}',
            json={
                'title': 'Updated Title',
                'content': 'Updated content',
                'target_groups': []
            },
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200

    def test_teacher_delete_announcement(self, client, test_classroom, test_teacher, test_announcement):
        """Test teacher can delete (soft delete) announcement"""
        response = client.delete(
            f'/api/classroom/{test_classroom["_id"]}/announcements/{test_announcement["_id"]}',
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200


class TestAnalyticsEndpoints:
    """Test analytics endpoints"""

    def test_teacher_get_classroom_analytics(self, client, test_classroom, test_teacher):
        """Test teacher can get classroom-wide analytics"""
        response = client.get(
            f'/api/analytics/classroom/{test_classroom["_id"]}',
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200
        data = response.json()['data']
        assert 'classroom_id' in data
        assert 'total_students' in data
        assert 'average_class_score' in data
        assert 'assignment_completion_rate' in data
        assert 'student_analytics' in data

    def test_student_cannot_get_class_analytics(self, client, test_classroom, test_enrolled_student):
        """Test student cannot access class-wide analytics"""
        response = client.get(
            f'/api/analytics/classroom/{test_classroom["_id"]}',
            headers={'Authorization': f'Bearer {test_enrolled_student["token"]}'}
        )
        
        assert response.status_code == 403

    def test_teacher_get_student_progress(self, client, test_classroom, test_teacher, test_enrolled_student):
        """Test teacher can view individual student progress"""
        response = client.get(
            f'/api/analytics/classroom/{test_classroom["_id"]}/student/{test_enrolled_student["_id"]}',
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 200
        data = response.json()['data']
        assert 'student_id' in data
        assert 'total_earned_points' in data
        assert 'average_score_percentage' in data
        assert 'module_progress' in data

    def test_student_get_own_progress(self, client, test_classroom, test_enrolled_student):
        """Test student can view own progress"""
        response = client.get(
            f'/api/analytics/classroom/{test_classroom["_id"]}/my-progress',
            headers={'Authorization': f'Bearer {test_enrolled_student["token"]}'}
        )
        
        assert response.status_code == 200
        data = response.json()['data']
        assert 'average_score_percentage' in data
        assert 'module_progress' in data

    def test_student_cannot_view_others_progress(self, client, test_classroom, test_enrolled_student, another_student):
        """Test student cannot view other students' progress"""
        response = client.get(
            f'/api/analytics/classroom/{test_classroom["_id"]}/student/{another_student["_id"]}',
            headers={'Authorization': f'Bearer {test_enrolled_student["token"]}'}
        )
        
        assert response.status_code == 403


class TestErrorHandling:
    """Test error handling and edge cases"""

    def test_invalid_classroom_id(self, client, test_teacher):
        """Test accessing non-existent classroom"""
        response = client.get(
            f'/api/classroom/invalid_id/dashboard',
            headers={'Authorization': f'Bearer {test_teacher["token"]}'}
        )
        
        assert response.status_code == 400 or response.status_code == 404

    def test_missing_authentication(self, client, test_classroom):
        """Test endpoints require authentication"""
        response = client.get(f'/api/classroom/{test_classroom["_id"]}/dashboard')
        
        assert response.status_code == 401

    def test_rbac_enforcement(self, client, test_classroom, test_student):
        """Test RBAC is properly enforced"""
        # Student tries to access teacher-only endpoint
        response = client.get(
            f'/api/analytics/classroom/{test_classroom["_id"]}',
            headers={'Authorization': f'Bearer {test_student["token"]}'}
        )
        
        assert response.status_code == 403


# Pytest fixtures (would be in conftest.py)
@pytest.fixture
def client():
    """Flask test client"""
    from Backend.main import app
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


@pytest.fixture
def test_teacher(client):
    """Create test teacher user"""
    return {
        '_id': ObjectId(),
        'email': f'teacher_{ObjectId()}@test.com',
        'role': 'teacher',
        'name': 'Test Teacher',
        'token': 'test_teacher_token'
    }


@pytest.fixture
def test_student():
    """Create test student user"""
    return {
        '_id': ObjectId(),
        'email': f'student_{ObjectId()}@test.com',
        'role': 'student',
        'name': 'Test Student',
        'token': 'test_student_token'
    }


@pytest.fixture
def test_classroom(test_teacher):
    """Create test classroom"""
    return {
        '_id': ObjectId(),
        'name': 'Test Classroom',
        'subject': 'Mathematics',
        'grade_level': '9th Grade',
        'teacher_id': test_teacher['_id'],
        'students': [],
        'enrollment_code': 'TESTCODE',
        'status': 'active'
    }


@pytest.fixture
def test_announcement(test_classroom, test_teacher):
    """Create test announcement"""
    return {
        '_id': ObjectId(),
        'classroom_id': test_classroom['_id'],
        'teacher_id': test_teacher['_id'],
        'title': 'Test Announcement',
        'content': 'This is a test announcement',
        'status': 'published'
    }
