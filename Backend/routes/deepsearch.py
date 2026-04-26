from datetime import datetime
import hashlib
import json

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Dict, Any
from bson import ObjectId

# Import your function
from functions.search_doc import generate_skill_resources
from functions.service_health import get_dependency_health_snapshot
from database import get_db
from functions.utils import get_current_user

router = APIRouter(
    prefix="/api/deepresearch",
    tags=["docs recommendation"]
)

class SkillAssessmentInput(BaseModel):
    data: Dict[str, Any]


def _assessment_signature(payload: Dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, default=str, ensure_ascii=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _build_error_detail(code: str, message: str, dependency: str, technical_message: str) -> Dict[str, Any]:
    return {
        "code": code,
        "dependency": dependency,
        "message": message,
        "user_message": message,
        "technical_message": technical_message,
        "dependency_status": get_dependency_health_snapshot(),
    }


def _classify_deepsearch_error(exc: Exception) -> HTTPException:
    text = str(exc)
    lowered = text.lower()

    if "lm studio request failed" in lowered or "127.0.0.1:1234" in lowered:
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_build_error_detail(
                code="LMSTUDIO_UNAVAILABLE",
                message="Local AI service is unavailable. Retry shortly or enable cloud fallback.",
                dependency="llm",
                technical_message=text,
            ),
        )

    if "serper" in lowered or "tavily" in lowered or "api key" in lowered:
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=_build_error_detail(
                code="EXTERNAL_API_UNAVAILABLE",
                message="A required external API is unavailable or misconfigured.",
                dependency="external_apis",
                technical_message=text,
            ),
        )

    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=_build_error_detail(
            code="DEEPSEARCH_BACKEND_ERROR",
            message="Failed to generate recommendations. Please retry.",
            dependency="backend",
            technical_message=text,
        ),
    )

@router.post("/recommendations")
async def get_recommendations(input_data: SkillAssessmentInput, current_user: dict = Depends(get_current_user)):
    try:
        user_id = current_user["user_id"]
        signature = _assessment_signature(input_data.data)

        db = get_db()
        cached_doc = db.generated_deepsearch_resources.find_one(
            {
                "user_id": ObjectId(user_id),
                "assessment_signature": signature,
            },
            sort=[("updated_at", -1)],
        )

        if cached_doc and isinstance(cached_doc.get("recommendations"), list):
            return {
                "status": "success",
                "recommendations": cached_doc["recommendations"],
                "cached": True,
            }

        # Generate recommendations
        results = await generate_skill_resources(input_data.data)

        try:
            db.generated_deepsearch_resources.update_one(
                {
                    "user_id": ObjectId(user_id),
                    "assessment_signature": signature,
                },
                {
                    "$set": {
                        "recommendations": results,
                        "assessment_signature": signature,
                        "updated_at": datetime.utcnow(),
                    }
                },
                upsert=True,
            )
        except Exception as exc:
            print(f"Error storing deepsearch cache: {exc}")

        return {"status": "success", "recommendations": results, "cached": False}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise _classify_deepsearch_error(e)
