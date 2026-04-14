import os
import uuid
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
from routes.gamification_routes import router as gamification_router  # Add this line
from routes.deepsearch import router as deepsearch_router
from routes.rag_route import router as rag_router
from routes.analytics_routes import router as analytics_router
from routes.user_routes import router as user_router
from functions.service_health import get_dependency_health_snapshot

# Load environment variables from .env file
load_dotenv(override=True)

# Check LM Studio local endpoint configuration
if not os.getenv("LMSTUDIO_URL"):
    print("Info: LMSTUDIO_URL not set. Defaulting to http://127.0.0.1:1234 for local inference.")

# Initialize FastAPI app
app = FastAPI(
    title="SkillMaster Assessment API",
    description="API for generating personalized skill assessments and quizzes using local LM Studio inference",
    version="1.1.0",
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
app.include_router(youtube_router)
app.include_router(youtube_quiz_router)
app.include_router(gamification_router)  # Add this line
app.include_router(deepsearch_router)
app.include_router(rag_router)
app.include_router(analytics_router)
app.include_router(user_router)


def _classify_unhandled_exception(exc: Exception):
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

            # User milestones endpoints
            "/api/user/milestones",
            "/health/dependencies",
        ]
    }


# Run the application
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)