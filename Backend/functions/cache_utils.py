import os
import json
import functools
import hashlib
import logging
from typing import Optional, Any, Callable
from datetime import timedelta
import redis.asyncio as redis
from fastapi import Request, Response
from fastapi.responses import JSONResponse

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cache_utils")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

class CacheManager:
    _instance: Optional['CacheManager'] = None
    _redis: Optional[redis.Redis] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CacheManager, cls).__new__(cls)
        return cls._instance

    async def connect(self):
        if self._redis is None:
            logger.info(f"🔗 Connecting to Redis at {REDIS_URL}...")
            try:
                self._redis = redis.from_url(REDIS_URL, decode_responses=True)
                await self._redis.ping()
                logger.info("✅ Connected to Redis successfully")
            except Exception as e:
                logger.error(f"❌ Failed to connect to Redis: {e}")
                self._redis = None

    async def disconnect(self):
        if self._redis:
            await self._redis.close()
            self._redis = None
            logger.info("✅ Disconnected from Redis")

    def get_redis(self) -> Optional[redis.Redis]:
        return self._redis

cache_manager = CacheManager()

def cache_response(ttl: int = 300, key_prefix: str = "api"):
    """
    Decorator to cache FastAPI response in Redis.
    ttl: Time to live in seconds (default 5 minutes).
    key_prefix: Prefix for the cache key.
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # 1. Get request object (needed for URL parsing)
            request: Optional[Request] = kwargs.get("request")
            if not request:
                for arg in args:
                    if isinstance(arg, Request):
                        request = arg
                        break
            
            redis_client = cache_manager.get_redis()
            
            # If no request or no redis, skip caching
            if not request or not redis_client:
                return await func(*args, **kwargs)

            # 2. Identify user for personalized caching
            current_user = kwargs.get("current_user")
            user_id = "anonymous"
            if current_user and isinstance(current_user, dict):
                user_id = current_user.get("user_id", "anonymous")
            
            # 3. Generate unique cache key
            # Includes method, path, query params, and user_id
            raw_key = f"{key_prefix}:{request.method}:{request.url.path}:{request.url.query}:{user_id}"
            cache_key = hashlib.md5(raw_key.encode()).hexdigest()
            cache_key = f"{key_prefix}:{cache_key}"

            # 4. Try to fetch from Redis
            try:
                cached_data = await redis_client.get(cache_key)
                if cached_data:
                    # logger.info(f"🎯 Cache HIT: {request.url.path}")
                    return JSONResponse(content=json.loads(cached_data))
            except Exception as e:
                logger.warning(f"⚠️ Cache read error: {e}")

            # 5. Execute route handler
            response = await func(*args, **kwargs)
            
            # 6. Store in Redis
            try:
                data_to_cache = None
                if isinstance(response, JSONResponse):
                    # JSONResponse body is bytes, we need to decode it
                    data_to_cache = response.body.decode()
                elif isinstance(response, (dict, list)):
                    data_to_cache = json.dumps(response)
                
                if data_to_cache:
                    await redis_client.setex(cache_key, ttl, data_to_cache)
                    # logger.info(f"💾 Cache MISS/SET: {request.url.path}")
            except Exception as e:
                logger.warning(f"⚠️ Cache write error: {e}")

            return response
        return wrapper
    return decorator

async def invalidate_cache(pattern: str = "api:*"):
    """Invalidate cache keys matching a pattern."""
    redis_client = cache_manager.get_redis()
    if not redis_client:
        return
    
    try:
        keys = await redis_client.keys(pattern)
        if keys:
            await redis_client.delete(*keys)
            logger.info(f"🧹 Invalidated {len(keys)} cache keys matching {pattern}")
    except Exception as e:
        logger.warning(f"⚠️ Cache invalidation error: {e}")
