from enum import Enum
from typing import List, Optional
from bson import ObjectId
from database import get_db


class Permission(Enum):
    CREATE_CLASSROOM = "create_classroom"
    VIEW_CLASSROOM = "view_classroom"
    EDIT_CLASSROOM = "edit_classroom"
    DELETE_CLASSROOM = "delete_classroom"
    ADD_STUDENTS = "add_students"
    REMOVE_STUDENTS = "remove_students"
    MANAGE_GROUPS = "manage_groups"
    CREATE_ASSIGNMENT = "create_assignment"
    GRADE_SUBMISSION = "grade_submission"
    VIEW_GRADES = "view_grades"
    VIEW_CLASSROOM_ANALYTICS = "view_classroom_analytics"
    VIEW_STUDENT_ANALYTICS = "view_student_analytics"


class RBACService:
    def __init__(self, db=None):
        self.db = db if db is not None else get_db()

    def is_classroom_member(self, user_id: str, classroom_id: str) -> bool:
        db = self.db
        try:
            classroom = db.classrooms.find_one({"_id": ObjectId(classroom_id)})
        except Exception:
            return False
        if not classroom:
            return False
        user_oid = ObjectId(user_id)
        return (user_oid in classroom.get("students", [])) or (user_oid == classroom.get("teacher_id"))

    def is_teacher(self, user_id: str, classroom_id: str) -> bool:
        db = self.db
        try:
            classroom = db.classrooms.find_one({"_id": ObjectId(classroom_id), "teacher_id": ObjectId(user_id)})
        except Exception:
            return False
        return classroom is not None

    def is_student(self, user_id: str, classroom_id: str) -> bool:
        db = self.db
        try:
            classroom = db.classrooms.find_one({"_id": ObjectId(classroom_id), "students": ObjectId(user_id)})
        except Exception:
            return False
        return classroom is not None

    def get_user_classrooms(self, user_id: str) -> dict:
        db = self.db
        user_oid = ObjectId(user_id)
        as_teacher = list(db.classrooms.find({"teacher_id": user_oid}, {"_id": 1, "name": 1, "subject": 1}).sort("name", 1))
        as_student = list(db.classrooms.find({"students": user_oid}, {"_id": 1, "name": 1, "subject": 1}).sort("name", 1))
        # convert ids to str
        def map_list(items):
            out = []
            for it in items:
                it["_id"] = str(it["_id"])
                out.append(it)
            return out
        return {
            "as_teacher": map_list(as_teacher),
            "as_student": map_list(as_student),
            "total": len(as_teacher) + len(as_student)
        }

    def has_permission(self, user_id: str, classroom_id: str, permission: Permission) -> bool:
        # derive role from classroom membership
        if not self.is_classroom_member(user_id, classroom_id):
            return False

        if self.is_teacher(user_id, classroom_id):
            teacher_perms = {
                Permission.VIEW_CLASSROOM,
                Permission.EDIT_CLASSROOM,
                Permission.ADD_STUDENTS,
                Permission.REMOVE_STUDENTS,
                Permission.CREATE_ASSIGNMENT,
                Permission.GRADE_SUBMISSION,
                Permission.VIEW_GRADES,
                Permission.VIEW_CLASSROOM_ANALYTICS,
            }
            return permission in teacher_perms

        # student permissions
        student_perms = {
            Permission.VIEW_CLASSROOM,
            Permission.VIEW_STUDENT_ANALYTICS,
        }
        return permission in student_perms
