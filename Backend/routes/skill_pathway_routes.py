from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Dict, Any, List
from urllib.parse import quote_plus, urlparse
from datetime import datetime, timedelta
from database import get_db
from functions.utils import get_current_user
from services.skill_pathway_service import SkillPathwayService

router = APIRouter(prefix="/api/pathways", tags=["Skill Pathways"])


def _is_youtube_shorts_url(url: str) -> bool:
    parsed = urlparse(str(url or "").strip())
    host = parsed.netloc.lower().replace("www.", "")

    if host not in {"youtube.com", "m.youtube.com", "youtube-nocookie.com", "youtu.be"}:
        return False

    path = (parsed.path or "").lower()
    return path.startswith("/shorts/") or "/shorts/" in path


def _sanitize_tracker_resources(stage_tracker: Dict[str, Any]) -> Dict[str, Any]:
    """Avoid returning shorts URLs so the skill UI only exposes long-form-friendly links."""
    tracker_copy = dict(stage_tracker or {})
    raw_resources = tracker_copy.get("resources", [])
    resources = raw_resources if isinstance(raw_resources, list) else []

    sanitized_resources: List[Dict[str, Any]] = []
    for resource in resources:
        resource_copy = dict(resource or {})
        resource_url = str(resource_copy.get("url") or "").strip()
        resource_title = str(resource_copy.get("title") or "lesson").strip()

        if str(resource_copy.get("type", "")).lower() == "video" and _is_youtube_shorts_url(resource_url):
            resource_copy["url"] = (
                f"https://www.youtube.com/results?search_query={quote_plus(resource_title + ' tutorial')}"
            )

        sanitized_resources.append(resource_copy)

    tracker_copy["resources"] = sanitized_resources
    return tracker_copy

def get_pathway_service(db = Depends(get_db)) -> SkillPathwayService:
    return SkillPathwayService(db)

@router.get("/available")
def get_available_pathways(
    db = Depends(get_db)
):
    """List all available standalone skill pathways."""
    try:
        pathways = list(db.global_learning_pathways.find({}, {"stages.resource_generation_prompt": 0}))
        for p in pathways:
            p["_id"] = str(p["_id"])
        return {"status": "success", "data": pathways}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{pathway_id}/enroll")
def enroll_in_pathway(
    pathway_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Enroll a student in a specific skill pathway."""
    try:
        pathway = db.global_learning_pathways.find_one({"_id": pathway_id})
        if not pathway:
            raise HTTPException(status_code=404, detail="Pathway not found")
            
        student_id = str(current_user["user_id"])
        existing_progress = db.student_pathway_progress.find_one({
            "student_id": student_id,
            "pathway_id": pathway_id
        })
        
        if existing_progress:
            return {"status": "success", "message": "Already enrolled", "data": {"progress_id": str(existing_progress["_id"])}}
            
        import datetime
        progress_doc = {
            "student_id": student_id,
            "pathway_id": pathway_id,
            "current_streak": 0,
            "total_score": 0,
            "earned_badges": [],
            "stage_progress": [{"stage_index": s["stage_index"], "status": "locked", "regenerations_used": 0, "resources": [], "project_completed": False} for s in pathway.get("stages", [])],
            "created_at": datetime.datetime.utcnow()
        }
        
        # Unlock first stage
        if progress_doc["stage_progress"]:
            progress_doc["stage_progress"][0]["status"] = "in-progress"
            
        result = db.student_pathway_progress.insert_one(progress_doc)
        return {"status": "success", "message": "Successfully enrolled", "data": {"progress_id": str(result.inserted_id)}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/progress/my-pathways")
def get_my_pathways(
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get the progress dashboard for all enrolled standalone pathways."""
    try:
        student_id = str(current_user["user_id"])
        enrolled = list(db.student_pathway_progress.find({"student_id": student_id}))
        
        results = []
        for progress in enrolled:
            pathway = db.global_learning_pathways.find_one(
                {"_id": progress["pathway_id"]},
                {"title": 1, "description": 1, "total_stages": 1}
            )
            if pathway:
                progress["_id"] = str(progress["_id"])
                progress["pathway_details"] = {
                    "title": pathway.get("title"),
                    "description": pathway.get("description"),
                    "total_stages": pathway.get("total_stages")
                }
                results.append(progress)
                
        return {"status": "success", "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{pathway_id}/stage/{stage_index}")
def get_stage_details(
    pathway_id: str,
    stage_index: int,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Fetch specific stage progress and resource details."""
    try:
        student_id = str(current_user["user_id"])
        progress = db.student_pathway_progress.find_one({"student_id": student_id, "pathway_id": pathway_id})
        if not progress:
            raise HTTPException(status_code=404, detail="Not enrolled in this pathway")
            
        stage_tracker = next((s for s in progress.get("stage_progress", []) if s["stage_index"] == stage_index), None)
        if not stage_tracker:
            raise HTTPException(status_code=404, detail="Stage not found in progress")
            
        pathway = db.global_learning_pathways.find_one({"_id": pathway_id})
        stage_blueprint = next((s for s in pathway.get("stages", []) if s["stage_index"] == stage_index), None)
        
        return {
            "status": "success", 
            "data": {
                "tracker": _sanitize_tracker_resources(stage_tracker),
                "blueprint_topics": stage_blueprint.get("topics", []),
                "project_prompt": stage_blueprint.get("project_assessment_prompt", ""),
                "quiz_prompt": stage_blueprint.get("quiz_generation_prompt", ""),
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{pathway_id}/stage/{stage_index}/generate-resources")
async def trigger_resource_generation(
    pathway_id: str,
    stage_index: int,
    service: SkillPathwayService = Depends(get_pathway_service),
    current_user: dict = Depends(get_current_user)
):
    """Trigger AI generation of 5 videos and 5 articles for this stage."""
    student_id = str(current_user["user_id"])
    result = await service.generate_stage_resources(student_id, pathway_id, stage_index)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

@router.post("/{pathway_id}/stage/{stage_index}/submit-test")
def submit_resource_test(
    pathway_id: str,
    stage_index: int,
    payload: Dict[str, Any] = Body(...),
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Submit a test for a specific resource, auto-advance stage if complete."""
    try:
        student_id = str(current_user["user_id"])
        resource_id = payload.get("resource_id")
        score_percent = payload.get("score_percent", 0)
        
        if score_percent < 80:
            return {"status": "success", "message": "Score below 80%. Test failed.", "passed": False}

        # Simplified logic: increment passed tests for the resource
        progress = db.student_pathway_progress.find_one({"student_id": student_id, "pathway_id": pathway_id})
        if not progress:
            raise HTTPException(status_code=404, detail="Enrollment not found")

        # Maintain streak based strictly on successful skill tests (not logins).
        now_utc = datetime.utcnow()
        today = now_utc.date()
        last_test_at = progress.get("last_test_at")
        last_test_date = None
        if isinstance(last_test_at, datetime):
            last_test_date = last_test_at.date()
        elif isinstance(last_test_at, str):
            try:
                last_test_date = datetime.fromisoformat(last_test_at).date()
            except ValueError:
                last_test_date = None

        current_streak = int(progress.get("current_streak", 0) or 0)
        if last_test_date == today:
            updated_streak = max(current_streak, 1)
        elif last_test_date == (today - timedelta(days=1)):
            updated_streak = current_streak + 1
        else:
            updated_streak = 1

        db.student_pathway_progress.update_one(
            {"student_id": student_id, "pathway_id": pathway_id},
            {"$set": {"current_streak": updated_streak, "last_test_at": now_utc}}
        )
        
        stage_tracker = next((s for s in progress["stage_progress"] if s["stage_index"] == stage_index), None)
        if not stage_tracker:
            raise HTTPException(status_code=404, detail="Stage not found")
            
        all_passed = True
        for r in stage_tracker.get("resources", []):
            if r["resource_id"] == resource_id:
                r["passed_tests_count"] += 1
            if r["passed_tests_count"] < 2:
                all_passed = False
                
        # Update progress
        db.student_pathway_progress.update_one(
            {"student_id": student_id, "pathway_id": pathway_id, "stage_progress.stage_index": stage_index},
            {"$set": {"stage_progress.$.resources": stage_tracker["resources"]}}
        )
        
        if all_passed:
            # Mark complete and unlock next
            stage_tracker["status"] = "completed"
            db.student_pathway_progress.update_one(
                {"student_id": student_id, "pathway_id": pathway_id, "stage_progress.stage_index": stage_index},
                {"$set": {"stage_progress.$.status": "completed"}}
            )
            # Unlock next stage
            next_stage_index = stage_index + 1
            db.student_pathway_progress.update_one(
                {"student_id": student_id, "pathway_id": pathway_id, "stage_progress.stage_index": next_stage_index},
                {"$set": {"stage_progress.$.status": "in-progress"}}
            )
            return {"status": "success", "message": "Test passed! Stage completed and Next Stage Unlocked!", "passed": True, "stage_completed": True}

        return {"status": "success", "message": "Test passed! Complete another test to master this resource.", "passed": True, "stage_completed": False}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
