from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from enum import Enum

class AnnouncementStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class Announcement(BaseModel):
    id: Optional[str] = None
    classroom_id: Optional[str] = None
    teacher_id: Optional[str] = None
    
    title: str
    content: str
    
    status: AnnouncementStatus = AnnouncementStatus.PUBLISHED
    
    # Targeting
    target_groups: List[str] = []  # Empty = all students
    
    # Metadata
    created_date: datetime = datetime.utcnow()
    updated_date: datetime = datetime.utcnow()
    scheduled_publish_date: Optional[datetime] = None
    
    # Engagement tracking
    views: int = 0
    viewed_by: List[str] = []  # User IDs who viewed
