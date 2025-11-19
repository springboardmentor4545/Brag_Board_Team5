from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.user import User
from app.models.department_change import DepartmentChangeRequest
from app.schemas.user import User as UserSchema, UserUpdate
from app.middleware.auth import get_current_active_user
import os
import secrets
from app.schemas.department_change import DepartmentChangeRequest as DepartmentChangeSchema

AVATAR_DIR = os.path.join(os.getcwd(), "uploads", "avatars")
os.makedirs(AVATAR_DIR, exist_ok=True)

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/me", response_model=UserSchema)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    pending = (
        db.query(DepartmentChangeRequest)
        .filter(DepartmentChangeRequest.user_id == current_user.id, DepartmentChangeRequest.status == "pending")
        .order_by(DepartmentChangeRequest.created_at.desc())
        .first()
    )
    setattr(current_user, "pending_department", pending.requested_department if pending else None)
    return current_user

@router.put("/me", response_model=UserSchema)
async def update_current_user(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    pending_request = (
        db.query(DepartmentChangeRequest)
        .filter(DepartmentChangeRequest.user_id == current_user.id, DepartmentChangeRequest.status == "pending")
        .order_by(DepartmentChangeRequest.created_at.desc())
        .first()
    )

    changed = False

    if user_update.name is not None:
        if not user_update.name or not user_update.name.strip():
            raise HTTPException(status_code=400, detail="User name cannot be empty")
        current_user.name = user_update.name
        changed = True

    new_pending_department = None
    if user_update.department is not None:
        if not user_update.department or not user_update.department.strip():
            raise HTTPException(status_code=400, detail="Department cannot be empty")
        if user_update.department != current_user.department:
            if pending_request:
                pending_request.requested_department = user_update.department
            else:
                pending_request = DepartmentChangeRequest(
                    user_id=current_user.id,
                    current_department=current_user.department,
                    requested_department=user_update.department,
                    status="pending"
                )
                db.add(pending_request)
            changed = True
            new_pending_department = user_update.department

    if changed:
        db.commit()

    db.refresh(current_user)

    if pending_request and pending_request.status == "pending":
        new_pending_department = pending_request.requested_department

    setattr(current_user, "pending_department", new_pending_department)
    return current_user


@router.get("/me/department-change-requests", response_model=List[DepartmentChangeSchema])
async def list_my_department_requests(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    requests = (
        db.query(DepartmentChangeRequest)
        .filter(DepartmentChangeRequest.user_id == current_user.id)
        .order_by(DepartmentChangeRequest.created_at.desc())
        .all()
    )
    return requests

@router.post("/me/avatar", response_model=UserSchema)
async def upload_avatar(
    avatar: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if avatar.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    contents = await avatar.read()
    MAX_SIZE = 2 * 1024 * 1024  # 2MB limit to keep uploads lightweight
    if len(contents) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Avatar exceeds 2MB size limit")

    _, ext = os.path.splitext(avatar.filename or "avatar")
    safe_name = f"{current_user.id}_{secrets.token_hex(8)}{ext or '.png'}"
    file_path = os.path.join(AVATAR_DIR, safe_name)

    # Remove previous avatar if it exists inside our managed directory
    if current_user.avatar_url and current_user.avatar_url.startswith("/uploads/"):
        uploads_root = os.path.join(os.getcwd(), "uploads")
        relative_path = current_user.avatar_url[len("/uploads/"):]
        old_path = os.path.join(uploads_root, relative_path)
        if os.path.commonpath([uploads_root, os.path.abspath(old_path)]) == uploads_root and os.path.exists(old_path):
            try:
                os.remove(old_path)
            except OSError:
                pass

    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    current_user.avatar_url = f"/uploads/avatars/{safe_name}"
    db.commit()
    db.refresh(current_user)
    return current_user

@router.get("/search", response_model=List[UserSchema])
async def search_users(
    query: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).filter(User.name.ilike(f"%{query}%")).all()
    return users

@router.get("", response_model=List[UserSchema])
async def get_users(
    department: str = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(User).filter(User.is_active == True)
    
    if department:
        query = query.filter(User.department == department)
    
    users = query.all()
    return users

@router.get("/{user_id}", response_model=UserSchema)
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user
