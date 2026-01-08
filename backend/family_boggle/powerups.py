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
        # lobby_id -> { player_id -> saved_board } - players with lock armed
        self.armed_locks: Dict[str, Dict[str, List[List[str]]]] = {}
        # lobby_id -> { player_id -> board } - per-player board views (for lock protection)
        self.player_boards: Dict[str, Dict[str, List[List[str]]]] = {}

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

    def arm_lock(self, lobby_id: str, player_id: str, current_board: List[List[str]]) -> bool:
        """Arms a lock powerup for a player, saving their current board state.

        Args:
            lobby_id: The lobby ID.
            player_id: The player arming the lock.
            current_board: The current board state to save.

        Returns:
            True if lock was armed successfully.
        """
        if lobby_id not in self.armed_locks:
            self.armed_locks[lobby_id] = {}
        # Deep copy the board to preserve it
        self.armed_locks[lobby_id][player_id] = [row[:] for row in current_board]
        return True

    def has_armed_lock(self, lobby_id: str, player_id: str) -> bool:
        """Checks if a player has an armed lock."""
        return (lobby_id in self.armed_locks and
                player_id in self.armed_locks[lobby_id])

    def get_locked_players(self, lobby_id: str) -> Dict[str, List[List[str]]]:
        """Returns dict of player_id -> saved_board for all locked players."""
        return self.armed_locks.get(lobby_id, {})

    def consume_locks(self, lobby_id: str) -> Dict[str, List[List[str]]]:
        """Consumes all armed locks in a lobby.

        Returns:
            Dict mapping protected player IDs to their saved boards.
        """
        if lobby_id not in self.armed_locks:
            return {}

        # Move armed locks to player_boards so they're used for word validation
        protected_players = self.armed_locks[lobby_id].copy()

        # Store the protected boards for word validation
        if lobby_id not in self.player_boards:
            self.player_boards[lobby_id] = {}

        for player_id, saved_board in protected_players.items():
            self.player_boards[lobby_id][player_id] = saved_board

        # Clear the armed locks
        self.armed_locks[lobby_id] = {}

        return protected_players

    def get_player_board(self, lobby_id: str, player_id: str, default_board: List[List[str]]) -> List[List[str]]:
        """Gets a player's current board view.

        If the player has a protected board (from lock), returns that.
        Otherwise returns the default lobby board.
        """
        if lobby_id in self.player_boards and player_id in self.player_boards[lobby_id]:
            return self.player_boards[lobby_id][player_id]
        return default_board

    def sync_player_to_lobby_board(self, lobby_id: str, player_id: str) -> None:
        """Syncs a player back to the lobby's main board (clears their protected board)."""
        if lobby_id in self.player_boards and player_id in self.player_boards[lobby_id]:
            del self.player_boards[lobby_id][player_id]

    def clear_lobby(self, lobby_id: str) -> None:
        """Clears all powerup state for a lobby."""
        self.active_freezes.pop(lobby_id, None)
        self.blocked_cells.pop(lobby_id, None)
        self.block_end_time.pop(lobby_id, None)
        self.armed_locks.pop(lobby_id, None)
        self.player_boards.pop(lobby_id, None)

powerup_manager = PowerUpManager()


