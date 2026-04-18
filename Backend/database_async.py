"""
Async MongoDB connection using Motor driver
Provides async database operations for FastAPI application
"""

import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

# Add migrations directory to path
sys.path.insert(0, str(Path(__file__).parent / "migrations"))

load_dotenv(override=True)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")
MONGO_TIMEOUT_MS = int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000"))

# Global async client and database instances
_async_client: Optional[AsyncIOMotorClient] = None
_async_db: Optional[AsyncIOMotorDatabase] = None

MIGRATION_001_NAME = "001_add_lms_collections"


async def connect_to_mongo() -> AsyncIOMotorDatabase:
    """
    Initialize async MongoDB connection using Motor.
    Call this during FastAPI startup event.
    """
    global _async_client, _async_db
    
    _async_client = AsyncIOMotorClient(
        MONGO_URI,
        serverSelectionTimeoutMS=MONGO_TIMEOUT_MS,
        connectTimeoutMS=MONGO_TIMEOUT_MS,
    )
    
    _async_db = _async_client.get_database("quasar")
    
    # Verify connection
    try:
        await _async_db.client.admin.command('ping')
        print("✅ Connected to MongoDB asynchronously")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        raise
    
    return _async_db


async def disconnect_from_mongo():
    """
    Close async MongoDB connection.
    Call this during FastAPI shutdown event.
    """
    global _async_client
    
    if _async_client:
        _async_client.close()
        print("✅ Disconnected from MongoDB")


def get_db() -> AsyncIOMotorDatabase:
    """
    Get the async database instance.
    Must be called after connect_to_mongo() has been called.
    """
    if _async_db is None:
        raise RuntimeError(
            "Database not initialized. Call connect_to_mongo() during app startup."
        )
    return _async_db


async def setup_phase_2_indexes():
    """Asynchronously initialize Phase 2 collection indexes for efficient queries"""
    db = get_db()
    
    try:
        # Learning modules
        await db.learning_modules.create_index("classroom_id")
        await db.learning_modules.create_index([("classroom_id", 1), ("status", 1)])
        
        # Announcements
        await db.announcements.create_index("classroom_id")
        await db.announcements.create_index([("classroom_id", 1), ("created_date", -1)])
        
        # Assignments
        await db.assignments.create_index("classroom_id")
        await db.assignments.create_index([("classroom_id", 1), ("due_date", 1)])
        
        # Assignment submissions
        await db.assignment_submissions.create_index([("classroom_id", 1), ("student_id", 1)])
        await db.assignment_submissions.create_index([("assignment_id", 1), ("student_id", 1)])
        
        # Resource engagement tracking
        await db.resource_engagement.create_index([("student_id", 1), ("resource_id", 1), ("module_id", 1)])
        await db.resource_engagement.create_index([("module_id", 1), ("student_id", 1)])
        await db.resource_engagement.create_index([("resource_id", 1), ("module_id", 1)])
        
        # Enrollment indexes
        await db.classrooms.create_index("teacher_id")
        await db.classrooms.create_index("students")
        await db.classrooms.create_index([("teacher_id", 1), ("status", 1)])
        
        await db.users.create_index("classroom_memberships.classroom_id")
        
        print("✅ Phase 2 database indexes created successfully")
    except Exception as e:
        print(f"⚠️  Warning: Could not create indexes: {e}")


async def run_migrations():
    """Asynchronously run all pending database migrations in order"""
    db = get_db()
    
    try:
        from migration_001_add_lms_collections import migrate_up as migrate_001_up

        # Track applied migrations so each version runs once per database.
        migration_collection = db.schema_migrations
        await migration_collection.create_index("migration_name", unique=True)

        already_applied = await migration_collection.find_one(
            {"migration_name": MIGRATION_001_NAME, "status": "applied"}
        )
        if already_applied:
            print("Migration 001 already applied, skipping")
            return

        print("Running migration 001: Adding LMS collections...")
        # Note: If migrate_001_up is synchronous, we need to run it in executor
        migrate_001_up(db)

        now = datetime.utcnow()
        await migration_collection.update_one(
            {"migration_name": MIGRATION_001_NAME},
            {
                "$set": {
                    "migration_name": MIGRATION_001_NAME,
                    "status": "applied",
                    "applied_at": now,
                    "updated_at": now,
                }
            },
            upsert=True,
        )
        print("Migration 001 marked as applied")
    except ImportError:
        print("⚠️  Migration 001 module not found, skipping")
    except Exception as e:
        print(f"⚠️  Error running migration 001: {e}")


async def init_db():
    """
    Initialize database on application startup.
    Call this from FastAPI startup event.
    """
    await connect_to_mongo()
    await setup_phase_2_indexes()
    await run_migrations()
