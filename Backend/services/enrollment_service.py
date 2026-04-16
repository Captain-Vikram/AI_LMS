from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum

try:
    from functions.utils import normalize_user_role
except ModuleNotFoundError:
    # Supports imports when tests execute from repo root (Backend package path).
    from Backend.functions.utils import normalize_user_role

class EnrollmentStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"

class EnrollmentService:
    def __init__(self, db):
        self.db = db

    def _to_object_id(self, value):
        if isinstance(value, ObjectId):
            return value
        if isinstance(value, str):
            try:
                return ObjectId(value)
            except InvalidId:
                return None
        return None

    def _resolve_display_name(self, user_doc: Dict) -> str:
        profile = user_doc.get("profile") if isinstance(user_doc.get("profile"), dict) else {}
        profile_name = (profile.get("name") or "").strip() if profile else ""
        if profile_name:
            return profile_name

        first_name = str(user_doc.get("first_name") or "").strip()
        last_name = str(user_doc.get("last_name") or "").strip()
        full_name = f"{first_name} {last_name}".strip()
        if full_name:
            return full_name

        email = str(user_doc.get("email") or "").strip()
        if email and "@" in email:
            return email.split("@")[0]

        return "Unknown"

    def _serialize_student_groups(self, groups: List[Dict]) -> List[Dict]:
        serialized = []
        for group in groups or []:
            serialized.append(
                {
                    "_id": str(group.get("_id")) if group.get("_id") else None,
                    "name": group.get("name"),
                    "description": group.get("description", ""),
                    "students": [str(student_id) for student_id in group.get("students", [])],
                    "created_date": group.get("created_date").isoformat()
                    if isinstance(group.get("created_date"), datetime)
                    else group.get("created_date"),
                }
            )
        return serialized

    def enroll_student(
        self,
        student_id: str,
        classroom_id: str,
        enrollment_code: str = None,
        require_approval: bool = False
    ) -> Dict:
        """Enroll a student in a classroom"""
        
        student_oid = ObjectId(student_id)
        classroom_oid = ObjectId(classroom_id)

        # Verify classroom exists
        classroom = self.db.classrooms.find_one({"_id": classroom_oid})
        if not classroom:
            raise ValueError("Classroom not found")

        # Check if already enrolled
        if student_oid in classroom.get("students", []):
            raise ValueError("Student already enrolled in this classroom")

        # If enrollment code required, verify it
        if classroom.get("enrollment_code") and enrollment_code:
            if classroom["enrollment_code"] != enrollment_code:
                raise ValueError("Invalid enrollment code")

        # Add student to classroom
        self.db.classrooms.update_one(
            {"_id": classroom_oid},
            {"$push": {"students": student_oid}}
        )

        # Add classroom membership to student
        membership = {
            "classroom_id": classroom_oid,
            "role": "student",
            "joined_date": datetime.utcnow(),
            "is_active": True,
            "onboarding_complete": False,
            "assessment_complete": False,
            "status": EnrollmentStatus.ACTIVE
        }

        self.db.users.update_one(
            {"_id": student_oid},
            {"$push": {"classroom_memberships": membership}}
        )

        return {
            "classroom_id": str(classroom_oid),
            "student_id": str(student_oid),
            "status": "enrolled"
        }

    def disenroll_student(self, student_id: str, classroom_id: str) -> Dict:
        """Remove a student from a classroom"""
        
        student_oid = ObjectId(student_id)
        classroom_oid = ObjectId(classroom_id)

        # Remove from students list
        self.db.classrooms.update_one(
            {"_id": classroom_oid},
            {"$pull": {"students": student_oid}}
        )

        # Mark membership as inactive
        self.db.users.update_one(
            {"_id": student_oid},
            {"$pull": {"classroom_memberships": {"classroom_id": classroom_oid}}}
        )

        return {"status": "disenrolled"}

    def bulk_enroll_students(
        self,
        classroom_id: str,
        student_ids: List[str],
        teacher_id: str
    ) -> Dict:
        """Bulk enroll multiple students from CSV/roster"""
        
        classroom_oid = ObjectId(classroom_id)
        classroom = self.db.classrooms.find_one({"_id": classroom_oid})
        
        if not classroom:
            raise ValueError("Classroom not found")

        if str(classroom.get("teacher_id")) != teacher_id:
            raise ValueError("Only classroom teacher can bulk enroll")

        success_count = 0
        failed_count = 0
        errors = []

        for student_id in student_ids:
            try:
                self.enroll_student(student_id, classroom_id)
                success_count += 1
            except Exception as e:
                failed_count += 1
                errors.append({"student_id": student_id, "error": str(e)})

        return {
            "success": success_count,
            "failed": failed_count,
            "errors": errors
        }

    def create_student_group(
        self,
        classroom_id: str,
        name: str,
        description: str = "",
        students: List[str] = None
    ) -> Dict:
        """Create a student group within a classroom"""
        
        classroom_oid = ObjectId(classroom_id)
        student_oids = [ObjectId(s) for s in (students or [])]

        group = {
            "_id": ObjectId(),
            "name": name,
            "description": description,
            "students": student_oids,
            "created_date": datetime.utcnow()
        }

        self.db.classrooms.update_one(
            {"_id": classroom_oid},
            {"$push": {"student_groups": group}}
        )

        return {
            "group_id": str(group["_id"]),
            "classroom_id": str(classroom_oid),
            "name": name
        }

    def add_student_to_group(
        self,
        classroom_id: str,
        group_id: str,
        student_id: str
    ) -> Dict:
        """Add a student to a group"""
        
        classroom_oid = ObjectId(classroom_id)
        group_oid = ObjectId(group_id)
        student_oid = ObjectId(student_id)

        self.db.classrooms.update_one(
            {"_id": classroom_oid, "student_groups._id": group_oid},
            {"$addToSet": {"student_groups.$.students": student_oid}}
        )

        return {"status": "added"}

    def get_classroom_roster(self, classroom_id: str) -> Dict:
        """Get full classroom roster with student details"""
        
        classroom_oid = ObjectId(classroom_id)
        classroom = self.db.classrooms.find_one(
            {"_id": classroom_oid},
            {"students": 1, "student_groups": 1}
        )

        if not classroom:
            raise ValueError("Classroom not found")

        # Get student details
        students = list(self.db.users.find(
            {"_id": {"$in": classroom.get("students", [])}},
            {"email": 1, "profile": 1, "role": 1, "first_name": 1, "last_name": 1}
        ))

        return {
            "total_students": len(students),
            "students": [
                {
                    "user_id": str(s["_id"]),
                    "email": s["email"],
                    "name": self._resolve_display_name(s),
                    "role": normalize_user_role(s.get("role")),
                }
                for s in students
            ],
            "student_groups": self._serialize_student_groups(classroom.get("student_groups", [])),
        }

    def get_student_enrollment_progress(self, student_id: str) -> Dict:
        """Get all classrooms and enrollment status for a student"""
        
        student_oid = ObjectId(student_id)
        user = self.db.users.find_one(
            {"_id": student_oid},
            {"classroom_memberships": 1}
        )

        if not user:
            raise ValueError("Student not found")

        classrooms = []
        for membership in user.get("classroom_memberships", []):
            classroom_oid = self._to_object_id(membership.get("classroom_id"))
            if not classroom_oid:
                continue

            classroom = self.db.classrooms.find_one(
                {"_id": classroom_oid},
                {"name": 1, "subject": 1, "grade_level": 1, "teacher_id": 1}
            )

            if classroom:
                joined_date = membership.get("joined_date")
                classrooms.append({
                    "classroom_id": str(classroom["_id"]),
                    "name": classroom["name"],
                    "subject": classroom.get("subject"),
                    "grade_level": classroom.get("grade_level"),
                    "role": normalize_user_role(membership.get("role")),
                    "joined_date": joined_date.isoformat() if isinstance(joined_date, datetime) else joined_date,
                    "onboarding_complete": bool(membership.get("onboarding_complete", False)),
                    "assessment_complete": bool(membership.get("assessment_complete", False)),
                })

        return {
            "student_id": str(student_oid),
            "total_classrooms": len(classrooms),
            "classrooms": classrooms
        }
