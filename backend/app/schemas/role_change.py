from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.schemas.user import User as UserSchema


class RoleChangeRequestBase(BaseModel):
    requested_role: str


class RoleChangeRequestCreate(RoleChangeRequestBase):
    pass


class RoleChangeDecision(BaseModel):
    action: str  # "approved" or "rejected"


class RoleChangeRequest(RoleChangeRequestBase):
    id: int
    user_id: int
    current_role: Optional[str] = None
    status: str
    admin_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    user: Optional[UserSchema] = None
    admin: Optional[UserSchema] = None

    class Config:
        from_attributes = True
