from sqlalchemy import Column, Integer, String, DateTime, Enum as SAEnum
# We no longer import declarative_base here
from datetime import datetime
from .schemas import UserRole
# Import the shared Base from database.py
from .database import Base  

# (We now use the imported Base)

class User(Base):
    """
    SQLAlchemy model for the 'users' table.
    Inherits from the shared Base in database.py
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    department = Column(String(100), nullable=False)
    
    # Use the 'UserRole' enum, storing its string value in the database
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.employee)
    
    joined_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<User(name='{self.name}', email='{self.email}', role='{self.role}')>"

