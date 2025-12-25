import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { MonsterAvatar } from '../MonsterAvatar';

interface PlayerScoreCardProps {
  username: string;
  character: string;
  score: number;
  isWinner?: boolean;
  playerId: string;
}

export const PlayerScoreCard: React.FC<PlayerScoreCardProps> = ({
  username,
  character,
  score,
  isWinner,
}) => {
  const [displayScore, setDisplayScore] = useState(0);
  const controls = useAnimation();

  useEffect(() => {
    if (score > displayScore) {
      // Animate score increment
      const start = displayScore;
      const end = score;
      const duration = 500; // ms
      let startTime: number | null = null;

      const step = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const current = Math.floor(progress * (end - start) + start);
        setDisplayScore(current);
        
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      };

      window.requestAnimationFrame(step);
      
      // Visual pop animation
      controls.start({
        scale: [1, 1.2, 1],
        color: ['#ffffff', '#8b5cf6', '#ffffff'],
        transition: { duration: 0.3 }
      });
    } else {
      setDisplayScore(score);
    }
  }, [score, controls]);

  return (
    <motion.div
      layout
      className={`flex flex-col items-center p-2 rounded-xl transition-colors ${
        isWinner ? 'bg-primary/20 border border-primary/50' : 'bg-white/5'
      }`}
    >
      <div className="relative">
        <MonsterAvatar name={character} size={60} isWinner={isWinner} />
      </div>
      <p className="text-xs font-bold mt-1 text-white/70 truncate max-w-[80px]">
        {username}
      </p>
      <motion.p
        animate={controls}
        className="text-xl font-black text-primary"
      >
        {displayScore}
      </motion.p>
    </motion.div>
  );
};
