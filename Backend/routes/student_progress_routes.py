"""Student progress endpoints for sequential module progression."""

from typing import Any, Dict, List, Optional

from bson import ObjectId
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query

from database import db

load_dotenv(override=True)

router = APIRouter(
    prefix="/api/student",
    tags=["student-progress"],
    responses={404: {"description": "Not found"}},
)


def _to_object_id(value: str) -> Optional[ObjectId]:
    try:
        return ObjectId(str(value))
    except Exception:
        return None


def _resource_id(resource: Dict[str, Any]) -> str:
    return str(resource.get("id") or resource.get("resource_id") or "").strip()


def _resource_title(resource: Dict[str, Any]) -> str:
    return str(resource.get("title") or "Untitled").strip() or "Untitled"


def _resource_order(resource: Dict[str, Any]) -> int:
    try:
        return int(resource.get("order", 0) or 0)
    except Exception:
        return 0


@router.get("/progress/{module_id}")
async def get_student_progress(
    module_id: str,
    student_id: str = Query(..., description="Student ID"),
    classroom_id: str = Query(..., description="Classroom ID")
) -> Dict[str, Any]:
    """
    Get a student's progression data for a specific module.
    Returns locked/unlocked status, test scores, and assessment status.
    """
    try:
        module_oid = _to_object_id(module_id)
        classroom_oid = _to_object_id(classroom_id)
        if not module_oid:
            raise HTTPException(status_code=400, detail="Invalid module id")

        module_filter: Dict[str, Any] = {"_id": module_oid}
        if classroom_oid:
            module_filter["classroom_id"] = classroom_oid

        module = db.learning_modules.find_one(module_filter)
        if not module:
            # Fallback in case classroom id was not ObjectId in older records.
            module = db.learning_modules.find_one({"_id": module_oid})

        if not module:
            raise HTTPException(status_code=404, detail="Module not found")

        resources = [item for item in module.get("resources", []) if isinstance(item, dict)]
        resources.sort(key=_resource_order)
        if not resources:
            raise HTTPException(status_code=404, detail="Module or resources not found")

        # Build response for each resource
        resources_data = []
        for index, resource in enumerate(resources):
            current_resource_id = _resource_id(resource)
            if not current_resource_id:
                continue

            # Fetch student progress for this resource
            progress = db.student_progress.find_one({
                "student_id": student_id,
                "resource_id": current_resource_id,
                "module_id": module_id,
            })

            tests_taken = int(progress.get("tests_taken", 0) or 0) if progress else 0
            passed_count = int(progress.get("passed_tests_count", 0) or 0) if progress else 0
            is_unlocked = bool(progress.get("is_unlocked", False)) if progress else index == 0

            if passed_count >= 2:
                status_str = "completed"
            elif tests_taken > 0:
                status_str = "in_progress"
            elif is_unlocked:
                status_str = "unlocked"
            else:
                status_str = "locked"

            resources_data.append({
                "resource_id": current_resource_id,
                "resource_title": _resource_title(resource),
                "order_index": _resource_order(resource),
                "is_unlocked": is_unlocked,
                "unlocked_at": progress.get("unlocked_at").isoformat() if progress and progress.get("unlocked_at") else None,
                "tests_taken": tests_taken,
                "passed_tests_count": passed_count,
                "highest_score": progress.get("highest_score") if progress else None,
                "status": status_str,
            })

        # Fetch final assessment status
        assessment = db.module_assessments.find_one(
            {"module_id": {"$in": [module_id, str(module_oid)]}},
            sort=[("updated_at", -1)],
        )

        final_assessment_data = {
            "status": "coming_soon",
            "published": False,
            "assessment_id": None,
            "valid_from": None,
            "valid_until": None,
        }

        if assessment:
            assessment_id = str(assessment.get("_id"))
            final_assessment_data["status"] = assessment.get("status", "draft")
            final_assessment_data["published"] = assessment.get("is_published", False)
            final_assessment_data["assessment_id"] = assessment_id
            if assessment.get("valid_from"):
                final_assessment_data["valid_from"] = assessment["valid_from"].isoformat()
            if assessment.get("valid_until"):
                final_assessment_data["valid_until"] = assessment["valid_until"].isoformat()

            # Check if student has already taken it
            submission = db.assessment_submissions.find_one({
                "assessment_id": {"$in": [assessment_id, assessment.get("_id")]},
                "student_id": student_id,
            })

            if submission and submission.get("is_final_score"):
                final_assessment_data["status"] = "completed"
                final_assessment_data["score"] = submission.get("score_percentage", 0)
                final_assessment_data["passed"] = submission.get("passed", False)

        return {
            "module_id": module_id,
            "resources": resources_data,
            "final_assessment": final_assessment_data,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching student progress: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching progress: {str(e)}"
        )


@router.get("/progress/resources/unlocked")
async def get_unlocked_resources(
    module_id: str = Query(..., description="Module ID"),
    student_id: str = Query(..., description="Student ID")
) -> Dict[str, List[str]]:
    """
    Get list of all unlocked resource IDs for a student in a module.
    """
    try:
        progress_docs = db.student_progress.find({
            "student_id": student_id,
            "module_id": module_id,
            "is_unlocked": True,
        })

        unlocked_ids = [p["resource_id"] for p in progress_docs]

        return {"unlocked_resource_ids": unlocked_ids}

    except Exception as e:
        print(f"Error fetching unlocked resources: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching unlocked resources: {str(e)}"
        )
