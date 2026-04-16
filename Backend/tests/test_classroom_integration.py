import os
import sys
import pytest
from datetime import datetime
from bson import ObjectId

# Ensure Backend directory is on sys.path when running tests from repo root
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from database import db


def test_seed_and_basic_classroom_flow():
    # Ensure seed script created the classroom
    classroom = db.classrooms.find_one({"name": "Seeded Class - 60 Students"})
    assert classroom is not None
    assert isinstance(classroom.get("students", []), list)
    assert len(classroom.get("students", [])) >= 60

    # Check teacher membership
    teacher_id = classroom.get("teacher_id")
    assert teacher_id is not None

    # Check one student has classroom_membership entry
    student_oid = classroom.get("students")[0]
    student = db.users.find_one({"_id": student_oid})
    assert student is not None
    found = False
    for m in student.get("classroom_memberships", []):
        if str(m.get("classroom_id")) == str(classroom.get("_id")):
            found = True
    assert found
