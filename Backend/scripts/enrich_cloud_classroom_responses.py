"""
Enrich Cloud Computing classroom student responses (resource_engagement + activity_feed)
Idempotent: uses upsert for engagements and avoids duplicate activity_feed entries.
Run: python Backend/scripts/enrich_cloud_classroom_responses.py
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
NUM_AI_QUESTIONS = int(os.getenv("SEED_AI_QUESTIONS", "5"))

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
db = client.get_database("quasar")

random.seed(42)


def now():
    return datetime.utcnow()


def pick_date_within_april_2026():
    # Produce timestamps in April 2026 as in sample
    start = datetime(2026, 4, 10, 8, 0)
    end = datetime(2026, 4, 23, 12, 0)
    delta = end - start
    secs = random.randint(0, int(delta.total_seconds()))
    return start + timedelta(seconds=secs)


def find_classroom():
    teacher = db.users.find_one({"email": TEACHER_EMAIL})
    classroom = None
    if teacher:
        classroom = db.classrooms.find_one({"name": CLASSROOM_NAME, "teacher_id": teacher.get("_id")})
    if not classroom:
        classroom = db.classrooms.find_one({"name": CLASSROOM_NAME})
    return teacher, classroom


def enrich_engagements(classroom, students):
    # Collect resources from learning modules and classroom.ai_resources
    classroom_oid = classroom.get("_id")

    # Map resource_id -> module_id via learning_modules
    module_docs = list(db.learning_modules.find({"classroom_id": classroom_oid}))
    resource_to_module = {}
    for m in module_docs:
        mid = m.get("_id")
        for r in m.get("resources", []) or []:
            rid = r.get("id") or r.get("resource_id")
            if rid:
                resource_to_module[str(rid)] = str(mid)

    # Also include ai_resources in classroom (may have resource_id values)
    ai_resources = classroom.get("ai_resources", []) or []
    resource_ids = []
    for r in ai_resources:
        rid = r.get("resource_id")
        if rid:
            resource_ids.append(str(rid))
            if str(rid) not in resource_to_module:
                # leave module unassigned if missing
                resource_to_module[str(rid)] = r.get("module_id") or None

    # If no resources found in modules, fallback to classroom.ai_resources
    if not resource_to_module and ai_resources:
        for r in ai_resources:
            rid = r.get("resource_id")
            if rid:
                resource_to_module[str(rid)] = r.get("module_id") or None

    # For each student, upsert engagement with realistic values
    for student_id in students:
        sid = student_id
        # For each resource, decide engagement
        for resource_id, module_id in list(resource_to_module.items()):
            # Randomize: some students view more resources than others
            view_prob = 0.25 + random.random() * 0.5  # 25% - 75%
            viewed = random.random() < view_prob
            # Test exists sometimes; if viewed then higher chance of attempting
            attempt_prob = 0.15 + (0.5 if viewed else 0.0)
            attempted = random.random() < attempt_prob
            test_attempts = random.randint(0, 3) if attempted else 0
            # Score distribution skewed low as sample shows low scores
            test_score = None
            if test_attempts > 0:
                # 60% chance of low score 0-50, 30% 50-80, 10% >=80
                r = random.random()
                if r < 0.6:
                    test_score = round(random.uniform(0, 50), 1)
                elif r < 0.9:
                    test_score = round(random.uniform(50, 79), 1)
                else:
                    test_score = round(random.uniform(80, 100), 1)

            # Completion percentage based on test_score or viewed
            if test_score is not None:
                completion = int(min(100, max(0, test_score)))
            elif viewed:
                completion = random.randint(10, 70)
            else:
                completion = 0

            view_duration = 0
            if viewed:
                # approximate: short doc 3-10m, video longer 5-30m
                view_duration = random.randint(60, 60 * 30)

            updated_at = pick_date_within_april_2026()

            filter_q = {
                "student_id": ObjectId(sid) if not isinstance(sid, ObjectId) else sid,
                "resource_id": resource_id,
                "module_id": ObjectId(module_id) if module_id and not isinstance(module_id, ObjectId) else module_id,
            }

            doc = {
                "student_id": ObjectId(sid) if not isinstance(sid, ObjectId) else sid,
                "resource_id": resource_id,
                "module_id": ObjectId(module_id) if module_id and not isinstance(module_id, ObjectId) else module_id,
                "viewed": bool(viewed),
                "view_duration_seconds": int(view_duration),
                "completion_percentage": int(completion),
                "test_score": float(test_score) if test_score is not None else None,
                "test_attempts": int(test_attempts),
                "rating": None,
                "helpful": None,
                "notes": "",
                "updated_at": updated_at,
            }

            # Upsert engagement
            try:
                db.resource_engagement.update_one(
                    filter_q,
                    {"$set": doc},
                    upsert=True
                )
            except Exception as e:
                print("Failed upsert engagement", e)

    print("Enriched resource_engagement for students")


def enrich_activity_feed(classroom, students):
    classroom_oid = classroom.get("_id")
    # Prepare some AI question texts
    sample_questions = [
        "what does the video talk about virtualization",
        "ok what is the video about",
        "what is the lecture about",
        "What is the core idea?",
        "Can you summarize the module intro?",
    ]

    # Choose students to ask questions (random subset)
    askers = random.sample(students, min(len(students), NUM_AI_QUESTIONS))

    inserted = 0
    for idx, sid in enumerate(askers):
        qtext = sample_questions[idx % len(sample_questions)]
        timestamp = pick_date_within_april_2026()

        # Target a random module/resource if available
        modules = list(db.learning_modules.find({"classroom_id": classroom.get("_id")}))
        target_module = random.choice(modules) if modules else None
        module_id = str(target_module.get("_id")) if target_module else None
        resource = None
        if target_module and target_module.get("resources"):
            resource = random.choice(target_module.get("resources"))
            resource_id = resource.get("id") or resource.get("resource_id") or None
        else:
            resource_id = None

        activity_doc = {
            "classroom_id": classroom_oid,
            "student_id": ObjectId(sid) if not isinstance(sid, ObjectId) else sid,
            "action_type": "ai_question_asked",
            "module_id": module_id,
            "resource_id": resource_id,
            "details": {"question": qtext, "source": "youtube"},
            "timestamp": timestamp,
            "action_performed_by_id": ObjectId(sid) if not isinstance(sid, ObjectId) else sid,
        }

        # Avoid inserting duplicates with same student+question+timestamp window
        # We consider duplicates if same student and similar question within 1 minute
        window_start = timestamp - timedelta(minutes=1)
        existing = db.activity_feed.find_one({
            "student_id": activity_doc["student_id"],
            "action_type": "ai_question_asked",
            "details.question": qtext,
            "timestamp": {"$gte": window_start, "$lte": timestamp + timedelta(minutes=1)}
        })
        if existing:
            continue

        try:
            db.activity_feed.insert_one(activity_doc)
            inserted += 1
        except Exception as e:
            print("Failed insert activity", e)

    print(f"Inserted {inserted} ai question activity entries")


if __name__ == "__main__":
    teacher, classroom = find_classroom()
    if not classroom:
        print("Classroom not found. Ensure classroom exists and MONGO_URI is correct.")
        sys.exit(1)

    students = classroom.get("students", []) or []
    if not students:
        print("No students found in the classroom. Nothing to enrich.")
        sys.exit(0)

    # Convert ObjectIds to strings for deterministic operations
    student_ids = [str(s) for s in students]

    enrich_engagements(classroom, student_ids)
    enrich_activity_feed(classroom, student_ids)

    print("Done enriching classroom student responses.")
