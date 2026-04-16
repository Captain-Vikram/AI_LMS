from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List
from enum import Enum

class UserRegistration(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    location: Optional[str] = None
    role: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


# This model is used internally for user documents in Users collection
class UserInDB(BaseModel):
    email: EmailStr
    password_hash: str
    registration_date: datetime
    last_login: Optional[datetime] = None
    status: str = "active"


# New models for Phase 1 (roles, memberships)
class UserRole(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class ClassroomMembership(BaseModel):
    classroom_id: Optional[str] = None
    role: str = "student"
    joined_date: Optional[datetime] = None
    is_active: bool = True
    onboarding_complete: bool = False
    assessment_complete: bool = False


class UserModel(BaseModel):
    email: EmailStr
    password_hash: str
    registration_date: datetime
    last_login: Optional[datetime] = None
    status: str = "active"
    role: UserRole = UserRole.STUDENT
    institution_id: Optional[str] = None
    classroom_memberships: List[ClassroomMembership] = []
    created_date: datetime = datetime.utcnow()
    updated_date: datetime = datetime.utcnow()
    # Backward compatible flags
    onboarding_complete: Optional[bool] = None
    assessment_complete: Optional[bool] = None