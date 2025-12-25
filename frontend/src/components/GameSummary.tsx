import { useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { MonsterAvatar } from './MonsterAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { WordAwardAnimation } from './summary/WordAwardAnimation';

export const GameSummary = () => {
  const { results, winner, wordAwards, resetSession } = useGameStore();
  const { send } = useWebSocketContext();
  const [phase, setPhase] = useState<'animating' | 'celebrating'>('animating');

  useEffect(() => {
    // If there are no word awards to animate, skip directly to celebration
    if (wordAwards && wordAwards.length === 0 && phase === 'animating') {
      setPhase('celebrating');
    }
  }, [wordAwards, phase]);

  useEffect(() => {
    let interval: any;
    if (phase === 'celebrating') {
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#22c55e', '#f97316', '#eab308']
      });
      
      // Secondary bursts
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

      interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: Math.random(), y: Math.random() - 0.2 } });
      }, 250);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase]);

  const handleAnimationsComplete = () => {
    setPhase('celebrating');
  };

  return (
    <div className="flex flex-col h-full bg-navy-gradient min-h-screen overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === 'animating' && wordAwards && wordAwards.length > 0 ? (
          <motion.div
            key="animating-phase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1"
          >
            <WordAwardAnimation onAllCompleted={handleAnimationsComplete} />
          </motion.div>
        ) : (
          <motion.div
            key="celebration-phase"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col p-6 overflow-y-auto"
          >
            <div className="text-center mb-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12 }}
                className="inline-block"
              >
                <MonsterAvatar name={winner?.character} size={150} isWinner={true} />
              </motion.div>
              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-5xl font-black mt-4 italic text-white"
              >
                {winner?.username.toUpperCase()} WINS!
              </motion.h1>
              <p className="text-primary font-black text-2xl mt-2">{winner?.score} PTS</p>
            </div>

            <div className="space-y-4 max-w-2xl mx-auto w-full">
              <h2 className="text-white/50 font-bold uppercase tracking-widest text-center mb-4">Final Leaderboard</h2>
              {results?.map((res, i) => (
                <motion.div
                  key={res.username}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className={`frosted-glass p-4 flex items-center justify-between ${
                    i === 0 ? 'border-primary border-2 scale-105 shadow-xl' : ''
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <span className="text-xl font-black text-white/30">{i + 1}</span>
                    <MonsterAvatar name={res.character} size={50} isWinner={i === 0} animated={false} />
                    <div>
                      <p className="font-bold text-lg">{res.username}</p>
                      <p className="text-xs text-white/40">{res.words.length} words found</p>
                    </div>
                  </div>
                  <p className="text-2xl font-black text-primary">{res.score}</p>
                </motion.div>
              ))}
            </div>

            <motion.button
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.5 }}
              onClick={() => send('reset_game', {})}
              className="w-full max-w-md mx-auto py-5 bg-primary rounded-2xl font-black text-xl mt-12 mb-2 shadow-2xl active:scale-95 transition-transform"
            >
              PLAY AGAIN
            </motion.button>

            <motion.button
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.7 }}
              onClick={() => resetSession()}
              className="w-full max-w-md mx-auto py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-white/50 active:scale-95 transition-all mb-8"
            >
              LEAVE GAME
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
