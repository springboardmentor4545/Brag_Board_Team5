from pydantic import BaseModel, EmailStr
from datetime import datetime
from enum import Enum

# --- Enums ---

class UserRole(str, Enum):
    """Enumeration for user roles."""
    employee = "employee"
    admin = "admin"

# --- Token Schemas ---

class Token(BaseModel):
    """Schema for the JWT access token."""
    access_token: str
    token_type: str

class TokenData(BaseModel):
    """Schema for the data encoded within the JWT."""
    email: EmailStr | None = None

# --- User Schemas ---

class UserBase(BaseModel):
    """Base schema for User, containing common attributes."""
    email: EmailStr
    name: str
    department: str
    role: UserRole = UserRole.employee

class UserCreate(UserBase):
    """Schema used for creating a new user (receives a password)."""
    password: str

class User(UserBase):
    """
    Schema used for returning user data from the API.
    It does NOT include the password.
    This is the model that 'main.py' is trying to find.
    """
    id: int
    joined_at: datetime

    class Config:
        """Pydantic configuration to allow ORM-to-model conversion."""
        from_attributes = True

class UserInDB(UserBase):
    """
    Schema for the user model as stored in the database.
    Includes the hashed password.
    This should NOT be returned from the API.
    """
    id: int
    joined_at: datetime
    hashed_password: str

    class Config:
        """Pydantic configuration to allow ORM-to-model conversion."""
        from_attributes = True

# --- Department Schemas ---

class DepartmentInfo(BaseModel):
    """Schema for returning department-specific info."""
    department: str
    role: UserRole
    message: str

