import random
from typing import List, Tuple, Set, Optional

class BoggleBoard:
    """Boggle board generator and validator."""
    
    # Official Boggle dice distributions for different board sizes
    # Standard 4x4 Boggle dice (16 dice)
    DICE_4X4 = [
        "AAEEGN", "ABBJOO", "ACHOPS", "AFFKPS",
        "AOOTTW", "CIMOTU", "DEILRX", "DELRVY",
        "DISTTY", "EEGHNW", "EEINSU", "EHRTVW",
        "EIOSST", "ELRTTY", "HIMNQU", "HLNNRZ",
    ]
    
    # Big Boggle 5x5 dice (25 dice)
    DICE_5X5 = [
        "AAAFRS", "AAEEEE", "AAFIRS", "ADENNN", "AEEEEM",
        "AEEGMU", "AEGMNN", "AFIRSY", "BJKQXZ", "CCNSTW",
        "CEIILT", "CEILPT", "CEIPST", "DDLNOR", "DHHLOR",
        "DHHNOT", "DHLNOR", "EIIITT", "EMOTTT", "ENSSSU",
        "FIPRSY", "GORRVW", "HIPRRY", "NOOTUW", "OOOTTU",
    ]
    
    # Super Big Boggle 6x6 dice (36 dice) - balanced vowel/consonant mix
    DICE_6X6 = [
        "AAAFRS", "AAEEEE", "AAEEOO", "AAFIRS", "ABDEIO", "ADENNN",
        "AEEEEM", "AEEGMU", "AEGMNN", "AEILMN", "AEINOU", "AFIRSY",
        "BBJKXZ", "CCENST", "CDDLNN", "CEIILT", "CEIPST", "CFGNUY",
        "DDHNOT", "DHHLOR", "DHHNOW", "DHLNOR", "EHILRS", "EIILST",
        "EILPST", "EIORST", "EMTTTO", "ENSSSU", "GORRVW", "HIRSTV",
        "HOPRST", "IPRSYY", "JKQWXZ", "NOOTUW", "OOOTTU", "OOOTUU",
    ]

    def __init__(self, size: int = 6):
        """Initializes the board with a specific size.
        
        Args:
            size: The dimensions of the board (4, 5, or 6).
        """
        self.size = size
        self.grid: List[List[str]] = []
        self.generate()

    def generate(self) -> None:
        """Generates a random board grid using official Boggle dice."""
        # Select the appropriate dice set based on board size
        if self.size == 4:
            dice = list(self.DICE_4X4)
        elif self.size == 5:
            dice = list(self.DICE_5X5)
        else:
            dice = list(self.DICE_6X6)
        
        random.shuffle(dice)
        
        letters = [random.choice(d) for d in dice]
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
        if len(word) != len(path):
            return False
            
        word = word.upper()
        used_cells: Set[Tuple[int, int]] = set()
        
        for i, (r, c) in enumerate(path):
            if not (0 <= r < self.size and 0 <= c < self.size):
                return False
            if (r, c) in used_cells:
                return False
            if self.grid[r][c] != word[i]:
                # Special handling for 'QU' if needed, but here each tile is one letter
                return False
            
            # Check adjacency if not the first letter
            if i > 0:
                prev_r, prev_c = path[i-1]
                if abs(r - prev_r) > 1 or abs(c - prev_c) > 1:
                    return False
                    
            used_cells.add((r, c))
            
        return True

    def find_all_words(self, word_set: Set[str]) -> List[str]:
        """Finds all valid words on the board using DFS.
        
        Args:
            word_set: Set of valid dictionary words (uppercase).
            
        Returns:
            List of all valid words that can be formed on the board,
            sorted by length (longest first).
        """
        found_words: Set[str] = set()
        
        # Build a prefix set for early termination
        prefixes: Set[str] = set()
        for word in word_set:
            for i in range(1, len(word) + 1):
                prefixes.add(word[:i])
        
        def dfs(r: int, c: int, path: str, visited: Set[Tuple[int, int]]) -> None:
            """DFS to explore all paths from a cell."""
            # Early termination if prefix not in dictionary
            if path not in prefixes:
                return
                
            # Check if current path is a valid word (min 3 letters)
            if len(path) >= 3 and path in word_set:
                found_words.add(path)
            
            # Explore neighbors
            for dr in [-1, 0, 1]:
                for dc in [-1, 0, 1]:
                    if dr == 0 and dc == 0:
                        continue
                    nr, nc = r + dr, c + dc
                    if 0 <= nr < self.size and 0 <= nc < self.size:
                        if (nr, nc) not in visited:
                            new_visited = visited | {(nr, nc)}
                            dfs(nr, nc, path + self.grid[nr][nc], new_visited)
        
        # Start DFS from each cell
        for r in range(self.size):
            for c in range(self.size):
                dfs(r, c, self.grid[r][c], {(r, c)})
        
        # Sort by length (longest first), then alphabetically
        return sorted(found_words, key=lambda w: (-len(w), w))
