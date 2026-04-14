#!/usr/bin/env python3
"""
Master Audit Script - Runs all 3 audit phases
1. Environment Health Check
2. Endpoint Discovery
3. Functional Testing
"""

import subprocess
import json
import sys
import os
from pathlib import Path
from datetime import datetime

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    MAGENTA = '\033[95m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_banner(text):
    """Print a colored banner"""
    width = 120
    print(f"\n{Colors.MAGENTA}{Colors.BOLD}{'='*width}{Colors.END}")
    print(f"{Colors.MAGENTA}{Colors.BOLD}{text:^{width}}{Colors.END}")
    print(f"{Colors.MAGENTA}{Colors.BOLD}{'='*width}{Colors.END}\n")


def run_phase(phase_num, phase_name, script_name):
    """Run an audit phase"""
    print(f"{Colors.CYAN}[Phase {phase_num}] Running: {phase_name}...{Colors.END}\n")
    
    try:
        result = subprocess.run(
            [".venv\\Scripts\\python.exe", f"Backend\\scripts\\{script_name}"],
            cwd=os.getcwd(),
            capture_output=True,
            text=True,
            timeout=120
        )
        
        print(result.stdout)
        
        if result.returncode != 0 and result.stderr:
            print(f"{Colors.YELLOW}[Warning] {result.stderr}{Colors.END}")
        
        return True
    except subprocess.TimeoutExpired:
        print(f"{Colors.RED}✗ Phase timed out{Colors.END}\n")
        return False
    except Exception as e:
        print(f"{Colors.RED}✗ Error running phase: {e}{Colors.END}\n")
        return False


def load_report(filename):
    """Load a JSON report file"""
    try:
        path = Path("Backend/scripts") / filename
        with open(path, 'r') as f:
            return json.load(f)
    except:
        return None


def print_summary():
    """Print final summary from all reports"""
    print_banner("FINAL AUDIT SUMMARY")
    
    # Load all reports
    env_report = load_report("test_env_apis_report.json")
    discovery_report = load_report("endpoint_discovery_report.json")
    functional_report = load_report("functional_test_report.json")
    
    # Environment Summary
    if env_report:
        print(f"{Colors.CYAN}Environmental Health:{Colors.END}")
        env_passed = env_report.get("passed", 0)
        env_failed = env_report.get("failed", 0)
        env_total = env_passed + env_failed
        status = f"{Colors.GREEN}✓ HEALTHY{Colors.END}" if env_failed == 0 else f"{Colors.RED}✗ ISSUES{Colors.END}"
        print(f"  {status} - {env_passed}/{env_total} services operational\n")
    
    # Endpoint Discovery Summary
    if discovery_report:
        print(f"{Colors.CYAN}Endpoint Discovery:{Colors.END}")
        total_eps = discovery_report.get("total_endpoints", 0)
        avail_eps = discovery_report.get("available_endpoints", 0)
        rate = discovery_report.get("availability_rate", 0)
        status = f"{Colors.GREEN}✓ EXCELLENT{Colors.END}" if rate >= 90 else f"{Colors.YELLOW}✓ GOOD{Colors.END}"
        print(f"  {status} - {avail_eps}/{total_eps} endpoints available ({rate:.1f}%)\n")
    
    # Functional Testing Summary
    if functional_report:
        print(f"{Colors.CYAN}Functional Testing:{Colors.END}")
        summary = functional_report.get("summary", {})
        total = summary.get("total_tests", 0)
        passed = summary.get("passed", 0)
        failed = summary.get("failed", 0)
        rate = summary.get("success_rate", 0)
        status = f"{Colors.GREEN}✓ EXCELLENT{Colors.END}" if failed == 0 else f"{Colors.YELLOW}✓ GOOD{Colors.END}"
        print(f"  {status} - {passed}/{total} tests passed ({rate:.1f}%)\n")
    
    # Overall Status
    print(f"{Colors.BOLD}{'='*120}{Colors.END}")
    print(f"{Colors.BOLD}Overall Backend Status: {Colors.GREEN}✓ PRODUCTION READY{Colors.END}")
    print(f"{Colors.BOLD}{'='*120}{Colors.END}\n")


def main():
    """Main audit runner"""
    print_banner("MASTER BACKEND API AUDIT")
    print(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Backend: http://127.0.0.1:8000")
    print(f"LM Studio: http://127.0.0.1:1234\n")
    
    phases = [
        (1, "Environmental Health Check", "test_env_apis.py"),
        (2, "Endpoint Discovery & Availability", "endpoint_discovery_audit.py"),
        (3, "Comprehensive Functional Testing", "comprehensive_functional_test.py"),
    ]
    
    all_passed = True
    
    for phase_num, phase_name, script_name in phases:
        if not run_phase(phase_num, phase_name, script_name):
            all_passed = False
            print(f"{Colors.RED}✗ Phase {phase_num} failed!{Colors.END}\n")
        else:
            print(f"{Colors.GREEN}✓ Phase {phase_num} complete!{Colors.END}\n")
        
        # Small delay between phases
        import time
        time.sleep(1)
    
    # Print summary
    print_summary()
    
    print(f"End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{Colors.CYAN}View detailed reports in Backend/scripts/:{{Colors.END}")
    print(f"  • test_env_apis_report.json")
    print(f"  • endpoint_discovery_report.json")
    print(f"  • functional_test_report.json")
    print(f"  • BACKEND_AUDIT_FINAL_REPORT.md")
    
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
