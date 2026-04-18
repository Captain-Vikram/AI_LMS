from fastapi import APIRouter, Depends, HTTPException, status
from database import get_db
from bson import ObjectId

from services.dashboard_service import DashboardService
from services.rbac_service import RBACService
from functions.utils import get_current_user

router = APIRouter(prefix="/api/classroom", tags=["dashboard"])

@router.get("/{classroom_id}/dashboard")
async def get_classroom_dashboard(
    classroom_id: str,
    current_user = Depends(get_current_user)
):
    """Get classroom dashboard (role-specific)"""
    db = get_db()
    rbac = RBACService(db)
    dashboard_svc = DashboardService(db)

    # Check classroom membership
    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom"
        )

    try:
        # Return role-specific dashboard
        if await rbac.is_teacher(current_user["user_id"], classroom_id):
            dashboard = dashboard_svc.get_teacher_dashboard(
                classroom_id,
                current_user["user_id"]
            )
        else:
            dashboard = dashboard_svc.get_student_dashboard(
                classroom_id,
                current_user["user_id"]
            )

        return {"status": "success", "data": dashboard}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{classroom_id}/overview")
async def get_classroom_overview(
    classroom_id: str,
    current_user = Depends(get_current_user)
):
    """Get classroom overview statistics"""
    db = get_db()
    rbac = RBACService(db)
    dashboard_svc = DashboardService(db)

    if not await rbac.is_classroom_member(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this classroom"
        )

    try:
        overview = dashboard_svc.get_classroom_overview(classroom_id)
        return {"status": "success", "data": overview}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
