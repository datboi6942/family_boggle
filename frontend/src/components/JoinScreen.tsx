import { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useAudioContext } from '../contexts/AudioContext';
import { MONSTERS, MonsterAvatar } from './MonsterAvatar';
import { motion } from 'framer-motion';
import { Leaderboard } from './Leaderboard';

export const JoinScreen = () => {
  const { setUsername, setCharacter, setLobbyId, setPlayerId, setStatus, setMode, username, character } = useGameStore();
  const audio = useAudioContext();
  const [lobbyInput, setLobbyInput] = useState('');
  const musicStartedRef = useRef(false);

  // Keep a ref to audio so effects can access latest version
  const audioRef = useRef(audio);
  audioRef.current = audio;

  // Start menu music on join screen
  useEffect(() => {
    if (!musicStartedRef.current) {
      audioRef.current.playMenuMusic();
      musicStartedRef.current = true;
    }
  }, []);

  const handleStart = (mode: 'create' | 'join') => {
    if (!username) return;

    audio.playButtonClick();

    const pId = Math.random().toString(36).substring(7);
    setPlayerId(pId);
    setMode(mode);

    if (mode === 'create') {
      const lId = Math.random().toString(36).substring(7).toUpperCase();
      setLobbyId(lId);
    } else {
      if (!lobbyInput) return;
      setLobbyId(lobbyInput.toUpperCase());
    }

    setStatus('lobby');
  };

  return (
    <div className="flex flex-col items-center justify-start sm:justify-center min-h-screen p-6 pb-12 space-y-6 bg-navy-gradient pt-12 sm:pt-6 overflow-y-auto">
      <motion.h1
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-pink-500 italic shrink-0"
      >
        FAMILY BOGGLE
      </motion.h1>

      <div className="w-full max-w-sm space-y-4 frosted-glass p-6 sm:p-8 shrink-0">
        <input
          type="text"
          placeholder="ENTER USERNAME"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-4 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-primary text-center text-xl font-bold"
        />

        <div className="grid grid-cols-5 gap-2 py-4">
          {MONSTERS.map((m) => (
            <button
              key={m.name}
              onClick={() => {
                audio.playButtonClick();
                setCharacter(m.name);
              }}
              onMouseEnter={() => audio.playButtonHover()}
              className={`aspect-square rounded-lg border-2 transition-all overflow-hidden flex items-center justify-center ${character === m.name ? 'border-primary bg-primary/20 scale-110' : 'border-transparent'}`}
            >
              <MonsterAvatar name={m.name} size={36} animated={true} />
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleStart('create')}
            className="w-full py-4 bg-primary rounded-xl font-black text-xl shadow-lg active:scale-95 transition-transform"
          >
            CREATE LOBBY
          </button>
          
          <div className="flex items-stretch gap-2">
            <input
              type="text"
              placeholder="LOBBY CODE"
              value={lobbyInput}
              onChange={(e) => setLobbyInput(e.target.value)}
              className="flex-1 min-w-0 p-4 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-primary text-center font-bold"
            />
            <button
              onClick={() => handleStart('join')}
              className="px-6 py-4 bg-white/10 rounded-xl font-bold active:scale-95 transition-transform shrink-0"
            >
              JOIN
            </button>
          </div>
        </div>
      </div>

      {/* High Scores Leaderboard */}
      <div className="w-full max-w-sm shrink-0 mb-6">
        <Leaderboard />
      </div>
    </div>
  );
};
