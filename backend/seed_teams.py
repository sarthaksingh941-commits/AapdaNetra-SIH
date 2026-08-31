import sys
import os

# Add the app directory to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.team import RescueTeam

def seed_teams():
    db = SessionLocal()
    
    # Check if teams already exist
    if db.query(RescueTeam).count() > 0:
        print("Teams already seeded.")
        return

    teams = [
        RescueTeam(name="NDRF Alpha Team", team_type="Multi-hazard", latitude=28.6139, longitude=77.2090, capacity=10),
        RescueTeam(name="Delhi Fire Service - Unit 4", team_type="Fire", latitude=28.5355, longitude=77.3910, capacity=5),
        RescueTeam(name="State Medical Response", team_type="Medical", latitude=28.7041, longitude=77.1025, capacity=8),
        RescueTeam(name="SDRF Water Rescue", team_type="Flood", latitude=26.4499, longitude=80.3319, capacity=12) # Near Kanpur for testing
    ]
    
    db.bulk_save_objects(teams)
    db.commit()
    db.close()
    print("Rescue Teams seeded successfully!")

if __name__ == "__main__":
    seed_teams()
