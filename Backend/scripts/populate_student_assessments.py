"""
Idempotent script to populate student progress and resource engagement for a classroom.

It will:
- Find the classroom by name (default: "Cloud Computing").
- For each published module and each resource, upsert `student_progress` and
  `resource_engagement` for enrolled students so most students appear to have
  passed tests (>= 80%).
- Insert activity_feed entries (quiz_passed / quiz_failed) if similar recent
  events are not already present.

Run with:
    python Backend/scripts/populate_student_assessments.py

Environment vars:
- MONGO_URI: MongoDB connection string (default: mongodb://localhost:27017/quasar)
- TARGET_CLASSROOM_NAME: classroom name to target (default: Cloud Computing)
- PASS_RATIO: fraction of students who should pass each resource (default: 0.75)
"""

import os
import random
import sys
from datetime import datetime, timedelta

from bson import ObjectId
from pymongo import MongoClient


MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")
TARGET_CLASSROOM_NAME = os.getenv("TARGET_CLASSROOM_NAME", "Cloud Computing")
PASS_RATIO = float(os.getenv("PASS_RATIO", "0.75"))


def now():
    return datetime.utcnow()


def main():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client.get_database("quasar")

    classroom = db.classrooms.find_one({"name": TARGET_CLASSROOM_NAME})
    if not classroom:
        print(f"Classroom named '{TARGET_CLASSROOM_NAME}' not found. Exiting.")
        sys.exit(1)

    classroom_oid = classroom.get("_id")
    students = list(classroom.get("students", []))
    if not students:
        print("No students found in the classroom. Nothing to do.")
        return

    modules = list(db.learning_modules.find({"classroom_id": classroom_oid, "status": "published"}))
    if not modules:
        print("No published modules found for this classroom. Nothing to do.")
        return

    inserted_activity = 0
    upserted_engagements = 0
    upserted_progress = 0

    for module in modules:
        module_oid = module.get("_id")
        module_id_str = str(module_oid)
        resources = [r for r in module.get("resources", []) if isinstance(r, dict)]
        if not resources:
            continue

        for student_oid in students:
            # randomize per-student passing behavior so not everyone looks identical
            for resource in resources:
                resource_id = resource.get("id") or resource.get("resource_id")
                if not resource_id:
                    continue

                passed = random.random() < PASS_RATIO
                # timestamps in the past week
                ts = now() - timedelta(days=random.randint(0, 7), hours=random.randint(0, 23), minutes=random.randint(0, 59))

                # StudentProgress uses string IDs in other routes; keep that shape
                progress_filter = {
                    "student_id": str(student_oid),
                    "module_id": module_id_str,
                    "resource_id": resource_id,
                }

                tests_taken = 2 if passed else random.randint(0, 2)
                passed_tests = 2 if passed else (1 if tests_taken > 0 and random.random() < 0.3 else 0)
                failed_tests = max(0, tests_taken - passed_tests)
                highest_score = round(random.uniform(80.0, 98.0), 2) if passed else round(random.uniform(20.0, 65.0), 2)

                progress_update = {
                    "$set": {
                        "classroom_id": str(classroom_oid),
                        "is_unlocked": True,
                        "unlocked_at": ts,
                        "tests_taken": tests_taken,
                        "passed_tests_count": passed_tests,
                        "failed_tests_count": failed_tests,
                        "highest_score": highest_score,
                        "last_test_date": ts,
                        "updated_at": ts,
                    },
                    "$setOnInsert": {
                        "created_at": ts
                    }
                }

                res = db.student_progress.update_one(progress_filter, progress_update, upsert=True)
                if res.upserted_id or res.modified_count:
                    upserted_progress += 1

                # resource_engagement stores ObjectId student/module ids
                engagement_filter = {
                    "student_id": ObjectId(str(student_oid)),
                    "resource_id": resource_id,
                    "module_id": module_oid,
                }

                view_seconds = random.randint(30, 1800)
                test_score = int(highest_score) if passed else int(round(highest_score))
                completion = 100 if passed else random.randint(0, 65)
                attempts = max(1, tests_taken)

                engagement_doc = {
                    "student_id": ObjectId(str(student_oid)),
                    "resource_id": resource_id,
                    "module_id": module_oid,
                    "viewed": True,
                    "view_duration_seconds": view_seconds,
                    "completion_percentage": completion,
                    "test_score": test_score,
                    "test_attempts": attempts,
                    "rating": None,
                    "helpful": None,
                    "notes": "",
                    "updated_at": ts,
                }

                res2 = db.resource_engagement.update_one(engagement_filter, {"$set": engagement_doc, "$setOnInsert": {"created_at": ts}}, upsert=True)
                if res2.upserted_id or res2.modified_count:
                    upserted_engagements += 1

                # Add activity feed entry if not present in the last 14 days
                action_type = "quiz_passed" if passed else "quiz_failed"
                activity_filter = {
                    "classroom_id": str(classroom_oid),
                    "student_id": str(student_oid),
                    "resource_id": resource_id,
                    "action_type": action_type,
                }

                recent_window = now() - timedelta(days=14)
                existing = db.activity_feed.find_one({**activity_filter, "created_at": {"$gte": recent_window}})
                if not existing:
                    activity_doc = {
                        "classroom_id": str(classroom_oid),
                        "action_type": action_type,
                        "student_id": str(student_oid),
                        "action_performed_by_id": str(student_oid),
                        "resource_id": resource_id,
                        "module_id": module_id_str,
                        "details": {"score": float(test_score)},
                        "created_at": ts,
                    }
                    try:
                        db.activity_feed.insert_one(activity_doc)
                        inserted_activity += 1
                    except Exception:
                        pass

    print(f"Upserted student_progress docs: {upserted_progress}")
    print(f"Upserted resource_engagement docs: {upserted_engagements}")
    print(f"Inserted activity_feed docs: {inserted_activity}")


if __name__ == "__main__":
    main()
