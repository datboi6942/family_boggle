"""
Netflix-style Boggle challenges system.

Challenges are tracked per-player during each game and the one with
the most progress is displayed on the player's card in the summary.
"""

from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
import random


@dataclass
class Challenge:
    """A single challenge definition."""
    id: str
    name: str
    description: str
    target: int
    category: str  # words, letters, score, special
    difficulty: str  # very_easy, easy, medium, hard, very_hard
    points: int  # Points awarded on completion

    def check_progress(self, found_words: List[str], score: int) -> int:
        """Returns progress count towards this challenge. Override in subclasses."""
        return 0

    def get_progress_ratio(self, found_words: List[str], score: int) -> float:
        """Returns progress as a ratio (0.0 to 1.0+)."""
        return min(self.check_progress(found_words, score) / self.target, 1.0) if self.target > 0 else 0.0

    def get_points_earned(self, found_words: List[str], score: int) -> int:
        """Returns points earned (full points if completed, 0 otherwise)."""
        return self.points if self.get_progress_ratio(found_words, score) >= 1.0 else 0


class WordCountChallenge(Challenge):
    """Find X total words."""
    def check_progress(self, found_words: List[str], score: int) -> int:
        return len(found_words)


class WordLengthChallenge(Challenge):
    """Find X words of a certain minimum length."""
    def __init__(self, id: str, name: str, description: str, target: int, min_length: int, difficulty: str, points: int):
        super().__init__(id, name, description, target, "words", difficulty, points)
        self.min_length = min_length

    def check_progress(self, found_words: List[str], score: int) -> int:
        return sum(1 for w in found_words if len(w) >= self.min_length)


class WordStartsWithChallenge(Challenge):
    """Find X words starting with a specific letter."""
    def __init__(self, id: str, name: str, description: str, target: int, letter: str, difficulty: str, points: int):
        super().__init__(id, name, description, target, "letters", difficulty, points)
        self.letter = letter.upper()

    def check_progress(self, found_words: List[str], score: int) -> int:
        return sum(1 for w in found_words if w.upper().startswith(self.letter))


class WordEndsWithChallenge(Challenge):
    """Find X words ending with a specific suffix."""
    def __init__(self, id: str, name: str, description: str, target: int, suffix: str, difficulty: str, points: int):
        super().__init__(id, name, description, target, "letters", difficulty, points)
        self.suffix = suffix.upper()

    def check_progress(self, found_words: List[str], score: int) -> int:
        return sum(1 for w in found_words if w.upper().endswith(self.suffix))


class WordContainsChallenge(Challenge):
    """Find X words containing a specific letter."""
    def __init__(self, id: str, name: str, description: str, target: int, letter: str, difficulty: str, points: int):
        super().__init__(id, name, description, target, "letters", difficulty, points)
        self.letter = letter.upper()

    def check_progress(self, found_words: List[str], score: int) -> int:
        return sum(1 for w in found_words if self.letter in w.upper())


class ScoreChallenge(Challenge):
    """Reach X total points."""
    def __init__(self, id: str, name: str, description: str, target: int, difficulty: str, points: int):
        super().__init__(id, name, description, target, "score", difficulty, points)

    def check_progress(self, found_words: List[str], score: int) -> int:
        return score


class DoubleLetterChallenge(Challenge):
    """Find X words with double letters (e.g., LETTER, BOOK)."""
    def __init__(self, id: str, name: str, description: str, target: int, difficulty: str, points: int):
        super().__init__(id, name, description, target, "special", difficulty, points)

    def check_progress(self, found_words: List[str], score: int) -> int:
        count = 0
        for word in found_words:
            w = word.upper()
            for i in range(len(w) - 1):
                if w[i] == w[i + 1]:
                    count += 1
                    break
        return count


class PalindromeChallenge(Challenge):
    """Find X palindrome words (e.g., LEVEL, RADAR)."""
    def __init__(self, id: str, name: str, description: str, target: int, difficulty: str, points: int):
        super().__init__(id, name, description, target, "special", difficulty, points)

    def check_progress(self, found_words: List[str], score: int) -> int:
        return sum(1 for w in found_words if w.upper() == w.upper()[::-1] and len(w) >= 3)


class VowelHeavyChallenge(Challenge):
    """Find X words with 3+ vowels."""
    def __init__(self, id: str, name: str, description: str, target: int, min_vowels: int, difficulty: str, points: int):
        super().__init__(id, name, description, target, "special", difficulty, points)
        self.min_vowels = min_vowels

    def check_progress(self, found_words: List[str], score: int) -> int:
        vowels = set('AEIOU')
        return sum(1 for w in found_words if sum(1 for c in w.upper() if c in vowels) >= self.min_vowels)


class ConsonantHeavyChallenge(Challenge):
    """Find X words with 4+ consonants in a row."""
    def __init__(self, id: str, name: str, description: str, target: int, difficulty: str, points: int):
        super().__init__(id, name, description, target, "special", difficulty, points)

    def check_progress(self, found_words: List[str], score: int) -> int:
        vowels = set('AEIOU')
        count = 0
        for word in found_words:
            w = word.upper()
            consonant_streak = 0
            max_streak = 0
            for c in w:
                if c not in vowels:
                    consonant_streak += 1
                    max_streak = max(max_streak, consonant_streak)
                else:
                    consonant_streak = 0
            if max_streak >= 4:
                count += 1
        return count


class RareLetterChallenge(Challenge):
    """Find X words containing rare letters (Q, X, Z, J)."""
    def __init__(self, id: str, name: str, description: str, target: int, letters: str, difficulty: str, points: int):
        super().__init__(id, name, description, target, "special", difficulty, points)
        self.rare_letters = set(letters.upper())

    def check_progress(self, found_words: List[str], score: int) -> int:
        return sum(1 for w in found_words if any(c in self.rare_letters for c in w.upper()))


# Define all available challenges - streamlined to be unique and actually challenging
# No trivial "very easy" challenges, no redundant incremental versions
ALL_CHALLENGES: List[Challenge] = [
    # ==================== EASY (20-30 points) ====================
    # These require some effort but are achievable with decent gameplay
    WordCountChallenge("words_12", "Word Seeker", "Find 12 words", 12, "words", "easy", 20),
    WordLengthChallenge("long_5_3", "Extended Words", "Find 3 words with 5+ letters", 3, 5, "easy", 25),
    ScoreChallenge("score_75", "Point Pursuer", "Score 75 points", 75, "easy", 20),
    WordEndsWithChallenge("ends_s_5", "Plural Hunter", "Find 5 words ending in S", 5, "S", "easy", 25),
    DoubleLetterChallenge("double_3", "Double Trouble", "Find 3 words with double letters", 3, "easy", 30),
    WordEndsWithChallenge("ends_ed_3", "Past Tense", "Find 3 words ending in ED", 3, "ED", "easy", 25),

    # ==================== MEDIUM (35-55 points) ====================
    # Require solid gameplay and strategy
    WordCountChallenge("words_18", "Vocabulary Vault", "Find 18 words", 18, "words", "medium", 40),
    WordLengthChallenge("long_6_3", "Six Letter Pro", "Find 3 words with 6+ letters", 3, 6, "medium", 45),
    ScoreChallenge("score_125", "Point Prodigy", "Score 125 points", 125, "medium", 40),
    WordEndsWithChallenge("ends_ing_3", "ING Master", "Find 3 words ending in ING", 3, "ING", "medium", 50),
    VowelHeavyChallenge("vowels_4", "Vowel Hunter", "Find 4 words with 3+ vowels", 4, 3, "medium", 45),
    DoubleLetterChallenge("double_5", "Twin Terms", "Find 5 words with double letters", 5, "medium", 50),
    WordEndsWithChallenge("ends_er_4", "ER Expert", "Find 4 words ending in ER", 4, "ER", "medium", 40),
    WordLengthChallenge("long_7_1", "Lucky Seven", "Find 1 word with 7+ letters", 1, 7, "medium", 35),

    # ==================== HARD (60-80 points) ====================
    # Challenging - require excellent vocabulary and board scanning
    WordCountChallenge("words_25", "Word Wizard", "Find 25 words", 25, "words", "hard", 70),
    WordLengthChallenge("long_6_5", "Lengthy Legend", "Find 5 words with 6+ letters", 5, 6, "hard", 75),
    WordLengthChallenge("long_7_2", "Marathon Words", "Find 2 words with 7+ letters", 2, 7, "hard", 70),
    ScoreChallenge("score_175", "Point Powerhouse", "Score 175 points", 175, "hard", 65),
    WordEndsWithChallenge("ends_ly_2", "LY Master", "Find 2 words ending in LY", 2, "LY", "hard", 70),
    WordEndsWithChallenge("ends_tion_1", "TION Station", "Find 1 word ending in TION", 1, "TION", "hard", 75),
    VowelHeavyChallenge("vowels_4_4", "Super Vowel", "Find 4 words with 4+ vowels", 4, 4, "hard", 80),
    ConsonantHeavyChallenge("consonants_2", "Consonant Crusher", "Find 2 words with 4+ consonants in a row", 2, "hard", 75),
    RareLetterChallenge("rare_1", "Rare Find", "Find 1 word with Q, X, Z, or J", 1, "QXZJ", "hard", 65),
    PalindromeChallenge("palindrome_1", "Mirror Mirror", "Find 1 palindrome word", 1, "hard", 80),
    DoubleLetterChallenge("double_7", "Double Vision", "Find 7 words with double letters", 7, "hard", 70),

    # ==================== VERY HARD (90-100 points) ====================
    # Elite challenges - require exceptional performance
    WordCountChallenge("words_35", "Lexicon Lord", "Find 35 words", 35, "words", "very_hard", 95),
    WordLengthChallenge("long_7_4", "Seven Samurai", "Find 4 words with 7+ letters", 4, 7, "very_hard", 100),
    WordLengthChallenge("long_8_1", "Eight Wonder", "Find 1 word with 8+ letters", 1, 8, "very_hard", 90),
    ScoreChallenge("score_250", "Quarter King", "Score 250 points", 250, "very_hard", 95),
    WordStartsWithChallenge("starts_q_1", "Q-Quest", "Find 1 word starting with Q", 1, "Q", "very_hard", 95),
    WordStartsWithChallenge("starts_x_1", "X-Factor", "Find 1 word starting with X", 1, "X", "very_hard", 100),
    WordStartsWithChallenge("starts_z_1", "Z-Zone", "Find 1 word starting with Z", 1, "Z", "very_hard", 95),
    VowelHeavyChallenge("vowels_5_4", "Quad Vowel Master", "Find 5 words with 4+ vowels", 5, 4, "very_hard", 100),
    ConsonantHeavyChallenge("consonants_3", "Consonant King", "Find 3 words with 4+ consonants in a row", 3, "very_hard", 95),
    RareLetterChallenge("rare_3", "Rare Collector", "Find 3 words with Q, X, Z, or J", 3, "QXZJ", "very_hard", 100),
    PalindromeChallenge("palindrome_2", "Mirror Master", "Find 2 palindrome words", 2, "very_hard", 100),
    WordEndsWithChallenge("ends_ing_5", "ING King", "Find 5 words ending in ING", 5, "ING", "very_hard", 90),
]


def get_all_challenges() -> List[Challenge]:
    """Returns all available challenges for the game.

    All challenges are now active simultaneously in every game.
    """
    return ALL_CHALLENGES


@dataclass
class PlayerChallengeProgress:
    """Tracks a player's progress on all challenges during a game."""
    player_id: str
    challenges: List[Challenge] = field(default_factory=list)

    def calculate_all_progress(self, found_words: List[str], score: int) -> List[Dict]:
        """Calculate progress for all challenges and return sorted by progress ratio."""
        results = []
        for challenge in self.challenges:
            progress = challenge.check_progress(found_words, score)
            ratio = challenge.get_progress_ratio(found_words, score)
            points_earned = challenge.get_points_earned(found_words, score)
            results.append({
                "id": challenge.id,
                "name": challenge.name,
                "description": challenge.description,
                "target": challenge.target,
                "progress": progress,
                "ratio": ratio,
                "completed": ratio >= 1.0,
                "category": challenge.category,
                "difficulty": challenge.difficulty,
                "points": challenge.points,
                "points_earned": points_earned
            })
        # Sort by ratio (highest first), then by whether completed
        results.sort(key=lambda x: (-x["ratio"], not x["completed"]))
        return results

    def get_best_challenge(self, found_words: List[str], score: int) -> Optional[Dict]:
        """Returns the challenge with the most progress."""
        all_progress = self.calculate_all_progress(found_words, score)
        return all_progress[0] if all_progress else None


class ChallengeManager:
    """Manages challenges for all active games."""

    def __init__(self):
        # lobby_id -> list of challenges for that game
        self.game_challenges: Dict[str, List[Challenge]] = {}

    def setup_game_challenges(self, lobby_id: str) -> List[Dict]:
        """Sets up challenges for a new game and returns them.

        Now returns ALL challenges instead of a random subset.
        """
        challenges = get_all_challenges()
        self.game_challenges[lobby_id] = challenges
        return [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "target": c.target,
                "category": c.category,
                "difficulty": c.difficulty,
                "points": c.points
            }
            for c in challenges
        ]

    def get_player_progress(
        self,
        lobby_id: str,
        found_words: List[str],
        score: int
    ) -> List[Dict]:
        """Gets a player's progress on all challenges."""
        if lobby_id not in self.game_challenges:
            return []

        challenges = self.game_challenges[lobby_id]
        progress = PlayerChallengeProgress(player_id="", challenges=challenges)
        return progress.calculate_all_progress(found_words, score)

    def get_total_challenge_points(
        self,
        lobby_id: str,
        found_words: List[str],
        score: int
    ) -> int:
        """Calculates total points earned from completed challenges."""
        if lobby_id not in self.game_challenges:
            return 0

        challenges = self.game_challenges[lobby_id]
        total_points = 0
        for challenge in challenges:
            total_points += challenge.get_points_earned(found_words, score)
        return total_points

    def get_best_challenge_for_player(
        self,
        lobby_id: str,
        found_words: List[str],
        score: int
    ) -> Optional[Dict]:
        """Gets the best (most progress) challenge for a player."""
        if lobby_id not in self.game_challenges:
            return None

        challenges = self.game_challenges[lobby_id]
        progress = PlayerChallengeProgress(player_id="", challenges=challenges)
        return progress.get_best_challenge(found_words, score)

    def cleanup_game(self, lobby_id: str):
        """Removes challenge data for a finished game."""
        if lobby_id in self.game_challenges:
            del self.game_challenges[lobby_id]


# Global challenge manager instance
challenge_manager = ChallengeManager()
