from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
from sqlalchemy.orm import Session, aliased
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.shoutout import ShoutOut, ShoutOutRecipient, ShoutOutAttachment
from app.models.reaction import Reaction
from app.models.comment import Comment
from app.schemas.shoutout import ShoutOut as ShoutOutSchema, ShoutOutCreate, ShoutOutUpdate
import os, secrets, shutil
from app.middleware.auth import get_current_active_user
from app.utils.notifications import create_notification

router = APIRouter(prefix="/api/shoutouts", tags=["shoutouts"])

def format_shoutout(shoutout, user_id, db):
    reaction_counts = (
        db.query(Reaction.type, func.count(Reaction.id))
        .filter(Reaction.shoutout_id == shoutout.id)
        .group_by(Reaction.type)
        .all()
    )
    
    user_reactions = (
        db.query(Reaction.type)
        .filter(Reaction.shoutout_id == shoutout.id, Reaction.user_id == user_id)
        .all()
    )
    
    comment_count = db.query(func.count(Comment.id)).filter(Comment.shoutout_id == shoutout.id).scalar()
    
    # Collect attachments from relationship
    attachment_objs = []
    if getattr(shoutout, 'attachments', None):
        for a in shoutout.attachments:
            attachment_objs.append({
                "url": a.url,
                "name": a.name,
                "type": a.type,
                "size": a.size,
            })

    return {
        "id": shoutout.id,
        "sender_id": shoutout.sender_id,
        "message": shoutout.message,
        "created_at": shoutout.created_at,
        "updated_at": shoutout.updated_at,
        "sender": {
            "id": shoutout.sender.id,
            "name": shoutout.sender.name,
            "email": shoutout.sender.email,
            "department": shoutout.sender.department,
            "avatar_url": shoutout.sender.avatar_url,
        },
        "recipients": [
            {
                "id": r.recipient.id,
                "name": r.recipient.name,
                "email": r.recipient.email,
                "department": r.recipient.department,
                "avatar_url": r.recipient.avatar_url,
            }
            for r in shoutout.recipients
        ],
        "reaction_counts": {reaction_type: count for reaction_type, count in reaction_counts},
        "comment_count": comment_count,
        "user_reactions": [r[0] for r in user_reactions],
        "attachments": attachment_objs
    }

@router.post("", response_model=ShoutOutSchema)
async def create_shoutout(
    request: Request,
    message: str = Form(...),
    recipient_ids: List[int] = Form(...),
    files: List[UploadFile] = File(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Validate message
    if not message.strip():
        raise HTTPException(status_code=400, detail="Shoutout message cannot be empty")

    new_shoutout = ShoutOut(
        sender_id=current_user.id,
        message=message,
    )
    db.add(new_shoutout)
    db.flush()

    # Validate recipients
    recipient_objects = []
    for recipient_id in recipient_ids:
        recipient = db.query(User).filter(User.id == recipient_id).first()
        if not recipient:
            raise HTTPException(status_code=404, detail=f"Recipient with id {recipient_id} not found")
        if recipient.id == current_user.id:
            raise HTTPException(status_code=400, detail="You cannot give a shoutout to yourself")
        if recipient.department != current_user.department:
            raise HTTPException(status_code=403, detail="Can only tag users from your own department")
        shoutout_recipient = ShoutOutRecipient(shoutout_id=new_shoutout.id, recipient_id=recipient_id)
        db.add(shoutout_recipient)
        recipient_objects.append(recipient)

    # Handle file uploads (optional)
    saved_files = []
    if files:
        upload_root = os.path.join(os.getcwd(), 'uploads', 'shoutouts')
        os.makedirs(upload_root, exist_ok=True)
        MAX_SIZE = 5 * 1024 * 1024  # 5MB
        allowed_ext = {'.png', '.jpg', '.jpeg', '.gif', '.webp', '.pdf'}
        for file in files:
            original_name = file.filename
            _, ext = os.path.splitext(original_name.lower())
            if ext not in allowed_ext:
                raise HTTPException(status_code=400, detail=f"File type {ext} not allowed")
            # Read content to enforce size limit
            contents = await file.read()
            size = len(contents)
            if size > MAX_SIZE:
                raise HTTPException(status_code=400, detail=f"File {original_name} exceeds 5MB size limit")
            file.file.seek(0)  # reset pointer for saving via shutil if needed
            safe_name = f"{secrets.token_hex(8)}_{original_name}"
            dest_path = os.path.join(upload_root, safe_name)
            with open(dest_path, 'wb') as out_file:
                out_file.write(contents)
            url = f"/uploads/shoutouts/{safe_name}"
            mime = None
            if ext in ['.png', '.jpg', '.jpeg', '.gif', '.webp']:
                mime = f"image/{ext.replace('.', '') if ext != '.jpg' else 'jpeg'}"
            saved_files.append({"url": url, "name": original_name, "type": mime, "size": size})
        for f in saved_files:
            db.add(ShoutOutAttachment(shoutout_id=new_shoutout.id, url=f["url"], name=f["name"], type=f.get("type"), size=f.get("size")))

    # Notify tagged recipients
    preview = (message or "").strip()
    if len(preview) > 160:
        preview = f"{preview[:157]}..."

    for recipient in recipient_objects:
        create_notification(
            db,
            user_id=recipient.id,
            actor_id=current_user.id,
            event_type="shoutout.received",
            title=f"{current_user.name} recognized you",
            message=preview,
            reference_type="shoutout",
            reference_id=new_shoutout.id,
            payload={
                "shoutout_id": new_shoutout.id,
                "redirect_url": "/feed",
            },
        )

    db.commit()
    db.refresh(new_shoutout)
    return format_shoutout(new_shoutout, current_user.id, db)

@router.get("", response_model=List[ShoutOutSchema])
async def get_shoutouts(
    skip: int = 0,
    limit: int = 20,
    department: Optional[str] = None,
    sender_id: Optional[int] = None,
    recipient_id: Optional[int] = None,
    start_date: Optional[str] = None,  # YYYY-MM-DD
    end_date: Optional[str] = None,    # YYYY-MM-DD
    all_departments: bool = False,     # NEW: Flag to fetch from all departments
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Base query: optionally restrict to the current user's department by recipient membership
    if all_departments:
        # Fetch all shoutouts from all departments
        shoutouts_query = db.query(ShoutOut).distinct()
    else:
        # Restrict to current user's department (original behavior)
        shoutouts_query = (
            db.query(ShoutOut)
            .join(ShoutOutRecipient, ShoutOut.id == ShoutOutRecipient.shoutout_id)
            .join(User, ShoutOutRecipient.recipient_id == User.id)
            .filter(User.department == current_user.department)
            .distinct()
        )

    # Optional filters
    if department:
        # filter by sender department; due to business rules, sender and recipients share dept
        sender_user = aliased(User)
        shoutouts_query = shoutouts_query.join(
            sender_user, ShoutOut.sender_id == sender_user.id
        ).filter(sender_user.department == department)

    if recipient_id:
        if all_departments:
            shoutouts_query = shoutouts_query.join(ShoutOutRecipient, ShoutOutRecipient.shoutout_id == ShoutOut.id)
        shoutouts_query = shoutouts_query.filter(ShoutOutRecipient.recipient_id == recipient_id)

    if sender_id:
        shoutouts_query = shoutouts_query.filter(ShoutOut.sender_id == sender_id)

    if start_date:
        # Compare by date portion to avoid TZ issues
        shoutouts_query = shoutouts_query.filter(func.date(ShoutOut.created_at) >= start_date)
    if end_date:
        shoutouts_query = shoutouts_query.filter(func.date(ShoutOut.created_at) <= end_date)

    shoutouts_query = shoutouts_query.order_by(ShoutOut.created_at.desc()).offset(skip).limit(limit)

    shoutouts = shoutouts_query.all()
    return [format_shoutout(s, current_user.id, db) for s in shoutouts]

@router.get("/{shoutout_id}", response_model=ShoutOutSchema)
async def get_shoutout(
    shoutout_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")
    
    # Admins can view any shoutout regardless of department
    is_admin = (current_user.role == "admin" or getattr(current_user, "is_admin", False))
    if not is_admin:
        has_department_access = (
            db.query(ShoutOutRecipient)
            .join(User, ShoutOutRecipient.recipient_id == User.id)
            .filter(
                ShoutOutRecipient.shoutout_id == shoutout_id,
                User.department == current_user.department
            )
            .first()
        )
        if not has_department_access:
            raise HTTPException(
                status_code=403, 
                detail="Not authorized to view this shoutout"
            )
    
    return format_shoutout(shoutout, current_user.id, db)

@router.put("/{shoutout_id}", response_model=ShoutOutSchema)
async def update_shoutout(
    shoutout_id: int,
    shoutout_update: ShoutOutUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")
    
    if shoutout.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this shoutout")

    if not shoutout_update.message or not shoutout_update.message.strip():
        raise HTTPException(status_code=400, detail="Shoutout message cannot be empty")
    
    shoutout.message = shoutout_update.message
    db.commit()
    db.refresh(shoutout)
    
    return format_shoutout(shoutout, current_user.id, db)

@router.delete("/{shoutout_id}")
async def delete_shoutout(
    shoutout_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")
    
    # Allow legacy admins with is_admin True
    if shoutout.sender_id != current_user.id and not (current_user.role == "admin" or getattr(current_user, "is_admin", False)):
        raise HTTPException(status_code=403, detail="Not authorized to delete this shoutout")
    
    db.delete(shoutout)
    db.commit()
    
    return {"message": "Shoutout deleted successfully"}
