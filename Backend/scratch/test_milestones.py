import requests
import time

BASE_URL = "http://127.0.0.1:8000"

# Register a test user
email = f"milestone_test_{int(time.time())}@example.com"
register_payload = {
    "first_name": "Milestone",
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

headers = {"Authorization": f"Bearer {token}"}

# 1. POST /milestones (Create)
create_payload = {
    "name": "Master Async Motor Operations",
    "description": "Learn to write non-blocking MongoDB routes using Motor",
    "progress": 25,
    "status": "active",
    "category": "database"
}
r_create = requests.post(f"{BASE_URL}/api/user/milestones", json=create_payload, headers=headers)
print(f"Create status: {r_create.status_code}")
create_json = r_create.json()
milestone_id = create_json.get("milestone", {}).get("id")
print(f"Created milestone ID: {milestone_id}")

# 2. GET /milestones (List)
r_list = requests.get(f"{BASE_URL}/api/user/milestones", headers=headers)
print(f"List status: {r_list.status_code}")
list_json = r_list.json()
print(f"Listed milestones count: {len(list_json.get('milestones', []))}")

# 3. PATCH /milestones/{id} (Update)
update_payload = {
    "progress": 100,
    "status": "completed"
}
r_patch = requests.patch(f"{BASE_URL}/api/user/milestones/{milestone_id}", json=update_payload, headers=headers)
print(f"Update status: {r_patch.status_code}")
patch_json = r_patch.json()
print(f"Updated milestone progress: {patch_json.get('milestone', {}).get('progress')}, status: {patch_json.get('milestone', {}).get('status')}")

# 4. DELETE /milestones/{id} (Delete)
r_delete = requests.delete(f"{BASE_URL}/api/user/milestones/{milestone_id}", headers=headers)
print(f"Delete status: {r_delete.status_code}")
delete_json = r_delete.json()
print(f"Deleted milestone response message: {delete_json.get('message')}")
