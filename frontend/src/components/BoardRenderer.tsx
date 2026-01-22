import { memo, useMemo } from 'react';
import { Bomb } from 'lucide-react';

// Letter point values (same as backend scoring.py)
const LETTER_SCORES: Record<string, number> = {
  'A': 1, 'E': 1, 'I': 1, 'O': 1, 'N': 1, 'R': 1, 'T': 1, 'L': 1, 'S': 1,
  'D': 2, 'G': 2, 'U': 2, 'C': 2, 'M': 2, 'P': 2, 'B': 2,
  'H': 3, 'F': 3, 'W': 3, 'Y': 3, 'V': 3, 'K': 3,
  'J': 5, 'X': 5,
  'Q': 8, 'Z': 8,
  'QU': 10  // QU tile is worth more (Q + U value)
};

// Rare letters that grant powerups when used - styled with gold color
const RARE_LETTERS = new Set(['J', 'X', 'Q', 'Z', 'QU']);

// Static cell component - NO dynamic props during drag, uses data attributes for styling
const Cell = memo(({
  letter,
  isBlocked,
  row,
  col,
  cellRef
}: {
  letter: string;
  isBlocked: boolean;
  row: number;
  col: number;
  cellRef: (el: HTMLDivElement | null) => void;
}) => {
  const upperLetter = letter.toUpperCase();
  const points = LETTER_SCORES[upperLetter] ?? 1;
  const isQU = upperLetter === 'QU';
  const isRare = RARE_LETTERS.has(upperLetter);

  const displayLetter = isQU ? (
    <span>Q<span className="text-[0.7em]">u</span></span>
  ) : letter;

  return (
    <div
      ref={cellRef}
      data-row={row}
      data-col={col}
      className={`
        cell aspect-square flex items-center justify-center font-black
        relative rounded-xl cursor-pointer select-none
        ${isQU ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'}
        ${isRare
          ? 'bg-gradient-to-br from-yellow-500/30 to-amber-600/30 border-2 border-yellow-400/60 text-yellow-300 shadow-[0_0_12px_rgba(234,179,8,0.3)]'
          : 'bg-white/10 border border-white/20 text-white'}
        shadow-lg
        ${isBlocked ? 'opacity-20 grayscale border-red-500 pointer-events-none' : ''}
      `}
    >
      <span className="cell-index absolute top-0.5 left-1 text-[8px] sm:text-[10px] font-bold text-white/70 hidden" />
      {displayLetter}
      <span className={`cell-points absolute bottom-0.5 right-1 text-[8px] sm:text-[10px] font-bold ${isRare ? 'text-yellow-400/90' : 'text-primary/70'}`}>
        {points}
      </span>
      {isBlocked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Bomb className="text-red-500 w-1/2 h-1/2 opacity-50" />
        </div>
      )}
    </div>
  );
});
Cell.displayName = 'Cell';

interface BoardRendererProps {
  board: string[][];
  boardSize: number;
  blockedCells: string[];
  onCellRef: (key: string, el: HTMLDivElement | null) => void;
}

export const BoardRenderer = memo(({ board, boardSize, blockedCells, onCellRef }: BoardRendererProps) => {
  // Convert blockedCells array to Set for O(1) lookup
  const blockedSet = useMemo(() => new Set(blockedCells), [blockedCells]);

  // Create callbacks for each cell
  const cellRefCallbacks = useMemo(() => {
    const map = new Map<string, (el: HTMLDivElement | null) => void>();
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const key = `${r}-${c}`;
        map.set(key, (el) => onCellRef(key, el));
      }
    }
    return map;
  }, [boardSize, onCellRef]);

  return (
    <>
      {board.map((row, r) => row.map((letter, c) => {
        const key = `${r}-${c}`;
        const isBlocked = blockedSet.has(key);

        return (
          <Cell
            key={key}
            letter={letter}
            isBlocked={isBlocked}
            row={r}
            col={c}
            cellRef={cellRefCallbacks.get(key)!}
          />
        );
      }))}
    </>
  );
});

BoardRenderer.displayName = 'BoardRenderer';