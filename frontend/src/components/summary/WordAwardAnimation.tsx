import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { PlayerScoreCard } from './PlayerScoreCard';
import { FlyingWord } from './FlyingWord';

interface WordAwardAnimationProps {
  onAllCompleted: (finalScores: Record<string, number>) => void;
}

export const WordAwardAnimation: React.FC<WordAwardAnimationProps> = ({ onAllCompleted }) => {
  const { wordAwards, players, results } = useGameStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playerScores, setPlayerScores] = useState<Record<string, number>>(
    players.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {})
  );
  const [targetPositions, setTargetPositions] = useState<Record<string, { x: number; y: number }>>({});
  const playerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Capture player card positions for flying word targets
  useEffect(() => {
    const updatePositions = () => {
      const positions: Record<string, { x: number; y: number }> = {};
      Object.entries(playerRefs.current).forEach(([id, ref]) => {
        if (ref) {
          const rect = ref.getBoundingClientRect();
          // Target the center of the avatar
          positions[id] = {
            x: rect.left + rect.width / 2 - window.innerWidth / 2,
            y: rect.top + rect.height / 2 - window.innerHeight / 2,
          };
        }
      });
      setTargetPositions(positions);
    };

    updatePositions();
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [players]);

  const handleWordComplete = () => {
    if (!wordAwards) return;

    const currentWord = wordAwards[currentIndex];
    
    // Update local scores
    const newScores = { ...playerScores };
    currentWord.finders.forEach((finder) => {
      newScores[finder.player_id] = (newScores[finder.player_id] || 0) + currentWord.points;
    });
    setPlayerScores(newScores);

    // Move to next word or finish
    if (currentIndex < wordAwards.length - 1) {
      setTimeout(() => setCurrentIndex(currentIndex + 1), 400); // Small pause between words
    } else {
      setTimeout(() => onAllCompleted(newScores), 1000);
    }
  };

  if (!wordAwards || wordAwards.length === 0) {
    return null;
  }

  const currentWord = wordAwards[currentIndex];
  const currentTargets = currentWord.finders
    .map((f) => targetPositions[f.player_id])
    .filter(Boolean);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top Section: Player Avatars */}
      <div className="flex flex-wrap justify-center gap-4 p-4 mt-8">
        <AnimatePresence>
          {players.map((player, i) => {
            // Get the best challenge for this player from results
            const playerResult = results?.find(r => r.player_id === player.id);
            const bestChallenge = playerResult?.best_challenge;

            return (
              <motion.div
                key={player.id}
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                ref={(el) => { playerRefs.current[player.id] = el; }}
              >
                <PlayerScoreCard
                  playerId={player.id}
                  username={player.username}
                  character={player.character}
                  score={playerScores[player.id] || 0}
                  bestChallenge={bestChallenge}
                  showChallenge={true}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Center Section: Animated Word Awards */}
      <div className="flex-1 flex items-center justify-center relative">
        <AnimatePresence mode="wait">
          <FlyingWord
            key={`word-${currentIndex}`}
            word={currentWord.word}
            points={currentWord.points}
            isUnique={currentWord.is_unique}
            targetPositions={currentTargets}
            onComplete={handleWordComplete}
          />
        </AnimatePresence>
      </div>

      {/* Progress Bar */}
      <div className="px-10 pb-10">
        <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${((currentIndex + 1) / wordAwards.length) * 100}%` }}
          />
        </div>
        <p className="text-center text-[10px] text-white/30 uppercase mt-2 font-black tracking-widest">
          Awarding Word {currentIndex + 1} of {wordAwards.length}
        </p>
      </div>
    </div>
  );
};
