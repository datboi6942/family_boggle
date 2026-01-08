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
  status: 'join' | 'lobby' | 'countdown' | 'playing' | 'waiting' | 'summary';
  board: string[][];
  boardSize: number;
  timer: number;
  bonusTime: number;  // Per-player bonus time from freeze powerup
  isTimeUp: boolean;  // Whether current player's time has run out
  players: Player[];
  hostId: string | null;
}

interface WordAward {
  word: string;
  points: number;
  is_unique: boolean;
  finders: {
    player_id: string;
    username: string;
    character: string;
  }[];
}

interface LongestWordFound {
  word: string;
  length: number;
  player_id: string;
  username: string;
  character: string;
}

interface ChallengeProgress {
  id: string;
  name: string;
  description: string;
  target: number;
  progress: number;
  ratio: number;
  completed: boolean;
  category: string;
  difficulty: string;
  points: number;
  points_earned: number;
}

interface ChallengeDefinition {
  id: string;
  name: string;
  description: string;
  target: number;
  category: string;
  difficulty: string;
  points: number;
}

interface PlayerResult {
  username: string;
  character: string;
  player_id: string;
  word_score: number;
  challenge_score: number;
  total_score: number;
  score: number; // Keep for backwards compatibility
  words: string[];
  best_challenge: ChallengeProgress | null;
  all_challenges: ChallengeProgress[];
  challenges_completed: number;
}

interface GameState extends PersistedState {
  // Transient state (not persisted)
  lastWordResult: { valid: boolean; points?: number; powerup?: string; reason?: string } | null;
  winner: PlayerResult | null;
  results: PlayerResult[] | null;
  wordAwards: WordAward[] | null;
  longestWordFound: LongestWordFound | null;
  longestPossibleWord: string | null;
  allPossibleWords: string[] | null;
  totalPossibleWords: number;
  challenges: ChallengeDefinition[];
  blockedCells: [number, number][];
  isFrozen: boolean;
  isLockArmed: boolean;  // Whether this player has an armed lock
  playersStillPlaying: string[];  // Player IDs still playing during waiting phase
  setTimer: (timer: number) => void;
  setBonusTime: (time: number) => void;
  updatePlayerScore: (playerId: string, score: number, powerup?: string) => void;
  updatePlayerPowerups: (playerId: string, powerups: string[]) => void;
  setBoard: (board: string[][]) => void;
  addBonusTime: (seconds: number) => void;

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
  setPowerup: (data: any, myPlayerId?: string) => void;
  setWaitingPhase: (data: any, myPlayerId?: string) => void;
  setPlayerTimeUp: (playerId: string, myPlayerId?: string) => void;
  updateBonusTimer: (data: any, myPlayerId?: string) => void;
  resetSession: () => void;
}

// Store timeout IDs for cleanup
let wordResultTimeout: ReturnType<typeof setTimeout> | null = null;
let freezeTimeout: ReturnType<typeof setTimeout> | null = null;
let blockedTimeout: ReturnType<typeof setTimeout> | null = null;

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
  bonusTime: 0,
  isTimeUp: false,
  players: [],
  hostId: null,
  lastWordResult: null,
  winner: null,
  results: null,
  wordAwards: null,
  longestWordFound: null,
  longestPossibleWord: null,
  allPossibleWords: null,
  totalPossibleWords: 0,
  challenges: [],
  blockedCells: [],
  isFrozen: false,
  isLockArmed: false,
  playersStillPlaying: [],

  setTimer: (timer) => set({ timer }),
  setBonusTime: (bonusTime) => set({ bonusTime }),

  updatePlayerScore: (targetPlayerId, score, powerup) => set((state) => ({
    players: state.players.map(p => {
      if (p.id === targetPlayerId) {
        const newPowerups = powerup ? [...p.powerups, powerup] : p.powerups;
        return { ...p, score, powerups: newPowerups };
      }
      return p;
    })
  })),

  updatePlayerPowerups: (targetPlayerId, powerups) => set((state) => ({
    players: state.players.map(p => 
      p.id === targetPlayerId ? { ...p, powerups } : p
    )
  })),

  setBoard: (board) => set({ board }),

  addBonusTime: (seconds) => set((state) => ({ timer: state.timer + seconds })),

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
    challenges: data.challenges || [],
    results: null,
    wordAwards: null,
    winner: null,
    lastWordResult: null,
    blockedCells: [],
    isFrozen: false,
    isLockArmed: false,
  }),
  updateFromGameState: (data) => set({
    status: data.status,
    board: data.board,
    timer: data.timer,
    players: data.players,
    challenges: data.challenges || [],
  }),
  setWordResult: (result) => {
    if (wordResultTimeout) clearTimeout(wordResultTimeout);
    set({ lastWordResult: result });
    // Auto-clear the word result after 2 seconds
    wordResultTimeout = setTimeout(() => set({ lastWordResult: null }), 2000);
  },
  setGameEnd: (data) => set({
    status: 'summary',
    results: data.results,
    winner: data.winner,
    wordAwards: data.word_awards,
    longestWordFound: data.longest_word_found || null,
    longestPossibleWord: data.longest_possible_word || null,
    allPossibleWords: data.all_possible_words || null,
    totalPossibleWords: data.total_possible_words || 0
  }),
  setPowerup: (data: any, myPlayerId?: string) => {
    if (data.type === 'freeze') {
      // Only the player who used freeze gets bonus time
      if (data.player_id === myPlayerId) {
        if (freezeTimeout) clearTimeout(freezeTimeout);
        set((state) => ({
          isFrozen: true,
          bonusTime: state.bonusTime + (data.bonus_time || 10)  // Add to personal bonus time
        }));
        freezeTimeout = setTimeout(() => set({ isFrozen: false }), 10000);
      }
    } else if (data.type === 'blowup') {
      // Blowup affects everyone EXCEPT the player who used it
      if (data.by !== myPlayerId) {
        if (blockedTimeout) clearTimeout(blockedTimeout);
        set({ blockedCells: data.blocked_cells });
        blockedTimeout = setTimeout(() => set({ blockedCells: [] }), 8000);
      }
    } else if (data.type === 'lock_armed') {
      // Track if this player armed a lock
      if (data.by === myPlayerId) {
        set({ isLockArmed: true });
      }
    }
  },
  setWaitingPhase: (data: any, myPlayerId?: string) => {
    const playersFinished = data.players_finished || [];
    const playersWithBonus = data.players_with_bonus || [];

    // If I'm in the finished list, enter waiting state
    if (playersFinished.includes(myPlayerId)) {
      set({
        status: 'waiting',
        isTimeUp: true,
        playersStillPlaying: playersWithBonus.map((p: any) => p.player_id)
      });
    }
  },
  setPlayerTimeUp: (playerId: string, myPlayerId?: string) => {
    // If my time is up, enter waiting state
    if (playerId === myPlayerId) {
      set({
        status: 'waiting',
        isTimeUp: true,
        bonusTime: 0
      });
    } else {
      // Remove this player from the still-playing list
      set((state) => ({
        playersStillPlaying: state.playersStillPlaying.filter(id => id !== playerId)
      }));
    }
  },
  updateBonusTimer: (data: any, myPlayerId?: string) => {
    const players = data.players || [];
    const myData = players.find((p: any) => p.player_id === myPlayerId);

    if (myData) {
      set({ bonusTime: myData.bonus_time });
    }

    // Update list of players still playing
    set({ playersStillPlaying: players.map((p: any) => p.player_id) });
  },
  resetSession: () => set({
    lobbyId: null,
    playerId: null,
    mode: null,
    status: 'join',
    board: [],
    timer: 0,
    bonusTime: 0,
    isTimeUp: false,
    players: [],
    hostId: null,
    lastWordResult: null,
    winner: null,
    results: null,
    wordAwards: null,
    longestWordFound: null,
    longestPossibleWord: null,
    allPossibleWords: null,
    totalPossibleWords: 0,
    challenges: [],
    blockedCells: [],
    isFrozen: false,
    isLockArmed: false,
    playersStillPlaying: [],
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
        bonusTime: state.bonusTime,
        isTimeUp: state.isTimeUp,
        players: state.players,
        hostId: state.hostId,
      }),
    }
  )
);


