import sys
import os
import asyncio
from pathlib import Path

# Add Backend package directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from fastapi import FastAPI
import pytest

from main import app
from database_async import connect_to_mongo, disconnect_from_mongo, get_db
from routes.auth_routes import get_current_user
from functions.background_warming import warm_user_cache

# Override get_current_user dependency for testing
async def override_get_current_user():
    return {
        "user_id": "69df50b11aeca3b24a42cf11", # aka.vigi@gmail.com
        "email": "aka.vigi@gmail.com",
        "role": "teacher"
    }

app.dependency_overrides[get_current_user] = override_get_current_user

def test_quiz_submit_404():
    """Verify that submit quiz with an invalid ID immediately raises 404"""
    print("\nRunning test_quiz_submit_404...")
    with TestClient(app) as client:
        # Submit payload
        payload = {
            "quiz_id": "nonexistent_quiz_id_12345",
            "user_answers": [0, 1, 2]
        }
        
        response = client.post("/api/quiz/submit", json=payload)
        
        # Should raise 404 Quiz Not Found (since quizzes collection is empty and cache missed)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.json()}")
        assert response.status_code == 404
        assert "Quiz not found" in response.json()["detail"]
        print("✓ test_quiz_submit_404 passed successfully!")

def test_teacher_setup_onboarding():
    """Verify that teacher onboarding setup completes successfully without writing to teacher_onboarding collection"""
    print("\nRunning test_teacher_setup_onboarding...")
    
    # Mock the LLM pathway generator to avoid external API calls
    import routes.onboarding_routes
    async def mock_generate_teacher_pathway(*args, **kwargs):
        return [{"stage_name": "Stage 1", "description": "Mocked", "stage_index": 1}]
    
    routes.onboarding_routes._generate_teacher_pathway = mock_generate_teacher_pathway

    with TestClient(app) as client:
        # Submit form data
        import time
        data = {
            "institution_name": "Test Institution",
            "classroom_name": "Verification Classroom",
            "subject": f"Algebra II {time.time()}",
            "grade_level": "Grade 10",
            "classroom_description": "A validation class",
            "teaching_goals": "Master algebraic equations",
            "preferred_pace": "balanced"
        }
        
        response = client.post("/api/onboarding/teacher/setup", data=data)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response keys: {list(response.json().keys()) if response.status_code == 200 else response.json()}")
        assert response.status_code == 200
        assert "classroom_id" in response.json()
        assert "ai_pathway" in response.json()
        print("✓ test_teacher_setup_onboarding passed successfully!")

def test_gamification_endpoints():
    """Verify that all active gamification endpoints (/xp, /award-xp, /badges, /achievements/recent) run successfully with the async database client"""
    print("\nRunning test_gamification_endpoints...")
    
    with TestClient(app) as client:
        # 1. Get user XP
        response = client.get("/api/gamification/xp")
        print(f"GET /xp Status: {response.status_code}")
        print(f"GET /xp Response: {response.json()}")
        assert response.status_code == 200
        assert "current" in response.json()
        assert "streak" in response.json()

        # 2. Award XP
        payload = {
            "activity_type": "complete_assessment",
            "bonus_multiplier": 1.5,
            "metadata": {"source": "test_verification"}
        }
        response = client.post("/api/gamification/award-xp", json=payload)
        print(f"POST /award-xp Status: {response.status_code}")
        print(f"POST /award-xp Response: {response.json()}")
        assert response.status_code == 200
        assert response.json()["xp_awarded"] == 150 # 100 * 1.5
        assert "new_xp" in response.json()

        # 3. Get badges
        response = client.get("/api/gamification/badges")
        print(f"GET /badges Status: {response.status_code}")
        print(f"GET /badges Response keys: {list(response.json().keys())}")
        assert response.status_code == 200
        assert "badges" in response.json()

        # 4. Get recent achievements
        response = client.get("/api/gamification/achievements/recent")
        print(f"GET /achievements/recent Status: {response.status_code}")
        print(f"GET /achievements/recent Response keys: {list(response.json().keys())}")
        assert response.status_code == 200
        assert "achievements" in response.json()

        print("✓ test_gamification_endpoints passed successfully!")

async def run_async_warming_test():
    """Verify that warm_user_cache runs without errors with the new skill_pathways cleanup"""
    print("\nRunning run_async_warming_test...")
    # Initialize connection
    await connect_to_mongo()
    try:
        # Run warm_user_cache for aka.vigi@gmail.com
        await warm_user_cache("69df50b11aeca3b24a42cf11", "teacher")
        print("✓ warm_user_cache executed without errors!")
    finally:
        await disconnect_from_mongo()

def main():
    print("="*60)
    print("🚀 TARGETED VERIFICATION FOR PHASE 2, 5 & 7 CLEANUPS 🚀")
    print("="*60)
    
    # 1. Test MCQ quiz submission 404 path
    try:
        test_quiz_submit_404()
    except AssertionError as e:
        print(f"❌ Quiz Submit Test Failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error during Quiz Submit Test: {e}")
        sys.exit(1)
        
    # 2. Test teacher onboarding setup endpoint
    try:
        test_teacher_setup_onboarding()
    except AssertionError as e:
        print(f"❌ Teacher Setup Onboarding Test Failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error during Teacher Setup Onboarding Test: {e}")
        sys.exit(1)

    # 3. Test migrated gamification endpoints (async)
    try:
        test_gamification_endpoints()
    except AssertionError as e:
        print(f"❌ Gamification Test Failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error during Gamification Test: {e}")
        sys.exit(1)
        
    # 4. Test cache warming async task
    try:
        asyncio.run(run_async_warming_test())
    except Exception as e:
        print(f"❌ Cache Warming Test Failed: {e}")
        sys.exit(1)
        
    print("\n" + "="*60)
    print("✅ ALL TARGETED TESTS PASSED!")
    print("="*60)

if __name__ == "__main__":
    main()
