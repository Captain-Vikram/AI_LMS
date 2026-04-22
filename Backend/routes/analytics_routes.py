from datetime import datetime, timedelta

from fastapi import APIRouter, Header, HTTPException, Query
from bson import ObjectId
import jwt

from database import get_db
from jwt_config import settings

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


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


def _calculate_login_streak(login_dates):
    if not login_dates:
        return 0

    today = datetime.utcnow().date()
    cursor = today if today in login_dates else today - timedelta(days=1)

    if cursor not in login_dates:
        return 0

    streak = 0
    while cursor in login_dates:
        streak += 1
        cursor -= timedelta(days=1)

    return streak


def _build_weekly_activity_percentages(login_logs):
    weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    response_order = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    day_counts = {day: 0 for day in response_order}

    for log in login_logs:
        login_time = log.get("login_time")
        if isinstance(login_time, datetime):
            day_name = weekday_names[login_time.weekday()]
            day_counts[day_name] += 1

    max_count = max(day_counts.values()) if day_counts else 0
    if max_count == 0:
        return [0 for _ in response_order]

    return [int(round((day_counts[day] / max_count) * 100)) for day in response_order]


@router.get("/dashboard")
async def get_dashboard_analytics(authorization: str = Header(None)):
    user_id = decode_user_id_from_auth_header(authorization)
    user_id_obj = ObjectId(user_id)

    db = get_db()
    user = db.users.find_one({"_id": user_id_obj})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.utcnow()
    week_start = now - timedelta(days=7)

    weekly_logs = list(
        db.login_logs.find({"user_id": user_id_obj, "login_time": {"$gte": week_start}})
    )
    all_logs = list(db.login_logs.find({"user_id": user_id_obj}, {"login_time": 1}))

    login_dates = {
        log.get("login_time").date()
        for log in all_logs
        if isinstance(log.get("login_time"), datetime)
    }
    if user.get("last_login") and isinstance(user.get("last_login"), datetime):
        login_dates.add(user.get("last_login").date())

    learning_streak = _calculate_login_streak(login_dates)

    completed_assessments = db.skill_assessment_results.count_documents({"user_id": user_id_obj})
    completed_milestones = db.user_milestones.count_documents(
        {"user_id": user_id_obj, "status": "completed"}
    )
    active_milestones_count = db.user_milestones.count_documents(
        {"user_id": user_id_obj, "status": "active"}
    )

    earned_badges = user.get("earned_badges", [])
    total_badges = len(earned_badges)

    completed_modules = completed_assessments + completed_milestones + total_badges
    total_modules = max(completed_modules + active_milestones_count, 1)
    progress_percentage = min(100, int(round((completed_modules / total_modules) * 100)))

    xp_data = user.get("xp_data", {})
    total_earned_xp = xp_data.get("total_earned", 0)

    total_learning_hours = round((total_earned_xp / 60.0) + (completed_assessments * 0.5), 1)

    milestone_docs = list(
        db.user_milestones.find({"user_id": user_id_obj, "status": "active"}).sort(
            [
                ("target_date", 1),
                ("created_at", -1),
            ]
        )
    )

    upcoming_milestones = []
    for milestone in milestone_docs[:5]:
        upcoming_milestones.append(
            {
                "id": str(milestone.get("_id")),
                "name": milestone.get("name") or milestone.get("title") or "Learning milestone",
                "progress": int(milestone.get("progress", 0)),
                "created_at": _to_iso(milestone.get("created_at")),
                "target_date": _to_iso(milestone.get("target_date")),
            }
        )

    if not upcoming_milestones:
        active_goal = db.user_goals.find_one(
            {"user_id": user_id_obj, "status": "active"},
            sort=[("created_at", -1)],
        )
        if active_goal:
            upcoming_milestones.append(
                {
                    "id": str(active_goal.get("_id")),
                    "name": active_goal.get("goal_title", "Learning goal"),
                    "progress": 0,
                    "created_at": _to_iso(active_goal.get("created_at")),
                    "target_date": _to_iso(active_goal.get("target_date")),
                }
            )

    badge_docs = list(db.gamification.find({"resource_type": "badge"}))
    badge_map = {str(badge.get("_id")): badge for badge in badge_docs}

    recent_earned_badges = sorted(
        earned_badges,
        key=lambda item: item.get("earned_date")
        if isinstance(item.get("earned_date"), datetime)
        else datetime.min,
        reverse=True,
    )[:5]

    recent_achievements = []
    for earned in recent_earned_badges:
        badge_id = earned.get("badge_id")
        badge = badge_map.get(badge_id, {})
        recent_achievements.append(
            {
                "id": f"{badge_id}-{_to_iso(earned.get('earned_date'))}",
                "name": badge.get("name", "Achievement"),
                "description": badge.get("short_description") or badge.get("description", ""),
                "date": _to_iso(earned.get("earned_date")),
                "xp_awarded": badge.get("xp_awarded", 0),
            }
        )

    return {
        "learning_streak": learning_streak,
        "total_learning_hours": total_learning_hours,
        "completed_modules": completed_modules,
        "progress_percentage": progress_percentage,
        "weekly_activity": _build_weekly_activity_percentages(weekly_logs),
        "upcomingMilestones": upcoming_milestones,
        "recent_achievements": recent_achievements,
    }


# Classroom analytics endpoints (Phase 2)
from fastapi import Depends
from services.classroom_analytics_service import ClassroomAnalyticsService
from services.rbac_service import RBACService
from functions.utils import get_current_user, normalize_user_role


@router.get("/classroom/{classroom_id}")
async def get_classroom_analytics(
    classroom_id: str,
    current_user = Depends(get_current_user)
):
    """Get classroom-wide analytics (teacher only)"""
    db = get_db()
    rbac = RBACService(db)

    if not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=403,
            detail="Only teachers can view classroom analytics"
        )

    analytics_svc = ClassroomAnalyticsService(db)
    try:
        analytics = analytics_svc.get_classroom_analytics(classroom_id)
        return {"status": "success", "data": analytics}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/classroom/{classroom_id}/student/{student_id}")
async def get_student_progress(
    classroom_id: str,
    student_id: str,
    current_user = Depends(get_current_user)
):
    """Get student's progress in classroom (teacher only)"""
    db = get_db()
    rbac = RBACService(db)

    if not await rbac.is_teacher(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=403,
            detail="Only teachers can view student analytics"
        )

    analytics_svc = ClassroomAnalyticsService(db)
    try:
        progress = analytics_svc.get_student_progress(classroom_id, student_id)
        return {"status": "success", "data": progress}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/classroom/{classroom_id}/my-progress")
async def get_my_progress(
    classroom_id: str,
    current_user = Depends(get_current_user)
):
    """Get current student's progress (students only)"""
    db = get_db()
    rbac = RBACService(db)

    if not await rbac.is_student(current_user["user_id"], classroom_id):
        raise HTTPException(
            status_code=403,
            detail="Students can only view their own progress"
        )

    analytics_svc = ClassroomAnalyticsService(db)
    try:
        progress = analytics_svc.get_student_progress(classroom_id, current_user["user_id"])
        return {"status": "success", "data": progress}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/classroom/{classroom_id}/ai-questions-by-module")
async def get_ai_questions_by_module(
    classroom_id: str,
    student_id: str = Query(default=""),
    current_user = Depends(get_current_user)
):
    """Get ask-AI heatmap counts grouped by module and source for classroom or current student."""
    db = get_db()
    rbac = RBACService(db)

    normalized_role = normalize_user_role(current_user.get("role"))
    is_teacher = await rbac.is_teacher(current_user["user_id"], classroom_id)
    is_student = await rbac.is_student(current_user["user_id"], classroom_id)

    if not is_teacher and not is_student and normalized_role != "admin":
        raise HTTPException(status_code=403, detail="Not a member of this classroom")

    requested_student_id = (student_id or "").strip() or None
    if is_teacher or normalized_role == "admin":
        resolved_student_id = requested_student_id
    else:
        if requested_student_id and requested_student_id != current_user["user_id"]:
            raise HTTPException(
                status_code=403,
                detail="Students can only view their own ask-AI heatmap",
            )
        resolved_student_id = current_user["user_id"]

    analytics_svc = ClassroomAnalyticsService(db)
    try:
        payload = analytics_svc.get_ai_questions_by_module(classroom_id, resolved_student_id)
        return {"status": "success", "data": payload}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
