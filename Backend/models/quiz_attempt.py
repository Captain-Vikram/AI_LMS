"""
QuizAttempt Model
Stores each individual quiz attempt with questions, answers, scores, and feedback.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum
import uuid


class QuestionType(str, Enum):
    """Supported question types for quizzes"""
    MCQ = "mcq"
    FILL_BLANK = "fill_blank"
    SHORT_ANSWER = "short_answer"


class QuizQuestion(BaseModel):
    """Individual quiz question with correct answer and student response"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: QuestionType
    question_text: str
    options: Optional[List[str]] = None  # For MCQs
    correct_answer: str
    points: int
    student_answer: Optional[str] = None  # Null until submitted
    is_correct: Optional[bool] = None  # Null until submitted


class QuizAttempt(BaseModel):
    """
    Single quiz attempt for a resource.
    Created when student clicks "Take Test", graded when submitted.
    """
    id: Optional[str] = Field(None, alias="_id")
    resource_id: str
    student_id: str
    classroom_id: str
    module_id: str
    
    # Quiz content
    questions: List[QuizQuestion]
    total_points: int
    score_obtained: int = 0
    score_percentage: float = 0.0
    passed: bool = False
    
    # Feedback (generated after submission)
    ai_feedback: str = ""
    
    # Execution timing
    started_at: datetime
    submitted_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    attempt_number: int  # 1 for first attempt, 2 for second, etc.
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
