from pydantic import BaseModel
from datetime import datetime
from typing import Any, Dict, List, Optional
from enum import Enum


class ClassroomStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    DRAFT = "draft"


class StudentGroup(BaseModel):
    id: Optional[str] = None
    name: str
    description: str = ""
    students: List[str] = []
    created_date: datetime = datetime.utcnow()


class ClassroomSettings(BaseModel):
    allow_student_discussion: bool = True
    show_progress_to_students: bool = True
    require_attendance: bool = False
    grading_scale: str = "100"


class Classroom(BaseModel):
    id: Optional[str] = None
    institution_id: Optional[str] = None
    name: str
    subject: Optional[str] = None
    grade_level: Optional[str] = None
    description: str = ""
    subject_description: str = ""
    student_expectations: str = ""
    subject_focus_areas: List[str] = []
    teacher_id: Optional[str] = None
    co_teachers: List[str] = []
    students: List[str] = []
    student_groups: List[StudentGroup] = []
    max_students: Optional[int] = None
    status: ClassroomStatus = ClassroomStatus.ACTIVE
    start_date: datetime = datetime.utcnow()
    end_date: Optional[datetime] = None
    settings: ClassroomSettings = ClassroomSettings()
    enrollment_code: str = ""
    require_approval: bool = False
    curriculum_metadata: Optional[Dict[str, Any]] = None
    ai_resources: List[Dict[str, Any]] = []
    created_date: datetime = datetime.utcnow()
    updated_date: datetime = datetime.utcnow()
    archived_date: Optional[datetime] = None
