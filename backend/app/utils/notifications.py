import json
from datetime import datetime
from typing import Any, Dict, Optional
from sqlalchemy.orm import Session
from app.models.notification import Notification


def create_notification(
    db: Session,
    *,
    user_id: int,
    event_type: str,
    title: str,
    message: Optional[str] = None,
    actor_id: Optional[int] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[int] = None,
    payload: Optional[Dict[str, Any]] = None
) -> Notification:
    """Persist a notification for a user.

    This helper centralizes payload serialization and ensures every notification
    contains the minimal metadata needed for the frontend.
    """
    serialized_payload = json.dumps(payload) if payload else None
    notification = Notification(
        user_id=user_id,
        actor_id=actor_id,
        event_type=event_type,
        title=title,
        message=message,
        reference_type=reference_type,
        reference_id=reference_id,
        payload=serialized_payload,
    )
    db.add(notification)
    return notification


def mark_notification_read(notification: Notification, *, read: bool = True) -> None:
    now = datetime.utcnow()
    notification.is_read = read
    notification.read_at = now if read else None


def mark_all_notifications_read(db: Session, *, user_id: int) -> int:
    updated = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.is_read.is_(False))
        .update({
            Notification.is_read: True,
            Notification.read_at: datetime.utcnow(),
        }, synchronize_session="fetch")
    )
    return updated or 0
