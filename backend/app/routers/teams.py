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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_responder)
):
    teams = db.query(RescueTeam).all()
    return teams

@router.post("/", response_model=RescueTeamResponse)
def create_team(
    team_in: RescueTeamCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_responder)
):
    team = RescueTeam(**team_in.dict())
    db.add(team)
    db.commit()
    db.refresh(team)
    return team

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
