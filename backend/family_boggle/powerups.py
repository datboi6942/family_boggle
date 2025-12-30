import random
from typing import Dict, List, Set, Tuple

class PowerUpManager:
    """Manages the logic and state for game power-ups."""
    
    def __init__(self) -> None:
        """Initializes the power-up manager."""
        # lobby_id -> { player_id -> freeze_end_time }
        self.active_freezes: Dict[str, Dict[str, float]] = {}
        # lobby_id -> blocked_cells: Set[(row, col)]
        self.blocked_cells: Dict[str, Set[Tuple[int, int]]] = {}
        # lobby_id -> block_end_time
        self.block_end_time: Dict[str, float] = {}

    def apply_powerup(self, lobby_id: str, player_id: str, powerup: str, players: List[any]) -> dict:
        """Applies a power-up effect.
        
        Args:
            lobby_id: The lobby ID.
            player_id: The player using the power-up.
            powerup: The type of power-up ('freeze', 'blowup', 'shuffle').
            players: List of players in the lobby.
            
        Returns:
            A dictionary describing the effect to broadcast.
        """
        import time
        now = time.time()
        
        effect = {"type": powerup, "by": player_id}
        
        if powerup == "freeze":
            # Pause timer for this player (implemented in game loop by checking this)
            if lobby_id not in self.active_freezes:
                self.active_freezes[lobby_id] = {}
            self.active_freezes[lobby_id][player_id] = now + 10.0
            
        elif powerup == "blowup":
            # Block 4 random letters for OTHERS
            size = 6 # Default, should ideally pass current board size
            cells = set()
            while len(cells) < 4:
                r, c = random.randint(0, size-1), random.randint(0, size-1)
                cells.add((r, c))
            
            self.blocked_cells[lobby_id] = cells
            self.block_end_time[lobby_id] = now + 8.0
            effect["blocked_cells"] = list(cells)
            
        elif powerup == "shuffle":
            # Logic handled in game_engine to regenerate board
            effect["action"] = "reshuffle"
            
        return effect

    def is_frozen(self, lobby_id: str, player_id: str) -> bool:
        """Checks if a player is currently frozen."""
        import time
        now = time.time()
        if lobby_id in self.active_freezes and player_id in self.active_freezes[lobby_id]:
            if now < self.active_freezes[lobby_id][player_id]:
                return True
        return False

    def get_blocked_cells(self, lobby_id: str) -> Set[Tuple[int, int]]:
        """Returns the currently blocked cells if any."""
        import time
        now = time.time()
        if lobby_id in self.block_end_time and now < self.block_end_time[lobby_id]:
            return self.blocked_cells.get(lobby_id, set())
        return set()

powerup_manager = PowerUpManager()


