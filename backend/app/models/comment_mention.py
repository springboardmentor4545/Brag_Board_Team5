from sqlalchemy import Column, Integer, ForeignKey
from app.database import Base

class CommentMention(Base):
    __tablename__ = "comment_mentions"

    comment_id = Column(Integer, ForeignKey("comments.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
