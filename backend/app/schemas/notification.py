from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel


class NotificationActor(BaseModel):
    id: int
    name: str
    email: str
    avatar_url: Optional[str]

    class Config:
        from_attributes = True


class Notification(BaseModel):
    id: int
    event_type: str
    title: str
    message: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    payload: Optional[Dict[str, Any]] = None
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None
    actor: Optional[NotificationActor] = None

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: list[Notification]
    unread_count: int


class NotificationReadRequest(BaseModel):
    ids: Optional[list[int]] = None
