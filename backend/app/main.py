from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import auth, users, shoutouts, comments, reactions, admin, notifications

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Employee Recognition Platform")

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

@app.get("/")
async def root():
    return {"message": "BragBoard"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
