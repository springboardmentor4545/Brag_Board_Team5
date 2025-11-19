from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class ShoutOutCreate(BaseModel):
    message: str
    recipient_ids: List[int]

class ShoutOutUpdate(BaseModel):
    message: str

class ShoutOutAttachment(BaseModel):
    url: str
    name: Optional[str] = None
    type: Optional[str] = None
    size: Optional[int] = None

    class Config:
        from_attributes = True

class ShoutOutRecipient(BaseModel):
    id: int
    name: str
    email: str
    department: Optional[str]

    class Config:
        from_attributes = True

class ShoutOut(BaseModel):
    id: int
    sender_id: int
    message: str
    created_at: datetime
    updated_at: datetime
    sender: dict
    recipients: List[dict]
    reaction_counts: dict
    comment_count: int
    user_reactions: List[str]
    attachments: Optional[List[ShoutOutAttachment]] = None

    class Config:
        from_attributes = True
