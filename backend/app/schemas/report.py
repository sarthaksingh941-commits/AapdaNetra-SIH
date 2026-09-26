from pydantic import BaseModel, field_serializer
from typing import Optional
from datetime import datetime, timezone
from app.models.report import ReportStatus

class ReportBase(BaseModel):
    description: str
    disaster_type: str
    latitude: float
    longitude: float
    people_count: Optional[int] = 0
    vulnerable_count: Optional[int] = 0
    evidence_url: Optional[str] = None

class ReportCreate(ReportBase):
    pass

class ReportResponse(ReportBase):
    id: int
    user_id: int
    confidence_score: Optional[float] = None
    status: ReportStatus
    incident_id: Optional[int] = None
    created_at: datetime

    @field_serializer("created_at", mode="wrap")
    def serialize_dt(self, dt: datetime, handler):
        if isinstance(dt, datetime) and dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return handler(dt)

    class Config:
        from_attributes = True
