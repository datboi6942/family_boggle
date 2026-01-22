import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const API_BASE = '/api';

interface Player {
  id: string;
  username: string;
  character: string;
  is_ready: boolean;
  score: number;
  powerups: string[];
  team_id?: string;
  found_words: string[];
}

interface User {
  id: number;
  username: string;
  email?: string;
  created_at?: string;
  last_login?: string;
  stats?: {
    total_games_played: number;
    total_score: number;
    best_score: number;
    total_wins: number;
    total_challenges_completed: number;
    win_rate: number;
    avg_score: number;
  };
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
  gameMode: string;
  modeSettings: Record<string, unknown>;
  targetWords: string[];
  timer: number;
  bonusTime: number;  // Per-player bonus time from freeze powerup
  isTimeUp: boolean;  // Whether current player's time has run out
  players: Player[];
  hostId: string | null;
  authToken: string | null;
  user: User | null;
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
  frozenTimerValue: number | null;  // Timer value when freeze started (display this while frozen)
  isLockArmed: boolean;  // Whether this player has an armed lock
  lockJustConsumed: boolean;  // True briefly when lock blocks a shuffle (for animation)
  playersStillPlaying: string[];  // Player IDs still playing during waiting phase
  playersWantingPlayAgain: string[];  // Player IDs who clicked "Play Again"
  setTimer: (timer: number) => void;
  setBonusTime: (time: number) => void;
  updatePlayerScore: (playerId: string, score: number, powerup?: string) => void;
  updatePlayerPowerups: (playerId: string, powerups: string[]) => void;
  setBoard: (board: string[][]) => void;
  addBonusTime: (seconds: number) => void;

  // Authentication Actions
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  register: (username: string, password: string, email?: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  getProfile: () => Promise<{ success: boolean; user?: User; message?: string }>;
  getStats: () => Promise<{ success: boolean; stats?: User['stats']; message?: string }>;
  linkIpAccount: () => Promise<{ success: boolean; message: string }>;

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
  setPlayAgainUpdate: (data: any) => void;
  resetSession: () => void;
}

// Store timeout IDs for cleanup
let wordResultTimeout: ReturnType<typeof setTimeout> | null = null;
let freezeTimeout: ReturnType<typeof setTimeout> | null = null;
let blockedTimeout: ReturnType<typeof setTimeout> | null = null;

export const useGameStore = create<GameState>()(
  persist<GameState, [], [], PersistedState>(
    (set, get) => ({
  lobbyId: null,
  playerId: null,
  username: '',
  character: 'Blobby',
  mode: null,
  status: 'join',
  board: [],
  boardSize: 6,
  gameMode: 'classic',
  modeSettings: {},
  targetWords: [],
  timer: 0,
  bonusTime: 0,
  isTimeUp: false,
  players: [],
  hostId: null,
  authToken: null,
  user: null,
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
  frozenTimerValue: null,
  isLockArmed: false,
  lockJustConsumed: false,
  playersStillPlaying: [],
  playersWantingPlayAgain: [],

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

  // Authentication Actions
  login: async (username, password) => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (response.ok) {
        set({ authToken: data.access_token, user: data.user });
        return { success: true, message: data.message || 'Login successful' };
      } else {
        return { success: false, message: data.detail || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error' };
    }
  },
  register: async (username, password, email) => {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, email }),
      });
      const data = await response.json();
      if (response.ok) {
        set({ authToken: data.access_token, user: data.user });
        return { success: true, message: data.message || 'Registration successful' };
      } else {
        return { success: false, message: data.detail || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Network error' };
    }
  },
  logout: () => set({ authToken: null, user: null }),
  getProfile: async () => {
    const state = get();
    if (!state.authToken) {
      return { success: false, message: 'Not authenticated' };
    }
    try {
      const response = await fetch(`${API_BASE}/auth/profile`, {
        headers: { Authorization: `Bearer ${state.authToken}` },
      });
      const data = await response.json();
      if (response.ok) {
        set({ user: data });
        return { success: true, user: data };
      } else {
        return { success: false, message: data.detail || 'Failed to fetch profile' };
      }
    } catch (error) {
      console.error('Get profile error:', error);
      return { success: false, message: 'Network error' };
    }
  },
  getStats: async () => {
    const state = get();
    if (!state.authToken) {
      return { success: false, message: 'Not authenticated' };
    }
    try {
      const response = await fetch(`${API_BASE}/auth/stats`, {
        headers: { Authorization: `Bearer ${state.authToken}` },
      });
      const data = await response.json();
      if (response.ok) {
        // Update user stats in store
        if (state.user) {
          set({ user: { ...state.user, stats: data } });
        }
        return { success: true, stats: data };
      } else {
        return { success: false, message: data.detail || 'Failed to fetch stats' };
      }
    } catch (error) {
      console.error('Get stats error:', error);
      return { success: false, message: 'Network error' };
    }
  },
  linkIpAccount: async () => {
    const state = get();
    if (!state.authToken) {
      return { success: false, message: 'Not authenticated' };
    }
    try {
      const response = await fetch(`${API_BASE}/auth/link-ip`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.authToken}` },
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true, message: data.message || 'Account linked successfully' };
      } else {
        return { success: false, message: data.detail || 'Failed to link account' };
      }
    } catch (error) {
      console.error('Link IP account error:', error);
      return { success: false, message: 'Network error' };
    }
  },

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
    gameMode: data.game_mode || data.gameMode || 'classic',
    modeSettings: data.mode_settings || data.modeSettings || {},
    targetWords: data.target_words || data.targetWords || [],
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
    frozenTimerValue: null,
    isLockArmed: false,
    lockJustConsumed: false,
    playersWantingPlayAgain: [],
  }),
  updateFromGameState: (data) => set({
    status: data.status,
    board: data.board,
    timer: data.timer,
    players: data.players,
    boardSize: data.board_size || data.boardSize || 6,
    gameMode: data.game_mode || data.gameMode || 'classic',
    modeSettings: data.mode_settings || data.modeSettings || {},
    targetWords: data.target_words || data.targetWords || [],
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
    console.log('setPowerup called', { data, myPlayerId });
    if (data.type === 'freeze') {
      // Only the player who used freeze gets the freeze effect
       // Don't apply freeze if game is already over (waiting/summary status or isTimeUp)
        const freezePlayerId = data.player_id || data.by;
        console.log('Freeze powerup received', { player_id: data.player_id, by: data.by, freezePlayerId, myPlayerId });
        if (freezePlayerId === myPlayerId) {
        if (freezeTimeout) clearTimeout(freezeTimeout);
         set((state) => {
           // Ignore freeze if player's time is already up or game is ending
           if (state.isTimeUp || state.status === 'waiting' || state.status === 'summary') {
             console.log('Freeze ignored - game already ending', state);
             return state; // No changes
           }
            // Add bonus time from freeze (extends game time after main timer ends)
            const bonusSeconds = data.bonus_seconds || 10;
            const newBonusTime = data.bonus_time !== undefined ? data.bonus_time : state.bonusTime + bonusSeconds;
            console.log('Applying freeze', { bonusSeconds, newBonusTime, currentTimer: state.timer, currentBonusTime: state.bonusTime });
            return {
              isFrozen: true,
              frozenTimerValue: state.timer,  // Capture current timer to display while frozen
              bonusTime: newBonusTime,  // Use backend-provided bonus time or accumulate
            };
         });
         // After 10 seconds, unfreeze and clear the frozen timer value
        freezeTimeout = setTimeout(() => set({ isFrozen: false, frozenTimerValue: null }), 10000);
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
  setPlayAgainUpdate: (data: any) => {
    set({ playersWantingPlayAgain: data.players_ready || [] });
  },
  resetSession: () => {
    // Clear any pending timeouts to prevent memory leaks
    if (wordResultTimeout) {
      clearTimeout(wordResultTimeout);
      wordResultTimeout = null;
    }
    if (freezeTimeout) {
      clearTimeout(freezeTimeout);
      freezeTimeout = null;
    }
    if (blockedTimeout) {
      clearTimeout(blockedTimeout);
      blockedTimeout = null;
    }
    
    return set({
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
      frozenTimerValue: null,
      isLockArmed: false,
      lockJustConsumed: false,
      playersStillPlaying: [],
      playersWantingPlayAgain: [],
    });
  },
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
        gameMode: state.gameMode,
        modeSettings: state.modeSettings,
        targetWords: state.targetWords,
        timer: state.timer,
        bonusTime: state.bonusTime,
        isTimeUp: state.isTimeUp,
        players: state.players,
        hostId: state.hostId,
        authToken: state.authToken,
        user: state.user,
      }),
    }
  )
);


