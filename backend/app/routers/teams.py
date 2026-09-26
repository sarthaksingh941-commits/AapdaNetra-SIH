from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.team import RescueTeam, TeamStatus, Assignment, AssignmentStatus
from app.schemas.team import RescueTeamCreate, RescueTeamResponse, RescueTeamUpdateLocation
from pydantic import BaseModel

router = APIRouter()

@router.get("/")
def get_teams(
    db: Session = Depends(get_db)
):
    try:
        # Strictly return ONLY teams that are NOT off-duty and have valid GPS coordinates
        teams = db.query(RescueTeam).filter(
            RescueTeam.status != TeamStatus.OFF_DUTY,
            RescueTeam.status != "OFF_DUTY",
            RescueTeam.latitude.isnot(None),
            RescueTeam.longitude.isnot(None)
        ).all()
        return [
            {
                "id": t.id,
                "name": t.name,
                "team_type": t.team_type,
                "status": t.status.value if hasattr(t.status, "value") else str(t.status or "AVAILABLE"),
                "latitude": t.latitude,
                "longitude": t.longitude,
                "capacity": t.capacity
            }
            for t in teams
        ]
    except Exception as e:
        import traceback
        print("GET TEAMS ERROR:", traceback.format_exc())
        return []

@router.post("/")
def create_team(
    team_in: RescueTeamCreate,
    db: Session = Depends(get_db)
):
    try:
        existing = db.query(RescueTeam).filter(RescueTeam.name == team_in.name).first()
        if existing:
            if team_in.team_type:
                existing.team_type = team_in.team_type
            if team_in.latitude is not None:
                existing.latitude = team_in.latitude
            if team_in.longitude is not None:
                existing.longitude = team_in.longitude
            existing.status = TeamStatus.AVAILABLE
            db.commit()
            db.refresh(existing)
            return {
                "id": existing.id,
                "name": existing.name,
                "team_type": existing.team_type,
                "status": existing.status.value if hasattr(existing.status, "value") else str(existing.status or "AVAILABLE"),
                "latitude": existing.latitude,
                "longitude": existing.longitude
            }

        team = RescueTeam(
            name=team_in.name,
            team_type=team_in.team_type,
            status=TeamStatus.AVAILABLE,
            latitude=team_in.latitude,
            longitude=team_in.longitude,
            capacity=team_in.capacity or 5
        )
        db.add(team)
        db.commit()
        db.refresh(team)
        return {
            "id": team.id,
            "name": team.name,
            "team_type": team.team_type,
            "status": team.status.value if hasattr(team.status, "value") else str(team.status or "AVAILABLE"),
            "latitude": team.latitude,
            "longitude": team.longitude
        }
    except Exception as e:
        db.rollback()
        import traceback
        print("CREATE TEAM ERROR:", traceback.format_exc())
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{team_id}/location", response_model=RescueTeamResponse)
def update_team_location(
    team_id: int,
    location_in: RescueTeamUpdateLocation,
    db: Session = Depends(get_db)
):
    team = db.query(RescueTeam).filter(RescueTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    team.latitude = location_in.latitude
    team.longitude = location_in.longitude
    db.commit()
    db.refresh(team)
    return team

class TeamStatusUpdate(BaseModel):
    status: str

@router.patch("/{team_id}/status")
def update_team_status(
    team_id: int,
    status_in: TeamStatusUpdate,
    db: Session = Depends(get_db)
):
    team = db.query(RescueTeam).filter(RescueTeam.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    team.status = status_in.status
    db.commit()
    db.refresh(team)
    return {
        "id": team.id,
        "name": team.name,
        "status": team.status.value if hasattr(team.status, "value") else str(team.status)
    }

@router.get("/{team_id}/active-incident")
def get_team_active_incident(team_id: int, db: Session = Depends(get_db)):
    team = db.query(RescueTeam).filter(RescueTeam.id == team_id).first()
    if not team or str(team.status) == "OFF_DUTY" or (hasattr(team.status, "value") and team.status.value == "OFF_DUTY"):
        return None

    from app.models.incident import Incident
    # Strict isolation: Only query assignments explicitly targeted to this team_id
    assignment = db.query(Assignment).filter(
        Assignment.team_id == team_id,
        Assignment.status.in_(["PENDING", "ACCEPTED"])
    ).order_by(Assignment.id.desc()).first()

    if not assignment:
        return None

    incident = db.query(Incident).filter(Incident.id == assignment.incident_id).first()
    if not incident or incident.status in ["RESOLVED", "CLOSED"]:
        return None

    return {
        "assignment_id": assignment.id,
        "team_id": team_id,
        "status": assignment.status.value if hasattr(assignment.status, "value") else str(assignment.status),
        "incident": {
            "id": incident.id,
            "title": incident.title,
            "type": incident.type,
            "latitude": incident.latitude,
            "longitude": incident.longitude,
            "priority_score": incident.priority_score,
            "reports": len(incident.reports) if incident.reports else (incident.report_count or 1)
        }
    }

@router.post("/assignment/{assignment_id}/accept")
def accept_assignment(assignment_id: int, db: Session = Depends(get_db)):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment:
        assignment.status = AssignmentStatus.ACCEPTED
        team = db.query(RescueTeam).filter(RescueTeam.id == assignment.team_id).first()
        if team:
            team.status = TeamStatus.DISPATCHED
        db.commit()
    return {"success": True}

@router.post("/assignment/{assignment_id}/decline")
def decline_assignment(assignment_id: int, db: Session = Depends(get_db)):
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment:
        assignment.status = AssignmentStatus.CANCELLED
        team = db.query(RescueTeam).filter(RescueTeam.id == assignment.team_id).first()
        if team and str(team.status) != "OFF_DUTY":
            team.status = TeamStatus.AVAILABLE
        db.commit()
    return {"success": True}

