#!/usr/bin/env python3
"""
Advanced FastAPI Endpoint Audit with Auto-Discovery
Discovers and tests all registered endpoints dynamically
"""

import requests
import json
import sys
from datetime import datetime
from typing import Dict, List, Any, Tuple
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
BASE_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

# Statistics
total_tests = 0
passed_tests = 0
failed_tests = 0
failed_endpoints = {}
endpoint_results = {}


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    END = '\033[0m'


def print_header(text: str):
    """Print a formatted header"""
    print(f"\n{Colors.BLUE}{'='*100}{Colors.END}")
    print(f"{Colors.BLUE}{text:^100}{Colors.END}")
    print(f"{Colors.BLUE}{'='*100}{Colors.END}\n")


def test_endpoint(method: str, endpoint: str, expected_status: List[int] = None) -> Tuple[bool, int, str]:
    """Test a single endpoint"""
    if expected_status is None:
        expected_status = [200, 201, 404, 405]  # Accept many statuses to discover endpoints
    
    url = f"{BASE_URL}{endpoint}"
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, timeout=5)
        elif method.upper() == "POST":
            response = requests.post(url, json={}, timeout=5)
        else:
            return False, 0, "Unsupported method"
        
        return True, response.status_code, ""
        
    except requests.exceptions.ConnectionError:
        return False, 0, "Connection refused"
    except requests.exceptions.Timeout:
        return False, 0, "Timeout"
    except Exception as e:
        return False, 0, str(e)


def discover_endpoints_from_docs() -> List[Tuple[str, str]]:
    """Discover endpoints from OpenAPI docs"""
    endpoints = []
    
    try:
        docs_url = f"{BASE_URL}/openapi.json"
        response = requests.get(docs_url, timeout=5)
        response.raise_for_status()
        
        docs = response.json()
        paths = docs.get("paths", {})
        
        for path, methods in paths.items():
            for method in methods.keys():
                if method.lower() in ["get", "post", "put", "delete", "patch"]:
                    endpoints.append((method.upper(), path))
                    
        return endpoints
        
    except Exception as e:
        print(f"{Colors.YELLOW}Could not fetch OpenAPI docs: {e}{Colors.END}\n")
        return []


def test_all_endpoints(endpoints: List[Tuple[str, str]]):
    """Test all discovered endpoints"""
    global total_tests, passed_tests, failed_tests
    
    if not endpoints:
        print(f"{Colors.YELLOW}No endpoints discovered!{Colors.END}\n")
        return
    
    print(f"Testing {len(endpoints)} endpoints...\n")
    
    # Group by category
    categories = {}
    for method, path in endpoints:
        # Extract category from path
        parts = path.split('/')
        if len(parts) > 2:
            category = parts[2] if parts[2] else "root"
        else:
            category = "root"
        
        if category not in categories:
            categories[category] = []
        categories[category].append((method, path))
    
    # Test endpoints by category
    for category in sorted(categories.keys()):
        print(f"{Colors.CYAN}Category: {category}{Colors.END}")
        print("-" * 100)
        
        for method, endpoint in sorted(categories[category]):
            total_tests += 1
            passed, status_code, detail = test_endpoint(method, endpoint)
            
            # Determine if endpoint is available
            is_available = status_code not in [0]
            status_color = Colors.GREEN if is_available else Colors.RED
            
            status_str = f"{status_code}" if status_code else "FAIL"
            symbol = "✓" if is_available else "✗"
            
            print(f"{status_color}{symbol} {method:6} {endpoint:50} [{status_str:>4}]{Colors.END}")
            
            endpoint_results[f"{method} {endpoint}"] = {
                "status": status_code,
                "available": is_available
            }
            
            if is_available:
                passed_tests += 1
            else:
                failed_tests += 1
                if category not in failed_endpoints:
                    failed_endpoints[category] = []
                failed_endpoints[category].append(f"{method} {endpoint}")
        
        print()


def generate_report():
    """Generate final report"""
    print_header("ENDPOINT AUDIT REPORT")
    
    total_line = f"Total Endpoints: {total_tests}"
    passed_line = f"{Colors.GREEN}Available: {passed_tests}{Colors.END}"
    failed_line = f"{Colors.RED}Unavailable: {failed_tests}{Colors.END}"
    availability_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0
    rate_line = f"Availability: {availability_rate:.1f}%"
    
    print(f"{total_line:30} {passed_line}")
    print(f"{rate_line:30} {failed_line}")
    
    # Summary by category
    print(f"\n{Colors.CYAN}Endpoint Categories:{Colors.END}")
    
    categories = {}
    for endpoint_key, result in endpoint_results.items():
        parts = endpoint_key.split(' ')
        method = parts[0]
        path = ' '.join(parts[1:])
        path_parts = path.split('/')
        
        if len(path_parts) > 2:
            category = path_parts[2] if path_parts[2] else "root"
        else:
            category = "root"
        
        if category not in categories:
            categories[category] = {"total": 0, "available": 0}
        
        categories[category]["total"] += 1
        if result["available"]:
            categories[category]["available"] += 1
    
    for category in sorted(categories.keys()):
        stats = categories[category]
        availability = (stats["available"] / stats["total"] * 100) if stats["total"] > 0 else 0
        status = f"{Colors.GREEN}✓{Colors.END}" if availability == 100 else f"{Colors.YELLOW}~{Colors.END}"
        print(f"  {status} {category:20} {stats['available']:>3}/{stats['total']:<3} ({availability:>5.1f}%)")
    
    if failed_endpoints:
        print(f"\n{Colors.RED}Unavailable Endpoints by Category:{Colors.END}")
        for category in sorted(failed_endpoints.keys()):
            print(f"  {category}:")
            for endpoint in failed_endpoints[category]:
                print(f"    • {endpoint}")
    
    # Save JSON report
    report_data = {
        "timestamp": datetime.now().isoformat(),
        "backend_url": BASE_URL,
        "total_endpoints": total_tests,
        "available_endpoints": passed_tests,
        "unavailable_endpoints": failed_tests,
        "availability_rate": availability_rate,
        "endpoint_details": endpoint_results,
        "categories": categories
    }
    
    report_path = "Backend/scripts/endpoint_discovery_report.json"
    try:
        with open(report_path, 'w') as f:
            json.dump(report_data, f, indent=2)
        print(f"\n✓ Detailed report saved to: {report_path}")
    except Exception as e:
        print(f"\n{Colors.YELLOW}Could not save report: {e}{Colors.END}")


def main():
    """Main test runner"""
    print(f"\n{Colors.BLUE}{'='*100}{Colors.END}")
    print(f"{Colors.BLUE}{'FASTAPI ENDPOINT DISCOVERY & AUDIT':^100}{Colors.END}")
    print(f"{Colors.BLUE}{'='*100}{Colors.END}")
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Step 1: Discover endpoints
    print(f"{Colors.CYAN}[Phase 1] Discovering endpoints from OpenAPI spec...{Colors.END}")
    endpoints = discover_endpoints_from_docs()
    
    if not endpoints:
        print(f"{Colors.RED}✗ Could not discover endpoints. Is the backend running?{Colors.END}\n")
        sys.exit(1)
    
    print(f"{Colors.GREEN}✓ Discovered {len(endpoints)} endpoints{Colors.END}\n")
    
    # Step 2: Test all endpoints
    print(f"{Colors.CYAN}[Phase 2] Testing endpoint availability...{Colors.END}\n")
    test_all_endpoints(endpoints)
    
    # Step 3: Generate report
    generate_report()
    
    print(f"\n{Colors.BLUE}{'='*100}{Colors.END}\n")


if __name__ == "__main__":
    main()
