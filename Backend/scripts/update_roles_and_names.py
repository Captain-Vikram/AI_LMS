"""
Normalize user roles/names and promote a target account to teacher+admin.
Run: python Backend/scripts/update_roles_and_names.py
"""

import os
import sys
from datetime import datetime
from typing import Dict, List

from pymongo import MongoClient


TARGET_EMAIL = "aka.vigi@gmail.com"
TARGET_FIRST_NAME = "Aka"
TARGET_LAST_NAME = "Vigi"

ROLE_ALIASES = {
    "educator": "teacher",
    "instructor": "teacher",
    "faculty": "teacher",
    "professional": "student",
    "manager": "student",
    "executive": "student",
    "other": "student",
}

VALID_ROLES = {"teacher", "student", "admin"}


def normalize_role(raw_role) -> str:
    role = str(raw_role or "").strip().lower()
    if role in VALID_ROLES:
        return role
    if role in ROLE_ALIASES:
        return ROLE_ALIASES[role]
    return "student"


def normalize_roles_list(raw_roles, primary_role: str) -> List[str]:
    values = []

    if isinstance(raw_roles, str):
        values = [raw_roles]
    elif isinstance(raw_roles, list):
        values = raw_roles

    normalized = []
    for role in values:
        mapped = normalize_role(role)
        if mapped not in normalized:
            normalized.append(mapped)

    if primary_role not in normalized:
        normalized.insert(0, primary_role)

    return normalized


def build_name(first_name: str, last_name: str, profile_name: str, email: str) -> str:
    full_name = f"{(first_name or '').strip()} {(last_name or '').strip()}".strip()
    if full_name:
        return full_name
    if (profile_name or "").strip():
        return profile_name.strip()
    if (email or "").strip() and "@" in email:
        return email.split("@")[0]
    return "Unknown"


def main() -> int:
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")
    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
    db = client.get_database("quasar")

    # Sanity check DB reachability
    db.command("ping")

    normalized_count = 0
    name_fixed_count = 0

    for user in db.users.find({}, {"role": 1, "roles": 1, "first_name": 1, "last_name": 1, "profile": 1, "email": 1}):
        updates: Dict[str, object] = {}

        current_role = user.get("role")
        normalized_role = normalize_role(current_role)
        if current_role != normalized_role:
            updates["role"] = normalized_role

        normalized_roles = normalize_roles_list(user.get("roles"), normalized_role)
        if user.get("roles") != normalized_roles:
            updates["roles"] = normalized_roles

        profile = user.get("profile") if isinstance(user.get("profile"), dict) else {}
        profile_name = (profile.get("name") or "").strip()

        first_name = str(user.get("first_name") or "").strip()
        last_name = str(user.get("last_name") or "").strip()

        if not first_name and profile_name:
            parts = profile_name.split()
            if parts:
                updates["first_name"] = parts[0]
                first_name = parts[0]
            if len(parts) > 1:
                updates["last_name"] = " ".join(parts[1:])
                last_name = " ".join(parts[1:])

        desired_name = build_name(first_name, last_name, profile_name, user.get("email"))
        if profile_name != desired_name:
            updates["profile.name"] = desired_name

        if updates:
            updates["updated_date"] = datetime.utcnow()
            db.users.update_one({"_id": user["_id"]}, {"$set": updates})
            if "role" in updates or "roles" in updates:
                normalized_count += 1
            if "profile.name" in updates or "first_name" in updates or "last_name" in updates:
                name_fixed_count += 1

    target = db.users.find_one({"email": TARGET_EMAIL})
    if not target:
        print(f"ERROR: target user not found: {TARGET_EMAIL}")
        return 1

    target_full_name = f"{TARGET_FIRST_NAME} {TARGET_LAST_NAME}".strip()
    target_updates = {
        "role": "teacher",
        "roles": ["teacher", "admin"],
        "first_name": TARGET_FIRST_NAME,
        "last_name": TARGET_LAST_NAME,
        "profile.name": target_full_name,
        "status": "active",
        "updated_date": datetime.utcnow(),
    }

    db.users.update_one({"_id": target["_id"]}, {"$set": target_updates})

    updated_target = db.users.find_one(
        {"_id": target["_id"]},
        {"email": 1, "role": 1, "roles": 1, "first_name": 1, "last_name": 1, "profile": 1, "classroom_memberships": 1},
    )

    print("DONE: role/name normalization complete")
    print("USERS_ROLE_NORMALIZED:", normalized_count)
    print("USERS_NAME_FIXED:", name_fixed_count)
    print("TARGET_EMAIL:", updated_target.get("email"))
    print("TARGET_ROLE:", updated_target.get("role"))
    print("TARGET_ROLES:", updated_target.get("roles"))
    print("TARGET_FIRST_NAME:", updated_target.get("first_name"))
    print("TARGET_LAST_NAME:", updated_target.get("last_name"))
    print("TARGET_PROFILE_NAME:", (updated_target.get("profile") or {}).get("name"))
    print("TARGET_CLASSROOM_MEMBERSHIPS_COUNT:", len(updated_target.get("classroom_memberships", [])))

    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print("ERROR:", repr(exc))
        sys.exit(1)
