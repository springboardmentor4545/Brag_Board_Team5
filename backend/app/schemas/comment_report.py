from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.schemas.comment import Comment
from app.schemas.user import User


class CommentReportCreate(BaseModel):
    reason: str


class CommentReport(BaseModel):
    id: int
    comment_id: int
    shoutout_id: int
    reported_by: int
    reason: str
    status: str
    created_at: datetime
    comment: Optional[Comment]
    reporter: Optional[User]

    class Config:
        from_attributes = True
