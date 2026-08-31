from sqlalchemy import Column, Integer, String, Float, DateTime, Enum
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime
import enum

class IncidentStatus(str, enum.Enum):
    REPORTED = "REPORTED"
    TRIAGED = "TRIAGED"
    VERIFIED = "VERIFIED"
    ASSIGNED = "ASSIGNED"
    RESCUE_IN_PROGRESS = "RESCUE_IN_PROGRESS"
    RESOLVED = "RESOLVED"
    NEEDS_REVIEW = "NEEDS_REVIEW"

class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    priority_score = Column(Float, default=0.0)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    status = Column(Enum(IncidentStatus), default=IncidentStatus.REPORTED)
    report_count = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    reports = relationship("Report", back_populates="incident")
    assignments = relationship("Assignment", back_populates="incident")
