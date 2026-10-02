import requests
import pymongo
from bson import ObjectId
import time
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

# Connect to database to write mock assessment
client = pymongo.MongoClient("mongodb://localhost:27017")
db = client["SkillMaster"]

# 1. Register a test user
email = f"youtube_test_{int(time.time())}@example.com"
register_payload = {
    "first_name": "Youtube",
    "last_name": "Tester",
    "email": email,
    "password": "Password123!",
    "role": "student",
    "location": "Test Location"
}

r_reg = requests.post(f"{BASE_URL}/api/auth/register", json=register_payload)
print(f"Register status: {r_reg.status_code}")
reg_json = r_reg.json()
token = reg_json.get("token") or reg_json.get("access_token")
user_id = reg_json.get("id") or reg_json.get("user_id")
print(f"User ID: {user_id}")

# 2. Insert mock assessment result in database
mock_assessment = {
    "user_id": ObjectId(user_id),
    "timestamp": datetime.utcnow() if 'datetime' in globals() else pymongo.datetime.datetime.utcnow(),
    "score": {"total": 8, "correct": 6},
    "assessed_level": "intermediate",
    "question_feedback": [],
    "skill_gaps": {"FastAPI basics": "Understand routers"},
    "recommendations": [{"topic": "FastAPI APIRouter", "reason": "Weak in routing"}]
}
res_id = db.skill_assessment_results.insert_one(mock_assessment).inserted_id
print(f"Inserted mock assessment ID: {res_id}")

headers = {"Authorization": f"Bearer {token}"}

# 3. POST /recommendations (First hit - Generate & cache)
# Note: we pass empty body so it retrieves the latest assessment from database
r_recs1 = requests.post(f"{BASE_URL}/api/youtube/recommendations", json=None, headers=headers)
print(f"Recommendations (First Hit) status: {r_recs1.status_code}")
recs1_json = r_recs1.json()
print(f"Generated recommendations: {recs1_json}")

# 4. POST /recommendations (Second hit - Cache hit)
r_recs2 = requests.post(f"{BASE_URL}/api/youtube/recommendations", json=None, headers=headers)
print(f"Recommendations (Second Hit - Cache) status: {r_recs2.status_code}")
recs2_json = r_recs2.json()
print(f"Returned playlists count: {len(recs2_json)}")

# 5. POST /get_videos
video_payload = {
    "score": {"total": 10, "correct": 8},
    "assessed_level": "beginner",
    "question_feedback": [],
    "skill_gaps": {"Python basics": "functions"},
    "recommendations": [{"topic": "Python functions", "reason": "Improve function structure"}]
}
r_videos = requests.post(f"{BASE_URL}/api/youtube/get_videos", json=video_payload, headers=headers)
print(f"Get videos status: {r_videos.status_code}")
print(f"Get videos response length: {len(r_videos.json())}")

# 6. GET /search
r_search = requests.get(f"{BASE_URL}/api/youtube/search?query=fastapi", headers=headers)
print(f"Search status: {r_search.status_code}")
print(f"Search links count: {len(r_search.json().get('links', []))}")

client.close()
