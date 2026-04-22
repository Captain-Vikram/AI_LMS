"""
Complete assessments and populate submissions for Cloud Computing classroom.
Idempotent: will upsert `resource_engagement`, create simple `assignments` if none,
and upsert `assignment_submissions` + `activity_feed` entries for many students.

Run: python Backend/scripts/complete_cloud_classroom_assessments.py
"""

import os
import sys
import random
from datetime import datetime, timedelta

from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")
CLASSROOM_NAME = os.getenv("SEED_CLASSROOM_NAME", "Cloud Computing")
PASSING_STUDENT_RATIO = float(os.getenv("PASSING_STUDENT_RATIO", "0.8"))
GRADE_RATIO = float(os.getenv("GRADED_SUBMISSION_RATIO", "0.6"))


def now():
    return datetime.utcnow()


def to_oid(v):
    try:
        return ObjectId(v) if not isinstance(v, ObjectId) else v
    except Exception:
        return v


def find_classroom(db):
    teacher = db.users.find_one({"email": os.getenv("SEED_TEACHER_EMAIL", "aka.vigi@gmail.com")})
    classroom = None
    if teacher:
        classroom = db.classrooms.find_one({"name": CLASSROOM_NAME, "teacher_id": teacher.get("_id")})
    if not classroom:
        classroom = db.classrooms.find_one({"name": CLASSROOM_NAME})
    return classroom


def normalize_resource_id(resource: dict):
    if not isinstance(resource, dict):
        return None
    for k in ("id", "resource_id", "_id"):
        v = resource.get(k)
        if v:
            return str(v)
    return None


def main():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client.get_database("quasar")

    classroom = find_classroom(db)
    if not classroom:
        print("Classroom not found. Check MONGO_URI and CLASSROOM_NAME.")
        sys.exit(1)

    classroom_oid = classroom.get("_id")
    students = classroom.get("students", []) or []
    if not students:
        print("No students in classroom. Nothing to do.")
        return

    # Determine passers (majority of students)
    student_ids = list(students)
    random.seed(2026)
    num_passers = max(1, int(len(student_ids) * PASSING_STUDENT_RATIO))
    passers = set(random.sample([str(s) for s in student_ids], num_passers))

    modules = list(db.learning_modules.find({"classroom_id": classroom_oid, "status": "published"}))

    total_engagements = 0
    total_assignments_created = 0
    total_submissions = 0
    total_activity = 0

    # Update resource_engagements: mark passed resources for passers
    for module in modules:
        module_id = module.get("_id")
        resources = module.get("resources", []) or []
        if not resources:
            continue

        # For each resource build stable id
        resource_ids = [normalize_resource_id(r) or str(r.get("_id") if isinstance(r, dict) else r) for r in resources]

        for sid in student_ids:
            sid_str = str(sid)
            is_passer = sid_str in passers

            # Determine which resources to mark passed for this student
            if is_passer:
                # pass most resources for this module
                to_pass = resource_ids
            else:
                # non-passers get a smaller subset
                k = max(0, int(len(resource_ids) * 0.2))
                to_pass = random.sample(resource_ids, k) if k > 0 else []

            for rid in resource_ids:
                # Build a realistic engagement
                passed = rid in to_pass
                viewed = True if passed or random.random() < 0.6 else False
                test_attempts = random.randint(1, 3) if viewed else 0

                if passed:
                    test_score = round(random.uniform(80, 100), 1)
                else:
                    # keep some variety for non-passers
                    test_score = round(random.uniform(10, 79), 1) if test_attempts > 0 else None

                ts = now() - timedelta(days=random.randint(0, 7), hours=random.randint(0, 23))

                filter_q = {
                    "student_id": to_oid(sid),
                    "resource_id": rid,
                    "module_id": to_oid(module_id) if module_id else None,
                }

                doc = {
                    "classroom_id": classroom_oid,
                    "student_id": to_oid(sid),
                    "module_id": to_oid(module_id) if module_id else None,
                    "resource_id": rid,
                    "viewed": bool(viewed),
                    "view_duration_seconds": random.randint(30, 60 * 30) if viewed else 0,
                    "completion_percentage": int(test_score) if test_score is not None else (100 if viewed else 0),
                    "test_score": float(test_score) if test_score is not None else None,
                    "test_attempts": int(test_attempts),
                    "helpful": None,
                    "notes": "Auto-completed for demo",
                    "updated_at": ts,
                }

                try:
                    # Use upsert to be idempotent
                    db.resource_engagement.update_one(filter_q, {"$set": doc}, upsert=True)
                    total_engagements += 1
                except Exception as e:
                    print("Failed to upsert engagement", e)

    # Ensure there are assignments for this classroom (create one per module if none)
    existing_assignments = list(db.assignments.find({"classroom_id": classroom_oid}))
    if not existing_assignments:
        for module in modules:
            aid = ObjectId()
            assignment = {
                "_id": aid,
                "classroom_id": classroom_oid,
                "module_id": module.get("_id"),
                "title": f"{module.get('name','Module')} - Assignment",
                "description": "Auto-generated assignment to populate submissions.",
                "total_points": 100,
                "due_date": now() + timedelta(days=7),
                "created_date": now(),
                "updated_date": now(),
                "status": "published",
            }
            try:
                db.assignments.insert_one(assignment)
                total_assignments_created += 1
            except Exception:
                pass

    assignments = list(db.assignments.find({"classroom_id": classroom_oid}))

    # For each assignment, create submissions for most students and grade some
    for assignment in assignments:
        aid = assignment.get("_id")
        total_points = int(assignment.get("total_points", 100) or 100)

        for sid in student_ids:
            sid_str = str(sid)
            is_passer = sid_str in passers

            # Decide if student submits
            submitted = random.random() < 0.85 if is_passer else random.random() < 0.35
            if not submitted:
                continue

            # If already exists, skip to keep idempotency
            existing = db.assignment_submissions.find_one({"assignment_id": aid, "student_id": to_oid(sid)})
            if existing:
                continue

            # Decide if graded
            graded = random.random() < GRADE_RATIO

            if is_passer:
                score_pct = random.uniform(75, 100)
            else:
                score_pct = random.uniform(30, 74)

            score = round((score_pct / 100.0) * total_points, 1) if graded else None

            submitted_date = now() - timedelta(days=random.randint(0, 7), hours=random.randint(0, 23))

            submission_doc = {
                "_id": ObjectId(),
                "classroom_id": classroom_oid,
                "assignment_id": aid,
                "student_id": to_oid(sid),
                "status": "graded" if graded else "submitted",
                "submitted_date": submitted_date,
                "score": float(score) if score is not None else None,
                "review_comments": "Auto-graded: good work" if graded else None,
            }

            try:
                db.assignment_submissions.insert_one(submission_doc)
                total_submissions += 1

                # Log activity: submitted
                act_sub = {
                    "classroom_id": classroom_oid,
                    "action_type": "assessment_submitted",
                    "student_id": to_oid(sid),
                    "action_performed_by_id": to_oid(sid),
                    "assessment_id": str(aid),
                    "details": {"submitted_date": submitted_date.isoformat()},
                    "created_at": submitted_date,
                }
                try:
                    db.activity_feed.insert_one(act_sub)
                    total_activity += 1
                except Exception:
                    pass

                if graded:
                    graded_date = submitted_date + timedelta(hours=random.randint(1, 72))
                    act_grade = {
                        "classroom_id": classroom_oid,
                        "action_type": "assessment_graded",
                        "student_id": to_oid(sid),
                        "action_performed_by_id": classroom.get("teacher_id"),
                        "assessment_id": str(aid),
                        "details": {"score": submission_doc.get("score")},
                        "created_at": graded_date,
                    }
                    try:
                        db.activity_feed.insert_one(act_grade)
                        total_activity += 1
                    except Exception:
                        pass

            except Exception as e:
                print("Failed to insert submission", e)

    print("Summary:")
    print(f" - Resource engagements upserted: {total_engagements}")
    print(f" - Assignments created: {total_assignments_created}")
    print(f" - Assignment submissions inserted: {total_submissions}")
    print(f" - Activity feed entries created: {total_activity}")


if __name__ == "__main__":
    main()
