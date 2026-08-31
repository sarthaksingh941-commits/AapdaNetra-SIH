from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.incident import Incident
from app.schemas.incident import IncidentResponse, IncidentStatusUpdate
from app.schemas.team import AssignmentCreate, AssignmentResponse
from app.models.team import Assignment
from app.models.user import User
from app.core.deps import get_current_active_responder

router = APIRouter()

@router.get("/", response_model=List[IncidentResponse])
def get_incidents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_responder)
):
    incidents = db.query(Incident).all()
    return incidents

@router.get("/{id}", response_model=IncidentResponse)
def get_incident(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_responder)
):
    incident = db.query(Incident).filter(Incident.id == id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@router.patch("/{id}/status", response_model=IncidentResponse)
def update_incident_status(
    id: int,
    status_update: IncidentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_responder)
):
    incident = db.query(Incident).filter(Incident.id == id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    incident.status = status_update.status
    db.commit()
    db.refresh(incident)
    return incident

@router.post("/{id}/assign", response_model=AssignmentResponse)
def assign_team(
    id: int,
    assignment_in: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_responder)
):
    assignment = Assignment(**assignment_in.dict())
    db.add(assignment)
    
    # Update incident status if needed
    incident = db.query(Incident).filter(Incident.id == id).first()
    if incident:
        incident.status = "ASSIGNED"
        
    db.commit()
    db.refresh(assignment)
    return assignment
