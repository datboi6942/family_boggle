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
    setStatus,
    resetSession
  } = useGameStore();

  const connect = useCallback(() => {
    // Only connect when we have lobby info and we're past the join screen
    if (!lobbyId || !playerId || status === 'join') return;

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

    // Connect directly to backend on port 2626
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = `${window.location.hostname}:2626`;
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
      console.log('WebSocket connected');
      isConnectingRef.current = false;
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
        case 'board_update':
          // Update just the board (for shuffle)
          useGameStore.getState().setBoard(message.data.board);
          break;
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
      }
    };

    socket.onclose = (event) => {
      console.log('WebSocket disconnected', event.code, event.reason);
      isConnectingRef.current = false;

      // Only clear ref if this is the current connection
      if (socketRef.current === socket) {
        socketRef.current = null;
      }

      if (event.code === 1008) {
        alert(event.reason || 'Could not join lobby');
        resetSession();
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      isConnectingRef.current = false;
    };

    socketRef.current = socket;
  }, [lobbyId, playerId, username, character, mode, status, updateFromLobby, updateFromGameState, setWordResult, setGameEnd, setPowerup, setStatus, resetSession]);

  // Single unified effect for connection management
  useEffect(() => {
    // Should we be connected?
    const shouldConnect = lobbyId && playerId && status !== 'join';

    if (shouldConnect) {
      // Need a connection
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        connect();
      }
    } else {
      // Should disconnect
      if (socketRef.current) {
        console.log('Disconnecting WebSocket (status changed to join or no lobby)');
        connectionIdRef.current++; // Invalidate any pending connection
        try {
          socketRef.current.close(1000, 'Session ended');
        } catch {
          // Ignore close errors
        }
        socketRef.current = null;
        isConnectingRef.current = false;
      }
    }
  }, [status, lobbyId, playerId, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      connectionIdRef.current++; // Invalidate any pending connection
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


