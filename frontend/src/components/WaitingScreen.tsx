import { useMemo } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { MonsterAvatar } from './MonsterAvatar';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

export const WaitingScreen = () => {
  const { players, playersStillPlaying } = useGameStore(
    useShallow(state => ({
      players: state.players,
      playersStillPlaying: state.playersStillPlaying,
    }))
  );

  // Get players who are still playing (have bonus time)
  const activePlayers = useMemo(() => {
    return players.filter(p => playersStillPlaying.includes(p.id));
  }, [players, playersStillPlaying]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-navy-gradient p-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="text-center"
      >
        {/* Clock icon with pulse animation */}
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="inline-block mb-6"
        >
          <Clock className="w-24 h-24 text-primary" />
        </motion.div>

        <h1 className="text-4xl font-black text-white mb-4">
          Time's Up!
        </h1>

        <p className="text-xl text-white/70 mb-8">
          Waiting for other players to finish...
        </p>

        {/* Show players still playing */}
        {activePlayers.length > 0 && (
          <div className="frosted-glass p-6 rounded-xl max-w-md mx-auto">
            <p className="text-sm text-white/50 uppercase font-bold tracking-wider mb-4">
              Still Playing ({activePlayers.length})
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {activePlayers.map((player) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center"
                >
                  <div className="relative">
                    <MonsterAvatar name={player.character} size={60} animated={true} />
                    {/* Pulsing indicator */}
                    <div className="absolute -top-1 -right-1">
                      <div className="w-4 h-4 bg-green-500 rounded-full ios-pulse" />
                    </div>
                  </div>
                  <p className="text-xs text-white/70 mt-2 font-bold">{player.username}</p>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-white/40 mt-8 text-sm"
        >
          Game will end when all players finish...
        </motion.p>
      </motion.div>
    </div>
  );
};
