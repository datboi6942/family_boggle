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
from family_boggle.challenges import challenge_manager

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
        
        # Set up challenges for this game
        challenges = challenge_manager.setup_game_challenges(lobby_id)
        lobby.challenges = challenges
        
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
        """Calculates final scores with uniqueness bonuses and word award details."""
        if lobby_id not in self.lobbies:
            return {}
            
        lobby = self.lobbies[lobby_id]
        
        # Get all possible words from the board
        all_possible_words: List[str] = []
        longest_possible_word = ""
        if self.board_gen:
            all_possible_words = self.board_gen.find_all_words(self.validator._word_set)
            if all_possible_words:
                longest_possible_word = all_possible_words[0]  # Already sorted longest first
        
        # Count occurrences of each word across all players and track who found them
        word_data: Dict[str, Dict] = {}
        for p in lobby.players:
            for word in p.found_words:
                if word not in word_data:
                    word_data[word] = {
                        "word": word,
                        "finders": [],
                        "is_unique": False,
                        "points": 0
                    }
                word_data[word]["finders"].append({
                    "player_id": p.id,
                    "username": p.username,
                    "character": p.character
                })

        # Process each word to determine uniqueness and points
        word_awards = []
        for word, data in word_data.items():
            is_unique = len(data["finders"]) == 1
            data["is_unique"] = is_unique
            data["points"] = calculate_word_score(word, is_unique=is_unique)
            word_awards.append(data)

        # Sort words by length (shortest first) to build excitement
        word_awards.sort(key=lambda x: len(x["word"]))
        
        # Find the longest word any player found
        longest_word_found = None
        for p in lobby.players:
            for word in p.found_words:
                if longest_word_found is None or len(word) > longest_word_found["length"]:
                    longest_word_found = {
                        "word": word,
                        "length": len(word),
                        "player_id": p.id,
                        "username": p.username,
                        "character": p.character
                    }
                
        # Recalculate final results for leaderboard with challenge data
        final_results = []
        for p in lobby.players:
            p.score = 0
            for word in p.found_words:
                # We can reuse the points from word_data
                p.score += word_data[word]["points"]
            
            # Get challenge progress for this player
            all_challenges = challenge_manager.get_player_progress(
                lobby_id, p.found_words, p.score
            )
            best_challenge = challenge_manager.get_best_challenge_for_player(
                lobby_id, p.found_words, p.score
            )
            challenges_completed = sum(1 for c in all_challenges if c.get("completed", False))
            
            final_results.append({
                "player_id": p.id,
                "username": p.username,
                "character": p.character,
                "score": p.score,
                "words": p.found_words,
                "all_challenges": all_challenges,
                "best_challenge": best_challenge,
                "challenges_completed": challenges_completed
            })
        
        # Clean up challenge data for this game
        challenge_manager.cleanup_game(lobby_id)
            
        # Sort by score
        final_results.sort(key=lambda x: x["score"], reverse=True)
        return {
            "results": final_results, 
            "winner": final_results[0] if final_results else None,
            "word_awards": word_awards,
            "longest_word_found": longest_word_found,
            "longest_possible_word": longest_possible_word,
            "all_possible_words": all_possible_words,
            "total_possible_words": len(all_possible_words)
        }

    def leave_lobby(self, lobby_id: str, player_id: str) -> bool:
        """Removes a player from a lobby."""
        if lobby_id not in self.lobbies:
            return False
            
        lobby = self.lobbies[lobby_id]
        lobby.players = [p for p in lobby.players if p.id != player_id]
        
        # If lobby is empty, delete it
        if not lobby.players:
            del self.lobbies[lobby_id]
            logger.info("lobby_deleted", lobby_id=lobby_id)
            return True
            
        # If host left, assign new host
        if lobby.host_id == player_id:
            lobby.host_id = lobby.players[0].id
            logger.info("new_host_assigned", lobby_id=lobby_id, new_host_id=lobby.host_id)
            
        logger.info("player_left", lobby_id=lobby_id, player_id=player_id)
        return True

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

