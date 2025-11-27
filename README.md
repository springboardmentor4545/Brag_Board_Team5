# Brag Board – Development Guide

Brag Board is a full-stack employee recognition platform built with a FastAPI backend and a React (Vite + Tailwind) frontend. This guide walks through setting up the project locally, configuring dependencies, and running both servers side by side.

## Prerequisites

- Python 3.11 or later
- Node.js 20.x (or newer) and npm 10+
- PostgreSQL 14+ running locally or accessible remotely
- Git and a terminal with Bash support

## Project Structure

```
backend/    # FastAPI service
frontend/   # React + Vite client
uploads/    # Media uploads written by the backend
```

## Quick Start

1. Clone the repository and move into the project directory.
2. Follow the backend setup instructions to create a virtual environment, install dependencies, and configure environment variables.
3. Prepare a PostgreSQL database and update `backend/.env` with your connection details.
4. Launch the backend with `uvicorn`.
5. Install frontend dependencies and start the Vite dev server.
6. Open `http://localhost:5000` in your browser.

The sections below break down each step in detail.

## Backend Setup (FastAPI)

### 1. Create a virtual environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Configure environment variables

Copy the example file and adjust values to match your environment:

```bash
cp .env.example .env
```

Update the following keys in `.env`:

- `DATABASE_URL` – PostgreSQL connection string (e.g. `postgresql://postgres:password@localhost:5432/bragboard`)
- `SESSION_SECRET` – long random string for JWT signing
- `FRONTEND_URL` – usually `http://localhost:5000`
- `APP_BASE_URL` – backend base URL, typically `http://localhost:8000`
- `SMTP_*`, `EMAIL_FROM`, `COMPANY_APPROVER_EMAIL` – mail settings used for verification emails. If SMTP is not ready, FastAPI will log emails to the console.

### 4. Prepare the database

Create a PostgreSQL database that matches your `DATABASE_URL`.

```bash
createdb bragboard
```

Tables are created automatically on startup via SQLAlchemy metadata. If you already ran the app previously, new tables will be added the next time the server starts.

### 5. Start the backend server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API is now available at `http://localhost:8000`. Helpful endpoints include:

- `GET /health` – quick health check
- `GET /docs` – interactive Swagger documentation

Keep this terminal session running while you work on the frontend.

## Frontend Setup (React + Vite)

### 1. Install dependencies

In a new terminal window:

```bash
cd frontend
npm install
```

### 2. Run the development server

```bash
npm run dev
```

By default Vite serves the app at `http://localhost:5000` and proxies `/api` and `/uploads` to the FastAPI backend on port 8000. Any changes to the frontend source trigger hot module reloads.

### 3. Optional scripts

- `npm run lint` – run ESLint across the frontend codebase
- `npm run build` – produce a production build in `frontend/dist`
- `npm run preview` – preview the production build locally

## Running the Full Stack

1. Ensure PostgreSQL is running and accessible.
2. Start the FastAPI backend (`uvicorn app.main:app --reload`).
3. Start the Vite frontend (`npm run dev`).
4. Visit `http://localhost:5000` and log in or register.

For registration flows, the backend issues email verification links. Without SMTP configured, check the backend console output for the verification URL.

Uploads (avatars, shout-outs) are written to the `uploads/` directory in the repository root and served at `http://localhost:5000/uploads/...` via proxy.

## Troubleshooting

- **Blank admin dashboard or API errors** – confirm both servers are running and that the frontend proxy points to the correct backend host/port. Check browser dev tools for failing network requests.
- **Database connection failures** – verify `DATABASE_URL`, confirm the database exists, and ensure PostgreSQL accepts connections from your user.
- **Email not sending** – double-check SMTP credentials. During development you can leave SMTP blank and use the console output for verification links.
- **Dependency issues** – re-run `pip install -r requirements.txt` and `npm install` after pulling new changes.

## Useful Links

- Backend docs: `http://localhost:8000/docs`
- Frontend dev server: `http://localhost:5000`
- FastAPI documentation: https://fastapi.tiangolo.com/
- Vite documentation: https://vitejs.dev/

You now have a working local instance of Brag Board. Happy building!
