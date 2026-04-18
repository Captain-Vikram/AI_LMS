from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from database import get_db
from bson import ObjectId

from services.announcements_service import AnnouncementsService
from services.rbac_service import RBACService
from functions.utils import get_current_user

router = APIRouter(prefix="/api/classroom", tags=["announcements"])

# Teacher: Create announcement
@router.post("/{classroom_id}/announcements")
async def create_announcement(
    classroom_id: str,
    announcement_data: dict,
    current_user = Depends(get_current_user)
):
    """Create a new classroom announcement (teacher only)"""
    db = get_db()
    rbac = RBACService(db)

    if not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can create announcements"
        )

    ann_svc = AnnouncementsService(db)
    try:
        result = ann_svc.create_announcement(
            classroom_id,
            current_user["user_id"],
            announcement_data.get("title"),
            announcement_data.get("content"),
            announcement_data.get("target_groups", []),
            datetime.fromisoformat(announcement_data["scheduled_date"]) if announcement_data.get("scheduled_date") else None
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Get classroom announcements
@router.get("/{classroom_id}/announcements")
async def get_announcements(
    classroom_id: str,
    current_user = Depends(get_current_user)
):
    """Get announcements for classroom"""
    db = get_db()
    rbac = RBACService(db)

    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom"
        )

    ann_svc = AnnouncementsService(db)
    announcements = ann_svc.get_classroom_announcements(
        classroom_id,
        current_user["user_id"] if await rbac.is_student(current_user["user_id"], classroom_id) else None
    )

    return {"status": "success", "data": announcements}

# Mark announcement as viewed
@router.post("/{classroom_id}/announcements/{announcement_id}/view")
async def mark_viewed(
    classroom_id: str,
    announcement_id: str,
    current_user = Depends(get_current_user)
):
    """Mark announcement as viewed"""
    db = get_db()
    ann_svc = AnnouncementsService(db)

    try:
        result = ann_svc.mark_announcement_viewed(announcement_id, current_user["user_id"])
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Teacher: Update announcement
@router.put("/{classroom_id}/announcements/{announcement_id}")
async def update_announcement(
    classroom_id: str,
    announcement_id: str,
    update_data: dict,
    current_user = Depends(get_current_user)
):
    """Update announcement (teacher only)"""
    db = get_db()
    rbac = RBACService(db)

    if not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can update announcements"
        )

    ann_svc = AnnouncementsService(db)
    try:
        result = ann_svc.update_announcement(
            announcement_id,
            update_data.get("title"),
            update_data.get("content"),
            update_data.get("target_groups")
        )
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Teacher: Delete announcement
@router.delete("/{classroom_id}/announcements/{announcement_id}")
async def delete_announcement(
    classroom_id: str,
    announcement_id: str,
    current_user = Depends(get_current_user)
):
    """Delete announcement (teacher only)"""
    db = get_db()
    rbac = RBACService(db)

    if not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can delete announcements"
        )

    ann_svc = AnnouncementsService(db)
    try:
        result = ann_svc.delete_announcement(announcement_id)
        return {"status": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
