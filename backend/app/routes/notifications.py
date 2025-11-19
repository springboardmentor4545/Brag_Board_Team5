import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.middleware.auth import get_current_active_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    Notification as NotificationSchema,
    NotificationListResponse,
    NotificationReadRequest,
)
from app.utils.notifications import mark_notification_read, mark_all_notifications_read

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _serialize(notification: Notification) -> NotificationSchema:
    payload = None
    if notification.payload:
        try:
            payload = json.loads(notification.payload)
        except json.JSONDecodeError:
            payload = None
    data = {
        "id": notification.id,
        "event_type": notification.event_type,
        "title": notification.title,
        "message": notification.message,
        "reference_type": notification.reference_type,
        "reference_id": notification.reference_id,
        "payload": payload,
        "is_read": notification.is_read,
        "created_at": notification.created_at,
        "read_at": notification.read_at,
        "actor": notification.actor,
    }
    return NotificationSchema.model_validate(data)


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = 20,
    offset: int = 0,
    unread_only: bool = False,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    query = (
        db.query(Notification)
        .options(joinedload(Notification.actor))
        .filter(Notification.user_id == current_user.id)
    )

    if unread_only:
        query = query.filter(Notification.is_read.is_(False))

    notifications: List[Notification] = (
        query.order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    unread_count = (
        db.query(func.count(Notification.id))
        .filter(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        .scalar()
    )

    return NotificationListResponse(
        notifications=[_serialize(n) for n in notifications],
        unread_count=unread_count or 0,
    )


@router.post("/mark-read")
async def mark_notifications_read(
    payload: NotificationReadRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(Notification).filter(Notification.user_id == current_user.id)

    if payload.ids:
        query = query.filter(Notification.id.in_(payload.ids))

    notifications = query.all()
    if not notifications:
        raise HTTPException(status_code=404, detail="No notifications found")

    for notification in notifications:
        mark_notification_read(notification)

    db.commit()
    return {"updated": len(notifications)}


@router.post("/mark-all-read")
async def mark_all_notifications(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    updated = mark_all_notifications_read(db, user_id=current_user.id)
    db.commit()
    return {"updated": updated}


@router.delete("")
async def delete_notifications(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    deleted = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted or 0}