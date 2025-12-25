from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel


class ChallengeProgress(BaseModel):
    """Progress on a single challenge."""
    id: str
    name: str
    description: str
    target: int
    progress: int
    ratio: float
    completed: bool
    category: str


class PlayerModel(BaseModel):
    """Data model for a player."""
    id: str
    username: str
    character: str
    is_ready: bool = False
    score: int = 0
    powerups: List[str] = []
    found_words: List[str] = []
    ip_address: Optional[str] = None  # For high score tracking

class ChallengeDefinition(BaseModel):
    """A challenge available in the game."""
    id: str
    name: str
    description: str
    target: int
    category: str


class GameStateModel(BaseModel):
    """Data model for the game state."""
    lobby_id: str
    status: str  # lobby, countdown, playing, summary
    board: List[List[str]] = []
    board_size: int = 6
    timer: int = 0
    players: List[PlayerModel] = []
    host_id: str
    challenges: List[ChallengeDefinition] = []  # Active challenges for this game

class WordSubmission(BaseModel):
    """Data model for a word submission."""
    word: str
    path: List[Tuple[int, int]]

class WSMessage(BaseModel):
    """Generic WebSocket message model."""
    type: str
    data: dict
