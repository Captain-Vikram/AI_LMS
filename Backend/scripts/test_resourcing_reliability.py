import requests
import time
import json
import os
import sys
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

BASE_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

def print_step(msg):
    print(f"\n>>> {msg}")

def test_resourcing_reliability():
    print("Starting Resourcing Reliability Test...")
    
    # 1. Register a teacher
    print_step("Registering a new teacher...")
    timestamp = int(time.time())
    email = f"teacher_{timestamp}@example.com"
    reg_payload = {
        "first_name": "Test",
        "last_name": "Teacher",
        "email": email,
        "password": "Password123!",
        "role": "teacher"
    }
    resp = requests.post(f"{BASE_URL}/api/auth/register", json=reg_payload)
    if resp.status_code not in [200, 201]:
        print(f"Registration failed: {resp.text}")
        return
    
    user_data = resp.json()
    token = user_data["token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Registered teacher: {email}")

    # 2. Bootstrap a demo classroom
    print_step("Bootstrapping a demo classroom...")
    resp = requests.post(f"{BASE_URL}/api/classroom/bootstrap/demo", headers=headers)
    if resp.status_code not in [200, 201]:
        print(f"Bootstrap demo classroom failed: {resp.text}")
        return
    
    setup_data = resp.json()
    classroom_id = setup_data["classroom_id"]
    print(f"Demo classroom created: {classroom_id}")

    # 3. Trigger resource generation
    print_step("Triggering resource generation...")
    resp = requests.post(f"{BASE_URL}/api/classroom/{classroom_id}/resources/generate", headers=headers)
    if resp.status_code not in [200, 201]:
        print(f"Generate resources failed: {resp.text}")
        return
    
    gen_data = resp.json()
    job_id = gen_data.get("job_id")
    if not job_id:
        print(f"Failed to find job_id in response: {gen_data}")
        return
    
    print(f"Job started: {job_id}")

    # 4. Poll for "searching" status
    print_step("Polling for job status...")
    status = "pending"
    for _ in range(30):
        resp = requests.get(f"{BASE_URL}/api/classroom/jobs/{job_id}", headers=headers)
        job_data = resp.json()
        status = job_data.get("status")
        progress = job_data.get("progress")
        print(f"Job Status: {status} ({progress}%)")
        
        if status in ["searching", "filtering", "ready"]:
            break
        time.sleep(2)
    
    # 5. Stop the job
    print_step("Stopping the job...")
    resp = requests.post(f"{BASE_URL}/api/classroom/jobs/{job_id}/stop", headers=headers)
    print(f"Stop response: {resp.json()}")
    
    # Poll for failed/stopped status
    print_step("Verifying job stopped...")
    stopped = False
    for _ in range(10):
        resp = requests.get(f"{BASE_URL}/api/classroom/jobs/{job_id}", headers=headers)
        job_data = resp.json()
        status = job_data.get("status")
        print(f"Job Status: {status}")
        if status in ["failed", "stopping"]:
            stopped = True
            break
        time.sleep(1)
    
    # 6. Retry the job (should use checkpoints)
    print_step("Retrying the job (should use checkpoints)...")
    resp = requests.post(f"{BASE_URL}/api/classroom/jobs/{job_id}/retry", headers=headers)
    print(f"Retry response: {resp.json()}")

    # 7. Verify it restarted
    print_step("Verifying job resumed...")
    restarted = False
    for _ in range(10):
        resp = requests.get(f"{BASE_URL}/api/classroom/jobs/{job_id}", headers=headers)
        job_data = resp.json()
        status = job_data.get("status")
        progress = job_data.get("progress")
        checkpoints = job_data.get("checkpoints", {})
        print(f"Job Status: {status} ({progress}%) - Checkpoints: {list(checkpoints.keys())}")
        if status in ["pending", "planning", "searching", "filtering", "ready"]:
            restarted = True
            if status == "ready":
                break
        time.sleep(1)
    
    # 8. Test Force Regeneration
    print_step("Testing Force Regeneration...")
    resp = requests.post(f"{BASE_URL}/api/classroom/{classroom_id}/resources/generate?force=true", headers=headers)
    new_job_data = resp.json()
    new_job_id = new_job_data.get("job_id")
    print(f"Force regeneration started: {new_job_id}")
    
    # Verify checkpoints are empty for the new job
    resp = requests.get(f"{BASE_URL}/api/classroom/jobs/{new_job_id}", headers=headers)
    print(f"New Job Checkpoints: {resp.json().get('checkpoints')}")

    # 9. Final poll for completion
    print_step("Polling for final completion (limited time)...")
    for _ in range(60):
        resp = requests.get(f"{BASE_URL}/api/classroom/jobs/{new_job_id}", headers=headers)
        job_data = resp.json()
        status = job_data.get("status")
        progress = job_data.get("progress")
        if status == "ready":
            print(f"Job FINISHED successfully: {status} ({progress}%)")
            break
        elif status == "failed":
            print(f"Job FAILED: {job_data.get('error')}")
            break
        print(f"Job Status: {status} ({progress}%)")
        time.sleep(5)

if __name__ == "__main__":
    test_resourcing_reliability()
