import { useState, useRef, useCallback, useMemo, memo, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useAudioContext } from '../contexts/AudioContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake, Bomb, RotateCw } from 'lucide-react';

// Letter point values (same as backend scoring.py)
const LETTER_SCORES: Record<string, number> = {
  'A': 1, 'E': 1, 'I': 1, 'O': 1, 'N': 1, 'R': 1, 'T': 1, 'L': 1, 'S': 1,
  'D': 2, 'G': 2, 'U': 2, 'C': 2, 'M': 2, 'P': 2, 'B': 2,
  'H': 3, 'F': 3, 'W': 3, 'Y': 3, 'V': 3, 'K': 3,
  'J': 5, 'X': 5,
  'Q': 8, 'Z': 8,
  'QU': 10  // QU tile is worth more (Q + U value)
};

// Memoized timer component to isolate timer re-renders
const TimerDisplay = memo(({ formattedTimer, isFrozen }: { formattedTimer: string; isFrozen: boolean }) => (
  <div className={`flex items-center gap-2 ${isFrozen ? 'text-blue-400' : 'text-white'}`}>
    {isFrozen ? <Snowflake className="w-4 h-4 animate-spin" /> : <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
    <span className="text-lg font-black font-mono tabular-nums">{formattedTimer}</span>
  </div>
));
TimerDisplay.displayName = 'TimerDisplay';

// Memoized cell component to prevent unnecessary re-renders
const Cell = memo(({
  letter,
  isSelected,
  isFirst,
  isLast,
  isBlocked,
  pathIndex
}: {
  letter: string;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  isBlocked: boolean;
  pathIndex: number;
}) => {
  const points = LETTER_SCORES[letter.toUpperCase()] ?? 1;
  const isQU = letter.toUpperCase() === 'QU';

  // Display "Qu" with smaller 'u' for the QU tile
  const displayLetter = isQU ? (
    <span>Q<span className="text-[0.7em]">u</span></span>
  ) : letter;

  return (
    <div
      className={`
        aspect-square frosted-glass flex items-center justify-center font-black
        relative rounded-xl transition-all duration-150 ease-out
        ${isQU ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'}
        ${isSelected ? 'bg-primary/80 border-2 border-white scale-110 z-10' : 'bg-white/5 border border-white/10 scale-100'}
        ${isFirst ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-transparent' : ''}
        ${isLast && !isFirst ? 'bg-white text-primary' : ''}
        ${isBlocked ? 'opacity-20 grayscale border-red-500' : ''}
      `}
      style={{
        boxShadow: isSelected ? '0 0 20px rgba(139, 92, 246, 0.5)' : undefined,
        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
      }}
    >
      {isSelected && (
        <span className="absolute top-0.5 left-1 text-[8px] sm:text-[10px] font-bold text-white/70">
          {pathIndex + 1}
        </span>
      )}
      {displayLetter}
      {/* Letter point value */}
      <span className={`absolute bottom-0.5 right-1 text-[8px] sm:text-[10px] font-bold ${isSelected || (isLast && !isFirst) ? 'text-white/70' : 'text-primary/70'}`}>
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

export const GameBoard = () => {
  const playerId = useGameStore(state => state.playerId);
  const board = useGameStore(state => state.board);
  const boardSize = useGameStore(state => state.boardSize);
  const timer = useGameStore(state => state.timer);
  const lastWordResult = useGameStore(state => state.lastWordResult);
  const players = useGameStore(state => state.players);
  const blockedCells = useGameStore(state => state.blockedCells);
  const isFrozen = useGameStore(state => state.isFrozen);

  const { send } = useWebSocketContext();
  const audio = useAudioContext();

  const [currentPath, setCurrentPath] = useState<[number, number][]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [touchPos, setTouchPos] = useState<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const musicStartedRef = useRef(false);
  const lastTimerRef = useRef<number>(timer);
  const lastSoundTimeRef = useRef(0);
  const prevPathLengthRef = useRef(0);

  // Keep a ref to audio so effects can access latest version
  const audioRef = useRef(audio);
  audioRef.current = audio;

  // Start gameplay music when game begins (run once on mount)
  useEffect(() => {
    if (!musicStartedRef.current) {
      // Stop countdown riser music first
      audioRef.current.stopMusic();
      // Play game start sound
      audioRef.current.playGameStart();
      // Small delay to ensure clean transition, then start gameplay loop
      const timeoutId = setTimeout(() => {
        audioRef.current.playGameplayMusic();
      }, 100);
      musicStartedRef.current = true;
      return () => clearTimeout(timeoutId);
    }
  }, []);

  // Timer sounds
  useEffect(() => {
    if (timer !== lastTimerRef.current) {
      // Timer warning when 10 seconds or less
      if (timer <= 10 && timer > 0) {
        audioRef.current.playTimerWarning();
      }
      // Game end sound
      if (timer === 0 && lastTimerRef.current > 0) {
        audioRef.current.playGameEnd();
        audioRef.current.stopMusic();
      }
      lastTimerRef.current = timer;
    }
  }, [timer]);

  // Word result sounds
  useEffect(() => {
    if (lastWordResult) {
      if (lastWordResult.valid) {
        audioRef.current.playWordValid();
        if (lastWordResult.powerup) {
          setTimeout(() => audioRef.current.playPowerupEarned(), 200);
        }
      } else if (lastWordResult.reason === 'Already found') {
        audioRef.current.playWordAlreadyFound();
      } else {
        audioRef.current.playWordInvalid();
      }
    }
  }, [lastWordResult]);

  // Frozen/powerup sounds
  useEffect(() => {
    if (isFrozen) {
      audioRef.current.playPowerupFreeze();
    }
  }, [isFrozen]);

  useEffect(() => {
    if (blockedCells.length > 0) {
      audioRef.current.playPowerupBomb();
    }
  }, [blockedCells]);

  // Get cell from coordinates relative to board
  // Must account for CSS grid gap (gap-2 = 0.5rem = 8px at default font size)
  const getCellFromCoords = useCallback((clientX: number, clientY: number): { cell: [number, number] | null; localX: number; localY: number } => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { cell: null, localX: 0, localY: 0 };

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    
    // Get the actual gap size from computed style
    const computedStyle = boardRef.current ? getComputedStyle(boardRef.current) : null;
    const gapSize = computedStyle ? parseFloat(computedStyle.gap) || 8 : 8;
    
    // Cell size accounting for gaps
    const totalGapSpace = (boardSize - 1) * gapSize;
    const cellSize = (rect.width - totalGapSpace) / boardSize;
    const cellPlusGap = cellSize + gapSize;

    // Find which cell we're in
    const col = Math.floor(localX / cellPlusGap);
    const row = Math.floor(localY / cellPlusGap);

    if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) {
      return { cell: null, localX, localY };
    }

    // Calculate cell center accounting for gaps
    const cellCenterX = col * cellPlusGap + cellSize / 2;
    const cellCenterY = row * cellPlusGap + cellSize / 2;

    // Distance from touch to cell center (reduced sensitivity - must be closer to center)
    const distSq = (localX - cellCenterX) ** 2 + (localY - cellCenterY) ** 2;
    const hitRadiusSq = (cellSize * 0.4) ** 2;

    if (distSq <= hitRadiusSq) {
      return { cell: [row, col], localX, localY };
    }

    return { cell: null, localX, localY };
  }, [boardSize]);

  // Play chain sound immediately when path grows
  const playChainSound = useCallback((pathLength: number) => {
    const now = Date.now();
    if (now - lastSoundTimeRef.current > 50) {
      audioRef.current.playLetterChain(pathLength);
      lastSoundTimeRef.current = now;
    }
  }, []);

  // Keep blockedCells in a ref for use in handlers
  const blockedCellsRef = useRef(blockedCells);
  blockedCellsRef.current = blockedCells;

  const isCellBlocked = useCallback((r: number, c: number): boolean => {
    return blockedCellsRef.current.some(([br, bc]) => br === r && bc === c);
  }, []);

  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const touch = 'touches' in e ? e.touches[0] : e;
    const { cell, localX, localY } = getCellFromCoords(touch.clientX, touch.clientY);

    if (cell && !isCellBlocked(cell[0], cell[1])) {
      setIsDragging(true);
      setCurrentPath([cell]);
      setTouchPos({ x: localX, y: localY });
      audioRef.current.playLetterSelect();
      prevPathLengthRef.current = 1;
    }
  }, [getCellFromCoords, isCellBlocked]);

  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();

    const touch = 'touches' in e ? e.touches[0] : e;
    const { cell, localX, localY } = getCellFromCoords(touch.clientX, touch.clientY);

    // Always update touch position for smooth line
    setTouchPos({ x: localX, y: localY });

    if (!cell) return;

    // Don't allow selecting blocked cells
    if (isCellBlocked(cell[0], cell[1])) return;

    setCurrentPath(prevPath => {
      const last = prevPath[prevPath.length - 1];
      if (last[0] === cell[0] && last[1] === cell[1]) return prevPath;

      // Check if backtracking
      if (prevPath.length >= 2) {
        const secondToLast = prevPath[prevPath.length - 2];
        if (secondToLast[0] === cell[0] && secondToLast[1] === cell[1]) {
          return prevPath.slice(0, -1);
        }
      }

      // Check adjacency
      if (Math.abs(last[0] - cell[0]) <= 1 && Math.abs(last[1] - cell[1]) <= 1) {
        const existingIndex = prevPath.findIndex(p => p[0] === cell[0] && p[1] === cell[1]);
        if (existingIndex === -1) {
          // Play sound immediately when adding new cell
          playChainSound(prevPath.length + 1);
          prevPathLengthRef.current = prevPath.length + 1;
          return [...prevPath, cell];
        } else if (existingIndex < prevPath.length - 2) {
          return prevPath.slice(0, existingIndex + 1);
        }
      }

      return prevPath;
    });
  }, [isDragging, getCellFromCoords, playChainSound, isCellBlocked]);

  const handleEnd = useCallback(() => {
    if (currentPath.length >= 3) {
      const word = currentPath.map(([r, c]) => board[r][c]).join('');
      send('submit_word', { word, path: currentPath });
    }
    setIsDragging(false);
    setCurrentPath([]);
    setTouchPos(null);
    prevPathLengthRef.current = 0;
  }, [currentPath, board, send]);

  // Calculate line path with trailing line to touch position
  // Must account for CSS grid gap (gap-2 = 0.5rem = 8px at default font size)
  const linePath = useMemo((): string => {
    if (currentPath.length === 0) return '';

    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return '';

    // Get the actual gap size from computed style
    const computedStyle = boardRef.current ? getComputedStyle(boardRef.current) : null;
    const gapSize = computedStyle ? parseFloat(computedStyle.gap) || 8 : 8;
    
    // Total gap space = (boardSize - 1) * gapSize
    // Cell size = (rect.width - totalGapSpace) / boardSize
    const totalGapSpace = (boardSize - 1) * gapSize;
    const cellSize = (rect.width - totalGapSpace) / boardSize;

    // Build path through all selected cells
    // Cell center for index i = i * (cellSize + gapSize) + cellSize / 2
    let path = currentPath.map(([r, c], i) => {
      const x = c * (cellSize + gapSize) + cellSize / 2;
      const y = r * (cellSize + gapSize) + cellSize / 2;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

    // Add trailing line to current touch position
    if (touchPos && isDragging) {
      path += ` L ${touchPos.x} ${touchPos.y}`;
    }

    return path;
  }, [currentPath, boardSize, touchPos, isDragging]);

  // Memoize current word display
  const currentWord = useMemo(() => {
    if (currentPath.length === 0 || !board.length) return '';
    return currentPath.map(([r, c]) => board[r]?.[c] ?? '').join('');
  }, [currentPath, board]);

  // Create a Set for O(1) path lookups
  const pathSet = useMemo(() => {
    const set = new Map<string, number>();
    currentPath.forEach(([r, c], i) => set.set(`${r}-${c}`, i));
    return set;
  }, [currentPath]);

  // Create a Set for O(1) blocked cell lookups
  const blockedSet = useMemo(() => {
    return new Set(blockedCells.map(([r, c]) => `${r}-${c}`));
  }, [blockedCells]);

  const formattedTimer = useMemo(() => {
    const mins = Math.floor(timer / 60);
    const secs = timer % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [timer]);

  const me = useMemo(() => players.find(p => p.id === playerId), [players, playerId]);

  return (
    <div 
      className="game-board-container flex flex-col h-full bg-navy-gradient min-h-screen text-white select-none"
      style={{ 
        paddingTop: 'env(safe-area-inset-top, 12px)', 
        paddingLeft: 'env(safe-area-inset-left, 12px)', 
        paddingRight: 'env(safe-area-inset-right, 12px)', 
        paddingBottom: 'env(safe-area-inset-bottom, 12px)' 
      }}
    >
      {/* Header - Fixed position for visibility */}
      <div className={`sticky top-0 z-30 py-3 px-2 ${isFrozen ? 'animate-pulse text-blue-400' : ''}`}>
        <div className="flex justify-between items-center gap-2">
          {/* Timer */}
          <div className={`frosted-glass px-3 py-2 flex items-center space-x-2 shrink-0 ${isFrozen ? 'border-blue-400 border-2' : ''}`}>
            {isFrozen ? <Snowflake className="w-5 h-5 animate-spin" /> : <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />}
            <span className="text-xl sm:text-2xl font-black font-mono tabular-nums">{formattedTimer}</span>
          </div>
          
          {/* Current Word (center) */}
          <div className="flex-1 text-center min-w-0 overflow-hidden">
            {currentWord && (
              <div className="text-lg sm:text-2xl font-black tracking-wider text-primary animate-pulse truncate">
                {currentWord}
              </div>
            )}
          </div>
          
          {/* Score */}
          <div className="frosted-glass px-3 py-2 text-right shrink-0">
            <p className="text-[10px] sm:text-xs text-white/50 uppercase font-bold leading-none">Score</p>
            <p className="text-xl sm:text-2xl font-black text-primary leading-none">{me?.score || 0}</p>
          </div>
        </div>
      </div>

      {/* The Board - Simple w-full aspect-square that works on mobile */}
      <div className="w-full aspect-square mb-4 mt-2 px-1">
        {/* Grid of letters */}
        <div 
          ref={boardRef}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          className="relative grid gap-2 w-full h-full"
          style={{ 
            gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
            touchAction: 'none' 
          }}
        >
          {/* SVG Overlay for connecting lines - inside grid for correct alignment */}
          {linePath && (
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none z-20"
              style={{ overflow: 'visible' }}
            >
              {/* Glow effect (render first, behind main line) */}
              <path
                d={linePath}
                fill="none"
                stroke="rgba(139, 92, 246, 0.3)"
                strokeWidth="14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Main path line */}
              <path
                d={linePath}
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {board.map((row, r) => row.map((letter, c) => {
            const key = `${r}-${c}`;
            const pathIndex = pathSet.get(key) ?? -1;
            const isSelected = pathIndex !== -1;
            const isFirst = pathIndex === 0;
            const isLast = pathIndex === currentPath.length - 1 && currentPath.length > 0;
            const isBlocked = blockedSet.has(key);

            return (
              <Cell
                key={key}
                letter={letter}
                isSelected={isSelected}
                isFirst={isFirst}
                isLast={isLast}
                isBlocked={isBlocked}
                pathIndex={pathIndex}
              />
            );
          }))}
        </div>
      </div>

      {/* Power-ups */}
      <div className="flex justify-center space-x-4">
        {['freeze', 'blowup', 'shuffle'].map(p => {
          const count = me?.powerups?.filter(x => x === p).length || 0;
          return (
            <button
              key={p}
              disabled={count === 0}
              onClick={() => {
                send('use_powerup', { powerup: p });
                if (p === 'shuffle') {
                  audio.playPowerupShuffle();
                }
              }}
              className={`
                relative p-4 rounded-2xl frosted-glass transition-all
                ${count > 0 ? 'bg-primary/20 border-primary animate-pulse' : 'opacity-50'}
              `}
            >
              {p === 'freeze' && <Snowflake />}
              {p === 'blowup' && <Bomb />}
              {p === 'shuffle' && <RotateCw />}
              {count > 0 && (
                <span className="absolute -top-2 -right-2 bg-primary w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Word Result Popup */}
      <AnimatePresence mode="wait">
        {lastWordResult && (
          <motion.div
            key={lastWordResult.valid ? `valid-${lastWordResult.points}` : `invalid-${lastWordResult.reason}`}
            initial={{ y: 20, opacity: 0, scale: 0.8 }}
            animate={{ y: -50, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`
              fixed left-1/2 bottom-32 -translate-x-1/2 px-6 py-3 rounded-full font-bold z-50 flex flex-col items-center
              ${lastWordResult.valid ? 'bg-success text-white' : 'bg-error text-white'}
            `}
          >
            <span>{lastWordResult.valid ? `+${lastWordResult.points} POINTS!` : lastWordResult.reason}</span>
            {/* Powerup Earned Animation */}
            {lastWordResult.powerup && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
                className="flex items-center gap-2 mt-1 bg-yellow-500 text-black px-3 py-1 rounded-full text-sm"
              >
                {lastWordResult.powerup === 'freeze' && <Snowflake className="w-4 h-4" />}
                {lastWordResult.powerup === 'blowup' && <Bomb className="w-4 h-4" />}
                {lastWordResult.powerup === 'shuffle' && <RotateCw className="w-4 h-4" />}
                <span className="font-black uppercase text-xs">+1 {lastWordResult.powerup}!</span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
