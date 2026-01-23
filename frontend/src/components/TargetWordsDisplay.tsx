import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';

export const TargetWordsDisplay = () => {
  const { targetWords, players, playerId } = useGameStore(
    useShallow(state => ({
      targetWords: state.targetWords,
      players: state.players,
      playerId: state.playerId,
    }))
  );

  if (targetWords.length === 0) {
    return null;
  }

  const currentPlayer = players.find(p => p.id === playerId);
  const foundWords = currentPlayer?.found_words || [];

    return (
      <div className="frosted-glass p-2 sm:p-3">
        <h3 className="text-center font-bold text-primary text-sm sm:text-base mb-1">TARGET WORDS</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-28 sm:max-h-36 overflow-y-auto pr-1">
          {targetWords.map(word => {
            const isFound = foundWords.includes(word.toUpperCase());
            return (
              <div
                key={word}
                className={`p-1 sm:p-2 rounded-lg text-center transition-all min-h-8 sm:min-h-12 flex flex-col justify-center ${isFound ? 'bg-success/20 border-2 border-success' : 'bg-white/5 border border-white/10'}`}
              >
                <p className={`font-bold truncate text-sm ${isFound ? 'text-success' : 'text-white'}`}>
                  {word.toUpperCase()}
                </p>
                <p className="text-[10px] text-white/50">
                  {isFound ? 'FOUND!' : `${word.length} letters`}
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-white/30 mt-1 sm:mt-2 text-center">
          Find target words for bonus points!
        </p>
      </div>
    );
};