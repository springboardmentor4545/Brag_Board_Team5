from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List
from app.schemas.user import User  # ✅ import your existing User schema

class CommentBase(BaseModel):
    content: str

class CommentCreate(BaseModel):
    content: str
    mentions: Optional[List[int]] = []

class CommentUpdate(BaseModel):
    content: Optional[str] = None

class Comment(BaseModel):
    id: int
    user: User  # nested user who authored the comment
    shoutout_id: int
    user_id: int
    content: str
    created_at: datetime
    updated_at: datetime
    mentions: List[User] = Field(default_factory=list)  # expanded mentioned users list

    class Config:
        from_attributes = True
