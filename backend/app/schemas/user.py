from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

class UserBase(BaseModel):
    email: EmailStr
    name: str
    department: Optional[str] = None
    avatar_url: Optional[str] = None

class UserCreate(UserBase):
    password: str
    role: str = "employee"

class UserUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    avatar_url: Optional[str] = None

class User(UserBase):
    id: int
    role: Optional[str] = None
    is_admin: Optional[bool] = None
    joined_at: Optional[datetime] = None  # ✅ Make it optional to avoid ResponseValidationError
    is_active: bool
    email_verified: bool
    company_verified: bool
    pending_department: Optional[str] = None

    class Config:
        from_attributes = True

class UserInDB(User):
    password: str

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class RefreshRequest(BaseModel):
    refresh_token: str


class RegistrationResponse(BaseModel):
    message: str
    requires_verification: bool = True


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ResetPasswordResponse(BaseModel):
    message: str
