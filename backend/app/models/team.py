from sqlalchemy import Column, Integer, String, Float, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.db.database import Base
from datetime import datetime
import enum

class TeamStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    DISPATCHED = "DISPATCHED"
    BUSY = "BUSY"
    OFF_DUTY = "OFF_DUTY"

class RescueTeam(Base):
    __tablename__ = "rescue_teams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    team_type = Column(String, nullable=False)
    status = Column(Enum(TeamStatus), default=TeamStatus.AVAILABLE)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    capacity = Column(Integer, default=5)

    assignments = relationship("Assignment", back_populates="team")

class AssignmentStatus(str, enum.Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class Assignment(Base):
    __tablename__ = "assignments"

    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"))
    team_id = Column(Integer, ForeignKey("rescue_teams.id"))
    status = Column(Enum(AssignmentStatus), default=AssignmentStatus.PENDING)
    notes = Column(String, nullable=True)
    assigned_at = Column(DateTime, default=datetime.utcnow)

    incident = relationship("Incident", back_populates="assignments")
    team = relationship("RescueTeam", back_populates="assignments")
