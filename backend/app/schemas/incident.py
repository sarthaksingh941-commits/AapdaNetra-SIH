from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.incident import IncidentStatus
from app.schemas.report import ReportResponse

class IncidentBase(BaseModel):
    title: str
    type: str
    severity: str
    latitude: float
    longitude: float

class IncidentResponse(IncidentBase):
    id: int
    priority_score: float
    status: IncidentStatus
    report_count: int
    created_at: datetime
    updated_at: datetime
    reports: Optional[List[ReportResponse]] = []

    class Config:
        from_attributes = True

class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus
