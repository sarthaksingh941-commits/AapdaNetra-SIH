from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime
import enum

class ReportStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    REJECTED = "REJECTED"

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    description = Column(String, nullable=False)
    disaster_type = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    people_count = Column(Integer, default=0)
    vulnerable_count = Column(Integer, default=0)
    evidence_url = Column(String, nullable=True)
    confidence_score = Column(Float, nullable=True)
    status = Column(Enum(ReportStatus), default=ReportStatus.PENDING)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="reports")
    incident = relationship("Incident", back_populates="reports")
