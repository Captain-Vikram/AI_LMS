from database_async import connect_to_mongo, disconnect_from_mongo, get_db
import asyncio

async def main():
    await connect_to_mongo()
    db = get_db()
    jobs = await db.ai_generation_jobs.find({"stop_requested": True}).to_list(length=100)
    print("Found", len(jobs), "jobs with stop_requested=True")
    for job in jobs:
        print(job.get("_id"), job.get("status"), job.get("stop_requested"))
    await disconnect_from_mongo()

if __name__ == "__main__":
    asyncio.run(main())
