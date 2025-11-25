import logging
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

logger = logging.getLogger("app.email")
 
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
        # In development, log when SMTP is not configured so messages stay observable
        logger.info(
            "SMTP not configured. Skipping verification email.",
            extra={"to": to_email, "subject": subject, "body": text},
        )
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
        logger.info(
            "SMTP not configured. Skipping password reset email.",
            extra={"to": to_email, "subject": subject, "body": text},
        )
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
        logger.info(
            "SMTP not configured. Skipping company approval email.",
            extra={"to": COMPANY_APPROVER_EMAIL, "subject": subject, "body": text},
        )
        return

    msg = _build_message(subject, COMPANY_APPROVER_EMAIL, html, text)

    _send_message(msg)


def send_company_approval_outcome_email(to_email: str, name: str, approved: bool) -> None:
    """Send a confirmation email to the user after company approval decision."""
    front_base = (FRONTEND_URL or "http://localhost:5000").rstrip("/") or "http://localhost:5000"
    login_link = f"{front_base}/login"

    if approved:
        subject = "Welcome to Brag Board"
        headline = "You're all set!"
        body = (
            f"Hi {name},<br />"
            "<p>Your company administrator just approved your account. You can now sign in, start posting shoutouts, and celebrate your teammates.</p>"
        )
        cta_label = "Sign in to Brag Board"
    else:
        subject = "Update on your Brag Board request"
        headline = "We're sorry"
        body = (
            f"Hi {name},<br />"
            "<p>We received a response from your company administrator and they weren't able to approve your Brag Board access at this time.</p>"
            "<p>If you think this is a mistake, please reach out to them directly and feel free to try again later.</p>"
        )
        cta_label = "Return to Brag Board"

    text_body = (
        f"Hi {name},\n\n"
        + (
            "Great news! Your company administrator approved your Brag Board account. "
            "You can now sign in and get started.\n\n"
            if approved
            else
            "We wanted to let you know that your company administrator did not approve your Brag Board access. "
            "If this doesn't look right, please contact them directly.\n\n"
        )
        + f"Sign in: {login_link}\n\n"
        + "Thanks for being part of the community!"
    )

    html_body = f"""
    <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;'>
      <h2 style='color: {"#16a34a" if approved else "#dc2626"}; margin-bottom: 16px;'>{headline}</h2>
      {body}
      <p style='margin: 24px 0;'>
        <a href="{login_link}" style='background:{"#16a34a" if approved else "#2563eb"};color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;'>
          {cta_label}
        </a>
      </p>
      <p style='font-size: 0.9rem; color: #475569;'>If the button above doesn't work, copy and paste this link into your browser:<br />
        <a href="{login_link}">{login_link}</a>
      </p>
    </div>
    """

    if not SMTP_HOST or not (EMAIL_FROM or SMTP_USERNAME):
        logger.info(
            "SMTP not configured. Skipping company approval outcome email.",
            extra={"to": to_email, "subject": subject, "body": text_body},
        )
        return

    msg = _build_message(subject, to_email, html_body, text_body)
    _send_message(msg)


def send_password_change_confirmation_email(to_email: str, name: str) -> None:
    """Notify a user that their password has been changed."""
    front_base = (FRONTEND_URL or "http://localhost:5000").rstrip("/") or "http://localhost:5000"
    login_link = f"{front_base}/login"

    subject = "Your Brag Board password was updated"
    text_body = (
        f"Hi {name},\n\n"
        "This is a confirmation that your Brag Board password was just changed. "
        "If you made this change, you're all set.\n\n"
        "If you didn't request this update, reset your password immediately using the link below and contact support.\n\n"
        f"Reset password: {front_base}/forgot-password\n"
        f"Sign in: {login_link}\n\n"
        "Stay secure!"
    )

    html_body = f"""
    <div style='font-family: Arial, sans-serif; line-height: 1.6; color: #0f172a;'>
      <h2 style='color:#2563eb;'>Password successfully updated</h2>
      <p>Hi {name},</p>
      <p>This is a quick confirmation that your Brag Board password has been changed. If you just updated it, there's nothing else you need to do.</p>
      <p>If this wasn't you, please reset your password immediately and get in touch with your administrator.</p>
      <p style='margin: 24px 0;'>
        <a href="{login_link}" style='background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;'>Sign in</a>
      </p>
      <p style='font-size: 0.9rem; color: #475569;'>Need help? Reset here: <a href="{front_base}/forgot-password">{front_base}/forgot-password</a></p>
    </div>
    """

    if not SMTP_HOST or not (EMAIL_FROM or SMTP_USERNAME):
        logger.info(
            "SMTP not configured. Skipping password change confirmation email.",
            extra={"to": to_email, "subject": subject, "body": text_body},
        )
        return

    msg = _build_message(subject, to_email, html_body, text_body)
    _send_message(msg)