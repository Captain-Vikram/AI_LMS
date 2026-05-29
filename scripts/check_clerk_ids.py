#!/usr/bin/env python3
"""Check for Clerk IDs in the users collection and for a specific email.

Usage:
  python scripts/check_clerk_ids.py [email]

Reads MONGO_URI and optional MONGO_DB_NAME from environment/.env.
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
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if isinstance(v, dict):
            out[k] = to_jsonable(v)
        elif isinstance(v, list):
            out[k] = [to_jsonable(x) if isinstance(x, dict) else serialize(x) for x in v]
        else:
            out[k] = serialize(v)
    return out


def main():
    load_dotenv(override=True)
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    DB_NAME = os.getenv("MONGO_DB_NAME", os.getenv("MONGO_DB", "SkillMaster"))

    email = sys.argv[1] if len(sys.argv) > 1 else "huh@email.com"

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    # Check the specific email (case-sensitive and case-insensitive)
    user_exact = db.users.find_one({"email": email})
    user_ci = db.users.find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})

    # Find users that have a clerk_id field
    clerk_cursor = db.users.find({"clerk_id": {"$exists": True}})
    clerk_list = []
    for u in clerk_cursor:
        clerk_list.append({
            "id": str(u.get("_id")),
            "email": u.get("email"),
            "clerk_id": u.get("clerk_id"),
        })

    out = {
        "queried_email": email,
        "found_exact": bool(user_exact),
        "exact_user": to_jsonable(user_exact) if user_exact else None,
        "found_case_insensitive": bool(user_ci),
        "ci_user": to_jsonable(user_ci) if user_ci else None,
        "users_with_clerk_id_count": len(clerk_list),
        "users_with_clerk_id_sample": clerk_list[:50],
    }

    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
