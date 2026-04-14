from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, HttpUrl
import os
from dotenv import load_dotenv
import uuid

from functions.rag_function import YouTubeLangChainRAG, extract_video_id, get_transcript
from functions.service_health import get_dependency_health_snapshot

# Ensure environment variables are loaded
load_dotenv(override=True)

router = APIRouter(
    prefix="/api/youtube-qa",
    tags=["youtube-qa"],
    responses={404: {"description": "Not found"}},
)

# Cache for storing RAG system (in a production app, use a proper cache like Redis)
rag_cache = {}


class YouTubeQARequest(BaseModel):
    """Request model for asking a question about a YouTube video"""
    video_url: HttpUrl
    question: str
    languages: List[str] = ["en"]
    top_k: int = 3


class YouTubeProcessRequest(BaseModel):
    """Request model for processing a YouTube video"""
    video_url: HttpUrl
    languages: List[str] = ["en"]
    force_refresh: bool = False


def get_rag_system():
    """Dependency to get the RAG system"""
    api_token = os.getenv("LMSTUDIO_API_TOKEN") or os.getenv("LMSTUDIO_API_KEY")

    # Check if RAG system already exists in cache
    if "rag_system" not in rag_cache:
        model_name = os.getenv("LMSTUDIO_MODEL")
        rag_cache["rag_system"] = YouTubeLangChainRAG(api_token, model_name)

    return rag_cache["rag_system"]


def _build_error_detail(
        code: str,
        user_message: str,
        dependency: Optional[str] = None,
        technical_message: Optional[str] = None,
        include_dependency_snapshot: bool = False,
) -> Dict[str, Any]:
    detail = {
        "code": code,
        "message": user_message,
        "user_message": user_message,
        "dependency": dependency,
    }

    if technical_message:
        detail["technical_message"] = technical_message

    if include_dependency_snapshot:
        detail["dependency_status"] = get_dependency_health_snapshot()

    return detail


def _classify_exception(exc: Exception, operation: str) -> HTTPException:
    message = str(exc)
    lowered = message.lower()

    if isinstance(exc, HTTPException):
        return exc

    if "invalid youtube url" in lowered:
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_build_error_detail(
                code="INVALID_YOUTUBE_URL",
                user_message="Invalid YouTube URL. Please use a standard YouTube link.",
                dependency="youtube",
                technical_message=message,
            ),
        )

    if "no transcripts available" in lowered:
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_build_error_detail(
                code="TRANSCRIPT_NOT_AVAILABLE",
                user_message="No transcript is available for this video, so chat cannot answer from video content.",
                dependency="youtube-transcript",
                technical_message=message,
            ),
        )

    if "error retrieving transcript" in lowered or "transcript" in lowered:
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_build_error_detail(
                code="TRANSCRIPT_SERVICE_UNAVAILABLE",
                user_message="Transcript service is currently unavailable. Please try again shortly.",
                dependency="youtube-transcript",
                technical_message=message,
                include_dependency_snapshot=True,
            ),
        )

    if "lm studio request failed" in lowered or "127.0.0.1:1234" in lowered or "connection refused" in lowered:
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_build_error_detail(
                code="LMSTUDIO_UNAVAILABLE",
                user_message="Local AI is unavailable and fallback AI could not complete the request. Retry shortly.",
                dependency="llm",
                technical_message=message,
                include_dependency_snapshot=True,
            ),
        )

    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=_build_error_detail(
            code="YOUTUBE_QA_BACKEND_ERROR",
            user_message=f"Failed to {operation}. Please retry.",
            dependency="backend",
            technical_message=message,
            include_dependency_snapshot=True,
        ),
    )


@router.post("/process", response_model=Dict[str, Any])
async def process_youtube_video(
        params: YouTubeProcessRequest,
        rag_system=Depends(get_rag_system)
):
    """
    Process a YouTube video transcript and create a vector store for RAG
    """
    try:
        # Extract video_id first as a quick validation
        video_id = extract_video_id(str(params.video_url))
        if not video_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid YouTube URL"
            )

        # Process video
        video_data = rag_system.process_video(
            video_url=str(params.video_url),
            languages=params.languages,
            force_refresh=params.force_refresh
        )

        # Return success response
        return {
            "success": True,
            "video_id": video_id,
            "video_url": str(params.video_url),
            "documents_count": len(video_data["documents"]),
            "transcript_length": len(video_data["transcriptions"]),
            "message": "Video processed successfully and ready for questions"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise _classify_exception(e, "process video")


@router.post("/ask", response_model=Dict[str, Any])
async def ask_question(
        params: YouTubeQARequest,
        rag_system=Depends(get_rag_system)
):
    """
    Ask a question about a YouTube video using LangChain RAG
    """
    try:
        # Extract video_id first as a quick validation
        video_id = extract_video_id(str(params.video_url))
        if not video_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid YouTube URL"
            )

        # Validate question
        if not params.question or len(params.question.strip()) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please provide a valid question"
            )

        # Answer question
        result = rag_system.answer_question(
            video_url=str(params.video_url),
            question=params.question,
            languages=params.languages,
            top_k=params.top_k
        )

        # Return answer with metadata
        response_payload = {
            "success": True,
            "video_id": video_id,
            "video_url": str(params.video_url),
            "question": params.question,
            "answer": result.get("answer", ""),
            "sources": result.get("sources", []),
            "fallback": result.get("fallback", False),
            "fallback_reason": result.get("fallback_reason"),
        }

        if response_payload["fallback"]:
            response_payload["fallback_message"] = (
                "AI model is temporarily unavailable. Showing transcript-only fallback guidance."
            )
            response_payload["dependency_status"] = get_dependency_health_snapshot()

        return response_payload

    except HTTPException:
        raise
    except Exception as e:
        raise _classify_exception(e, "answer question")


@router.get("/transcript/{video_id}", response_model=Dict[str, Any])
async def get_video_transcript(
        video_id: str,
        languages: List[str] = ["en"]
):
    """
    Get the transcript for a YouTube video
    """
    try:
        # Validate video ID
        if not video_id or len(video_id) != 11:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid YouTube video ID"
            )

        # Get transcript
        transcriptions = get_transcript(video_id, languages)

        # Return transcript
        return {
            "success": True,
            "video_id": video_id,
            "transcriptions": transcriptions
        }

    except HTTPException:
        raise
    except Exception as e:
        raise _classify_exception(e, "get transcript")


def register_youtube_qa_routes(app):
    """
    Register all YouTube Q&A routes with the FastAPI app.

    Args:
        app: FastAPI application instance
    """
    app.include_router(router)