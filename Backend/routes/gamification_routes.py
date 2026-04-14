from datetime import datetime, timedelta
from typing import Dict, Any

from fastapi import APIRouter, HTTPException, Header
from bson import ObjectId
import jwt

from database import get_db
from jwt_config import settings

router = APIRouter(
    prefix="/api/gamification",
    tags=["gamification"],
    responses={404: {"description": "Not found"}},
)


XP_REWARDS = {
    "complete_assessment": 100,
    "improve_skill_level": 150,
    "complete_module": 50,
    "perfect_quiz_score": 75,
    "daily_login": 10,
    "learning_streak_day": 15,
    "contribute_to_community": 25,
}


def decode_user_id_from_auth_header(authorization: str) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authentication token")

    token = authorization.replace("Bearer ", "")

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid authentication token")
        return user_id
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")


def calculate_login_streak(db, user_id_obj: ObjectId) -> int:
    """Calculate consecutive active days ending today (or yesterday if not active today)."""
    login_logs = list(
        db.login_logs.find({"user_id": user_id_obj}, {"login_time": 1}).sort("login_time", -1)
    )

    login_dates = {
        log.get("login_time").date()
        for log in login_logs
        if isinstance(log.get("login_time"), datetime)
    }

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


def _serialize_date(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


@router.get("/xp")
async def get_user_xp(authorization: str = Header(None)):
    user_id = decode_user_id_from_auth_header(authorization)
    user_id_obj = ObjectId(user_id)

    db = get_db()
    user_data = db.users.find_one({"_id": user_id_obj})

    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")

    xp_data = user_data.get(
        "xp_data",
        {
            "current": 0,
            "level": 1,
            "level_threshold": 100,
            "total_earned": 0,
        },
    )

    streak = calculate_login_streak(db, user_id_obj)

    current_xp = xp_data.get("current", 0)
    return {
        "current": current_xp,
        "xp": current_xp,
        "level": xp_data.get("level", 1),
        "level_threshold": xp_data.get("level_threshold", 100),
        "total_earned": xp_data.get("total_earned", 0),
        "streak": streak,
    }


@router.post("/award-xp")
async def award_xp(activity_data: Dict[str, Any], authorization: str = Header(None)):
    user_id = decode_user_id_from_auth_header(authorization)
    db = get_db()

    activity_type = activity_data.get("activity_type")
    bonus_multiplier = activity_data.get("bonus_multiplier", 1.0)

    if activity_type not in XP_REWARDS:
        raise HTTPException(status_code=400, detail="Invalid activity type")

    xp_to_award = int(XP_REWARDS[activity_type] * bonus_multiplier)

    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    xp_data = user.get(
        "xp_data",
        {
            "current": 0,
            "level": 1,
            "level_threshold": 100,
            "total_earned": 0,
        },
    )

    xp_data["current"] += xp_to_award
    xp_data["total_earned"] += xp_to_award

    level_up = False
    while xp_data["current"] >= xp_data["level_threshold"]:
        xp_data["current"] -= xp_data["level_threshold"]
        xp_data["level"] += 1
        xp_data["level_threshold"] = calculate_next_level_threshold(xp_data["level"])
        level_up = True

    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"xp_data": xp_data}})

    db.xp_activities.insert_one(
        {
            "user_id": ObjectId(user_id),
            "activity_type": activity_type,
            "xp_awarded": xp_to_award,
            "timestamp": datetime.utcnow(),
            "metadata": activity_data.get("metadata", {}),
        }
    )

    return {
        "xp_awarded": xp_to_award,
        "new_xp": xp_data["current"],
        "level": xp_data["level"],
        "level_threshold": xp_data["level_threshold"],
        "level_up": level_up,
    }


@router.get("/badges")
async def get_user_badges(authorization: str = Header(None)):
    user_id = decode_user_id_from_auth_header(authorization)
    db = get_db()

    all_badges = list(db.gamification.find({"resource_type": "badge"}))

    user_data = db.users.find_one({"_id": ObjectId(user_id)})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")

    earned_badges = user_data.get("earned_badges", [])
    badge_progress = user_data.get("badge_progress", {})

    result = []
    for badge in all_badges:
        badge_id = str(badge["_id"])
        earned_record = next((eb for eb in earned_badges if eb.get("badge_id") == badge_id), None)
        is_unlocked = earned_record is not None

        badge_data = {
            "id": badge_id,
            "name": badge.get("name"),
            "description": badge.get("description"),
            "short_description": badge.get("short_description"),
            "category": badge.get("category"),
            "color": badge.get("color"),
            "icon": badge.get("icon"),
            "unlocked": is_unlocked,
            "xp_awarded": badge.get("xp_awarded", 0),
            "earned_date": _serialize_date(earned_record.get("earned_date")) if earned_record else None,
            "reward": badge.get("reward"),
        }

        if not is_unlocked and badge_id in badge_progress:
            progress_data = badge_progress[badge_id]
            badge_data["progress"] = {
                "current": progress_data.get("current", 0),
                "required": badge.get("conditions", {}).get("threshold", 0),
            }

        result.append(badge_data)

    return {"badges": result}


@router.get("/achievements/recent")
async def get_recent_achievements(authorization: str = Header(None)):
    user_id = decode_user_id_from_auth_header(authorization)
    db = get_db()

    user_data = db.users.find_one({"_id": ObjectId(user_id)})
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")

    earned_badges = user_data.get("earned_badges", [])
    if not earned_badges:
        return {"achievements": []}

    all_badges = list(db.gamification.find({"resource_type": "badge"}))
    badge_by_id = {str(badge["_id"]): badge for badge in all_badges}

    def _earned_sort_key(item):
        earned_date = item.get("earned_date")
        if isinstance(earned_date, datetime):
            return earned_date
        return datetime.min

    sorted_earned_badges = sorted(earned_badges, key=_earned_sort_key, reverse=True)

    achievements = []
    for earned in sorted_earned_badges[:10]:
        badge_id = earned.get("badge_id")
        badge = badge_by_id.get(badge_id, {})
        achievements.append(
            {
                "id": f"{badge_id}-{_serialize_date(earned.get('earned_date'))}",
                "badge_id": badge_id,
                "name": badge.get("name", "Achievement"),
                "description": badge.get("short_description") or badge.get("description", ""),
                "earned_date": _serialize_date(earned.get("earned_date")),
                "xp_awarded": badge.get("xp_awarded", 0),
            }
        )

    return {"achievements": achievements}


def calculate_next_level_threshold(level):
    return int(100 * (level ** 1.5))