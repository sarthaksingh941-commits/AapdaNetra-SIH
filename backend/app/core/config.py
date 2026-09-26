from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "AapdaNetra"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # SQLite for testing
    DATABASE_URI: str = "sqlite:///./aapdanetra.db"
    DATABASE_URL: str = ""
    
    # Auth
    SECRET_KEY: str = "replace-this-with-a-very-long-and-secure-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    ADMIN_SECRET_KEY: str = "AAPDA_SIH_2024"
    
    @property
    def get_database_uri(self) -> str:
        import os
        uri = os.getenv("DATABASE_URL") or os.getenv("DATABASE_URI") or self.DATABASE_URL or self.DATABASE_URI
        if not uri:
            return "sqlite:///./aapdanetra.db"
        # Render provides 'postgres://' or 'postgresql://' by default.
        # Specify postgresql+psycopg2:// so SQLAlchemy uses psycopg2-binary
        if uri.startswith("postgres://"):
            return uri.replace("postgres://", "postgresql+psycopg2://", 1)
        elif uri.startswith("postgresql://"):
            return uri.replace("postgresql://", "postgresql+psycopg2://", 1)
        return uri

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
