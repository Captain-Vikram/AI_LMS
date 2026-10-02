"""
Redis-backed quiz cache.
Replaces the in-memory dict quiz_cache = {} in mcq_routes.py.
Handles serialization, TTL, and graceful degradation when Redis is unavailable.
"""
import json
import logging
from typing import Any, Dict, Optional

from functions.cache_utils import cache_manager

logger = logging.getLogger("quiz_cache")

QUIZ_TTL_SECONDS = 1800  # 30 minutes — enough time to take a quiz


async def store_quiz(quiz_id: str, quiz_content: Dict[str, Any]) -> None:
    """Persist quiz data to Redis with TTL."""
    redis = cache_manager.get_redis()
    if redis is None:
        logger.warning("Redis unavailable — quiz %s not cached persistently.", quiz_id)
        return
    try:
        await redis.setex(f"quiz:{quiz_id}", QUIZ_TTL_SECONDS, json.dumps(quiz_content))
    except Exception as exc:
        logger.warning("Failed to store quiz %s in Redis: %s", quiz_id, exc)


async def get_quiz(quiz_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve quiz data from Redis. Returns None if missing or expired."""
    redis = cache_manager.get_redis()
    if redis is None:
        return None
    try:
        raw = await redis.get(f"quiz:{quiz_id}")
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.warning("Failed to retrieve quiz %s from Redis: %s", quiz_id, exc)
    return None


async def delete_quiz(quiz_id: str) -> None:
    """Remove a quiz from Redis after submission to free memory."""
    redis = cache_manager.get_redis()
    if redis is None:
        return
    try:
        await redis.delete(f"quiz:{quiz_id}")
    except Exception as exc:
        logger.warning("Failed to delete quiz %s from Redis: %s", quiz_id, exc)
