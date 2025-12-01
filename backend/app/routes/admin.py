from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from fastapi.responses import Response
from io import BytesIO, StringIO
import csv
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
from app.models.role_change import RoleChangeRequest
from app.schemas.department_change import (
    DepartmentChangeRequest as DepartmentChangeSchema,
    DepartmentChangeDecision,
)
from app.schemas.role_change import (
    RoleChangeRequest as RoleChangeSchema,
    RoleChangeDecision,
)
from app.utils.notifications import create_notification, notify_admins
from app.utils.responses import success_response

router = APIRouter(prefix="/api/admin", tags=["admin"])

DATE_PARAM_FORMAT = "%Y-%m-%d"
DISPLAY_TZ = ZoneInfo("Asia/Kolkata")
DISPLAY_TZ_LABEL = "IST"


def _parse_date_param(value: Optional[str], param_name: str, *, end_of_day: bool = False) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, DATE_PARAM_FORMAT)
    except ValueError as exc:  # pragma: no cover - defensive branch
        raise HTTPException(status_code=400, detail=f"Invalid {param_name}. Expected format YYYY-MM-DD.") from exc

    if end_of_day:
        parsed = parsed + timedelta(days=1) - timedelta(microseconds=1)

    return parsed.replace(tzinfo=timezone.utc)


def _format_timestamp(value: Optional[datetime]) -> str:
    if not value:
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    localized = value.astimezone(DISPLAY_TZ)
    return localized.strftime(f"%Y-%m-%d %H:%M:%S {DISPLAY_TZ_LABEL}")


def _make_filename(prefix: str, extension: str, start: Optional[str], end: Optional[str]) -> str:
    if start and end:
        suffix = f"{start}-to-{end}"
    elif start:
        suffix = f"from-{start}"
    elif end:
        suffix = f"until-{end}"
    else:
        suffix = "all"
    safe_suffix = suffix.replace("/", "-").replace(" ", "_")
    return f"{prefix}-{safe_suffix}.{extension}"


def _build_csv_response(filename: str, headers_row: List[str], rows: List[List[str]]) -> Response:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers_row)
    for row in rows:
        writer.writerow(row)
    content = buffer.getvalue()
    buffer.close()
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _build_pdf_response(filename: str, lines: List[str]) -> Response:
    from reportlab.lib.pagesizes import letter  # imported lazily to avoid unnecessary dependency at import time
    from reportlab.pdfgen import canvas

    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter
    text_object = pdf.beginText(40, height - 40)
    text_object.setLeading(14)

    for line in lines:
        if text_object.getY() <= 40:
            pdf.drawText(text_object)
            pdf.showPage()
            text_object = pdf.beginText(40, height - 40)
            text_object.setLeading(14)
        text_object.textLine(line)

    pdf.drawText(text_object)
    pdf.save()
    buffer.seek(0)

    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/users", response_model=List[UserSchema])
async def get_all_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users


@router.get("/exports/logs")
async def export_admin_logs(
    export_format: str = Query("csv", alias="format"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    normalized_format = (export_format or "csv").lower()
    if normalized_format not in {"csv", "pdf"}:
        raise HTTPException(status_code=400, detail="format must be either 'csv' or 'pdf'")

    start_dt = _parse_date_param(start_date, "start_date")
    end_dt = _parse_date_param(end_date, "end_date", end_of_day=True)

    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="start_date must be earlier than end_date")

    query = (
        db.query(AdminLog, User.name.label("admin_name"), User.email.label("admin_email"))
        .join(User, User.id == AdminLog.admin_id)
    )

    if start_dt:
        query = query.filter(AdminLog.timestamp >= start_dt)
    if end_dt:
        query = query.filter(AdminLog.timestamp <= end_dt)

    records = query.order_by(AdminLog.timestamp.desc(), AdminLog.id.desc()).all()

    export_entries = []
    for log, admin_name, admin_email in records:
        export_entries.append({
            "id": log.id,
            "timestamp": _format_timestamp(log.timestamp),
            "admin_name": admin_name or "",
            "admin_email": admin_email or "",
            "action": (log.action or "").strip(),
            "target_type": log.target_type or "",
            "target_id": "" if log.target_id is None else str(log.target_id),
        })

    filename = _make_filename("admin-logs", normalized_format, start_date, end_date)

    if normalized_format == "csv":
        headers_row = [
            "Log ID",
            f"Timestamp ({DISPLAY_TZ_LABEL})",
            "Admin Name",
            "Admin Email",
            "Action",
            "Target Type",
            "Target ID",
        ]
        data_rows = [
            [
                str(entry["id"]),
                entry["timestamp"],
                entry["admin_name"],
                entry["admin_email"],
                entry["action"],
                entry["target_type"],
                entry["target_id"],
            ]
            for entry in export_entries
        ]
        return _build_csv_response(filename, headers_row, data_rows)
    else:
        summary_lines = [
            "Admin Logs Export",
            f"Generated at {_format_timestamp(datetime.now(timezone.utc))}",
            f"Timezone: {DISPLAY_TZ_LABEL}",
        ]
        if start_date or end_date:
            range_fragments = []
            if start_date:
                range_fragments.append(f"from {start_date}")
            if end_date:
                range_fragments.append(f"to {end_date}")
            summary_lines.append(f"Filtered {' '.join(range_fragments)}")
        else:
            summary_lines.append("Filtered all dates")

        if not export_entries:
            summary_lines.append("")
            summary_lines.append("No admin log entries found for the selected range.")
        else:
            summary_lines.append("")
            for entry in export_entries:
                summary_lines.append(
                    f"#{entry['id']} | {entry['timestamp']} | {entry['admin_name'] or 'Unknown admin'}"
                )
                if entry["admin_email"]:
                    summary_lines.append(f"  Email: {entry['admin_email']}")
                summary_lines.append(f"  Action: {entry['action'].replace('\n', ' ')}")
                if entry["target_type"] or entry["target_id"]:
                    target_label = entry["target_type"] or "Target"
                    identifier = entry["target_id"] or "--"
                    summary_lines.append(f"  Target: {target_label} #{identifier}")
                summary_lines.append("")

        return _build_pdf_response(filename, summary_lines)


@router.get("/exports/reports")
async def export_reports(
    report_type: str = Query("shoutout"),
    export_format: str = Query("csv", alias="format"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    normalized_format = (export_format or "csv").lower()
    if normalized_format not in {"csv", "pdf"}:
        raise HTTPException(status_code=400, detail="format must be either 'csv' or 'pdf'")

    normalized_type = (report_type or "shoutout").lower()
    if normalized_type not in {"shoutout", "comment"}:
        raise HTTPException(status_code=400, detail="report_type must be 'shoutout' or 'comment'")

    start_dt = _parse_date_param(start_date, "start_date")
    end_dt = _parse_date_param(end_date, "end_date", end_of_day=True)

    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="start_date must be earlier than end_date")

    if normalized_type == "shoutout":
        query = (
            db.query(Report, User.name.label("reporter_name"), User.email.label("reporter_email"))
            .join(User, User.id == Report.reported_by)
        )
        if start_dt:
            query = query.filter(Report.created_at >= start_dt)
        if end_dt:
            query = query.filter(Report.created_at <= end_dt)
        records = query.order_by(Report.created_at.desc(), Report.id.desc()).all()

        export_entries = []
        for report, reporter_name, reporter_email in records:
            export_entries.append({
                "id": report.id,
                "timestamp": _format_timestamp(report.created_at),
                "reporter_name": reporter_name or "",
                "reporter_email": reporter_email or "",
                "shoutout_id": str(report.shoutout_id),
                "status": report.status,
                "reason": (report.reason or "").strip(),
            })

        filename = _make_filename("shoutout-reports", normalized_format, start_date, end_date)
        csv_headers = [
            "Report ID",
            f"Timestamp ({DISPLAY_TZ_LABEL})",
            "Reporter",
            "Reporter Email",
            "Shout-out ID",
            "Status",
            "Reason",
        ]
    else:
        query = (
            db.query(CommentReportModel, User.name.label("reporter_name"), User.email.label("reporter_email"))
            .join(User, User.id == CommentReportModel.reported_by)
        )
        if start_dt:
            query = query.filter(CommentReportModel.created_at >= start_dt)
        if end_dt:
            query = query.filter(CommentReportModel.created_at <= end_dt)
        records = query.order_by(CommentReportModel.created_at.desc(), CommentReportModel.id.desc()).all()

        export_entries = []
        for report, reporter_name, reporter_email in records:
            export_entries.append({
                "id": report.id,
                "timestamp": _format_timestamp(report.created_at),
                "reporter_name": reporter_name or "",
                "reporter_email": reporter_email or "",
                "comment_id": str(report.comment_id),
                "shoutout_id": str(report.shoutout_id),
                "status": report.status,
                "reason": (report.reason or "").strip(),
            })

        filename = _make_filename("comment-reports", normalized_format, start_date, end_date)
        csv_headers = [
            "Report ID",
            f"Timestamp ({DISPLAY_TZ_LABEL})",
            "Reporter",
            "Reporter Email",
            "Comment ID",
            "Shout-out ID",
            "Status",
            "Reason",
        ]

    if normalized_format == "csv":
        data_rows = []
        for entry in export_entries:
            row = [
                str(entry["id"]),
                entry["timestamp"],
                entry["reporter_name"],
                entry["reporter_email"],
            ]
            if normalized_type == "comment":
                row.extend([
                    entry.get("comment_id", ""),
                    entry.get("shoutout_id", ""),
                ])
            else:
                row.append(entry.get("shoutout_id", ""))
            row.extend([
                entry["status"],
                entry["reason"],
            ])
            data_rows.append(row)
        return _build_csv_response(filename, csv_headers, data_rows)

    summary_lines = [
        "Reported Items Export",
        f"Type: {'Comment Reports' if normalized_type == 'comment' else 'Shout-out Reports'}",
        f"Generated at {_format_timestamp(datetime.now(timezone.utc))}",
        f"Timezone: {DISPLAY_TZ_LABEL}",
    ]
    if start_date or end_date:
        range_fragments = []
        if start_date:
            range_fragments.append(f"from {start_date}")
        if end_date:
            range_fragments.append(f"to {end_date}")
        summary_lines.append(f"Filtered {' '.join(range_fragments)}")
    else:
        summary_lines.append("Filtered all dates")

    if not export_entries:
        summary_lines.append("")
        summary_lines.append("No reports found for the selected filters.")
    else:
        summary_lines.append("")
        for entry in export_entries:
            summary_lines.append(
                f"#{entry['id']} | {entry['timestamp']} | {entry['reporter_name'] or 'Unknown reporter'} | Status: {entry['status']}"
            )
            if entry.get("reporter_email"):
                summary_lines.append(f"  Email: {entry['reporter_email']}")
            if normalized_type == "comment":
                summary_lines.append(
                    f"  Related: Comment #{entry.get('comment_id', '--')} on Shout-out #{entry.get('shoutout_id', '--')}"
                )
            else:
                summary_lines.append(f"  Related: Shout-out #{entry.get('shoutout_id', '--')}")
            if entry.get("reason"):
                summary_lines.append(f"  Reason: {entry['reason'].replace('\n', ' ')}")
            summary_lines.append("")

    return _build_pdf_response(filename, summary_lines)

@router.get("/analytics")
async def get_analytics(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    total_users = (
        db.query(func.count(User.id))
        .filter(User.is_active == True, User.company_verified == True)
        .scalar()
    )
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
    db.flush()

    reporter_label = current_user.name or current_user.email or "A user"
    notify_admins(
        db,
        event_type="report.shoutout.created",
        title="New shout-out report",
        message=f"{reporter_label} reported shout-out #{shoutout_id}.",
        actor_id=current_user.id,
        reference_type="shoutout_report",
        reference_id=new_report.id,
        payload={
            "redirect_url": "/admin?section=shoutout-reports",
            "section": "shoutout-reports",
            "report_id": new_report.id,
            "shoutout_id": shoutout_id,
        },
    )

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

    return success_response(f"Report {action} successfully")


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

    return success_response(f"Comment report {action} successfully")


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


@router.get("/role-change-requests", response_model=List[RoleChangeSchema])
async def list_role_change_requests(
    status: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(RoleChangeRequest).options(
        joinedload(RoleChangeRequest.user),
        joinedload(RoleChangeRequest.admin),
    ).order_by(RoleChangeRequest.created_at.desc())

    if status:
        query = query.filter(RoleChangeRequest.status == status)

    return query.all()


@router.post("/role-change-requests/{request_id}/decision", response_model=RoleChangeSchema)
async def decide_role_change_request(
    request_id: int,
    payload: RoleChangeDecision,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    request = (
        db.query(RoleChangeRequest)
        .options(
            joinedload(RoleChangeRequest.user),
            joinedload(RoleChangeRequest.admin),
        )
        .filter(RoleChangeRequest.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Role change request not found")

    if request.status != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    action = payload.action.lower()
    if action not in {"approved", "rejected"}:
        raise HTTPException(status_code=400, detail="Invalid action")

    target_role = (request.requested_role or "").lower()
    if action == "approved" and target_role not in {"admin", "employee"}:
        raise HTTPException(status_code=400, detail="Invalid requested role")

    request.status = action
    request.admin_id = admin.id
    request.admin = admin
    request.resolved_at = datetime.now(timezone.utc)

    admin_action = f"Role change request #{request_id} {action}"

    user = db.query(User).filter(User.id == request.user_id).first()
    if action == "approved" and user:
        user.role = target_role
        user.is_admin = target_role == "admin"
        admin_action += f"; role set to {target_role}"
        request.user = user

    db.add(AdminLog(
        admin_id=admin.id,
        action=admin_action,
        target_id=request_id,
        target_type="role_change_request"
    ))

    if action == "approved":
        requested_role_label = request.requested_role or "employee"
        decision_title = "Role change approved"
        decision_message = (
            "Your request to become an admin was approved."
            if requested_role_label == "admin"
            else "Your request to switch to the employee role was approved."
        )
    else:
        decision_title = "Role change rejected"
        decision_message = "Your role change request was rejected by the administrator."

    create_notification(
        db,
        user_id=request.user_id,
        actor_id=admin.id,
        event_type="role_change.decision",
        title=decision_title,
        message=decision_message,
        reference_type="role_change_request",
        reference_id=request.id,
        payload={
            "redirect_url": "/profile",
            "role": request.requested_role,
            "status": action,
            "granted_admin": action == "approved" and (request.requested_role == "admin"),
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
    
    return success_response("Shoutout deleted successfully")

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
