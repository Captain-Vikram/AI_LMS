"""
Quick Setup Script for Project Analyzer
Run this to verify your installation works correctly
"""

import os
import sys
from pathlib import Path

def check_imports():
    """Check if all required packages are installed"""
    print("📦 Checking imports...")
    required = {
        'fastapi': 'FastAPI',
        'pydantic': 'Pydantic',
        'requests': 'Requests',
        'dotenv': 'Python-dotenv',
        'git': 'GitPython'
    }
    
    missing = []
    for module, name in required.items():
        try:
            __import__(module)
            print(f"  ✅ {name}")
        except ImportError:
            print(f"  ❌ {name} - MISSING")
            missing.append(name)
    
    if missing:
        print(f"\n⚠️ Missing packages: {', '.join(missing)}")
        print("Install with: pip install fastapi pydantic requests python-dotenv GitPython")
        return False
    
    print("✅ All imports OK\n")
    return True


def check_env_file():
    """Check if .env file exists and is configured"""
    print("🔧 Checking configuration...")
    
    env_path = Path(".env")
    if not env_path.exists():
        print("  ⚠️ .env file not found")
        print("  Create from .env_template: cp .env_template .env")
        return False
    
    print("  ✅ .env file exists")
    
    # Check key variables
    from dotenv import load_dotenv
    load_dotenv()
    
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    lm_studio_url = os.getenv("LOCAL_LLM_URL", "http://localhost:1234")
    
    print(f"  - Gemini API Key: {'✅ Configured' if gemini_key else '❌ Not set'}")
    print(f"  - LM Studio URL: {lm_studio_url}")
    
    return True


def check_analyzer():
    """Test analyzer initialization"""
    print("\n🤖 Testing Analyzer...")
    
    try:
        from analyzer import ProjectAnalyzer
        analyzer = ProjectAnalyzer()
        
        status = analyzer.get_status()
        print(f"  - Available: {'✅ Yes' if status['available'] else '❌ No'}")
        print(f"  - Gemini: {'✅ Configured' if status['gemini']['configured'] else '⚠️ Not configured'}")
        print(f"  - LM Studio: {'✅ Connected' if status['lm_studio']['connected'] else '⚠️ Not connected'}")
        
        if not status['available']:
            print("\n⚠️ No AI provider available!")
            print("  Option 1: Set GEMINI_API_KEY in .env")
            print("  Option 2: Start LM Studio (lmstudio://)")
            return False
        
        print("✅ Analyzer OK\n")
        return True
    except Exception as e:
        print(f"  ❌ Error: {e}\n")
        return False


def test_file_reading():
    """Test file reading functionality"""
    print("📄 Testing file reading...")
    
    try:
        from router import read_project_files
        import asyncio
        
        # Create test file
        test_dir = Path("test_project")
        test_dir.mkdir(exist_ok=True)
        test_file = test_dir / "test.py"
        test_file.write_text("print('Hello')")
        
        # Try reading
        async def test():
            files = await read_project_files(test_dir)
            return len(files) > 0
        
        result = asyncio.run(test())
        
        # Cleanup
        test_file.unlink()
        test_dir.rmdir()
        
        if result:
            print("✅ File reading OK\n")
            return True
        else:
            print("❌ No files read\n")
            return False
    except Exception as e:
        print(f"❌ Error: {e}\n")
        return False


def test_fastapi_router():
    """Test FastAPI router"""
    print("🚀 Testing FastAPI router...")
    
    try:
        from fastapi import FastAPI
        from router import router, initialize_analysis
        
        app = FastAPI()
        app.include_router(router)
        
        # Check if routes are registered
        routes = [route.path for route in app.routes]
        expected = ["/analyze/status", "/analyze/zip", "/analyze/github"]
        
        found = [r for r in expected if r in routes]
        print(f"  - Routes registered: {len(found)}/{len(expected)}")
        
        for route in expected:
            if route in routes:
                print(f"    ✅ {route}")
            else:
                print(f"    ❌ {route}")
        
        if len(found) == len(expected):
            print("✅ FastAPI router OK\n")
            return True
        else:
            print("⚠️ Some routes missing\n")
            return False
    except Exception as e:
        print(f"❌ Error: {e}\n")
        return False


def main():
    """Run all checks"""
    print("\n" + "="*50)
    print("🎯 Project Analyzer - Setup Verification")
    print("="*50 + "\n")
    
    checks = [
        ("Dependencies", check_imports),
        ("Configuration", check_env_file),
        ("Analyzer", check_analyzer),
        ("File Reading", test_file_reading),
        ("FastAPI Router", test_fastapi_router),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"❌ {name}: {e}\n")
            results.append((name, False))
    
    # Summary
    print("="*50)
    print("📊 SUMMARY")
    print("="*50)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅" if result else "❌"
        print(f"{status} {name}")
    
    print(f"\nPassed: {passed}/{total}")
    
    if passed == total:
        print("\n🎉 Everything is ready! You can integrate this into your FastAPI app.")
        print("\nNext steps:")
        print("1. Copy all files to your project")
        print("2. Include router in your FastAPI app:")
        print("   from project_analyzer.router import router")
        print("   app.include_router(router)")
        print("3. Test with: python -m uvicorn main:app --reload")
        return 0
    else:
        print("\n⚠️ Some checks failed. Please fix the issues above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
