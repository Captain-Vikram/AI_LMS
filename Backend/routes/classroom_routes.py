from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile, status
from database_async import get_db
from database import get_db as get_sync_db
from bson import ObjectId
import asyncio
from datetime import datetime
import hashlib
import json
import re
import secrets
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel
from starlette.datastructures import UploadFile as StarletteUploadFile

from services.rbac_service import RBACService
from services.learning_module_service import LearningModuleService
from functions.search_doc import generate_skill_resources
from functions.youtube_education import generate_skill_playlist
from functions.utils import get_current_user, normalize_user_role

router = APIRouter(prefix="/api/classroom", tags=["classroom"])


class ResourceApprovalRequest(BaseModel):
    approved: bool


class ResourceEngagementRequest(BaseModel):
    viewed: Optional[bool] = False
    view_duration_seconds: Optional[int] = 0
    completion_percentage: Optional[int] = 0
    test_score: Optional[float] = None
    test_attempts: Optional[int] = 0
    rating: Optional[int] = None
    helpful: Optional[bool] = None
    notes: Optional[str] = ""


class ModuleCreateRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    status: Optional[str] = "published"


class ModuleReorderRequest(BaseModel):
    module_ids: List[str]


class ModuleResourceAssignmentRequest(BaseModel):
    resource_ids: List[str]


def _subject_regex(subject: str) -> str:
    return rf"^\s*{re.escape(subject.strip())}\s*$"


def _assessment_signature(payload: Dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, default=str, ensure_ascii=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


def _normalize_module_seed_name(candidate: Any) -> str:
    cleaned = re.sub(r"\s+", " ", str(candidate or "").strip())
    if not cleaned:
        return ""
    if len(cleaned) > 120:
        cleaned = cleaned[:120].strip()
    return cleaned


def _derive_initial_module_names(
    focus_areas: List[str],
    ai_resources: List[Dict[str, Any]],
    max_items: int = 10,
) -> List[str]:
    ordered_candidates: List[str] = []
    seen_keys = set()

    def add_candidate(value: Any):
        normalized = _normalize_module_seed_name(value)
        if not normalized:
            return

        key = normalized.lower()
        if key in seen_keys:
            return

        seen_keys.add(key)
        ordered_candidates.append(normalized)

    for area in focus_areas or []:
        add_candidate(area)
        if len(ordered_candidates) >= max_items:
            return ordered_candidates

    for resource in ai_resources or []:
        if not isinstance(resource, dict):
            continue
        add_candidate(resource.get("module_name") or resource.get("skill"))
        if len(ordered_candidates) >= max_items:
            break

    return ordered_candidates


def _to_iso(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _serialize_resource(resource: Dict[str, Any]) -> Dict[str, Any]:
    module_id = resource.get("module_id")
    return {
        "resource_id": resource.get("resource_id"),
        "title": resource.get("title", "Untitled Resource"),
        "description": resource.get("description", ""),
        "url": resource.get("url", ""),
        "resource_type": resource.get("resource_type", "article"),
        "skill": resource.get("skill", "General"),
        "module_id": str(module_id) if module_id else None,
        "module_name": resource.get("module_name"),
        "source": resource.get("source", "ai"),
        "approval_status": resource.get("approval_status", "pending"),
        "created_date": _to_iso(resource.get("created_date")),
        "updated_date": _to_iso(resource.get("updated_date")),
        "approved_date": _to_iso(resource.get("approved_date")),
        "approved_by": str(resource.get("approved_by")) if resource.get("approved_by") else None,
    }


def _resource_counts(resources: List[Dict[str, Any]]) -> Dict[str, int]:
    approved = sum(1 for resource in resources if resource.get("approval_status") == "approved")
    rejected = sum(1 for resource in resources if resource.get("approval_status") == "rejected")
    pending = max(0, len(resources) - approved - rejected)
    return {
        "total": len(resources),
        "approved": approved,
        "pending": pending,
        "rejected": rejected,
    }


def _extract_pdf_excerpt_and_page_count(pdf_bytes: bytes, max_pages: int = 10) -> Tuple[str, int]:
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Curriculum PDF is required")

    try:
        import fitz  # PyMuPDF

        text_parts: List[str] = []
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = int(document.page_count or 0)

        if page_count > max_pages:
            document.close()
            raise HTTPException(
                status_code=400,
                detail=f"Curriculum PDF must be {max_pages} pages or fewer",
            )

        for page in document:
            page_text = page.get_text("text")  # type: ignore[attr-defined]
            if page_text:
                text_parts.append(page_text)

        document.close()

        extracted = "\n".join(text_parts)
        extracted = re.sub(r"\n{3,}", "\n\n", extracted).strip()
        return extracted[:12000], page_count
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Unable to read curriculum PDF. Upload a valid PDF with selectable text.",
        )


def _subject_matches_pdf_excerpt(subject: str, excerpt: str) -> bool:
    if not excerpt.strip():
        return False

    tokens = [
        token
        for token in re.findall(r"[a-zA-Z]{3,}", subject.lower())
        if token not in {"and", "for", "the", "with", "from"}
    ]

    if not tokens:
        return True

    lowered_excerpt = excerpt.lower()
    return any(token in lowered_excerpt for token in tokens)


def _derive_focus_areas(
    subject: str,
    subject_description: str,
    student_expectations: str,
    curriculum_excerpt: str = "",
) -> List[str]:
    focus_areas: List[str] = []
    seen = set()

    def _push(candidate: str):
        cleaned = re.sub(r"\s+", " ", (candidate or "").strip(" .-•\n\t"))
        if not cleaned:
            return
        if len(cleaned.split()) > 10:
            return
        key = cleaned.lower()
        if key in seen:
            return
        seen.add(key)
        focus_areas.append(cleaned)

    _push(subject)

    if curriculum_excerpt:
        skip_prefixes = (
            "learning outcome",
            "learning outcomes",
            "outcome",
            "outcomes",
            "assessment",
            "assessments",
            "reference",
            "references",
            "objective",
            "objectives",
            "contents",
            "syllabus",
        )

        for raw_line in curriculum_excerpt.splitlines():
            line = re.sub(r"\s+", " ", raw_line).strip()
            if not line:
                continue

            line = re.sub(r"^\d+[\)\.\-:]\s*", "", line)
            line = re.sub(
                r"^(module|unit|chapter)\s*\d+\s*[:\-]\s*",
                "",
                line,
                flags=re.IGNORECASE,
            )
            line = line.strip(" -•\t")

            if not line or line.lower().startswith(skip_prefixes):
                continue
            if len(line) > 90:
                continue

            alpha_count = sum(1 for character in line if character.isalpha())
            if alpha_count < 4:
                continue

            _push(line)
            if len(focus_areas) >= 6:
                return focus_areas[:6]

    corpus = f"{subject_description}\n{student_expectations}"
    for sentence in re.split(r"[\n\.;]", corpus):
        words = re.findall(r"[A-Za-z0-9\+\-]+", sentence)
        trimmed = [word for word in words if len(word) >= 3]
        if len(trimmed) < 2:
            continue
        _push(" ".join(trimmed[:4]))
        if len(focus_areas) >= 6:
            break

    if len(focus_areas) < 3:
        _push(f"{subject} fundamentals")
        _push(f"{subject} practical application")
        _push("problem solving")

    return focus_areas[:6]


def _build_assessment_seed(subject: str, focus_areas: List[str], student_expectations: str) -> Dict[str, Any]:
    unique_focus = [item for item in focus_areas if item and item.strip()]
    gap_areas = [{"skill": item, "level": "needs improvement"} for item in unique_focus]

    return {
        "score": {"correct": 0, "total": max(1, len(unique_focus)), "percentage": 0},
        "assessed_level": "classroom-default",
        "question_feedback": [],
        "skill_gaps": {
            "overall": f"Teacher-defined focus areas for {subject}.",
            "areas": gap_areas,
        },
        "recommendations": [{"title": item, "type": "focus-area"} for item in unique_focus],
        "teacher_expectations": student_expectations,
    }


def _normalize_url(url_value) -> str:
    """Extract a clean absolute URL from string/list/legacy list-like string inputs."""
    if not url_value:
        return ""

    def _unwrap_quotes(value: Any) -> str:
        text = str(value or "").strip()
        while (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
            text = text[1:-1].strip()
        return text

    raw_value = url_value
    if isinstance(raw_value, list):
        raw_value = next((item for item in raw_value if str(item or "").strip()), "")

    text = _unwrap_quotes(raw_value)
    if not text:
        return ""

    if text.startswith("[") and text.endswith("]"):
        try:
            parsed = json.loads(text.replace("'", '"'))
            if isinstance(parsed, list):
                text = _unwrap_quotes(next((item for item in parsed if str(item or "").strip()), ""))
        except Exception:
            pass

    text = _unwrap_quotes(text).replace("\\u0026", "&").replace("&amp;", "&")
    matched = re.search(r"https?://[^\s'\"\]]+", text)
    if matched:
        text = matched.group(0).strip()

    if not re.match(r"^https?://", text, flags=re.IGNORECASE) and re.match(
        r"^[\w.-]+\.[a-z]{2,}(?:/|$)", text, flags=re.IGNORECASE
    ):
        text = f"https://{text}"

    return text if re.match(r"^https?://", text, flags=re.IGNORECASE) else ""


def _resource_from_playlist(skill: str, concept: str, url: str, source: str, approval_status: str) -> Dict[str, Any]:
    now = datetime.utcnow()
    return {
        "resource_id": secrets.token_hex(12),
        "title": concept or f"{skill} video",
        "description": f"AI-suggested video for {skill}.",
        "url": _normalize_url(url),
        "resource_type": "youtube",
        "skill": skill,
        "source": source,
        "approval_status": approval_status,
        "created_date": now,
        "updated_date": now,
        "approved_date": now if approval_status == "approved" else None,
        "approved_by": None,
    }


def _resource_from_document(
    skill: str,
    title: str,
    description: str,
    url: str,
    resource_type: str,
    source: str,
    approval_status: str,
) -> Dict[str, Any]:
    now = datetime.utcnow()
    return {
        "resource_id": secrets.token_hex(12),
        "title": title or f"{skill} resource",
        "description": description or f"AI-suggested {resource_type} resource.",
        "url": _normalize_url(url),
        "resource_type": resource_type,
        "skill": skill,
        "source": source,
        "approval_status": approval_status,
        "created_date": now,
        "updated_date": now,
        "approved_date": now if approval_status == "approved" else None,
        "approved_by": None,
    }


def _build_resources_from_outputs(
    playlists: List[Dict[str, Any]],
    deepsearch_results: List[Dict[str, Any]],
    source: str,
    approval_status: str,
    max_items: int = 60,
) -> List[Dict[str, Any]]:
    resources: List[Dict[str, Any]] = []

    for skill_playlist in playlists or []:
        skill = str(skill_playlist.get("skill") or "General")
        for item in skill_playlist.get("playlist", []) or []:
            if not isinstance(item, dict):
                continue
            resource = _resource_from_playlist(
                skill=skill,
                concept=str(item.get("concept") or f"{skill} tutorial"),
                url=_normalize_url(item.get("youtube_link")),
                source=source,
                approval_status=approval_status,
            )
            resources.append(resource)

    for recommendation in deepsearch_results or []:
        if not isinstance(recommendation, dict):
            continue
        skill = str(recommendation.get("skill") or "General")

        for doc in recommendation.get("documents", []) or []:
            if not isinstance(doc, dict):
                continue

            resources.append(
                _resource_from_document(
                    skill=skill,
                    title=str(doc.get("title") or f"{skill} article"),
                    description=str(doc.get("content") or "AI-suggested reading resource."),
                    url=_normalize_url(doc.get("url") or doc.get("link")),
                    resource_type="article",
                    source=source,
                    approval_status=approval_status,
                )
            )

        for blog_url in recommendation.get("blogs", []) or []:
            resources.append(
                _resource_from_document(
                    skill=skill,
                    title=f"{skill} blog reference",
                    description="AI-suggested blog resource.",
                    url=_normalize_url(blog_url),
                    resource_type="blog",
                    source=source,
                    approval_status=approval_status,
                )
            )

    deduped: List[Dict[str, Any]] = []
    seen = set()
    for resource in resources:
        key = (resource.get("url") or "", resource.get("title") or "")
        if key in seen:
            continue
        seen.add(key)
        deduped.append(resource)
        if len(deduped) >= max_items:
            break

    return deduped


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


def _generate_ai_resource_bundle(
    assessment_seed: Dict[str, Any],
    source: str,
    approval_status: str,
) -> List[Dict[str, Any]]:
    playlists: List[Dict[str, Any]] = []
    deepsearch_results: List[Dict[str, Any]] = []

    try:
        playlists = generate_skill_playlist(assessment_seed)
    except Exception:
        try:
            playlists = generate_skill_playlist(assessment_seed, force_fallback=True)
        except Exception:
            playlists = []

    try:
        deepsearch_results = generate_skill_resources(assessment_seed)
    except Exception:
        deepsearch_results = []

    return _build_resources_from_outputs(
        playlists=playlists,
        deepsearch_results=deepsearch_results,
        source=source,
        approval_status=approval_status,
    )


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
        email = f"demo_student_{suffix}_{i}@edusaarthi.local"
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
    focus_areas = _derive_focus_areas(
        subject,
        subject_description,
        student_expectations,
        curriculum_excerpt=curriculum_excerpt,
    )
    assessment_seed = _build_assessment_seed(subject, focus_areas, student_expectations)
    ai_resources = _generate_ai_resource_bundle(
        assessment_seed=assessment_seed,
        source="class_ai",
        approval_status="pending",
    )

    curriculum_metadata = {
        "filename": filename or "curriculum.pdf",
        "content_type": curriculum_pdf.content_type,
        "size_bytes": len(pdf_bytes),
        "page_count": page_count,
        "uploaded_at": datetime.utcnow(),
        "text_excerpt": curriculum_excerpt[:4000],
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
        "ai_resources": ai_resources,
        "resource_generation_meta": {
            "generated_at": datetime.utcnow(),
            "source": "teacher_classroom_setup",
            "assessment_signature": _assessment_signature(assessment_seed),
        },
        "created_date": datetime.utcnow(),
        "updated_date": datetime.utcnow(),
    }

    result = await db.classrooms.insert_one(classroom)
    classroom_id = str(result.inserted_id)

    await _ensure_user_membership(db, teacher_oid, classroom_id, "teacher")

    module_service = LearningModuleService(get_sync_db())
    seeded_modules = []
    initial_module_names = _derive_initial_module_names(focus_areas, ai_resources)

    for module_name in initial_module_names:
        seed_result = module_service.create_module(
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
        "resource_summary": _resource_counts(ai_resources),
        "resource_preview": [_serialize_resource(resource) for resource in ai_resources[:6]],
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
        },
    )
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if normalized_mode == "class":
        role = normalize_user_role(current_user.get("role"))
        can_manage = role == "admin" or await rbac.is_teacher(current_user["user_id"], classroom_id)

        resources = [item for item in classroom.get("ai_resources", []) if isinstance(item, dict)]
        if not can_manage:
            resources = [item for item in resources if item.get("approval_status") == "approved"]

        return {
            "status": "success",
            "mode": "class",
            "classroom_id": classroom_id,
            "classroom_name": classroom.get("name"),
            "subject": classroom.get("subject"),
            "focus_areas": classroom.get("subject_focus_areas", []),
            "summary": _resource_counts(resources),
            "resources": [_serialize_resource(item) for item in resources],
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
        return {
            "status": "success",
            "mode": "personal",
            "classroom_id": classroom_id,
            "classroom_name": classroom.get("name"),
            "summary": _resource_counts(cached_resources),
            "resources": [_serialize_resource(item) for item in cached_resources],
            "cached": True,
        }

    personal_resources = _generate_ai_resource_bundle(
        assessment_seed=assessment_snapshot,
        source="personal_ai",
        approval_status="approved",
    )

    await db.generated_personal_resources.update_one(
        {
            "user_id": user_oid,
            "assessment_signature": signature,
        },
        {
            "$set": {
                "resources": personal_resources,
                "assessment_signature": signature,
                "updated_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )

    return {
        "status": "success",
        "mode": "personal",
        "classroom_id": classroom_id,
        "classroom_name": classroom.get("name"),
        "summary": _resource_counts(personal_resources),
        "resources": [_serialize_resource(item) for item in personal_resources],
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
    for user_id in user_ids:
        user_name = "Unknown"
        try:
            user_oid = ObjectId(user_id)
            user = await db.users.find_one({"_id": user_oid}, {"name": 1})
            if user and user.get("name"):
                user_name = str(user.get("name"))
        except Exception:
            pass
        name_lookup[user_id] = user_name

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

    pending_count = await db.assessment_submissions.count_documents(
        {
            "classroom_id": {"$in": [classroom_id, classroom_oid]},
            "grading_status": "pending_manual_grade",
        }
    )

    return {
        "status": "success",
        "pending_count": int(pending_count),
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


@router.get("/{classroom_id}")
async def get_classroom(classroom_id: str, current_user = Depends(get_current_user)):
    db = get_db()
    rbac = RBACService(db)
    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this classroom")

    try:
        classroom = await db.classrooms.find_one({"_id": ObjectId(classroom_id)})
    except Exception:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # serialize ids to strings
    classroom["_id"] = str(classroom["_id"])
    classroom["teacher_id"] = str(classroom["teacher_id"]) if classroom.get("teacher_id") else None
    classroom["students"] = [str(s) for s in classroom.get("students", [])]

    return classroom


@router.get("/find")
async def find_classroom_by_code(code: str):
    """Find a classroom by enrollment code. Returns basic info if found."""
    db = get_db()
    classroom = await db.classrooms.find_one({"enrollment_code": code})
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

    if not classroom or classroom.get("enrollment_code") != enrollment_code:
        raise HTTPException(status_code=404, detail="Classroom not found or invalid code")

    user_oid = ObjectId(current_user["user_id"])
    if user_oid in classroom.get("students", []):
        raise HTTPException(status_code=400, detail="Already a member")

    # add student
    await db.classrooms.update_one({"_id": ObjectId(classroom_id)}, {"$push": {"students": user_oid}})
    await db.users.update_one({"_id": user_oid}, {"$push": {"classroom_memberships": {
        "classroom_id": classroom_id,
        "role": "student",
        "joined_date": datetime.utcnow(),
        "is_active": True
    }}})

    return {"classroom_id": classroom_id, "message": "Joined"}


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
    
    module_service = LearningModuleService(get_sync_db())
    result = module_service.auto_generate_modules_from_resources(
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
    
    module_service = LearningModuleService(get_sync_db())
    
    # Include progress for students viewing their own progress
    show_progress = include_progress and current_user.get("role", "").lower() == "student"
    
    result = module_service.get_classroom_modules(
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

    module_service = LearningModuleService(get_sync_db())
    result = module_service.create_module(
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

    module_service = LearningModuleService(get_sync_db())
    result = module_service.reorder_modules(classroom_id, payload.module_ids)

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

    module_service = LearningModuleService(get_sync_db())
    result = module_service.get_approved_resources_for_module_assignment(classroom_id)

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

    module_service = LearningModuleService(get_sync_db())
    result = module_service.add_resources_to_module(
        classroom_id=classroom_id,
        module_id=module_id,
        resource_ids=payload.resource_ids,
    )

    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to assign resources"))

    return result


@router.get("/{classroom_id}/modules/{module_id}")
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
    
    module_service = LearningModuleService(get_sync_db())
    progress = module_service.get_module_progress(target_student_oid, module_oid)
    
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
    
    module_service = LearningModuleService(get_sync_db())
    result = module_service.track_resource_engagement(
        current_user["user_id"],
        resource_id,
        module_id,
        engagement_data.dict()
    )
    
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
    
    module_service = LearningModuleService(get_sync_db())
    result = module_service.get_module_resource_analytics(classroom_id, module_id)
    
    return result
