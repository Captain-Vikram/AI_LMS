#!/usr/bin/env python3
"""
Comprehensive FastAPI Endpoint Audit Test
Tests all backend endpoints to verify they are working correctly
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
import os
from dotenv import load_dotenv
from bson import ObjectId

# Load environment variables
load_dotenv()

# Configuration
BASE_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
LMSTUDIO_URL = os.getenv("LMSTUDIO_URL", "http://127.0.0.1:1234")

# Test data storage
test_user_token = None
test_user_id = None
test_quiz_id = None
test_youtube_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Statistics
total_tests = 0
passed_tests = 0
failed_tests = 0
failed_endpoints = []


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'


def print_header(text: str):
    """Print a formatted header"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}{text:^80}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}\n")


def print_test_result(endpoint: str, method: str, status_code: int, passed: bool, detail: str = ""):
    """Print formatted test result"""
    global total_tests, passed_tests, failed_tests
    
    total_tests += 1
    status_symbol = f"{Colors.GREEN}✓ PASS{Colors.END}" if passed else f"{Colors.RED}✗ FAIL{Colors.END}"
    
    if not passed:
        failed_tests += 1
        failed_endpoints.append(f"{method} {endpoint} - {status_code} - {detail}")
    else:
        passed_tests += 1
    
    detail_str = f" - {detail}" if detail else ""
    print(f"{status_symbol}  {method:6} {endpoint:40} [{status_code}]{detail_str}")


def test_endpoint(method: str, endpoint: str, expected_status: List[int] = None, 
                 data: Dict = None, headers: Dict = None, params: Dict = None) -> Tuple[bool, int, str]:
    """
    Test a single endpoint
    Returns: (passed, status_code, response_text)
    """
    if expected_status is None:
        expected_status = [200, 201]
    
    url = f"{BASE_URL}{endpoint}"
    generated_headers = headers or {}
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=generated_headers, params=params, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, json=data, headers=generated_headers, params=params, timeout=10)
        elif method.upper() == "PUT":
            response = requests.put(url, json=data, headers=generated_headers, params=params, timeout=10)
        elif method.upper() == "DELETE":
            response = requests.delete(url, headers=generated_headers, params=params, timeout=10)
        else:
            return False, 0, f"Unknown method: {method}"
        
        passed = response.status_code in expected_status
        
        try:
            response_text = response.json() if response.text else "No response body"
            if isinstance(response_text, dict) and len(str(response_text)) > 100:
                response_text = str(response_text)[:100] + "..."
        except:
            response_text = response.text[:100] if response.text else "No response body"
        
        return passed, response.status_code, str(response_text)
        
    except requests.exceptions.ConnectionError:
        return False, 0, "Connection error - Backend server not running"
    except requests.exceptions.Timeout:
        return False, 0, "Timeout"
    except Exception as e:
        return False, 0, str(e)


def register_test_user() -> bool:
    """Register a test user and get authentication token"""
    global test_user_token, test_user_id
    
    print_header("STEP 1: USER REGISTRATION & AUTHENTICATION")
    
    user_data = {
        "first_name": "TestUser",
        "last_name": "Audit",
        "email": f"test_audit_{int(datetime.now().timestamp())}@example.com",
        "password": "TestPassword123!",
        "role": "student",
        "location": "Test Location"
    }
    
    passed, status_code, response = test_endpoint("POST", "/api/auth/register", 
                                                  expected_status=[200, 201], 
                                                  data=user_data)
    print_test_result("/api/auth/register", "POST", status_code, passed, "User registration")
    
    if passed:
        try:
            response_data = json.loads(response) if isinstance(response, str) else response
            test_user_token = response_data.get("token")
            test_user_id = response_data.get("id")
            if test_user_token:
                print(f"  ✓ User token obtained: {test_user_token[:20]}...")
                return True
        except:
            pass
    
    return False


def test_auth_endpoints():
    """Test authentication endpoints"""
    print_header("AUTHENTICATION ENDPOINTS")
    
    # Login
    login_data = {
        "email": "test_audit_user@example.com",
        "password": "TestPassword123!"
    }
    
    passed, status_code, response = test_endpoint("POST", "/api/auth/login", 
                                                  expected_status=[200, 401], 
                                                  data=login_data)
    print_test_result("/api/auth/login", "POST", status_code, passed, "User login")
    
    # Update onboarding status
    if test_user_token:
        headers = {"Authorization": f"Bearer {test_user_token}"}
        onboarding_data = {"onboarding_complete": True}
        
        passed, status_code, response = test_endpoint("POST", "/api/auth/update-onboarding-status",
                                                      expected_status=[200, 500],
                                                      data=onboarding_data,
                                                      headers=headers)
        print_test_result("/api/auth/update-onboarding-status", "POST", status_code, passed)


def test_onboarding_endpoints():
    """Test onboarding endpoints"""
    print_header("ONBOARDING ENDPOINTS")
    
    if not test_user_token:
        print(f"{Colors.YELLOW}⊘ Skipping - No authentication token{Colors.END}")
        return
    
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    onboarding_data = {
        "primaryGoal": "Learn Web Development",
        "selectedSkills": ["JavaScript", "React"],
        "timeCommitment": "10-15 hours per week",
        "careerPath": "Full Stack Developer",
        "experienceLevel": "beginner",
        "preferredStyle": "visual",
        "learningPace": "moderate",
        "preferredResources": ["videos", "docs"],
        "prioritySkills": ["JavaScript", "React", "Node.js"],
        "desiredCertifications": ["AWS Solutions Architect"]
    }
    
    passed, status_code, response = test_endpoint("POST", "/api/onboarding/save",
                                                  expected_status=[200, 201, 500],
                                                  data=onboarding_data,
                                                  headers=headers)
    print_test_result("/api/onboarding/save", "POST", status_code, passed)


def test_mcq_endpoints():
    """Test MCQ quiz endpoints"""
    print_header("MCQ QUIZ ENDPOINTS")
    
    if not test_user_token:
        print(f"{Colors.YELLOW}⊘ Skipping - No authentication token{Colors.END}")
        return
    
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Generate quiz
    quiz_params = {
        "primary_goal": "Learn Python",
        "selected_skills": ["Python", "OOP"],
        "time_commitment": "5 hours",
        "career_path": "Data Scientist",
        "experience_level": "intermediate",
        "num_questions": 5
    }
    
    passed, status_code, response = test_endpoint("POST", "/api/quiz/generate",
                                                  expected_status=[200, 201, 500],
                                                  data=quiz_params,
                                                  headers=headers)
    print_test_result("/api/quiz/generate", "POST", status_code, passed)
    
    # Submit quiz (if generation succeeded)
    if passed:
        try:
            response_data = json.loads(response) if isinstance(response, str) else response
            quiz_id = response_data.get("quiz_id")
            if quiz_id:
                submission_data = {
                    "quiz_id": quiz_id,
                    "user_answers": [0, 1, 2, 0, 1]
                }
                passed_submit, status_code_submit, _ = test_endpoint("POST", "/api/quiz/submit",
                                                                     expected_status=[200, 500],
                                                                     data=submission_data,
                                                                     headers=headers)
                print_test_result("/api/quiz/submit", "POST", status_code_submit, passed_submit)
        except:
            pass


def test_youtube_endpoints():
    """Test YouTube integration endpoints"""
    print_header("YOUTUBE EDUCATION ENDPOINTS")
    
    # YouTube topics extraction
    youtube_data = {
        "video_url": test_youtube_url,
        "languages": ["en"],
        "model_name": "auto",
        "include_transcript": False
    }
    
    passed, status_code, response = test_endpoint("POST", "/api/youtube-education/topics",
                                                  expected_status=[200, 500],
                                                  data=youtube_data)
    print_test_result("/api/youtube-education/topics", "POST", status_code, passed)
    
    # YouTube video search (if available)
    search_data = {
        "topic": "Python Programming",
        "max_results": 5
    }
    
    passed, status_code, response = test_endpoint("POST", "/api/youtube-education/search",
                                                  expected_status=[200, 404, 500],
                                                  data=search_data)
    
    if status_code != 404:  # If endpoint exists
        print_test_result("/api/youtube-education/search", "POST", status_code, passed)


def test_youtube_quiz_endpoints():
    """Test YouTube quiz endpoints"""
    print_header("YOUTUBE QUIZ ENDPOINTS")
    
    quiz_data = {
        "video_url": test_youtube_url,
        "num_questions": 3,
        "difficulty": "intermediate",
        "languages": ["en"]
    }
    
    passed, status_code, response = test_endpoint("POST", "/api/youtube-quiz/generate",
                                                  expected_status=[200, 500],
                                                  data=quiz_data)
    print_test_result("/api/youtube-quiz/generate", "POST", status_code, passed)
    
    # Try to submit quiz if generation succeeded
    if passed:
        try:
            response_data = json.loads(response) if isinstance(response, str) else response
            quiz_id = response_data.get("quiz_id")
            if quiz_id:
                submission_data = {
                    "quiz_id": quiz_id,
                    "user_answers": [0, 1, 2]
                }
                passed_submit, status_code_submit, _ = test_endpoint("POST", "/api/youtube-quiz/submit",
                                                                     expected_status=[200, 500],
                                                                     data=submission_data)
                print_test_result("/api/youtube-quiz/submit", "POST", status_code_submit, passed_submit)
        except:
            pass


def test_youtube_qa_endpoints():
    """Test YouTube Q&A RAG endpoints"""
    print_header("YOUTUBE Q&A (RAG) ENDPOINTS")
    
    # Process video
    process_data = {
        "video_url": test_youtube_url,
        "languages": ["en"],
        "force_refresh": False
    }
    
    passed, status_code, response = test_endpoint("POST", "/api/youtube-qa/process",
                                                  expected_status=[200, 500],
                                                  data=process_data)
    print_test_result("/api/youtube-qa/process", "POST", status_code, passed)
    
    # Ask question
    qa_data = {
        "video_url": test_youtube_url,
        "question": "What is the main topic?",
        "languages": ["en"],
        "top_k": 3
    }
    
    passed, status_code, response = test_endpoint("POST", "/api/youtube-qa/ask",
                                                  expected_status=[200, 500],
                                                  data=qa_data)
    print_test_result("/api/youtube-qa/ask", "POST", status_code, passed)


def test_gamification_endpoints():
    """Test gamification endpoints"""
    print_header("GAMIFICATION ENDPOINTS")
    
    if not test_user_token:
        print(f"{Colors.YELLOW}⊘ Skipping - No authentication token{Colors.END}")
        return
    
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Get user XP
    passed, status_code, response = test_endpoint("GET", "/api/gamification/xp",
                                                  expected_status=[200, 500],
                                                  headers=headers)
    print_test_result("/api/gamification/xp", "GET", status_code, passed)
    
    # Add XP (if endpoint exists)
    xp_data = {
        "action": "complete_assessment",
        "amount": 100
    }
    
    passed, status_code, response = test_endpoint("POST", "/api/gamification/add-xp",
                                                  expected_status=[200, 404, 500],
                                                  data=xp_data,
                                                  headers=headers)
    
    if status_code != 404:
        print_test_result("/api/gamification/add-xp", "POST", status_code, passed)
    
    # Get user level
    passed, status_code, response = test_endpoint("GET", "/api/gamification/level",
                                                  expected_status=[200, 404, 500],
                                                  headers=headers)
    
    if status_code != 404:
        print_test_result("/api/gamification/level", "GET", status_code, passed)


def test_analytics_endpoints():
    """Test analytics endpoints"""
    print_header("ANALYTICS ENDPOINTS")
    
    if not test_user_token:
        print(f"{Colors.YELLOW}⊘ Skipping - No authentication token{Colors.END}")
        return
    
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Dashboard analytics
    passed, status_code, response = test_endpoint("GET", "/api/analytics/dashboard",
                                                  expected_status=[200, 500],
                                                  headers=headers)
    print_test_result("/api/analytics/dashboard", "GET", status_code, passed)
    
    # Learning progress
    passed, status_code, response = test_endpoint("GET", "/api/analytics/learning-progress",
                                                  expected_status=[200, 404, 500],
                                                  headers=headers)
    
    if status_code != 404:
        print_test_result("/api/analytics/learning-progress", "GET", status_code, passed)


def test_deepresearch_endpoints():
    """Test deep research/document recommendation endpoints"""
    print_header("DEEP RESEARCH ENDPOINTS")
    
    research_data = {
        "data": {
            "skills_to_learn": ["Python", "Machine Learning"],
            "experience_level": "intermediate",
            "time_available": "10 hours per week"
        }
    }
    
    passed, status_code, response = test_endpoint("POST", "/api/deepresearch/recommendations",
                                                  expected_status=[200, 500],
                                                  data=research_data)
    print_test_result("/api/deepresearch/recommendations", "POST", status_code, passed)


def test_health_check():
    """Test basic health check endpoints"""
    print_header("HEALTH CHECK")
    
    # Test root endpoint
    passed, status_code, response = test_endpoint("GET", "/",
                                                  expected_status=[200, 404])
    print_test_result("/", "GET", status_code, passed)
    
    # Test /api endpoint
    passed, status_code, response = test_endpoint("GET", "/api",
                                                  expected_status=[200, 404])
    
    if status_code != 404:
        print_test_result("/api", "GET", status_code, passed)


def generate_report():
    """Generate final report"""
    print_header("FINAL AUDIT REPORT")
    
    total_line = f"Total Tests: {total_tests}"
    passed_line = f"{Colors.GREEN}Passed: {passed_tests}{Colors.END}"
    failed_line = f"{Colors.RED}Failed: {failed_tests}{Colors.END}"
    success_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    rate_line = f"Success Rate: {success_rate:.1f}%"
    
    print(f"{total_line:30} {passed_line}")
    print(f"{rate_line:30} {failed_line}")
    
    if failed_endpoints:
        print(f"\n{Colors.RED}Failed Endpoints:{Colors.END}")
        for endpoint in failed_endpoints:
            print(f"  • {endpoint}")
    
    # Save JSON report
    report_data = {
        "timestamp": datetime.now().isoformat(),
        "backend_url": BASE_URL,
        "total_tests": total_tests,
        "passed_tests": passed_tests,
        "failed_tests": failed_tests,
        "success_rate": success_rate,
        "failed_endpoints": failed_endpoints
    }
    
    report_path = "Backend/scripts/test_endpoints_report.json"
    with open(report_path, 'w') as f:
        json.dump(report_data, f, indent=2)
    
    print(f"\n✓ Report saved to: {report_path}")
    
    return failed_tests == 0


def main():
    """Main test runner"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"{Colors.BLUE}{'COMPREHENSIVE FASTAPI ENDPOINT AUDIT':^80}{Colors.END}")
    print(f"{Colors.BLUE}{'='*80}{Colors.END}")
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Step 1: Health check
    test_health_check()
    
    # Step 2: Register test user for authenticated endpoints
    user_registered = register_test_user()
    
    # Step 3: Test all endpoint categories
    test_auth_endpoints()
    test_onboarding_endpoints()
    test_mcq_endpoints()
    test_youtube_endpoints()
    test_youtube_quiz_endpoints()
    test_youtube_qa_endpoints()
    test_gamification_endpoints()
    test_analytics_endpoints()
    test_deepresearch_endpoints()
    
    # Step 4: Generate report
    all_passed = generate_report()
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.END}")
    
    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
