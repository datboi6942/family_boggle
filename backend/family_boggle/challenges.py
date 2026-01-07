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


# Define all available challenges (100+ challenges across 5 difficulty levels)
ALL_CHALLENGES: List[Challenge] = [
    # ==================== VERY EASY (5-10 points) ====================
    # Word Count - Very Easy
    WordCountChallenge("words_3", "First Steps", "Find 3 words", 3, "words", "very_easy", 5),
    WordCountChallenge("words_4", "Getting Started", "Find 4 words", 4, "words", "very_easy", 5),
    WordCountChallenge("words_5", "Word Finder", "Find 5 words", 5, "words", "very_easy", 8),
    WordCountChallenge("words_6", "Building Vocabulary", "Find 6 words", 6, "words", "very_easy", 8),
    WordCountChallenge("words_7", "Word Explorer", "Find 7 words", 7, "words", "very_easy", 10),

    # Word Length - Very Easy
    WordLengthChallenge("long_4_1", "Quick Long", "Find 1 word with 4+ letters", 1, 4, "very_easy", 5),
    WordLengthChallenge("long_4_2", "Double Long", "Find 2 words with 4+ letters", 2, 4, "very_easy", 8),
    WordLengthChallenge("long_5_1", "Five Letter Find", "Find 1 word with 5+ letters", 1, 5, "very_easy", 8),

    # Score - Very Easy
    ScoreChallenge("score_20", "Point Starter", "Score 20 points", 20, "very_easy", 5),
    ScoreChallenge("score_30", "Point Booster", "Score 30 points", 30, "very_easy", 8),
    ScoreChallenge("score_40", "Point Climber", "Score 40 points", 40, "very_easy", 10),

    # Letters - Very Easy
    WordStartsWithChallenge("starts_s_2", "S-Starter", "Find 2 words starting with S", 2, "S", "very_easy", 5),
    WordStartsWithChallenge("starts_t_2", "T-Starter", "Find 2 words starting with T", 2, "T", "very_easy", 5),
    WordStartsWithChallenge("starts_a_2", "A-Starter", "Find 2 words starting with A", 2, "A", "very_easy", 5),
    WordStartsWithChallenge("starts_c_2", "C-Starter", "Find 2 words starting with C", 2, "C", "very_easy", 5),
    WordEndsWithChallenge("ends_s_3", "Plural Starter", "Find 3 words ending in S", 3, "S", "very_easy", 8),
    WordEndsWithChallenge("ends_e_3", "E-Ending", "Find 3 words ending in E", 3, "E", "very_easy", 8),
    WordContainsChallenge("contains_e_4", "E-Spotter", "Find 4 words with E", 4, "E", "very_easy", 5),
    WordContainsChallenge("contains_a_3", "A-Spotter", "Find 3 words with A", 3, "A", "very_easy", 5),
    WordContainsChallenge("contains_i_3", "I-Spotter", "Find 3 words with I", 3, "I", "very_easy", 5),

    # ==================== EASY (15-25 points) ====================
    # Word Count - Easy
    WordCountChallenge("words_8", "Word Seeker", "Find 8 words", 8, "words", "easy", 15),
    WordCountChallenge("words_10", "Word Collector", "Find 10 words", 10, "words", "easy", 20),
    WordCountChallenge("words_12", "Word Gatherer", "Find 12 words", 12, "words", "easy", 25),

    # Word Length - Easy
    WordLengthChallenge("long_4_3", "Going Long", "Find 3 words with 4+ letters", 3, 4, "easy", 15),
    WordLengthChallenge("long_4_5", "Length Lover", "Find 5 words with 4+ letters", 5, 4, "easy", 20),
    WordLengthChallenge("long_5_2", "Five Plus", "Find 2 words with 5+ letters", 2, 5, "easy", 18),
    WordLengthChallenge("long_5_3", "Extended Words", "Find 3 words with 5+ letters", 3, 5, "easy", 25),
    WordLengthChallenge("long_6_1", "Six Letter Hunt", "Find 1 word with 6+ letters", 1, 6, "easy", 20),

    # Score - Easy
    ScoreChallenge("score_50", "Half Century", "Score 50 points", 50, "easy", 15),
    ScoreChallenge("score_60", "Point Pursuer", "Score 60 points", 60, "easy", 18),
    ScoreChallenge("score_75", "Three Quarter", "Score 75 points", 75, "easy", 25),

    # Letters - Easy
    WordStartsWithChallenge("starts_s_4", "S-Hunter", "Find 4 words starting with S", 4, "S", "easy", 18),
    WordStartsWithChallenge("starts_t_4", "T-Time", "Find 4 words starting with T", 4, "T", "easy", 18),
    WordStartsWithChallenge("starts_p_3", "P-Finder", "Find 3 words starting with P", 3, "P", "easy", 15),
    WordStartsWithChallenge("starts_b_3", "B-Sharp", "Find 3 words starting with B", 3, "B", "easy", 15),
    WordStartsWithChallenge("starts_m_3", "M-Power", "Find 3 words starting with M", 3, "M", "easy", 15),
    WordStartsWithChallenge("starts_r_3", "R-Rated", "Find 3 words starting with R", 3, "R", "easy", 15),
    WordStartsWithChallenge("starts_d_3", "D-Day", "Find 3 words starting with D", 3, "D", "easy", 15),
    WordStartsWithChallenge("starts_w_3", "W-Winner", "Find 3 words starting with W", 3, "W", "easy", 18),
    WordEndsWithChallenge("ends_s_5", "Plural Pro", "Find 5 words ending in S", 5, "S", "easy", 18),
    WordEndsWithChallenge("ends_ed_3", "Past Tense", "Find 3 words ending in ED", 3, "ED", "easy", 20),
    WordEndsWithChallenge("ends_er_2", "ER Explorer", "Find 2 words ending in ER", 2, "ER", "easy", 18),
    WordEndsWithChallenge("ends_t_3", "T-Ending", "Find 3 words ending in T", 3, "T", "easy", 15),
    WordContainsChallenge("contains_e_6", "E-Everywhere", "Find 6 words with E", 6, "E", "easy", 15),
    WordContainsChallenge("contains_o_4", "O-Zone", "Find 4 words with O", 4, "O", "easy", 18),
    WordContainsChallenge("contains_i_5", "I-Spy", "Find 5 words with I", 5, "I", "easy", 18),

    # ==================== MEDIUM (30-50 points) ====================
    # Word Count - Medium
    WordCountChallenge("words_15", "Word Master", "Find 15 words", 15, "words", "medium", 35),
    WordCountChallenge("words_18", "Vocabulary Vault", "Find 18 words", 18, "words", "medium", 45),
    WordCountChallenge("words_20", "Word Champion", "Find 20 words", 20, "words", "medium", 50),

    # Word Length - Medium
    WordLengthChallenge("long_4_7", "Long Word Lover", "Find 7 words with 4+ letters", 7, 4, "medium", 30),
    WordLengthChallenge("long_4_10", "Length Legend", "Find 10 words with 4+ letters", 10, 4, "medium", 45),
    WordLengthChallenge("long_5_4", "Extended Edition", "Find 4 words with 5+ letters", 4, 5, "medium", 35),
    WordLengthChallenge("long_5_5", "Five Star", "Find 5 words with 5+ letters", 5, 5, "medium", 45),
    WordLengthChallenge("long_6_2", "Six Pack", "Find 2 words with 6+ letters", 2, 6, "medium", 35),
    WordLengthChallenge("long_6_3", "Lengthy Lexicon", "Find 3 words with 6+ letters", 3, 6, "medium", 50),
    WordLengthChallenge("long_7_1", "Lucky Seven", "Find 1 word with 7+ letters", 1, 7, "medium", 40),

    # Score - Medium
    ScoreChallenge("score_100", "Century Club", "Score 100 points", 100, "medium", 30),
    ScoreChallenge("score_125", "Point Prodigy", "Score 125 points", 125, "medium", 40),
    ScoreChallenge("score_150", "High Scorer", "Score 150 points", 150, "medium", 50),

    # Letters - Medium
    WordStartsWithChallenge("starts_s_6", "S-Specialist", "Find 6 words starting with S", 6, "S", "medium", 35),
    WordStartsWithChallenge("starts_t_6", "T-Master", "Find 6 words starting with T", 6, "T", "medium", 35),
    WordStartsWithChallenge("starts_c_5", "C-Seeker", "Find 5 words starting with C", 5, "C", "medium", 30),
    WordStartsWithChallenge("starts_p_5", "P-Pursuer", "Find 5 words starting with P", 5, "P", "medium", 30),
    WordStartsWithChallenge("starts_a_6", "A-List", "Find 6 words starting with A", 6, "A", "medium", 35),
    WordStartsWithChallenge("starts_f_4", "F-Force", "Find 4 words starting with F", 4, "F", "medium", 35),
    WordStartsWithChallenge("starts_h_4", "H-Hero", "Find 4 words starting with H", 4, "H", "medium", 35),
    WordStartsWithChallenge("starts_l_4", "L-Legend", "Find 4 words starting with L", 4, "L", "medium", 30),
    WordStartsWithChallenge("starts_n_4", "N-Navigator", "Find 4 words starting with N", 4, "N", "medium", 30),
    WordEndsWithChallenge("ends_ing_2", "ING Thing", "Find 2 words ending in ING", 2, "ING", "medium", 40),
    WordEndsWithChallenge("ends_ed_5", "Past Perfect", "Find 5 words ending in ED", 5, "ED", "medium", 35),
    WordEndsWithChallenge("ends_er_4", "ER Expert", "Find 4 words ending in ER", 4, "ER", "medium", 35),
    WordEndsWithChallenge("ends_ly_1", "LY Adverbs", "Find 1 word ending in LY", 1, "LY", "medium", 35),
    WordEndsWithChallenge("ends_st_2", "ST Ending", "Find 2 words ending in ST", 2, "ST", "medium", 30),
    WordContainsChallenge("contains_u_4", "U-Turn", "Find 4 words with U", 4, "U", "medium", 35),
    WordContainsChallenge("contains_o_7", "O-Overload", "Find 7 words with O", 7, "O", "medium", 30),
    WordContainsChallenge("contains_r_5", "R-Radar", "Find 5 words with R", 5, "R", "medium", 30),
    WordContainsChallenge("contains_n_5", "N-Network", "Find 5 words with N", 5, "N", "medium", 30),

    # Special - Medium
    DoubleLetterChallenge("double_3", "Double Trouble", "Find 3 words with double letters", 3, "medium", 40),
    DoubleLetterChallenge("double_4", "Twin Terms", "Find 4 words with double letters", 4, "medium", 50),
    VowelHeavyChallenge("vowels_3", "Vowel Voyage", "Find 3 words with 3+ vowels", 3, 3, "medium", 40),
    VowelHeavyChallenge("vowels_4", "Vowel Hunter", "Find 4 words with 3+ vowels", 4, 3, "medium", 50),

    # ==================== HARD (60-80 points) ====================
    # Word Count - Hard
    WordCountChallenge("words_22", "Word Wizard", "Find 22 words", 22, "words", "hard", 65),
    WordCountChallenge("words_25", "Vocabulary Virtuoso", "Find 25 words", 25, "words", "hard", 75),
    WordCountChallenge("words_28", "Word Overlord", "Find 28 words", 28, "words", "hard", 80),

    # Word Length - Hard
    WordLengthChallenge("long_5_7", "Five Letter Master", "Find 7 words with 5+ letters", 7, 5, "hard", 70),
    WordLengthChallenge("long_6_4", "Six Letter Pro", "Find 4 words with 6+ letters", 4, 6, "hard", 75),
    WordLengthChallenge("long_6_5", "Lengthy Legend", "Find 5 words with 6+ letters", 5, 6, "hard", 80),
    WordLengthChallenge("long_7_2", "Marathon Words", "Find 2 words with 7+ letters", 2, 7, "hard", 70),
    WordLengthChallenge("long_7_3", "Seven Heaven", "Find 3 words with 7+ letters", 3, 7, "hard", 80),

    # Score - Hard
    ScoreChallenge("score_175", "Point Powerhouse", "Score 175 points", 175, "hard", 60),
    ScoreChallenge("score_200", "Point Master", "Score 200 points", 200, "hard", 75),
    ScoreChallenge("score_225", "Score Sultan", "Score 225 points", 225, "hard", 80),

    # Letters - Hard
    WordStartsWithChallenge("starts_s_8", "S-Supreme", "Find 8 words starting with S", 8, "S", "hard", 65),
    WordStartsWithChallenge("starts_t_8", "T-Titan", "Find 8 words starting with T", 8, "T", "hard", 65),
    WordStartsWithChallenge("starts_g_4", "G-Genius", "Find 4 words starting with G", 4, "G", "hard", 70),
    WordStartsWithChallenge("starts_j_2", "J-Jumper", "Find 2 words starting with J", 2, "J", "hard", 75),
    WordStartsWithChallenge("starts_k_2", "K-King", "Find 2 words starting with K", 2, "K", "hard", 75),
    WordEndsWithChallenge("ends_ing_3", "ING Master", "Find 3 words ending in ING", 3, "ING", "hard", 70),
    WordEndsWithChallenge("ends_tion_1", "TION Station", "Find 1 word ending in TION", 1, "TION", "hard", 75),
    WordEndsWithChallenge("ends_ly_2", "LY Master", "Find 2 words ending in LY", 2, "LY", "hard", 70),

    # Special - Hard
    DoubleLetterChallenge("double_5", "Twin Peaks", "Find 5 words with double letters", 5, "hard", 65),
    DoubleLetterChallenge("double_6", "Double Vision", "Find 6 words with double letters", 6, "hard", 75),
    VowelHeavyChallenge("vowels_5", "Vowel Victory", "Find 5 words with 3+ vowels", 5, 3, "hard", 70),
    VowelHeavyChallenge("vowels_4_4", "Super Vowel", "Find 4 words with 4+ vowels", 4, 4, "hard", 80),
    ConsonantHeavyChallenge("consonants_2", "Consonant Crusher", "Find 2 words with 4+ consonants in a row", 2, "hard", 75),
    RareLetterChallenge("rare_1", "Rare Find", "Find 1 word with Q, X, Z, or J", 1, "QXZJ", "hard", 60),
    RareLetterChallenge("rare_2", "Treasure Hunter", "Find 2 words with Q, X, Z, or J", 2, "QXZJ", "hard", 80),
    PalindromeChallenge("palindrome_1", "Mirror Mirror", "Find 1 palindrome word", 1, "hard", 75),

    # ==================== VERY HARD (90-100 points) ====================
    # Word Count - Very Hard
    WordCountChallenge("words_30", "Word Deity", "Find 30 words", 30, "words", "very_hard", 90),
    WordCountChallenge("words_35", "Lexicon Lord", "Find 35 words", 35, "words", "very_hard", 95),
    WordCountChallenge("words_40", "Word God", "Find 40 words", 40, "words", "very_hard", 100),

    # Word Length - Very Hard
    WordLengthChallenge("long_5_10", "Five Letter God", "Find 10 words with 5+ letters", 10, 5, "very_hard", 95),
    WordLengthChallenge("long_6_7", "Six Letter Supreme", "Find 7 words with 6+ letters", 7, 6, "very_hard", 100),
    WordLengthChallenge("long_7_4", "Seven Samurai", "Find 4 words with 7+ letters", 4, 7, "very_hard", 100),
    WordLengthChallenge("long_8_1", "Eight Wonder", "Find 1 word with 8+ letters", 1, 8, "very_hard", 90),

    # Score - Very Hard
    ScoreChallenge("score_250", "Quarter King", "Score 250 points", 250, "very_hard", 90),
    ScoreChallenge("score_300", "Triple Century", "Score 300 points", 300, "very_hard", 100),

    # Letters - Very Hard
    WordStartsWithChallenge("starts_q_1", "Q-Quest", "Find 1 word starting with Q", 1, "Q", "very_hard", 95),
    WordStartsWithChallenge("starts_x_1", "X-Factor", "Find 1 word starting with X", 1, "X", "very_hard", 100),
    WordStartsWithChallenge("starts_z_1", "Z-Zone", "Find 1 word starting with Z", 1, "Z", "very_hard", 95),

    # Special - Very Hard
    DoubleLetterChallenge("double_8", "Double Dominator", "Find 8 words with double letters", 8, "very_hard", 90),
    VowelHeavyChallenge("vowels_7", "Vowel Virtuoso", "Find 7 words with 3+ vowels", 7, 3, "very_hard", 90),
    VowelHeavyChallenge("vowels_5_4", "Quad Vowel Master", "Find 5 words with 4+ vowels", 5, 4, "very_hard", 100),
    ConsonantHeavyChallenge("consonants_3", "Consonant King", "Find 3 words with 4+ consonants in a row", 3, "very_hard", 95),
    RareLetterChallenge("rare_3", "Rare Collector", "Find 3 words with Q, X, Z, or J", 3, "QXZJ", "very_hard", 100),
    RareLetterChallenge("rare_q_2", "Q-Conqueror", "Find 2 words with Q", 2, "Q", "very_hard", 100),
    PalindromeChallenge("palindrome_2", "Mirror Master", "Find 2 palindrome words", 2, "very_hard", 100),
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
