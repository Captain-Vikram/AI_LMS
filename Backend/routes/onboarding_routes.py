from datetime import datetime, timedelta
import json
import re
import secrets
from typing import Any, Dict, Optional, List

from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile
import jwt
from pydantic import BaseModel

from database_async import get_db
from functions.llm_adapter_async import generate_text_async
from services.rbac_service import RBACService
from functions.utils import get_current_user, normalize_user_role, verify_clerk_token
from jwt_config import settings


router = APIRouter(prefix="/api/onboarding", tags=["onboarding"])


# Helper to get user ID from JWT token (legacy onboarding endpoints)
async def get_current_user_id(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

    token = authorization.split(" ")[1]
    payload = await verify_clerk_token(token)
    
    clerk_id = payload.get("sub")
    if not clerk_id:
        raise HTTPException(status_code=401, detail="Invalid token")
        
    db = get_db()
    user = await db.users.find_one({"clerk_id": clerk_id})
    if not user:
        # Auto-sync user
        new_user_data = {
            "clerk_id": clerk_id,
            "email": payload.get("email"),
            "first_name": payload.get("given_name", "User"),
            "last_name": payload.get("family_name", ""),
            "role": "student",
            "registration_date": datetime.utcnow(),
            "onboarding_complete": False,
            "assessment_complete": False,
            "status": "active"
        }
        result = await db.users.insert_one(new_user_data)
        return str(result.inserted_id)

    return str(user["_id"])


class StudentJoinRequest(BaseModel):
    enrollment_code: str


class ProfileCompleteRequest(BaseModel):
    first_name: str
    last_name: str
    role: str


@router.post("/complete-profile")
async def complete_profile(
    payload: ProfileCompleteRequest,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    user_oid = ObjectId(current_user["user_id"])
    
    role = normalize_user_role(payload.role)
    
    await db.users.update_one(
        {"_id": user_oid},
        {
            "$set": {
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "role": role,
                "updated_date": datetime.utcnow()
            }
        }
    )
    
    # Also update or create profile in user_profiles collection
    await db.user_profiles.update_one(
        {"user_id": user_oid},
        {
            "$set": {
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "role": role,
                "updated_at": datetime.utcnow()
            }
        },
        upsert=True
    )
    
    return {
        "status": "success",
        "message": "Profile updated successfully",
        "role": role
    }


def _extract_json_object(raw_text: str) -> Optional[Dict[str, Any]]:
    if not raw_text or not raw_text.strip():
        return None

    cleaned = raw_text.strip()
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        return None

    try:
        parsed = json.loads(match.group(0))
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        return None

    return None


def _default_teacher_pathway(subject: str, grade_level: str, teaching_goals: str) -> Dict[str, Any]:
    goals = teaching_goals.strip() or f"Help students build strong fundamentals in {subject}."
    return {
        "summary": f"Structured classroom pathway for {subject} ({grade_level}).",
        "objectives": [
            f"Build core understanding in {subject}",
            "Use formative checks each week",
            "Track student progress through classroom assignments",
        ],
        "modules": [
            {
                "week": 1,
                "title": "Foundations and Diagnostic",
                "focus": f"Baseline understanding for {subject}",
                "activities": [
                    "Diagnostic quiz",
                    "Concept discussion",
                    "Student reflection",
                ],
                "assessment": "Short baseline assessment",
            },
            {
                "week": 2,
                "title": "Core Concepts",
                "focus": "Concept introduction and guided practice",
                "activities": [
                    "Teacher-led lesson",
                    "Guided examples",
                    "Practice worksheet",
                ],
                "assessment": "Exit ticket + practice check",
            },
            {
                "week": 3,
                "title": "Application and Mastery",
                "focus": "Apply concepts to mixed problems",
                "activities": [
                    "Collaborative task",
                    "Independent assignment",
                    "Doubt-clearing session",
                ],
                "assessment": "Mini mastery test",
            },
        ],
        "teacher_notes": goals,
    }


def _subject_regex(subject: str) -> str:
    return rf"^\s*{re.escape(subject.strip())}\s*$"


def _extract_text_from_pdf(pdf_bytes: bytes, max_pages: int = 20) -> str:
    if not pdf_bytes:
        return ""

    try:
        import fitz  # PyMuPDF

        text_parts = []
        document = fitz.open(stream=pdf_bytes, filetype="pdf")
        for index, page in enumerate(document):
            if index >= max_pages:
                break
            page_text = page.get_text("text")
            if page_text:
                text_parts.append(page_text)
        document.close()

        extracted = "\n".join(text_parts)
        # Clean up excessive newlines while preserving structure
        extracted = re.sub(r"\n{3,}", "\n\n", extracted)
        # Use more context for better understanding
        return extracted[:16000]
    except Exception:
        return ""


def _sanitize_pathway(pathway: Dict[str, Any], subject: str, grade_level: str, teaching_goals: str) -> Dict[str, Any]:
    fallback = _default_teacher_pathway(subject, grade_level, teaching_goals)
    if not isinstance(pathway, dict):
        return fallback

    modules = pathway.get("modules")
    if not isinstance(modules, list) or not modules:
        modules = fallback["modules"]

    cleaned_modules = []
    for idx, module in enumerate(modules[:15], start=1): # Allow more modules
        if not isinstance(module, dict):
            continue
        cleaned_modules.append(
            {
                "week": int(module.get("week") or idx),
                "title": str(module.get("title") or f"Module {idx}"),
                "focus": str(module.get("focus") or "Concept reinforcement"),
                "activities": module.get("activities") if isinstance(module.get("activities"), list) else [],
                "assessment": str(module.get("assessment") or "Formative assessment"),
            }
        )

    if not cleaned_modules:
        cleaned_modules = fallback["modules"]

    objectives = pathway.get("objectives") if isinstance(pathway.get("objectives"), list) else fallback["objectives"]

    return {
        "summary": str(pathway.get("summary") or fallback["summary"]),
        "objectives": objectives,
        "modules": cleaned_modules,
        "teacher_notes": str(pathway.get("teacher_notes") or fallback["teacher_notes"]),
    }


async def _generate_teacher_pathway(
    subject: str,
    grade_level: str,
    classroom_description: str,
    teaching_goals: str,
    preferred_pace: str,
    curriculum_excerpt: str,
) -> Dict[str, Any]:
    prompt = f"""
You are an elite Instructional Designer. Your task is to analyze a teacher's requirements and an optional curriculum/syllabus to create a structured, high-quality educational pathway.

CONTEXT:
- Subject: {subject}
- Grade Level: {grade_level}
- Classroom Description: {classroom_description}
- Primary Teaching Goals: {teaching_goals}
- Desired Pace: {preferred_pace}

CURRICULUM/SYLLABUS DATA (Optional source of truth):
---
{curriculum_excerpt[:12000] if curriculum_excerpt else "No specific curriculum provided. Use general pedagogical best practices for this subject and grade level."}
---

INSTRUCTIONS:
1. If curriculum data is provided, STRICTLY follow its modules, topics, and sequence. Do not hallucinate topics not in the syllabus unless they are necessary prerequisites.
2. Structure the pathway into weekly modules (1 to 12 weeks).
3. For each module, define:
   - A clear Title.
   - The primary Concept/Focus.
   - 3-4 specific Activities (e.g., discussions, labs, practice).
   - A relevant Assessment method.
4. Ensure the objectives are measurable and align with the subject standards.

Return ONLY valid JSON with this exact structure:
{{
  "summary": "Overall vision for this classroom",
  "objectives": ["Goal 1", "Goal 2", "Goal 3"],
  "modules": [
    {{
      "week": 1,
      "title": "Module Title",
      "focus": "Key concept or skill",
      "activities": ["Activity 1", "Activity 2"],
      "assessment": "Type of formative/summative check"
    }}
  ],
  "teacher_notes": "Pedagogical advice for the teacher"
}}
"""

    try:
        raw = await generate_text_async(
            prompt_or_messages=[{"role": "user", "content": prompt}],
            generation_config={"temperature": 0.2, "max_tokens": 2500},
            timeout=90,
        )
        parsed = _extract_json_object(raw)
        if parsed:
            return _sanitize_pathway(parsed, subject, grade_level, teaching_goals)
    except Exception:
        pass

    return _default_teacher_pathway(subject, grade_level, teaching_goals)


@router.post("/teacher/setup")
async def teacher_onboarding_setup(
    institution_name: str = Form(""),
    classroom_name: str = Form(...),
    subject: str = Form(...),
    grade_level: str = Form(...),
    classroom_description: str = Form(""),
    teaching_goals: str = Form(""),
    preferred_pace: str = Form("balanced"),
    curriculum_pdf: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
):
    role = normalize_user_role(current_user.get("role"))
    if role not in {"teacher", "admin"}:
        raise HTTPException(status_code=403, detail="Only teachers can complete this onboarding flow")

    db = get_db()
    user_oid = ObjectId(current_user["user_id"])

    if not classroom_name.strip() or not subject.strip() or not grade_level.strip():
        raise HTTPException(status_code=400, detail="classroom_name, subject, and grade_level are required")

    duplicate_subject = await db.classrooms.find_one(
        {
            "teacher_id": user_oid,
            "subject": {"$regex": _subject_regex(subject), "$options": "i"},
        },
        {"_id": 1},
    )
    if duplicate_subject:
        raise HTTPException(
            status_code=400,
            detail="This teacher already has a classroom with the same subject",
        )

    curriculum_metadata = None
    curriculum_excerpt = ""

    if curriculum_pdf is not None:
        filename = (curriculum_pdf.filename or "").strip()
        if filename and not filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF curriculum files are supported")

        pdf_bytes = await curriculum_pdf.read()
        if len(pdf_bytes) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Curriculum PDF must be 10MB or smaller")

        curriculum_excerpt = _extract_text_from_pdf(pdf_bytes)
        curriculum_metadata = {
            "filename": filename or "curriculum.pdf",
            "content_type": curriculum_pdf.content_type,
            "size_bytes": len(pdf_bytes),
            "uploaded_at": datetime.utcnow(),
            "text_excerpt": curriculum_excerpt[:8000],
        }

    ai_pathway = await _generate_teacher_pathway(
        subject=subject.strip(),
        grade_level=grade_level.strip(),
        classroom_description=classroom_description.strip(),
        teaching_goals=teaching_goals.strip(),
        preferred_pace=preferred_pace.strip(),
        curriculum_excerpt=curriculum_excerpt,
    )

    enrollment_code = secrets.token_urlsafe(8)
    classroom_doc = {
        "institution_id": institution_name.strip() or None,
        "name": classroom_name.strip(),
        "subject": subject.strip(),
        "grade_level": grade_level.strip(),
        "description": classroom_description.strip(),
        "teacher_id": user_oid,
        "co_teachers": [],
        "students": [],
        "student_groups": [],
        "status": "active",
        "start_date": datetime.utcnow(),
        "end_date": None,
        "enrollment_code": enrollment_code,
        "require_approval": False,
        "learning_pathway": ai_pathway,
        "curriculum_metadata": curriculum_metadata,
        "created_date": datetime.utcnow(),
        "updated_date": datetime.utcnow(),
    }

    result = await db.classrooms.insert_one(classroom_doc)
    classroom_id = str(result.inserted_id)

    membership_exists = await db.users.find_one(
        {"_id": user_oid, "classroom_memberships.classroom_id": classroom_id},
        {"_id": 1},
    )
    if not membership_exists:
        await db.users.update_one(
            {"_id": user_oid},
            {
                "$push": {
                    "classroom_memberships": {
                        "classroom_id": classroom_id,
                        "role": "teacher",
                        "joined_date": datetime.utcnow(),
                        "is_active": True,
                        "onboarding_complete": True,
                        "assessment_complete": True,
                    }
                }
            },
        )

    await db.users.update_one(
        {"_id": user_oid},
        {
            "$set": {
                "role": "teacher",
                "onboarding_complete": True,
                "assessment_complete": True,
                "updated_date": datetime.utcnow(),
            }
        },
    )

    await db.teacher_onboarding.update_one(
        {"user_id": user_oid},
        {
            "$set": {
                "user_id": user_oid,
                "institution_name": institution_name.strip(),
                "classroom_id": classroom_id,
                "classroom_name": classroom_name.strip(),
                "subject": subject.strip(),
                "grade_level": grade_level.strip(),
                "teaching_goals": teaching_goals.strip(),
                "preferred_pace": preferred_pace.strip(),
                "ai_pathway": ai_pathway,
                "updated_at": datetime.utcnow(),
            }
        },
        upsert=True,
    )

    return {
        "status": "success",
        "classroom_id": classroom_id,
        "classroom_name": classroom_name.strip(),
        "enrollment_code": enrollment_code,
        "ai_pathway": ai_pathway,
        "curriculum_uploaded": curriculum_metadata is not None,
    }


@router.post("/student/join")
async def student_join_onboarding(
    payload: StudentJoinRequest,
    current_user: dict = Depends(get_current_user),
):
    enrollment_code = (payload.enrollment_code or "").strip()
    if not enrollment_code:
        raise HTTPException(status_code=400, detail="Enrollment code is required")

    db = get_db()
    classroom = await db.classrooms.find_one(
        {
            "enrollment_code": {
                "$regex": f"^{re.escape(enrollment_code)}$",
                "$options": "i",
            }
        }
    )
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found for this enrollment code")

    user_oid = ObjectId(current_user["user_id"])
    classroom_oid = classroom["_id"]
    classroom_id = str(classroom_oid)
    normalized_role = normalize_user_role(current_user.get("role"))

    # Check if user is already a teacher or co-teacher
    is_teacher = user_oid == classroom.get("teacher_id")
    is_co_teacher = current_user["user_id"] in classroom.get("co_teachers", [])
    join_as_co_teacher = normalized_role in {"teacher", "admin"}
    membership_role = "teacher" if (is_teacher or is_co_teacher or join_as_co_teacher) else "student"
    
    # Teacher/admin joining another teacher's classroom becomes a co-teacher.
    # Student flow remains unchanged.
    if not (is_teacher or is_co_teacher):
        if join_as_co_teacher:
            await db.classrooms.update_one(
                {"_id": classroom_oid},
                {
                    "$addToSet": {"co_teachers": current_user["user_id"]},
                    "$pull": {"students": user_oid},
                },
            )
        else:
            await db.classrooms.update_one(
                {"_id": classroom_oid},
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
        memberships[membership_index]["onboarding_complete"] = True
        memberships[membership_index]["assessment_complete"] = True
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
                        "onboarding_complete": True,
                        "assessment_complete": True,
                    }
                }
            },
        )

    role_to_set = "student" if normalized_role not in {"teacher", "admin"} else normalized_role
    await db.users.update_one(
        {"_id": user_oid},
        {
            "$set": {
                "role": role_to_set,
                "onboarding_complete": True,
                "assessment_complete": True,
                "updated_date": datetime.utcnow(),
            }
        },
    )

    # Create StudentProgress records for student joins only.
    # Co-teacher joins should not initialize student progress rows.
    if membership_role == "student":
        try:
            cursor = db.learning_modules.find(
                {"classroom_id": classroom_oid},
                sort=[("created_at", 1)]
            )
            modules = await cursor.to_list(length=100)
            
            for module_idx, module in enumerate(modules):
                module_oid = module["_id"]
                module_id_str = str(module_oid)
                
                resources = module.get("resources", [])
                for resource_idx, resource in enumerate(resources):
                    resource_id = resource.get("id") or str(resource.get("_id", ""))
                    
                    # First resource of first module is unlocked
                    is_first = (module_idx == 0 and resource_idx == 0)
                    
                    progress_doc = {
                        "student_id": str(user_oid),
                        "classroom_id": classroom_id,
                        "module_id": module_id_str,
                        "resource_id": resource_id,
                        "is_unlocked": is_first,
                        "unlocked_at": datetime.utcnow() if is_first else None,
                        "tests_taken": 0,
                        "passed_tests_count": 0,
                        "failed_tests_count": 0,
                        "highest_score": None,
                        "last_test_date": None,
                        "single_turn_chat_history": [],
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                        "last_accessed_at": None,
                    }
                    
                    # Upsert to avoid duplicates if student rejoins
                    await db.student_progress.update_one(
                        {
                            "student_id": str(user_oid),
                            "classroom_id": classroom_id,
                            "module_id": module_id_str,
                            "resource_id": resource_id,
                        },
                        {"$set": progress_doc},
                        upsert=True,
                    )
        except Exception as e:
            # Log error but don't fail the join request
            print(f"Warning: Failed to create StudentProgress records: {e}")

    return {
        "status": "success",
        "classroom_id": classroom_id,
        "joined_role": membership_role,
        "classroom_name": classroom.get("name"),
        "subject": classroom.get("subject"),
        "grade_level": classroom.get("grade_level"),
    }


@router.get("/teacher/pathway/{classroom_id}")
async def get_teacher_pathway(classroom_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    rbac = RBACService(db)
    try:
        classroom_oid = ObjectId(classroom_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid classroom id")

    classroom = await db.classrooms.find_one({"_id": classroom_oid})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    # Allow primary teacher, co-teachers, or admins
    if normalize_user_role(current_user.get("role")) != "admin" and not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(status_code=403, detail="Only classroom teacher can view the full pathway")

    return {
        "classroom_id": classroom_id,
        "classroom_name": classroom.get("name"),
        "ai_pathway": classroom.get("learning_pathway") or {},
        "curriculum_metadata": classroom.get("curriculum_metadata"),
    }


@router.get("/status")
async def get_onboarding_status(user_id: str = Depends(get_current_user_id)):
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {"onboarding_complete": user.get("onboarding_complete", False)}
