"""
StudentProgress Model
Tracks each student's progression through each resource in each module.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class ChatHistoryItem(BaseModel):
    """Individual Q&A entry in the chat history"""
    question: str
    answer: str
    asked_at: datetime


class StudentProgress(BaseModel):
    """
    Tracks student progress on a specific resource within a module.
    One record per student per resource.
    """
    id: Optional[str] = Field(None, alias="_id")
    student_id: str
    classroom_id: str
    module_id: str
    resource_id: str
    
    # Unlocking logic
    is_unlocked: bool = False
    unlocked_at: Optional[datetime] = None
    
    # Quiz attempt tracking
    tests_taken: int = 0
    passed_tests_count: int = 0
    failed_tests_count: int = 0
    highest_score: Optional[float] = None
    last_test_date: Optional[datetime] = None
    
    # AI interaction history (single-turn only)
    single_turn_chat_history: List[ChatHistoryItem] = []
    
    # Metadata
    created_at: datetime
    updated_at: datetime
    last_accessed_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
