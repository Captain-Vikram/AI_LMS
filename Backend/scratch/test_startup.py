import sys
import os
import asyncio
from pathlib import Path

# Add Backend package directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI
from main import app, lifespan

async def test_app_startup():
    print("============================================================")
    # Trigger the lifespan context manager
    async with lifespan(app):
        print("💡 APP RUNNING IN LIFESPAN CONTEXT")
        # Run a quick check that the router is loaded
        routes = [r.path for r in app.routes]
        print(f"Loaded routes count: {len(routes)}")
        assert any("/api/gamification/xp" in r for r in routes)
        print("✓ Gamification routes are present!")
    print("============================================================")

if __name__ == "__main__":
    asyncio.run(test_app_startup())
