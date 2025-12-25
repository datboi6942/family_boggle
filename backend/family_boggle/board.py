import random
from typing import List, Tuple, Set

class BoggleBoard:
    """Boggle board generator and validator."""

    # Family-friendly 4x4 dice - more vowels, common consonants, easier words
    # Guarantees good vowel distribution and common letter combos
    # Note: "Qu" represents the QU tile (always paired together)
    DICE_4X4 = [
        "AAEEIN", "AAEIOU", "AEIOUY", "EEEAIO",  # Vowel-heavy dice (4)
        "RRLLSS", "NNTTSS", "DDMMPP", "BBCCGG",  # Common consonant pairs (4)
        "DELNOR", "STRNGL", "THWRSP", "CHMPTK",  # Mixed consonants (4)
        "AELRST", "EINOST", "AEORTU", "EILNRU",  # Common word patterns (4)
    ]

    # Family-friendly 5x5 dice - balanced for more word possibilities
    DICE_5X5 = [
        "AAEEIN", "AAEIOU", "AEIOUY", "EEEAIO", "AAOOUU",  # Vowel-heavy (5)
        "RRLLNN", "SSTTNN", "DDMMPP", "BBCCFF", "GGHHKK",  # Consonant pairs (5)
        "DELNOR", "STRNGL", "THWRSP", "CHMPTK", "BDFGJV",  # Mixed consonants (5)
        "AELRST", "EINOST", "AEORTU", "EILNRU", "ACDEST",  # Common patterns (5)
        "INGEDS", "ERSTLN", "AEIORT", "OUNDSE", "ATIONM",  # Word endings/patterns (5)
    ]

    # Super Big Boggle 6x6 dice - good balance for larger board
    # One die includes "Qu" for Q words
    DICE_6X6 = [
        "AAEEIN", "AAEIOU", "AEIOUY", "EEEAIO", "AAOOUU", "EEIIOO",  # Vowels (6)
        "RRLLNN", "SSTTNN", "DDMMPP", "BBCCFF", "GGHHKK", "WWVVYY",  # Consonants (6)
        "DELNOR", "STRNGL", "THWRSP", "CHMPTK", "BDFGJV", "LMNPRS",  # Mixed (6)
        "AELRST", "EINOST", "AEORTU", "EILNRU", "ACDEST", "IOPSTU",  # Patterns (6)
        "INGEDS", "ERSTLN", "AEIORT", "OUNDSE", "ATIONM", "ERSTIN",  # Endings (6)
        "ABCDEQu", "GHILMN", "OPRST", "UVWXYZ", "AEINOR", "STLNRE",  # Variety (6) - includes Qu
    ]

    # Special marker for QU tile - we use "Qu" in dice and store as "QU" in grid
    QU_MARKER = "Qu"

    # Minimum vowel percentages for playable boards
    MIN_VOWEL_RATIO = {4: 0.30, 5: 0.28, 6: 0.25}  # 30%, 28%, 25%

    def __init__(self, size: int = 6):
        """Initializes the board with a specific size.

        Args:
            size: The dimensions of the board (4, 5, or 6).
        """
        self.size = size
        self.grid: List[List[str]] = []
        self.generate()

    def _count_vowels(self, letters: List[str]) -> int:
        """Count vowels in a list of letters."""
        vowels = set("AEIOU")
        return sum(1 for letter in letters if letter in vowels)

    def _is_playable(self, letters: List[str]) -> bool:
        """Check if board has enough vowels to be playable."""
        total = len(letters)
        vowel_count = self._count_vowels(letters)
        min_ratio = self.MIN_VOWEL_RATIO.get(self.size, 0.25)
        return vowel_count / total >= min_ratio

    def _pick_from_die(self, die: str) -> str:
        """Pick a random face from a die, handling special 'Qu' marker."""
        # Parse die faces - "Qu" counts as one face
        faces = []
        i = 0
        while i < len(die):
            if i < len(die) - 1 and die[i:i+2] == self.QU_MARKER:
                faces.append("QU")  # Store as "QU" in grid
                i += 2
            else:
                faces.append(die[i])
                i += 1
        return random.choice(faces)

    def generate(self) -> None:
        """Generates a random board grid with guaranteed playability."""
        # Select the appropriate dice set based on board size
        if self.size == 4:
            dice = list(self.DICE_4X4)
        elif self.size == 5:
            dice = list(self.DICE_5X5)
        else:
            dice = list(self.DICE_6X6)

        # Try to generate a playable board (max 10 attempts)
        for _ in range(10):
            random.shuffle(dice)
            letters = [self._pick_from_die(d) for d in dice]

            if self._is_playable(letters):
                break
        else:
            # Fallback: force some vowels if still not playable
            vowel_dice = ["AEIOU", "AEIO", "AEIU", "AOEU"]
            num_to_replace = max(2, self.size)
            for i in range(num_to_replace):
                letters[i] = random.choice(vowel_dice[i % len(vowel_dice)])

        self.grid = [
            letters[i * self.size : (i + 1) * self.size]
            for i in range(self.size)
        ]

    def is_word_on_board(self, word: str, path: List[Tuple[int, int]]) -> bool:
        """Validates if a word is actually present on the board following a path.

        Args:
            word: The word to validate.
            path: List of (row, col) coordinates.

        Returns:
            True if the path matches the word and is valid.
        """
        word = word.upper()
        used_cells: Set[Tuple[int, int]] = set()

        # Build the expected word from the path, accounting for QU tiles
        path_word = ""
        for r, c in path:
            if not (0 <= r < self.size and 0 <= c < self.size):
                return False
            path_word += self.grid[r][c]

        # The path word should match the submitted word
        if path_word != word:
            return False

        # Now validate the path itself (no reuse, adjacency)
        for i, (r, c) in enumerate(path):
            if (r, c) in used_cells:
                return False

            # Check adjacency if not the first cell
            if i > 0:
                prev_r, prev_c = path[i-1]
                if abs(r - prev_r) > 1 or abs(c - prev_c) > 1:
                    return False

            used_cells.add((r, c))

        return True

    def find_all_valid_words(self, dictionary_set: Set[str], prefix_set: Set[str] = None) -> List[str]:
        """Find all valid words on the board using DFS.

        Args:
            dictionary_set: Set of valid words (uppercase).
            prefix_set: Optional set of valid prefixes for early termination.

        Returns:
            List of all valid words found on the board.
        """
        found_words: Set[str] = set()

        # Build prefix set if not provided (for early termination optimization)
        if prefix_set is None:
            prefix_set = set()
            for word in dictionary_set:
                for i in range(1, len(word) + 1):
                    prefix_set.add(word[:i])

        def dfs(row: int, col: int, path: str, visited: Set[Tuple[int, int]]) -> None:
            # Check if current path could lead to a valid word
            if path not in prefix_set:
                return

            # Check if we found a valid word (min 3 letters)
            if len(path) >= 3 and path in dictionary_set:
                found_words.add(path)

            # Stop at reasonable length to prevent infinite loops
            if len(path) >= 15:
                return

            # Explore all adjacent cells
            for dr in [-1, 0, 1]:
                for dc in [-1, 0, 1]:
                    if dr == 0 and dc == 0:
                        continue
                    nr, nc = row + dr, col + dc
                    if 0 <= nr < self.size and 0 <= nc < self.size and (nr, nc) not in visited:
                        new_visited = visited | {(nr, nc)}
                        new_path = path + self.grid[nr][nc]
                        dfs(nr, nc, new_path, new_visited)

        # Start DFS from each cell
        for r in range(self.size):
            for c in range(self.size):
                dfs(r, c, self.grid[r][c], {(r, c)})

        return list(found_words)

    def find_longest_possible_word(self, dictionary_set: Set[str], prefix_set: Set[str] = None) -> str:
        """Find the longest valid word that can be formed on this board.

        Args:
            dictionary_set: Set of valid words (uppercase).
            prefix_set: Optional set of valid prefixes for early termination.

        Returns:
            The longest word found, or empty string if none.
        """
        all_words = self.find_all_valid_words(dictionary_set, prefix_set)
        if not all_words:
            return ""
        # Return the longest word (tie-break alphabetically for consistency)
        return max(all_words, key=lambda w: (len(w), w))
