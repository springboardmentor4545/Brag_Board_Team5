from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.schemas.user import User as UserSchema


class DepartmentChangeRequestBase(BaseModel):
    requested_department: str


class DepartmentChangeRequestCreate(DepartmentChangeRequestBase):
    pass


class DepartmentChangeDecision(BaseModel):
    action: str  # "approved" or "rejected"


class DepartmentChangeRequest(DepartmentChangeRequestBase):
    id: int
    user_id: int
    current_department: Optional[str] = None
    status: str
    admin_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    user: Optional[UserSchema] = None
    admin: Optional[UserSchema] = None

    class Config:
        from_attributes = True
