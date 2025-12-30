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
    
    class Config:
        env_prefix = "BOGGLE_"

settings = Settings()

