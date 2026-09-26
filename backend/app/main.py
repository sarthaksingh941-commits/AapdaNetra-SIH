from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.db.database import engine, Base
from app.models import * # Import models to ensure they are registered with Base
from app.routers import auth
from app.core.config import get_settings

settings = get_settings()

# Create database tables safely without crashing uvicorn startup
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print("Database metadata create_all warning:", e)

# Auto-seed and reset mock teams to OFF_DUTY on startup
try:
    from seed_teams import seed_teams
    seed_teams()
except Exception as e:
    print("Could not seed teams on startup:", e)

# Ensure no ghost trucks appear by resetting existing unassigned database teams to OFF_DUTY
try:
    with engine.connect() as conn:
        from sqlalchemy import text
        conn.execute(text("UPDATE rescue_teams SET status = 'OFF_DUTY';"))
        conn.commit()
except Exception as e:
    print("Notice resetting teams to off-duty on startup:", e)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-Powered Disaster Intelligence & Response Platform",
    version=settings.VERSION
)

# Configure CORS
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "https://aapda-netra-sih.vercel.app",
    "https://aapdanetra-sih.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
from app.routers import reports, incidents, teams, dashboard
app.include_router(reports.router, prefix=f"{settings.API_V1_STR}/reports", tags=["reports"])
app.include_router(incidents.router, prefix=f"{settings.API_V1_STR}/incidents", tags=["incidents"])
app.include_router(teams.router, prefix=f"{settings.API_V1_STR}/teams", tags=["teams"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["dashboard"])

@app.get("/")
def read_root():
    return {"message": "Welcome to AapdaNetra API"}
