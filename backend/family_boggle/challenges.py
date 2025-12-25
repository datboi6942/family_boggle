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

    def check_progress(self, found_words: List[str], score: int) -> int:
        """Returns progress count towards this challenge. Override in subclasses."""
        return 0

    def get_progress_ratio(self, found_words: List[str], score: int) -> float:
        """Returns progress as a ratio (0.0 to 1.0+)."""
        return min(self.check_progress(found_words, score) / self.target, 1.0) if self.target > 0 else 0.0


class WordCountChallenge(Challenge):
    """Find X total words."""
    def check_progress(self, found_words: List[str], score: int) -> int:
        return len(found_words)


class WordLengthChallenge(Challenge):
    """Find X words of a certain minimum length."""
    def __init__(self, id: str, name: str, description: str, target: int, min_length: int):
        super().__init__(id, name, description, target, "words")
        self.min_length = min_length

    def check_progress(self, found_words: List[str], score: int) -> int:
        return sum(1 for w in found_words if len(w) >= self.min_length)


class WordStartsWithChallenge(Challenge):
    """Find X words starting with a specific letter."""
    def __init__(self, id: str, name: str, description: str, target: int, letter: str):
        super().__init__(id, name, description, target, "letters")
        self.letter = letter.upper()

    def check_progress(self, found_words: List[str], score: int) -> int:
        return sum(1 for w in found_words if w.upper().startswith(self.letter))


class WordEndsWithChallenge(Challenge):
    """Find X words ending with a specific suffix."""
    def __init__(self, id: str, name: str, description: str, target: int, suffix: str):
        super().__init__(id, name, description, target, "letters")
        self.suffix = suffix.upper()

    def check_progress(self, found_words: List[str], score: int) -> int:
        return sum(1 for w in found_words if w.upper().endswith(self.suffix))


class WordContainsChallenge(Challenge):
    """Find X words containing a specific letter."""
    def __init__(self, id: str, name: str, description: str, target: int, letter: str):
        super().__init__(id, name, description, target, "letters")
        self.letter = letter.upper()

    def check_progress(self, found_words: List[str], score: int) -> int:
        return sum(1 for w in found_words if self.letter in w.upper())


class ScoreChallenge(Challenge):
    """Reach X total points."""
    def __init__(self, id: str, name: str, description: str, target: int):
        super().__init__(id, name, description, target, "score")

    def check_progress(self, found_words: List[str], score: int) -> int:
        return score


class DoubleLetterChallenge(Challenge):
    """Find X words with double letters (e.g., LETTER, BOOK)."""
    def __init__(self, id: str, name: str, description: str, target: int):
        super().__init__(id, name, description, target, "special")

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
    def __init__(self, id: str, name: str, description: str, target: int):
        super().__init__(id, name, description, target, "special")

    def check_progress(self, found_words: List[str], score: int) -> int:
        return sum(1 for w in found_words if w.upper() == w.upper()[::-1] and len(w) >= 3)


class VowelHeavyChallenge(Challenge):
    """Find X words with 3+ vowels."""
    def __init__(self, id: str, name: str, description: str, target: int, min_vowels: int = 3):
        super().__init__(id, name, description, target, "special")
        self.min_vowels = min_vowels

    def check_progress(self, found_words: List[str], score: int) -> int:
        vowels = set('AEIOU')
        return sum(1 for w in found_words if sum(1 for c in w.upper() if c in vowels) >= self.min_vowels)


class ConsonantHeavyChallenge(Challenge):
    """Find X words with 4+ consonants in a row."""
    def __init__(self, id: str, name: str, description: str, target: int):
        super().__init__(id, name, description, target, "special")

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
    def __init__(self, id: str, name: str, description: str, target: int, letters: str = "QXZJ"):
        super().__init__(id, name, description, target, "special")
        self.rare_letters = set(letters.upper())

    def check_progress(self, found_words: List[str], score: int) -> int:
        return sum(1 for w in found_words if any(c in self.rare_letters for c in w.upper()))


# Define all available challenges
ALL_CHALLENGES: List[Challenge] = [
    # Word count challenges
    WordCountChallenge("words_10", "Word Collector", "Find 10 words", 10, "words"),
    WordCountChallenge("words_20", "Vocabulary Master", "Find 20 words", 20, "words"),
    WordCountChallenge("words_30", "Word Wizard", "Find 30 words", 30, "words"),

    # Word length challenges
    WordLengthChallenge("long_4", "Going Long", "Find 5 words with 4+ letters", 5, 4),
    WordLengthChallenge("long_5", "Extended Edition", "Find 4 words with 5+ letters", 4, 5),
    WordLengthChallenge("long_6", "Lengthy Lexicon", "Find 3 words with 6+ letters", 3, 6),
    WordLengthChallenge("long_7", "Marathon Words", "Find 2 words with 7+ letters", 2, 7),

    # Starting letter challenges
    WordStartsWithChallenge("starts_s", "S-Starter", "Find 4 words starting with S", 4, "S"),
    WordStartsWithChallenge("starts_t", "T-Time", "Find 4 words starting with T", 4, "T"),
    WordStartsWithChallenge("starts_c", "C-Seeker", "Find 4 words starting with C", 4, "C"),
    WordStartsWithChallenge("starts_p", "P-Hunter", "Find 4 words starting with P", 4, "P"),
    WordStartsWithChallenge("starts_a", "A-List", "Find 4 words starting with A", 4, "A"),
    WordStartsWithChallenge("starts_b", "B-Sharp", "Find 3 words starting with B", 3, "B"),
    WordStartsWithChallenge("starts_m", "M-Power", "Find 3 words starting with M", 3, "M"),
    WordStartsWithChallenge("starts_r", "R-Rated", "Find 3 words starting with R", 3, "R"),

    # Ending challenges
    WordEndsWithChallenge("ends_ing", "ING Thing", "Find 3 words ending in ING", 3, "ING"),
    WordEndsWithChallenge("ends_ed", "Past Tense", "Find 4 words ending in ED", 4, "ED"),
    WordEndsWithChallenge("ends_er", "ER Explorer", "Find 3 words ending in ER", 3, "ER"),
    WordEndsWithChallenge("ends_ly", "LY Adverbs", "Find 2 words ending in LY", 2, "LY"),
    WordEndsWithChallenge("ends_tion", "TION Station", "Find 1 word ending in TION", 1, "TION"),
    WordEndsWithChallenge("ends_s", "Plural Pro", "Find 6 words ending in S", 6, "S"),

    # Contains challenges
    WordContainsChallenge("contains_e", "E-Everywhere", "Find 8 words with E", 8, "E"),
    WordContainsChallenge("contains_i", "I-Spy", "Find 6 words with I", 6, "I"),
    WordContainsChallenge("contains_o", "O-Zone", "Find 6 words with O", 6, "O"),
    WordContainsChallenge("contains_u", "U-Turn", "Find 4 words with U", 4, "U"),

    # Score challenges
    ScoreChallenge("score_50", "Half Century", "Score 50 points", 50),
    ScoreChallenge("score_100", "Century Club", "Score 100 points", 100),
    ScoreChallenge("score_150", "High Scorer", "Score 150 points", 150),
    ScoreChallenge("score_200", "Point Master", "Score 200 points", 200),

    # Special challenges
    DoubleLetterChallenge("double", "Double Trouble", "Find 3 words with double letters", 3),
    DoubleLetterChallenge("double_5", "Twin Peaks", "Find 5 words with double letters", 5),
    VowelHeavyChallenge("vowels", "Vowel Voyage", "Find 3 words with 3+ vowels", 3),
    VowelHeavyChallenge("vowels_5", "Vowel Victory", "Find 5 words with 3+ vowels", 5),
    ConsonantHeavyChallenge("consonants", "Consonant Crusher", "Find 2 words with 4+ consonants in a row", 2),
    RareLetterChallenge("rare_1", "Rare Find", "Find 1 word with Q, X, Z, or J", 1),
    RareLetterChallenge("rare_3", "Treasure Hunter", "Find 3 words with Q, X, Z, or J", 3),
    PalindromeChallenge("palindrome", "Mirror Mirror", "Find 1 palindrome word", 1),
]


def select_challenges_for_game(count: int = 8) -> List[Challenge]:
    """Selects a random subset of challenges for a game.

    Ensures variety by picking from different categories.
    """
    # Group by category
    by_category: Dict[str, List[Challenge]] = {}
    for c in ALL_CHALLENGES:
        if c.category not in by_category:
            by_category[c.category] = []
        by_category[c.category].append(c)

    selected: List[Challenge] = []
    categories = list(by_category.keys())

    # Try to get 2 from each category, then fill randomly
    for cat in categories:
        pool = by_category[cat]
        picks = random.sample(pool, min(2, len(pool)))
        selected.extend(picks)

    # If we need more, pick randomly from remaining
    remaining = [c for c in ALL_CHALLENGES if c not in selected]
    if len(selected) < count and remaining:
        extra = random.sample(remaining, min(count - len(selected), len(remaining)))
        selected.extend(extra)

    # Shuffle and limit
    random.shuffle(selected)
    return selected[:count]


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
            results.append({
                "id": challenge.id,
                "name": challenge.name,
                "description": challenge.description,
                "target": challenge.target,
                "progress": progress,
                "ratio": ratio,
                "completed": ratio >= 1.0,
                "category": challenge.category
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
        """Sets up challenges for a new game and returns them."""
        challenges = select_challenges_for_game(8)
        self.game_challenges[lobby_id] = challenges
        return [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "target": c.target,
                "category": c.category
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
