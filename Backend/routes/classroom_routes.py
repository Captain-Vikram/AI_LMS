from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, status
from database_async import get_db
from database import get_db as get_sync_db
from bson import ObjectId, Binary
import asyncio
from datetime import datetime
import hashlib
import json
import re
import secrets
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel
from starlette.datastructures import UploadFile as StarletteUploadFile


class ResourceApprovalRequest(BaseModel):
    approved: bool


class ManualResourceRequest(BaseModel):
    title: str
    url: str
    resource_type: Optional[str] = "youtube"
    skill: Optional[str] = "General"


class ModuleCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "published"


class ModuleReorderRequest(BaseModel):
    module_ids: List[str]


class ModuleResourceAssignmentRequest(BaseModel):
    resource_ids: List[str]


class ResourceEngagementRequest(BaseModel):
    viewed: Optional[bool] = None
    view_duration_seconds: Optional[int] = None
    completion_percentage: Optional[int] = None
    test_score: Optional[float] = None
    test_attempts: Optional[int] = None
    rating: Optional[int] = None
    helpful: Optional[bool] = None
    notes: Optional[str] = None

from services.rbac_service import RBACService
from services.learning_module_service import LearningModuleService
from functions.search_doc import generate_skill_resources
from functions.youtube_education import generate_skill_playlist
from functions.youtube_quiz_functions import extract_video_id
from functions.utils import get_current_user, normalize_user_role, get_user_display_name
from functions.cache_utils import cache_response
from functions.link_preview import fetch_preview_image
import functions.llm_adapter_async as genai

from functions.resource_utils import (
    _assessment_signature,
    _normalize_url,
    _resource_from_playlist,
    _resource_from_document,
    _build_resources_from_outputs,
    _serialize_resource,
    _resource_counts,
    _to_iso
)

router = APIRouter(prefix="/api/classroom", tags=["classroom"])


def _parse_bool(value) -> bool:
    """Normalize various truthy/falsey shapes into a boolean.

    Accepts booleans, numeric strings, common yes/no words, and returns False for None/unknown values.
    """
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    try:
        s = str(value).strip().lower()
        if s in ("1", "true", "t", "yes", "y", "on"):
            return True
        if s in ("0", "false", "f", "no", "n", "off", "none", "null", ""):
            return False
        # fallback: try integer conversion
        return bool(int(s))
    except Exception:
        return False


def _extract_pdf_excerpt_and_page_count(pdf_bytes: bytes, max_pages: int = 10) -> Tuple[str, int]:
    if not pdf_bytes:
        return "", 0

    try:
        import fitz  # PyMuPDF

        text_parts = []
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = doc.page_count if hasattr(doc, "page_count") else len(doc)
        for idx, page in enumerate(doc):
            if idx >= max_pages:
                break
            try:
                page_text = page.get_text("text")
            except Exception:
                page_text = ""
            if page_text:
                text_parts.append(page_text)
        try:
            doc.close()
        except Exception:
            pass

        extracted = "\n".join(text_parts)
        extracted = re.sub(r"\n{3,}", "\n\n", extracted)
        return extracted[:16000], int(page_count or 0)
    except Exception:
        return "", 0


def _subject_regex(subject: str) -> str:
    return rf"^\s*{re.escape((subject or '').strip())}\s*$"


def _subject_matches_pdf_excerpt(subject: str, excerpt: str) -> bool:
    """Loosely check whether key tokens from the subject appear in the PDF excerpt.

    Be permissive: if excerpt is empty, return True to avoid blocking creation.
    """
    if not excerpt:
        return True
    if not subject:
        return True

    excerpt_l = excerpt.lower()
    tokens = [t for t in re.findall(r"\w+", subject.lower()) if len(t) > 2]
    if not tokens:
        return True

    # Consider a match if any token appears as a whole word in the excerpt
    for tok in tokens:
        if re.search(rf"\b{re.escape(tok)}\b", excerpt_l):
            return True

    return False


def _derive_focus_areas(subject: str, subject_description: str, student_expectations: str, curriculum_excerpt: str = "", limit: int = 6) -> List[str]:
    combined = "\n".join([str(subject_description or ""), str(student_expectations or ""), str(curriculum_excerpt or "")])
    # Split by common separators and pick candidate phrases
    candidates = [c.strip() for c in re.split(r"[\n,.;]", combined) if c and len(c.strip()) > 3]
    seen = set()
    results: List[str] = []

    # Always include the primary subject as the first focus area
    if subject and subject.strip():
        results.append(subject.strip())
        seen.add(subject.strip().lower())

    for c in candidates:
        key = c.lower()
        if key in seen:
            continue
        if len(results) >= limit:
            break
        # Skip near-duplicates or generic fragments
        if len(c.split()) > 5:
            # truncate long phrases to first 4 words for readability
            c = " ".join(c.split()[:4])
        results.append(c)
        seen.add(key)

    # Guarantee at least one focus area
    if not results:
        results = [subject or "General"]

    return results[:limit]


def _build_assessment_seed(subject: str, focus_areas: List[str], student_expectations: str) -> Dict[str, Any]:
    return {
        "subject": subject,
        "focus_areas": focus_areas,
        "student_expectations": student_expectations,
        "generated_at": datetime.utcnow().isoformat(),
    }


async def _parse_create_classroom_request(request: Request) -> Tuple[Dict[str, Any], Optional[StarletteUploadFile]]:
    content_type = (request.headers.get("content-type") or "").lower()
    if "multipart/form-data" in content_type:
        form = await request.form()
        payload = {
            "name": form.get("name"),
            "subject": form.get("subject"),
            "grade_level": form.get("grade_level"),
            "description": form.get("description"),
            "subject_description": form.get("subject_description"),
            "student_expectations": form.get("student_expectations"),
            "require_approval": form.get("require_approval"),
        }
        curriculum_pdf = form.get("curriculum_pdf")
        # request.form() yields Starlette UploadFile objects; accept both FastAPI and Starlette types.
        if curriculum_pdf is not None and not isinstance(curriculum_pdf, (UploadFile, StarletteUploadFile)):
            curriculum_pdf = None
        return payload, curriculum_pdf

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    if not isinstance(payload, dict):
        payload = {}

    return payload, None


async def _generate_ai_resource_bundle(
    assessment_seed: Dict[str, Any],
    source: str,
    approval_status: str,
    force_refresh: bool = False,
) -> List[Dict[str, Any]]:
    db = get_db()
    signature = _assessment_signature(assessment_seed)
    
    # Phase 0: Cache Layer - check for existing valid cache
    if not force_refresh:
        try:
            cached_doc = await db.ai_resource_cache.find_one({"signature": signature})
            if cached_doc and isinstance(cached_doc.get("resources"), list):
                print(f"DEBUG: Cache hit for resource bundle with signature {signature}")
                return cached_doc["resources"]
        except Exception as e:
            print(f"DEBUG: Cache lookup failed: {e}")

    playlists: List[Dict[str, Any]] = []
    deepsearch_results: List[Dict[str, Any]] = []

    try:
        playlists = await generate_skill_playlist(assessment_seed)
    except Exception:
        try:
            playlists = await generate_skill_playlist(assessment_seed, force_fallback=True)
        except Exception:
            playlists = []

    try:
        deepsearch_results = await generate_skill_resources(assessment_seed)
    except Exception:
        deepsearch_results = []

    resources = _build_resources_from_outputs(
        playlists=playlists,
        deepsearch_results=deepsearch_results,
        source=source,
        approval_status=approval_status,
    )
    
    # Store in cache with 7-day expiration logic (handled by TTL index)
    try:
        await db.ai_resource_cache.update_one(
            {"signature": signature},
            {
                "$set": {
                    "signature": signature,
                    "resources": resources,
                    "created_at": datetime.utcnow(),
                    "assessment_seed": assessment_seed,
                }
            },
            upsert=True
        )
        # Create TTL index if not exists (7 days = 604800 seconds)
        await db.ai_resource_cache.create_index("created_at", expireAfterSeconds=604800)
    except Exception as e:
        print(f"DEBUG: Failed to update cache: {e}")

    return resources


async def _latest_assessment_snapshot(db, user_oid: ObjectId) -> Optional[Dict[str, Any]]:
    assessment = await db.skill_assessment_results.find_one(
        {"user_id": user_oid},
        sort=[("timestamp", -1)],
    )

    if not assessment:
        return None

    return {
        "score": assessment.get("score", {}),
        "assessed_level": assessment.get("assessed_level", "intermediate"),
        "question_feedback": assessment.get("question_feedback", []),
        "skill_gaps": assessment.get("skill_gaps", {}),
        "recommendations": assessment.get("recommendations", []),
    }


async def _ensure_user_membership(db, user_oid: ObjectId, classroom_id: str, role: str):
    user_doc = await db.users.find_one({"_id": user_oid}, {"classroom_memberships": 1}) or {}
    memberships = user_doc.get("classroom_memberships", [])
    already_member = any(str(m.get("classroom_id")) == classroom_id for m in memberships)
    if not already_member:
        await db.users.update_one(
            {"_id": user_oid},
            {
                "$push": {
                    "classroom_memberships": {
                        "classroom_id": classroom_id,
                        "role": role,
                        "joined_date": datetime.utcnow(),
                        "is_active": True,
                        "onboarding_complete": role == "teacher",
                        "assessment_complete": role == "teacher",
                    }
                }
            },
        )


async def _build_demo_students(db, classroom_oid: ObjectId, teacher_oid: ObjectId, count: int = 12):
    suffix = str(teacher_oid)[-6:]
    student_ids = []

    for i in range(1, count + 1):
        email = f"demo_student_{suffix}_{i}@skillmaster.local"
        student = await db.users.find_one({"email": email})
        if not student:
            created = await db.users.insert_one(
                {
                    "email": email,
                    "password_hash": "",
                    "role": "student",
                    "registration_date": datetime.utcnow(),
                    "last_login": None,
                    "status": "active",
                    "onboarding_complete": True,
                    "assessment_complete": True,
                    "profile": {"name": f"Demo Student {i}"},
                    "classroom_memberships": [],
                    "created_date": datetime.utcnow(),
                    "updated_date": datetime.utcnow(),
                }
            )
            student_oid = created.inserted_id
        else:
            student_oid = student["_id"]

        student_ids.append(student_oid)
        await _ensure_user_membership(db, student_oid, str(classroom_oid), "student")

    if student_ids:
        await db.classrooms.update_one(
            {"_id": classroom_oid},
            {"$addToSet": {"students": {"$each": student_ids}}, "$set": {"updated_date": datetime.utcnow()}},
        )


async def _create_demo_teacher_classroom(db, current_user: dict) -> str:
    teacher_oid = ObjectId(current_user["user_id"])
    existing = await db.classrooms.find_one({"teacher_id": teacher_oid}, {"_id": 1})
    if existing:
        return str(existing["_id"])

    email = (current_user.get("email") or "teacher").split("@")[0]
    classroom_name = f"{email.title()} Demo Studio"
    enrollment_code = secrets.token_urlsafe(8)

    classroom_doc = {
        "institution_id": current_user.get("institution_id"),
        "name": classroom_name,
        "subject": "General Studies",
        "grade_level": "9-12",
        "description": "Auto-provisioned demo classroom with sample learners.",
        "teacher_id": teacher_oid,
        "co_teachers": [],
        "students": [],
        "student_groups": [],
        "status": "active",
        "start_date": datetime.utcnow(),
        "end_date": None,
        "enrollment_code": enrollment_code,
        "require_approval": False,
        "created_date": datetime.utcnow(),
        "updated_date": datetime.utcnow(),
    }

    inserted = await db.classrooms.insert_one(classroom_doc)
    classroom_oid = inserted.inserted_id
    classroom_id = str(classroom_oid)

    await _ensure_user_membership(db, teacher_oid, classroom_id, "teacher")
    await _build_demo_students(db, classroom_oid, teacher_oid, count=12)

    await db.announcements.insert_many(
        [
            {
                "classroom_id": classroom_oid,
                "teacher_id": teacher_oid,
                "title": "Welcome to your Demo Studio",
                "content": "This classroom was created automatically so you can preview the full teacher flow.",
                "status": "published",
                "target_groups": [],
                "created_date": datetime.utcnow(),
                "updated_date": datetime.utcnow(),
                "views": 0,
                "viewed_by": [],
            },
            {
                "classroom_id": classroom_oid,
                "teacher_id": teacher_oid,
                "title": "Next step: Open Dashboard",
                "content": "Check roster, announcements, and analytics cards in the new teacher dashboard.",
                "status": "published",
                "target_groups": [],
                "created_date": datetime.utcnow(),
                "updated_date": datetime.utcnow(),
                "views": 0,
                "viewed_by": [],
            },
        ]
    )

    return classroom_id


@router.get("")
@cache_response(ttl=300, key_prefix="classroom_list")
async def list_classrooms(current_user = Depends(get_current_user)):
    db = get_db()
    rbac = RBACService(db)
    classrooms = await rbac.get_user_classrooms(current_user["user_id"])

    role = normalize_user_role(current_user.get("role"))
    if classrooms.get("total", 0) == 0 and role in {"teacher", "admin"}:
        await _create_demo_teacher_classroom(db, current_user)
        classrooms = await rbac.get_user_classrooms(current_user["user_id"])

    return classrooms


@router.post("/bootstrap/demo")
async def bootstrap_demo_classroom(current_user = Depends(get_current_user)):
    db = get_db()
    role = normalize_user_role(current_user.get("role"))

    if role not in {"teacher", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can bootstrap demo classrooms")

    classroom_id = await _create_demo_teacher_classroom(db, current_user)
    return {"status": "success", "classroom_id": classroom_id, "message": "Demo classroom is ready"}


from functions.async_generation import background_generate_resources, cancel_active_job
from sse_starlette.sse import EventSourceResponse

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: str, current_user = Depends(get_current_user)):
    db = get_db()
    try:
        job = await db.ai_generation_jobs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job id")
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    return {
        "job_id": job_id,
        "status": job.get("status"),
        "progress": job.get("progress", 0),
        "result": job.get("result"),
        "error": job.get("error"),
        "config": job.get("config", {}),
        "checkpoints": job.get("checkpoints", {}),
        "retry_count": int(job.get("retry_count", 0)),
        "stop_requested": bool(job.get("stop_requested", False)),
    }

@router.get("/jobs/{job_id}/stream")
async def stream_job_status(job_id: str, current_user = Depends(get_current_user)):
    """
    SSE endpoint for real-time job status updates.
    """
    db = get_db()
    async def event_generator():
        while True:
            try:
                job = await db.ai_generation_jobs.find_one({"_id": ObjectId(job_id)})
                if not job:
                    yield {"event": "error", "data": json.dumps({"error": "Job not found"})}
                    break
                
                status = job.get("status")
                yield {
                    "event": "update",
                    "data": json.dumps({
                        "status": status,
                        "progress": job.get("progress", 0),
                        "result": job.get("result") if status == "ready" else None,
                        "config": job.get("config", {}),
                        "retry_count": int(job.get("retry_count", 0)),
                        "stop_requested": bool(job.get("stop_requested", False)),
                    })
                }
                
                if status in ["ready", "failed"]:
                    break
                    
                await asyncio.sleep(1) # Poll every second
            except Exception as e:
                yield {"event": "error", "data": json.dumps({"error": str(e)})}
                break
                
    return EventSourceResponse(event_generator())


async def _user_can_control_job(db, job: dict, current_user: dict) -> bool:
    """Return True if the current_user is allowed to control (stop/retry/config) the job.

    Rules:
    - Admins can control any job
    - Job creator (user_id) can control personal jobs
    - Classroom teacher can control classroom-scoped jobs
    """
    role = normalize_user_role(current_user.get("role"))
    if role == "admin":
        return True

    user_id = str(current_user.get("user_id"))
    job_user = job.get("user_id")
    try:
        if job_user and str(job_user) == user_id:
            return True
    except Exception:
        pass

    classroom_id = job.get("classroom_id")
    if classroom_id:
        rbac = RBACService(db)
        try:
            if await rbac.is_teacher(current_user["user_id"], str(classroom_id)):
                return True
        except Exception:
            pass

    return False


@router.post("/jobs/{job_id}/stop")
async def stop_job(job_id: str, current_user = Depends(get_current_user)):
    db = get_db()
    try:
        job = await db.ai_generation_jobs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job id")

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not await _user_can_control_job(db, job, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to stop this job")

    now = datetime.utcnow()
    await db.ai_generation_jobs.update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {"stop_requested": True, "status": "stopping", "updated_at": now}}
    )

    # Attempt to cancel in-memory running task (best-effort)
    try:
        await cancel_active_job(job_id)
    except Exception:
        pass

    return {"status": "stop_requested", "job_id": job_id}


@router.post("/jobs/{job_id}/retry")
async def retry_job(job_id: str, current_user = Depends(get_current_user)):
    db = get_db()
    try:
        job = await db.ai_generation_jobs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job id")

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not await _user_can_control_job(db, job, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to retry this job")

    # Ensure we have the assessment seed saved on the job. If missing, try to reconstruct it
    assessment_seed = job.get("assessment_seed")
    if not assessment_seed:
        # Try to reconstruct from classroom data (for class-scoped jobs)
        classroom_id = job.get("classroom_id")
        if classroom_id:
            try:
                classroom_doc = await db.classrooms.find_one({"_id": ObjectId(classroom_id)}, {"subject": 1, "subject_focus_areas": 1, "student_expectations": 1})
                if classroom_doc:
                    assessment_seed = _build_assessment_seed(
                        classroom_doc.get("subject", ""),
                        classroom_doc.get("subject_focus_areas", []) or [],
                        classroom_doc.get("student_expectations", "") or "",
                    )
                    # persist reconstructed seed
                    now = datetime.utcnow()
                    await db.ai_generation_jobs.update_one({"_id": ObjectId(job_id)}, {"$set": {"assessment_seed": assessment_seed, "updated_at": now}})
            except Exception:
                assessment_seed = None

        # Fallback: try to reconstruct from user assessment snapshot (for personal jobs)
        if not assessment_seed:
            try:
                user_id = job.get("user_id")
                if user_id and ObjectId.is_valid(user_id):
                    user_oid = ObjectId(user_id)
                    snapshot = await _latest_assessment_snapshot(db, user_oid)
                    if snapshot:
                        assessment_seed = snapshot
                        now = datetime.utcnow()
                        await db.ai_generation_jobs.update_one({"_id": ObjectId(job_id)}, {"$set": {"assessment_seed": assessment_seed, "updated_at": now}})
            except Exception:
                assessment_seed = None

        if not assessment_seed:
            raise HTTPException(status_code=400, detail="Cannot retry: missing job assessment_seed")

    now = datetime.utcnow()
    await db.ai_generation_jobs.update_one(
        {"_id": ObjectId(job_id)},
        {
            "$inc": {"retry_count": 1},
            "$set": {
                "status": "pending",
                "progress": 0,
                "error": None,
                "result": None,
                "stop_requested": False,
                "updated_at": now,
            },
        },
    )

    # Re-schedule background work with the stored parameters
    try:
        classroom_id = str(job.get("classroom_id")) if job.get("classroom_id") else None
        user_id = str(job.get("user_id")) if job.get("user_id") else None
        source = job.get("source", "ai")
        approval_status = job.get("approval_status", "pending")
        asyncio.create_task(
            background_generate_resources(
                job_id=job_id,
                assessment_seed=assessment_seed,
                classroom_id=classroom_id,
                user_id=user_id,
                source=source,
                approval_status=approval_status,
            )
        )
    except Exception as e:
        # If scheduling fails, reflect that in job status
        await db.ai_generation_jobs.update_one({"_id": ObjectId(job_id)}, {"$set": {"status": "failed", "error": str(e), "updated_at": datetime.utcnow()}})
        raise HTTPException(status_code=500, detail=f"Failed to start retry: {e}")

    return {"status": "retry_started", "job_id": job_id}


@router.patch("/jobs/{job_id}/config")
async def update_job_config(job_id: str, payload: dict, current_user = Depends(get_current_user)):
    db = get_db()
    try:
        job = await db.ai_generation_jobs.find_one({"_id": ObjectId(job_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid job id")

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not await _user_can_control_job(db, job, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to update job config")

    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Config payload must be an object")

    allowed = {
        "search_timeout": (int, 5, 3600),
        "poll_interval": (int, 250, 60000),
        "use_sse": (bool, None, None),
        "use_parallel_search": (bool, None, None),
        "max_retries": (int, 0, 10),
        "pace": (float, 0.1, 10.0),
    }

    config_updates = {}
    for key, spec in allowed.items():
        if key in payload:
            val = payload.get(key)
            expected_type = spec[0]
            try:
                # Coerce booleans/numbers conservatively
                if expected_type is bool:
                    coerced = _parse_bool(val)
                elif expected_type is int:
                    coerced = int(val)
                elif expected_type is float:
                    coerced = float(val)
                else:
                    coerced = val
            except Exception:
                raise HTTPException(status_code=400, detail=f"Invalid value for {key}")

            # range checks
            minv, maxv = spec[1], spec[2]
            if minv is not None and coerced < minv:
                raise HTTPException(status_code=400, detail=f"{key} must be >= {minv}")
            if maxv is not None and coerced > maxv:
                raise HTTPException(status_code=400, detail=f"{key} must be <= {maxv}")

            config_updates[key] = coerced

    now = datetime.utcnow()
    await db.ai_generation_jobs.update_one({"_id": ObjectId(job_id)}, {"$set": {"config": config_updates, "updated_at": now}})

    return {"status": "success", "config": config_updates}


async def _extract_syllabus_with_llm(subject: str, description: str, curriculum_excerpt: str = "", limit: int = 8) -> List[str]:
    """
    Use LLM to identify the main modules or chapters from the curriculum PDF text.
    """
    if not curriculum_excerpt or len(curriculum_excerpt.strip()) < 50:
        # Not enough text to use LLM effectively, fall back to heuristic
        return _derive_focus_areas(subject, description, "", curriculum_excerpt, limit)

    prompt = f"""
    You are an expert curriculum architect. Your task is to extract the official module or chapter titles from a syllabus or curriculum document.

    Subject: {subject}
    Classroom Description: {description}

    Curriculum Document Excerpt:
    ---
    {curriculum_excerpt[:8000]}
    ---

    Task:
    1. Identify the main modules, units, or chapters that define the core structure of this course.
    2. Extract their EXACT names as they appear in the document where possible.
    3. Return a clean JSON list of strings representing these module names.
    4. Limit the result to a maximum of {limit} modules.
    5. Do not include introductory or conclusion chapters unless they contain specific technical topics.

    Response format:
    ["Module 1: Title", "Module 2: Title", ...]
    """

    try:
        model = genai.GenerativeModelAsync()
        response = await model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean up JSON if it's wrapped in markdown code blocks
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            # Fallback for generic code blocks
            lines = text.split("\n")
            if lines[0].startswith("```"):
                text = "\n".join(lines[1:-1]).strip()
            
        modules = json.loads(text)
        if isinstance(modules, list) and len(modules) > 0:
            return [str(m).strip() for m in modules[:limit]]
    except Exception as e:
        print(f"LLM syllabus extraction failed: {e}")
    
    # Fallback to heuristic
    return _derive_focus_areas(subject, description, "", curriculum_excerpt, limit)


@router.post("/create")
async def create_classroom(request: Request, current_user = Depends(get_current_user)):
    db = get_db()
    role = normalize_user_role(current_user.get("role"))
    if role not in {"teacher", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can create classrooms")

    classroom_data, curriculum_pdf = await _parse_create_classroom_request(request)

    classroom_name = (classroom_data.get("name") or "").strip()
    subject = (classroom_data.get("subject") or "").strip()
    grade_level = (classroom_data.get("grade_level") or "").strip()
    description = (classroom_data.get("description") or "").strip()
    subject_description = (classroom_data.get("subject_description") or "").strip()
    student_expectations = (classroom_data.get("student_expectations") or "").strip()
    require_approval = _parse_bool(classroom_data.get("require_approval"))

    if not classroom_name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Classroom name is required")
    if not subject:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Classroom subject is required")
    if not grade_level:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Grade level is required")
    if not subject_description:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Subject description is required")
    if not student_expectations:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student expectations are required")
    if curriculum_pdf is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a subject PDF (max 10 pages) to create a classroom",
        )

    filename = (curriculum_pdf.filename or "").strip()
    if filename and not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF curriculum files are supported")

    pdf_bytes = await curriculum_pdf.read()
    if len(pdf_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Curriculum PDF must be 10MB or smaller")

    curriculum_excerpt, page_count = _extract_pdf_excerpt_and_page_count(pdf_bytes, max_pages=10)
    if not _subject_matches_pdf_excerpt(subject, curriculum_excerpt):
        raise HTTPException(
            status_code=400,
            detail="Uploaded PDF does not appear to match the classroom subject",
        )

    teacher_oid = ObjectId(current_user["user_id"])
    duplicate_subject = await db.classrooms.find_one({
        "teacher_id": teacher_oid,
        "subject": {"$regex": _subject_regex(subject), "$options": "i"},
    })
    if duplicate_subject:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This teacher already has a classroom with the same subject",
        )

    enrollment_code = secrets.token_urlsafe(8)
    
    # NEW: Enhanced syllabus extraction using LLM
    focus_areas = await _extract_syllabus_with_llm(
        subject,
        subject_description,
        curriculum_excerpt=curriculum_excerpt,
    )
    
    assessment_seed = _build_assessment_seed(subject, focus_areas, student_expectations)
    
    # Phase 5: Async Generation start
    job_res = await db.ai_generation_jobs.insert_one({
        "type": "classroom_generation",
        "status": "pending",
        "progress": 0,
        "created_at": datetime.utcnow(),
        "user_id": teacher_oid
    })
    job_id = str(job_res.inserted_id)

    curriculum_metadata = {
        "filename": filename or "curriculum.pdf",
        "content_type": curriculum_pdf.content_type,
        "size_bytes": len(pdf_bytes),
        "page_count": page_count,
        "uploaded_at": datetime.utcnow(),
        "text_excerpt": curriculum_excerpt[:4000],
        "curriculum_pdf_binary": Binary(pdf_bytes),
    }

    classroom = {
        "institution_id": current_user.get("institution_id"),
        "name": classroom_name,
        "subject": subject,
        "grade_level": grade_level,
        "description": description or subject_description,
        "subject_description": subject_description,
        "student_expectations": student_expectations,
        "subject_focus_areas": focus_areas,
        "teacher_id": teacher_oid,
        "co_teachers": [],
        "students": [],
        "student_groups": [],
        "status": "active",
        "start_date": datetime.utcnow(),
        "end_date": None,
        "enrollment_code": enrollment_code,
        "require_approval": require_approval,
        "curriculum_metadata": curriculum_metadata,
        "ai_resources": [], # Initially empty, filled by background task
        "resource_generation_meta": {
            "job_id": job_id,
            "status": "pending",
            "source": "teacher_classroom_setup",
            "assessment_signature": _assessment_signature(assessment_seed),
        },
        "created_date": datetime.utcnow(),
        "updated_date": datetime.utcnow(),
    }

    result = await db.classrooms.insert_one(classroom)
    classroom_id = str(result.inserted_id)

    # Persist job metadata so it can be retried/controlled later
    try:
        await db.ai_generation_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {
                "assessment_seed": assessment_seed,
                "classroom_id": classroom_id,
                "source": "class_ai",
                "approval_status": "pending",
                "updated_at": datetime.utcnow(),
            }}
        )
    except Exception:
        pass

    # Start background task
    asyncio.create_task(background_generate_resources(
        job_id=job_id,
        assessment_seed=assessment_seed,
        classroom_id=classroom_id,
        source="class_ai",
        approval_status="pending"
    ))

    await _ensure_user_membership(db, teacher_oid, classroom_id, "teacher")

    # Update user's onboarding and assessment status
    await db.users.update_one(
        {"_id": teacher_oid},
        {
            "$set": {
                "onboarding_complete": True,
                "assessment_complete": True,
                "updated_date": datetime.utcnow(),
            }
        },
    )

    module_service = LearningModuleService(db)
    seeded_modules = []
    # Seed modules based on focus areas immediately
    for module_name in focus_areas:
        seed_result = await module_service.create_module(
            classroom_id=classroom_id,
            name=module_name,
            description=f"AI-seeded module for {module_name}.",
            status="published",
        )
        if seed_result.get("status") != "success":
            continue

        module_payload = seed_result.get("module") or {}
        seeded_modules.append(
            {
                "module_id": module_payload.get("module_id"),
                "name": module_payload.get("name", module_name),
            }
        )

    return {
        "classroom_id": classroom_id,
        "enrollment_code": enrollment_code,
        "job_id": job_id,
        "status": "generation_started",
        "subject_focus_areas": focus_areas,
        "module_summary": {
            "seeded": len(seeded_modules),
        },
        "module_preview": seeded_modules[:6],
    }


@router.get("/{classroom_id}/resources")
async def get_classroom_resources(
    classroom_id: str,
    mode: str = Query("class"),
    current_user = Depends(get_current_user),
):
    db = get_db()
    rbac = RBACService(db)

    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this classroom")

    normalized_mode = (mode or "class").strip().lower()
    if normalized_mode not in {"class", "personal"}:
        raise HTTPException(status_code=400, detail="mode must be either 'class' or 'personal'")

    try:
        classroom_oid = ObjectId(classroom_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom id")

    classroom = await db.classrooms.find_one(
        {"_id": classroom_oid},
        {
            "name": 1,
            "subject": 1,
            "subject_focus_areas": 1,
            "ai_resources": 1,
            "resource_generation_meta": 1,
        },
    )
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if normalized_mode == "class":
        role = normalize_user_role(current_user.get("role"))
        can_manage = role == "admin" or await rbac.is_teacher(current_user["user_id"], classroom_id)

        # Check for active job
        meta = classroom.get("resource_generation_meta") or {}
        job_id = meta.get("job_id")
        if job_id and isinstance(job_id, str) and len(job_id) == 24:
            try:
                job = await db.ai_generation_jobs.find_one({"_id": ObjectId(job_id)})
                if job and job.get("status") in ["pending", "planning", "searching", "filtering"]:
                    return {
                        "status": "generation_in_progress",
                        "mode": "class",
                        "job_id": job_id,
                        "message": "Resource generation is in progress for this classroom."
                    }
            except Exception:
                pass

        resources = [item for item in classroom.get("ai_resources", []) if isinstance(item, dict)]
        if not can_manage:
            resources = [item for item in resources if item.get("approval_status") == "approved"]

        try:
            asyncio.create_task(_update_thumbnails_for_classroom(db, classroom_oid, resources))
        except Exception:
            pass

        return {
            "status": "success",
            "mode": "class",
            "classroom_id": classroom_id,
            "classroom_name": classroom.get("name"),
            "subject": classroom.get("subject"),
            "focus_areas": classroom.get("subject_focus_areas", []),
            "summary": _resource_counts(resources),
            "resources": [_serialize_resource(item) for item in resources],
            "job_id": None,
            "generation_status": None,
            "cached": True,
        }

    user_oid = ObjectId(current_user["user_id"])
    assessment_snapshot = await _latest_assessment_snapshot(db, user_oid)
    if not assessment_snapshot:
        return {
            "status": "success",
            "mode": "personal",
            "classroom_id": classroom_id,
            "classroom_name": classroom.get("name"),
            "summary": {"total": 0, "approved": 0, "pending": 0, "rejected": 0},
            "resources": [],
            "cached": True,
            "message": "Complete a skill assessment to unlock personal AI recommendations.",
        }

    signature = _assessment_signature(assessment_snapshot)
    cached_doc = await db.generated_personal_resources.find_one(
        {
            "user_id": user_oid,
            "assessment_signature": signature,
        },
        sort=[("updated_at", -1)],
    )
    if cached_doc and isinstance(cached_doc.get("resources"), list):
        cached_resources = [item for item in cached_doc.get("resources", []) if isinstance(item, dict)]
        try:
            asyncio.create_task(_update_thumbnails_for_generated_personal_resources(db, user_oid, signature, cached_resources))
        except Exception:
            pass

        return {
            "status": "success",
            "mode": "personal",
            "classroom_id": classroom_id,
            "classroom_name": classroom.get("name"),
            "summary": _resource_counts(cached_resources),
            "resources": [_serialize_resource(item) for item in cached_resources],
            "cached": True,
        }

    # Check if a job is already running for this user/signature
    existing_job = await db.ai_generation_jobs.find_one({
        "user_id": user_oid,
        "signature": signature,
        "status": {"$in": ["pending", "planning", "searching", "filtering"]}
    })
    if existing_job:
        return {
            "status": "generation_in_progress",
            "mode": "personal",
            "job_id": str(existing_job["_id"]),
            "message": "Personal recommendations are being generated."
        }

    # Start new async generation job
    job_res = await db.ai_generation_jobs.insert_one({
        "type": "personal_generation",
        "user_id": user_oid,
        "signature": signature,
        "assessment_seed": assessment_snapshot,
        "source": "personal_ai",
        "approval_status": "approved",
        "status": "pending",
        "progress": 0,
        "created_at": datetime.utcnow()
    })
    job_id = str(job_res.inserted_id)

    asyncio.create_task(background_generate_resources(
        job_id=job_id,
        assessment_seed=assessment_snapshot,
        user_id=str(user_oid),
        source="personal_ai",
        approval_status="approved"
    ))

    return {
        "status": "generation_started",
        "mode": "personal",
        "classroom_id": classroom_id,
        "job_id": job_id,
        "message": "Generating personalized recommendations...",
        "cached": False,
    }


@router.get("/{classroom_id}/activity-feed")
async def get_classroom_activity_feed(
    classroom_id: str,
    limit: int = Query(10, ge=1, le=100),
    current_user=Depends(get_current_user),
):
    db = get_db()
    rbac = RBACService(db)

    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this classroom")

    try:
        classroom_oid = ObjectId(classroom_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom id")

    entries = await db.activity_feed.find(
        {"classroom_id": {"$in": [classroom_id, classroom_oid]}}
    ).sort("created_at", -1).limit(limit).to_list(None)

    user_ids = {
        str(item.get("student_id"))
        for item in entries
        if item.get("student_id") is not None
    }
    user_ids.update(
        {
            str(item.get("action_performed_by_id"))
            for item in entries
            if item.get("action_performed_by_id") is not None
        }
    )

    name_lookup: Dict[str, str] = {}
    if user_ids:
        try:
            user_oids = [ObjectId(uid) for uid in user_ids if ObjectId.is_valid(uid)]
            # Fetch all fields needed for robust name resolution
            users = await db.users.find(
                {"_id": {"$in": user_oids}},
                {"name": 1, "first_name": 1, "last_name": 1, "profile": 1, "email": 1}
            ).to_list(None)
            for user in users:
                name_lookup[str(user["_id"])] = get_user_display_name(user)
        except Exception:
            pass

    serialized = []
    for entry in entries:
        student_id = str(entry.get("student_id") or "")
        actor_id = str(entry.get("action_performed_by_id") or "")
        created_at = entry.get("created_at")
        serialized.append(
            {
                "id": str(entry.get("_id")),
                "action_type": entry.get("action_type"),
                "student_id": student_id,
                "student_name": name_lookup.get(student_id, "Unknown"),
                "action_performed_by_id": actor_id,
                "action_performed_by_name": name_lookup.get(actor_id, "Unknown"),
                "resource_id": entry.get("resource_id"),
                "module_id": entry.get("module_id"),
                "assessment_id": entry.get("assessment_id"),
                "details": entry.get("details", {}),
                "created_at": created_at.isoformat() if isinstance(created_at, datetime) else created_at,
            }
        )

    return {
        "status": "success",
        "items": serialized,
    }


@router.get("/{classroom_id}/pending-grading-count")
async def get_pending_grading_count(
    classroom_id: str,
    current_user=Depends(get_current_user),
):
    db = get_db()
    rbac = RBACService(db)
    role = normalize_user_role(current_user.get("role"))

    if role not in {"teacher", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can access pending grading counts")

    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this classroom")

    try:
        classroom_oid = ObjectId(classroom_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom id")

    # Count standard submissions
    pending_standard = await db.assessment_submissions.count_documents(
        {
            "classroom_id": {"$in": [classroom_id, classroom_oid]},
            "grading_status": "pending_manual_grade",
        }
    )

    # Count workflow submissions
    pending_workflow = await db.module_assessment_workflow_submissions.count_documents(
        {
            "classroom_id": {"$in": [classroom_id, classroom_oid]},
            "grading_status": "pending_teacher_review",
        }
    )

    return {
        "status": "success",
        "pending_count": int(pending_standard + pending_workflow),
    }


@router.patch("/{classroom_id}/resources/{resource_id}/approval")
async def update_resource_approval(
    classroom_id: str,
    resource_id: str,
    payload: ResourceApprovalRequest,
    current_user = Depends(get_current_user),
):
    db = get_db()
    rbac = RBACService(db)
    role = normalize_user_role(current_user.get("role"))
    if role not in {"teacher", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can approve classroom resources")

    try:
        classroom_oid = ObjectId(classroom_id)
        user_oid = ObjectId(current_user["user_id"])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom id")

    classroom = await db.classrooms.find_one({"_id": classroom_oid}, {"teacher_id": 1, "ai_resources": 1})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # Allow primary teacher, co-teachers, or admins to approve resources
    if role != "admin" and not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the classroom teacher can approve resources")

    approval_status = "approved" if payload.approved else "rejected"
    now = datetime.utcnow()

    update_result = await db.classrooms.update_one(
        {
            "_id": classroom_oid,
            "ai_resources.resource_id": resource_id,
        },
        {
            "$set": {
                "ai_resources.$.approval_status": approval_status,
                "ai_resources.$.approved_by": str(current_user["user_id"]) if payload.approved else None,
                "ai_resources.$.approved_date": now if payload.approved else None,
                "ai_resources.$.updated_date": now,
                "updated_date": now,
            }
        },
    )

    if update_result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Resource not found in classroom")

    refreshed = await db.classrooms.find_one({"_id": classroom_oid}, {"ai_resources": 1}) or {}
    resources = [item for item in refreshed.get("ai_resources", []) if isinstance(item, dict)]

    return {
        "status": "success",
        "classroom_id": classroom_id,
        "resource_id": resource_id,
        "approval_status": approval_status,
        "summary": _resource_counts(resources),
    }


@router.post("/{classroom_id}/resources/manual")
async def add_manual_resource(
    classroom_id: str,
    payload: ManualResourceRequest,
    current_user = Depends(get_current_user),
):
    db = get_db()
    rbac = RBACService(db)
    role = normalize_user_role(current_user.get("role"))
    
    if role not in {"teacher", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can add resources manually")

    try:
        classroom_oid = ObjectId(classroom_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom id")

    if role != "admin" and not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the classroom teacher can add resources")

    now = datetime.utcnow()
    resource_id = secrets.token_hex(12)
    
    # Deriving thumbnail for youtube if possible
    thumb = None
    if payload.resource_type == "youtube":
        vid = extract_video_id(payload.url)
        if vid:
            thumb = f"https://img.youtube.com/vi/{vid}/maxresdefault.jpg"

    new_resource = {
        "resource_id": resource_id,
        "title": payload.title,
        "description": f"Manually added {payload.resource_type} resource.",
        "url": _normalize_url(payload.url),
        "resource_type": payload.resource_type,
        "skill": payload.skill or "General",
        "thumbnail_url": thumb,
        "source": "teacher_manual",
        "approval_status": "approved",  # Manually added by teacher, so auto-approve
        "created_date": now,
        "updated_date": now,
        "approved_date": now,
        "approved_by": str(current_user["user_id"]),
    }

    await db.classrooms.update_one(
        {"_id": classroom_oid},
        {"$push": {"ai_resources": new_resource}, "$set": {"updated_date": now}}
    )

    return {
        "status": "success",
        "message": "Resource added successfully",
        "resource": _serialize_resource(new_resource)
    }


@router.post("/{classroom_id}/resources/generate")
async def generate_classroom_resources(
    classroom_id: str, 
    force: bool = Query(False), 
    curriculum_pdf: Optional[UploadFile] = None,
    current_user = Depends(get_current_user)
):
    """
    Start an async AI discovery job for a classroom's resources.
    If curriculum_pdf is provided, it updates the stored syllabus.
    If not, it attempts to use the stored syllabus.
    """
    db = get_db()
    rbac = RBACService(db)
    role = normalize_user_role(current_user.get("role"))

    if role not in {"teacher", "admin"} and not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teachers can start resource discovery")

    try:
        classroom_oid = ObjectId(classroom_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom id")

    classroom = await db.classrooms.find_one({"_id": classroom_oid})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # 1. Check for active job
    meta = classroom.get("resource_generation_meta") or {}
    existing_job_id = meta.get("job_id")
    if existing_job_id and not force and not curriculum_pdf:
        job = await db.ai_generation_jobs.find_one({"_id": ObjectId(existing_job_id)})
        if job and job.get("status") in ["pending", "planning", "searching", "filtering"]:
            return {
                "status": "generation_in_progress",
                "job_id": existing_job_id,
                "message": "Resource generation is already in progress."
            }

    # 2. Syllabus Logic
    pdf_bytes = None
    if curriculum_pdf:
        filename = (curriculum_pdf.filename or "").strip()
        if not filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF curriculum files are supported")
        pdf_bytes = await curriculum_pdf.read()
        if len(pdf_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Curriculum PDF must be 10MB or smaller")
    else:
        # Try to use stored PDF
        curr_meta = classroom.get("curriculum_metadata") or {}
        pdf_bytes = curr_meta.get("curriculum_pdf_binary")
        if pdf_bytes and isinstance(pdf_bytes, bytes):
            pass # Use as is
        elif pdf_bytes: # Handle BSON Binary
            pdf_bytes = bytes(pdf_bytes)

    if not pdf_bytes:
        return {
            "status": "syllabus_missing",
            "message": "Curriculum PDF is not present. Please upload the syllabus to regenerate."
        }

    # 3. Process Syllabus (New or Stored)
    curriculum_excerpt, page_count = _extract_pdf_excerpt_and_page_count(pdf_bytes, max_pages=10)
    
    # Optional: Re-extract focus areas if new PDF or force
    focus_areas = classroom.get("subject_focus_areas", [])
    if curriculum_pdf or not focus_areas or force:
        focus_areas = await _extract_syllabus_with_llm(
            classroom.get("subject", ""),
            classroom.get("description", ""),
            curriculum_excerpt=curriculum_excerpt
        )
        # Update classroom with new syllabus data if it changed
        if curriculum_pdf:
            new_meta = {
                "filename": curriculum_pdf.filename or "curriculum.pdf",
                "content_type": curriculum_pdf.content_type,
                "size_bytes": len(pdf_bytes),
                "page_count": page_count,
                "uploaded_at": datetime.utcnow(),
                "text_excerpt": curriculum_excerpt[:4000],
                "curriculum_pdf_binary": Binary(pdf_bytes),
            }
            await db.classrooms.update_one(
                {"_id": classroom_oid},
                {"$set": {"curriculum_metadata": new_meta, "subject_focus_areas": focus_areas, "updated_date": datetime.utcnow()}}
            )
        elif not classroom.get("subject_focus_areas"):
             await db.classrooms.update_one(
                {"_id": classroom_oid},
                {"$set": {"subject_focus_areas": focus_areas, "updated_date": datetime.utcnow()}}
            )

    # 4. Build assessment seed and start job
    assessment_seed = _build_assessment_seed(
        classroom.get("subject", ""),
        focus_areas,
        classroom.get("student_expectations", "") or "",
    )

    now = datetime.utcnow()
    job_doc = {
        "type": "class_generation",
        "classroom_id": classroom_id,
        "assessment_seed": assessment_seed,
        "source": "class_ai",
        "approval_status": "pending",
        "status": "pending",
        "progress": 0,
        "created_at": now,
        "updated_at": now,
    }

    res = await db.ai_generation_jobs.insert_one(job_doc)
    job_id = str(res.inserted_id)

    # Link job to classroom meta
    await db.classrooms.update_one(
        {"_id": classroom_oid},
        {"$set": {"resource_generation_meta.job_id": job_id, "resource_generation_meta.status": "pending", "updated_date": now}}
    )

    asyncio.create_task(
        background_generate_resources(
            job_id=job_id,
            assessment_seed=assessment_seed,
            classroom_id=classroom_id,
            source="class_ai",
            approval_status="pending",
            force_refresh=True # Regeneration implies fresh search
        )
    )

    return {
        "status": "generation_started",
        "classroom_id": classroom_id,
        "job_id": job_id,
        "message": "Resource discovery (regeneration) started."
    }

    return {"status": "generation_started", "job_id": job_id, "message": "Classroom resource discovery started"}


@router.get("/{classroom_id}")
@cache_response(ttl=600, key_prefix="classroom")
async def get_classroom(classroom_id: str, current_user = Depends(get_current_user)):
    db = get_db()
    rbac = RBACService(db)
    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this classroom")

    try:
        classroom = await db.classrooms.find_one(
            {"_id": ObjectId(classroom_id)},
            {"curriculum_metadata.curriculum_pdf_binary": 0}
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # serialize ids to strings
    classroom["_id"] = str(classroom["_id"])
    classroom["teacher_id"] = str(classroom["teacher_id"]) if classroom.get("teacher_id") else None
    classroom["institution_id"] = str(classroom["institution_id"]) if classroom.get("institution_id") else None
    classroom["students"] = [str(s) for s in classroom.get("students", [])]
    classroom["co_teachers"] = [str(t) for t in classroom.get("co_teachers", [])]

    for group in classroom.get("student_groups", []):
        if "_id" in group:
            group["id"] = str(group.pop("_id"))
        elif "id" in group and group["id"]:
            group["id"] = str(group["id"])
        group["students"] = [str(s) for s in group.get("students", [])]

    return classroom


@router.get("/find")
async def find_classroom_by_code(code: str):
    """Find a classroom by enrollment code. Returns basic info if found."""
    db = get_db()
    trimmed_code = str(code or "").strip()
    if not trimmed_code:
        raise HTTPException(status_code=400, detail="Enrollment code is required")

    classroom = await db.classrooms.find_one(
        {
            "enrollment_code": {
                "$regex": f"^{re.escape(trimmed_code)}$",
                "$options": "i",
            }
        }
    )
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    return {
        "classroom_id": str(classroom["_id"]),
        "name": classroom.get("name"),
        "subject": classroom.get("subject"),
        "grade_level": classroom.get("grade_level")
    }


@router.post("/{classroom_id}/join")
async def join_classroom(classroom_id: str, enrollment_code: str, current_user = Depends(get_current_user)):
    db = get_db()
    try:
        classroom = await db.classrooms.find_one({"_id": ObjectId(classroom_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    stored_code = _normalize_enrollment_code(classroom.get("enrollment_code"))
    supplied_code = _normalize_enrollment_code(enrollment_code)
    if stored_code != supplied_code:
        raise HTTPException(status_code=404, detail="Classroom not found or invalid code")

    user_id = str(current_user["user_id"])
    user_oid = ObjectId(user_id)
    normalized_role = normalize_user_role(current_user.get("role"))

    is_primary_teacher = user_oid == classroom.get("teacher_id")
    is_co_teacher = user_id in classroom.get("co_teachers", [])
    is_student = user_oid in classroom.get("students", [])

    if is_primary_teacher:
        raise HTTPException(status_code=400, detail="You already own this classroom")

    # Teachers/admins joining another teacher's classroom become co-teachers.
    join_as_co_teacher = normalized_role in {"teacher", "admin"}
    membership_role = "teacher" if join_as_co_teacher else "student"

    if join_as_co_teacher:
        if is_co_teacher:
            raise HTTPException(status_code=400, detail="Already a co-teacher")

        await db.classrooms.update_one(
            {"_id": ObjectId(classroom_id)},
            {
                "$addToSet": {"co_teachers": user_id},
                "$pull": {"students": user_oid},
            },
        )
    else:
        if is_student:
            raise HTTPException(status_code=400, detail="Already a member")

        await db.classrooms.update_one(
            {"_id": ObjectId(classroom_id)},
            {"$addToSet": {"students": user_oid}},
        )

    user_doc = await db.users.find_one({"_id": user_oid}, {"classroom_memberships": 1}) or {}
    memberships = user_doc.get("classroom_memberships", [])
    if not isinstance(memberships, list):
        await db.users.update_one({"_id": user_oid}, {"$set": {"classroom_memberships": []}})
        memberships = []

    membership_index = next(
        (
            idx
            for idx, membership in enumerate(memberships)
            if isinstance(membership, dict) and str(membership.get("classroom_id")) == classroom_id
        ),
        -1,
    )

    if membership_index >= 0:
        memberships[membership_index]["role"] = membership_role
        memberships[membership_index]["is_active"] = True
        if not memberships[membership_index].get("joined_date"):
            memberships[membership_index]["joined_date"] = datetime.utcnow()
        await db.users.update_one({"_id": user_oid}, {"$set": {"classroom_memberships": memberships}})
    else:
        await db.users.update_one(
            {"_id": user_oid},
            {
                "$push": {
                    "classroom_memberships": {
                        "classroom_id": classroom_id,
                        "role": membership_role,
                        "joined_date": datetime.utcnow(),
                        "is_active": True,
                    }
                }
            },
        )

    return {
        "classroom_id": classroom_id,
        "joined_role": membership_role,
        "message": "Joined as co-teacher" if join_as_co_teacher else "Joined as student",
    }


@router.put("/{classroom_id}")
async def update_classroom(classroom_id: str, update_data: dict, current_user = Depends(get_current_user)):
    db = get_db()
    rbac = RBACService(db)
    try:
        classroom_oid = ObjectId(classroom_id)
        teacher_oid = ObjectId(current_user["user_id"])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom id")

    classroom = await db.classrooms.find_one({"_id": classroom_oid})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # Allow primary teacher or co-teachers to update classroom
    if not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only teacher can update class")

    allowed = [
        "name",
        "description",
        "subject",
        "grade_level",
        "require_approval",
        "subject_description",
        "student_expectations",
    ]
    update = {k: v for k, v in update_data.items() if k in allowed}

    if "name" in update:
        update["name"] = str(update["name"] or "").strip()
        if not update["name"]:
            raise HTTPException(status_code=400, detail="Classroom name is required")

    if "description" in update:
        update["description"] = str(update["description"] or "").strip()

    if "grade_level" in update:
        update["grade_level"] = str(update["grade_level"] or "").strip()

    if "require_approval" in update:
        update["require_approval"] = _parse_bool(update.get("require_approval"))

    if "subject_description" in update:
        update["subject_description"] = str(update["subject_description"] or "").strip()

    if "student_expectations" in update:
        update["student_expectations"] = str(update["student_expectations"] or "").strip()

    if "subject" in update:
        update["subject"] = str(update["subject"] or "").strip()
        if not update["subject"]:
            raise HTTPException(status_code=400, detail="Classroom subject is required")

        duplicate_subject = await db.classrooms.find_one({
            "_id": {"$ne": classroom_oid},
            "teacher_id": teacher_oid,
            "subject": {"$regex": _subject_regex(update["subject"]), "$options": "i"},
        })
        if duplicate_subject:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This teacher already has a classroom with the same subject",
            )

    update["updated_date"] = datetime.utcnow()

    result = await db.classrooms.update_one({"_id": classroom_oid}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Classroom not found")
    return {"message": "Updated"}


# ========================= LEARNING MODULES ROUTES =========================

@router.post("/{classroom_id}/modules/generate")
async def auto_generate_modules_from_resources(
    classroom_id: str,
    force_regenerate: bool = Query(False),
    current_user = Depends(get_current_user),
):
    """
    Auto-generates learning modules from approved classroom resources.
    Groups resources by skill and creates a module for each skill group.
    
    Query Parameters:
        - force_regenerate: If True, regenerates existing modules (default: False)
    
    Returns:
        Dictionary with generated modules and statistics
    """
    db = get_db()
    rbac = RBACService(db)
    role = normalize_user_role(current_user.get("role"))
    
    # Only teachers and admins can generate modules
    if role not in {"teacher", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can generate modules"
        )
    
    # Check if user is the classroom teacher or admin
    if role == "teacher" and not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the classroom teacher can generate modules"
        )
    
    try:
        classroom_oid = ObjectId(classroom_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom id")
    
    module_service = LearningModuleService(db)
    result = await module_service.auto_generate_modules_from_resources(
        classroom_id,
        force_regenerate=force_regenerate
    )
    
    return {
        "status": result.get("status"),
        "message": result.get("message"),
        "modules_created": result.get("modules_created", 0),
        "modules_updated": result.get("modules_updated", 0),
        "modules_processed": result.get("modules_processed", 0),
        "modules": result.get("modules", [])
    }


@router.get("/{classroom_id}/modules")
@cache_response(ttl=300, key_prefix="modules")
async def get_classroom_modules(
    classroom_id: str,
    status_filter: Optional[str] = Query(None),
    include_progress: bool = Query(False),
    current_user = Depends(get_current_user),
):
    """
    Retrieves all modules for a classroom.
    
    Query Parameters:
        - status_filter: Filter by module status (draft, published, archived)
        - include_progress: Include student progress (only for student user)
    
    Returns:
        Dictionary with modules list
    """
    db = get_db()
    rbac = RBACService(db)
    
    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom"
        )
    
    try:
        classroom_oid = ObjectId(classroom_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom id")
    
    module_service = LearningModuleService(db)
    
    # Include progress for students viewing their own progress
    show_progress = include_progress and current_user.get("role", "").lower() == "student"
    
    result = await module_service.get_classroom_modules(
        classroom_id,
        status_filter=status_filter,
        include_progress=show_progress,
        student_id=current_user["user_id"] if show_progress else None
    )
    
    return result


@router.post("/{classroom_id}/modules")
async def create_learning_module(
    classroom_id: str,
    payload: ModuleCreateRequest,
    current_user=Depends(get_current_user),
):
    """Creates a manual module in the classroom."""
    db = get_db()
    rbac = RBACService(db)
    role = normalize_user_role(current_user.get("role"))

    if role not in {"teacher", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can create modules",
        )

    if role == "teacher" and not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the classroom teacher can create modules",
        )

    module_service = LearningModuleService(db)
    result = await module_service.create_module(
        classroom_id=classroom_id,
        name=payload.name,
        description=payload.description or "",
        status=payload.status or "published",
    )

    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to create module"))

    return result


@router.patch("/{classroom_id}/modules/reorder")
async def reorder_classroom_modules(
    classroom_id: str,
    payload: ModuleReorderRequest,
    current_user=Depends(get_current_user),
):
    """Reorders modules using a full ordered module ID list."""
    db = get_db()
    rbac = RBACService(db)
    role = normalize_user_role(current_user.get("role"))

    if role not in {"teacher", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can reorder modules",
        )

    if role == "teacher" and not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the classroom teacher can reorder modules",
        )

    module_service = LearningModuleService(db)
    result = await module_service.reorder_modules(classroom_id, payload.module_ids)

    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to reorder modules"))

    return result


@router.get("/{classroom_id}/modules/approved-resources")
async def get_approved_resources_for_module_assignment(
    classroom_id: str,
    current_user=Depends(get_current_user),
):
    """Lists approved classroom resources grouped for module assignment."""
    db = get_db()
    rbac = RBACService(db)

    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom",
        )

    module_service = LearningModuleService(db)
    result = await module_service.get_approved_resources_for_module_assignment(classroom_id)

    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to load resources"))

    return result


@router.post("/{classroom_id}/modules/{module_id}/resources/assign")
async def assign_resources_to_module(
    classroom_id: str,
    module_id: str,
    payload: ModuleResourceAssignmentRequest,
    current_user=Depends(get_current_user),
):
    """Assigns approved resources into a module."""
    db = get_db()
    rbac = RBACService(db)
    role = normalize_user_role(current_user.get("role"))

    if role not in {"teacher", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can assign resources to modules",
        )

    if role == "teacher" and not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the classroom teacher can assign resources",
        )

    module_service = LearningModuleService(db)
    result = await module_service.add_resources_to_module(
        classroom_id=classroom_id,
        module_id=module_id,
        resource_ids=payload.resource_ids,
    )

    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to assign resources"))

    return result


@router.delete("/{classroom_id}/modules/{module_id}/resources/{resource_id}")
async def remove_resource_from_module(
    classroom_id: str,
    module_id: str,
    resource_id: str,
    current_user=Depends(get_current_user),
):
    """Removes a resource from a learning module."""
    db = get_db()
    rbac = RBACService(db)
    role = normalize_user_role(current_user.get("role"))

    if role not in {"teacher", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can remove resources from modules",
        )

    if role == "teacher" and not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the classroom teacher can remove resources",
        )

    module_service = LearningModuleService(db)
    result = await module_service.remove_resource_from_module(
        classroom_id=classroom_id,
        module_id=module_id,
        resource_id=resource_id,
    )

    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to remove resource"))

    return result


@router.get("/{classroom_id}/modules/{module_id}")
@cache_response(ttl=300, key_prefix="module_detail")
async def get_module_details(
    classroom_id: str,
    module_id: str,
    current_user = Depends(get_current_user),
):
    """
    Retrieves details of a specific module including resources and learning objectives.
    
    Returns:
        Dictionary with module details
    """
    db = get_db()
    rbac = RBACService(db)
    
    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom"
        )
    
    try:
        classroom_oid = ObjectId(classroom_id)
        module_oid = ObjectId(module_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom or module id")
    
    module = await db.learning_modules.find_one({
        "_id": module_oid,
        "classroom_id": classroom_oid
    })
    
    if not module:
        raise HTTPException(status_code=404, detail="Module not found in this classroom")
    
    # Convert to serializable format
    module_dict = {
        "module_id": str(module["_id"]),
        "classroom_id": str(module["classroom_id"]),
        "name": module.get("name"),
        "subject": module.get("subject"),
        "description": module.get("description"),
        "order": module.get("order"),
        "status": module.get("status"),
        "objectives": module.get("objectives", []),
        "resources": module.get("resources", []),
        "assessments": module.get("assessments", []),
        "estimated_hours": module.get("estimated_hours", 0),
        "difficulty_level": module.get("difficulty_level", "medium"),
        "target_skills": module.get("target_skills", []),
        "created_date": module.get("created_date"),
        "updated_date": module.get("updated_date"),
        "published_date": module.get("published_date")
    }
    
    return {
        "status": "success",
        "module": module_dict
    }


@router.get("/{classroom_id}/modules/{module_id}/progress")
async def get_module_progress(
    classroom_id: str,
    module_id: str,
    student_id: Optional[str] = Query(None),
    current_user = Depends(get_current_user),
):
    """
    Retrieves student progress on a specific module.
    
    Query Parameters:
        - student_id: Optional. If provided and user is teacher/admin, get progress for that student.
                      Otherwise, defaults to current user.
    
    Returns:
        Dictionary with module progress information
    """
    db = get_db()
    rbac = RBACService(db)
    role = normalize_user_role(current_user.get("role"))
    
    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom"
        )
    
    try:
        classroom_oid = ObjectId(classroom_id)
        module_oid = ObjectId(module_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom or module id")
    
    # Determine which student's progress to fetch
    target_student_id = student_id
    if not target_student_id:
        target_student_id = current_user["user_id"]
    elif role not in {"teacher", "admin"}:
        # Non-teachers can only view their own progress
        if target_student_id != current_user["user_id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Can only view your own progress"
            )
    
    try:
        target_student_oid = ObjectId(target_student_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid student id")
    
    module_service = LearningModuleService(db)
    progress = await module_service.get_module_progress(target_student_oid, module_oid)
    
    return {
        "status": "success",
        "progress": progress
    }


@router.post("/{classroom_id}/modules/{module_id}/resources/{resource_id}/engagement")
async def track_resource_engagement(
    classroom_id: str,
    module_id: str,
    resource_id: str,
    engagement_data: ResourceEngagementRequest,
    current_user = Depends(get_current_user),
):
    """
    Tracks student engagement with a specific resource within a module.
    
    Request Body:
        - viewed: Whether the resource was viewed
        - view_duration_seconds: How long the resource was viewed (in seconds)
        - completion_percentage: Percentage of resource completed (0-100)
        - test_score: Score on any test/quiz associated with the resource
        - test_attempts: Number of test attempts
        - rating: Student rating of the resource (1-5)
        - helpful: Whether student found the resource helpful
        - notes: Any notes from the student
    
    Returns:
        Status of the engagement tracking
    """
    db = get_db()
    rbac = RBACService(db)
    
    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom"
        )
    
    try:
        classroom_oid = ObjectId(classroom_id)
        module_oid = ObjectId(module_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom or module id")
    
    # Verify module exists in classroom
    module = await db.learning_modules.find_one({
        "_id": module_oid,
        "classroom_id": classroom_oid
    })
    
    if not module:
        raise HTTPException(status_code=404, detail="Module not found in this classroom")
    
    # Verify resource exists in module
    module_resources = module.get("resources", [])
    resource_exists = any(
        r.get("id") == resource_id or r.get("resource_id") == resource_id
        for r in module_resources
    )
    
    if not resource_exists:
        raise HTTPException(status_code=404, detail="Resource not found in this module")
    
    module_service = LearningModuleService(db)
    result = await module_service.track_resource_engagement(
        current_user["user_id"],
        resource_id,
        module_id,
        engagement_data.dict()
    )
    
    return result


@router.delete("/{classroom_id}/modules/{module_id}")
async def delete_learning_module(
    classroom_id: str,
    module_id: str,
    current_user=Depends(get_current_user),
):
    """Deletes a learning module from the classroom."""
    db = get_db()
    rbac = RBACService(db)
    role = normalize_user_role(current_user.get("role"))

    if role not in {"teacher", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can delete modules",
        )

    if role == "teacher" and not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the classroom teacher can delete modules",
        )

    module_service = LearningModuleService(db)
    result = await module_service.delete_module(
        classroom_id=classroom_id,
        module_id=module_id,
    )

    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to delete module"))

    return result


@router.get("/{classroom_id}/modules/{module_id}/analytics")
async def get_module_resource_analytics(
    classroom_id: str,
    module_id: str,
    current_user = Depends(get_current_user),
):
    """
    Retrieves analytics for resources in a module across all students.
    Only accessible to teachers and admins.
    
    Returns:
        Dictionary with resource engagement analytics
    """
    db = get_db()
    rbac = RBACService(db)
    role = normalize_user_role(current_user.get("role"))
    
    if role not in {"teacher", "admin"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can view module analytics"
        )
    
    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom"
        )
    
    try:
        classroom_oid = ObjectId(classroom_id)
        module_oid = ObjectId(module_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom or module id")
    
    module_service = LearningModuleService(db)
    result = await module_service.get_module_resource_analytics(classroom_id, module_id)

    return result


def _normalize_enrollment_code(code: str) -> str:
    return str(code or "").strip().lower()


async def _update_thumbnails_for_classroom(db, classroom_oid: ObjectId, resources: List[Dict[str, Any]]):
    """Background task to derive and persist missing thumbnails for classroom resources."""
    updated = False
    new_resources = []
    for res in resources:
        if not isinstance(res, dict):
            new_resources.append(res)
            continue

        if not res.get("thumbnail_url"):
            vid = extract_video_id(str(res.get("url") or ""))
            if vid:
                res["thumbnail_url"] = f"https://img.youtube.com/vi/{vid}/maxresdefault.jpg"
                updated = True
        new_resources.append(res)

    if updated:
        await db.classrooms.update_one(
            {"_id": classroom_oid},
            {"$set": {"ai_resources": new_resources}}
        )


async def _update_thumbnails_for_generated_personal_resources(db, user_oid: ObjectId, signature: str, resources: List[Dict[str, Any]]):
    """Background task to derive and persist missing thumbnails for personal resources."""
    updated = False
    new_resources = []
    for res in resources:
        if not isinstance(res, dict):
            new_resources.append(res)
            continue

        if not res.get("thumbnail_url"):
            vid = extract_video_id(str(res.get("url") or ""))
            if vid:
                res["thumbnail_url"] = f"https://img.youtube.com/vi/{vid}/maxresdefault.jpg"
                updated = True
        new_resources.append(res)

    if updated:
        await db.generated_personal_resources.update_one(
            {"user_id": user_oid, "assessment_signature": signature},
            {"$set": {"resources": new_resources}}
        )

