import asyncio
from datetime import datetime
from database_async import connect_to_mongo, disconnect_from_mongo, get_db

async def main():
    await connect_to_mongo()
    db = get_db()

    statuses_to_stop = ["pending", "planning", "searching", "filtering", "stopping"]

    res = await db.ai_generation_jobs.update_many(
        {"status": {"$in": statuses_to_stop}},
        {
            "$set": {
                "status": "failed",
                "stop_requested": True,
                "error": "Manually stopped by operator",
                "updated_at": datetime.utcnow(),
            }
        },
    )

    print(f"Marked {res.modified_count if hasattr(res, 'modified_count') else res.matched_count} jobs as failed/stopped")
    await disconnect_from_mongo()

if __name__ == '__main__':
    asyncio.run(main())
