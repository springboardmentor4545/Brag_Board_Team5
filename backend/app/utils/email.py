import os
import smtplib
from email.message import EmailMessage
from typing import Optional
 
SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
EMAIL_FROM = os.getenv("EMAIL_FROM") or os.getenv("SMTP_FROM")
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:8000")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5000")
COMPANY_APPROVER_EMAIL = os.getenv("COMPANY_APPROVER_EMAIL", "admin@bragboard.space")
 
_smtp_use_ssl_env = os.getenv("SMTP_USE_SSL")
if _smtp_use_ssl_env is None:
    SMTP_USE_SSL = SMTP_PORT == 465
else:
    SMTP_USE_SSL = _smtp_use_ssl_env.strip().lower() in {"1", "true", "yes", "on"}
 
_smtp_use_tls_env = os.getenv("SMTP_USE_TLS")
if _smtp_use_tls_env is None:
    SMTP_USE_TLS = not SMTP_USE_SSL
else:
    SMTP_USE_TLS = _smtp_use_tls_env.strip().lower() in {"1", "true", "yes", "on"}
 
 
def _build_message(subject: str, to_email: str, html_body: str, text_body: Optional[str] = None) -> EmailMessage:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"Brag Board <{EMAIL_FROM}>"
    msg["To"] = to_email
    if text_body:
        msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    return msg
 
 
def _send_message(msg: EmailMessage) -> None:
    if SMTP_USE_SSL:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USERNAME and SMTP_PASSWORD:
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
 
 
def send_verification_email(to_email: str, name: str, token: str) -> None:
    """
    Sends a verification email with a unique link to the user.
    The link points to the backend verify endpoint.
    """
    verify_link = f"{APP_BASE_URL}/api/auth/verify-email?token={token}"
    subject = "Verify your email address"
    text = f"Hello {name},\n\nPlease verify your email by clicking the link: {verify_link}\nThis link will expire in 24 hours.\n\nIf you did not sign up, you can ignore this email."
    html = f"""
    <div style='font-family: Arial, sans-serif; line-height: 1.6;'>
      <h2>Welcome to BragBoard, {name}!</h2>
      <p>Thanks for signing up. Please verify your email address by clicking the button below:</p>
      <p>
        <a href="{verify_link}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Verify Email</a>
      </p>
      <p>Or copy and paste this URL into your browser:</p>
      <p><a href="{verify_link}">{verify_link}</a></p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account, you can ignore this email.</p>
    </div>
    """
 
    if not SMTP_HOST or not (EMAIL_FROM or SMTP_USERNAME):
        # In development, print to console if SMTP is not configured
        print("[Email] SMTP not configured. Would send to:", to_email)
        print("Subject:", subject)
        print("Body:\n", text)
        return
 
    msg = _build_message(subject, to_email, html, text)
 
    _send_message(msg)
 
 
def send_password_reset_email(to_email: str, name: str, token: str) -> None:
    """Send password reset email containing a unique link."""
    # Send users to the frontend reset page where they can enter a new password
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
    subject = "Reset your password"
    text = (
        f"Hello {name},\n\n"
        f"You recently requested to reset your password. Click the link below to proceed:\n{reset_link}\n\n"
        f"If you did not request this, you can ignore this email. The link expires in 1 hour."
    )
    html = f"""
    <div style='font-family: Arial, sans-serif; line-height: 1.6;'>
      <h2>Password Reset Request</h2>
      <p>Hello {name},</p>
      <p>You requested a password reset. Click the button below to set a new password (link valid 1 hour):</p>
      <p><a href="{reset_link}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Reset Password</a></p>
      <p>Or copy and paste this URL:</p>
      <p><a href="{reset_link}">{reset_link}</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    </div>
    """
 
    if not SMTP_HOST or not (EMAIL_FROM or SMTP_USERNAME):
        print("[Email] SMTP not configured. Would send password reset to:", to_email)
        print("Subject:", subject)
        print("Body:\n", text)
        return
 
    msg = _build_message(subject, to_email, html, text)
    _send_message(msg)
 
 
def send_company_approval_email(name: str, email: str, department: Optional[str], role: str, token: str) -> None:
        """Notify company approvers about a newly verified user awaiting approval."""
        if not COMPANY_APPROVER_EMAIL:
                # Fail silently if no approver email configured
                return
 
        approve_link = f"{APP_BASE_URL}/api/auth/company-approval?token={token}&action=approve"
        reject_link = f"{APP_BASE_URL}/api/auth/company-approval?token={token}&action=reject"
 
        subject = "New employee waiting for approval"
        department_display = department or "Not specified"
        text = (
                f"A new user has completed email verification.\n\n"
                f"Name: {name}\n"
                f"Email: {email}\n"
                f"Department: {department_display}\n"
                f"Role: {role}\n\n"
                f"Approve: {approve_link}\n"
                f"Reject: {reject_link}\n"
        )
 
        html = f"""
        <div style='font-family: Arial, sans-serif; line-height: 1.6;'>
            <h2>New Employee Awaiting Approval</h2>
            <p>A new user has completed email verification and is waiting for company approval.</p>
            <table style='border-collapse: collapse; margin-bottom: 16px;'>
                <tr>
                    <td style='font-weight:bold; padding:4px 12px;'>Name</td>
                    <td style='padding:4px 12px;'>{name}</td>
                </tr>
                <tr>
                    <td style='font-weight:bold; padding:4px 12px;'>Email</td>
                    <td style='padding:4px 12px;'>{email}</td>
                </tr>
                <tr>
                    <td style='font-weight:bold; padding:4px 12px;'>Department</td>
                    <td style='padding:4px 12px;'>{department_display}</td>
                </tr>
                <tr>
                    <td style='font-weight:bold; padding:4px 12px;'>Role</td>
                    <td style='padding:4px 12px;'>{role}</td>
                </tr>
            </table>
            <p>Please choose an action:</p>
            <p>
                <a href="{approve_link}" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;margin-right:12px;display:inline-block">Approve</a>
                <a href="{reject_link}" style="background:#dc2626;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;display:inline-block">Reject</a>
            </p>
            <p>If the buttons above do not work, use these links:</p>
            <p>Approve: <a href="{approve_link}">{approve_link}</a></p>
            <p>Reject: <a href="{reject_link}">{reject_link}</a></p>
        </div>
        """
 
        if not SMTP_HOST or not (EMAIL_FROM or SMTP_USERNAME):
                print("[Email] SMTP not configured. Would notify:", COMPANY_APPROVER_EMAIL)
                print("Subject:", subject)
                print("Body:\n", text)
                return
 
        msg = _build_message(subject, COMPANY_APPROVER_EMAIL, html, text)
 
        _send_message(msg)