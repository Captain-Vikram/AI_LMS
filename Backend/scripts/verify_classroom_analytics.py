"""
Verify classroom analytics via the backend API using teacher credentials.
Prints the JSON payload returned by `/api/analytics/classroom/{id}`.

Run: python Backend/scripts/verify_classroom_analytics.py
"""

import os
import sys
import json
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")
CLASSROOM_NAME = os.getenv("SEED_CLASSROOM_NAME", "Cloud Computing")
TEACHER_EMAIL = os.getenv("SEED_TEACHER_EMAIL", "aka.vigi@gmail.com")
TEACHER_PASSWORD = os.getenv("SEED_TEACHER_PASSWORD", "GoodGuy@09#")
API_BASE = os.getenv("API_BASE", "http://127.0.0.1:8000")


def find_classroom_id():
    client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    db = client.get_database("quasar")
    classroom = db.classrooms.find_one({"name": CLASSROOM_NAME})
    if not classroom:
        return None
    return str(classroom.get("_id"))


def login_and_get_token():
    url = f"{API_BASE}/api/auth/login"
    payload = json.dumps({"email": TEACHER_EMAIL, "password": TEACHER_PASSWORD}).encode("utf-8")
    req = Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        resp = urlopen(req, timeout=10)
        data = json.load(resp)
        token = data.get("token") or data.get("access_token")
        return token
    except HTTPError as e:
        print("Login failed:", e.read().decode())
        return None
    except Exception as e:
        print("Login error:", e)
        return None


def fetch_analytics(classroom_id, token):
    url = f"{API_BASE}/api/analytics/classroom/{classroom_id}"
    req = Request(url, headers={"Authorization": f"Bearer {token}"}, method="GET")
    try:
        resp = urlopen(req, timeout=15)
        data = json.load(resp)
        print(json.dumps(data, indent=2, default=str))
    except HTTPError as e:
        print("API error:", e.read().decode())
    except Exception as e:
        print("Error fetching analytics:", e)


if __name__ == "__main__":
    cid = find_classroom_id()
    if not cid:
        print("Classroom not found in DB")
        sys.exit(1)

    token = login_and_get_token()
    if not token:
        print("Unable to authenticate as teacher")
        sys.exit(1)

    print("Fetching analytics for classroom:", cid)
    fetch_analytics(cid, token)
