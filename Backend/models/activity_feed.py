"""
ActivityFeed Model
Stores real-time activity logs for the Activity Feed on the Teacher Dashboard.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from enum import Enum
import uuid


class ActivityType(str, Enum):
    """Types of activities logged in the activity feed"""
    QUIZ_PASSED = "quiz_passed"
    QUIZ_FAILED = "quiz_failed"
    RESOURCE_UNLOCKED = "resource_unlocked"
    AI_QUESTION_ASKED = "ai_question_asked"
    ASSESSMENT_SUBMITTED = "assessment_submitted"
    ASSESSMENT_GRADED = "assessment_graded"


class ActivityFeedEntry(BaseModel):
    """
    Single entry in the activity feed.
    Shows what student did and when.
    """
    id: Optional[str] = Field(None, alias="_id")
    classroom_id: str
    action_type: ActivityType
    student_id: str  # Student who performed the action
    action_performed_by_id: str  # Usually same as student_id, but for teacher grading, it's the teacher
    
    # Context
    resource_id: Optional[str] = None
    module_id: Optional[str] = None
    assessment_id: Optional[str] = None
    quiz_attempt_id: Optional[str] = None
    
    # Details (varies by action_type)
    details: Dict[str, Any] = {}  # Flexible schema
    
    # Metadata
    created_at: datetime
    visibility_until: Optional[datetime] = None  # For automatic pruning
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
