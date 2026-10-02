"""
Test script to verify all Project Analyzer endpoints are working
Run this after integrating into your FastAPI project
"""

import requests
import json
import sys
from pathlib import Path
import io
import zipfile
from typing import Optional

# Configuration
BASE_URL = "http://localhost:8000"
TIMEOUT = 120

# Color codes for terminal output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
END = '\033[0m'

def print_header(text: str):
    """Print section header"""
    print(f"\n{BLUE}{'='*60}{END}")
    print(f"{BLUE}{text}{END}")
    print(f"{BLUE}{'='*60}{END}\n")

def print_success(text: str):
    """Print success message"""
    print(f"{GREEN}✅ {text}{END}")

def print_error(text: str):
    """Print error message"""
    print(f"{RED}❌ {text}{END}")

def print_warning(text: str):
    """Print warning message"""
    print(f"{YELLOW}⚠️  {text}{END}")

def print_info(text: str):
    """Print info message"""
    print(f"{BLUE}ℹ️  {text}{END}")

def check_server_running() -> bool:
    """Check if FastAPI server is running"""
    print_header("1. Checking Server Status")
    
    try:
        response = requests.get(f"{BASE_URL}/docs", timeout=5)
        print_success(f"Server is running at {BASE_URL}")
        return True
    except requests.exceptions.ConnectionError:
        print_error(f"Cannot connect to {BASE_URL}")
        print_info("Make sure FastAPI server is running:")
        print_info("  python -m uvicorn main:app --reload")
        return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_status_endpoint() -> bool:
    """Test GET /analyze/status endpoint"""
    print_header("2. Testing Status Endpoint")
    
    try:
        url = f"{BASE_URL}/analyze/status"
        print_info(f"GET {url}")
        
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        print_success("Status endpoint working")
        
        print(f"  Available: {data.get('available', False)}")
        
        gemini = data.get('gemini', {})
        print(f"  Gemini: {gemini.get('configured', False)} (Model: {gemini.get('model', 'N/A')})")
        
        lm_studio = data.get('lm_studio', {})
        print(f"  LM Studio: {lm_studio.get('connected', False)} (URL: {lm_studio.get('url', 'N/A')})")
        
        if not data.get('available'):
            print_warning("No AI provider available! Configure .env with:")
            print_info("  GEMINI_API_KEY=your_key OR LOCAL_LLM_URL=http://localhost:1234")
            return False
        
        return True
    except requests.exceptions.Timeout:
        print_error("Request timeout")
        return False
    except requests.exceptions.HTTPError as e:
        print_error(f"HTTP {response.status_code}: {response.text}")
        return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def create_test_zip() -> Optional[io.BytesIO]:
    """Create a test ZIP file with sample Python code"""
    print_header("3. Creating Test ZIP File")
    
    try:
        # Create in-memory ZIP
        zip_buffer = io.BytesIO()
        
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # Add test files
            test_files = {
                'main.py': '''def hello():
    """Say hello"""
    return "Hello, World!"

if __name__ == "__main__":
    print(hello())
''',
                'utils.py': '''def add(a, b):
    """Add two numbers"""
    return a + b

def subtract(a, b):
    """Subtract two numbers"""
    return a - b
''',
                'README.md': '''# Test Project

A simple test project with basic functions.

## Features
- Addition
- Subtraction
- Hello greeting

## Usage
```python
from utils import add
result = add(2, 3)
```
'''
            }
            
            for filename, content in test_files.items():
                zf.writestr(filename, content)
        
        zip_buffer.seek(0)
        print_success(f"Created test ZIP with {len(test_files)} files")
        return zip_buffer
    except Exception as e:
        print_error(f"Failed to create ZIP: {e}")
        return None

def test_zip_endpoint(zip_buffer: io.BytesIO) -> bool:
    """Test POST /analyze/zip endpoint"""
    print_header("4. Testing ZIP Analysis Endpoint")
    
    try:
        url = f"{BASE_URL}/analyze/zip"
        print_info(f"POST {url}")
        print_info("Uploading test ZIP file...")
        
        files = {
            'file': ('test_project.zip', zip_buffer, 'application/zip')
        }
        
        data = {
            'project_topic': 'Simple Python Utility Library',
            'problem_statement': 'Provide basic math operations',
            'custom_requirements': 'async/await,type hints,documentation'
        }
        
        response = requests.post(url, files=files, data=data, timeout=TIMEOUT)
        response.raise_for_status()
        
        result = response.json()
        
        print_success("ZIP analysis completed")
        
        # Print results
        if 'executive_summary' in result:
            summary = result['executive_summary']
            print(f"  Summary: {summary.get('description', 'N/A')[:100]}...")
        
        if 'final_verdict' in result:
            verdict = result['final_verdict']
            score = verdict.get('score', 'N/A')
            grade = verdict.get('grade', 'N/A')
            print(f"  Score: {score}/100")
            print(f"  Grade: {grade}")
        
        if 'file_statistics' in result:
            stats = result['file_statistics']
            print(f"  Files analyzed: {stats.get('total_files', 0)}")
            print(f"  Total size: {stats.get('total_size', 0)} bytes")
        
        return True
    except requests.exceptions.Timeout:
        print_error(f"Request timeout (>{TIMEOUT}s)")
        print_warning("Analysis might be taking longer. Try with smaller project.")
        return False
    except requests.exceptions.HTTPError as e:
        print_error(f"HTTP {response.status_code}")
        print_error(response.text[:200])
        return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_github_endpoint() -> bool:
    """Test POST /analyze/github endpoint with small repo"""
    print_header("5. Testing GitHub Analysis Endpoint")
    
    try:
        url = f"{BASE_URL}/analyze/github"
        print_info(f"POST {url}")
        print_info("Testing with small public repository...")
        
        # Use a small test repo
        test_repo = "https://github.com/aio-libs/aiohttp"
        
        data = {
            'repo_url': test_repo,
            'branch': 'master',
            'project_topic': 'Async HTTP Client Library',
        }
        
        response = requests.post(url, data=data, timeout=TIMEOUT)
        response.raise_for_status()
        
        result = response.json()
        
        if 'error' in result:
            print_warning(f"Analysis returned error: {result['error']}")
            return False
        
        print_success("GitHub analysis completed")
        
        if 'final_verdict' in result:
            verdict = result['final_verdict']
            score = verdict.get('score', 'N/A')
            grade = verdict.get('grade', 'N/A')
            print(f"  Score: {score}/100")
            print(f"  Grade: {grade}")
        
        return True
    except requests.exceptions.Timeout:
        print_warning(f"GitHub analysis timeout (>{TIMEOUT}s)")
        print_info("Large repositories may take longer to analyze.")
        return False
    except requests.exceptions.HTTPError:
        print_error(f"HTTP {response.status_code}: {response.text[:200]}")
        return False
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def test_response_format(zip_buffer: io.BytesIO) -> bool:
    """Test that response has all expected fields"""
    print_header("6. Testing Response Format")
    
    try:
        url = f"{BASE_URL}/analyze/zip"
        
        files = {'file': ('test.zip', zip_buffer, 'application/zip')}
        response = requests.post(url, files=files, timeout=TIMEOUT)
        response.raise_for_status()
        
        result = response.json()
        
        # Check required fields
        required_fields = [
            'executive_summary',
            'code_quality',
            'final_verdict',
            'file_statistics'
        ]
        
        missing = []
        for field in required_fields:
            if field not in result:
                missing.append(field)
            else:
                print_success(f"Field '{field}' present")
        
        if missing:
            print_warning(f"Missing fields: {', '.join(missing)}")
            return False
        
        # Check nested fields
        verdict = result.get('final_verdict', {})
        if 'score' not in verdict or 'grade' not in verdict:
            print_error("Missing score or grade in final_verdict")
            return False
        
        print_success("Response format is correct")
        return True
    except Exception as e:
        print_error(f"Error: {e}")
        return False

def main():
    """Run all tests"""
    print(f"\n{BLUE}{'='*60}{END}")
    print(f"{BLUE}Project Analyzer - Endpoint Test Suite{END}")
    print(f"{BLUE}{'='*60}{END}")
    
    results = []
    
    # Test 1: Server running
    if not check_server_running():
        print_error("Cannot proceed without server. Exiting.")
        sys.exit(1)
    results.append(("Server Running", True))
    
    # Test 2: Status endpoint
    status_ok = test_status_endpoint()
    results.append(("Status Endpoint", status_ok))
    
    if not status_ok:
        print_warning("Status endpoint failed. Some tests will be skipped.")
    
    # Test 3-6: Create ZIP and test endpoints
    zip_buffer = create_test_zip()
    if zip_buffer:
        results.append(("Test ZIP Creation", True))
        
        # Test 4: ZIP endpoint
        zip_ok = test_zip_endpoint(zip_buffer)
        results.append(("ZIP Analysis", zip_ok))
        
        # Test 6: Response format
        if zip_ok:
            zip_buffer.seek(0)
            format_ok = test_response_format(zip_buffer)
            results.append(("Response Format", format_ok))
    else:
        results.append(("Test ZIP Creation", False))
    
    # Test 5: GitHub endpoint (optional - may timeout)
    print_info("\nOptional: Testing GitHub endpoint (may take time)...")
    github_ok = test_github_endpoint()
    results.append(("GitHub Analysis", github_ok))
    
    # Summary
    print_header("Test Summary")
    
    passed = sum(1 for _, ok in results if ok)
    total = len(results)
    
    for test_name, passed_test in results:
        status = f"{GREEN}✅ PASS{END}" if passed_test else f"{RED}❌ FAIL{END}"
        print(f"{status} - {test_name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print_success("All tests passed! Your setup is ready.")
        return 0
    else:
        print_warning("Some tests failed. Check the errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
