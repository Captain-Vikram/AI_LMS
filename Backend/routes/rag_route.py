"""Resource summary and QA routes with persisted single-turn history."""

from datetime import datetime
import json
import os
import re
from typing import Any, Dict, List, Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from database import db
from functions.rag_function import YouTubeLangChainRAG
from functions.youtube_quiz_functions import extract_core_topics, extract_video_id, get_transcript
from models.activity_feed import ActivityType

load_dotenv(override=True)

router = APIRouter(
    prefix="/api/resource",
    tags=["resource-qa"],
    responses={404: {"description": "Not found"}},
)


class SummaryRequest(BaseModel):
    """Request to get or generate a resource summary"""
    resource_id: str = Field(..., description="Resource ID from database")
    resource_url: str = Field(..., description="YouTube video URL")


class AskQuestionRequest(BaseModel):
    """Request to ask a question about a resource"""
    resource_id: str = Field(..., description="Resource ID from database")
    resource_url: str = Field(..., description="YouTube video URL")
    student_id: str = Field(..., description="Student ID asking the question")
    module_id: Optional[str] = Field(None, description="Module ID")
    classroom_id: Optional[str] = Field(None, description="Classroom ID")
    question: str = Field(..., description="Question about the resource")


class AskQuestionResponse(BaseModel):
    """Response after asking a question"""
    answer: str
    question: str
    asked_at: datetime
    chat_history: List[Dict[str, Any]]


def get_rag_system():
    """Get the RAG system instance"""
    api_token = os.getenv("LMSTUDIO_API_TOKEN") or os.getenv("LMSTUDIO_API_KEY")
    model_name = os.getenv("LMSTUDIO_MODEL", "default")
    return YouTubeLangChainRAG(api_token, model_name)


def _to_object_id(value: str) -> Optional[ObjectId]:
    try:
        return ObjectId(str(value))
    except Exception:
        return None


def _normalize_resource_url(raw_url: Any) -> str:
    if isinstance(raw_url, list):
        for item in raw_url:
            if isinstance(item, str) and item.strip():
                return item.strip()
        return ""

    text = str(raw_url or "").strip()
    if not text:
        return ""

    # Handle legacy list-like string payloads such as ['https://...'].
    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text.replace("'", '"'))
            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, str) and item.strip():
                        return item.strip()
        except Exception:
            pass

    text = text.replace("\\u0026", "&")
    matched = re.search(r"https?://[^\s'\"]+", text)
    if matched:
        return matched.group(0).strip()

    return text.strip("'\"")


def _extract_resource_url(resource: Dict[str, Any]) -> str:
    return _normalize_resource_url(
        resource.get("url")
        or resource.get("youtube_url")
        or resource.get("youtube_link")
        or ""
    )


def _resolve_canonical_resource_url(resource: Dict[str, Any], requested_url: Any) -> str:
    stored_url = _extract_resource_url(resource or {})
    requested = _normalize_resource_url(requested_url)

    # Prefer persisted resource URL when valid. This avoids client payload drift.
    if stored_url and extract_video_id(stored_url):
        return stored_url

    if requested and extract_video_id(requested):
        return requested

    return stored_url or requested


def _contains_rickroll_lyrics(text: str) -> bool:
    lowered = str(text or "").lower()
    if not lowered:
        return False

    markers = [
        "never gonna give you up",
        "never gonna let you down",
        "never gonna run around",
        "never gonna make you cry",
        "never gonna say goodbye",
        "rick astley",
    ]
    hits = sum(1 for marker in markers if marker in lowered)
    return hits >= 2


def _resource_explicitly_matches_rickroll(resource: Dict[str, Any]) -> bool:
    haystack = " ".join(
        [
            str(resource.get("title") or ""),
            str(resource.get("description") or ""),
            str(resource.get("url") or ""),
        ]
    ).lower()
    return "rick astley" in haystack or "never gonna give you up" in haystack


def _find_resource_context(resource_id: str) -> Dict[str, Any]:
    """
    Locate resource metadata from module-embedded resources first, then fallback to resources collection.
    Returns a context object that includes where/how summary cache should be written.
    """
    module = db.learning_modules.find_one(
        {"resources.id": resource_id},
        {"_id": 1, "classroom_id": 1, "resources.$": 1},
    )
    resource_key = "id"

    if not module:
        module = db.learning_modules.find_one(
            {"resources.resource_id": resource_id},
            {"_id": 1, "classroom_id": 1, "resources.$": 1},
        )
        resource_key = "resource_id"

    if module and isinstance(module.get("resources"), list) and module["resources"]:
        resource = module["resources"][0]
        return {
            "source": "module_resource",
            "module_id": str(module.get("_id")),
            "classroom_id": str(module.get("classroom_id")),
            "resource": resource,
            "resource_key": resource_key,
            "resource_match_value": resource_id,
        }

    oid = _to_object_id(resource_id)
    resource_filter: Dict[str, Any]
    if oid:
        resource_filter = {"_id": {"$in": [oid, resource_id]}}
    else:
        resource_filter = {"_id": resource_id}

    collection_resource = db.resources.find_one(resource_filter)
    if collection_resource:
        return {
            "source": "resources_collection",
            "module_id": str(collection_resource.get("module_id") or ""),
            "classroom_id": str(collection_resource.get("classroom_id") or ""),
            "resource": collection_resource,
            "resource_key": "_id",
            "resource_match_value": collection_resource.get("_id"),
        }

    raise HTTPException(status_code=404, detail="Resource not found")


def _persist_cached_summary(context: Dict[str, Any], summary: str, now: datetime) -> None:
    if context.get("source") == "module_resource":
        module_oid = _to_object_id(str(context.get("module_id")))
        if not module_oid:
            return

        resource_key = context.get("resource_key")
        resource_match_value = context.get("resource_match_value")
        if resource_key not in {"id", "resource_id"}:
            return

        db.learning_modules.update_one(
            {
                "_id": module_oid,
                f"resources.{resource_key}": resource_match_value,
            },
            {
                "$set": {
                    "resources.$.cached_summary": summary,
                    "resources.$.cached_summary_generated_at": now,
                    "updated_date": now,
                }
            },
        )
        return

    if context.get("source") == "resources_collection":
        resource_id = context.get("resource").get("_id")
        db.resources.update_one(
            {"_id": resource_id},
            {
                "$set": {
                    "cached_summary": summary,
                    "cached_summary_generated_at": now,
                }
            },
        )


def _build_summary(resource_url: str, resource: Optional[Dict[str, Any]] = None) -> str:
    video_id = extract_video_id(resource_url)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    transcript = get_transcript(video_id)
    if not transcript:
        raise HTTPException(status_code=400, detail="Could not extract transcript from video")

    transcript_text = " ".join(
        str(item.get("description") or "").strip() for item in transcript[:120]
    ).strip()

    topic_result = extract_core_topics(transcript)
    summary = str(topic_result.get("summary") or "").strip()

    # Avoid caching/tooling error text as summary content.
    if summary.upper().startswith("ERROR:"):
        summary = ""

    if not summary:
        # Fallback summary if model output misses summary field.
        summary = " ".join(
            str(item.get("description") or "").strip() for item in transcript[:8]
        ).strip()

    if _contains_rickroll_lyrics(summary) or _contains_rickroll_lyrics(transcript_text):
        if not _resource_explicitly_matches_rickroll(resource or {}):
            raise HTTPException(
                status_code=422,
                detail=(
                    "The linked video transcript appears unrelated to this lesson (detected lyric-style content). "
                    "Please verify the resource link and try again."
                ),
            )

    return summary or "Summary could not be generated at this time."


def _serialize_chat_history(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    serialized = []
    for item in entries:
        asked_at = item.get("asked_at")
        serialized.append(
            {
                "question": item.get("question", ""),
                "answer": item.get("answer", ""),
                "asked_at": asked_at.isoformat() if isinstance(asked_at, datetime) else asked_at,
            }
        )
    return serialized


@router.get("/summary/get-or-create")
async def get_or_create_summary(
    resource_id: str = Query(..., description="Resource ID"),
    resource_url: str = Query(..., description="YouTube URL"),
    force_refresh: bool = Query(False, description="If true, ignore cached summary and regenerate"),
) -> Dict[str, Any]:
    """
    Get or create a summary for a resource.
    First call generates and caches it. Subsequent calls return the cached version.
    """
    try:
        context = _find_resource_context(resource_id)
        resource = context.get("resource", {})

        cached_summary = str(resource.get("cached_summary") or "").strip()
        cached_at = resource.get("cached_summary_generated_at")

        # Check if summary already cached.
        if cached_summary and not force_refresh and not _contains_rickroll_lyrics(cached_summary):
            return {
                "summary": cached_summary,
                "cached_at": cached_at.isoformat() if isinstance(cached_at, datetime) else cached_at,
                "is_cached": True,
            }

        canonical_url = _resolve_canonical_resource_url(resource, resource_url)
        if not canonical_url:
            raise HTTPException(status_code=400, detail="Invalid or missing resource_url")

        summary = _build_summary(canonical_url, resource=resource)
        now = datetime.utcnow()
        _persist_cached_summary(context, summary, now)

        return {
            "summary": summary,
            "cached_at": now.isoformat(),
            "is_cached": False,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error getting summary: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing summary: {str(e)}"
        )


@router.post("/qa/ask", response_model=AskQuestionResponse)
async def ask_question(request: AskQuestionRequest) -> AskQuestionResponse:
    """
    Ask a single-turn question about a resource.
    Strict single-turn: no multi-turn context fed into the LLM.
    Answer is appended to chat history.
    """
    try:
        context = _find_resource_context(request.resource_id)
        resource = context.get("resource", {})

        # Sanitize question (remove problematic commas if using YouTubeSearchTool)
        sanitized_question = request.question.replace(",", " ")

        canonical_url = _resolve_canonical_resource_url(resource, request.resource_url)
        if not canonical_url:
            raise HTTPException(status_code=400, detail="Invalid or missing resource_url")

        # Generate answer using strict single-turn RAG.
        rag = get_rag_system()
        rag_result = rag.answer_question(canonical_url, sanitized_question, languages=["en"], top_k=3)
        answer_text = str(rag_result.get("answer") or "").strip()

        if not answer_text:
            raise HTTPException(
                status_code=500,
                detail="Failed to generate answer",
            )

        now = datetime.utcnow()
        chat_entry = {
            "question": request.question,
            "answer": answer_text,
            "asked_at": now,
        }

        module_id = context.get("module_id") or request.module_id or "unknown"
        classroom_id = context.get("classroom_id") or request.classroom_id or "unknown"

        progress_filter = {
            "student_id": request.student_id,
            "module_id": module_id,
            "resource_id": request.resource_id,
        }

        db.student_progress.update_one(
            progress_filter,
            {
                "$setOnInsert": {
                    "classroom_id": classroom_id,
                    "is_unlocked": False,
                    "tests_taken": 0,
                    "passed_tests_count": 0,
                    "failed_tests_count": 0,
                    "highest_score": None,
                    "created_at": now,
                },
                "$set": {
                    "updated_at": now,
                    "last_accessed_at": now,
                },
                "$push": {
                    "single_turn_chat_history": chat_entry,
                },
            },
            upsert=True,
        )

        progress = db.student_progress.find_one(progress_filter) or {}
        chat_history = _serialize_chat_history(progress.get("single_turn_chat_history", []))

        # Log activity
        log_activity(
            classroom_id=classroom_id,
            action_type=ActivityType.AI_QUESTION_ASKED,
            student_id=request.student_id,
            resource_id=request.resource_id,
            details={
                "question": sanitized_question,
                "fallback": bool(rag_result.get("fallback")),
            },
        )

        return AskQuestionResponse(
            answer=answer_text,
            question=request.question,
            asked_at=now,
            chat_history=chat_history,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error asking question: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing question: {str(e)}"
        )


@router.post("/ask", response_model=AskQuestionResponse)
async def ask_question_alias(request: AskQuestionRequest) -> AskQuestionResponse:
    """Backward-compatible alias for /qa/ask."""
    return await ask_question(request)


@router.get("/chat-history/{resource_id}/{student_id}")
async def get_chat_history(
    resource_id: str,
    student_id: str
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Get all past Q&A for a student on a specific resource.
    """
    try:
        progress = db.student_progress.find_one({
            "student_id": student_id,
            "resource_id": resource_id
        })

        if not progress:
            return {"chat_history": []}

        chat_history = _serialize_chat_history(progress.get("single_turn_chat_history", []))

        return {"chat_history": chat_history}

    except Exception as e:
        print(f"Error fetching chat history: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching chat history: {str(e)}"
        )


def log_activity(
    classroom_id: str,
    action_type: ActivityType,
    student_id: str,
    resource_id: Optional[str] = None,
    details: Optional[Dict] = None
):
    """Log an activity to the activity feed"""
    try:
        activity = {
            "classroom_id": classroom_id,
            "action_type": action_type.value,
            "student_id": student_id,
            "action_performed_by_id": student_id,
            "resource_id": resource_id,
            "details": details or {},
            "created_at": datetime.utcnow(),
        }
        db.activity_feed.insert_one(activity)
    except Exception as e:
        print(f"Error logging activity: {e}")
