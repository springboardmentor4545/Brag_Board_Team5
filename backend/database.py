import os
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base # Import declarative_base here

# Load environment variables from .env file
# This is useful for running the app locally
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)

# --- Database URL ---
# Get the database URL from environment variables
# Fallback to a default asyncpg URL if not set
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:password@localhost/db")

# --- Engine ---
# Create the SQLAlchemy async engine
engine = create_async_engine(DATABASE_URL, echo=True)

# --- Base Class for Models ---
# This Base will be imported by models.py
# All models will inherit from this single Base
Base = declarative_base()

# --- Session Factory ---
# Configure the sessionmaker for async sessions
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# --- Dependency to Get DB Session ---
async def get_db() -> AsyncSession:
    """
    FastAPI dependency that provides an async database session
    per request.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

