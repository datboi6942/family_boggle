import random
import uuid
from typing import Any

import structlog

from family_boggle.board import BoggleBoard
from family_boggle.challenges import challenge_manager
from family_boggle.dictionary import DictionaryValidator
from family_boggle.models import GameStateModel, PlayerModel, WordSubmission
from family_boggle.powerups import powerup_manager
from family_boggle.scoring import calculate_word_score

logger = structlog.get_logger()

# Rare letters that grant powerups when used in a word
RARE_LETTERS = {"J", "X", "Q", "Z"}


class GameEngine:
    """Core logic for managing Boggle game sessions."""

    def __init__(self) -> None:
        """Initializes the engine."""
        self.lobbies: dict[str, GameStateModel] = {}
        self.validator = DictionaryValidator()
        self.board_gen: BoggleBoard | None = None

    def create_lobby(
        self,
        host_id: str,
        host_username: str,
        host_character: str,
        lobby_id: str | None = None,
        password: str | None = None,
    ) -> str:
        """Creates a new game lobby."""
        if not lobby_id:
            lobby_id = str(uuid.uuid4())[:8].upper()

        host = PlayerModel(
            id=host_id, username=host_username, character=host_character, is_ready=False
        )
        self.lobbies[lobby_id] = GameStateModel(
            lobby_id=lobby_id, status="lobby", host_id=host_id, players=[host], password=password
        )
        logger.info("lobby_created", lobby_id=lobby_id, host_id=host_id)
        return lobby_id

    def set_game_mode(self, lobby_id: str, game_mode: str, mode_settings: dict | None = None) -> bool:
        """Sets the game mode for a lobby (host only)."""
        if lobby_id not in self.lobbies:
            return False
        
        lobby = self.lobbies[lobby_id]
        # Only host can change game mode
        # This check is done in the WebSocket handler, not here
        
        if game_mode not in ["classic", "team", "timed_attack", "word_race"]:
            return False
        
        lobby.game_mode = game_mode
        lobby.mode_settings = mode_settings or {}
        
        # If switching from team mode, clear team assignments
        if game_mode != "team":
            for player in lobby.players:
                player.team_id = None
        
        logger.info("game_mode_set", lobby_id=lobby_id, game_mode=game_mode)
        return True

    def assign_teams(self, lobby_id: str, team_assignments: dict[str, str]) -> bool:
        """Assigns players to teams for team play mode.
        
        Args:
            lobby_id: The lobby ID.
            team_assignments: Mapping of player_id to team_id (e.g., "team_a", "team_b").
        
        Returns:
            True if successful, False otherwise.
        """
        if lobby_id not in self.lobbies:
            return False
        
        lobby = self.lobbies[lobby_id]
        if lobby.game_mode != "team":
            return False
        
        # Validate all player IDs exist in lobby
        for player_id, team_id in team_assignments.items():
            if not any(p.id == player_id for p in lobby.players):
                return False
        
        # Apply assignments
        for player in lobby.players:
            if player.id in team_assignments:
                player.team_id = team_assignments[player.id]
            else:
                # If player not in assignments, keep existing team or set to None
                pass
        
        logger.info("teams_assigned", lobby_id=lobby_id, assignments=team_assignments)
        return True

    def join_lobby(
        self, lobby_id: str, player_id: str, username: str, character: str, password: str | None = None
    ) -> bool:
        """Adds a player to an existing lobby."""
        if lobby_id not in self.lobbies:
            return False

        lobby = self.lobbies[lobby_id]
        # Check password if lobby is private
        if lobby.password is not None:
            if password != lobby.password:
                return False
        if len(lobby.players) >= 10:
            return False

        # Check if player already in lobby
        if any(p.id == player_id for p in lobby.players):
            return True

        new_player = PlayerModel(
            id=player_id, username=username, character=character, is_ready=False
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

        # Pass validator to BoggleBoard so it can ensure minimum word counts
        # This is especially important for 4x4 boards which can sometimes
        # generate with very few possible words
        self.board_gen = BoggleBoard(size=lobby.board_size, validator=self.validator)
        lobby.board = self.board_gen.grid

        # Initialize game mode specific settings
        if lobby.game_mode == "team":
            # Ensure all players have a team assignment
            # Auto-assign if not already assigned
            unassigned = [p for p in lobby.players if p.team_id is None]
            if unassigned:
                # Simple round-robin assignment between team_a and team_b
                teams = ["team_a", "team_b"]
                for i, player in enumerate(unassigned):
                    player.team_id = teams[i % 2]
        elif lobby.game_mode == "word_race":
            # Generate target words from the board
            all_words = self.board_gen.find_all_words(self.validator.get_word_set())
            # Filter to words of length 4-8
            eligible = [w for w in all_words if 4 <= len(w) <= 8]
            # Pick 5 random target words (or fewer if not enough)
            num_targets = min(5, len(eligible))
            lobby.target_words = random.sample(eligible, num_targets) if eligible else []
        elif lobby.game_mode == "timed_attack":
            # Set up round timer (60 seconds) and power-up drop interval (15 seconds)
            lobby.mode_settings["round_duration"] = 60
            lobby.mode_settings["powerup_drop_interval"] = 15
            lobby.mode_settings["current_round"] = 1
            lobby.mode_settings["powerup_drops"] = []

        lobby.status = "countdown"
        lobby.timer = 3  # 3-2-1 countdown

        # Set up challenges for this game
        challenges = challenge_manager.setup_game_challenges(lobby_id)
        lobby.challenges = challenges

        logger.info("game_countdown_started", lobby_id=lobby_id)
        return True

    def _is_word_on_board(
        self, word: str, path: list[tuple[int, int]], board: list[list[str]]
    ) -> bool:
        """Validates if a word is present on a given board following a path.

        Args:
            word: The word to validate (uppercase).
            path: List of (row, col) coordinates.
            board: The board grid to validate against.

        Returns:
            True if the path matches the word and is valid.
        """
        if len(word) != len(path):
            return False

        size = len(board)
        used_cells: set[tuple[int, int]] = set()

        for i, (r, c) in enumerate(path):
            if not (0 <= r < size and 0 <= c < size):
                return False
            if (r, c) in used_cells:
                return False
            if board[r][c] != word[i]:
                return False

            # Check adjacency if not the first letter
            if i > 0:
                prev_r, prev_c = path[i - 1]
                if abs(r - prev_r) > 1 or abs(c - prev_c) > 1:
                    return False

            used_cells.add((r, c))

        return True

    async def submit_word(
        self, lobby_id: str, player_id: str, submission: WordSubmission
    ) -> dict[str, Any]:
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

        # Get the player's current board (may be different from lobby board if protected by lock)
        player_board = await powerup_manager.get_player_board(
            lobby_id, player_id, lobby.board
        )

        # Validate on the player's board
        if not self._is_word_on_board(word, submission.path, player_board):
            return {"valid": False, "reason": "Word not on board"}

        # Validate in dictionary
        if not self.validator.is_valid_word(word):
            return {"valid": False, "reason": "Not a valid word"}

        # Calculate points (initial, will adjust for uniqueness in summary)
        points = calculate_word_score(word)
        player.score += points
        player.found_words.append(word)

        # Check for power-up: 5+ letters OR 3+ letter word containing rare letter (J, X, Q, Z)
        earned_powerup = None
        word_upper = word.upper()
        has_rare_letter = any(letter in RARE_LETTERS for letter in word_upper)
        # Award powerup for: long words (5+) OR any valid word (3+) with a rare letter
        if len(word) >= 5 or (len(word) >= 3 and has_rare_letter):
            earned_powerup = random.choice(["freeze", "blowup", "shuffle", "lock"])
            player.powerups.append(earned_powerup)
            logger.info(
                "powerup_earned",
                player_id=player_id,
                word=word,
                powerup=earned_powerup,
                has_rare=has_rare_letter,
            )

        return {
            "valid": True,
            "points": points,
            "powerup": earned_powerup,
            "total_score": player.score,
        }

    def finalize_scores(self, lobby_id: str) -> dict[str, Any]:
        """Calculates final scores with uniqueness bonuses and word award details."""
        if lobby_id not in self.lobbies:
            return {}

        lobby = self.lobbies[lobby_id]

        # Get all possible words from the board
        all_possible_words: list[str] = []
        longest_possible_word = ""
        if self.board_gen:
            all_possible_words = self.board_gen.find_all_words(self.validator._word_set)
            if all_possible_words:
                longest_possible_word = all_possible_words[
                    0
                ]  # Already sorted longest first

        # Count occurrences of each word across all players and track who found them
        word_data: dict[str, dict[str, Any]] = {}
        for p in lobby.players:
            for word in p.found_words:
                if word not in word_data:
                    word_data[word] = {
                        "word": word,
                        "finders": [],
                        "is_unique": False,
                        "points": 0,
                    }
                word_data[word]["finders"].append(
                    {
                        "player_id": p.id,
                        "username": p.username,
                        "character": p.character,
                    }
                )

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
        longest_word_found: dict[str, Any] | None = None
        for p in lobby.players:
            for word in p.found_words:
                if (
                    longest_word_found is None
                    or len(word) > longest_word_found["length"]
                ):
                    longest_word_found = {
                        "word": word,
                        "length": len(word),
                        "player_id": p.id,
                        "username": p.username,
                        "character": p.character,
                    }

        # Recalculate final results for leaderboard with challenge data
        final_results: list[dict[str, Any]] = []
        for p in lobby.players:
            # Calculate word score
            word_score = 0
            for word in p.found_words:
                # We can reuse the points from word_data
                word_score += word_data[word]["points"]

            # Get challenge progress for this player
            all_challenges = challenge_manager.get_player_progress(
                lobby_id, p.found_words, word_score
            )
            best_challenge = challenge_manager.get_best_challenge_for_player(
                lobby_id, p.found_words, word_score
            )
            challenges_completed = sum(
                1 for c in all_challenges if c.get("completed", False)
            )

            # Calculate challenge score
            challenge_score = challenge_manager.get_total_challenge_points(
                lobby_id, p.found_words, word_score
            )

            # Calculate total score
            total_score = word_score + challenge_score
            p.score = total_score  # Update player's score

            final_results.append(
                {
                    "player_id": p.id,
                    "username": p.username,
                    "character": p.character,
                    "word_score": word_score,
                    "challenge_score": challenge_score,
                    "total_score": total_score,
                    "score": total_score,  # Keep for backwards compatibility
                    "words": p.found_words,
                    "all_challenges": all_challenges,
                    "best_challenge": best_challenge,
                    "challenges_completed": challenges_completed,
                }
            )

        # Clean up challenge data for this game
        challenge_manager.cleanup_game(lobby_id)

        # Mode-specific scoring adjustments
        team_results = []
        if lobby.game_mode == "team":
            # Aggregate scores by team
            team_scores: dict[str, int] = {}
            team_members: dict[str, list[dict]] = {}
            for p in lobby.players:
                team_id = p.team_id
                if team_id is None:
                    continue
                if team_id not in team_scores:
                    team_scores[team_id] = 0
                    team_members[team_id] = []
                team_scores[team_id] += p.score
                team_members[team_id].append({
                    "player_id": p.id,
                    "username": p.username,
                    "character": p.character,
                    "score": p.score
                })
            
            # Convert to list for team_results
            for team_id, total_score in team_scores.items():
                team_results.append({
                    "team_id": team_id,
                    "total_score": total_score,
                    "members": team_members[team_id]
                })
            # Sort teams by score
            team_results.sort(key=lambda x: x["total_score"], reverse=True)
        
        elif lobby.game_mode == "word_race":
            # Add bonus points for target words found
            target_bonus = 50  # points per target word
            for p in lobby.players:
                target_words_found = [w for w in p.found_words if w in lobby.target_words]
                if target_words_found:
                    bonus = len(target_words_found) * target_bonus
                    p.score += bonus
                    # Update final_results entry
                    for result in final_results:
                        if result["player_id"] == p.id:
                            result["total_score"] += bonus
                            result["word_score"] += bonus
                            break
        
        elif lobby.game_mode == "timed_attack":
            # Round-based scoring: each round completed adds multiplier
            # For simplicity, add 10% bonus per round completed (rounds stored in mode_settings)
            current_round = lobby.mode_settings.get("current_round", 1)
            round_bonus_multiplier = 1.0 + (current_round - 1) * 0.1
            for p in lobby.players:
                p.score = int(p.score * round_bonus_multiplier)
                for result in final_results:
                    if result["player_id"] == p.id:
                        result["total_score"] = int(result["total_score"] * round_bonus_multiplier)
                        result["word_score"] = int(result["word_score"] * round_bonus_multiplier)
                        break

        # Sort by total score
        final_results.sort(key=lambda x: x["total_score"], reverse=True)
        return {
            "results": final_results,
            "winner": final_results[0] if final_results else None,
            "word_awards": word_awards,
            "longest_word_found": longest_word_found,
            "longest_possible_word": longest_possible_word,
            "all_possible_words": all_possible_words,
            "total_possible_words": len(all_possible_words),
            "game_mode": lobby.game_mode,
            "team_results": team_results,
            "winner_team": team_results[0] if team_results else None,
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
            logger.info(
                "new_host_assigned", lobby_id=lobby_id, new_host_id=lobby.host_id
            )

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
            p.wants_play_again = False

        # Clear all powerup state (locks, protected boards, freezes, etc.)
        powerup_manager.clear_lobby(lobby_id)

        logger.info("lobby_reset", lobby_id=lobby_id)
        return True


game_engine = GameEngine()
