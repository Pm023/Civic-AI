import os
from pathlib import Path
from pydantic_settings import BaseSettings

# Build paths inside the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "CivicAI"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "sqlite:///./civic_ai.db"
    
    # Security
    SECRET_KEY: str = "supersecretcivicaikeyforjwttokengeneration123!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 1 week
    
    # Uploads
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")
    MAX_CONTENT_LENGTH: int = 5 * 1024 * 1024  # 5MB
    ALLOWED_EXTENSIONS: set = {"png", "jpg", "jpeg", "webp"}
    
    # AI Settings
    MOCK_AI: bool = False
    IMAGE_MODEL_PATH: str = str(BASE_DIR / "backend" / "app" / "civicai_best.zip")
    TEXT_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # Duplicate Detection
    DUPLICATE_RADIUS_METERS: float = 100.0
    DUPLICATE_SIMILARITY_THRESHOLD: float = 0.85
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
