from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from . import models, schemas
from .security import get_password_hash # CHANGED: Import from .security

async def get_user_by_email(db: AsyncSession, email: str):
    """
    Fetches a single user from the database by their email.
    """
    result = await db.execute(select(models.User).filter(models.User.email == email))
    return result.scalars().first()

async def create_user(db: AsyncSession, user: schemas.UserCreate):
    """
    Creates a new user in the database.
    Hashes the password before storing.
    """
    # Hash the password
    hashed_password = get_password_hash(user.password)
    
    # Create the SQLAlchemy User model instance
    db_user = models.User(
        email=user.email,
        name=user.name,
        hashed_password=hashed_password,
        department=user.department,
        role=user.role
    )
    
    # Add to session and commit
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    
    return db_user

