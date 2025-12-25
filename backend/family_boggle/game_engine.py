import asyncio
import random
import uuid
from typing import Dict, List, Optional, Set
import structlog

from family_boggle.board import BoggleBoard
from family_boggle.dictionary import DictionaryValidator
from family_boggle.scoring import calculate_word_score
from family_boggle.models import GameStateModel, PlayerModel, WordSubmission

logger = structlog.get_logger()

from family_boggle.powerups import powerup_manager

class GameEngine:
    """Core logic for managing Boggle game sessions."""
    
    def __init__(self) -> None:
        """Initializes the engine."""
        self.lobbies: Dict[str, GameStateModel] = {}
        self.validator = DictionaryValidator()
        self.board_gen: Optional[BoggleBoard] = None

    def create_lobby(self, host_id: str, host_username: str, host_character: str, lobby_id: Optional[str] = None) -> str:
        """Creates a new game lobby."""
        if not lobby_id:
            lobby_id = str(uuid.uuid4())[:8].upper()
        
        host = PlayerModel(
            id=host_id,
            username=host_username,
            character=host_character,
            is_ready=False
        )
        self.lobbies[lobby_id] = GameStateModel(
            lobby_id=lobby_id,
            status="lobby",
            host_id=host_id,
            players=[host]
        )
        logger.info("lobby_created", lobby_id=lobby_id, host_id=host_id)
        return lobby_id

    def join_lobby(self, lobby_id: str, player_id: str, username: str, character: str) -> bool:
        """Adds a player to an existing lobby."""
        if lobby_id not in self.lobbies:
            return False
            
        lobby = self.lobbies[lobby_id]
        if len(lobby.players) >= 10:
            return False
            
        # Check if player already in lobby
        if any(p.id == player_id for p in lobby.players):
            return True
            
        new_player = PlayerModel(
            id=player_id,
            username=username,
            character=character,
            is_ready=False
        )
        lobby.players.append(new_player)
        logger.info("player_joined", lobby_id=lobby_id, player_id=player_id)
        return True

    def toggle_ready(self, lobby_id: str, player_id: str) -> bool:
        """Toggles a player's ready status."""
        if lobby_id not in self.lobbies:
            return False
            
        lobby = self.lobbies[lobby_id]
        for p in lobby.players:
            if p.id == player_id:
                p.is_ready = not p.is_ready
                return True
        return False

    def start_game(self, lobby_id: str) -> bool:
        """Starts the game if all players are ready."""
        if lobby_id not in self.lobbies:
            return False
            
        lobby = self.lobbies[lobby_id]
        if not all(p.is_ready for p in lobby.players):
            return False
            
        self.board_gen = BoggleBoard(size=lobby.board_size)
        lobby.board = self.board_gen.grid
        lobby.status = "countdown"
        lobby.timer = 3  # 3-2-1 countdown
        
        logger.info("game_countdown_started", lobby_id=lobby_id)
        return True

    def submit_word(self, lobby_id: str, player_id: str, submission: WordSubmission) -> dict:
        """Handles a word submission from a player."""
        if lobby_id not in self.lobbies:
            return {"valid": False, "reason": "Lobby not found"}
            
        lobby = self.lobbies[lobby_id]
        if lobby.status != "playing":
            return {"valid": False, "reason": "Game not in progress"}
            
        player = next((p for p in lobby.players if p.id == player_id), None)
        if not player:
            return {"valid": False, "reason": "Player not found"}
            
        word = submission.word.upper()
        if word in player.found_words:
            return {"valid": False, "reason": "Word already found"}
            
        # Validate on board
        if not self.board_gen or not self.board_gen.is_word_on_board(word, submission.path):
            return {"valid": False, "reason": "Word not on board"}
            
        # Validate in dictionary
        if not self.validator.is_valid_word(word):
            return {"valid": False, "reason": "Not a valid word"}
            
        # Calculate points (initial, will adjust for uniqueness in summary)
        points = calculate_word_score(word)
        player.score += points
        player.found_words.append(word)
        
        # Check for power-up (5+ letters)
        earned_powerup = None
        if len(word) >= 5:
            earned_powerup = random.choice(["freeze", "blowup", "shuffle"])
            player.powerups.append(earned_powerup)
            
        return {
            "valid": True,
            "points": points,
            "powerup": earned_powerup,
            "total_score": player.score
        }

    def finalize_scores(self, lobby_id: str) -> dict:
        """Calculates final scores with uniqueness bonuses."""
        if lobby_id not in self.lobbies:
            return {}
            
        lobby = self.lobbies[lobby_id]
        # Count occurrences of each word across all players
        word_counts: Dict[str, int] = {}
        for p in lobby.players:
            for word in p.found_words:
                word_counts[word] = word_counts.get(word, 0) + 1
                
        # Recalculate scores with unique bonus
        final_results = []
        for p in lobby.players:
            p.score = 0
            for word in p.found_words:
                is_unique = word_counts[word] == 1
                p.score += calculate_word_score(word, is_unique=is_unique)
            
            final_results.append({
                "username": p.username,
                "character": p.character,
                "score": p.score,
                "words": p.found_words
            })
            
        # Sort by score
        final_results.sort(key=lambda x: x["score"], reverse=True)
        return {"results": final_results, "winner": final_results[0] if final_results else None}

    def reset_lobby(self, lobby_id: str) -> bool:
        """Resets a lobby for a new game.
        
        Args:
            lobby_id: The lobby to reset.
            
        Returns:
            True if successful, False otherwise.
        """
        if lobby_id not in self.lobbies:
            return False
            
        lobby = self.lobbies[lobby_id]
        lobby.status = "lobby"
        lobby.board = []
        lobby.timer = 0
        
        # Reset all players
        for p in lobby.players:
            p.score = 0
            p.found_words = []
            p.powerups = []
            p.is_ready = False
            
        logger.info("lobby_reset", lobby_id=lobby_id)
        return True

game_engine = GameEngine()
