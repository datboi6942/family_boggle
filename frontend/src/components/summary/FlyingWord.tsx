import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MonsterAvatar } from '../MonsterAvatar';

interface Finder {
  player_id: string;
  username: string;
  character: string;
}

interface FlyingWordProps {
  word: string;
  points: number;
  isUnique: boolean;
  finders: Finder[];
  targetPositions: { x: number; y: number }[];
  onComplete: () => void;
}

export const FlyingWord: React.FC<FlyingWordProps> = ({
  word,
  points,
  isUnique,
  finders,
  targetPositions,
  onComplete,
}) => {
  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
      {/* Central Word Reveal */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
          duration: 0.5
        }}
        className={`frosted-glass px-8 py-5 flex flex-col items-center ${
          isUnique ? 'unique-glow border-2 border-yellow-500' : ''
        }`}
      >
        {isUnique && (
          <motion.span
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-yellow-500 text-xs font-black uppercase tracking-widest mb-1"
          >
            ✨ Unique Bonus ✨
          </motion.span>
        )}
        <h2 className="text-4xl font-black uppercase tracking-tighter italic">
          {word}
        </h2>
        <div className="flex items-center mt-1">
          <span className="text-2xl font-black text-primary">+{points}</span>
        </div>

        {/* Show who found the word */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-3 flex items-center gap-2"
        >
          <span className="text-xs text-white/50 uppercase tracking-wider">Found by:</span>
          <div className="flex -space-x-2">
            {finders.map((finder, idx) => (
              <motion.div
                key={finder.player_id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4 + idx * 0.1 }}
                className="relative"
                title={finder.username}
              >
                <div className="ring-2 ring-navy-900 rounded-full">
                  <MonsterAvatar name={finder.character} size={32} animated={false} />
                </div>
              </motion.div>
            ))}
          </div>
          {finders.length === 1 && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-sm font-bold text-white/80"
            >
              {finders[0].username}
            </motion.span>
          )}
          {finders.length > 1 && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xs text-white/60"
            >
              ({finders.length} players)
            </motion.span>
          )}
        </motion.div>
      </motion.div>

      {/* Splitting Fragments */}
      <AnimatePresence>
        {targetPositions.map((target, index) => (
          <motion.div
            key={`${word}-fragment-${index}`}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{
              x: target.x,
              y: target.y,
              scale: 0.5,
              opacity: 0
            }}
            transition={{
              delay: 1.0, // Wait for reveal + finder display
              duration: 0.6,
              ease: "circIn"
            }}
            onAnimationComplete={() => {
              if (index === targetPositions.length - 1) {
                onComplete();
              }
            }}
            className="absolute px-4 py-2 bg-primary rounded-lg text-white font-bold pointer-events-none whitespace-nowrap"
          >
            {word}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
