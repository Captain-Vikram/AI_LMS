#!/usr/bin/env python3
"""Dump the user document for an email and list student accounts.

Usage:
  python scripts/dump_user_and_students.py [email]

Reads MONGO_URI and (optional) MONGO_DB_NAME from environment/.env.
"""

import os
import sys
import json
from datetime import datetime
from bson import ObjectId
from dotenv import load_dotenv
from pymongo import MongoClient


def serialize(obj):
    if isinstance(obj, ObjectId):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


def to_jsonable(doc: dict):
    out = {}
    for k, v in (doc or {}).items():
        try:
            if isinstance(v, dict):
                out[k] = to_jsonable(v)
            elif isinstance(v, list):
                out[k] = [to_jsonable(x) if isinstance(x, dict) else serialize(x) for x in v]
            else:
                out[k] = serialize(v)
        except Exception:
            out[k] = str(v)
    return out


def normalize_role(r):
    if not r:
        return "student"
    rr = str(r).strip().lower()
    if rr in {"teacher", "student", "admin"}:
        return rr
    if rr in {"educator", "instructor", "faculty"}:
        return "teacher"
    return "student"


def main():
    load_dotenv(override=True)
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    DB_NAME = os.getenv("MONGO_DB_NAME", os.getenv("MONGO_DB", "SkillMaster"))

    email = sys.argv[1] if len(sys.argv) > 1 else "huh@email.com"

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    user = db.users.find_one({"email": email})

    # Gather login logs: latest login per user
    login_map = {}
    try:
        pipeline = [
            {"$sort": {"login_time": -1}},
            {"$group": {"_id": "$user_id", "last_login": {"$first": "$login_time"}}}
        ]
        for r in db.login_logs.aggregate(pipeline):
            uid = r.get("_id")
            login_map[str(uid)] = r.get("last_login")
    except Exception:
        # If collection missing or error, keep empty map
        login_map = {}

    # Iterate users and find students
    students = []
    roles_count = {}
    for u in db.users.find({}):
        norm = normalize_role(u.get("role"))
        roles_count[norm] = roles_count.get(norm, 0) + 1
        if norm == "student":
            uid = str(u.get("_id"))
            last_login = login_map.get(uid) or u.get("last_login")
            students.append({
                "id": uid,
                "email": u.get("email"),
                "first_name": u.get("first_name"),
                "last_name": u.get("last_name"),
                "role": u.get("role"),
                "normalized_role": norm,
                "email_verified": u.get("email_verified", False),
                "last_login": serialize(last_login),
                "onboarding_complete": u.get("onboarding_complete", False),
                "assessment_complete": u.get("assessment_complete", False),
                "created_date": serialize(u.get("created_date") or u.get("registration_date")),
            })

    # Sort students by last_login desc, then created_date
    def sort_key(s):
        # Ensure we always return a 2-tuple (last_login, created_date)
        last = s.get("last_login") or ""
        created = s.get("created_date") or ""
        return (last, created)

    students_sorted = sorted(students, key=sort_key, reverse=True)

    out = {
        "queried_email": email,
        "user_found": bool(user),
        "user": to_jsonable(user) if user else None,
        "student_count": len(students_sorted),
        "students_sample": students_sorted[:50],
        "roles_count": roles_count,
        "timestamp": datetime.utcnow().isoformat(),
    }

    print(json.dumps(out, indent=2, default=serialize))


if __name__ == "__main__":
    main()
