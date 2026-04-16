from bson import ObjectId
from datetime import datetime
from typing import Any, Dict, List

class DashboardService:
    def __init__(self, db):
        self.db = db

    def _materialize_query(
        self,
        query_result,
        sort_field: str = None,
        direction: int = -1,
        limit: int = None,
    ) -> List[Dict[str, Any]]:
        """Normalize cursor/list query results for both runtime and unit-test mocks."""
        if isinstance(query_result, list):
            items = list(query_result)
            if sort_field:
                items.sort(
                    key=lambda row: row.get(sort_field) or datetime.min,
                    reverse=direction == -1,
                )
            if limit is not None:
                items = items[:limit]
            return items

        cursor = query_result
        if sort_field:
            cursor = cursor.sort(sort_field, direction)
        if limit is not None:
            cursor = cursor.limit(limit)
        return list(cursor)

    def _safe_count(self, collection_name: str, query: Dict[str, Any]) -> int:
        collection = getattr(self.db, collection_name, None)
        if collection is None:
            return 0

        count_documents = getattr(collection, "count_documents", None)
        if not callable(count_documents):
            return 0

        try:
            value = count_documents(query)
            return int(value) if isinstance(value, (int, float)) else 0
        except Exception:
            return 0

    def _to_iso(self, value: Any) -> Any:
        if isinstance(value, datetime):
            return value.isoformat()
        return value

    def _serialize_resource(self, resource: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "resource_id": resource.get("resource_id"),
            "title": resource.get("title", "Untitled Resource"),
            "description": resource.get("description", ""),
            "url": resource.get("url", ""),
            "resource_type": resource.get("resource_type", "article"),
            "skill": resource.get("skill", "General"),
            "approval_status": resource.get("approval_status", "pending"),
            "source": resource.get("source", "ai"),
            "created_date": self._to_iso(resource.get("created_date")),
            "updated_date": self._to_iso(resource.get("updated_date")),
            "approved_date": self._to_iso(resource.get("approved_date")),
            "approved_by": resource.get("approved_by"),
        }

    def _resource_summary(self, resources: List[Dict[str, Any]]) -> Dict[str, int]:
        approved = sum(1 for resource in resources if resource.get("approval_status") == "approved")
        rejected = sum(1 for resource in resources if resource.get("approval_status") == "rejected")
        pending = max(0, len(resources) - approved - rejected)
        return {
            "total": len(resources),
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
        }

    def get_teacher_dashboard(self, classroom_id: str, teacher_id: str) -> Dict:
        """Get teacher's classroom dashboard"""
        
        classroom_oid = ObjectId(classroom_id)
        teacher_oid = ObjectId(teacher_id)

        # Verify teacher ownership
        classroom = self.db.classrooms.find_one({
            "_id": classroom_oid,
            "teacher_id": teacher_oid
        })

        if not classroom:
            raise ValueError("Classroom not found or access denied")

        # Get student count
        student_count = len(classroom.get("students", []))
        
        # Get recent submissions (if assignments collection exists)
        recent_submissions = self._materialize_query(
            self.db.assignment_submissions.find(
                {"classroom_id": classroom_oid},
                {"assignment_id": 1, "student_id": 1, "status": 1, "submitted_date": 1}
            ),
            sort_field="submitted_date",
            direction=-1,
            limit=10,
        )

        # Get pending assignments
        pending_assignments = self._materialize_query(
            self.db.assignments.find(
                {"classroom_id": classroom_oid, "due_date": {"$gte": datetime.utcnow()}},
                {"title": 1, "due_date": 1, "total_points": 1}
            ),
            limit=5,
        )

        # Get announcements
        announcements = self._materialize_query(
            self.db.announcements.find(
                {"classroom_id": classroom_oid},
                {"title": 1, "created_date": 1}
            ),
            sort_field="created_date",
            direction=-1,
            limit=5,
        )

        resources = [item for item in classroom.get("ai_resources", []) if isinstance(item, dict)]
        pending_resources = [
            self._serialize_resource(item)
            for item in resources
            if item.get("approval_status", "pending") == "pending"
        ]

        return {
            "classroom_id": str(classroom_oid),
            "classroom_name": classroom["name"],
            "classroom_subject": classroom.get("subject"),
            "classroom_grade": classroom.get("grade_level"),
            "subject_focus_areas": classroom.get("subject_focus_areas", []),
            "student_count": student_count,
            "recent_submissions": [
                {
                    "assignment_id": str(s.get("assignment_id")) if s.get("assignment_id") else None,
                    "student_id": str(s.get("student_id")) if s.get("student_id") else None,
                    "status": s.get("status"),
                    "submitted_date": self._to_iso(s.get("submitted_date")),
                }
                for s in recent_submissions
            ],
            "pending_assignments": [
                {
                    "title": a.get("title"),
                    "due_date": self._to_iso(a.get("due_date")),
                    "points": a.get("total_points", 0)
                }
                for a in pending_assignments
            ],
            "recent_announcements": [
                {
                    "title": ann.get("title"),
                    "created_date": self._to_iso(ann.get("created_date")),
                }
                for ann in announcements
            ],
            "resource_summary": self._resource_summary(resources),
            "pending_ai_resources": pending_resources[:8],
        }

    def get_student_dashboard(self, classroom_id: str, student_id: str) -> Dict:
        """Get student's classroom dashboard"""
        
        classroom_oid = ObjectId(classroom_id)
        student_oid = ObjectId(student_id)

        # Verify student enrollment
        classroom = self.db.classrooms.find_one({
            "_id": classroom_oid,
            "students": student_oid
        })

        if not classroom:
            raise ValueError("Classroom not found or not enrolled")

        # Get pending assignments for this student
        pending_assignments = self._materialize_query(
            self.db.assignments.find(
                {"classroom_id": classroom_oid, "due_date": {"$gte": datetime.utcnow()}},
                {"title": 1, "due_date": 1, "description": 1, "total_points": 1}
            ),
            sort_field="due_date",
            direction=1,
        )

        # Get student's submission status
        submissions_by_assignment = {}
        for assignment in pending_assignments:
            assignment_id = assignment.get("_id")
            submission = self.db.assignment_submissions.find_one({
                "assignment_id": assignment_id,
                "student_id": student_oid
            }) if assignment_id else None
            submissions_by_assignment[str(assignment_id)] = {
                "submitted": submission is not None,
                "status": submission.get("status") if submission else "not_started",
                "score": submission.get("score") if submission else None
            }

        # Get recent announcements
        announcements = self._materialize_query(
            self.db.announcements.find(
                {"classroom_id": classroom_oid},
                {"title": 1, "content": 1, "created_date": 1}
            ),
            sort_field="created_date",
            direction=-1,
            limit=5,
        )

        # Get enrolled modules
        modules = self._materialize_query(
            self.db.learning_modules.find(
                {"classroom_id": classroom_oid, "status": "published"},
                {"name": 1, "order": 1, "estimated_hours": 1}
            ),
            sort_field="order",
            direction=1,
        )

        approved_resources = [
            self._serialize_resource(item)
            for item in classroom.get("ai_resources", [])
            if isinstance(item, dict) and item.get("approval_status") == "approved"
        ]

        return {
            "classroom_id": str(classroom_oid),
            "classroom_name": classroom["name"],
            "classroom_subject": classroom.get("subject"),
            "teacher_name": self._get_teacher_name(classroom.get("teacher_id")),
            "subject_focus_areas": classroom.get("subject_focus_areas", []),
            "pending_assignments": [
                {
                    "assignment_id": str(a.get("_id")) if a.get("_id") else None,
                    "title": a.get("title"),
                    "due_date": self._to_iso(a.get("due_date")),
                    "points": a.get("total_points", 0),
                    "submission_status": submissions_by_assignment.get(str(a.get("_id")), {})
                }
                for a in pending_assignments
            ],
            "announcements": [
                {
                    "title": ann.get("title"),
                    "content": ann.get("content", ""),
                    "created_date": self._to_iso(ann.get("created_date")),
                }
                for ann in announcements
            ],
            "modules": [
                {
                    "module_id": str(m.get("_id")) if m.get("_id") else None,
                    "title": m.get("name", "Untitled Module"),
                    "order": m.get("order"),
                    "estimated_hours": m.get("estimated_hours", 0)
                }
                for m in modules
            ],
            "class_resources": approved_resources[:12],
            "class_resource_summary": self._resource_summary(approved_resources),
            "resource_modes": ["class", "personal"],
        }

    def _get_teacher_name(self, teacher_id) -> str:
        """Helper to get teacher name"""
        if not teacher_id:
            return "Unknown"
        
        teacher = self.db.users.find_one(
            {"_id": ObjectId(teacher_id)},
            {"profile": 1}
        )
        return teacher.get("profile", {}).get("name", "Unknown") if teacher else "Unknown"

    def get_classroom_overview(self, classroom_id: str) -> Dict:
        """Get high-level classroom statistics"""
        
        classroom_oid = ObjectId(classroom_id)
        classroom = self.db.classrooms.find_one({"_id": classroom_oid})

        if not classroom:
            raise ValueError("Classroom not found")

        student_count = len(classroom.get("students", []))
        assignment_count = self._safe_count("assignments", {"classroom_id": classroom_oid})
        module_count = self._safe_count("learning_modules", {"classroom_id": classroom_oid})

        return {
            "classroom_id": str(classroom_oid),
            "name": classroom["name"],
            "subject": classroom.get("subject"),
            "grade_level": classroom.get("grade_level"),
            "student_count": student_count,
            "assignment_count": assignment_count,
            "module_count": module_count,
            "status": classroom.get("status"),
            "created_date": self._to_iso(classroom.get("created_date")),
        }
