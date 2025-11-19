from pydantic import BaseModel
from datetime import datetime
from typing import Dict, List, Optional

class ReactionCreate(BaseModel):
    type: str

class Reaction(BaseModel):
    id: int
    shoutout_id: int
    user_id: int
    type: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReactionUser(BaseModel):
    id: int
    name: str
    email: str
    department: Optional[str] = None
    avatar_url: Optional[str] = None


class ReactionSummary(BaseModel):
    shoutout_id: int
    counts: Dict[str, int]
    users: Dict[str, List[ReactionUser]]
