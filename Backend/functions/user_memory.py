from datetime import datetime
from bson import ObjectId

async def update_user_memory(db, user_id: str, event_type: str, description: str, data: dict = None) -> str:
    """
    Updates the persistent AI Memory profile for the user in MongoDB.
    Tracks achievements, test scores, progress events, and learning pathways.
    MongoDB is the single source of truth — no local file writes.
    """
    user_oid = ObjectId(user_id)
    user = await db.users.find_one({"_id": user_oid})
    if not user:
        return ""

    # Get gamification data
    xp_data = user.get("xp_data", {"current": 0, "level": 1, "total_earned": 0})
    level = xp_data.get("level", 1)
    xp = xp_data.get("current", 0)
    total_earned = xp_data.get("total_earned", 0)

    # Compile interaction event
    now = datetime.utcnow()
    event = {
        "event_type": event_type,
        "description": description,
        "timestamp": now,
        "data": data or {}
    }

    # Push to memory log in MongoDB (keep last 50 events)
    await db.users.update_one(
        {"_id": user_oid},
        {
            "$push": {
                "ai_memory_events": {
                    "$each": [event],
                    "$slice": -50
                }
            }
        }
    )

    # Re-fetch user to get latest history
    user = await db.users.find_one({"_id": user_oid})
    history = user.get("ai_memory_events", [])

    # Format user career goals
    goals = user.get("onboarding_goals", {}) or {}
    primary_goal = goals.get("primary_goal") or user.get("primary_goal") or "General Learning"
    career_path = goals.get("career_path") or user.get("career_path") or "Not Specified"
    selected_skills = goals.get("selected_skills") or user.get("selected_skills") or []
    time_commitment = goals.get("time_commitment") or user.get("time_commitment") or "Moderate"

    # Construct the Markdown profile string
    md = f"""# Quasar EduSaarthi - AI User Memory & Progress Profile
*Persistent profile used by the AI assistant to customize subsequent learning sessions.*

## 👤 User Info
* **User ID**: {user_id}
* **Clerk Sub/ID**: {user.get("clerk_id", "N/A")}
* **Role**: {user.get("role", "student")}
* **Last Updated**: {now.strftime("%Y-%m-%d %H:%M:%S")} UTC

## 🎯 Onboarding & Learning Path
* **Primary Learning Goal**: {primary_goal}
* **Target Career Path**: {career_path}
* **Weekly Time Commitment**: {time_commitment}
* **Focus Skills**: {", ".join(selected_skills) if selected_skills else "None Selected"}

## 🎮 Gamification & Achievements
* **Current Level**: {level}
* **Current Level XP**: {xp}
* **Total XP Earned**: {total_earned}
* **Badges Unlocked**: {len(user.get("earned_badges", []))}

## 📈 Recent Activities & Progress Events (Last 10)
"""

    # Add activities
    recent_events = history[-10:] if history else []
    if recent_events:
        for idx, ev in enumerate(reversed(recent_events), 1):
            ts = ev.get("timestamp")
            ts_str = ts.strftime("%Y-%m-%d %H:%M") if isinstance(ts, datetime) else "N/A"
            md += f"{idx}. **[{ts_str}] {ev.get('event_type')}**: {ev.get('description')}\n"
            if ev.get("data"):
                md += f"   * *Metadata*: {ev.get('data')}\n"
    else:
        md += "* No activities logged yet.\n"

    # Persist markdown string back to MongoDB — single source of truth
    await db.users.update_one(
        {"_id": user_oid},
        {"$set": {"ai_memory_profile_md": md}}
    )

    return md
