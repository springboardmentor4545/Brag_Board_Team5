import logging
import os
from fastapi import FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base
from app.routes import auth, users, shoutouts, comments, reactions, admin, notifications
from app.utils.responses import error_response, success_response

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Employee Recognition Platform")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(shoutouts.router)
app.include_router(comments.router)
app.include_router(reactions.router)
app.include_router(admin.router)
app.include_router(notifications.router)

# Static file serving for uploaded attachments
uploads_dir = os.path.join(os.getcwd(), 'uploads')
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    detail = exc.detail
    message = "HTTP error"
    errors = None
    if isinstance(detail, dict):
        message = str(detail.get("message") or detail.get("detail") or message)
        errors = detail.get("errors")
    elif detail:
        message = str(detail)
    payload = error_response(message, errors=errors)
    return JSONResponse(status_code=exc.status_code, content=payload)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning(
        "Validation error",
        extra={"path": str(request.url.path), "errors": exc.errors()},
    )
    payload = error_response("Validation failed", errors=exc.errors())
    return JSONResponse(status_code=422, content=payload)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception", extra={"path": str(request.url.path)})
    payload = error_response("Internal server error")
    return JSONResponse(status_code=500, content=payload)

@app.get("/")
async def root():
    return success_response("BragBoard")

@app.get("/health")
async def health():
    return success_response("Service is healthy", {"status": "healthy"})
