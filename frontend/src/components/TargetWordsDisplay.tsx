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
     <div className="frosted-glass p-3 sm:p-4">
       <h3 className="text-center font-bold text-primary text-sm sm:text-base mb-2">TARGET WORDS</h3>
       <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 max-h-32 sm:max-h-40 overflow-y-auto pr-1">
         {targetWords.map(word => {
           const isFound = foundWords.includes(word.toUpperCase());
           return (
             <div
               key={word}
               className={`p-2 sm:p-3 rounded-xl text-center transition-all min-h-10 sm:min-h-14 flex flex-col justify-center ${isFound ? 'bg-success/20 border-2 border-success' : 'bg-white/5 border border-white/10'}`}
             >
               <p className={`font-bold truncate ${isFound ? 'text-success' : 'text-white'}`}>
                 {word.toUpperCase()}
               </p>
               <p className="text-xs text-white/50">
                 {isFound ? 'FOUND!' : `${word.length} letters`}
               </p>
             </div>
           );
         })}
       </div>
       <p className="text-xs text-white/30 mt-2 sm:mt-3 text-center">
         Find target words for bonus points!
       </p>
     </div>
   );
};