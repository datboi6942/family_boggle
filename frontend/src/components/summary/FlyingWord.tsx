import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
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
  const [phase, setPhase] = useState<'reveal' | 'fly' | 'done'>('reveal');
  const completedCountRef = useRef(0);

  const handleRevealComplete = () => {
    if (targetPositions.length > 0) {
      setPhase('fly');
    } else {
      onComplete();
    }
  };

  const handleFragmentComplete = () => {
    completedCountRef.current += 1;
    if (completedCountRef.current >= targetPositions.length) {
      setTimeout(onComplete, 30);
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
      {/* Central Word Reveal */}
      {phase === 'reveal' && (
        <motion.div
          initial={{ scale: 0, opacity: 0, rotateX: -90 }}
          animate={{ scale: 1, opacity: 1, rotateX: 0 }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30,
          }}
          onAnimationComplete={() => setTimeout(handleRevealComplete, 120)}
          className={`frosted-glass px-6 py-4 flex flex-col items-center ${
            isUnique ? 'border-2 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.5)]' : ''
          }`}
        >
          {isUnique && (
            <span className="text-yellow-500 text-[10px] font-black uppercase tracking-widest mb-1">
              ✨ Unique ✨
            </span>
          )}
          <h2 className="text-3xl font-black uppercase tracking-tighter italic">
            {word}
          </h2>
          <span className="text-xl font-black text-primary">+{points}</span>

          {/* Show who found the word */}
          <div className="mt-2 flex items-center gap-2">
            <div className="flex -space-x-1">
              {finders.map((finder) => (
                <div
                  key={finder.player_id}
                  className="ring-2 ring-navy-900 rounded-full"
                  title={finder.username}
                >
                  <MonsterAvatar name={finder.character} size={24} animated={false} />
                </div>
              ))}
            </div>
            <span className="text-xs text-white/70">
              {finders.length === 1 ? finders[0].username : `${finders.length} players`}
            </span>
          </div>
        </motion.div>
      )}

      {/* Flying Fragments - one per finder */}
      {phase === 'fly' && targetPositions.map((target, index) => (
        <motion.div
          key={`fragment-${index}`}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{
            x: target.x,
            y: target.y,
            scale: 0.3,
            opacity: 0.8,
          }}
          transition={{
            duration: 0.2,
            ease: [0.25, 0.46, 0.45, 0.94],
            delay: index * 0.02,
          }}
          onAnimationComplete={handleFragmentComplete}
          className="absolute px-3 py-1.5 bg-primary rounded-lg text-white font-bold text-sm shadow-lg"
        >
          +{points}
        </motion.div>
      ))}
    </div>
  );
};


