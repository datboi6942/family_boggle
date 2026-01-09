import { useEffect, useRef, useMemo } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useAudioContext } from '../contexts/AudioContext';
import { MonsterAvatar } from './MonsterAvatar';
import { motion } from 'framer-motion';
import QRCodeSVG from 'react-qr-code';

export const Lobby = () => {
  const { lobbyId, playerId, players, hostId, boardSize, resetSession } = useGameStore(
    useShallow(state => ({
      lobbyId: state.lobbyId,
      playerId: state.playerId,
      players: state.players,
      hostId: state.hostId,
      boardSize: state.boardSize,
      resetSession: state.resetSession,
    }))
  );
  const { send } = useWebSocketContext();
  const audio = useAudioContext();
  const musicStartedRef = useRef(false);

  const isHost = hostId === playerId;
  const me = useMemo(() => players.find(p => p.id === playerId), [players, playerId]);

  // Keep a ref to audio so effects can access latest version
  const audioRef = useRef(audio);
  audioRef.current = audio;

  // Restore scroll state when entering lobby (e.g., after game ends)
  useEffect(() => {
    // Restore body scroll - clear any scroll locks from game/countdown
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.top = '';
    document.body.style.left = '';
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Start menu music (stop any previous music first to handle transitions from summary)
  useEffect(() => {
    if (!musicStartedRef.current) {
      // Explicitly stop any playing music (e.g., summary music from previous game)
      audioRef.current.stopMusic();
      audioRef.current.playMenuMusic();
      musicStartedRef.current = true;
    }
  }, []);

  const copyToClipboard = () => {
    if (lobbyId) {
      audio.playButtonClick();
      navigator.clipboard.writeText(lobbyId);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4 bg-navy-gradient min-h-screen">
      <div className="grid grid-cols-2 gap-4 flex-shrink-0">
        <div
          onClick={copyToClipboard}
          className="frosted-glass p-4 text-center cursor-pointer active:scale-95 transition-transform border-primary/50"
        >
          <h2 className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Lobby Code</h2>
          <p className="text-3xl font-black text-white break-all">{lobbyId || '...'}</p>
          <p className="text-[10px] text-white/30 mt-1">TAP TO COPY</p>
        </div>
        <div className="frosted-glass p-4 text-center">
          <h2 className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-1">Players</h2>
          <p className="text-2xl font-black">{players.length}/10</p>
          <p className="text-[8px] text-white/30 mt-1">CONNECTED</p>
        </div>
      </div>

      <div className="frosted-glass p-6 flex flex-col items-center justify-center">
        <h2 className="text-xs font-bold text-primary uppercase tracking-widest mb-3">Scan to Join</h2>
        <div className="bg-white p-4 rounded-xl">
          {lobbyId ? (
            <QRCodeSVG value={lobbyId} size={140} />
          ) : (
            <div className="w-[140px] h-[140px] flex items-center justify-center text-gray-400">
              ...
            </div>
          )}
        </div>
        <p className="text-[10px] text-white/30 mt-3">POINT CAMERA AT CODE</p>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 overflow-y-auto py-4">
        {players.map((p) => (
          <motion.div
            key={p.id}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`frosted-glass p-4 flex flex-col items-center relative ${p.is_ready ? 'border-success' : ''}`}
          >
            {p.is_ready && (
              <span className="absolute top-2 right-2 bg-success text-[10px] px-2 py-0.5 rounded-full font-bold">READY</span>
            )}
            <MonsterAvatar name={p.character} size={60} />
            <p className="mt-2 font-bold truncate w-full text-center">{p.username}</p>
            {p.id === hostId && <span className="text-[10px] text-primary font-bold">HOST</span>}
          </motion.div>
        ))}
      </div>

      {isHost && (
        <div className="space-y-4">
          <h3 className="text-center font-bold text-white/50">BOARD SIZE</h3>
          <div className="flex justify-center space-x-4">
            {[4, 5, 6].map(size => (
              <button
                key={size}
                onClick={() => {
                  audio.playButtonClick();
                  send('set_board_size', { size });
                }}
                className={`w-12 h-12 rounded-xl font-bold transition-all ${boardSize === size ? 'bg-primary scale-110' : 'bg-white/10'}`}
              >
                {size}x{size}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => {
          audio.playButtonClick();
          audio.stopMusic();
          resetSession();
        }}
        className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-white/50 active:scale-95 transition-all mb-2"
      >
        LEAVE LOBBY
      </button>

      <button
        onClick={() => {
          audio.playButtonClick();
          send('toggle_ready');
        }}
        className={`w-full py-6 rounded-2xl font-black text-2xl shadow-xl active:scale-95 transition-all ${me?.is_ready ? 'bg-success/20 border-2 border-success text-success' : 'bg-primary'}`}
      >
        {me?.is_ready ? 'UNREADY' : 'READY TO PLAY'}
      </button>
    </div>
  );
};


