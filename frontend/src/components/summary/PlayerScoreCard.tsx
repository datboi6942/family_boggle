import React, { useEffect, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { MonsterAvatar } from '../MonsterAvatar';
import { Trophy, Target, Zap, Star } from 'lucide-react';

interface ChallengeProgress {
  id: string;
  name: string;
  description: string;
  target: number;
  progress: number;
  ratio: number;
  completed: boolean;
  category: string;
}

interface PlayerScoreCardProps {
  username: string;
  character: string;
  score: number;
  isWinner?: boolean;
  playerId: string;
  bestChallenge?: ChallengeProgress | null;
  showChallenge?: boolean;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'words':
      return <Target className="w-3 h-3" />;
    case 'letters':
      return <Zap className="w-3 h-3" />;
    case 'score':
      return <Trophy className="w-3 h-3" />;
    case 'special':
      return <Star className="w-3 h-3" />;
    default:
      return <Target className="w-3 h-3" />;
  }
};

export const PlayerScoreCard: React.FC<PlayerScoreCardProps> = ({
  username,
  character,
  score,
  isWinner,
  bestChallenge,
  showChallenge = false,
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
      className={`flex flex-col items-center p-2 rounded-xl transition-colors min-w-[90px] ${
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

      {/* Best Challenge Progress */}
      {showChallenge && bestChallenge && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className={`mt-2 w-full px-1 ${
            bestChallenge.completed ? 'text-green-400' : 'text-white/60'
          }`}
        >
          <div className="flex items-center gap-1 justify-center mb-1">
            {getCategoryIcon(bestChallenge.category)}
            <span className="text-[9px] font-bold truncate max-w-[70px]">
              {bestChallenge.name}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${bestChallenge.completed ? 'bg-green-400' : 'bg-primary'}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(bestChallenge.ratio * 100, 100)}%` }}
              transition={{ delay: 0.5, duration: 0.5 }}
            />
          </div>

          <p className="text-[8px] text-center mt-0.5 font-mono">
            {bestChallenge.progress}/{bestChallenge.target}
            {bestChallenge.completed && ' ✓'}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};


