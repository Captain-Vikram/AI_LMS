"""
Fill dashboard-like student and classroom activity: deterministic test scores for main student,
more AI questions to reach target totals, and login_logs.
Idempotent: will upsert resource_engagement entries for the main student and add activity_feed entries
if they don't exist in the same timestamp window.
"""

import os
import sys
from datetime import datetime, timedelta
import random
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")
CLASSROOM_NAME = os.getenv("SEED_CLASSROOM_NAME", "Cloud Computing")
TEACHER_EMAIL = os.getenv("SEED_TEACHER_EMAIL", "aka.vigi@gmail.com")
MAIN_STUDENT_EMAIL = os.getenv("SEED_MAIN_STUDENT_EMAIL", "huh@email.com")

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client.get_database("quasar")

random.seed(123)


def find_classroom():
    teacher = db.users.find_one({"email": TEACHER_EMAIL})
    classroom = None
    if teacher:
        classroom = db.classrooms.find_one({"name": CLASSROOM_NAME, "teacher_id": teacher.get("_id")})
    if not classroom:
        classroom = db.classrooms.find_one({"name": CLASSROOM_NAME})
    return teacher, classroom


def iso(dt):
    return dt.isoformat() if isinstance(dt, datetime) else dt


def set_main_student_scores(classroom, main_student):
    # Find modules for classroom
    classroom_oid = classroom.get("_id")
    modules = list(db.learning_modules.find({"classroom_id": classroom_oid}).sort("order", 1))
    if not modules:
        print("No modules found; skipping main student score updates")
        return

    # Pick up to 4 resource entries across modules for main student
    target_scores = [37.0, 49.0, 85.0, 73.0]  # to roughly average 61
    idx = 0
    updated = 0
    for m in modules:
        resources = m.get("resources") or []
        if not resources:
            continue
        # pick first resource in module
        r = resources[0]
        resource_id = r.get('id') or r.get('resource_id')
        module_id = m.get('_id')
        if resource_id is None:
            continue
        score = target_scores[idx % len(target_scores)]
        idx += 1

        engagement_doc = {
            "student_id": main_student.get("_id"),
            "resource_id": str(resource_id),
            "module_id": module_id,
            "viewed": True,
            "view_duration_seconds": 600,
            "completion_percentage": int(min(100, max(0, score))),
            "test_score": float(score),
            "test_attempts": 1,
            "updated_at": datetime.utcnow() - timedelta(days=random.randint(0,7))
        }

        db.resource_engagement.update_one(
            {"student_id": main_student.get("_id"), "resource_id": str(resource_id), "module_id": module_id},
            {"$set": engagement_doc},
            upsert=True
        )
        updated += 1
        if updated >= 4:
            break

    print(f"Upserted {updated} engagements for main student {main_student.get('email')}")


def add_ai_questions_if_needed(classroom, desired_total=10):
    classroom_oid = classroom.get("_id")
    existing = list(db.activity_feed.find({"classroom_id": classroom_oid, "action_type": "ai_question_asked"}))
    need = desired_total - len(existing)
    if need <= 0:
        print(f"Activity has {len(existing)} ai questions; no extra insertion needed")
        return

    sample_questions = [
        "what does the video talk about virtualization",
        "ok what is the video about",
        "what is the lecture about",
        "What is the core idea?",
        "Can you summarize the module intro?",
        "how does virtualization compare to containers",
        "what are cloud service models",
        "give me an example of IaaS",
        "explain infrastructure as code",
        "why use containers for microservices",
    ]

    students = classroom.get('students', [])
    if not students:
        print("No students available to create ai questions")
        return

    inserted = 0
    for i in range(need):
        sid = random.choice(students)
        q = sample_questions[(len(existing) + i) % len(sample_questions)]
        # choose a random module/resource pair
        modules = list(db.learning_modules.find({"classroom_id": classroom_oid}))
        module = random.choice(modules) if modules else None
        module_id = str(module.get('_id')) if module else None
        resource_id = None
        if module and (module.get('resources') or []):
            res = random.choice(module.get('resources'))
            resource_id = res.get('id') or res.get('resource_id')

        ts = datetime.utcnow() - timedelta(days=random.randint(0,7), hours=random.randint(0,23))

        doc = {
            "classroom_id": classroom_oid,
            "student_id": sid,
            "action_type": "ai_question_asked",
            "module_id": module_id,
            "resource_id": resource_id,
            "details": {"question": q, "source": "youtube"},
            "timestamp": ts,
            "action_performed_by_id": sid,
        }

        # check duplicates
        existing_dup = db.activity_feed.find_one({
            "student_id": sid,
            "action_type": "ai_question_asked",
            "details.question": q,
            "timestamp": {"$gte": ts - timedelta(minutes=1), "$lte": ts + timedelta(minutes=1)}
        })
        if existing_dup:
            continue

        db.activity_feed.insert_one(doc)
        inserted += 1

    print(f"Inserted {inserted} ai question activities to reach {desired_total}")


def add_login_logs(classroom, per_student=2):
    students = classroom.get('students', [])
    inserted = 0
    for sid in students:
        for i in range(per_student):
            ts = datetime.utcnow() - timedelta(days=random.randint(0,7), hours=random.randint(0,23))
            doc = {"user_id": sid, "login_time": ts}
            # avoid duplicates
            exists = db.login_logs.find_one({"user_id": sid, "login_time": {"$gte": ts - timedelta(minutes=1), "$lte": ts + timedelta(minutes=1)}})
            if exists:
                continue
            db.login_logs.insert_one(doc)
            inserted += 1
    print(f"Inserted {inserted} login logs (approx {per_student} per student)")


if __name__ == '__main__':
    teacher, classroom = find_classroom()
    if not classroom:
        print('Classroom not found; abort')
        sys.exit(1)

    main_student = db.users.find_one({"email": MAIN_STUDENT_EMAIL})
    if not main_student:
        print('Main student not found; abort')
        sys.exit(1)

    set_main_student_scores(classroom, main_student)
    add_ai_questions_if_needed(classroom, desired_total=10)
    add_login_logs(classroom, per_student=1)

    print('Dashboard fill complete')
