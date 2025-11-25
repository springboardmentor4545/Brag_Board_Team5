import html
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserCreate,
    Token,
    LoginRequest,
    RefreshRequest,
    RegistrationResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ResetPasswordResponse,
)
from app.utils.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    is_strong_password,
    PASSWORD_POLICY_MESSAGE,
)
from app.models.email_verification import EmailVerification
from app.models.password_reset import PasswordReset
from app.models.company_approval import CompanyApprovalRequest
from app.utils.email import (
    send_verification_email,
    send_password_reset_email,
    send_company_approval_email,
    send_company_approval_outcome_email,
    send_password_change_confirmation_email,
    COMPANY_APPROVER_EMAIL,
    FRONTEND_URL,
)
from datetime import datetime, timedelta, timezone
import secrets
from fastapi.responses import HTMLResponse
from app.utils.responses import success_response

router = APIRouter(prefix="/api/auth", tags=["auth"])

_FRONTEND_BASE = (FRONTEND_URL or "http://localhost:5000").rstrip("/") or "http://localhost:5000"
LOGIN_URL = f"{_FRONTEND_BASE}/login"


def _render_feedback_page(
        title: str,
        message: str,
        *,
        button_href: Optional[str] = None,
        button_label: Optional[str] = None,
        variant: str = "success",
) -> str:
        """Return a lightweight animated HTML page for verification flows."""

        safe_title = html.escape(title)
        safe_message = html.escape(message)
        safe_button_label = html.escape(button_label) if button_label else ""
        safe_button_href = html.escape(button_href, quote=True) if button_href else "#"

        is_success = variant == "success"
        accent = "#16a34a" if is_success else "#dc2626"
        accent_soft = "#bbf7d0" if is_success else "#fecaca"
        accent_mid = "#22c55e" if is_success else "#f87171"
        shadow_rgb = "22, 163, 74" if is_success else "220, 38, 38"

        icon_svg = (
                """
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 6L9 17l-5-5" />
</svg>
                """
                if is_success
                else
                """
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="9" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
</svg>
                """
        ).strip()

        button_html = (
                f'<a class="action" href="{safe_button_href}">{safe_button_label}</a>'
                if button_href and button_label
                else ""
        )

        return f"""
<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{safe_title}</title>
        <style>
            :root {{
                color-scheme: light;
            }}
            * {{
                box-sizing: border-box;
            }}
            body {{
                margin: 0;
                font-family: "Inter", "Segoe UI", sans-serif;
                background: #f1f5f9;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                color: #0f172a;
            }}
            .card {{
                width: min(420px, 100%);
                background: #ffffff;
                border-radius: 16px;
                padding: 32px 28px;
                box-shadow: 0 24px 40px rgba(15, 23, 42, 0.12);
                text-align: center;
                animation: pop 480ms ease-out;
            }}
            .pulse-ring {{
                width: 96px;
                height: 96px;
                margin: 0 auto 24px;
                border-radius: 9999px;
                background: {accent_soft};
                position: relative;
                display: grid;
                place-items: center;
            }}
            .pulse-ring::after {{
                content: "";
                position: absolute;
                inset: 0;
                border-radius: inherit;
                background: {accent_mid};
                opacity: 0.75;
                animation: pulse 1.6s ease-out infinite;
            }}
            .icon {{
                width: 56px;
                height: 56px;
                color: {accent};
                position: relative;
                z-index: 1;
                animation: drop 520ms ease-out;
            }}
            h1 {{
                margin: 0 0 12px;
                font-size: 1.75rem;
                letter-spacing: -0.01em;
            }}
            p {{
                margin: 0 0 28px;
                font-size: 1rem;
                line-height: 1.55;
                color: #475569;
                animation: fade 520ms ease-out;
                animation-delay: 120ms;
                animation-fill-mode: both;
            }}
            .action {{
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 12px 22px;
                border-radius: 999px;
                background: {accent};
                color: #ffffff;
                text-decoration: none;
                font-weight: 600;
                letter-spacing: 0.01em;
                transition: transform 160ms ease, box-shadow 160ms ease;
                animation: fade 520ms ease-out;
                animation-delay: 220ms;
                animation-fill-mode: both;
                box-shadow: 0 12px 20px rgba({shadow_rgb}, 0.25);
            }}
            .action:hover {{
                transform: translateY(-2px);
                box-shadow: 0 14px 24px rgba({shadow_rgb}, 0.28);
            }}
            .action:focus-visible {{
                outline: 3px solid rgba({shadow_rgb}, 0.4);
                outline-offset: 2px;
            }}
            @keyframes pop {{
                0% {{ transform: scale(0.92); opacity: 0; }}
                55% {{ transform: scale(1.03); opacity: 1; }}
                100% {{ transform: scale(1); opacity: 1; }}
            }}
            @keyframes drop {{
                0% {{ transform: translateY(-12px); opacity: 0; }}
                100% {{ transform: translateY(0); opacity: 1; }}
            }}
            @keyframes fade {{
                from {{ transform: translateY(8px); opacity: 0; }}
                to {{ transform: translateY(0); opacity: 1; }}
            }}
            @keyframes pulse {{
                0% {{ transform: scale(0.85); opacity: 0.85; }}
                70% {{ transform: scale(1.15); opacity: 0; }}
                100% {{ transform: scale(1.15); opacity: 0; }}
            }}
            @media (max-width: 480px) {{
                .card {{
                    padding: 28px 22px;
                }}
                h1 {{
                    font-size: 1.5rem;
                }}
            }}
        </style>
    </head>
    <body>
        <main class="card" role="status" aria-live="polite">
            <div class="pulse-ring">
                <div class="icon">{icon_svg}</div>
            </div>
            <h1>{safe_title}</h1>
            <p>{safe_message}</p>
            {button_html}
        </main>
    </body>
</html>
        """.strip()

# ---------------- REGISTER ROUTE ---------------- #
@router.post("/register", response_model=RegistrationResponse)
async def register(user_data: UserCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # ---- Basic field validation ----
    if not user_data.name or not user_data.name.strip():
        raise HTTPException(status_code=400, detail="User name cannot be empty")
    if not user_data.email or not user_data.email.strip():
        raise HTTPException(status_code=400, detail="Email cannot be empty")
    if not user_data.password or not user_data.password.strip():
        raise HTTPException(status_code=400, detail="Password cannot be empty")
    if not user_data.department or not user_data.department.strip():
        raise HTTPException(status_code=400, detail="Department cannot be empty")

    normalized_email = user_data.email.strip().lower()
    password_value = user_data.password.strip()
    department_value = user_data.department.strip()
    if not is_strong_password(password_value):
        raise HTTPException(status_code=400, detail=PASSWORD_POLICY_MESSAGE)

    # ---- Check if user already exists ----
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # ---- Validate role ----
    role_value = (getattr(user_data, "role", None) or "").strip().lower()
    if role_value and role_value not in ["admin", "employee"]:
        raise HTTPException(status_code=400, detail="Invalid role specified. Use 'admin' or 'employee'.")
    if not role_value:
        role_value = "employee"
    if role_value == "admin" and department_value.lower() != "hr":
        raise HTTPException(status_code=400, detail="Admin role is restricted to the HR department.")

    user_data.role = role_value
    user_data.department = department_value

    # ---- Hash password ----
    hashed_password = get_password_hash(password_value)

    # ---- Create and save new user (unverified/inactive) ----
    new_user = User(
        name=user_data.name.strip(),
        email=normalized_email,
        hashed_password=hashed_password,  # ✅ Correct field name
        department=department_value,
        role=user_data.role,  # ✅ persist role so admin guard works
        is_admin=(user_data.role == "admin"),  # kept for backward compatibility
        is_active=False,
        email_verified=False,
        company_verified=False
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # ---- Create email verification token ----
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    verification = EmailVerification(
        user_id=new_user.id,
        token=token,
        expires_at=expires_at,
    )
    db.add(verification)
    db.commit()

    # ---- Send verification email in background ----
    background_tasks.add_task(send_verification_email, new_user.email, new_user.name, token)

    return {
        "message": "Registration successful. Please check your email to verify your account.",
        "requires_verification": True,
        "success": True,
    }


# ---------------- LOGIN ROUTE ---------------- #
@router.post("/login", response_model=Token)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    login_email = str(login_data.email).strip().lower()
    user = db.query(User).filter(User.email == login_email).first()

    # ---- Verify user credentials ----
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please verify your email"
        )

    if not user.company_verified:
        latest_request = (
            db.query(CompanyApprovalRequest)
            .filter(CompanyApprovalRequest.user_id == user.id)
            .order_by(CompanyApprovalRequest.created_at.desc())
            .first()
        )
        if latest_request and latest_request.status == "rejected":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rejected by company"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Waiting for company verification"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )

    # ---- Generate tokens ----
    access_token = create_access_token(data={"sub": user.email})
    refresh_token = create_refresh_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


# ---------------- REFRESH TOKEN ROUTE ---------------- #
@router.post("/refresh", response_model=Token)
async def refresh(refresh_data: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(refresh_data.refresh_token)

    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )

    email = payload.get("sub")
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # ---- Generate new tokens ----
    access_token = create_access_token(data={"sub": user.email})
    new_refresh_token = create_refresh_token(data={"sub": user.email})

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


# ---------------- VERIFY EMAIL VIA TOKEN ---------------- #
@router.get("/verify-email", response_class=HTMLResponse)
async def verify_email(token: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    verification = db.query(EmailVerification).filter(EmailVerification.token == token).first()
    if not verification:
        content = _render_feedback_page(
            "Link Invalid",
            "We could not find a matching verification request. The link may have already been used or is incorrect.",
            button_href=LOGIN_URL,
            button_label="Go to Login",
            variant="error",
        )
        return HTMLResponse(content, status_code=400)

    if verification.consumed:
        content = _render_feedback_page(
            "Email Already Verified",
            "You're all set. You can sign in with your credentials whenever you're ready.",
            button_href=LOGIN_URL,
            button_label="Go to Login",
        )
        return HTMLResponse(content, status_code=200)

    now = datetime.now(timezone.utc)
    if verification.expires_at < now:
        content = _render_feedback_page(
            "Verification Link Expired",
            "The verification window has closed. Please sign in and request a new verification email.",
            button_href=LOGIN_URL,
            button_label="Go to Login",
            variant="error",
        )
        return HTMLResponse(content, status_code=400)

    user = db.query(User).filter(User.id == verification.user_id).first()
    if not user:
        content = _render_feedback_page(
            "User Not Found",
            "We could not locate the account associated with this verification link.",
            button_href=LOGIN_URL,
            button_label="Go to Login",
            variant="error",
        )
        return HTMLResponse(content, status_code=404)

    user.email_verified = True
    approval_token: Optional[str] = None
    title = "Email Verified"
    message = "Your email is verified. You can sign in with your account now."

    if user.company_verified:
        user.is_active = True
    else:
        user.is_active = False
        approval_token = secrets.token_urlsafe(32)
        expires_at = now + timedelta(days=7)

        approval_request = (
            db.query(CompanyApprovalRequest)
            .filter(CompanyApprovalRequest.user_id == user.id, CompanyApprovalRequest.status == "pending")
            .first()
        )

        if approval_request:
            approval_request.token = approval_token
            approval_request.expires_at = expires_at
            approval_request.resolved_at = None
        else:
            approval_request = CompanyApprovalRequest(
                user_id=user.id,
                token=approval_token,
                expires_at=expires_at,
                status="pending"
            )
            db.add(approval_request)

        message = (
            "Your email is verified! An administrator at your company still needs to approve your access. "
            "We'll email you as soon as that's done."
        )

    verification.consumed = True
    verification.consumed_at = now
    db.commit()

    if approval_token:
        background_tasks.add_task(
            send_company_approval_email,
            user.name,
            user.email,
            user.department,
            user.role,
            approval_token
        )

    content = _render_feedback_page(
        title,
        message,
        button_href=LOGIN_URL,
        button_label="Go to Login",
    )
    return HTMLResponse(content, status_code=200)


@router.get("/company-approval", response_class=HTMLResponse)
async def handle_company_approval(
    token: str,
    action: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    action_normalized = (action or "").strip().lower()
    if action_normalized not in {"approve", "reject"}:
        content = _render_feedback_page(
            "Invalid Approval Action",
            "Please use one of the verification links provided in the approval email.",
            button_href=LOGIN_URL,
            button_label="Go to Login",
            variant="error",
        )
        return HTMLResponse(content, status_code=400)

    approval_request = db.query(CompanyApprovalRequest).filter(CompanyApprovalRequest.token == token).first()
    if not approval_request:
        content = _render_feedback_page(
            "Approval Link Not Found",
            "We could not locate this approval request. It may have already been processed or expired.",
            button_href=LOGIN_URL,
            button_label="Go to Login",
            variant="error",
        )
        return HTMLResponse(content, status_code=404)

    now = datetime.now(timezone.utc)

    if approval_request.status != "pending":
        status_text = approval_request.status.capitalize()
        content = _render_feedback_page(
            "Request Already Processed",
            f"This approval request was previously {status_text.lower()}. No further action is needed.",
            button_href=LOGIN_URL,
            button_label="Go to Login",
        )
        return HTMLResponse(content, status_code=200)

    if approval_request.expires_at < now:
        approval_request.status = "expired"
        approval_request.resolved_at = now
        db.commit()
        content = _render_feedback_page(
            "Approval Link Expired",
            "The approval window has passed. Ask the employee to restart the verification process.",
            button_href=LOGIN_URL,
            button_label="Go to Login",
            variant="error",
        )
        return HTMLResponse(content, status_code=400)

    user = db.query(User).filter(User.id == approval_request.user_id).first()
    if not user:
        approval_request.status = "rejected"
        approval_request.resolved_at = now
        db.commit()
        content = _render_feedback_page(
            "User Not Found",
            "The employee record linked to this request no longer exists.",
            button_href=LOGIN_URL,
            button_label="Go to Login",
            variant="error",
        )
        return HTMLResponse(content, status_code=404)

    approval_request.action_ip = request.client.host if request.client else None
    if COMPANY_APPROVER_EMAIL:
        approval_request.action_email = COMPANY_APPROVER_EMAIL

    if action_normalized == "approve":
        user.company_verified = True
        user.is_active = user.email_verified and user.company_verified
        approval_request.status = "approved"
        approval_request.resolved_at = now
        db.commit()
        background_tasks.add_task(
            send_company_approval_outcome_email,
            user.email,
            user.name,
            True,
        )
        content = _render_feedback_page(
            "Employee Approved",
            "Thanks! The employee can now sign in to Brag Board.",
            button_href=LOGIN_URL,
            button_label="Go to Login",
        )
        return HTMLResponse(content, status_code=200)

    # Reject flow
    approval_request.status = "rejected"
    approval_request.resolved_at = now
    user.company_verified = False
    user.is_active = False
    db.commit()
    background_tasks.add_task(
        send_company_approval_outcome_email,
        user.email,
        user.name,
        False,
    )
    content = _render_feedback_page(
        "Employee Rejected",
        "The employee will be notified that their access request was declined.",
        button_href=LOGIN_URL,
        button_label="Go to Login",
        variant="error",
    )
    return HTMLResponse(content, status_code=200)


# ---------------- FORGOT PASSWORD ---------------- #
@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.lower()).first()
    # Always return generic message to prevent user enumeration
    generic_response = {"message": "If that email exists, a reset link has been sent."}
    if not user:
        return success_response(generic_response["message"])

    # Create reset token (1 hour expiry)
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    reset = PasswordReset(user_id=user.id, token=token, expires_at=expires_at)
    db.add(reset)
    db.commit()

    background_tasks.add_task(send_password_reset_email, user.email, user.name, token)
    return success_response(generic_response["message"])


# ---------------- RESET PASSWORD ---------------- #
@router.post("/reset-password", response_model=ResetPasswordResponse)
async def reset_password(payload: ResetPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    reset = db.query(PasswordReset).filter(PasswordReset.token == payload.token).first()
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    if reset.consumed:
        raise HTTPException(status_code=400, detail="Reset token already used")
    now = datetime.now(timezone.utc)
    if reset.expires_at < now:
        raise HTTPException(status_code=400, detail="Reset token has expired")

    user = db.query(User).filter(User.id == reset.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    new_password = payload.new_password.strip()
    if not is_strong_password(new_password):
        raise HTTPException(status_code=400, detail=PASSWORD_POLICY_MESSAGE)

    # Update password
    user.hashed_password = get_password_hash(new_password)
    reset.consumed = True
    reset.consumed_at = now
    db.commit()

    background_tasks.add_task(
        send_password_change_confirmation_email,
        user.email,
        user.name,
    )

    return {
        "message": "Password has been reset successfully",
        "success": True,
    }
