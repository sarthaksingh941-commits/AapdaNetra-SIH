from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.incident import Incident
from app.models.team import RescueTeam
from app.models.user import User
from app.core.deps import get_current_active_responder

router = APIRouter()

@router.get("/stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_responder)
):
    total_incidents = db.query(Incident).count()
    active_incidents = db.query(Incident).filter(Incident.status.in_(["REPORTED", "TRIAGED", "VERIFIED", "ASSIGNED", "RESCUE_IN_PROGRESS"])).count()
    total_teams = db.query(RescueTeam).count()
    available_teams = db.query(RescueTeam).filter(RescueTeam.status == "AVAILABLE").count()
    
    return {
        "total_incidents": total_incidents,
        "active_incidents": active_incidents,
        "total_teams": total_teams,
        "available_teams": available_teams
    }
