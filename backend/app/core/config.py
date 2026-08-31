from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "AapdaNetra"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # SQLite for testing
    DATABASE_URI: str = "sqlite:///./aapdanetra.db"
    
    # Auth
    SECRET_KEY: str = "replace-this-with-a-very-long-and-secure-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    ADMIN_SECRET_KEY: str = "AAPDA_SIH_2024"
    
    @property
    def get_database_uri(self) -> str:
        # SQLAlchemy 1.4+ removed support for the 'postgres://' scheme
        # Render provides 'postgres://' by default, so we fix it here.
        if self.DATABASE_URI and self.DATABASE_URI.startswith("postgres://"):
            return self.DATABASE_URI.replace("postgres://", "postgresql://", 1)
        return self.DATABASE_URI

    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
