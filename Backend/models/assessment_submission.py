"""
AssessmentSubmission Model
Stores each student's submission for a Final Module Assessment.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class GradingStatus(str, Enum):
    """Current grading state of a submission"""
    AUTO_GRADED = "auto_graded"
    PENDING_MANUAL_GRADE = "pending_manual_grade"
    FULLY_GRADED = "fully_graded"


class StudentAnswer(BaseModel):
    """Student's answer to a single assessment question"""
    question_id: str
    student_answer: str
    type: str  # "mcq" | "fill_blank" | "short_answer" | "essay"


class AssessmentSubmission(BaseModel):
    """
    Student's submission for a Final Module Assessment.
    Auto-graded immediately for MCQs/fill-blanks.
    Flagged for manual grading for essays/subjective questions.
    """
    id: Optional[str] = Field(None, alias="_id")
    assessment_id: str
    student_id: str
    classroom_id: str
    module_id: str
    
    # Execution timing
    started_at: datetime
    submitted_at: Optional[datetime] = None
    time_spent_seconds: Optional[int] = None
    
    # Submission content
    answers: List[StudentAnswer]
    
    # Grading state
    grading_status: GradingStatus = GradingStatus.AUTO_GRADED
    
    # Auto-graded results (immediate)
    auto_graded_score: int = 0
    auto_graded_at: Optional[datetime] = None
    
    # Manual grading results (teacher adds these)
    manual_graded_score: int = 0
    graded_by_teacher_id: Optional[str] = None
    manual_graded_at: Optional[datetime] = None
    teacher_feedback: Optional[str] = None
    
    # Final score
    total_score: int = 0
    score_percentage: float = 0.0
    passed: bool = False
    is_final_score: bool = False
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
