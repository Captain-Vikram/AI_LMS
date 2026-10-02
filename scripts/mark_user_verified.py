#!/usr/bin/env python3
"""Upsert a demo Clerk user and mark email as verified.

Run from repository root with the project's .env loaded or ensure MONGO_URI is set.
Example:
  python scripts/mark_user_verified.py

This will set `status: active` and `email_verified: True` for the dummy account.
"""

from dotenv import load_dotenv
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime
import os
import sys

load_dotenv(override=True)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB_NAME", "SkillMaster")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

EMAIL = "huh@email.com"

def upsert_user(email: str):
    existing = db.users.find_one({"email": email})
    if existing:
        update_fields = {
            "status": "active",
            "email_verified": True,
            "onboarding_complete": existing.get("onboarding_complete", False),
            "assessment_complete": existing.get("assessment_complete", False),
            "updated_date": datetime.utcnow(),
        }
        db.users.update_one({"_id": existing["_id"]}, {"$set": update_fields})
        print(f"Updated existing user: {existing['_id']}")
        return str(existing["_id"])
    else:
        new_user = {
            "email": email,
            "first_name": "Demo",
            "last_name": "Student",
            "role": "student",
            "registration_date": datetime.utcnow(),
            "last_login": None,
            "status": "active",
            "onboarding_complete": False,
            "assessment_complete": False,
            "email_verified": True,
            "created_date": datetime.utcnow(),
            "updated_date": datetime.utcnow(),
        }
        result = db.users.insert_one(new_user)
        print(f"Inserted new user: {result.inserted_id}")
        return str(result.inserted_id)

if __name__ == "__main__":
    try:
        uid = upsert_user(EMAIL)
        print("Done. User id:", uid)
    except Exception as e:
        print("Error:", e)
        sys.exit(1)
