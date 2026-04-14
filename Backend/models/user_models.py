from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

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
    last_login: datetime = None
    status: str = "active"