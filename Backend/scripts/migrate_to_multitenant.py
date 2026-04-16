"""
Migration script to add classroom support to existing users.
Run once: python Backend/scripts/migrate_to_multitenant.py
"""
import os
import sys
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime

# Ensure Backend directory is on sys.path when running from repo root
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")


def migrate_users():
    client = MongoClient(MONGO_URI)
    db = client.get_database()

    users = db.users.find()
    migrated = 0

    for user in users:
        # Skip if already migrated
        if "role" in user:
            print(f"  Skipping {user.get('email')} (already migrated)")
            continue

        print(f"Migrating user: {user.get('email')}")

        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {
                "role": "student",
                "institution_id": None,
                "classroom_memberships": [],
                "created_date": user.get("created_date", datetime.utcnow()),
                "updated_date": datetime.utcnow()
            }}
        )

        personal_classroom = {
            "institution_id": None,
            "name": f"Personal Learning - {user.get('email')}",
            "subject": "Self-Guided",
            "grade_level": "Self-Paced",
            "description": "Personal adaptive learning journey",
            "teacher_id": user["_id"],
            "co_teachers": [],
            "students": [user["_id"]],
            "student_groups": [],
            "status": "active",
            "start_date": datetime.utcnow(),
            "end_date": None,
            "enrollment_code": "",
            "require_approval": False,
            "created_date": datetime.utcnow(),
            "updated_date": datetime.utcnow()
        }

        result = db.classrooms.insert_one(personal_classroom)

        db.users.update_one(
            {"_id": user["_id"]},
            {"$push": {"classroom_memberships": {
                "classroom_id": str(result.inserted_id),
                "role": "student",
                "joined_date": datetime.utcnow(),
                "is_active": True,
                "onboarding_complete": user.get("onboarding_complete", False),
                "assessment_complete": user.get("assessment_complete", False)
            }}}
        )

        migrated += 1

    print(f"\n✅ Migration complete: {migrated} users updated")


if __name__ == "__main__":
    try:
        migrate_users()
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        sys.exit(1)
