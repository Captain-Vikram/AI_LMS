from datetime import datetime
import hashlib
import json

from fastapi import APIRouter, HTTPException, status, Header
from pydantic import BaseModel
from typing import Dict, Any
from bson import ObjectId
import jwt

# Import your function
from functions.search_doc import generate_skill_resources
from functions.service_health import get_dependency_health_snapshot
from database import get_db
from jwt_config import settings

router = APIRouter(
    prefix="/api/deepresearch",
    tags=["docs recommendation"]
)

class SkillAssessmentInput(BaseModel):
    data: Dict[str, Any]


def _assessment_signature(payload: Dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, default=str, ensure_ascii=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _decode_user_id_from_header(authorization: str) -> str | None:
    if not authorization:
        return None

    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token format")


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
async def get_recommendations(input_data: SkillAssessmentInput, authorization: str = Header(None)):
    try:
        user_id = _decode_user_id_from_header(authorization)
        signature = _assessment_signature(input_data.data)

        if user_id:
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
        results = generate_skill_resources(input_data.data)

        if user_id:
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
        raise _classify_deepsearch_error(e)
