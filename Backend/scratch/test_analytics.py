import requests
import pymongo
from bson import ObjectId

# Initialize sync db connection to get a real classroom_id
client = pymongo.MongoClient("mongodb://localhost:27017")
db = client["SkillMaster"] # Both database.py and database_async.py use SkillMaster as the default database name

classroom = db.classrooms.find_one()
if classroom:
    classroom_id = str(classroom["_id"])
    print(f"Found active classroom ID: {classroom_id}")
else:
    # If no classroom, create a mock one
    classroom_id = str(db.classrooms.insert_one({"name": "Test Classroom", "students": []}).inserted_id)
    print(f"Created mock classroom ID: {classroom_id}")

# Let's run a quick register and login to get a token
BASE_URL = "http://127.0.0.1:8000"

import time
email = f"analytics_test_{int(time.time())}@example.com"
register_payload = {
    "first_name": "Test",
    "last_name": "Teacher",
    "email": email,
    "password": "Password123!",
    "role": "teacher",
    "location": "Test Location"
}

# Register user
r_reg = requests.post(f"{BASE_URL}/api/auth/register", json=register_payload)
print(f"Register status: {r_reg.status_code}")
reg_json = r_reg.json()
print("Registration response:", reg_json)
token = reg_json.get("token") or reg_json.get("access_token")

# Add the registered teacher to the classroom students/teachers role map or mock it
# For RBAC check, the teacher needs to be associated.
user_id = reg_json.get("user_id") or reg_json.get("id")
db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": "teacher"}})
db.classrooms.update_one({"_id": ObjectId(classroom_id)}, {"$set": {"teacher_id": ObjectId(user_id)}})
print(f"Authorized user {user_id} as teacher for classroom {classroom_id}")

headers = {"Authorization": f"Bearer {token}"}

# 1. Hit dashboard (async)
r_dash = requests.get(f"{BASE_URL}/api/analytics/dashboard", headers=headers)
print(f"Dashboard status: {r_dash.status_code}")
print(f"Dashboard response keys: {list(r_dash.json().keys()) if r_dash.status_code == 200 else r_dash.text}")

# 2. Hit classroom analytics (sync-backed, get_sync_db)
r_class = requests.get(f"{BASE_URL}/api/analytics/classroom/{classroom_id}", headers=headers)
print(f"Classroom analytics status: {r_class.status_code}")
print(f"Classroom response: {r_class.json()}")

client.close()
