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
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
