from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.comment import Comment
from app.models.shoutout import ShoutOut
from app.schemas.comment import Comment as CommentSchema, CommentCreate, CommentUpdate
from app.schemas.comment_report import CommentReport as CommentReportSchema, CommentReportCreate
from app.middleware.auth import get_current_active_user
from app.models.comment_report import CommentReport as CommentReportModel
from app.utils.notifications import create_notification
import re
from sqlalchemy.orm import joinedload


router = APIRouter(prefix="/api/shoutouts", tags=["comments"])

@router.post("/{shoutout_id}/comments", response_model=CommentSchema)
async def create_comment(
    shoutout_id: int,
    comment_data: CommentCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")

    if not comment_data.content or not comment_data.content.strip():
        raise HTTPException(status_code=400, detail="Comment content cannot be empty")
    
    new_comment = Comment(
        shoutout_id=shoutout_id,
        user_id=current_user.id,
        content=comment_data.content
    )

    # Handle mentions
    mentioned_users = []
    if comment_data.mentions:
        mentioned_users = db.query(User).filter(User.id.in_(comment_data.mentions)).all()
        new_comment.mentions.extend(mentioned_users)
    else:
        # Fallback: parse react-mentions style markup from content @[display](id)
        mention_pattern = re.compile(r"@\[(.+?)\]\((\d+)\)")
        raw_ids = set()
        for m in mention_pattern.finditer(comment_data.content or ""):
            raw_ids.add(int(m.group(2)))
        if raw_ids:
            mentioned_users = db.query(User).filter(User.id.in_(raw_ids)).all()
            new_comment.mentions.extend(mentioned_users)
    
    db.add(new_comment)
    db.flush()

    preview = (comment_data.content or "").strip()
    if len(preview) > 160:
        preview = f"{preview[:157]}..."

    # Notify shoutout owner about new comment (excluding self comments)
    if shoutout.sender_id != current_user.id:
        create_notification(
            db,
            user_id=shoutout.sender_id,
            actor_id=current_user.id,
            event_type="comment.new",
            title=f"{current_user.name} commented on your shoutout",
            message=preview,
            reference_type="comment",
            reference_id=new_comment.id,
            payload={
                "shoutout_id": shoutout_id,
                "comment_id": new_comment.id,
                "redirect_url": "/feed",
            },
        )

    # Notify other recipients tagged on the shoutout
    notified_recipient_ids = set()
    for recipient in shoutout.recipients:
        rid = recipient.recipient_id
        if rid in (current_user.id, shoutout.sender_id):
            continue
        if rid in notified_recipient_ids:
            continue
        create_notification(
            db,
            user_id=rid,
            actor_id=current_user.id,
            event_type="comment.new",
            title=f"New comment on a shoutout you're tagged in",
            message=preview,
            reference_type="comment",
            reference_id=new_comment.id,
            payload={
                "shoutout_id": shoutout_id,
                "comment_id": new_comment.id,
                "redirect_url": "/feed",
            },
        )
        notified_recipient_ids.add(rid)

    # Notify mentioned users explicitly
    for mentioned in mentioned_users:
        if mentioned.id == current_user.id:
            continue
        create_notification(
            db,
            user_id=mentioned.id,
            actor_id=current_user.id,
            event_type="comment.mention",
            title=f"{current_user.name} mentioned you in a comment",
            message=preview,
            reference_type="comment",
            reference_id=new_comment.id,
            payload={
                "shoutout_id": shoutout_id,
                "comment_id": new_comment.id,
                "redirect_url": "/feed",
            },
        )

    db.commit()
    db.refresh(new_comment)
    return new_comment

@router.get("/{shoutout_id}/comments", response_model=List[CommentSchema])
async def get_comments(
    shoutout_id: int,
    db: Session = Depends(get_db)
):
    comments = (
        db.query(Comment)
        .options(joinedload(Comment.user), joinedload(Comment.mentions))
        .filter(Comment.shoutout_id == shoutout_id)
        .order_by(Comment.created_at.asc())
        .all()
    )
    return comments

@router.put("/comments/{comment_id}", response_model=CommentSchema)
async def update_comment(
    comment_id: int,
    comment_update: CommentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this comment")

    if not comment_update.content or not comment_update.content.strip():
        raise HTTPException(status_code=400, detail="Comment content cannot be empty")
    
    comment.content = comment_update.content
    db.commit()
    db.refresh(comment)
    return comment

@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # Allow legacy admins with is_admin True
    if comment.user_id != current_user.id and not (current_user.role == "admin" or getattr(current_user, "is_admin", False)):
        raise HTTPException(status_code=403, detail="Not authorized to delete this comment")
    
    db.delete(comment)
    db.commit()
    
    return {"message": "Comment deleted successfully"}


@router.post("/comments/{comment_id}/report", response_model=CommentReportSchema)
async def report_comment(
    comment_id: int,
    report_data: CommentReportCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    comment = (
        db.query(Comment)
        .options(joinedload(Comment.shoutout))
        .filter(Comment.id == comment_id)
        .first()
    )
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    if comment.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot report your own comment")

    if not report_data.reason or not report_data.reason.strip():
        raise HTTPException(status_code=400, detail="Report reason cannot be empty")

    existing_report = (
        db.query(CommentReportModel)
        .filter(
            CommentReportModel.comment_id == comment_id,
            CommentReportModel.reported_by == current_user.id,
        )
        .first()
    )
    if existing_report:
        raise HTTPException(status_code=400, detail="You have already reported this comment")

    new_report = CommentReportModel(
        comment_id=comment_id,
        shoutout_id=comment.shoutout_id,
        reported_by=current_user.id,
        reason=report_data.reason.strip(),
        status="pending",
    )

    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    return new_report
