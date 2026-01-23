from pydantic import BaseModel
from typing import Optional


class PlayerModel(BaseModel):
    """Data model for a player."""

    id: str
    username: str
    character: str
    is_ready: bool = False
    score: int = 0
    powerups: list[str] = []
    found_words: list[str] = []
    bonus_time: int = 0  # Extra time from freeze powerup
    is_time_up: bool = False  # Whether this player's time has run out
    wants_play_again: bool = False  # Whether player clicked "Play Again" on summary
    team_id: Optional[str] = None  # Team assignment for team play mode
    user_id: Optional[int] = None  # Authenticated user ID if logged in


class GameStateModel(BaseModel):
    """Data model for the game state."""

    lobby_id: str
    status: str  # lobby, countdown, playing, summary
    board: list[list[str]] = []
    board_size: int = 6
    timer: int = 0
    players: list[PlayerModel] = []
    host_id: str
    challenges: list[dict] = []
    game_mode: str = "classic"  # classic, team, timed_attack, word_race
    mode_settings: dict = {}  # Mode-specific configuration
    target_words: list[str] = []  # Target words for word race mode
    password: Optional[str] = None  # Optional password for private lobbies


class WordSubmission(BaseModel):
    """Data model for a word submission."""

    word: str
    path: list[tuple[int, int]]


class WSMessage(BaseModel):
    """Generic WebSocket message model."""

    type: str
    data: dict


class FriendRequestModel(BaseModel):
    """Data model for a friend request."""
    
    id: int
    sender_id: int
    receiver_id: int
    status: str  # pending, accepted, rejected
    created_at: str
    updated_at: str


class FriendModel(BaseModel):
    """Data model for a friend relationship."""
    
    user1_id: int
    user2_id: int
    created_at: str


class FriendRequestCreate(BaseModel):
    """Data model for creating a friend request."""
    
    receiver_username: str


class FriendRequestUpdate(BaseModel):
    """Data model for updating a friend request."""
    
    request_id: int
    action: str  # accept, reject
