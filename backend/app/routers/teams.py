from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.team import RescueTeam
from app.schemas.team import RescueTeamCreate, RescueTeamResponse, RescueTeamUpdateLocation
from app.models.user import User
from app.core.deps import get_current_active_responder

router = APIRouter()

@router.get("/")
def get_teams(
    db: Session = Depends(get_db)
):
    try:
        teams = db.query(RescueTeam).all()
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
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))

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
