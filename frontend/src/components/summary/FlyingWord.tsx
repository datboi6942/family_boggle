import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FlyingWordProps {
  word: string;
  points: number;
  isUnique: boolean;
  targetPositions: { x: number; y: number }[];
  onComplete: () => void;
}

export const FlyingWord: React.FC<FlyingWordProps> = ({
  word,
  points,
  isUnique,
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
        className={`frosted-glass px-8 py-4 flex flex-col items-center ${
          isUnique ? 'unique-glow border-2 border-yellow-500' : ''
        }`}
      >
        {isUnique && (
          <motion.span 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-yellow-500 text-xs font-black uppercase tracking-widest mb-1"
          >
            ✨ 2x Unique Bonus ✨
          </motion.span>
        )}
        <h2 className="text-4xl font-black uppercase tracking-tighter italic">
          {word}
        </h2>
        <div className="flex items-center mt-1">
          <span className="text-2xl font-black text-primary">+{points}</span>
        </div>
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
              delay: 0.8, // Wait for reveal
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
