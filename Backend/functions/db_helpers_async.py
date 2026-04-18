"""
Async database helpers for common operations.
Provides reusable async patterns for database operations.
"""

from typing import Any, Dict, List, Optional
from bson import ObjectId
from database_async import get_db


async def find_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """Find user document by ID (async)"""
    db = get_db()
    try:
        return await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None


async def find_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Find user document by email (async)"""
    db = get_db()
    return await db.users.find_one({"email": email})


async def find_classroom_by_id(classroom_id: str) -> Optional[Dict[str, Any]]:
    """Find classroom document by ID (async)"""
    db = get_db()
    try:
        return await db.classrooms.find_one({"_id": ObjectId(classroom_id)})
    except Exception:
        return None


async def find_quiz_result(user_id: str) -> Optional[Dict[str, Any]]:
    """Find latest quiz result for user (async)"""
    db = get_db()
    try:
        return await db.skill_assessment_results.find_one(
            {"user_id": ObjectId(user_id)},
            sort=[("timestamp", -1)],
        )
    except Exception:
        return None


async def insert_user(user_data: Dict[str, Any]) -> Optional[ObjectId]:
    """Insert new user document (async)"""
    db = get_db()
    result = await db.users.insert_one(user_data)
    return result.inserted_id


async def update_user(user_id: str, update_data: Dict[str, Any]) -> bool:
    """Update user document (async)"""
    db = get_db()
    try:
        result = await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0
    except Exception:
        return False


async def insert_quiz_result(result_data: Dict[str, Any]) -> Optional[ObjectId]:
    """Insert quiz assessment result (async)"""
    db = get_db()
    result = await db.skill_assessment_results.insert_one(result_data)
    return result.inserted_id


async def find_generated_playlists(
    user_id: str, 
    assessment_signature: str
) -> Optional[Dict[str, Any]]:
    """Find cached generated playlists (async)"""
    db = get_db()
    try:
        return await db.generated_playlists.find_one(
            {
                "user_id": ObjectId(user_id),
                "assessment_signature": assessment_signature,
            },
            sort=[("updated_at", -1)]
        )
    except Exception:
        return None


async def upsert_generated_playlists(
    user_id: str,
    assessment_signature: str,
    playlists: List[Dict[str, Any]],
    assessment_ref: Optional[str] = None,
) -> bool:
    """Update or insert generated playlists (async)"""
    db = get_db()
    from datetime import datetime
    
    try:
        result = await db.generated_playlists.update_one(
            {
                "user_id": ObjectId(user_id),
                "assessment_signature": assessment_signature,
            },
            {
                "$set": {
                    "playlists": playlists,
                    "assessment_signature": assessment_signature,
                    "assessment_ref": assessment_ref,
                    "updated_at": datetime.utcnow(),
                }
            },
            upsert=True,
        )
        return True
    except Exception as e:
        print(f"Error upserting playlists: {e}")
        return False


async def parallel_find_multiple(
    queries: List[tuple]
) -> List[Optional[Dict[str, Any]]]:
    """
    Execute multiple find queries in parallel.
    Each query tuple: (collection_name, filter_dict)
    Returns list of results in same order as queries.
    """
    import asyncio
    db = get_db()
    
    async def _find_one(collection_name: str, filter_dict: Dict[str, Any]):
        collection = db[collection_name]
        return await collection.find_one(filter_dict)
    
    tasks = [_find_one(coll_name, filter_dict) for coll_name, filter_dict in queries]
    return await asyncio.gather(*tasks, return_exceptions=False)


async def batch_insert(collection_name: str, documents: List[Dict[str, Any]]) -> List[ObjectId]:
    """Insert multiple documents in parallel (async)"""
    db = get_db()
    collection = db[collection_name]
    result = await collection.insert_many(documents)
    return result.inserted_ids


async def parallel_operations(*coroutines):
    """
    Execute multiple async operations in parallel.
    Usage: results = await parallel_operations(
        find_user_by_id(user_id),
        find_classroom_by_id(classroom_id),
        find_quiz_result(user_id),
    )
    """
    import asyncio
    return await asyncio.gather(*coroutines, return_exceptions=False)
