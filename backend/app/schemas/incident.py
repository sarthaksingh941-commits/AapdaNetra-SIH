from pydantic import BaseModel, field_serializer
from typing import Optional, List
from datetime import datetime, timezone
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

    @field_serializer("created_at", "updated_at", mode="wrap")
    def serialize_dt(self, dt: datetime, handler):
        if isinstance(dt, datetime) and dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return handler(dt)

    class Config:
        from_attributes = True

class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus
