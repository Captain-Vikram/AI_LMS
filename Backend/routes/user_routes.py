from datetime import datetime
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, Header, HTTPException, status
from pydantic import BaseModel
import jwt

from database import get_db
from jwt_config import settings

router = APIRouter(prefix="/api/user", tags=["user"])

ALLOWED_MILESTONE_STATUS = {"active", "completed", "failed"}


class MilestoneCreate(BaseModel):
    name: str
    description: Optional[str] = None
    progress: int = 0
    status: str = "active"
    target_date: Optional[datetime] = None
    category: Optional[str] = "skill"
    tags: Optional[List[str]] = None


class MilestoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    progress: Optional[int] = None
    status: Optional[str] = None
    target_date: Optional[datetime] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None


def decode_user_id_from_auth_header(authorization: str) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = authorization.split(" ")[1]

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication token")

        return user_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")


def _to_iso(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _serialize_milestone(document):
    return {
        "id": str(document.get("_id")),
        "user_id": str(document.get("user_id")),
        "name": document.get("name"),
        "description": document.get("description"),
        "progress": int(document.get("progress", 0)),
        "status": document.get("status", "active"),
        "category": document.get("category", "skill"),
        "tags": document.get("tags", []),
        "created_at": _to_iso(document.get("created_at")),
        "updated_at": _to_iso(document.get("updated_at")),
        "target_date": _to_iso(document.get("target_date")),
    }


def _validate_status(status_value: str):
    status_normalized = (status_value or "").strip().lower()
    if status_normalized not in ALLOWED_MILESTONE_STATUS:
        raise HTTPException(
            status_code=400,
            detail="Invalid status. Use one of: active, completed, failed",
        )
    return status_normalized


def _normalize_progress(progress_value: int) -> int:
    try:
        return max(0, min(100, int(progress_value)))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Progress must be an integer")


def _model_to_dict(model):
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_unset=True)
    return model.dict(exclude_unset=True)


@router.get("/milestones")
async def get_user_milestones(authorization: str = Header(None)):
    user_id = decode_user_id_from_auth_header(authorization)
    db = get_db()

    milestones = list(
        db.user_milestones.find({"user_id": ObjectId(user_id)}).sort(
            [
                ("status", 1),
                ("target_date", 1),
                ("created_at", -1),
            ]
        )
    )

    return {"milestones": [_serialize_milestone(milestone) for milestone in milestones]}


@router.post("/milestones", status_code=status.HTTP_201_CREATED)
async def create_user_milestone(payload: MilestoneCreate, authorization: str = Header(None)):
    user_id = decode_user_id_from_auth_header(authorization)
    db = get_db()

    milestone_name = (payload.name or "").strip()
    if not milestone_name:
        raise HTTPException(status_code=400, detail="Milestone name is required")

    progress = _normalize_progress(payload.progress)
    milestone_status = _validate_status(payload.status)

    if progress == 100 and milestone_status == "active":
        milestone_status = "completed"
    if milestone_status == "completed" and progress < 100:
        progress = 100

    now = datetime.utcnow()
    document = {
        "user_id": ObjectId(user_id),
        "name": milestone_name,
        "description": payload.description,
        "progress": progress,
        "status": milestone_status,
        "target_date": payload.target_date,
        "category": payload.category or "skill",
        "tags": payload.tags or [],
        "created_at": now,
        "updated_at": now,
    }

    insert_result = db.user_milestones.insert_one(document)
    created = db.user_milestones.find_one({"_id": insert_result.inserted_id})

    return {"milestone": _serialize_milestone(created)}


@router.patch("/milestones/{milestone_id}")
async def update_user_milestone(
    milestone_id: str,
    payload: MilestoneUpdate,
    authorization: str = Header(None),
):
    user_id = decode_user_id_from_auth_header(authorization)
    db = get_db()

    try:
        milestone_object_id = ObjectId(milestone_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid milestone id")

    updates = _model_to_dict(payload)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    if "name" in updates:
        milestone_name = (updates.get("name") or "").strip()
        if not milestone_name:
            raise HTTPException(status_code=400, detail="Milestone name cannot be empty")
        updates["name"] = milestone_name

    if "status" in updates:
        updates["status"] = _validate_status(updates.get("status"))

    if "progress" in updates:
        updates["progress"] = _normalize_progress(updates.get("progress"))

    if updates.get("progress") == 100 and "status" not in updates:
        updates["status"] = "completed"

    if updates.get("status") == "completed" and "progress" not in updates:
        updates["progress"] = 100

    updates["updated_at"] = datetime.utcnow()

    result = db.user_milestones.update_one(
        {"_id": milestone_object_id, "user_id": ObjectId(user_id)},
        {"$set": updates},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Milestone not found")

    updated = db.user_milestones.find_one(
        {"_id": milestone_object_id, "user_id": ObjectId(user_id)}
    )

    return {"milestone": _serialize_milestone(updated)}


@router.delete("/milestones/{milestone_id}")
async def delete_user_milestone(milestone_id: str, authorization: str = Header(None)):
    user_id = decode_user_id_from_auth_header(authorization)
    db = get_db()

    try:
        milestone_object_id = ObjectId(milestone_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid milestone id")

    result = db.user_milestones.delete_one(
        {"_id": milestone_object_id, "user_id": ObjectId(user_id)}
    )

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Milestone not found")

    return {"message": "Milestone deleted successfully", "id": milestone_id}
