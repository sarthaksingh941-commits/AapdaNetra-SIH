from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.models.user import UserRole

# Shared properties
class UserBase(BaseModel):
    email: EmailStr
    name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.CITIZEN

# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str
    admin_code: Optional[str] = None

# Properties to receive via API on login
class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Properties to return to client
class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse
