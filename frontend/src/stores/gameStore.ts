import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Player {
  id: string;
  username: string;
  character: string;
  is_ready: boolean;
  score: number;
  powerups: string[];
}

// State that gets persisted to sessionStorage
interface PersistedState {
  lobbyId: string | null;
  playerId: string | null;
  username: string;
  character: string;
  mode: 'create' | 'join' | null;
  status: 'join' | 'lobby' | 'countdown' | 'playing' | 'summary';
  board: string[][];
  boardSize: number;
  timer: number;
  players: Player[];
  hostId: string | null;
}

interface GameState extends PersistedState {
  // Transient state (not persisted)
  lastWordResult: { valid: boolean; points?: number; powerup?: string; reason?: string } | null;
  winner: any | null;
  results: any[] | null;
  blockedCells: [number, number][];
  isFrozen: boolean;

  // Actions
  setLobbyId: (id: string) => void;
  setPlayerId: (id: string) => void;
  setUsername: (name: string) => void;
  setCharacter: (char: string) => void;
  setMode: (mode: 'create' | 'join') => void;
  setStatus: (status: PersistedState['status']) => void;
  updateFromLobby: (data: any) => void;
  updateFromGameState: (data: any) => void;
  setWordResult: (result: any) => void;
  setGameEnd: (data: any) => void;
  setPowerup: (data: any) => void;
  resetSession: () => void;
}

export const useGameStore = create<GameState>()(
  persist<GameState, [], [], PersistedState>(
    (set) => ({
  lobbyId: null,
  playerId: null,
  username: '',
  character: 'Blobby',
  mode: null,
  status: 'join',
  board: [],
  boardSize: 6,
  timer: 0,
  players: [],
  hostId: null,
  lastWordResult: null,
  winner: null,
  results: null,
  blockedCells: [],
  isFrozen: false,

  setLobbyId: (id) => set({ lobbyId: id }),
  setPlayerId: (id) => set({ playerId: id }),
  setUsername: (name) => set({ username: name }),
  setCharacter: (char) => set({ character: char }),
  setMode: (mode) => set({ mode }),
  setStatus: (status) => set({ status }),
  updateFromLobby: (data) => set({
    lobbyId: data.lobby_id || data.lobbyId || null,
    players: data.players || [],
    hostId: data.host_id || data.hostId || null,
    boardSize: data.board_size || data.boardSize || 6,
    status: (data.status === 'lobby' ? 'lobby' : data.status) || 'lobby',
    // Clear game-specific state when returning to lobby
    board: data.board || [],
    results: null,
    winner: null,
    lastWordResult: null,
    blockedCells: [],
    isFrozen: false,
  }),
  updateFromGameState: (data) => set({
    status: data.status,
    board: data.board,
    timer: data.timer,
    players: data.players,
  }),
  setWordResult: (result) => {
    set({ lastWordResult: result });
    // Auto-clear the word result after 2 seconds
    setTimeout(() => set({ lastWordResult: null }), 2000);
  },
  setGameEnd: (data) => set({
    status: 'summary',
    results: data.results,
    winner: data.winner
  }),
  setPowerup: (data: any) => {
    if (data.type === 'freeze') {
      set({ isFrozen: true });
      setTimeout(() => set({ isFrozen: false }), 10000);
    } else if (data.type === 'blowup') {
      set({ blockedCells: data.blocked_cells });
      setTimeout(() => set({ blockedCells: [] }), 8000);
    }
  },
  resetSession: () => set({
    lobbyId: null,
    playerId: null,
    mode: null,
    status: 'join',
    board: [],
    timer: 0,
    players: [],
    hostId: null,
    lastWordResult: null,
    winner: null,
    results: null,
    blockedCells: [],
    isFrozen: false,
  }),
}),
    {
      name: 'boggle-session',
      storage: {
        getItem: (name) => {
          const value = sessionStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: (name, value) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => {
          sessionStorage.removeItem(name);
        },
      },
      // Only persist session-critical state, not transient UI state
      partialize: (state): PersistedState => ({
        lobbyId: state.lobbyId,
        playerId: state.playerId,
        username: state.username,
        character: state.character,
        mode: state.mode,
        status: state.status,
        board: state.board,
        boardSize: state.boardSize,
        timer: state.timer,
        players: state.players,
        hostId: state.hostId,
      }),
    }
  )
);
