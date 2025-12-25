import os
import urllib.request
from pathlib import Path
from typing import Set
import structlog

logger = structlog.get_logger()

# TWL (Tournament Word List) source - commonly used Scrabble dictionary
WORD_LIST_URL = "https://raw.githubusercontent.com/redbo/scrabble/master/dictionary.txt"
WORD_LIST_PATH = Path(__file__).parent / "words.txt"


class DictionaryValidator:
    """Validates if a word exists in the Scrabble/Boggle dictionary."""
    
    def __init__(self) -> None:
        """Initializes the dictionary. Downloads word list if necessary."""
        self._word_set: Set[str] = set()
        self._load_dictionary()

    def _load_dictionary(self) -> None:
        """Loads the dictionary from file, downloading if necessary."""
        if not WORD_LIST_PATH.exists():
            self._download_dictionary()
        
        try:
            with open(WORD_LIST_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    word = line.strip().upper()
                    # Only include words 3-15 letters (Boggle-appropriate)
                    if 3 <= len(word) <= 15 and word.isalpha():
                        self._word_set.add(word)
            logger.info("dictionary_loaded", word_count=len(self._word_set))
        except Exception as e:
            logger.error("dictionary_load_error", error=str(e))
            # Fallback to a minimal set of common words
            self._word_set = self._get_fallback_words()
    
    def _download_dictionary(self) -> None:
        """Downloads the word list from the internet."""
        try:
            logger.info("downloading_dictionary", url=WORD_LIST_URL)
            urllib.request.urlretrieve(WORD_LIST_URL, WORD_LIST_PATH)
            logger.info("dictionary_downloaded", path=str(WORD_LIST_PATH))
        except Exception as e:
            logger.error("dictionary_download_error", error=str(e))
            # Create fallback file
            with open(WORD_LIST_PATH, "w", encoding="utf-8") as f:
                f.write("\n".join(self._get_fallback_words()))
    
    def _get_fallback_words(self) -> Set[str]:
        """Returns a minimal set of common words as fallback."""
        return {
            "THE", "AND", "FOR", "ARE", "BUT", "NOT", "YOU", "ALL", "CAN",
            "HAD", "HER", "WAS", "ONE", "OUR", "OUT", "DAY", "GET", "HAS",
            "HIM", "HIS", "HOW", "MAN", "NEW", "NOW", "OLD", "SEE", "WAY",
            "WHO", "BOY", "DID", "ITS", "LET", "PUT", "SAY", "SHE", "TOO",
            "USE", "CAT", "DOG", "RUN", "SIT", "TOP", "BAT", "BIG", "BOX",
            "CAR", "CUT", "EAT", "FUN", "GOT", "HIT", "JOB", "KEY", "LAP",
            "MAP", "NET", "PAN", "RAT", "SET", "TAN", "VAN", "WET", "YES",
            "ZAP", "ACE", "ADD", "AGE", "AID", "AIM", "AIR", "APE", "ARC",
            "ARM", "ART", "ASK", "ATE", "BAD", "BAG", "BAN", "BAR", "BED",
            "BET", "BIT", "BOW", "BUD", "BUG", "BUS", "BUY", "CAB", "CAP",
            "GAME", "PLAY", "WORD", "TIME", "LIKE", "JUST", "KNOW", "TAKE",
            "COME", "MAKE", "GOOD", "LOOK", "WILL", "BACK", "MUCH", "ONLY",
            "YEAR", "LAST", "OVER", "SUCH", "THEM", "THEN", "THAN", "SOME",
            "WELL", "ALSO", "PART", "EVEN", "MOST", "CASE", "WEEK", "EACH",
            "GIVE", "CALL", "FEEL", "SEEM", "WANT", "TELL", "FIND", "HEAD",
            "HAND", "LIFE", "LONG", "AWAY", "SIDE", "BOTH", "DOWN", "HIGH",
        }

    def is_valid_word(self, word: str) -> bool:
        """Checks if a word is in the dictionary.
        
        Args:
            word: The word to check.
            
        Returns:
            True if the word is valid and at least 3 letters long.
        """
        word = word.upper()
        return len(word) >= 3 and word in self._word_set
