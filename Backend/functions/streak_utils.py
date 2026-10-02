"""
Shared streak calculation utilities.
Single source of truth for login-streak logic used by gamification and analytics.
"""
from datetime import datetime, timedelta
from typing import Set


def calculate_streak_from_dates(login_dates: Set) -> int:
    """
    Calculate consecutive active days ending today (or yesterday if not active today).

    Args:
        login_dates: A set of date objects representing days the user was active.

    Returns:
        Integer streak count.
    """
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


async def calculate_login_streak(db, user_id_obj) -> int:
    """
    Fetch login logs from DB and compute the streak for a given user ObjectId.
    Uses Motor (async) driver.
    """
    cursor = db.login_logs.find({"user_id": user_id_obj}, {"login_time": 1}).sort("login_time", -1)
    login_logs = await cursor.to_list(length=None)

    login_dates = {
        log.get("login_time").date()
        for log in login_logs
        if isinstance(log.get("login_time"), datetime)
    }

    return calculate_streak_from_dates(login_dates)
