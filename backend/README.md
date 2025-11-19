# Email Verification Setup

This backend now supports email verification for new user registrations via a unique verification link.

## How it works
- When a user registers, an inactive account is created (`is_active = False`).
- A verification token (valid for 24 hours) is generated and emailed to the user.
- Clicking the link calls `GET /api/auth/verify-email?token=...`.
- If valid, the user is marked active and can log in.

## Configuration
Create a `.env` file in `backend/` (you can copy `.env.example`) and set:

- `DATABASE_URL` – Postgres connection string
- `SESSION_SECRET` – JWT secret
- `APP_BASE_URL` – Base URL for backend used to construct verification links (e.g., `http://localhost:8000`)
- SMTP settings to send emails:
  - `SMTP_HOST`
  - `SMTP_PORT` (default 587)
  - `SMTP_USERNAME`
  - `SMTP_PASSWORD`
  - `EMAIL_FROM` (sender address)

If SMTP is not configured, verification emails will be printed to the server console during development.

## Endpoints
- `POST /api/auth/register` – registers a user, returns `{ message, requires_verification: true }`.
- `GET /api/auth/verify-email?token=...` – verifies the user's email and activates the account.
- `POST /api/auth/login` – requires the user to be active.

## Notes
- Tables are auto-created on startup (via `Base.metadata.create_all`). If the app already ran previously, the new `email_verifications` table will be created automatically on next start.
- Registration response changed. The frontend `Register` page and auth context were updated to show a success message and not log in until verification.
