from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

# 🔹 Association table for comment mentions
comment_mentions = Table(
    "comment_mentions",
    Base.metadata,
    Column("comment_id", Integer, ForeignKey("comments.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    shoutout_id = Column(Integer, ForeignKey("shoutouts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    shoutout = relationship("ShoutOut", back_populates="comments")
    user = relationship("User", back_populates="comments")

    # 🔹 Many-to-many relationship for mentions
    mentions = relationship("User", secondary="comment_mentions", back_populates="comment_mentions")
    reports = relationship("CommentReport", back_populates="comment", cascade="all, delete-orphan")
