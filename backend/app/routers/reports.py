from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.models.report import Report
from app.models.incident import Incident
from app.schemas.report import ReportCreate, ReportResponse
from app.core.deps import get_current_user
from app.services.clustering import find_cluster_incident

router = APIRouter()

@router.post("/", response_model=ReportResponse)
def create_report(
    report_in: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Calculate simple priority score for this specific report
    report_score = 0
    if report_in.disaster_type in ['flood', 'earthquake', 'fire', 'accident']:
        report_score += 35
    report_score += min(report_in.people_count, 25)
    report_score += min(report_in.vulnerable_count * 3, 20)
    
    # 1. AI Clustering Phase: Check if this report belongs to an existing incident
    incident = find_cluster_incident(
        db=db, 
        lat=report_in.latitude, 
        lng=report_in.longitude, 
        disaster_type=report_in.disaster_type,
        max_distance_km=2.0 # Cluster if within 2 km
    )
    
    if incident:
        # Update existing incident
        incident.report_count += 1
        # Increase priority score slightly for multiple reports (Confidence boost)
        incident.priority_score = min(incident.priority_score + 5.0, 100.0) 
        db.commit()
    else:
        # Create a new incident
        incident = Incident(
            title=f"{report_in.disaster_type.title()} Emergency",
            type=report_in.disaster_type,
            severity="HIGH" if report_score > 50 else "MEDIUM",
            priority_score=report_score,
            latitude=report_in.latitude,
            longitude=report_in.longitude,
            status="REPORTED",
            report_count=1
        )
        db.add(incident)
        db.flush() # Get incident ID

    # Create the report and link to the incident
    report = Report(
        **report_in.dict(),
        user_id=current_user.id,
        incident_id=incident.id
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report

@router.get("/my", response_model=List[ReportResponse])
def get_my_reports(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    reports = db.query(Report).filter(Report.user_id == current_user.id).all()
    return reports
