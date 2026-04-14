from datetime import datetime
import hashlib
import json
from functions.youtube_education import generate_skill_playlist, respond_to_normal_query
from fastapi import APIRouter, Query, Depends, HTTPException, status, Header
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from database import get_db
from bson import ObjectId
import jwt
from jwt_config import settings

router = APIRouter(
    prefix="/api/youtube",
    tags=["youtube"],
    responses={404: {"description": "Not found"}}
)

class AssessmentResults(BaseModel):
    score: Dict[str, Any]
    assessed_level: str
    question_feedback: List[Dict[str, Any]]
    skill_gaps: Dict[str, Any]
    recommendations: List[Dict[str, Any]]


def _decode_user_id_from_header(authorization: Optional[str]) -> Optional[str]:
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


def _assessment_signature(payload: Dict[str, Any]) -> str:
    serialized = json.dumps(payload, sort_keys=True, default=str, ensure_ascii=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

@router.post("/recommendations", response_model=List[Dict[str, Any]])
async def get_youtube_recommendations(
    assessment_results: AssessmentResults = None,
    authorization: str = Header(None)
):
    """
    Generate YouTube video recommendations based on assessment results.
    Uses stored results from the database if no assessment results are provided.
    """
    try:
        user_id = _decode_user_id_from_header(authorization)
        db = get_db()
        assessment_snapshot = None
        latest_assessment_id = None

        if assessment_results is None:
            if not user_id:
                raise HTTPException(
                    status_code=400,
                    detail="Assessment results must be provided",
                )

            quiz_result = db.skill_assessment_results.find_one(
                {"user_id": ObjectId(user_id)},
                sort=[("timestamp", -1)],
            )

            if not quiz_result:
                raise HTTPException(
                    status_code=404,
                    detail="No assessment results found for this user",
                )

            latest_assessment_id = str(quiz_result.get("_id")) if quiz_result.get("_id") else None

            assessment_snapshot = {
                "score": quiz_result.get("score", {}),
                "assessed_level": quiz_result.get("assessed_level", "intermediate"),
                "question_feedback": quiz_result.get("question_feedback", []),
                "skill_gaps": quiz_result.get("skill_gaps", {}),
                "recommendations": quiz_result.get("recommendations", []),
            }
            assessment_results = AssessmentResults(**assessment_snapshot)
        else:
            assessment_snapshot = (
                assessment_results.model_dump()
                if hasattr(assessment_results, "model_dump")
                else assessment_results.dict()
            )

        assessment_signature = _assessment_signature(assessment_snapshot)

        # Cache hit: same user + same assessment snapshot => reuse stored playlists.
        if user_id:
            cache_filter = {
                "user_id": ObjectId(user_id),
                "assessment_signature": assessment_signature,
            }
            cached_doc = db.generated_playlists.find_one(cache_filter, sort=[("updated_at", -1)])
            if cached_doc and isinstance(cached_doc.get("playlists"), list) and cached_doc.get("playlists"):
                return cached_doc["playlists"]

        playlists = generate_skill_playlist(assessment_snapshot)

        if user_id:
            try:
                db.generated_playlists.update_one(
                    {
                        "user_id": ObjectId(user_id),
                        "assessment_signature": assessment_signature,
                    },
                    {
                        "$set": {
                            "playlists": playlists,
                            "assessment_signature": assessment_signature,
                            "assessment_ref": latest_assessment_id,
                            "updated_at": datetime.utcnow(),
                        }
                    },
                    upsert=True,
                )
            except Exception as e:
                # Cache failures should never break user response.
                print(f"Error storing playlists cache: {str(e)}")

        return playlists
        
    except HTTPException:
        raise
    except Exception as e:
        if assessment_results:
            payload = assessment_snapshot or (
                assessment_results.model_dump()
                if hasattr(assessment_results, "model_dump")
                else assessment_results.dict()
            )
            print(f"Falling back to deterministic YouTube playlists due to error: {e}")
            return generate_skill_playlist(payload, force_fallback=True)

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recommendations: {str(e)}"
        )

@router.post("/get_videos")
async def get_youtube_videos(payload: dict):
    """
    Accepts JSON input and returns a list of skills with their YouTube video links.
    
    Expected JSON structure example:
    {
      "score": { ... },
      "assessed_level": "intermediate",
      "skill_gaps": {
          "areas": [
              { "skill": "Data Analysis", "level": "satisfactory" },
              { "skill": "Programming", "level": "needs improvement" }
          ]
      },
      "recommendations": [ ... ]
    }
    """
    try:
        result = generate_skill_playlist(payload)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_links(query: str = Query(..., description="The search query to find relevant YouTube videos")):
    """
    Accepts a query parameter and returns a list of YouTube links for the top 10 results.
    
    Example:
      GET /api/yotube_videos/search?query=python+tutorial
    """
    try:
        links = respond_to_normal_query(query)
        return {"links": links}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
