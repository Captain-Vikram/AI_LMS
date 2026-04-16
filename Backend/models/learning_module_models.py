from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from enum import Enum

class ModuleStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class LearningObjective(BaseModel):
    id: Optional[str] = None
    title: str
    description: str
    bloom_level: str  # "knowledge", "comprehension", "application", etc.

class ModuleResource(BaseModel):
    id: Optional[str] = None
    title: str
    resource_type: str  # "video", "document", "link", "quiz"
    url: str
    description: str = ""
    order: int = 0

class ModuleAssessment(BaseModel):
    id: Optional[str] = None
    title: str
    assessment_type: str  # "quiz", "project", "discussion"
    points: int = 10
    passing_score: int = 70
    order: int = 0
    required: bool = True

class LearningModule(BaseModel):
    id: Optional[str] = None
    classroom_id: Optional[str] = None
    subject: str
    name: str
    description: str = ""
    order: int
    status: ModuleStatus = ModuleStatus.DRAFT
    
    # Content
    objectives: List[LearningObjective] = []
    resources: List[ModuleResource] = []
    assessments: List[ModuleAssessment] = []
    
    # Metadata
    estimated_hours: float = 0.0
    difficulty_level: str = "medium"  # "easy", "medium", "hard"
    target_skills: List[str] = []
    
    # Lifecycle
    created_date: datetime = datetime.utcnow()
    updated_date: datetime = datetime.utcnow()
    published_date: Optional[datetime] = None

class ClassroomCurriculum(BaseModel):
    id: Optional[str] = None
    classroom_id: Optional[str] = None
    name: str
    description: str = ""
    
    # Module sequence
    modules: List[str] = []  # module IDs in order
    total_estimated_hours: float = 0.0
    
    # Settings
    allow_module_skipping: bool = False
    require_sequential_completion: bool = True
    
    created_date: datetime = datetime.utcnow()
    updated_date: datetime = datetime.utcnow()
