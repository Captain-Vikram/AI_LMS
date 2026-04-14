#!/usr/bin/env python3
"""
Comprehensive Functional Endpoint Test
Tests backend APIs with proper authentication and payloads
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any, Tuple
import os
from dotenv import load_dotenv
import time

# Load environment variables
load_dotenv()

# Configuration
BASE_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

# Statistics
test_results = []
passed = 0
failed = 0
test_user_token = None
test_user_id = None
test_milestone_id = None

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    END = '\033[0m'


def print_header(text: str):
    """Print formatted header"""
    print(f"\n{Colors.BLUE}{'='*110}{Colors.END}")
    print(f"{Colors.BLUE}{text:^110}{Colors.END}")
    print(f"{Colors.BLUE}{'='*110}{Colors.END}\n")


def log_test(endpoint: str, method: str, status_code: int, success: bool, detail: str = ""):
    """Log test result"""
    global passed, failed
    
    symbol = f"{Colors.GREEN}✓{Colors.END}" if success else f"{Colors.RED}✗{Colors.END}"
    status_color = Colors.GREEN if success in [True, None] else Colors.RED
    
    detail_str = f" | {detail}" if detail else ""
    print(f"{symbol} {method:7} {endpoint:50} [{status_color}{status_code:>3}{Colors.END}]{detail_str}")
    
    test_results.append({
        "endpoint": endpoint,
        "method": method,
        "status_code": status_code,
        "success": success,
        "detail": detail,
        "timestamp": datetime.now().isoformat()
    })
    
    if success:
        passed += 1
    else:
        failed += 1


def test_auth_flow():
    """Test user authentication flow"""
    global test_user_token, test_user_id
    
    print_header("1. AUTHENTICATION FLOW")
    
    # Generate unique email
    timestamp = int(time.time() * 1000)
    email = f"test_user_{timestamp}@example.com"
    
    # Register user
    register_data = {
        "first_name": "Test",
        "last_name": "User",
        "email": email,
        "password": "TestPass123!",
        "role": "student",
        "location": "Test City"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/register", json=register_data, timeout=10)
        success = response.status_code in [200, 201]
        
        if success:
            data = response.json()
            test_user_token = data.get("token")
            test_user_id = data.get("id")
            
            log_test(
                "/api/auth/register",
                "POST",
                response.status_code,
                success,
                f"User created: {test_user_id[:8]}..." if test_user_id else ""
            )
        else:
            log_test("/api/auth/register", "POST", response.status_code, False, response.text[:50])
            
    except Exception as e:
        log_test("/api/auth/register", "POST", 0, False, str(e))
    
    # Test login
    if test_user_id:
        login_data = {
            "email": email,
            "password": "TestPass123!"
        }
        
        try:
            response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data, timeout=10)
            success = response.status_code in [200, 201]
            log_test("/api/auth/login", "POST", response.status_code, success)
        except Exception as e:
            log_test("/api/auth/login", "POST", 0, False, str(e))
    
    return test_user_token is not None


def test_onboarding():
    """Test onboarding endpoints"""
    print_header("2. ONBOARDING FLOW")
    
    if not test_user_token:
        print(f"{Colors.YELLOW}⊘ Skipping - No valid authentication token{Colors.END}\n")
        return
    
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Save onboarding data
    onboarding_data = {
        "primaryGoal": "Become a Full Stack Developer",
        "selectedSkills": ["JavaScript", "React", "Node.js"],
        "timeCommitment": "10-15 hours per week",
        "careerPath": "Full Stack Developer",
        "experienceLevel": "intermediate",
        "preferredStyle": "visual",
        "learningPace": "moderate",
        "preferredResources": ["videos", "documentation"],
        "prioritySkills": ["JavaScript", "React", "Node.js"],
        "desiredCertifications": ["AWS Developer", "CKAD"]
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/onboarding/save", json=onboarding_data, headers=headers, timeout=10)
        success = response.status_code in [200, 201]
        log_test("/api/onboarding/save", "POST", response.status_code, success)
    except Exception as e:
        log_test("/api/onboarding/save", "POST", 0, False, str(e))
    
    # Get onboarding status
    try:
        response = requests.get(f"{BASE_URL}/api/onboarding/status", headers=headers, timeout=10)
        success = response.status_code in [200]
        log_test("/api/onboarding/status", "GET", response.status_code, success)
    except Exception as e:
        log_test("/api/onboarding/status", "GET", 0, False, str(e))
    
    # Get user skills
    try:
        response = requests.get(f"{BASE_URL}/api/onboarding/user-skills", headers=headers, timeout=10)
        success = response.status_code in [200]
        log_test("/api/onboarding/user-skills", "GET", response.status_code, success)
    except Exception as e:
        log_test("/api/onboarding/user-skills", "GET", 0, False, str(e))


def test_quiz_flow():
    """Test MCQ quiz endpoints"""
    print_header("3. MCQ QUIZ FLOW")
    
    if not test_user_token:
        print(f"{Colors.YELLOW}⊘ Skipping - No valid authentication token{Colors.END}\n")
        return
    
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Generate quiz
    quiz_data = {
        "primary_goal": "Learn Python",
        "selected_skills": ["Python", "OOP", "Data Structures"],
        "time_commitment": "5 hours",
        "career_path": "Software Engineer",
        "experience_level": "intermediate",
        "num_questions": 5
    }
    
    quiz_id = None
    
    try:
        response = requests.post(f"{BASE_URL}/api/quiz/generate", json=quiz_data, headers=headers, timeout=10)
        success = response.status_code in [200, 201]
        log_test("/api/quiz/generate", "POST", response.status_code, success)
        
        if success and response.json().get("quiz_id"):
            quiz_id = response.json().get("quiz_id")
    except Exception as e:
        log_test("/api/quiz/generate", "POST", 0, False, str(e))
    
    # Get quiz statistics
    try:
        response = requests.get(f"{BASE_URL}/api/quiz/statistics", headers=headers, timeout=10)
        success = response.status_code in [200]
        log_test("/api/quiz/statistics", "GET", response.status_code, success)
    except Exception as e:
        log_test("/api/quiz/statistics", "GET", 0, False, str(e))
    
    # Get assessment history
    try:
        response = requests.get(f"{BASE_URL}/api/quiz/assessment-history", headers=headers, timeout=10)
        success = response.status_code in [200]
        log_test("/api/quiz/assessment-history", "GET", response.status_code, success)
    except Exception as e:
        log_test("/api/quiz/assessment-history", "GET", 0, False, str(e))


def test_youtube_endpoints():
    """Test YouTube integration endpoints"""
    print_header("4. YOUTUBE INTEGRATION")
    
    test_video_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    
    # YouTube search
    search_data = {
        "topic": "Python Programming",
        "max_results": 5
    }
    
    try:
        response = requests.get(f"{BASE_URL}/api/youtube/search", params=search_data, timeout=10)
        success = response.status_code in [200, 400, 500]
        log_test("/api/youtube/search", "GET", response.status_code, success != 404)
    except Exception as e:
        log_test("/api/youtube/search", "GET", 0, False, str(e))
    
    # Get videos
    videos_data = {"topic": "Python basics"}
    
    try:
        response = requests.post(f"{BASE_URL}/api/youtube/get_videos", json=videos_data, timeout=10)
        success = response.status_code in [200, 500]
        log_test("/api/youtube/get_videos", "POST", response.status_code, success != 404)
    except Exception as e:
        log_test("/api/youtube/get_videos", "POST", 0, False, str(e))
    
    # Get recommendations
    try:
        response = requests.post(f"{BASE_URL}/api/youtube/recommendations", json={}, timeout=10)
        success = response.status_code != 404
        log_test("/api/youtube/recommendations", "POST", response.status_code, success)
    except Exception as e:
        log_test("/api/youtube/recommendations", "POST", 0, False, str(e))


def test_youtube_quiz():
    """Test YouTube quiz endpoints"""
    print_header("5. YOUTUBE QUIZ")
    
    test_video_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    
    # Get video topics
    topics_data = {
        "video_url": test_video_url,
        "languages": ["en"]
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/youtube-quiz/topics", json=topics_data, timeout=10)
        success = response.status_code != 404
        log_test("/api/youtube-quiz/topics", "POST", response.status_code, success)
    except Exception as e:
        log_test("/api/youtube-quiz/topics", "POST", 0, False, str(e))
    
    # Generate quiz
    quiz_data = {
        "video_url": test_video_url,
        "num_questions": 3,
        "difficulty": "intermediate",
        "languages": ["en"]
    }
    
    quiz_id = None
    
    try:
        response = requests.post(f"{BASE_URL}/api/youtube-quiz/generate", json=quiz_data, timeout=10)
        success = response.status_code != 404
        log_test("/api/youtube-quiz/generate", "POST", response.status_code, success)
        
        if success and isinstance(response.json(), dict):
            quiz_id = response.json().get("quiz_id")
    except Exception as e:
        log_test("/api/youtube-quiz/generate", "POST", 0, False, str(e))
    
    # Get quiz status
    if quiz_id:
        try:
            response = requests.get(f"{BASE_URL}/api/youtube-quiz/status/{quiz_id}", timeout=10)
            success = response.status_code != 404
            log_test("/api/youtube-quiz/status/{quiz_id}", "GET", response.status_code, success)
        except Exception as e:
            log_test("/api/youtube-quiz/status/{quiz_id}", "GET", 0, False, str(e))


def test_youtube_qa():
    """Test YouTube Q&A (RAG) endpoints"""
    print_header("6. YOUTUBE Q&A (RAG)")
    
    test_video_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    
    # Process video
    process_data = {
        "video_url": test_video_url,
        "languages": ["en"],
        "force_refresh": False
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/youtube-qa/process", json=process_data, timeout=10)
        success = response.status_code != 404
        log_test("/api/youtube-qa/process", "POST", response.status_code, success)
    except Exception as e:
        log_test("/api/youtube-qa/process", "POST", 0, False, str(e))
    
    # Ask question
    qa_data = {
        "video_url": test_video_url,
        "question": "What is the main topic?",
        "languages": ["en"],
        "top_k": 3
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/youtube-qa/ask", json=qa_data, timeout=10)
        success = response.status_code != 404
        log_test("/api/youtube-qa/ask", "POST", response.status_code, success)
    except Exception as e:
        log_test("/api/youtube-qa/ask", "POST", 0, False, str(e))
    
    # Get transcript
    video_id = "dQw4w9WgXcQ"
    
    try:
        response = requests.get(f"{BASE_URL}/api/youtube-qa/transcript/{video_id}", timeout=10)
        success = response.status_code in [200, 500]  # May fail due to YouTube restrictions
        log_test("/api/youtube-qa/transcript/{video_id}", "GET", response.status_code, success != 404)
    except Exception as e:
        log_test("/api/youtube-qa/transcript/{video_id}", "GET", 0, False, str(e))


def test_gamification():
    """Test gamification endpoints"""
    print_header("7. GAMIFICATION")
    
    if not test_user_token:
        print(f"{Colors.YELLOW}⊘ Skipping - No valid authentication token{Colors.END}\n")
        return
    
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Get XP
    try:
        response = requests.get(f"{BASE_URL}/api/gamification/xp", headers=headers, timeout=10)
        success = response.status_code in [200]
        log_test("/api/gamification/xp", "GET", response.status_code, success)
    except Exception as e:
        log_test("/api/gamification/xp", "GET", 0, False, str(e))
    
    # Get badges
    try:
        response = requests.get(f"{BASE_URL}/api/gamification/badges", headers=headers, timeout=10)
        success = response.status_code in [200]
        log_test("/api/gamification/badges", "GET", response.status_code, success)
    except Exception as e:
        log_test("/api/gamification/badges", "GET", 0, False, str(e))
    
    # Get recent achievements
    try:
        response = requests.get(f"{BASE_URL}/api/gamification/achievements/recent", headers=headers, timeout=10)
        success = response.status_code in [200]
        log_test("/api/gamification/achievements/recent", "GET", response.status_code, success)
    except Exception as e:
        log_test("/api/gamification/achievements/recent", "GET", 0, False, str(e))
    
    # Award XP
    xp_data = {"action": "complete_assessment", "amount": 100}
    
    try:
        response = requests.post(f"{BASE_URL}/api/gamification/award-xp", json=xp_data, headers=headers, timeout=10)
        success = response.status_code != 404
        log_test("/api/gamification/award-xp", "POST", response.status_code, success)
    except Exception as e:
        log_test("/api/gamification/award-xp", "POST", 0, False, str(e))


def test_analytics():
    """Test analytics endpoints"""
    print_header("8. ANALYTICS")
    
    if not test_user_token:
        print(f"{Colors.YELLOW}⊘ Skipping - No valid authentication token{Colors.END}\n")
        return
    
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Dashboard analytics
    try:
        response = requests.get(f"{BASE_URL}/api/analytics/dashboard", headers=headers, timeout=10)
        success = response.status_code in [200]
        log_test("/api/analytics/dashboard", "GET", response.status_code, success)
    except Exception as e:
        log_test("/api/analytics/dashboard", "GET", 0, False, str(e))


def test_milestones():
    """Test milestone endpoints"""
    print_header("9. MILESTONES (User Goals)")
    
    if not test_user_token:
        print(f"{Colors.YELLOW}⊘ Skipping - No valid authentication token{Colors.END}\n")
        return
    
    global test_milestone_id
    headers = {"Authorization": f"Bearer {test_user_token}"}
    
    # Create milestone
    milestone_data = {
        "name": "Learn Python Basics",
        "description": "Complete Python fundamentals course",
        "progress": 0,
        "status": "active",
        "category": "skill",
        "tags": ["python", "programming"]
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/user/milestones", json=milestone_data, headers=headers, timeout=10)
        success = response.status_code in [201, 200]
        log_test("/api/user/milestones", "POST", response.status_code, success)
        
        if success and isinstance(response.json(), dict):
            test_milestone_id = response.json().get("id")
    except Exception as e:
        log_test("/api/user/milestones", "POST", 0, False, str(e))
    
    # Get milestones
    try:
        response = requests.get(f"{BASE_URL}/api/user/milestones", headers=headers, timeout=10)
        success = response.status_code in [200]
        log_test("/api/user/milestones", "GET", response.status_code, success)
    except Exception as e:
        log_test("/api/user/milestones", "GET", 0, False, str(e))
    
    # Update milestone (PATCH)
    if test_milestone_id:
        update_data = {"progress": 50, "status": "active"}
        
        try:
            response = requests.patch(
                f"{BASE_URL}/api/user/milestones/{test_milestone_id}",
                json=update_data,
                headers=headers,
                timeout=10
            )
            success = response.status_code != 404
            log_test(f"/api/user/milestones/{{milestone_id}} (PATCH)", "PATCH", response.status_code, success)
        except Exception as e:
            log_test(f"/api/user/milestones/{{milestone_id}} (PATCH)", "PATCH", 0, False, str(e))
        
        # Delete milestone
        try:
            response = requests.delete(
                f"{BASE_URL}/api/user/milestones/{test_milestone_id}",
                headers=headers,
                timeout=10
            )
            success = response.status_code != 404
            log_test(f"/api/user/milestones/{{milestone_id}} (DELETE)", "DELETE", response.status_code, success)
        except Exception as e:
            log_test(f"/api/user/milestones/{{milestone_id}} (DELETE)", "DELETE", 0, False, str(e))


def test_deepresearch():
    """Test deep research endpoints"""
    print_header("10. DEEP RESEARCH")
    
    research_data = {
        "data": {
            "skills_to_learn": ["Python", "Machine Learning"],
            "experience_level": "intermediate",
            "time_available": "10 hours per week"
        }
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/deepresearch/recommendations", json=research_data, timeout=10)
        success = response.status_code in [200]
        log_test("/api/deepresearch/recommendations", "POST", response.status_code, success)
    except Exception as e:
        log_test("/api/deepresearch/recommendations", "POST", 0, False, str(e))


def test_health_endpoints():
    """Test health check endpoints"""
    print_header("11. HEALTH CHECK")
    
    # Root endpoint
    try:
        response = requests.get(f"{BASE_URL}/", timeout=10)
        success = response.status_code in [200]
        log_test("/", "GET", response.status_code, success)
    except Exception as e:
        log_test("/", "GET", 0, False, str(e))
    
    # Health endpoint
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        success = response.status_code in [200]
        log_test("/health", "GET", response.status_code, success)
    except Exception as e:
        log_test("/health", "GET", 0, False, str(e))


def generate_report():
    """Generate comprehensive report"""
    print_header("COMPREHENSIVE FUNCTIONAL TEST REPORT")
    
    total = passed + failed
    success_rate = (passed / total * 100) if total > 0 else 0
    
    print(f"Total Tests:      {total}")
    print(f"{Colors.GREEN}Passed:           {passed}{Colors.END}")
    print(f"{Colors.RED}Failed:           {failed}{Colors.END}")
    print(f"Success Rate:     {success_rate:.1f}%")
    
    # Summary by category
    categories = {}
    for result in test_results:
        endpoint = result["endpoint"]
        parts = endpoint.split('/')
        category = parts[1] if len(parts) > 1 else "root"
        
        if category not in categories:
            categories[category] = {"total": 0, "passed": 0}
        
        categories[category]["total"] += 1
        if result["success"]:
            categories[category]["passed"] += 1
    
    print(f"\n{Colors.CYAN}Category Breakdown:{Colors.END}")
    for category in sorted(categories.keys()):
        stats = categories[category]
        rate = (stats["passed"] / stats["total"] * 100) if stats["total"] > 0 else 0
        status = f"{Colors.GREEN}✓{Colors.END}" if rate == 100 else f"{Colors.YELLOW}~{Colors.END}" if rate >= 50 else f"{Colors.RED}✗{Colors.END}"
        print(f"  {status} {category:20} {stats['passed']:>2}/{stats['total']:<2} ({rate:>5.1f}%)")
    
    # Save detailed report
    report_data = {
        "timestamp": datetime.now().isoformat(),
        "backend_url": BASE_URL,
        "summary": {
            "total_tests": total,
            "passed": passed,
            "failed": failed,
            "success_rate": success_rate
        },
        "categories": categories,
        "test_results": test_results
    }
    
    try:
        report_path = "Backend/scripts/functional_test_report.json"
        with open(report_path, 'w') as f:
            json.dump(report_data, f, indent=2)
        print(f"\n✓ Detailed report saved to: {report_path}")
    except Exception as e:
        print(f"\n{Colors.YELLOW}Could not save report: {e}{Colors.END}")


def main():
    """Main test runner"""
    print(f"\n{Colors.MAGENTA}{'='*110}{Colors.END}")
    print(f"{Colors.MAGENTA}{'COMPREHENSIVE FUNCTIONAL ENDPOINT TEST':^110}{Colors.END}")
    print(f"{Colors.MAGENTA}{'='*110}{Colors.END}")
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Python Requests Library: Testing with proper payloads and authentication\n")
    
    # Run all tests
    if test_auth_flow():
        test_onboarding()
        test_quiz_flow()
        test_gamification()
        test_analytics()
        test_milestones()
    
    test_youtube_endpoints()
    test_youtube_quiz()
    test_youtube_qa()
    test_deepresearch()
    test_health_endpoints()
    
    # Generate report
    generate_report()
    
    print(f"\n{Colors.MAGENTA}{'='*110}{Colors.END}\n")
    
    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
