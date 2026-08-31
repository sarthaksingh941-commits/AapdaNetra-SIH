from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.team import TeamStatus, AssignmentStatus

class RescueTeamBase(BaseModel):
    name: str
    team_type: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    capacity: Optional[int] = 5

class RescueTeamCreate(RescueTeamBase):
    pass

class RescueTeamResponse(RescueTeamBase):
    id: int
    status: TeamStatus

    class Config:
        from_attributes = True

class AssignmentBase(BaseModel):
    incident_id: int
    team_id: int
    notes: Optional[str] = None

class AssignmentCreate(AssignmentBase):
    pass

class AssignmentResponse(AssignmentBase):
    id: int
    status: AssignmentStatus
    assigned_at: datetime

    class Config:
        from_attributes = True
