from sqlalchemy.orm import Session
from app.models.incident import Incident
import math

def calculate_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance in kilometers between two points 
    on the earth (specified in decimal degrees) using Haversine formula.
    """
    # Convert decimal degrees to radians 
    lon1, lat1, lon2, lat2 = map(math.radians, [lon1, lat1, lon2, lat2])

    # Haversine formula 
    dlon = lon2 - lon1 
    dlat = lat2 - lat1 
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a)) 
    r = 6371 # Radius of earth in kilometers
    return c * r

def find_cluster_incident(db: Session, lat: float, lng: float, disaster_type: str, max_distance_km: float = 2.0):
    """
    Find an active incident within the max_distance_km with the same disaster type.
    """
    active_incidents = db.query(Incident).filter(
        Incident.status.in_(["REPORTED", "TRIAGED", "VERIFIED"])
    ).all()
    
    for incident in active_incidents:
        if incident.type == disaster_type:
            distance = calculate_distance(lat, lng, incident.latitude, incident.longitude)
            if distance <= max_distance_km:
                return incident
                
    return None
