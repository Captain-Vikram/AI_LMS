import asyncio
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from bson import ObjectId
from database_async import get_db
from functions.search_doc import generate_skill_resources
from functions.youtube_education import generate_skill_playlist
from functions.resource_utils import _build_resources_from_outputs, _serialize_resource, _assessment_signature

# In-memory registry of active background job tasks so they can be (best-effort) cancelled
# Note: The system remains stateless as job status is primarily tracked in MongoDB
active_jobs: Dict[str, asyncio.Task] = {}


async def cancel_active_job(job_id: str) -> bool:
    """Attempt to cancel the running background task for a job if present."""
    task = active_jobs.get(job_id)
    if not task:
        return False
    try:
        task.cancel()
        return True
    except Exception:
        return False

async def update_job_status(job_id: str, status: str, progress: int = 0, result: Any = None, error: str = None, checkpoint: Dict[str, Any] = None, warning: str = None):
    db = get_db()
    now = datetime.utcnow()
    update_doc = {
        "status": status,
        "progress": progress,
        "updated_at": now
    }
    if result is not None:
        update_doc["result"] = result
    if error is not None:
        update_doc["error"] = error
    if warning is not None:
        update_doc["warning"] = warning
    
    update_op = {"$set": update_doc}
    if checkpoint:
        for k, v in checkpoint.items():
            update_op["$set"][f"checkpoints.{k}"] = v

    await db.ai_generation_jobs.update_one(
        {"_id": ObjectId(job_id)},
        update_op
    )

async def background_generate_resources(
    job_id: str,
    assessment_seed: Dict[str, Any],
    classroom_id: Optional[str] = None,
    user_id: Optional[str] = None,
    source: str = "ai",
    approval_status: str = "pending",
    force_refresh: bool = False
):
    """
    Stateless background worker for AI discovery.
    State is persisted in MongoDB (job status, checkpoints).
    """
    db = get_db()
    print(f"[JOB {job_id}] Worker started at {datetime.utcnow()}")

    # Register running task for cancellation support
    running = asyncio.current_task()
    if running:
        active_jobs[job_id] = running

    try:
        # 1. Load job state from DB (The source of truth)
        job_doc = await db.ai_generation_jobs.find_one({"_id": ObjectId(job_id)}) or {}
        if force_refresh:
            await db.ai_generation_jobs.update_one({"_id": ObjectId(job_id)}, {"$set": {"checkpoints": {}}})
            checkpoints = {}
        else:
            checkpoints = job_doc.get("checkpoints", {})

        # Check API Key statuses
        warnings = []
        if not os.getenv("TAVILY_API_KEY"):
            warnings.append("Tavily API key is missing (Web search/articles disabled, using Wikipedia fallbacks).")
        if not os.getenv("SERPER_API_KEY"):
            warnings.append("Serper API key is missing (Google Search reference links disabled).")
        
        warning_msg = " | ".join(warnings) if warnings else None

        # 2. Planning
        await update_job_status(job_id, "planning", progress=10, warning=warning_msg)
        
        # 3. Discovery (Parallel Search)
        await update_job_status(job_id, "searching", progress=30)

        # Build tasks based on checkpoints (Stateless resumption)
        search_tasks = []
        task_types = {}
        
        # We use a localized stop event for this specific worker execution
        worker_stop = asyncio.Event()

        if checkpoints.get("youtube_results") is None:
            t = asyncio.create_task(generate_skill_playlist(assessment_seed, stop_event=worker_stop))
            search_tasks.append(t)
            task_types[t] = "youtube"
        
        if checkpoints.get("web_results") is None:
            t = asyncio.create_task(generate_skill_resources(assessment_seed, stop_event=worker_stop))
            search_tasks.append(t)
            task_types[t] = "web"

        # Results accumulator
        youtube_results = checkpoints.get("youtube_results") or []
        web_results = checkpoints.get("web_results") or []

        while search_tasks:
            # Check DB for stop/cancellation requests (Stateless control)
            current_job = await db.ai_generation_jobs.find_one({"_id": ObjectId(job_id)}, {"stop_requested": 1})
            if current_job and current_job.get("stop_requested"):
                print(f"[JOB {job_id}] Stop requested via DB. Cancelling tasks.")
                worker_stop.set()
                for t in search_tasks: t.cancel()
                await update_job_status(job_id, "failed", error="Stopped by user")
                return

            done, pending = await asyncio.wait(search_tasks, timeout=2.0, return_when=asyncio.FIRST_COMPLETED)
            for t in done:
                search_tasks.remove(t)
                t_type = task_types.get(t)
                try:
                    res = await t
                    if t_type == "youtube":
                        youtube_results = res or []
                        await update_job_status(job_id, "searching", progress=55, checkpoint={"youtube_results": youtube_results})
                    else:
                        web_results = res or []
                        await update_job_status(job_id, "searching", progress=75, checkpoint={"web_results": web_results})
                except Exception as te:
                    print(f"[JOB {job_id}] Task {t_type} failed: {te}")
                    err_msg = str(te).lower()
                    if "429" in err_msg or "quota" in err_msg or "limit" in err_msg:
                        if "tavily" in err_msg:
                            key_warn = "Tavily Search API key quota is exhausted (HTTP 429)."
                        else:
                            key_warn = "Google Gemini API key quota is exhausted (HTTP 429)."
                        
                        warning_msg = (warning_msg + " | " if warning_msg else "") + key_warn
                        await update_job_status(job_id, "searching", progress=50, warning=warning_msg)

        # 4. Processing
        await update_job_status(job_id, "filtering", progress=90)
        resources = _build_resources_from_outputs(
            playlists=youtube_results,
            deepsearch_results=web_results,
            source=source,
            approval_status=approval_status,
        )
        
        # 5. Delivery (Persist results to target)
        if classroom_id:
            await db.classrooms.update_one(
                {"_id": ObjectId(classroom_id)},
                {
                    "$set": {
                        "ai_resources": resources,
                        "resource_generation_meta.status": "ready",
                        "resource_generation_meta.completed_at": datetime.utcnow()
                    }
                }
            )
        
        if user_id:
            signature = _assessment_signature(assessment_seed)
            await db.generated_personal_resources.update_one(
                {"user_id": ObjectId(user_id), "assessment_signature": signature},
                {"$set": {"resources": resources, "updated_at": datetime.utcnow()}},
                upsert=True
            )

        # 6. Completion
        await update_job_status(job_id, "ready", progress=100)
        print(f"[JOB {job_id}] Successfully completed at {datetime.utcnow()}")

    except asyncio.CancelledError:
        print(f"[JOB {job_id}] Worker task was cancelled.")
        await update_job_status(job_id, "failed", error="Worker process cancelled")
    except Exception as e:
        print(f"[JOB {job_id}] Fatal worker error: {e}")
        await update_job_status(job_id, "failed", error=str(e))
    finally:
        if job_id in active_jobs:
            del active_jobs[job_id]

