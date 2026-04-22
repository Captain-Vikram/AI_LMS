"""
Add class-wide analytics: test scores in `resource_engagement` and more `activity_feed` entries.
Idempotent: only inserts missing test scores and additional AI questions up to a target.
Run: python Backend/scripts/enrich_cloud_classroom_analytics.py
"""

import os
import random
import sys
from datetime import datetime, timedelta

from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")
CLASSROOM_NAME = os.getenv("SEED_CLASSROOM_NAME", "Cloud Computing")
TEACHER_EMAIL = os.getenv("SEED_TEACHER_EMAIL", "aka.vigi@gmail.com")
TARGET_TOTAL_AI_QUESTIONS = int(os.getenv("TARGET_TOTAL_AI_QUESTIONS", "10"))

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client.get_database("quasar")

random.seed(123)


def now():
    return datetime.utcnow()


def find_classroom():
    teacher = db.users.find_one({"email": TEACHER_EMAIL})
    classroom = None
    if teacher:
        classroom = db.classrooms.find_one({"name": CLASSROOM_NAME, "teacher_id": teacher.get("_id")})
    if not classroom:
        classroom = db.classrooms.find_one({"name": CLASSROOM_NAME})
    return teacher, classroom


def pick_date_mid_april():
    start = datetime(2026, 4, 15, 8, 0)
    end = datetime(2026, 4, 23, 12, 0)
    secs = random.randint(0, int((end - start).total_seconds()))
    return start + timedelta(seconds=secs)


def collect_resources_by_module(classroom_oid):
    modules = list(db.learning_modules.find({"classroom_id": classroom_oid}, {"resources":1, "name":1}))
    module_resources = []
    for m in modules:
        res_list = m.get("resources") or []
        for r in res_list:
            rid = r.get("id") or r.get("resource_id")
            if rid:
                module_resources.append({
                    "resource_id": str(rid),
                    "module_id": str(m.get("_id")),
                    "module_name": m.get("name")
                })
    return module_resources


def add_test_scores(classroom, students):
    resources = collect_resources_by_module(classroom.get("_id"))
    if not resources:
        print("No module resources found; skipping test score enrichment.")
        return

    # Pick up to 4 distinct resources across modules to be "source tests"
    chosen = []
    seen_modules = set()
    for r in resources:
        if r["module_id"] in seen_modules:
            continue
        chosen.append(r)
        seen_modules.add(r["module_id"])
        if len(chosen) >= 4:
            break

    if not chosen:
        print("No suitable resources chosen for tests")
        return

    # For each student, for each chosen resource, insert/update engagement with test score
    total_inserted = 0
    for sid in students:
        sid_oid = ObjectId(sid)
        for r in chosen:
            filter_q = {
                "student_id": sid_oid,
                "resource_id": r["resource_id"],
                "module_id": ObjectId(r["module_id"])
            }
            existing = db.resource_engagement.find_one(filter_q)
            # Only set or update test_score if missing or zero
            if existing and existing.get("test_score") is not None:
                continue

            # Determine score distribution: majority low, some medium, a few high
            roll = random.random()
            if roll < 0.6:
                score = round(random.uniform(0, 49), 1)
            elif roll < 0.9:
                score = round(random.uniform(50, 79), 1)
            else:
                score = round(random.uniform(80, 100), 1)

            doc = {
                "student_id": sid_oid,
                "resource_id": r["resource_id"],
                "module_id": ObjectId(r["module_id"]),
                "viewed": True,
                "view_duration_seconds": random.randint(60, 3600),
                "completion_percentage": int(score),
                "test_score": float(score),
                "test_attempts": random.randint(1, 3),
                "updated_at": pick_date_mid_april(),
            }

            db.resource_engagement.update_one(filter_q, {"$set": doc}, upsert=True)
            total_inserted += 1

    print(f"Inserted/updated {total_inserted} test engagement records")


def add_ai_questions(classroom, students):
    current = db.activity_feed.count_documents({"classroom_id": classroom.get("_id"), "action_type": "ai_question_asked"})
    needed = max(0, TARGET_TOTAL_AI_QUESTIONS - current)
    if needed == 0:
        print("AI question activity already meets target")
        return

    sample_questions = [
        "what does the video talk about virtualization",
        "ok what is the video about",
        "what is the lecture about",
        "What is the core idea?",
        "Can you summarize the module intro?",
        "Explain virtualization vs containers",
        "How does IaaS differ from SaaS?",
        "What is a hypervisor?",
        "Why use containers in cloud?",
        "What are typical cloud services?",
    ]

    inserted = 0
    for i in range(needed):
        sid = ObjectId(random.choice(students))
        q = random.choice(sample_questions)
        ts = pick_date_mid_april()

        # choose random module/resource
        modules = list(db.learning_modules.find({"classroom_id": classroom.get("_id")}))
        target = random.choice(modules) if modules else None
        module_id = str(target.get("_id")) if target else None
        res = None
        if target and target.get("resources"):
            res = random.choice(target.get("resources"))
            resource_id = res.get("id") or res.get("resource_id")
        else:
            resource_id = None

        activity_doc = {
            "classroom_id": classroom.get("_id"),
            "student_id": sid,
            "action_type": "ai_question_asked",
            "module_id": module_id,
            "resource_id": resource_id,
            "details": {"question": q, "source": "youtube"},
            "timestamp": ts,
            "action_performed_by_id": sid,
        }

        db.activity_feed.insert_one(activity_doc)
        inserted += 1

    print(f"Inserted {inserted} additional AI question activities (target total {TARGET_TOTAL_AI_QUESTIONS})")


if __name__ == "__main__":
    teacher, classroom = find_classroom()
    if not classroom:
        print("Classroom not found; aborting")
        sys.exit(1)

    students = classroom.get("students", []) or []
    if not students:
        print("No students in classroom; aborting")
        sys.exit(0)

    student_ids = [str(s) for s in students]

    add_test_scores(classroom, student_ids)
    add_ai_questions(classroom, student_ids)

    print("Done enriching classroom analytics.")
