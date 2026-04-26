"""Module assessment routes for draft, publish, submission, and grading workflows."""

from datetime import datetime, timedelta
import json
import os
import random
import re
import uuid
import asyncio
from typing import Any, Dict, List, Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from database import db
import functions.llm_adapter_async as genai
from functions.youtube_quiz_functions import extract_video_id, get_transcript
from functions.utils import get_user_display_name
from models.activity_feed import ActivityType

load_dotenv(override=True)

router = APIRouter(
    prefix="/api/module-assessment",
    tags=["module-assessment"],
    responses={404: {"description": "Not found"}},
)


class GenerateDraftRequest(BaseModel):
    """Request to auto-generate a draft assessment."""
    module_id: str = Field(..., description="Module ID")
    num_questions: int = Field(20, description="Number of questions to generate")
    question_types: List[str] = Field(
        ["mcq", "fill_blank", "short_answer"],
        description="Types of questions to include",
    )


class UpdateAssessmentRequest(BaseModel):
    """Request to update an assessment draft."""
    title: str
    description: str
    time_limit_minutes: int
    valid_from: datetime
    valid_until: datetime
    passing_score_percentage: float
    questions: List[Dict[str, Any]]


class StartAssessmentRequest(BaseModel):
    """Request to start taking an assessment."""
    assessment_id: str = Field(..., description="Assessment ID")
    student_id: str = Field(..., description="Student ID")


class SubmitAssessmentRequest(BaseModel):
    """Request to submit completed assessment."""
    submission_id: str = Field(..., description="Submission ID")
    answers: List[Dict[str, str]] = Field(..., description="List of {question_id, answer}")


class GradeSubmissionRequest(BaseModel):
    """Request to grade subjective answers."""
    submission_id: str = Field(..., description="Submission ID")
    grades: List[Dict[str, Any]] = Field(
        ...,
        description="List of {question_id, points_awarded, teacher_comment}",
    )
    overall_feedback: Optional[str] = None


def _to_object_id(value: str) -> Optional[ObjectId]:
    try:
        return ObjectId(str(value))
    except Exception:
        return None


def _id_candidates(value: Any) -> List[Any]:
    raw = str(value)
    candidates: List[Any] = [raw]
    oid = _to_object_id(raw)
    if oid:
        candidates.append(oid)
    return candidates


def _find_by_id(collection, raw_id: str) -> Optional[Dict[str, Any]]:
    return collection.find_one({"_id": {"$in": _id_candidates(raw_id)}})


def _question_requires_manual_grade(question_type: str) -> bool:
    return str(question_type or "").strip().lower() in {"short_answer", "essay"}


def _safe_points(value: Any, default: int = 0) -> int:
    try:
        return max(0, int(value or 0))
    except Exception:
        return default


def _serialize_question_for_student(question: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": question.get("id"),
        "type": question.get("type"),
        "question_text": question.get("question_text"),
        "options": question.get("options"),
        "expected_length": question.get("expected_length"),
        "points": _safe_points(question.get("points"), 0),
    }


def _module_resource_count(module_id: str) -> int:
    module_oid = _to_object_id(module_id)
    if module_oid:
        module = db.learning_modules.find_one({"_id": module_oid}, {"resources": 1})
        if module and isinstance(module.get("resources"), list):
            return len(module.get("resources", []))

    # Fallback for older writes that used resources collection.
    return db.resources.count_documents({"module_id": module_id})


def _normalize_question_type(value: Any) -> str:
    normalized = str(value or "").strip().lower()
    if normalized in {"multiple_choice", "multiple-choice"}:
        return "mcq"
    if normalized in {"fill in blank", "fill-in-the-blank", "fillblank"}:
        return "fill_blank"
    if normalized in {"short answer", "short-answer"}:
        return "short_answer"
    if normalized in {"mcq", "fill_blank", "short_answer", "essay"}:
        return normalized
    return ""


def _clean_json_payload(raw_text: str) -> str:
    text = str(raw_text or "").strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
    if text.endswith("```"):
        text = text[:-3].strip()
    return text


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

    matched = re.search(r"https?://[^\s'\"]+", text)
    return matched.group(0).strip() if matched else text


def _build_module_context(module: Dict[str, Any]) -> str:
    resources = [item for item in module.get("resources", []) if isinstance(item, dict)]
    resources = sorted(resources, key=lambda item: int(item.get("order", 0) or 0))

    context_chunks: List[str] = []
    max_total_chars = 24000

    for index, resource in enumerate(resources, start=1):
        title = str(resource.get("title") or f"Resource {index}").strip()
        description = str(resource.get("description") or "").strip()
        url = _normalize_resource_url(
            resource.get("url") or resource.get("youtube_url") or resource.get("youtube_link")
        )

        transcript_excerpt = ""
        if url:
            try:
                video_id = extract_video_id(url)
                if video_id:
                    entries = get_transcript(video_id, ["en"])
                    transcript_text = " ".join(
                        str(entry.get("description") or "") for entry in entries if isinstance(entry, dict)
                    )
                    transcript_excerpt = re.sub(r"\s+", " ", transcript_text).strip()[:3200]
            except Exception as exc:
                print(f"Transcript unavailable for assessment resource '{title}': {exc}")

        chunk_parts = [f"Resource {index}: {title}"]
        if description:
            chunk_parts.append(f"Description: {description}")
        if transcript_excerpt:
            chunk_parts.append(f"Transcript excerpt: {transcript_excerpt}")

        context_chunk = "\n".join(chunk_parts)
        if not context_chunk.strip():
            continue

        context_chunks.append(context_chunk)
        if sum(len(piece) for piece in context_chunks) >= max_total_chars:
            break

    return "\n\n".join(context_chunks)[:max_total_chars]


async def _generate_ai_draft_questions(
    module: Dict[str, Any],
    num_questions: int,
    question_types: List[str],
) -> List[Dict[str, Any]]:
    normalized_types = [
        _normalize_question_type(item)
        for item in (question_types or ["mcq", "fill_blank", "short_answer"])
    ]
    normalized_types = [item for item in normalized_types if item]
    if not normalized_types:
        normalized_types = ["mcq", "fill_blank", "short_answer"]

    module_context = _build_module_context(module)
    if not module_context.strip():
        raise HTTPException(
            status_code=400,
            detail="Unable to collect enough module content to generate an AI assessment draft.",
        )

    model_name = os.getenv("LMSTUDIO_MODEL")
    generation_config = {
        "temperature": 0.2,
        "top_p": 0.95,
        "max_output_tokens": 8192,
    }

    model = genai.GenerativeModelAsync(model_name=model_name, generation_config=generation_config)

    prompt = f"""
You are generating a final assessment draft for a classroom learning module.

Module name: {module.get('name', 'Module')}
Module description: {module.get('description', '')}
Required question count: {max(1, int(num_questions))}
Allowed question types: {', '.join(normalized_types)}

Use the module content below as source material. Questions must test conceptual understanding.

{module_context}

Return ONLY valid JSON in this exact shape:
{{
  "questions": [
    {{
      "type": "mcq|fill_blank|short_answer",
      "question_text": "...",
      "options": ["..."] or null,
      "correct_answer": "...",
      "points": 10,
      "expected_length": "..." or null,
      "rubric": "..." or null
    }}
  ]
}}

Rules:
- For mcq, provide exactly 4 options and set correct_answer to the exact correct option text.
- For fill_blank, options must be null.
- For short_answer, options must be null and include a rubric.
- Ensure all questions are grounded in module content.
- Do not include markdown or prose outside JSON.
"""

    response = await model.generate_content(prompt)
    cleaned_payload = _clean_json_payload(response.text)

    try:
        parsed = json.loads(cleaned_payload)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"AI draft generation returned invalid JSON: {exc}",
        )

    questions_raw = parsed.get("questions") if isinstance(parsed, dict) else parsed
    if not isinstance(questions_raw, list):
        raise HTTPException(status_code=500, detail="AI draft generation produced no question list.")

    normalized_questions: List[Dict[str, Any]] = []
    for raw_item in questions_raw:
        if not isinstance(raw_item, dict):
            continue

        q_type = _normalize_question_type(raw_item.get("type"))
        if q_type not in normalized_types:
            q_type = normalized_types[0]

        question_text = str(raw_item.get("question_text") or raw_item.get("question") or "").strip()
        if not question_text:
            continue

        points = _safe_points(raw_item.get("points"), 10) or 10
        options = raw_item.get("options") if isinstance(raw_item.get("options"), list) else None
        correct_answer = raw_item.get("correct_answer")
        expected_length = raw_item.get("expected_length")
        rubric = raw_item.get("rubric")

        if q_type == "mcq":
            option_values = [str(option).strip() for option in (options or []) if str(option).strip()]
            if len(option_values) < 2:
                continue
            if len(option_values) > 4:
                option_values = option_values[:4]

            if isinstance(correct_answer, int):
                resolved_answer = (
                    option_values[correct_answer]
                    if 0 <= correct_answer < len(option_values)
                    else option_values[0]
                )
            else:
                answer_text = str(correct_answer or "").strip()
                if answer_text.isdigit() and 0 <= int(answer_text) < len(option_values):
                    resolved_answer = option_values[int(answer_text)]
                elif any(_normalize_answer(answer_text) == _normalize_answer(option) for option in option_values):
                    resolved_answer = next(
                        option
                        for option in option_values
                        if _normalize_answer(answer_text) == _normalize_answer(option)
                    )
                else:
                    resolved_answer = option_values[0]

            correct_answer = resolved_answer
            options = option_values
            expected_length = None
            rubric = None

        elif q_type == "fill_blank":
            answer_text = str(correct_answer or raw_item.get("answer") or "").strip()
            if not answer_text:
                continue
            correct_answer = answer_text
            options = None
            expected_length = None
            rubric = None

        else:  # short_answer
            answer_text = str(correct_answer or raw_item.get("answer") or "Key points vary.").strip()
            correct_answer = answer_text
            options = None
            expected_length = str(expected_length or "80-120 words")
            rubric = str(
                rubric
                or "Assess conceptual correctness, completeness, and clarity of explanation."
            )

        normalized_questions.append(
            {
                "id": str(uuid.uuid4()),
                "type": q_type,
                "question_text": question_text,
                "options": options,
                "correct_answer": correct_answer,
                "points": points,
                "expected_length": expected_length,
                "rubric": rubric,
            }
        )

        if len(normalized_questions) >= max(1, int(num_questions)):
            break

    if len(normalized_questions) < max(3, min(max(1, int(num_questions)), 5)):
        raise HTTPException(
            status_code=500,
            detail="AI draft generation produced too few valid questions. Please try again.",
        )

    return normalized_questions


def _normalize_answer(value: Any) -> str:
    return str(value or "").strip().lower()


def _auto_grade_question(question: Dict[str, Any], student_answer: str) -> Dict[str, Any]:
    question_type = str(question.get("type") or "").strip().lower()
    points = _safe_points(question.get("points"), 0)

    if _question_requires_manual_grade(question_type):
        return {
            "pending_manual_grade": True,
            "is_correct": None,
            "points": 0,
        }

    correct_answer = question.get("correct_answer")
    options = question.get("options") if isinstance(question.get("options"), list) else None

    if question_type == "mcq" and options:
        if isinstance(correct_answer, int):
            correct_index = correct_answer
        else:
            try:
                correct_index = int(str(correct_answer))
            except Exception:
                correct_index = -1

        if 0 <= correct_index < len(options):
            normalized_correct_option = _normalize_answer(options[correct_index])
            is_correct = _normalize_answer(student_answer) in {
                str(correct_index),
                normalized_correct_option,
            }
        else:
            is_correct = _normalize_answer(student_answer) == _normalize_answer(correct_answer)
    else:
        is_correct = _normalize_answer(student_answer) == _normalize_answer(correct_answer)

    return {
        "pending_manual_grade": False,
        "is_correct": is_correct,
        "points": points if is_correct else 0,
    }


def _serialize_datetime(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _serialize_assessment(assessment: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "assessment_id": str(assessment.get("_id")),
        "status": assessment.get("status"),
        "is_draft": bool(assessment.get("is_draft", False)),
        "is_published": bool(assessment.get("is_published", False)),
        "title": assessment.get("title"),
        "description": assessment.get("description"),
        "time_limit_minutes": assessment.get("time_limit_minutes"),
        "valid_from": _serialize_datetime(assessment.get("valid_from")),
        "valid_until": _serialize_datetime(assessment.get("valid_until")),
        "passing_score_percentage": assessment.get("passing_score_percentage", 0.70),
        "total_points": assessment.get("total_points", 0),
        "questions": assessment.get("questions", []),
        "updated_at": _serialize_datetime(assessment.get("updated_at")),
    }


# ==== TEACHER ENDPOINTS ====


@router.post("/draft-generate")
async def generate_draft_assessment(request: GenerateDraftRequest) -> Dict[str, Any]:
    """Generate a draft final assessment for a module."""
    try:
        module_oid = _to_object_id(request.module_id)
        if not module_oid:
            raise HTTPException(status_code=400, detail="Invalid module id")

        module = db.learning_modules.find_one({"_id": module_oid})
        if not module:
            raise HTTPException(status_code=404, detail="Module not found")

        resources = [item for item in module.get("resources", []) if isinstance(item, dict)]
        if not resources:
            raise HTTPException(status_code=400, detail="Module has no resources")

        questions = await _generate_ai_draft_questions(
            module=module,
            num_questions=request.num_questions,
            question_types=request.question_types,
        )
        total_points = sum(_safe_points(question.get("points"), 0) for question in questions)

        now = datetime.utcnow()
        assessment = {
            "module_id": request.module_id,
            "classroom_id": str(module.get("classroom_id") or ""),
            "created_by_teacher_id": "current_teacher_id",
            "status": "draft",
            "is_draft": True,
            "is_published": False,
            "published_at": None,
            "title": f"{module.get('name', 'Module')} Final Assessment",
            "description": "Final assessment for this module",
            "total_points": total_points,
            "passing_score_percentage": 0.70,
            "time_limit_minutes": 60,
            "valid_from": now,
            "valid_until": now + timedelta(days=7),
            "allow_retakes": False,
            "shuffle_questions": True,
            "questions": questions,
            "created_at": now,
            "updated_at": now,
        }

        result = db.module_assessments.insert_one(assessment)
        assessment_id = str(result.inserted_id)

        return {
            "assessment_id": assessment_id,
            "status": "draft",
            "assessment_title": assessment.get("title"),
            "questions": questions,
            "total_points": total_points,
            "message": "Draft assessment generated. You can now edit questions and publish.",
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating assessment: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating assessment: {str(e)}")


@router.get("/module/{module_id}/latest")
async def get_latest_module_assessment(module_id: str) -> Dict[str, Any]:
    """Get the latest assessment (draft or published) for a module."""
    try:
        module_oid = _to_object_id(module_id)
        module_candidates: List[Any] = [module_id]
        if module_oid:
            module_candidates.append(module_oid)

        assessment = db.module_assessments.find_one(
            {"module_id": {"$in": module_candidates}},
            sort=[("updated_at", -1), ("created_at", -1)],
        )

        if not assessment:
            return {
                "assessment": None,
                "message": "No assessment exists for this module yet.",
            }

        return {
            "assessment": _serialize_assessment(assessment),
            "message": "Latest module assessment loaded.",
        }
    except Exception as e:
        print(f"Error fetching latest module assessment: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching assessment: {str(e)}")


@router.get("/{assessment_id}")
async def get_assessment(assessment_id: str) -> Dict[str, Any]:
    """Get full assessment document for editor screens."""
    assessment = _find_by_id(db.module_assessments, assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    return _serialize_assessment(assessment)


@router.patch("/{assessment_id}")
async def update_assessment(assessment_id: str, request: UpdateAssessmentRequest) -> Dict[str, Any]:
    """Update an assessment draft."""
    try:
        assessment = _find_by_id(db.module_assessments, assessment_id)
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")

        if not bool(assessment.get("is_draft", False)):
            raise HTTPException(status_code=400, detail="Cannot edit published assessment")

        total_points = sum(_safe_points(question.get("points"), 0) for question in request.questions)
        now = datetime.utcnow()

        db.module_assessments.update_one(
            {"_id": assessment.get("_id")},
            {
                "$set": {
                    "title": request.title,
                    "description": request.description,
                    "time_limit_minutes": request.time_limit_minutes,
                    "valid_from": request.valid_from,
                    "valid_until": request.valid_until,
                    "passing_score_percentage": request.passing_score_percentage,
                    "questions": request.questions,
                    "total_points": total_points,
                    "updated_at": now,
                }
            },
        )

        refreshed = db.module_assessments.find_one({"_id": assessment.get("_id")})

        return {
            "assessment_id": str(assessment.get("_id")),
            "status": "draft",
            "message": "Assessment updated successfully.",
            "assessment": _serialize_assessment(refreshed) if refreshed else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error updating assessment: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating assessment: {str(e)}")


@router.post("/{assessment_id}/publish")
async def publish_assessment(assessment_id: str) -> Dict[str, Any]:
    """Publish a draft assessment."""
    try:
        assessment = _find_by_id(db.module_assessments, assessment_id)
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")

        now = datetime.utcnow()
        db.module_assessments.update_one(
            {"_id": assessment.get("_id")},
            {
                "$set": {
                    "status": "published",
                    "is_draft": False,
                    "is_published": True,
                    "published_at": now,
                    "updated_at": now,
                }
            },
        )

        log_activity(
            classroom_id=str(assessment.get("classroom_id") or "unknown"),
            action_type=ActivityType.ASSESSMENT_SUBMITTED,
            student_id=str(assessment.get("created_by_teacher_id") or "unknown"),
            assessment_id=str(assessment.get("_id")),
            details={"module_id": assessment.get("module_id"), "event": "published"},
        )

        return {
            "assessment_id": str(assessment.get("_id")),
            "status": "published",
            "message": "Assessment published successfully.",
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error publishing assessment: {e}")
        raise HTTPException(status_code=500, detail=f"Error publishing assessment: {str(e)}")


# ==== STUDENT ENDPOINTS ====


@router.post("/submission/start", response_model=Dict[str, Any])
async def start_assessment(request: StartAssessmentRequest) -> Dict[str, Any]:
    """Start a student assessment attempt or load existing draft."""
    try:
        assessment = _find_by_id(db.module_assessments, request.assessment_id)
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")

        if not bool(assessment.get("is_published", False)):
            raise HTTPException(status_code=400, detail="Assessment not yet available")

        # Check for existing submission (in-progress or submitted)
        existing_submission = db.assessment_submissions.find_one(
            {
                "assessment_id": {"$in": [request.assessment_id, assessment.get("_id")]},
                "student_id": request.student_id,
            }
        )

        if existing_submission and existing_submission.get("submitted_at"):
            if not bool(assessment.get("allow_retakes", False)):
                raise HTTPException(status_code=400, detail="Retakes are not allowed for this assessment")
        
        module_id = str(assessment.get("module_id") or "")
        total_resources = _module_resource_count(module_id)
        completed_resources = db.student_progress.count_documents(
            {
                "student_id": request.student_id,
                "module_id": module_id,
                "passed_tests_count": {"$gte": 2},
            }
        )

        if total_resources > 0 and completed_resources < total_resources:
            raise HTTPException(
                status_code=403,
                detail="You must complete all resources before taking the final assessment",
            )

        now = datetime.utcnow()
        time_limit_minutes = _safe_points(assessment.get("time_limit_minutes"), 60) or 60
        
        if existing_submission and not existing_submission.get("submitted_at"):
            # Load existing in-progress submission
            submission_id = str(existing_submission["_id"])
            started_at = existing_submission.get("started_at", now)
            expires_at = started_at + timedelta(minutes=time_limit_minutes)
            
            # Map answers for frontend
            saved_answers = {}
            for ans in existing_submission.get("answers", []):
                if isinstance(ans, dict) and ans.get("question_id"):
                    saved_answers[str(ans["question_id"])] = ans.get("student_answer") or ""

            questions = list(assessment.get("questions", []))
            
            return {
                "submission_id": submission_id,
                "questions": [_serialize_question_for_student(question) for question in questions],
                "time_limit_minutes": time_limit_minutes,
                "started_at": started_at.isoformat(),
                "expires_at": expires_at.isoformat(),
                "draft_answers": saved_answers,
                "is_resumed": True
            }

        # Create NEW submission
        submission = {
            "assessment_id": request.assessment_id,
            "student_id": request.student_id,
            "classroom_id": str(assessment.get("classroom_id") or ""),
            "module_id": module_id,
            "started_at": now,
            "submitted_at": None,
            "answers": [],
            "pending_manual_questions": [],
            "grading_status": "auto_graded",
            "auto_graded_score": 0,
            "manual_graded_score": 0,
            "total_score": 0,
            "score_percentage": 0.0,
            "passed": False,
            "is_final_score": False,
        }
        result = db.assessment_submissions.insert_one(submission)

        questions = list(assessment.get("questions", []))
        if bool(assessment.get("shuffle_questions", True)) and questions:
            random.shuffle(questions)

        expires_at = now + timedelta(minutes=time_limit_minutes)

        return {
            "submission_id": str(result.inserted_id),
            "questions": [_serialize_question_for_student(question) for question in questions],
            "time_limit_minutes": time_limit_minutes,
            "started_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
            "draft_answers": {},
            "is_resumed": False
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error starting assessment: {e}")
        raise HTTPException(status_code=500, detail=f"Error starting assessment: {str(e)}")


@router.post("/submission/{submission_id}/save-draft")
async def save_assessment_draft(submission_id: str, request: SubmitAssessmentRequest) -> Dict[str, Any]:
    """Save student answers as a draft without submitting."""
    try:
        submission = _find_by_id(db.assessment_submissions, submission_id)
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")

        if submission.get("submitted_at"):
            raise HTTPException(status_code=400, detail="Cannot save draft for already submitted assessment")

        draft_results = []
        for answer in request.answers:
            draft_results.append({
                "question_id": str(answer.get("question_id") or ""),
                "student_answer": str(answer.get("answer") or ""),
                "saved_at": datetime.utcnow()
            })

        db.assessment_submissions.update_one(
            {"_id": submission.get("_id")},
            {"$set": {"answers": draft_results, "updated_at": datetime.utcnow()}},
        )

        return {
            "status": "success",
            "message": "Draft answers saved.",
            "saved_count": len(draft_results)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error saving assessment draft: {e}")
        raise HTTPException(status_code=500, detail=f"Error saving draft: {str(e)}")


@router.post("/submission/{submission_id}/submit")
async def submit_assessment(submission_id: str, request: SubmitAssessmentRequest) -> Dict[str, Any]:
    """Submit student answers and auto-grade objective questions."""
    try:
        submission = _find_by_id(db.assessment_submissions, submission_id)
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")

        if submission.get("submitted_at"):
            raise HTTPException(status_code=400, detail="Submission already submitted")

        assessment = _find_by_id(db.module_assessments, str(submission.get("assessment_id")))
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")

        question_map = {
            str(question.get("id")): question
            for question in assessment.get("questions", [])
            if isinstance(question, dict) and question.get("id")
        }

        now = datetime.utcnow()
        auto_graded_score = 0
        graded_results: List[Dict[str, Any]] = []
        pending_manual_questions: List[Dict[str, Any]] = []

        for answer in request.answers:
            question_id = str(answer.get("question_id") or "")
            student_answer = str(answer.get("answer") or "")
            question = question_map.get(question_id)
            if not question:
                continue

            question_type = str(question.get("type") or "").strip().lower()
            points = _safe_points(question.get("points"), 0)
            auto_grade = _auto_grade_question(question, student_answer)

            entry = {
                "question_id": question_id,
                "student_answer": student_answer,
                "type": question_type,
            }

            if auto_grade["pending_manual_grade"]:
                pending_manual_questions.append(
                    {
                        "question_id": question_id,
                        "points": points,
                        "type": question_type,
                    }
                )
                graded_results.append(
                    {
                        **entry,
                        "pending_manual_grade": True,
                    }
                )
            else:
                awarded = _safe_points(auto_grade["points"], 0)
                auto_graded_score += awarded
                graded_results.append(
                    {
                        **entry,
                        "correct_answer": question.get("correct_answer"),
                        "is_correct": bool(auto_grade["is_correct"]),
                        "points_awarded": awarded,
                    }
                )

        grading_status = "pending_manual_grade" if pending_manual_questions else "fully_graded"
        total_points = max(1, _safe_points(assessment.get("total_points"), 1))
        total_score = auto_graded_score
        score_percentage = total_score / total_points

        update_payload = {
            "submitted_at": now,
            "answers": graded_results,
            "pending_manual_questions": pending_manual_questions,
            "auto_graded_score": auto_graded_score,
            "grading_status": grading_status,
            "auto_graded_at": now,
            "time_spent_seconds": (now - submission.get("started_at", now)).total_seconds(),
            "total_score": total_score,
            "score_percentage": score_percentage,
            "passed": False,
            "is_final_score": grading_status == "fully_graded",
        }

        if grading_status == "fully_graded":
            pass_threshold = float(assessment.get("passing_score_percentage", 0.70) or 0.70)
            update_payload["passed"] = score_percentage >= pass_threshold

        db.assessment_submissions.update_one(
            {"_id": submission.get("_id")},
            {"$set": update_payload},
        )

        log_activity(
            classroom_id=str(submission.get("classroom_id") or "unknown"),
            action_type=ActivityType.ASSESSMENT_SUBMITTED,
            student_id=str(submission.get("student_id") or "unknown"),
            assessment_id=str(submission.get("assessment_id") or ""),
            details={
                "auto_graded_score": auto_graded_score,
                "pending_manual_grade_count": len(pending_manual_questions),
            },
        )

        return {
            "submission_id": str(submission.get("_id")),
            "auto_graded_score": auto_graded_score,
            "total_score": total_score,
            "score_percentage": score_percentage,
            "grading_status": grading_status,
            "message": (
                "Assessment submitted. Objective answers graded; subjective answers are pending teacher review."
                if pending_manual_questions
                else "Assessment submitted and fully graded."
            ),
            "pending_manual_grade_count": len(pending_manual_questions),
            "auto_graded_results": [
                item for item in graded_results if not item.get("pending_manual_grade")
            ],
            "pending_manual_grade_questions": pending_manual_questions,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error submitting assessment: {e}")
        raise HTTPException(status_code=500, detail=f"Error submitting assessment: {str(e)}")


# ==== GRADING ENDPOINTS (TEACHER) ====


@router.get("/pending-grades/{classroom_id}")
async def get_pending_submissions(classroom_id: str, status: str = "pending") -> Dict[str, List[Dict[str, Any]]]:
    """Get all submissions (pending or graded) for a classroom, covering both standard and workflow types."""
    try:
        classroom_candidates = _id_candidates(classroom_id)
        
        if status == "graded":
            standard_filter = {
                "classroom_id": {"$in": classroom_candidates},
                "grading_status": "fully_graded",
            }
            workflow_filter = {
                "classroom_id": {"$in": classroom_candidates},
                "grading_status": "fully_graded",
            }
        else:
            standard_filter = {
                "classroom_id": {"$in": classroom_candidates},
                "grading_status": "pending_manual_grade",
            }
            workflow_filter = {
                "classroom_id": {"$in": classroom_candidates},
                "grading_status": "pending_teacher_review",
            }

        standard_submissions = list(
            db.assessment_submissions.find(standard_filter).sort("submitted_at", -1 if status == "graded" else 1)
        )

        results: List[Dict[str, Any]] = []
        
        for submission in standard_submissions:
            student = db.users.find_one(
                {"_id": {"$in": _id_candidates(submission.get("student_id"))}},
                {"name": 1, "first_name": 1, "last_name": 1, "profile": 1, "email": 1}
            )
            assessment = _find_by_id(db.module_assessments, str(submission.get("assessment_id")))
            pending_questions = submission.get("pending_manual_questions") or []

            results.append(
                {
                    "submission_id": str(submission.get("_id")),
                    "student_name": get_user_display_name(student),
                    "student_id": str(submission.get("student_id") or ""),
                    "module_title": (assessment or {}).get("title", "Unknown"),
                    "submitted_at": submission.get("submitted_at").isoformat()
                    if isinstance(submission.get("submitted_at"), datetime)
                    else (submission.get("submitted_at") or ""),
                    "auto_graded_score": _safe_points(submission.get("auto_graded_score"), 0),
                    "pending_questions_count": len(pending_questions),
                    "type": "standard",
                    "status": submission.get("grading_status"),
                    "final_score": submission.get("total_score", 0) if status == "graded" else None,
                    "score_percentage": submission.get("score_percentage", 0) if status == "graded" else None,
                }
            )

        workflow_submissions = list(
            db.module_assessment_workflow_submissions.find(workflow_filter).sort("submitted_at", -1 if status == "graded" else 1)
        )
        
        for submission in workflow_submissions:
            student = db.users.find_one(
                {"_id": {"$in": _id_candidates(submission.get("student_id"))}},
                {"name": 1, "first_name": 1, "last_name": 1, "profile": 1, "email": 1}
            )
            workflow = _find_by_id(db.module_assessment_workflows, str(submission.get("workflow_id")))
            module_title = "Unknown Workflow"
            if workflow:
                module = _find_by_id(db.learning_modules, str(workflow.get("module_id")))
                if module:
                    module_title = f"{module.get('name', 'Module')} - {submission.get('category', '').upper()}"
                else:
                    module_title = f"Workflow - {submission.get('category', '').upper()}"

            results.append(
                {
                    "submission_id": str(submission.get("_id")),
                    "student_name": get_user_display_name(student),
                    "student_id": str(submission.get("student_id") or ""),
                    "module_title": module_title,
                    "submitted_at": submission.get("submitted_at").isoformat()
                    if isinstance(submission.get("submitted_at"), datetime)
                    else (submission.get("submitted_at") or ""),
                    "auto_graded_score": _safe_points(submission.get("ai_score"), 0),
                    "pending_questions_count": 1 if status != "graded" else 0,
                    "type": "workflow",
                    "status": submission.get("grading_status"),
                    "final_score": submission.get("total_score", 0) if status == "graded" else None,
                    "score_percentage": submission.get("score_percentage", 0) if status == "graded" else None,
                    "category": submission.get("category"),
                }
            )

        results.sort(key=lambda x: x["submitted_at"] or "", reverse=(status == "graded"))
        return {"pending_submissions" if status == "pending" else "graded_submissions": results}

    except Exception as e:
        print(f"Error fetching submissions: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching submissions: {str(e)}")


@router.get("/submission/{submission_id}")
async def get_submission_details(submission_id: str) -> Dict[str, Any]:
    """Get detailed submission payload for teacher grading."""
    submission = _find_by_id(db.assessment_submissions, submission_id)
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    assessment = _find_by_id(db.module_assessments, str(submission.get("assessment_id")))
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    answers_by_question_id = {
        str(answer.get("question_id")): answer
        for answer in submission.get("answers", [])
        if isinstance(answer, dict)
    }

    all_questions: List[Dict[str, Any]] = []
    manual_questions: List[Dict[str, Any]] = []

    for question in assessment.get("questions", []):
        question_id = str(question.get("id") or "")
        if not question_id:
            continue
        
        question_type = str(question.get("type") or "").strip().lower()
        answer = answers_by_question_id.get(question_id, {})
        
        question_entry = {
            "question_id": question_id,
            "question_text": question.get("question_text"),
            "type": question_type,
            "max_points": _safe_points(question.get("points"), 0),
            "student_answer": answer.get("student_answer") or answer.get("answer") or "",
            "points_awarded": _safe_points(answer.get("points_awarded"), 0),
            "teacher_comment": answer.get("teacher_comment"),
            "is_manual": _question_requires_manual_grade(question_type),
            "correct_answer": question.get("correct_answer"),
            "is_correct": answer.get("is_correct"),
        }

        all_questions.append(question_entry)
        if question_entry["is_manual"]:
            manual_questions.append(question_entry)

    return {
        "submission_id": str(submission.get("_id")),
        "student_id": str(submission.get("student_id") or ""),
        "assessment_id": str(submission.get("assessment_id") or ""),
        "auto_graded_score": _safe_points(submission.get("auto_graded_score"), 0),
        "manual_graded_score": _safe_points(submission.get("manual_graded_score"), 0),
        "total_score": _safe_points(submission.get("total_score"), 0),
        "grading_status": submission.get("grading_status"),
        "teacher_feedback": submission.get("teacher_feedback"),
        "manual_questions": manual_questions,
        "all_questions": all_questions,
    }


@router.patch("/submission/{submission_id}/grade")
async def grade_submission(submission_id: str, request: GradeSubmissionRequest) -> Dict[str, Any]:
    """Finalize manual grading for a submission."""
    try:
        submission = _find_by_id(db.assessment_submissions, submission_id)
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found")

        if submission.get("is_final_score"):
            raise HTTPException(status_code=400, detail="Submission already graded (immutable)")

        assessment = _find_by_id(db.module_assessments, str(submission.get("assessment_id")))
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")

        question_map = {
            str(question.get("id")): question
            for question in assessment.get("questions", [])
            if isinstance(question, dict) and question.get("id")
        }

        answers = [item for item in submission.get("answers", []) if isinstance(item, dict)]
        answers_by_question = {str(item.get("question_id")): item for item in answers}

        manual_score = 0
        for grade in request.grades:
            question_id = str(grade.get("question_id") or "")
            question = question_map.get(question_id)
            if not question:
                continue

            max_points = _safe_points(question.get("points"), 0)
            points_awarded = min(max_points, _safe_points(grade.get("points_awarded"), 0))
            teacher_comment = grade.get("teacher_comment")

            answer_entry = answers_by_question.get(question_id)
            if not answer_entry:
                answer_entry = {
                    "question_id": question_id,
                    "student_answer": "",
                    "type": str(question.get("type") or "").strip().lower(),
                }
                answers.append(answer_entry)
                answers_by_question[question_id] = answer_entry

            answer_entry["points_awarded"] = points_awarded
            answer_entry["teacher_comment"] = teacher_comment
            answer_entry["pending_manual_grade"] = False
            manual_score += points_awarded

        auto_score = _safe_points(submission.get("auto_graded_score"), 0)
        total_score = auto_score + manual_score
        total_points = max(1, _safe_points(assessment.get("total_points"), 1))
        score_percentage = total_score / total_points
        passing_threshold = float(assessment.get("passing_score_percentage", 0.70) or 0.70)
        passed = score_percentage >= passing_threshold

        now = datetime.utcnow()
        db.assessment_submissions.update_one(
            {"_id": submission.get("_id")},
            {
                "$set": {
                    "answers": answers,
                    "manual_graded_score": manual_score,
                    "graded_by_teacher_id": "current_teacher_id",
                    "manual_graded_at": now,
                    "teacher_feedback": request.overall_feedback,
                    "total_score": total_score,
                    "score_percentage": score_percentage,
                    "passed": passed,
                    "is_final_score": True,
                    "grading_status": "fully_graded",
                }
            },
        )

        log_activity(
            classroom_id=str(submission.get("classroom_id") or "unknown"),
            action_type=ActivityType.ASSESSMENT_GRADED,
            student_id=str(submission.get("student_id") or "unknown"),
            assessment_id=str(submission.get("assessment_id") or ""),
            details={"score": score_percentage},
        )

        return {
            "submission_id": str(submission.get("_id")),
            "manual_graded_score": manual_score,
            "total_score": total_score,
            "score_percentage": score_percentage,
            "passed": passed,
            "is_final_score": True,
            "grading_status": "fully_graded",
            "message": "Grading complete and submitted to student.",
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error grading submission: {e}")
        raise HTTPException(status_code=500, detail=f"Error grading submission: {str(e)}")


def log_activity(
    classroom_id: str,
    action_type: ActivityType,
    student_id: str,
    assessment_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
):
    """Log activity feed entries for assessment events."""
    try:
        db.activity_feed.insert_one(
            {
                "classroom_id": classroom_id,
                "action_type": action_type.value,
                "student_id": student_id,
                "action_performed_by_id": student_id,
                "assessment_id": assessment_id,
                "details": details or {},
                "created_at": datetime.utcnow(),
            }
        )
    except Exception as e:
        print(f"Error logging activity: {e}")
