import os
from pymongo import MongoClient
from dotenv import load_dotenv
import sys
from pathlib import Path
from datetime import datetime

# Add migrations directory to path
sys.path.insert(0, str(Path(__file__).parent / "migrations"))

load_dotenv(override=True)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/quasar")
MONGO_TIMEOUT_MS = int(os.getenv("MONGO_SERVER_SELECTION_TIMEOUT_MS", "5000"))

client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=MONGO_TIMEOUT_MS,
    connectTimeoutMS=MONGO_TIMEOUT_MS,
)

db = client.get_database("quasar") 
MIGRATION_001_NAME = "001_add_lms_collections"

def get_db():
    return db


def setup_phase_2_indexes():
    """Initialize Phase 2 collection indexes for efficient queries"""
    try:
        # Learning modules
        if "learning_modules" in db.list_collection_names() or True:
            db.learning_modules.create_index("classroom_id")
            db.learning_modules.create_index([("classroom_id", 1), ("status", 1)])
        
        # Announcements
        if "announcements" in db.list_collection_names() or True:
            db.announcements.create_index("classroom_id")
            db.announcements.create_index([("classroom_id", 1), ("created_date", -1)])
        
        # Assignments
        if "assignments" in db.list_collection_names() or True:
            db.assignments.create_index("classroom_id")
            db.assignments.create_index([("classroom_id", 1), ("due_date", 1)])
        
        # Assignment submissions
        if "assignment_submissions" in db.list_collection_names() or True:
            db.assignment_submissions.create_index([("classroom_id", 1), ("student_id", 1)])
            db.assignment_submissions.create_index([("assignment_id", 1), ("student_id", 1)])
        
        # Resource engagement tracking
        if "resource_engagement" in db.list_collection_names() or True:
            db.resource_engagement.create_index([("student_id", 1), ("resource_id", 1), ("module_id", 1)])
            db.resource_engagement.create_index([("module_id", 1), ("student_id", 1)])
            db.resource_engagement.create_index([("resource_id", 1), ("module_id", 1)])
        
        # Enrollment indexes
        db.classrooms.create_index("teacher_id")
        db.classrooms.create_index("students")
        db.classrooms.create_index([("teacher_id", 1), ("status", 1)])
        
        db.users.create_index("classroom_memberships.classroom_id")
        
        print("✅ Phase 2 database indexes created successfully")
    except Exception as e:
        print(f"⚠️  Warning: Could not create indexes: {e}")


def run_migrations():
    """Run all pending database migrations in order"""
    try:
        from migration_001_add_lms_collections import migrate_up as migrate_001_up

        # Track applied migrations so each version runs once per database.
        migration_collection = db.schema_migrations
        migration_collection.create_index("migration_name", unique=True)

        already_applied = migration_collection.find_one(
            {"migration_name": MIGRATION_001_NAME, "status": "applied"}
        )
        if already_applied:
            print("Migration 001 already applied, skipping")
            return

        print("Running migration 001: Adding LMS collections...")
        migrate_001_up(db)

        now = datetime.utcnow()
        migration_collection.update_one(
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


# Initialize indexes on module load
try:
    setup_phase_2_indexes()
except Exception as e:
    print(f"Database index setup error: {e}")

# Run migrations on module load
try:
    run_migrations()
except Exception as e:
    print(f"Database migration error: {e}")