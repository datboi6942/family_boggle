from typing import Dict, List

# Tiered scoring based on letter difficulty in sentences
LETTER_SCORES: Dict[str, int] = {
    'A': 1, 'E': 1, 'I': 1, 'O': 1, 'N': 1, 'R': 1, 'T': 1, 'L': 1, 'S': 1,
    'D': 2, 'G': 2, 'U': 2, 'C': 2, 'M': 2, 'P': 2, 'B': 2,
    'H': 3, 'F': 3, 'W': 3, 'Y': 3, 'V': 3, 'K': 3,
    'J': 5, 'X': 5,
    'Q': 8, 'Z': 8
}

def calculate_word_score(word: str, is_unique: bool = False) -> int:
    """Calculates the score for a single word.
    
    Args:
        word: The word to score.
        is_unique: Whether the word was found by only one player.
        
    Returns:
        The total score for the word.
    """
    word = word.upper()
    base_score = sum(LETTER_SCORES.get(char, 0) for char in word)
    
    # Word length multipliers
    length = len(word)
    if length < 3:
        multiplier = 0.0
    elif length == 3:
        multiplier = 1.0
    elif length == 4:
        multiplier = 1.2
    elif length == 5:
        multiplier = 1.5
    elif length == 6:
        multiplier = 2.0
    else:  # 7+ letters
        multiplier = 3.0
        
    total_score = int(base_score * multiplier)
    
    # Unique word bonus: +50%
    if is_unique and total_score > 0:
        total_score = int(total_score * 1.5)
        
    return total_score
