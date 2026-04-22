"""
Seed script to create a "Cloud Computing" classroom with a teacher and ~60 students.
Idempotent: it will check for existing teacher/student/classroom and avoid duplicates.
Designed to run from the repository root (call with `python Backend/scripts/seed_cloud_classroom.py`).
"""

import os
import sys
import hashlib
import random
from datetime import datetime, timedelta
from time import sleep

from bson import ObjectId
from pymongo import MongoClient
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")
TARGET_CLASSROOM_NAME = os.getenv("SEED_CLASSROOM_NAME", "Cloud Computing")
TEACHER_EMAIL = os.getenv("SEED_TEACHER_EMAIL", "aka.vigi@gmail.com")
TEACHER_PASSWORD = os.getenv("SEED_TEACHER_PASSWORD", "GoodGuy@09#")
MAIN_STUDENT_EMAIL = os.getenv("SEED_MAIN_STUDENT_EMAIL", "huh@email.com")
MAIN_STUDENT_PASSWORD = os.getenv("SEED_MAIN_STUDENT_PASSWORD", "GoodGuy@09#")
TARGET_STUDENT_COUNT = int(os.getenv("SEED_TARGET_STUDENT_COUNT", "60"))

FIRST_NAMES = [
    "Alex","Sam","Jordan","Taylor","Morgan","Jamie","Casey","Riley","Avery","Quinn",
    "Chris","Pat","Lee","Robin","Kris","Devin","Cameron","Drew","Elliot","Skyler",
    "Priya","Aisha","Rohan","Sofia","Diego","Luna","Mateo","Noah","Olivia","Emma",
]
LAST_NAMES = [
    "Sharma","Patel","Singh","Kumar","Gupta","Garcia","Nguyen","Smith","Johnson","Brown",
    "Martinez","Davis","Miller","Wilson","Anderson","Thomas","Taylor","Moore","Martin","Lee",
]
CITIES = ["Bengaluru","Pune","Mumbai","Delhi","Hyderabad","Chennai","Kolkata","Jaipur","Noida","Gurgaon"]
SKILLS = ["AWS","GCP","Azure","Docker","Kubernetes","Linux","Python","Networking","Security","Terraform"]


def sha256_hash(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def now():
    return datetime.utcnow()


class Seeder:
    def __init__(self, uri: str):
        self.client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        self.db = self.client.get_database("quasar")

    def _find_user_by_email(self, email: str):
        return self.db.users.find_one({"email": email})

    def _ensure_user(self, email: str, password: str, first_name: str = None, last_name: str = None, role: str = "student", location: str = None):
        existing = self._find_user_by_email(email)
        if existing:
            print(f"Found existing user: {email} -> {existing.get('_id')}")
            return existing

        user_doc = {
            "email": email,
            "first_name": first_name or "",
            "last_name": last_name or "",
            "location": location or random.choice(CITIES),
            "role": role,
            "password_hash": sha256_hash(password),
            "registration_date": now(),
            "last_login": now() - timedelta(days=random.randint(0, 30)),
            "status": "active",
            "onboarding_complete": random.random() < 0.2,
            "assessment_complete": random.random() < 0.1,
            "created_date": now(),
            "updated_date": now(),
            "classroom_memberships": [],
        }

        result = self.db.users.insert_one(user_doc)
        user_id = result.inserted_id
        # Insert profile for richer UI
        profile = {
            "user_id": user_id,
            "first_name": user_doc["first_name"],
            "last_name": user_doc["last_name"],
            "location": user_doc["location"],
            "bio": f"Learner interested in {random.choice(SKILLS)} and cloud technologies.",
            "skills": random.sample(SKILLS, k=random.randint(1, 3)),
            "created_date": now(),
        }
        try:
            self.db.user_profiles.insert_one(profile)
        except Exception:
            pass

        print(f"Created user: {email} -> {user_id}")
        return self.db.users.find_one({"_id": user_id})

    def _ensure_classroom(self, name: str, teacher_id: ObjectId):
        # Try to find an existing classroom by name + teacher
        classroom = self.db.classrooms.find_one({"name": name, "teacher_id": teacher_id})
        if classroom:
            print(f"Found existing classroom '{name}' -> {classroom.get('_id')}")
            return classroom

        # Also try to find any classroom with same name
        classroom = self.db.classrooms.find_one({"name": name})
        if classroom:
            print(f"Found existing classroom with same name '{name}' -> {classroom.get('_id')} (will attach teacher)")
            # Attach teacher if missing
            self.db.classrooms.update_one({"_id": classroom.get("_id")}, {"$set": {"teacher_id": teacher_id}})
            return self.db.classrooms.find_one({"_id": classroom.get("_id")})

        classroom_doc = {
            "name": name,
            "subject": "Cloud Computing",
            "grade_level": "Higher Education",
            "teacher_id": teacher_id,
            "co_teachers": [],
            "students": [],
            "student_groups": [],
            "ai_resources": [],
            "status": "active",
            "enrollment_code": None,
            "subject_focus_areas": ["Cloud fundamentals", "Containers & Orchestration", "Infrastructure as Code"],
            "description": "Introductory Cloud Computing course covering AWS, GCP and Azure basics.",
            "created_date": now(),
            "updated_date": now(),
        }
        result = self.db.classrooms.insert_one(classroom_doc)
        cid = result.inserted_id
        print(f"Created classroom '{name}' -> {cid}")
        return self.db.classrooms.find_one({"_id": cid})

    def _enroll_student(self, student_oid: ObjectId, classroom_oid: ObjectId):
        # add to classroom.students
        self.db.classrooms.update_one({"_id": classroom_oid}, {"$addToSet": {"students": student_oid}})

        # add membership to user
        membership = {
            "classroom_id": classroom_oid,
            "role": "student",
            "joined_date": now(),
            "is_active": True,
            "onboarding_complete": random.random() < 0.2,
            "assessment_complete": random.random() < 0.1,
            "status": "active",
        }

        # Ensure classroom_memberships exists
        user = self.db.users.find_one({"_id": student_oid}, {"classroom_memberships": 1})
        memberships = user.get("classroom_memberships") if user else None
        if memberships is None or not isinstance(memberships, list):
            self.db.users.update_one({"_id": student_oid}, {"$set": {"classroom_memberships": []}})

        # Avoid duplicate membership
        exists = self.db.users.find_one({"_id": student_oid, "classroom_memberships.classroom_id": classroom_oid})
        if not exists:
            self.db.users.update_one({"_id": student_oid}, {"$push": {"classroom_memberships": membership}})

        # Add some login logs to simulate activity
        for _ in range(random.randint(1, 4)):
            ts = now() - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23), minutes=random.randint(0, 59))
            try:
                self.db.login_logs.insert_one({"user_id": student_oid, "login_time": ts})
            except Exception:
                pass

    def seed(self, target_students: int = TARGET_STUDENT_COUNT):
        # Ensure teacher exists
        teacher = self._ensure_user(TEACHER_EMAIL, TEACHER_PASSWORD, first_name="Vigi", last_name="Aka", role="teacher", location="Bengaluru")
        teacher_oid = teacher.get("_id")

        # Ensure classroom exists
        classroom = self._ensure_classroom(TARGET_CLASSROOM_NAME, teacher_oid)
        classroom_oid = classroom.get("_id")

        # Ensure main student exists
        main_student = self._ensure_user(MAIN_STUDENT_EMAIL, MAIN_STUDENT_PASSWORD, first_name="Huh", last_name="Main", role="student")
        main_student_oid = main_student.get("_id")

        # Enroll main student if not already
        current_students = list(self.db.classrooms.find_one({"_id": classroom_oid}).get("students", []))
        if main_student_oid not in current_students:
            self._enroll_student(main_student_oid, classroom_oid)

        # Build list of existing classroom students
        classroom_doc = self.db.classrooms.find_one({"_id": classroom_oid})
        existing_count = len(classroom_doc.get("students", []))
        to_add = max(0, target_students - existing_count)

        print(f"Classroom {TARGET_CLASSROOM_NAME} currently has {existing_count} students; adding {to_add} to reach {target_students}.")

        used_emails = set([u["email"] for u in self.db.users.find({}, {"email": 1})])

        created = 0
        attempts = 0
        while created < to_add and attempts < to_add * 5:
            attempts += 1
            fn = random.choice(FIRST_NAMES)
            ln = random.choice(LAST_NAMES)
            name_num = random.randint(1, 9999)
            email = f"{fn.lower()}.{ln.lower()}{name_num}@students.example.com"
            if email in used_emails:
                continue

            user = self._ensure_user(email, "GoodGuy@09#", first_name=fn, last_name=ln, role="student", location=random.choice(CITIES))
            uid = user.get("_id")
            self._enroll_student(uid, classroom_oid)
            used_emails.add(email)
            created += 1

        final_classroom = self.db.classrooms.find_one({"_id": classroom_oid})
        final_count = len(final_classroom.get("students", []))

        print("\nSeeding summary:")
        print(f"Teacher: {TEACHER_EMAIL} -> {teacher_oid}")
        print(f"Classroom: {TARGET_CLASSROOM_NAME} -> {classroom_oid}")
        print(f"Total students now in classroom: {final_count}")
        print(f"Main student: {MAIN_STUDENT_EMAIL} -> {main_student_oid}")

        # Print a sample of 8 students
        sample_students = list(self.db.users.find({"_id": {"$in": final_classroom.get("students", [])}}, {"email": 1, "first_name": 1, "last_name": 1}).limit(8))
        print('\nSample students:')
        for s in sample_students:
            print(f" - {s.get('first_name','')}", s.get('last_name',''), "<", s.get('email'), ">")

        return {
            "teacher_id": str(teacher_oid),
            "classroom_id": str(classroom_oid),
            "total_students": final_count,
        }


if __name__ == "__main__":
    try:
        seeder = Seeder(MONGO_URI)
        result = seeder.seed()
        print("\nDone.")
    except Exception as e:
        print("Failed to run seeder:", e)
        sys.exit(1)
