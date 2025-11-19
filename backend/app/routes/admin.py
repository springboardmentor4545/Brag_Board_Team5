from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from app.database import get_db
from app.models.user import User
from app.models.shoutout import ShoutOut, ShoutOutRecipient
from app.models.comment import Comment
from app.models.report import Report
from app.models.comment_report import CommentReport as CommentReportModel
from app.models.admin_log import AdminLog
from app.schemas.report import Report as ReportSchema, ReportCreate, ReportResolve
from app.schemas.comment_report import CommentReport as CommentReportSchema
from app.schemas.user import User as UserSchema
from app.middleware.auth import get_current_active_user, require_admin
from app.models.department_change import DepartmentChangeRequest
from app.schemas.department_change import (
    DepartmentChangeRequest as DepartmentChangeSchema,
    DepartmentChangeDecision,
)
from app.utils.notifications import create_notification

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/users", response_model=List[UserSchema])
async def get_all_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users

@router.get("/analytics")
async def get_analytics(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    total_users = db.query(func.count(User.id)).scalar()
    total_shoutouts = db.query(func.count(ShoutOut.id)).scalar()
    
    top_contributors = (
        db.query(User.id, User.name, User.department, func.count(ShoutOut.id).label("count"))
        .join(ShoutOut, ShoutOut.sender_id == User.id)
        .group_by(User.id)
        .order_by(func.count(ShoutOut.id).desc())
        .limit(10)
        .all()
    )
    
    most_tagged = (
        db.query(User.id, User.name, User.department, func.count(ShoutOutRecipient.id).label("count"))
        .join(ShoutOutRecipient, ShoutOutRecipient.recipient_id == User.id)
        .group_by(User.id)
        .order_by(func.count(ShoutOutRecipient.id).desc())
        .limit(10)
        .all()
    )
    
    department_stats = (
        db.query(User.department, func.count(ShoutOut.id).label("count"))
        .join(ShoutOut, ShoutOut.sender_id == User.id)
        .group_by(User.department)
        .all()
    )
    
    return {
        "total_users": total_users,
        "total_shoutouts": total_shoutouts,
        "top_contributors": [
            {"id": u.id, "name": u.name, "department": u.department, "shoutouts_sent": u.count}
            for u in top_contributors
        ],
        "most_tagged": [
            {"id": u.id, "name": u.name, "department": u.department, "times_tagged": u.count}
            for u in most_tagged
        ],
        "department_stats": [
            {"department": d.department, "shoutout_count": d.count}
            for d in department_stats
        ]
    }

@router.post("/shoutouts/{shoutout_id}/report", response_model=ReportSchema)
async def report_shoutout(
    shoutout_id: int,
    report_data: ReportCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")

    if not report_data.reason or not report_data.reason.strip():
        raise HTTPException(status_code=400, detail="Report reason cannot be empty")
    
    new_report = Report(
        shoutout_id=shoutout_id,
        reported_by=current_user.id,
        reason=report_data.reason,
        status="pending"
    )
    
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    return new_report

@router.get("/reports", response_model=List[ReportSchema])
async def get_reports(
    status: str = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Report)
    
    if status:
        query = query.filter(Report.status == status)
    
    reports = query.order_by(Report.created_at.desc()).all()
    return reports


@router.get("/comment-reports", response_model=List[CommentReportSchema])
async def get_comment_reports(
    status: str = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(CommentReportModel).options(
        joinedload(CommentReportModel.comment).joinedload(Comment.user),
        joinedload(CommentReportModel.reporter),
    )

    if status:
        query = query.filter(CommentReportModel.status == status)

    return query.order_by(CommentReportModel.created_at.desc()).all()

@router.post("/reports/{report_id}/resolve")
async def resolve_report(
    report_id: int,
    payload: ReportResolve,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Resolve a report by approving (keeping) or rejecting (dismissing) it.
    Body: {"action": "approved" | "rejected"}
    """
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    action = payload.action
    if action not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid action")

    report.status = action

    admin_log = AdminLog(
        admin_id=admin.id,
        action=f"Resolved report #{report_id} with action: {action}",
        target_id=report_id,
        target_type="report"
    )
    db.add(admin_log)

    db.commit()

    return {"message": f"Report {action} successfully"}


@router.post("/comment-reports/{report_id}/resolve")
async def resolve_comment_report(
    report_id: int,
    payload: ReportResolve,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    report = db.query(CommentReportModel).filter(CommentReportModel.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Comment report not found")

    action = payload.action
    if action not in ["approved", "rejected"]:
        raise HTTPException(status_code=400, detail="Invalid action")

    report.status = action

    admin_log = AdminLog(
        admin_id=admin.id,
        action=f"Resolved comment report #{report_id} with action: {action}",
        target_id=report_id,
        target_type="comment_report"
    )
    db.add(admin_log)

    db.commit()

    return {"message": f"Comment report {action} successfully"}


@router.get("/department-change-requests", response_model=List[DepartmentChangeSchema])
async def list_department_change_requests(
    status: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(DepartmentChangeRequest).options(
        joinedload(DepartmentChangeRequest.user),
        joinedload(DepartmentChangeRequest.admin),
    ).order_by(DepartmentChangeRequest.created_at.desc())

    if status:
        query = query.filter(DepartmentChangeRequest.status == status)

    return query.all()


@router.post("/department-change-requests/{request_id}/decision", response_model=DepartmentChangeSchema)
async def decide_department_change_request(
    request_id: int,
    payload: DepartmentChangeDecision,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    request = (
        db.query(DepartmentChangeRequest)
        .options(
            joinedload(DepartmentChangeRequest.user),
            joinedload(DepartmentChangeRequest.admin),
        )
        .filter(DepartmentChangeRequest.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Department change request not found")

    if request.status != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    action = payload.action.lower()
    if action not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid action")

    request.status = action
    request.admin_id = admin.id
    request.admin = admin
    request.resolved_at = datetime.now(timezone.utc)

    admin_action = f"Department change request #{request_id} {action}"

    if action == "approved":
        user = db.query(User).filter(User.id == request.user_id).first()
        if user:
            user.department = request.requested_department
            request.user = user
        admin_action += f"; department set to {request.requested_department}"

    db.add(AdminLog(
        admin_id=admin.id,
        action=admin_action,
        target_id=request_id,
        target_type="department_change_request"
    ))

    # Notify the user about the decision
    decision_title = "Department change approved" if action == "approved" else "Department change rejected"
    decision_message = (
        f"Your request to move to {request.requested_department} was approved."
        if action == "approved"
        else "Your department change request was rejected by the administrator."
    )
    create_notification(
        db,
        user_id=request.user_id,
        actor_id=admin.id,
        event_type="department_change.decision",
        title=decision_title,
        message=decision_message,
        reference_type="department_change_request",
        reference_id=request.id,
        payload={
            "redirect_url": "/profile",
            "department": request.requested_department,
            "status": action,
        },
    )

    db.commit()
    db.refresh(request)

    return request

@router.delete("/shoutouts/{shoutout_id}")
async def admin_delete_shoutout(
    shoutout_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    shoutout = db.query(ShoutOut).filter(ShoutOut.id == shoutout_id).first()
    if not shoutout:
        raise HTTPException(status_code=404, detail="Shoutout not found")
    
    admin_log = AdminLog(
        admin_id=admin.id,
        action=f"Deleted shoutout #{shoutout_id}",
        target_id=shoutout_id,
        target_type="shoutout"
    )
    db.add(admin_log)
    
    db.delete(shoutout)
    db.commit()
    
    return {"message": "Shoutout deleted successfully"}

@router.get("/leaderboard")
async def get_leaderboard(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    top_senders = (
        db.query(User.id, User.name, User.department, func.count(ShoutOut.id).label("sent"))
        .join(ShoutOut, ShoutOut.sender_id == User.id)
        .group_by(User.id)
        .order_by(func.count(ShoutOut.id).desc())
        .limit(10)
        .all()
    )
    
    top_receivers = (
        db.query(User.id, User.name, User.department, func.count(ShoutOutRecipient.id).label("received"))
        .join(ShoutOutRecipient, ShoutOutRecipient.recipient_id == User.id)
        .group_by(User.id)
        .order_by(func.count(ShoutOutRecipient.id).desc())
        .limit(10)
        .all()
    )
    
    return {
        "top_senders": [
            {"id": u.id, "name": u.name, "department": u.department, "shoutouts_sent": u.sent}
            for u in top_senders
        ],
        "top_receivers": [
            {"id": u.id, "name": u.name, "department": u.department, "shoutouts_received": u.received}
            for u in top_receivers
        ]
    }
