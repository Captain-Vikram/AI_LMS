from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# --- IMMUTABLE BLUEPRINT ---
class PathwayTopic(BaseModel):
    name: str
    subtopics: List[str]

class PathwayStage(BaseModel):
    stage_index: int
    title: str
    prerequisites: List[int] = []  # Array of stage_indexes to complete first
    topics: List[PathwayTopic]
    resource_generation_prompt: str
    quiz_generation_prompt: str
    project_assessment_prompt: Optional[str] = None
    max_regenerations: int = 3

class GlobalSkillPathway(BaseModel):
    id: str = Field(alias="_id")  # e.g., "pathway_machine_learning"
    title: str
    description: str
    badges: List[Dict[str, Any]] # e.g., [{"stage_index": 1, "badge_name": "Math Whiz"}]
    stages: List[PathwayStage]

# --- STUDENT PROGRESS TRACKER ---
class GeneratedResource(BaseModel):
    resource_id: str
    title: str
    url: str
    type: str # "video" or "article"
    tests_taken: int = 0
    passed_tests_count: int = 0

class StageProgress(BaseModel):
    stage_index: int
    status: str = "locked" # locked, in-progress, completed
    regenerations_used: int = 0
    resources: List[GeneratedResource] = []
    project_completed: bool = False

class StudentPathwayProgress(BaseModel):
    id: Optional[str] = Field(None, alias="_id")
    student_id: str
    pathway_id: str
    current_streak: int = 0
    total_score: int = 0
    earned_badges: List[str] = []
    stage_progress: List[StageProgress] = []
    created_at: datetime = datetime.utcnow()
    last_accessed_at: Optional[datetime] = None
