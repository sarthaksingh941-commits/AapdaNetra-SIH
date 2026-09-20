from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.team import RescueTeam
from app.schemas.team import RescueTeamCreate, RescueTeamResponse, RescueTeamUpdateLocation
from app.models.user import User
from app.core.deps import get_current_active_responder

router = APIRouter()

@router.get("/", response_model=List[RescueTeamResponse])
def get_teams(
    db: Session = Depends(get_db)
):
    teams = db.query(RescueTeam).all()
    return teams

@router.post("/", response_model=RescueTeamResponse)
def create_team(
    team_in: RescueTeamCreate,
    db: Session = Depends(get_db)
):
    team = RescueTeam(**team_in.dict())
    db.add(team)
    db.commit()
    db.refresh(team)
    return team

from app.schemas.team import RescueTeamLogin
from fastapi import HTTPException

@router.post("/login")
def login_team(
    login_data: RescueTeamLogin,
    db: Session = Depends(get_db)
):
    team = db.query(RescueTeam).filter(RescueTeam.id == login_data.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if team.pin != login_data.pin:
        raise HTTPException(status_code=401, detail="Incorrect PIN")
    return {"success": True, "team_id": team.id, "name": team.name, "type": team.team_type}

@router.put("/{team_id}/location", response_model=RescueTeamResponse)
def update_team_location(
    team_id: int,
    location_in: RescueTeamUpdateLocation,
    db: Session = Depends(get_db)
):
    team = db.query(RescueTeam).filter(RescueTeam.id == team_id).first()
    if not team:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Team not found")
    
    team.latitude = location_in.latitude
    team.longitude = location_in.longitude
    db.commit()
    db.refresh(team)
    return team

@router.get("/{team_id}/active-incident")
def get_team_active_incident(team_id: int, db: Session = Depends(get_db)):
    from app.models.team import Assignment
    from app.models.incident import Incident
    # Find the most recent pending or accepted assignment
    assignment = db.query(Assignment).filter(
        Assignment.team_id == team_id,
        Assignment.status.in_(["PENDING", "ACCEPTED"])
    ).order_by(Assignment.id.desc()).first()

    if not assignment:
        return None

    incident = db.query(Incident).filter(Incident.id == assignment.incident_id).first()
    return {
        "assignment_id": assignment.id,
        "status": assignment.status,
        "incident": {
            "id": incident.id,
            "title": incident.title,
            "type": incident.type,
            "latitude": incident.latitude,
            "longitude": incident.longitude,
            "reports": len(incident.reports) if incident.reports else 0
        }
    }

@router.post("/assignment/{assignment_id}/accept")
def accept_assignment(assignment_id: int, db: Session = Depends(get_db)):
    from app.models.team import Assignment
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if assignment:
        assignment.status = "ACCEPTED"
        db.commit()
    return {"success": True}
