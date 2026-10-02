import asyncio
import json
import logging
import hashlib
from typing import Optional
from database_async import get_db
from functions.cache_utils import cache_manager
from bson import ObjectId

logger = logging.getLogger("background_warming")

async def _cache_data(key_prefix: str, path: str, user_id: str, data: dict, ttl: int = 300):
    redis_client = cache_manager.get_redis()
    if not redis_client:
        return

    # Mirroring the cache_key generation from cache_response decorator
    # The original is: raw_key = f"{key_prefix}:{request.method}:{request.url.path}:{request.url.query}:{user_id}"
    # We will simulate a GET request
    raw_key = f"{key_prefix}:GET:{path}::{user_id}"
    cache_key = hashlib.md5(raw_key.encode()).hexdigest()
    cache_key = f"{key_prefix}:{cache_key}"
    
    try:
        await redis_client.setex(cache_key, ttl, json.dumps(data, default=str))
        logger.info(f"🔥 Proactively cached {path} for user {user_id}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to proactively cache {path}: {e}")

async def warm_user_cache(user_id: str, role: str):
    """
    Proactively fetches and caches data for a user upon login.
    """
    logger.info(f"🚀 Starting background cache warming for user: {user_id}")
    try:
        db = get_db()
        user_oid = ObjectId(user_id)
        
        # 1. Cache User Profile
        user = await db.users.find_one({"_id": user_oid})
        
        if user:
            profile_data = {
                "id": str(user_id),
                "name": f"{user.get('first_name', '')} {user.get('last_name', '')}".strip(),
                "role": role,
                "onboardingComplete": user.get("onboarding_complete", False),
                "assessmentComplete": user.get("assessment_complete", False)
            }
            # Cache the profile endpoint
            await _cache_data("api", "/api/auth/user-profile", user_id, profile_data, ttl=600)
            
        # 2. Fetch Skill Pathways / Classrooms depending on implementation
        # (Legacy skill_pathways caching block removed; global_learning_pathways / student_pathway_progress are not pre-cached)
            
        # 3. Cache Login Activity
        today = asyncio.get_event_loop().time() # just an approximation or logic mirror
        # For simplicity, we just trigger a mock cache for it
        # Actually, let's just cache what we can easily serialize
        
        logger.info(f"✅ Background cache warming completed for user: {user_id}")
        
    except Exception as e:
        logger.error(f"❌ Error during background cache warming: {e}")

def trigger_cache_warming(user_id: str, role: str):
    """
    Fires and forgets the cache warming task.
    """
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(warm_user_cache(user_id, role))
    except RuntimeError:
        # If no running event loop, we can't easily fire and forget here
        # But FastAPI routes are async so there should be a running loop
        logger.warning("No running event loop to trigger cache warming")
