"""
Seed a classroom with one teacher and 60 students for integration testing.
Run with: python Backend/scripts/seed_classroom_60_students.py
"""
import os
import sys
from datetime import datetime
from bson import ObjectId

# Ensure Backend directory is on sys.path when running from repo root
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from database import db


def seed_classroom(num_students: int = 60):
    users = db.users
    classrooms = db.classrooms

    # Create teacher
    teacher_email = "seed_teacher@example.com"
    existing = users.find_one({"email": teacher_email})
    if existing:
        teacher_id = existing["_id"]
    else:
        teacher_res = users.insert_one({
            "email": teacher_email,
            "password_hash": "",
            "role": "teacher",
            "registration_date": datetime.utcnow(),
            "last_login": None,
            "status": "active",
            "classroom_memberships": []
        })
        teacher_id = teacher_res.inserted_id

    # Create students
    student_ids = []
    for i in range(1, num_students + 1):
        email = f"seed_student_{i}@example.com"
        existing = users.find_one({"email": email})
        if existing:
            student_ids.append(existing["_id"])
            continue

        res = users.insert_one({
            "email": email,
            "password_hash": "",
            "role": "student",
            "registration_date": datetime.utcnow(),
            "last_login": None,
            "status": "active",
            "classroom_memberships": []
        })
        student_ids.append(res.inserted_id)

    # Create classroom
    classroom = {
        "institution_id": None,
        "name": "Seeded Class - 60 Students",
        "subject": "Mathematics",
        "grade_level": "10",
        "description": "Auto-generated classroom for testing",
        "teacher_id": teacher_id,
        "co_teachers": [],
        "students": student_ids,
        "student_groups": [],
        "status": "active",
        "start_date": datetime.utcnow(),
        "end_date": None,
        "enrollment_code": "SEED60",
        "require_approval": False,
        "created_date": datetime.utcnow(),
        "updated_date": datetime.utcnow()
    }

    res = classrooms.insert_one(classroom)
    class_id = res.inserted_id

    # Update memberships for teacher and students
    users.update_one({"_id": teacher_id}, {"$push": {"classroom_memberships": {
        "classroom_id": str(class_id),
        "role": "teacher",
        "joined_date": datetime.utcnow(),
        "is_active": True
    }}})

    for sid in student_ids:
        users.update_one({"_id": sid}, {"$push": {"classroom_memberships": {
            "classroom_id": str(class_id),
            "role": "student",
            "joined_date": datetime.utcnow(),
            "is_active": True
        }}})

    print(f"Seeded classroom {class_id} with {len(student_ids)} students and teacher {teacher_id}")


if __name__ == "__main__":
    seed_classroom(60)
