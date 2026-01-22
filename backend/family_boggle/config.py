from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuration settings for the Family Boggle backend."""

    APP_NAME: str = "Family Boggle"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Game settings
    DEFAULT_BOARD_SIZE: int = 6
    GAME_DURATION_SECONDS: int = 180  # 3 minutes

    # Authentication settings
    SECRET_KEY: str = ""  # Must be set via BOGGLE_SECRET_KEY environment variable
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DATABASE_URL: str = "sqlite:///./family_boggle.db"
    
    # CORS settings
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:2727"  # Frontend dev/prod ports

    class Config:
        env_prefix = "BOGGLE_"


settings = Settings()
