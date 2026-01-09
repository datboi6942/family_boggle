import random
from typing import List, Tuple, Set, Optional

class BoggleBoard:
    """Boggle board generator and validator."""

    # Vowels for adjacency checking
    VOWELS = {'A', 'E', 'I', 'O', 'U'}

    # Rare/special letters that MUST touch a vowel to be usable
    RARE_LETTERS = {'J', 'X', 'Q', 'Z'}

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

    def _has_adjacent_vowel(self, r: int, c: int) -> bool:
        """Check if a cell has at least one adjacent vowel."""
        for dr in [-1, 0, 1]:
            for dc in [-1, 0, 1]:
                if dr == 0 and dc == 0:
                    continue
                nr, nc = r + dr, c + dc
                if 0 <= nr < self.size and 0 <= nc < self.size:
                    if self.grid[nr][nc] in self.VOWELS:
                        return True
        return False

    def _has_adjacent_u(self, r: int, c: int) -> bool:
        """Check if a cell has at least one adjacent U."""
        for dr in [-1, 0, 1]:
            for dc in [-1, 0, 1]:
                if dr == 0 and dc == 0:
                    continue
                nr, nc = r + dr, c + dc
                if 0 <= nr < self.size and 0 <= nc < self.size:
                    if self.grid[nr][nc] == 'U':
                        return True
        return False

    def _get_adjacent_cells(self, r: int, c: int) -> List[Tuple[int, int]]:
        """Get all valid adjacent cell coordinates."""
        adjacent = []
        for dr in [-1, 0, 1]:
            for dc in [-1, 0, 1]:
                if dr == 0 and dc == 0:
                    continue
                nr, nc = r + dr, c + dc
                if 0 <= nr < self.size and 0 <= nc < self.size:
                    adjacent.append((nr, nc))
        return adjacent

    def _find_qs_without_u(self) -> List[Tuple[int, int]]:
        """Find all Q positions that don't have an adjacent U."""
        qs_without_u = []
        for r in range(self.size):
            for c in range(self.size):
                if self.grid[r][c] == 'Q' and not self._has_adjacent_u(r, c):
                    qs_without_u.append((r, c))
        return qs_without_u

    def _fix_q_without_u(self) -> None:
        """Ensure all Q's on the board touch at least one U.

        Strategy: For each Q without an adjacent U, find a U elsewhere
        on the board and swap it into an adjacent position.
        """
        max_attempts = 20
        for _ in range(max_attempts):
            qs_without_u = self._find_qs_without_u()
            if not qs_without_u:
                return  # All Q's now touch a U

            for q_r, q_c in qs_without_u:
                # Find all U positions on the board
                u_positions = []
                for r in range(self.size):
                    for c in range(self.size):
                        if self.grid[r][c] == 'U':
                            # Don't use U's that are already adjacent to this Q
                            if abs(r - q_r) > 1 or abs(c - q_c) > 1:
                                u_positions.append((r, c))

                if not u_positions:
                    # No U available to swap - need to create one
                    # Find a vowel adjacent to Q and replace it with U
                    adjacent = self._get_adjacent_cells(q_r, q_c)
                    for adj_r, adj_c in adjacent:
                        if self.grid[adj_r][adj_c] in self.VOWELS:
                            self.grid[adj_r][adj_c] = 'U'
                            break
                    else:
                        # No adjacent vowel, swap adjacent cell with any vowel and make it U
                        if adjacent:
                            adj_r, adj_c = random.choice(adjacent)
                            # Find any vowel on the board to swap
                            for r in range(self.size):
                                for c in range(self.size):
                                    if self.grid[r][c] in self.VOWELS and (r, c) != (adj_r, adj_c):
                                        # Swap and convert to U
                                        self.grid[adj_r][adj_c], self.grid[r][c] = self.grid[r][c], self.grid[adj_r][adj_c]
                                        self.grid[adj_r][adj_c] = 'U'
                                        break
                                else:
                                    continue
                                break
                    continue

                # Find adjacent cells to the Q where we can place a U
                adjacent = self._get_adjacent_cells(q_r, q_c)

                # Sort U's by distance to Q (prefer closer ones)
                u_positions.sort(key=lambda pos: abs(pos[0] - q_r) + abs(pos[1] - q_c))

                # Try to swap a U into an adjacent position
                swapped = False
                for u_r, u_c in u_positions:
                    for adj_r, adj_c in adjacent:
                        # Don't swap the Q itself
                        if (adj_r, adj_c) == (q_r, q_c):
                            continue
                        # Don't swap another Q
                        if self.grid[adj_r][adj_c] == 'Q':
                            continue
                        # Swap the U with the adjacent cell
                        self.grid[u_r][u_c], self.grid[adj_r][adj_c] = \
                            self.grid[adj_r][adj_c], self.grid[u_r][u_c]
                        swapped = True
                        break
                    if swapped:
                        break

                # Only fix one Q per iteration, then recheck
                break

    def _get_landlocked_rare_letters(self) -> List[Tuple[int, int, str]]:
        """Find all rare letters (J, X, Q, Z) that don't touch any vowels."""
        landlocked = []
        for r in range(self.size):
            for c in range(self.size):
                letter = self.grid[r][c]
                if letter in self.RARE_LETTERS:
                    if not self._has_adjacent_vowel(r, c):
                        landlocked.append((r, c, letter))
        return landlocked

    def _count_landlocked_consonants(self) -> int:
        """Count consonants that don't touch any vowels (landlocked)."""
        landlocked = 0
        for r in range(self.size):
            for c in range(self.size):
                letter = self.grid[r][c]
                # Skip if this is a vowel
                if letter in self.VOWELS:
                    continue
                if not self._has_adjacent_vowel(r, c):
                    landlocked += 1
        return landlocked

    def _is_board_quality_acceptable(self) -> bool:
        """Check if the board has acceptable vowel-consonant distribution.

        ALL consonants should ideally touch at least one vowel to be usable.

        Returns:
            True if the board is acceptable, False if it should be regenerated.
        """
        landlocked = self._count_landlocked_consonants()

        # Count vowels
        vowel_count = sum(
            1 for r in range(self.size) for c in range(self.size)
            if self.grid[r][c] in self.VOWELS
        )

        # STRICT thresholds - no landlocked consonants allowed!
        if self.size == 4:
            # 4x4: No landlocked consonants, need at least 4 vowels
            return landlocked == 0 and vowel_count >= 4
        elif self.size == 5:
            # 5x5: No landlocked consonants, need at least 6 vowels
            return landlocked == 0 and vowel_count >= 6
        else:
            # 6x6: No landlocked consonants, need at least 9 vowels
            return landlocked == 0 and vowel_count >= 9

    def _get_all_landlocked_consonants(self) -> List[Tuple[int, int, str]]:
        """Find all consonants that don't touch any vowels."""
        landlocked = []
        for r in range(self.size):
            for c in range(self.size):
                letter = self.grid[r][c]
                if letter not in self.VOWELS and not self._has_adjacent_vowel(r, c):
                    landlocked.append((r, c, letter))
        return landlocked

    def _fix_landlocked_consonants(self) -> None:
        """Swap landlocked consonants with vowels to ensure all consonants touch a vowel.

        Strategy: Place a vowel directly adjacent to each landlocked consonant
        by swapping the landlocked consonant with a nearby vowel.
        """
        max_fix_attempts = 50  # More attempts for complex boards
        for attempt in range(max_fix_attempts):
            landlocked = self._get_all_landlocked_consonants()
            if not landlocked:
                return  # All consonants now touch vowels!

            # Sort landlocked consonants - prioritize rare letters first
            landlocked.sort(key=lambda x: (x[2] not in self.RARE_LETTERS, random.random()))

            # For each landlocked consonant, find the best vowel to swap with
            for land_r, land_c, land_letter in landlocked:
                # Find all vowels and their distances to this landlocked consonant
                vowels_with_dist = []
                for r in range(self.size):
                    for c in range(self.size):
                        if self.grid[r][c] in self.VOWELS:
                            # Manhattan distance
                            dist = abs(r - land_r) + abs(c - land_c)
                            # Check if this vowel is adjacent (dist 1 means orthogonal, dist 2 could be diagonal or 2 steps)
                            is_adjacent = (abs(r - land_r) <= 1 and abs(c - land_c) <= 1 and dist > 0)
                            vowels_with_dist.append((r, c, dist, is_adjacent))

                if not vowels_with_dist:
                    continue

                # Sort by distance (prefer closer vowels)
                vowels_with_dist.sort(key=lambda x: (x[2], random.random()))

                # Try to find a vowel that when swapped will fix this consonant
                for vow_r, vow_c, dist, is_adjacent in vowels_with_dist:
                    if is_adjacent:
                        # This vowel is already adjacent - swapping would just move the problem
                        # Instead, we need to swap the landlocked consonant INTO the vowel position
                        # The vowel position is adjacent to other cells that might help

                        # Check what's adjacent to the vowel position
                        # If we put the consonant there, will it have a vowel neighbor?
                        would_have_vowel = False
                        for dr in [-1, 0, 1]:
                            for dc in [-1, 0, 1]:
                                if dr == 0 and dc == 0:
                                    continue
                                nr, nc = vow_r + dr, vow_c + dc
                                if 0 <= nr < self.size and 0 <= nc < self.size:
                                    if (nr, nc) != (land_r, land_c):  # Not the cell we're swapping from
                                        if self.grid[nr][nc] in self.VOWELS:
                                            would_have_vowel = True
                                            break
                        if would_have_vowel:
                            # Good swap - the consonant will have a vowel neighbor
                            self.grid[land_r][land_c], self.grid[vow_r][vow_c] = \
                                self.grid[vow_r][vow_c], self.grid[land_r][land_c]
                            break
                    else:
                        # Vowel is not adjacent - swap and the vowel will now be adjacent
                        # to the consonant's old neighbors
                        self.grid[land_r][land_c], self.grid[vow_r][vow_c] = \
                            self.grid[vow_r][vow_c], self.grid[land_r][land_c]
                        break
                else:
                    # No good swap found, just swap with closest vowel
                    if vowels_with_dist:
                        vow_r, vow_c, _, _ = vowels_with_dist[0]
                        self.grid[land_r][land_c], self.grid[vow_r][vow_c] = \
                            self.grid[vow_r][vow_c], self.grid[land_r][land_c]

                # After one swap, recheck all landlocked
                break

    def generate(self) -> None:
        """Generates a random board grid using official Boggle dice.

        Ensures ALL consonants can reach vowels by:
        1. Trying multiple random generations
        2. Fixing any landlocked consonants by swapping with vowels
        3. Ensuring all Q's touch at least one U (for QU words)
        """
        # Select the appropriate dice set based on board size
        if self.size == 4:
            dice = list(self.DICE_4X4)
        elif self.size == 5:
            dice = list(self.DICE_5X5)
        else:
            dice = list(self.DICE_6X6)

        max_attempts = 30  # More attempts for stricter requirements
        for attempt in range(max_attempts):
            random.shuffle(dice)
            letters = [random.choice(d) for d in dice]
            self.grid = [
                letters[i * self.size : (i + 1) * self.size]
                for i in range(self.size)
            ]

            if self._is_board_quality_acceptable():
                # Also check Q-U adjacency before accepting
                if not self._find_qs_without_u():
                    return  # Good board found with Q's touching U's

        # If we couldn't find a perfect board, fix it by swapping
        # This ensures ALL consonants touch at least one vowel
        self._fix_landlocked_consonants()

        # Ensure all Q's touch at least one U (essential for QU words)
        self._fix_q_without_u()

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


