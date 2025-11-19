from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from app.models.shoutout import ShoutOut

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    department = Column(String)
    is_active = Column(Boolean, default=False, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    company_verified = Column(Boolean, default=False, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    role = Column(String, default="employee", nullable=False)  # ✅ make not nullable + default
    avatar_url = Column(String, nullable=True)

    # 👇 Make sure this matches ShoutOut.sender's back_populates
    shoutouts_sent = relationship("ShoutOut", back_populates="sender", foreign_keys=[ShoutOut.sender_id])

    shoutouts_received = relationship(
        "ShoutOutRecipient",
        back_populates="recipient",
        cascade="all, delete-orphan"
    )

    comments = relationship("Comment", back_populates="user")
    reactions = relationship("Reaction", back_populates="user")
    comment_mentions = relationship("Comment", secondary="comment_mentions", back_populates="mentions")
    reports = relationship("Report", back_populates="reporter", cascade="all, delete-orphan")
    comment_reports = relationship("CommentReport", back_populates="reporter", cascade="all, delete-orphan")

    approval_requests = relationship(
        "CompanyApprovalRequest",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    notifications = relationship(
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
        order_by="Notification.created_at.desc()",
        foreign_keys="Notification.user_id"
    )
