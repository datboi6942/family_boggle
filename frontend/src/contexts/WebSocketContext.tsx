import { createContext, useContext, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useGameStore } from '../stores/gameStore';

interface WebSocketContextType {
  send: (type: string, data?: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType>({ send: () => {} });

export const useWebSocketContext = () => useContext(WebSocketContext);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectAttempted = useRef(false);
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
    
    // Don't reconnect if already connected
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;
    
    // Close any existing connection
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    // Connect directly to backend on port 2626
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = `${window.location.hostname}:2626`;
    const url = `${protocol}//${host}/ws/${lobbyId}/${playerId}?username=${encodeURIComponent(username)}&character=${encodeURIComponent(character)}&mode=${mode || 'join'}`;

    console.log('Connecting to WebSocket:', url);
    const socket = new WebSocket(url);

    socket.onopen = () => {
      console.log('WebSocket connected');
    };

    socket.onmessage = (event) => {
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
      socketRef.current = null;
      if (event.code === 1008) {
        alert(event.reason || 'Could not join lobby');
        resetSession();
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socketRef.current = socket;
  }, [lobbyId, playerId, username, character, mode, status, updateFromLobby, updateFromGameState, setWordResult, setGameEnd, setPowerup, setStatus, resetSession]);

  // Connect when transitioning from 'join' to 'lobby', or reconnect on page refresh
  useEffect(() => {
    // Reconnect if we have session data but no active connection (e.g., after page refresh)
    if (!reconnectAttempted.current && lobbyId && playerId && status !== 'join' && !socketRef.current) {
      reconnectAttempted.current = true;
      console.log('Attempting to reconnect to existing session...');
      connect();
    }
    // Normal connect when transitioning to lobby
    if (status === 'lobby' && lobbyId && playerId && !socketRef.current) {
      connect();
    }
  }, [status, lobbyId, playerId, connect]);

  // Disconnect when returning to join screen or clearing session
  useEffect(() => {
    if ((status === 'join' || !lobbyId || !playerId) && socketRef.current) {
      console.log('Disconnecting WebSocket...');
      socketRef.current.close();
      socketRef.current = null;
    }
  }, [status, lobbyId, playerId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
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


