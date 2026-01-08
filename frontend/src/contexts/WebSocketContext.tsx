import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useGameStore } from '../stores/gameStore';

interface WebSocketContextType {
  send: (type: string, data?: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({ send: () => {} });

export const useWebSocketContext = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const socketRef = useRef<WebSocket | null>(null);
  const isConnectingRef = useRef(false); // Prevent concurrent connection attempts
  const connectionIdRef = useRef(0); // Track connection attempts to cancel stale ones
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;
  const {
    lobbyId,
    playerId,
    username,
    character,
    mode,
    status,
    updateFromLobby,
    updateFromGameState,
    setWordResult,
    setGameEnd,
    setPowerup,
    setWaitingPhase,
    setPlayerTimeUp,
    updateBonusTimer,
    setPlayAgainUpdate,
    setStatus,
    resetSession
  } = useGameStore();

  const connect = useCallback(() => {
    // CRITICAL: Validate ALL required fields before attempting connection
    if (!lobbyId || !playerId || !username || !character || status === 'join') {
      console.log('WebSocket connection skipped - missing required fields:', {
        lobbyId: !!lobbyId,
        playerId: !!playerId,
        username: !!username,
        character: !!character,
        status
      });
      return;
    }

    // Don't reconnect if already connected or connecting
    if (socketRef.current) {
      const state = socketRef.current.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        console.log('WebSocket already connected or connecting, skipping');
        return;
      }
    }

    // Prevent concurrent connection attempts
    if (isConnectingRef.current) {
      console.log('Connection already in progress, skipping');
      return;
    }

    isConnectingRef.current = true;
    const thisConnectionId = ++connectionIdRef.current;

    // Close any existing connection cleanly
    if (socketRef.current) {
      try {
        socketRef.current.close(1000, 'Reconnecting');
      } catch {
        // Ignore close errors
      }
      socketRef.current = null;
    }

    // Connect through nginx proxy (same host and port as frontend)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // Includes port if non-standard
    const url = `${protocol}//${host}/ws/${lobbyId}/${playerId}?username=${encodeURIComponent(username)}&character=${encodeURIComponent(character)}&mode=${mode || 'join'}`;

    console.log('Connecting to WebSocket:', url);
    const socket = new WebSocket(url);

    socket.onopen = () => {
      // Check if this connection is still current
      if (thisConnectionId !== connectionIdRef.current) {
        console.log('Stale connection opened, closing');
        socket.close();
        return;
      }
      console.log('WebSocket connected successfully');
      isConnectingRef.current = false;
      retryCountRef.current = 0; // Reset retry count on successful connection

      // Clear any pending retry attempts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };

    socket.onmessage = (event) => {
      // Ignore messages from stale connections
      if (thisConnectionId !== connectionIdRef.current) return;

      const message = JSON.parse(event.data);
      console.log('Received:', message);

      switch (message.type) {
        case 'lobby_update':
          updateFromLobby(message.data);
          break;
        case 'game_state':
          updateFromGameState(message.data);
          break;
        case 'timer_update':
          useGameStore.getState().setTimer(message.data.timer);
          break;
        case 'word_result':
          setWordResult(message.data);
          break;
        case 'game_end':
          setGameEnd(message.data);
          break;
        case 'powerup_event':
          setPowerup(message.data, playerId || undefined);
          break;
        case 'powerup_consumed':
          // Update the player's powerups after one was used
          useGameStore.getState().updatePlayerPowerups(
            message.data.player_id,
            message.data.powerups
          );
          break;
        case 'board_update': {
          // Handle shuffle with lock protection
          const store = useGameStore.getState();
          const currentPlayerId = store.playerId; // Get fresh playerId from store
          const protectedPlayers = message.data.protected_players || [];
          const isProtected = currentPlayerId && protectedPlayers.includes(currentPlayerId);

          if (isProtected && message.data.old_board) {
            // Player was protected by lock - restore their old board
            store.setBoard(message.data.old_board);
            // Clear lock armed state and trigger lock consumed animation
            useGameStore.setState({ isLockArmed: false, lockJustConsumed: true });
            // Clear the consumed flag after animation
            setTimeout(() => {
              useGameStore.setState({ lockJustConsumed: false });
            }, 2000);
          } else {
            // Normal shuffle - use new board
            store.setBoard(message.data.board);
          }
          break;
        }
        case 'error':
          console.error('Server error:', message.data);
          alert(message.data.message || 'Error connecting to lobby');
          resetSession();
          break;
        case 'score_update':
          // Update the player's score and add powerup to their inventory
          useGameStore.getState().updatePlayerScore(
            message.data.player_id,
            message.data.score,
            message.data.powerup
          );
          break;
        case 'waiting_phase':
          // Transition to waiting phase when main timer ends
          setWaitingPhase(message.data, playerId || undefined);
          break;
        case 'player_time_up':
          // A specific player's time (including bonus) has run out
          setPlayerTimeUp(message.data.player_id, playerId || undefined);
          break;
        case 'bonus_timer_update':
          // Update bonus time for players still playing
          updateBonusTimer(message.data, playerId || undefined);
          break;
        case 'play_again_update':
          // Update which players want to play again
          setPlayAgainUpdate(message.data);
          break;
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket disconnected', event.code, event.reason);
      isConnectingRef.current = false;

      // Only clear ref if this is the current connection
      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      // Don't retry if this is an intentional close or policy violation
      if (event.code === 1000 || event.code === 1008) {
        if (event.code === 1008) {
          alert(event.reason || 'Could not join lobby');
          resetSession();
        }
        return;
      }

      // Retry with exponential backoff for unexpected disconnections
      if (retryCountRef.current < maxRetries && thisConnectionId === connectionIdRef.current) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 5000);
        console.log(`WebSocket disconnected, retrying in ${retryDelay}ms (attempt ${retryCountRef.current + 1}/${maxRetries})`);
        retryCountRef.current++;

        retryTimeoutRef.current = setTimeout(() => {
          if (thisConnectionId === connectionIdRef.current) {
            connect();
          }
        }, retryDelay);
      } else if (retryCountRef.current >= maxRetries) {
        console.error('Max WebSocket retry attempts reached');
        alert('Unable to connect to game server. Please try again.');
        resetSession();
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      isConnectingRef.current = false;
    };

    socketRef.current = socket;
  }, [lobbyId, playerId, username, character, mode, status, updateFromLobby, updateFromGameState, setWordResult, setGameEnd, setPowerup, setWaitingPhase, setPlayerTimeUp, updateBonusTimer, setPlayAgainUpdate, setStatus, resetSession]);

  // Single unified effect for connection management
  useEffect(() => {
    // Should we be connected?
    const shouldConnect = lobbyId && playerId && username && character && status !== 'join';

    if (shouldConnect) {
      // Add a small delay to ensure state is fully hydrated (fixes iOS race condition)
      const connectTimer = setTimeout(() => {
        // Revalidate all required fields after delay
        const store = useGameStore.getState();
        if (store.lobbyId && store.playerId && store.username && store.character && store.status !== 'join') {
          // Need a connection
          if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
            connect();
          }
        } else {
          console.log('Connection delayed - still waiting for complete state hydration');
        }
      }, 100); // 100ms delay to ensure state persistence completes

      return () => clearTimeout(connectTimer);
    } else {
      // Should disconnect
      if (socketRef.current) {
        console.log('Disconnecting WebSocket (status changed to join or no lobby)');
        connectionIdRef.current++; // Invalidate any pending connection

        // Clear any pending retry attempts
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = null;
        }
        retryCountRef.current = 0;

        try {
          socketRef.current.close(1000, 'Session ended');
        } catch {
          // Ignore close errors
        }
        socketRef.current = null;
        isConnectingRef.current = false;
      }
    }
  }, [status, lobbyId, playerId, username, character, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectionIdRef.current++; // Invalidate any pending connection

      // Clear any pending retry attempts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (socketRef.current) {
        try {
          socketRef.current.close(1000, 'Component unmounted');
        } catch {
          // Ignore close errors
        }
        socketRef.current = null;
      }
    };
  }, []);

  const send = useCallback((type: string, data: any = {}) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, data }));
    } else {
      console.warn('WebSocket not connected, cannot send:', type);
    }
  }, []);

  return (
    <WebSocketContext.Provider value={{ send }}>
      {children}
    </WebSocketContext.Provider>
  );
};


