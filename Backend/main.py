import os
import sys
import uuid
from importlib import import_module
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import uvicorn
from routes.mcq_routes import router as mcq_router
from routes.auth_routes import router as auth_router
from routes.onboarding_routes import router as onboarding_router
from routes.youtube_education import router as youtube_router
from routes.youtube_quiz_routes import router as youtube_quiz_router
from routes.studio_routes import router as studio_router
from routes.gamification_routes import router as gamification_router
from routes.deepsearch import router as deepsearch_router
from routes.rag_route import router as rag_router
from routes.analytics_routes import router as analytics_router
from routes.user_routes import router as user_router
from routes.classroom_routes import router as classroom_router
from routes.enrollment_routes import router as enrollment_router
from routes.dashboard_routes import router as dashboard_router
from routes.announcements_routes import router as announcements_router
from routes.student_progress_routes import router as student_progress_router
from routes.module_assessment_routes import router as module_assessment_router
from routes.module_assessment_workflow_routes import router as module_assessment_workflow_router
from routes.skill_pathway_routes import router as skill_pathway_router
from functions.service_health import get_dependency_health_snapshot
from database_async import init_db, disconnect_from_mongo

# Add handoff_fastapi to import path so portable_rag_backend can be mounted directly.
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
HANDOFF_FASTAPI_CANDIDATES = [
    BACKEND_DIR / "handoff_fastapi",
    PROJECT_ROOT / "handoff_fastapi",
]
for handoff_fastapi_dir in HANDOFF_FASTAPI_CANDIDATES:
    if handoff_fastapi_dir.exists() and str(handoff_fastapi_dir) not in sys.path:
        sys.path.insert(0, str(handoff_fastapi_dir))
        break

include_portable_rag_backend = None
try:
    include_portable_rag_backend = getattr(
        import_module("portable_rag_backend.integration"),
        "include_portable_rag_backend",
    )
except ModuleNotFoundError:
    print("Info: portable_rag_backend not found. Skipping portable RAG mount.")

# Load environment variables from .env file
load_dotenv(override=True)

# Check LM Studio local endpoint configuration
if not os.getenv("LMSTUDIO_URL"):
    print("Info: LMSTUDIO_URL not set. Defaulting to http://127.0.0.1:1234 for local inference.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize async database connection on app startup and close on shutdown"""
    print("🚀 Initializing async database connection...")
    await init_db()
    print("✅ Database initialized and ready for async operations")
    yield
    print("🛑 Shutting down database connection...")
    await disconnect_from_mongo()
    print("✅ Database connection closed")

# Initialize FastAPI app
app = FastAPI(
    title="SkillMaster Assessment API",
    description="API for generating personalized skill assessments and quizzes using local LM Studio inference",
    version="1.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(mcq_router)
app.include_router(auth_router)
app.include_router(onboarding_router)
app.include_router(classroom_router)
app.include_router(enrollment_router)
app.include_router(dashboard_router)
app.include_router(announcements_router)
app.include_router(youtube_router)
app.include_router(youtube_quiz_router)
app.include_router(studio_router)
app.include_router(gamification_router)
app.include_router(deepsearch_router)
app.include_router(rag_router)
app.include_router(analytics_router)
app.include_router(user_router)
app.include_router(student_progress_router)
app.include_router(module_assessment_router)
app.include_router(module_assessment_workflow_router)
app.include_router(skill_pathway_router)

# Mount portable RAG backend endpoints under a dedicated API prefix.
portable_rag_backend = None
if include_portable_rag_backend is not None:
    portable_rag_backend = include_portable_rag_backend(app, prefix="/api/portable-rag")


def _classify_unhandled_exception(exc: Exception) -> tuple[int, dict[str, Any]]:
    message = str(exc)
    lowered = message.lower()

    if (
        "serverselectiontimeouterror" in lowered
        or "localhost:27017" in lowered
        or "mongodb" in lowered
        or "no connection could be made" in lowered
    ):
        return 503, {
            "code": "MONGODB_UNAVAILABLE",
            "dependency": "mongodb",
            "user_message": "Database unavailable. Ensure Docker/service is running and MONGO_URI is correct.",
        }

    if "lm studio request failed" in lowered or "127.0.0.1:1234" in lowered:
        return 503, {
            "code": "LMSTUDIO_UNAVAILABLE",
            "dependency": "lmstudio",
            "user_message": "Local AI service is unavailable. Chat fallback mode may be used.",
        }

    return 500, {
        "code": "UNEXPECTED_BACKEND_ERROR",
        "dependency": "backend",
        "user_message": "Unexpected backend error. Please retry in a moment.",
    }


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    incident_id = str(uuid.uuid4())
    print(f"[{incident_id}] Unhandled backend error on {request.url.path}: {exc}")

    status_code, detail_payload = _classify_unhandled_exception(exc)
    detail_payload["incident_id"] = incident_id
    detail_payload["dependency_status"] = get_dependency_health_snapshot()

    return JSONResponse(
        status_code=status_code,
        content={
            "detail": detail_payload
        },
    )

# Health check endpoint
@app.get("/health")
async def health_check():
    lmstudio_url = os.getenv("LMSTUDIO_URL", "http://127.0.0.1:1234")
    model_name = os.getenv("LMSTUDIO_MODEL") or "auto-detect"
    dependency_health = get_dependency_health_snapshot()

    return {
        "status": "healthy" if dependency_health["status"] == "healthy" else "degraded",
        "llm_provider": "lm_studio_local",
        "lmstudio_url": lmstudio_url,
        "lmstudio_model": model_name,
        "dependencies": dependency_health,
    }


@app.get("/health/dependencies")
async def dependency_health_check():
    return get_dependency_health_snapshot()


# Root endpoint
@app.get("/")
async def root():
    return {
        "message": "Welcome to the SkillMaster Assessment API",
        "docs": "/docs",
        "available_endpoints": [
            # Standard quiz endpoints
            "/api/quiz/generate",
            "/api/quiz/submit",
            "/api/quiz/sample/{skill_area}",
            "/api/quiz/statistics",
            "/api/quiz/debug",

            # Auth endpoints
            "/api/auth/register",
            "/api/auth/login",
            "/api/auth/user-profile",
            "/api/auth/user-status",

            # Onboarding endpoints
            "/api/onboarding/save",
            "/api/onboarding/status",
            "/api/onboarding/user-skills",

            # Existing YouTube education endpoints
            "/api/youtube/recommendations",
            "/api/youtube/get_videos",
            "/api/youtube/search",

            # New YouTube quiz endpoints
            "/api/youtube-quiz/generate",
            "/api/youtube-quiz/submit",
            "/api/youtube-quiz/status/{quiz_id}",

             # Gamification endpoints
            "/api/gamification/xp",
            "/api/gamification/award-xp",
            "/api/gamification/badges",
            "/api/gamification/achievements/recent",
            "/api/gamification/leaderboard",
            "/api/gamification/streaks",

            # Analytics endpoints
            "/api/analytics/dashboard",

            # Studio orchestration endpoints
            "/api/studio/generate",
            "/api/studio/summary",
            "/api/studio/quiz",

            # User milestones endpoints
            "/api/user/milestones",

            # Portable RAG endpoints
            "/api/portable-rag/health",
            "/api/portable-rag/vector-db/init",
            "/api/portable-rag/models",
            "/api/portable-rag/podcasts/generate",
            "/api/portable-rag/podcasts/jobs/{job_id}",

            "/health/dependencies",
        ]
    }


# Run the application
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)