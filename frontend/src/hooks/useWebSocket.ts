import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';

export const useWebSocket = (lobbyId: string | null, playerId: string | null) => {
  const socketRef = useRef<WebSocket | null>(null);
  const { username, character, mode, updateFromLobby, updateFromGameState, setWordResult, setGameEnd, setPowerup, setStatus } = useGameStore();

  const connect = useCallback(() => {
    if (!lobbyId || !playerId || socketRef.current) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use the actual hostname from the browser to connect to the backend
    const host = `${window.location.hostname}:2626`;
    const url = `${protocol}//${host}/ws/${lobbyId}/${playerId}?username=${encodeURIComponent(username)}&character=${encodeURIComponent(character)}&mode=${mode || 'join'}`;

    const socket = new WebSocket(url);

    socket.onopen = () => {
      console.log('Connected to WebSocket');
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
        case 'word_result':
          setWordResult(message.data);
          break;
        case 'game_end':
          setGameEnd(message.data);
          break;
        case 'powerup_event':
          setPowerup(message.data);
          break;
        case 'error':
          console.error('Server error:', message.data);
          alert(message.data.message || 'Error connecting to lobby');
          setStatus('join');
          break;
        case 'score_update':
          // Optional: handle real-time score updates if needed
          break;
      }
    };

    socket.onclose = (event) => {
      console.log('Disconnected from WebSocket', event.code, event.reason);
      socketRef.current = null;
      if (event.code === 1008) {
        // Policy violation - lobby not found or join error
        alert(event.reason || 'Could not join lobby');
        setStatus('join');
      }
    };

    socketRef.current = socket;
  }, [lobbyId, playerId, username, character, mode, updateFromLobby, updateFromGameState, setWordResult, setGameEnd, setPowerup, setStatus]);

  useEffect(() => {
    connect();
    return () => {
      socketRef.current?.close();
    };
  }, [connect]);

  const send = (type: string, data: any = {}) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, data }));
    }
  };

  return { send };
};
