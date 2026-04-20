"""Studio orchestration endpoints to unify summary and quiz workflows."""
import traceback
from typing import Optional, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

# Reuse existing route handlers where possible
from routes.rag_route import get_or_create_summary
from routes.youtube_quiz_routes import generate_quiz, GenerateQuizRequest

router = APIRouter(
    prefix="/api/studio",
    tags=["studio"],
    responses={404: {"description": "Not found"}},
)


class StudioGenerateRequest(BaseModel):
    type: str = Field(..., description="Type of output: 'summary' or 'quiz'")
    notebook_id: Optional[str] = None
    source_ids: Optional[List[str]] = None

    # Resource / YouTube fields
    resource_id: Optional[str] = None
    resource_url: Optional[str] = None

    # Module/classroom/student (needed for quiz generation)
    module_id: Optional[str] = None
    classroom_id: Optional[str] = None
    student_id: Optional[str] = None

    force_refresh: Optional[bool] = False


class StudioSummaryRequest(BaseModel):
    resource_id: str = Field(..., description="Resource ID from database")
    resource_url: str = Field(..., description="YouTube resource URL")
    force_refresh: bool = False


class StudioQuizRequest(BaseModel):
    youtube_url: str = Field(..., description="YouTube video URL")
    resource_id: str = Field(..., description="Resource ID from database")
    module_id: str = Field(..., description="Module ID from database")
    classroom_id: str = Field(..., description="Classroom ID from database")
    student_id: str = Field(..., description="Student ID requesting this quiz")


@router.post("/generate")
async def studio_generate(request: StudioGenerateRequest):
    """Unified entrypoint for Studio actions (summary, quiz).

    - type=summary: forwards to the resource summary endpoint
    - type=quiz: forwards to the YouTube quiz generator
    """
    try:
        request_type = request.type.strip().lower()

        if request_type == "summary":
            if not request.resource_id or not request.resource_url:
                raise HTTPException(status_code=400, detail="resource_id and resource_url are required for summary generation")

            # Delegate to existing handler in rag_route to preserve caching/validation
            return await get_or_create_summary(
                resource_id=request.resource_id,
                resource_url=request.resource_url,
                force_refresh=bool(request.force_refresh),
            )

        if request_type == "quiz":
            # Require the canonical set of fields used by youtube_quiz_routes.generate
            missing = []
            for name in ("resource_url", "resource_id", "module_id", "classroom_id", "student_id"):
                if not getattr(request, name):
                    missing.append(name)

            if missing:
                raise HTTPException(status_code=400, detail=f"Missing required fields for quiz generation: {', '.join(missing)}")

            gen_req = GenerateQuizRequest(
                youtube_url=request.resource_url,
                resource_id=request.resource_id,
                module_id=request.module_id,
                classroom_id=request.classroom_id,
                student_id=request.student_id,
            )

            return await generate_quiz(gen_req)

        raise HTTPException(status_code=400, detail=f"Unsupported studio type: {request_type}")

    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error in /api/studio/generate: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/summary")
async def studio_summary(payload: StudioSummaryRequest):
    """Direct wrapper for resource summary generation (convenience)."""
    try:
        return await get_or_create_summary(
            resource_id=payload.resource_id,
            resource_url=payload.resource_url,
            force_refresh=bool(payload.force_refresh),
        )
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error in /api/studio/summary: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/quiz")
async def studio_quiz(payload: StudioQuizRequest):
    """Direct wrapper for YouTube quiz generation (convenience)."""
    try:
        gen_req = GenerateQuizRequest(
            youtube_url=payload.youtube_url,
            resource_id=payload.resource_id,
            module_id=payload.module_id,
            classroom_id=payload.classroom_id,
            student_id=payload.student_id,
        )

        return await generate_quiz(gen_req)
    except HTTPException:
        raise
    except Exception as exc:
        print(f"Error in /api/studio/quiz: {exc}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))
