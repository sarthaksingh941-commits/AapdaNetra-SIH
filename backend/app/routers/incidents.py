from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.incident import Incident
from app.schemas.incident import IncidentResponse, IncidentStatusUpdate
from app.schemas.team import AssignmentCreate, AssignmentResponse
from app.models.team import Assignment, RescueTeam, TeamStatus, AssignmentStatus

router = APIRouter()

@router.get("/", response_model=List[IncidentResponse])
def get_incidents(
    db: Session = Depends(get_db)
):
    incidents = db.query(Incident).all()
    return incidents

@router.get("/{id}", response_model=IncidentResponse)
def get_incident(
    id: int,
    db: Session = Depends(get_db)
):
    incident = db.query(Incident).filter(Incident.id == id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident

@router.patch("/{id}/status", response_model=IncidentResponse)
def update_incident_status(
    id: int,
    status_update: IncidentStatusUpdate,
    db: Session = Depends(get_db)
):
    incident = db.query(Incident).filter(Incident.id == id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    incident.status = status_update.status
    if status_update.status in ["RESOLVED", "CLOSED"]:
        assignments = db.query(Assignment).filter(Assignment.incident_id == id).all()
        for a in assignments:
            a.status = AssignmentStatus.COMPLETED
            team = db.query(RescueTeam).filter(RescueTeam.id == a.team_id).first()
            if team and str(team.status) != "OFF_DUTY":
                team.status = TeamStatus.AVAILABLE
    db.commit()
    db.refresh(incident)
    return incident

@router.post("/{id}/assign", response_model=AssignmentResponse)
def assign_team(
    id: int,
    assignment_in: AssignmentCreate,
    db: Session = Depends(get_db)
):
    incident = db.query(Incident).filter(Incident.id == id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Ensure the rescue team exists in the database so foreign key never fails
    team = db.query(RescueTeam).filter(RescueTeam.id == assignment_in.team_id).first()
    if not team:
        team = RescueTeam(
            name=f"Field Unit #{assignment_in.team_id % 10000}",
            team_type="RESCUE",
            status=TeamStatus.DISPATCHED,
            latitude=incident.latitude,
            longitude=incident.longitude,
            capacity=5
        )
        db.add(team)
        db.flush()
        assignment_in.team_id = team.id

    assignment = Assignment(
        incident_id=id,
        team_id=team.id,
        notes=assignment_in.notes or ""
    )
    db.add(assignment)
    
    incident.status = "ASSIGNED"
    team.status = TeamStatus.DISPATCHED
        
    db.commit()
    db.refresh(assignment)
    return assignment
