import { useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { MonsterAvatar } from './MonsterAvatar';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';

export const GameSummary = () => {
  const { results, setStatus } = useGameStore();

  useEffect(() => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#8b5cf6', '#22c55e', '#f97316']
    });
  }, []);

  return (
    <div className="flex flex-col h-full p-6 bg-navy-gradient min-h-screen">
      <h2 className="text-center text-white/50 font-bold uppercase tracking-widest mb-2">Game Over</h2>
      <h1 className="text-center text-4xl font-black mb-8 italic">RESULTS</h1>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {results?.map((res, i) => (
          <motion.div
            key={res.username}
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className={`frosted-glass p-4 flex items-center justify-between ${i === 0 ? 'border-primary border-2 scale-105 my-2' : ''}`}
          >
            <div className="flex items-center space-x-4">
              <span className="text-xl font-black text-white/30">{i + 1}</span>
              <MonsterAvatar name={res.character} size={50} isWinner={i === 0} />
              <div>
                <p className="font-bold text-lg">{res.username}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {res.words.sort((a: string, b: string) => a.length - b.length).map((w: string) => (
                    <span key={w} className="text-[10px] bg-white/5 px-1 rounded uppercase font-mono">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-2xl font-black text-primary">{res.score}</p>
          </motion.div>
        ))}
      </div>

      <button
        onClick={() => setStatus('lobby')}
        className="w-full py-5 bg-white/10 rounded-2xl font-black text-xl mt-6 active:scale-95 transition-transform"
      >
        BACK TO LOBBY
      </button>
    </div>
  );
};
