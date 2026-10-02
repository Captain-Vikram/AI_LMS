import shutil
import zipfile
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Body, File, Form, UploadFile
from typing import Dict, Any, List, Optional
from urllib.parse import quote_plus, urlparse
from datetime import datetime, timedelta
from database import get_db
from functions.utils import get_current_user
from services.skill_pathway_service import SkillPathwayService
from routes.project_analyzer.analyzer import ProjectAnalyzer
from routes.project_analyzer.github_utils import GitHubUtils
from routes.project_analyzer.router import read_project_files

_analyzer_instance = None
_github_utils_instance = None

def _get_analyzer_and_github():
    global _analyzer_instance, _github_utils_instance
    if not _analyzer_instance:
        _analyzer_instance = ProjectAnalyzer()
    if not _github_utils_instance:
        _github_utils_instance = GitHubUtils()
    return _analyzer_instance, _github_utils_instance

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
            if "total_stages" not in p:
                p["total_stages"] = len(p.get("stages", []))
        return {"status": "success", "data": pathways}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{pathway_id}")
def get_pathway_blueprint(
    pathway_id: str,
    db = Depends(get_db)
):
    """Get full blueprint of a specific skill pathway."""
    try:
        pathway = db.global_learning_pathways.find_one({"_id": pathway_id}, {"stages.resource_generation_prompt": 0})
        if not pathway:
            raise HTTPException(status_code=404, detail="Pathway not found")
        pathway["_id"] = str(pathway["_id"])
        if "total_stages" not in pathway:
            pathway["total_stages"] = len(pathway.get("stages", []))
        return {"status": "success", "data": pathway}
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
                {"title": 1, "description": 1, "stages": 1}
            )
            if pathway:
                progress["_id"] = str(progress["_id"])
                total_stages = len(pathway.get("stages", []))
                progress["pathway_details"] = {
                    "title": pathway.get("title"),
                    "description": pathway.get("description"),
                    "total_stages": total_stages
                }
                results.append(progress)
                
        return {"status": "success", "data": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/progress/{pathway_id}")
def get_specific_pathway_progress(
    pathway_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get detailed progress for a specific enrolled pathway."""
    try:
        student_id = str(current_user["user_id"])
        progress = db.student_pathway_progress.find_one({"student_id": student_id, "pathway_id": pathway_id})
        if not progress:
            raise HTTPException(status_code=404, detail="Not enrolled in this pathway")
            
        pathway = db.global_learning_pathways.find_one(
            {"_id": pathway_id},
            {"title": 1, "description": 1, "stages": 1}
        )
        
        progress["_id"] = str(progress["_id"])
        if pathway:
            total_stages = len(pathway.get("stages", []))
            progress["pathway_details"] = {
                "title": pathway.get("title"),
                "description": pathway.get("description"),
                "total_stages": total_stages
            }
            
        return {"status": "success", "data": progress}
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

@router.post("/{pathway_id}/stage/{stage_index}/submit-project")
async def submit_stage_project(
    pathway_id: str,
    stage_index: int,
    file: Optional[UploadFile] = File(None),
    repo_url: Optional[str] = Form(None),
    branch: Optional[str] = Form("main"),
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Analyze and submit a student's project for this stage using Project Analyzer."""
    student_id = str(current_user["user_id"])
    progress = db.student_pathway_progress.find_one({"student_id": student_id, "pathway_id": pathway_id})
    if not progress:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    pathway = db.global_learning_pathways.find_one({"_id": pathway_id})
    if not pathway:
        raise HTTPException(status_code=404, detail="Pathway blueprint not found")

    stage_blueprint = next((s for s in pathway.get("stages", []) if s["stage_index"] == stage_index), None)
    if not stage_blueprint:
        raise HTTPException(status_code=404, detail="Stage blueprint not found")

    analyzer, github_utils = _get_analyzer_and_github()

    # Collect project assessment context and topics as custom requirements
    project_prompt = stage_blueprint.get("project_assessment_prompt", "")
    topics = stage_blueprint.get("topics", [])
    custom_reqs = []
    for topic in topics:
        topic_name = topic.get("name") or ""
        subtopics = topic.get("subtopics") or []
        if topic_name:
            custom_reqs.append(f"{topic_name}: {', '.join(subtopics) if subtopics else ''}")

    analysis_req = {
        "project_topic": f"Stage {stage_index}: {stage_blueprint.get('title', 'Skill Pathway Project')}",
        "problem_statement": project_prompt,
        "custom_requirements": custom_reqs
    }

    files_data = []
    temp_zip_path = None
    extract_path = None
    repo_path = None

    try:
        if file and file.filename:
            if not file.filename.endswith('.zip'):
                raise HTTPException(status_code=400, detail="Only ZIP files are supported for project upload.")
            upload_dir = Path("./uploads")
            upload_dir.mkdir(exist_ok=True)
            safe_name = Path(file.filename).name
            temp_zip_path = upload_dir / f"stage_{pathway_id}_{stage_index}_{safe_name}"
            with open(temp_zip_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            extract_path = upload_dir / f"extracted_{safe_name.replace('.zip', '')}_{pathway_id}_{stage_index}"
            extract_path.mkdir(exist_ok=True)
            with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
                zip_ref.extractall(extract_path)

            files_data = await read_project_files(extract_path)
        elif repo_url and repo_url.strip():
            clean_url = repo_url.strip()
            if not clean_url.startswith(('https://github.com/', 'http://github.com/')):
                raise HTTPException(status_code=400, detail="Invalid GitHub URL.")
            repo_path = await github_utils.clone_repository(clean_url, branch or "main")
            files_data = await github_utils.read_project_files(repo_path)
        else:
            raise HTTPException(status_code=400, detail="Please provide either a ZIP file or a GitHub repository URL.")

        if not files_data:
            raise HTTPException(status_code=400, detail="No readable code files found in the submission.")

        # Run AI analysis
        analysis_result = await analyzer.analyze_project(files_data, analysis_req)
        score = analysis_result.get("final_verdict", {}).get("score", 0)
        grade = analysis_result.get("final_verdict", {}).get("grade", "F")
        passed = score >= 60

        # Save review report to progress
        update_fields = {
            "stage_progress.$.project_review": analysis_result,
            "stage_progress.$.project_score": score,
            "stage_progress.$.project_grade": grade,
        }

        if passed:
            update_fields["stage_progress.$.status"] = "completed"
            update_fields["stage_progress.$.project_completed"] = True

            # Unlock next stage
            next_stage_index = stage_index + 1
            db.student_pathway_progress.update_one(
                {"student_id": student_id, "pathway_id": pathway_id, "stage_progress.stage_index": next_stage_index},
                {"$set": {"stage_progress.$.status": "in-progress"}}
            )

        db.student_pathway_progress.update_one(
            {"student_id": student_id, "pathway_id": pathway_id, "stage_progress.stage_index": stage_index},
            {"$set": update_fields}
        )

        return {
            "status": "success",
            "passed": passed,
            "score": score,
            "grade": grade,
            "message": "Project passed! Stage completed and next stage unlocked." if passed else "Project analyzed. Review the feedback and make improvements to pass (60% required).",
            "report": analysis_result
        }

    finally:
        if temp_zip_path and temp_zip_path.exists():
            temp_zip_path.unlink()
        if extract_path and extract_path.exists():
            shutil.rmtree(extract_path, ignore_errors=True)
        if repo_path:
            await github_utils.cleanup(repo_path)

@router.post("/{pathway_id}/stage/{stage_index}/complete")
def complete_stage_manually(
    pathway_id: str,
    stage_index: int,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Mark a stage as completed (useful for project stages)."""
    try:
        student_id = str(current_user["user_id"])
        
        # 1. Mark stage as completed
        db.student_pathway_progress.update_one(
            {"student_id": student_id, "pathway_id": pathway_id, "stage_progress.stage_index": stage_index},
            {"$set": {"stage_progress.$.status": "completed", "stage_progress.$.project_completed": True}}
        )
        
        # 2. Unlock next stage
        next_stage_index = stage_index + 1
        db.student_pathway_progress.update_one(
            {"student_id": student_id, "pathway_id": pathway_id, "stage_progress.stage_index": next_stage_index},
            {"$set": {"stage_progress.$.status": "in-progress"}}
        )
        
        return {"status": "success", "message": "Stage marked as completed and next stage unlocked."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{pathway_id}/stage/{stage_index}/resource/{resource_id}/tests")
async def generate_resource_tests(
    pathway_id: str,
    stage_index: int,
    resource_id: str,
    service: SkillPathwayService = Depends(get_pathway_service),
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Generate tests for a specific resource in a pathway stage."""
    student_id = str(current_user["user_id"])
    progress = db.student_pathway_progress.find_one({"student_id": student_id, "pathway_id": pathway_id})
    if not progress:
        raise HTTPException(status_code=404, detail="Enrollment not found")
        
    stage_tracker = next((s for s in progress.get("stage_progress", []) if s["stage_index"] == stage_index), None)
    if not stage_tracker:
        raise HTTPException(status_code=404, detail="Stage not found")
        
    resource = next((r for r in stage_tracker.get("resources", []) if r["resource_id"] == resource_id), None)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
        
    result = await service.generate_tests_for_resource(pathway_id, stage_index, resource["title"])
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result

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
