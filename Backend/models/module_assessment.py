"""
ModuleAssessment Model
Stores the Final Module Assessment (high-stakes test given at the end of a module).
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class AssessmentStatus(str, Enum):
    """Assessment publication status"""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class AssessmentQuestion(BaseModel):
    """Individual assessment question with points and rubric for subjective questions"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # "mcq" | "fill_blank" | "short_answer" | "essay"
    question_text: str
    options: Optional[List[str]] = None
    correct_answer: Optional[str] = None
    points: int
    expected_length: Optional[str] = None  # For essays, e.g., "100-150 words"
    rubric: Optional[str] = None  # Grading criteria for subjective questions


class ModuleAssessment(BaseModel):
    """
    Final Module Assessment.
    Created as draft, edited by teacher, then published.
    Students take it after completing all module resources.
    """
    id: Optional[str] = Field(None, alias="_id")
    module_id: str
    classroom_id: str
    created_by_teacher_id: str
    
    # Draft vs Published state
    status: AssessmentStatus = AssessmentStatus.DRAFT
    is_draft: bool = True
    is_published: bool = False
    published_at: Optional[datetime] = None
    
    # Assessment configuration
    title: str
    description: str
    total_points: int
    passing_score_percentage: float = 0.70  # 70% minimum to pass module
    
    # Execution rules
    time_limit_minutes: int = 60
    valid_from: datetime
    valid_until: datetime
    allow_retakes: bool = False
    shuffle_questions: bool = True
    
    # Question bank
    questions: List[AssessmentQuestion]
    
    # Metadata
    created_at: datetime
    updated_at: datetime
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
