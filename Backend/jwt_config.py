import os
from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict
from dotenv import load_dotenv

load_dotenv(override=True)

class Settings(BaseSettings):
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
    ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30 * 24 * 60  # 30 days

    # Ignore unrelated keys present in .env so settings initialization stays stable.
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

settings = Settings()