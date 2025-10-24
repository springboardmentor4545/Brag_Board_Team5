import os
from contextlib import asynccontextmanager # Added
from datetime import timedelta
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from dotenv import load_dotenv

# Import all modules that define models so Base.metadata is populated
from . import auth, crud, models, schemas, security 
# Import Base and engine for table creation
from .database import get_db, engine, Base 

# Load .env file
load_dotenv()

# --- Lifespan for application startup ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Async context manager for FastAPI app startup and shutdown events.
    On startup, it creates all database tables.
    """
    print("Application startup: Creating database tables...")
    async with engine.begin() as conn:
        # This line creates all tables defined by models that inherit from Base
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created successfully.")
    
    yield # The application runs here
    
    print("Application shutdown.")

# --- FastAPI App Initialization ---
app = FastAPI(
    title="User Auth API",
    description="API for user registration/login with JWT.",
    version="0.1.0",
    lifespan=lifespan  # This tells FastAPI to run our lifespan function
)

# --- CORS Middleware ---
# Configure CORS to allow the React frontend to make requests
origins = [
    "http://localhost:3000",  # Default React dev server port
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",  # Vite default port
    "http://localhost:5173",
    # Add other origins as needed (e.g., your production frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# --- API Endpoints ---

@app.post("/register", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
async def register_user(user: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Register a new user.
    Hashes the password before storing.
    """
    # Check if user already exists
    db_user = await crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
    
    # Create the new user
    new_user = await crud.create_user(db=db, user=user)
    return new_user

@app.post("/token", response_model=schemas.Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: AsyncSession = Depends(get_db)
):
    """
    Provides a JWT access token for a valid user.
    Takes form data (username, password).
    """
    # Authenticate the user
    user = await crud.get_user_by_email(db, email=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create the access token
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    """
    Fetches the profile for the currently authenticated user.
    """
    # The 'current_user' is already the complete User model object
    # from the get_current_user dependency
    return current_user

@app.get("/users/me/department", response_model=schemas.DepartmentInfo)
async def read_user_department_info(
    current_user: models.User = Depends(auth.get_current_user)
):
    """
    Example of a department-scoped endpoint.
    Only returns info about the user's own department.
    """
    # In a real app, you might fetch data based on current_user.department
    # For this example, we just return the user's department info.
    return {
        "department": current_user.department,
        "role": current_user.role,
        "message": f"You are seeing info for the {current_user.department} department."
    }

@app.get("/admin/dashboard", response_model=dict)
async def read_admin_dashboard(
    current_admin: models.User = Depends(auth.get_current_admin_user)
):
    """
    Example of an admin-only endpoint.
    The 'get_current_admin_user' dependency ensures only admins can access this.
    """
    return {
        "message": f"Welcome, Admin {current_admin.name}!",
        "admin_data": "This is sensitive admin-only data."
    }

@app.get("/")
async def read_root():
    """
Root endpoint for health check.
    """
    return {"status": "API is running"}

