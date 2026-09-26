from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import get_settings

settings = get_settings()

# Add connect_args={"check_same_thread": False} for SQLite
db_uri = settings.get_database_uri
try:
    engine = create_engine(
        db_uri, 
        connect_args={"check_same_thread": False} if db_uri.startswith("sqlite") else {}
    )
except Exception as e:
    print(f"Warning: Failed to create engine with URI '{db_uri}': {e}. Falling back to SQLite.")
    engine = create_engine("sqlite:///./aapdanetra.db", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
