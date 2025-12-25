"""
High scores persistence system based on IP address.

Each unique IP address is treated as a distinct player, tracking their
all-time high scores and game statistics.
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
from dataclasses import dataclass, asdict
import structlog

logger = structlog.get_logger()

# Data storage path
DATA_DIR = Path("/data")
HIGH_SCORES_FILE = DATA_DIR / "high_scores.json"


@dataclass
class PlayerHighScore:
    """Represents a player's high score record."""
    ip_address: str
    username: str  # Last used username
    best_score: int
    best_words_count: int
    total_games_played: int
    total_wins: int
    last_played: str  # ISO format datetime
    best_game_date: str  # When best score was achieved
    challenges_completed: int  # Total challenges completed across all games


def ensure_data_dir():
    """Ensures the data directory exists."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def load_high_scores() -> Dict[str, PlayerHighScore]:
    """Loads high scores from file."""
    ensure_data_dir()
    if not HIGH_SCORES_FILE.exists():
        return {}

    try:
        with open(HIGH_SCORES_FILE, 'r') as f:
            data = json.load(f)
            return {
                ip: PlayerHighScore(**record)
                for ip, record in data.items()
            }
    except Exception as e:
        logger.error("failed_to_load_high_scores", error=str(e))
        return {}


def save_high_scores(scores: Dict[str, PlayerHighScore]):
    """Saves high scores to file."""
    ensure_data_dir()
    try:
        data = {ip: asdict(record) for ip, record in scores.items()}
        with open(HIGH_SCORES_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        logger.info("high_scores_saved", count=len(scores))
    except Exception as e:
        logger.error("failed_to_save_high_scores", error=str(e))


def update_player_score(
    ip_address: str,
    username: str,
    score: int,
    words_count: int,
    is_winner: bool,
    challenges_completed: int = 0
) -> PlayerHighScore:
    """Updates a player's high score record after a game.

    Args:
        ip_address: The player's IP address
        username: The display name used
        score: Score achieved in this game
        words_count: Number of words found
        is_winner: Whether this player won
        challenges_completed: Number of challenges completed in this game

    Returns:
        The updated player high score record
    """
    scores = load_high_scores()
    now = datetime.now().isoformat()

    if ip_address in scores:
        record = scores[ip_address]
        record.username = username
        record.total_games_played += 1
        record.last_played = now
        record.challenges_completed += challenges_completed

        if is_winner:
            record.total_wins += 1

        if score > record.best_score:
            record.best_score = score
            record.best_words_count = words_count
            record.best_game_date = now
    else:
        # New player
        record = PlayerHighScore(
            ip_address=ip_address,
            username=username,
            best_score=score,
            best_words_count=words_count,
            total_games_played=1,
            total_wins=1 if is_winner else 0,
            last_played=now,
            best_game_date=now,
            challenges_completed=challenges_completed
        )
        scores[ip_address] = record

    save_high_scores(scores)
    logger.info(
        "player_score_updated",
        ip=ip_address,
        username=username,
        score=score,
        best_score=record.best_score
    )
    return record


def get_player_record(ip_address: str) -> Optional[PlayerHighScore]:
    """Gets a player's high score record by IP."""
    scores = load_high_scores()
    return scores.get(ip_address)


def get_leaderboard(limit: int = 10) -> List[Dict]:
    """Gets the top players by best score.

    Returns:
        List of player records sorted by best_score descending
    """
    scores = load_high_scores()
    sorted_scores = sorted(
        scores.values(),
        key=lambda x: x.best_score,
        reverse=True
    )[:limit]

    return [
        {
            "username": s.username,
            "best_score": s.best_score,
            "best_words_count": s.best_words_count,
            "total_games_played": s.total_games_played,
            "total_wins": s.total_wins,
            "challenges_completed": s.challenges_completed,
            # Don't expose IP address in leaderboard
        }
        for s in sorted_scores
    ]


def get_player_stats(ip_address: str) -> Optional[Dict]:
    """Gets a player's stats for display.

    Returns player stats without exposing IP address.
    """
    record = get_player_record(ip_address)
    if not record:
        return None

    return {
        "username": record.username,
        "best_score": record.best_score,
        "best_words_count": record.best_words_count,
        "total_games_played": record.total_games_played,
        "total_wins": record.total_wins,
        "challenges_completed": record.challenges_completed,
        "win_rate": round(record.total_wins / record.total_games_played * 100, 1)
            if record.total_games_played > 0 else 0
    }


class PlayerIPTracker:
    """Tracks IP addresses for players in active games."""

    def __init__(self):
        # player_id -> ip_address
        self.player_ips: Dict[str, str] = {}

    def register_player(self, player_id: str, ip_address: str):
        """Registers a player's IP address."""
        self.player_ips[player_id] = ip_address
        logger.info("player_ip_registered", player_id=player_id, ip=ip_address)

    def get_player_ip(self, player_id: str) -> Optional[str]:
        """Gets a player's IP address."""
        return self.player_ips.get(player_id)

    def remove_player(self, player_id: str):
        """Removes a player from tracking."""
        if player_id in self.player_ips:
            del self.player_ips[player_id]


# Global IP tracker instance
ip_tracker = PlayerIPTracker()
