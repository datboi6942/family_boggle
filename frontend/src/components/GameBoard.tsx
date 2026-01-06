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
  const points = LETTER_SCORES[letter.toUpperCase()] ?? 1;
  const isQU = letter.toUpperCase() === 'QU';

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
        bg-white/10 border border-white/20 shadow-lg
        ${isBlocked ? 'opacity-20 grayscale border-red-500 pointer-events-none' : ''}
      `}
    >
      <span className="cell-index absolute top-0.5 left-1 text-[8px] sm:text-[10px] font-bold text-white/70 hidden" />
      {displayLetter}
      <span className="cell-points absolute bottom-0.5 right-1 text-[8px] sm:text-[10px] font-bold text-primary/70">
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

// CSS for cell states - applied via direct DOM manipulation
// Simplified for Android compatibility - removed transforms that cause rendering issues
const CELL_STYLES = `
  .cell.selected {
    background: rgba(139, 92, 246, 0.8) !important;
    border: 2px solid white !important;
    transform: scale(1.1);
    z-index: 10;
    box-shadow: 0 0 20px rgba(139, 92, 246, 0.5);
  }
  .cell.selected .cell-index { display: block !important; }
  .cell.selected .cell-points { color: rgba(255,255,255,0.7) !important; }
  .cell.first {
    box-shadow: 0 0 0 2px #4ade80, 0 0 20px rgba(139, 92, 246, 0.5) !important;
  }
  .cell.last:not(.first) {
    background: white !important;
    color: #8B5CF6 !important;
  }
  .cell.last:not(.first) .cell-points { color: rgba(139, 92, 246, 0.7) !important; }
`;

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

  // Minimal React state - only for things that MUST trigger re-render
  const [currentWord, setCurrentWord] = useState('');
  const boardRef = useRef<HTMLDivElement>(null);
  const musicStartedRef = useRef(false);
  const lastTimerRef = useRef<number>(timer);
  const lastSoundTimeRef = useRef(0);
  const prevPathLengthRef = useRef(0);

  // Canvas ref for butter-smooth 60fps trail rendering
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  // Cell DOM refs for direct manipulation - NO REACT RE-RENDERS
  const cellRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  // All path state in refs - NO React state during drag
  const touchPosRef = useRef<{ x: number; y: number } | null>(null);
  const currentPathRef = useRef<[number, number][]>([]);
  const isDraggingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const boardDimensionsRef = useRef<{ cellSize: number; gapSize: number; totalGapSpace: number } | null>(null);
  const boardRectRef = useRef<DOMRect | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);
  const pathPointsRef = useRef<{ x: number; y: number }[]>([]); // Cached pixel positions

  // Tap mode state - allows tapping letters sequentially to build words
  const tapModeActiveRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  const tapSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const TAP_TIMEOUT_MS = 1500; // 1.5 seconds to tap next letter or auto-submit
  
  // Inject cell styles once on mount
  useEffect(() => {
    const styleId = 'cell-highlight-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = CELL_STYLES;
      document.head.appendChild(style);
    }
  }, []);

  // Direct DOM manipulation for cell highlighting - NO REACT
  const updateCellHighlights = useCallback(() => {
    const path = currentPathRef.current;
    const cellRefs = cellRefsMap.current;

    // Clear all highlights first
    cellRefs.forEach((el) => {
      el.classList.remove('selected', 'first', 'last');
      const indexEl = el.querySelector('.cell-index') as HTMLElement;
      if (indexEl) indexEl.textContent = '';
    });

    // Apply highlights to path cells
    path.forEach(([r, c], i) => {
      const key = `${r}-${c}`;
      const el = cellRefs.get(key);
      if (el) {
        el.classList.add('selected');
        if (i === 0) el.classList.add('first');
        if (i === path.length - 1) el.classList.add('last');
        const indexEl = el.querySelector('.cell-index') as HTMLElement;
        if (indexEl) indexEl.textContent = String(i + 1);
      }
    });

    // Update current word display
    if (path.length > 0) {
      const word = path.map(([r, c]) => board[r]?.[c] ?? '').join('');
      setCurrentWord(word);
    } else {
      setCurrentWord('');
    }
  }, [board]);

  // Update path pixel positions for canvas drawing
  const updatePathPoints = useCallback(() => {
    const path = currentPathRef.current;
    const dims = boardDimensionsRef.current;

    if (path.length === 0 || !dims) {
      pathPointsRef.current = [];
      return;
    }

    const { cellSize, gapSize } = dims;
    pathPointsRef.current = path.map(([r, c]) => ({
      x: c * (cellSize + gapSize) + cellSize / 2,
      y: r * (cellSize + gapSize) + cellSize / 2,
    }));
  }, []);

  // Canvas drawing function - pure pixel operations, no DOM
  const drawTrail = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const points = pathPointsRef.current;
    const touchPos = touchPosRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length === 0) return;

    // Scale for device pixel ratio
    ctx.save();
    ctx.scale(dpr, dpr);

    // Build the path
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    if (points.length === 1) {
      // Single point with trailing line
      if (touchPos && isDraggingRef.current) {
        const cpX = points[0].x + (touchPos.x - points[0].x) * 0.5;
        const cpY = points[0].y + (touchPos.y - points[0].y) * 0.5;
        ctx.quadraticCurveTo(cpX, cpY, touchPos.x, touchPos.y);
      }
    } else {
      // Multiple points - smooth curves
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = i < points.length - 1 ? points[i + 1] : null;

        if (next) {
          const midX = (curr.x + next.x) / 2;
          const midY = (curr.y + next.y) / 2;
          const cpX = (prev.x + midX) / 2;
          const cpY = (prev.y + midY) / 2;
          ctx.quadraticCurveTo(cpX, cpY, curr.x, curr.y);
        } else {
          const dx = curr.x - prev.x;
          const dy = curr.y - prev.y;
          const cpX = curr.x - dx * 0.2;
          const cpY = curr.y - dy * 0.2;
          ctx.quadraticCurveTo(cpX, cpY, curr.x, curr.y);
        }
      }

      // Trailing line to touch position
      if (touchPos && isDraggingRef.current) {
        const last = points[points.length - 1];
        const dx = touchPos.x - last.x;
        const dy = touchPos.y - last.y;
        const cpX = last.x + dx * 0.5;
        const cpY = last.y + dy * 0.5;
        ctx.quadraticCurveTo(cpX, cpY, touchPos.x, touchPos.y);
      }
    }

    // Draw glow (thicker, semi-transparent)
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.3)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Draw main line
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.restore();
  }, []);

  // Keep a ref to audio so effects can access latest version
  const audioRef = useRef(audio);
  audioRef.current = audio;

  // Force scroll to top when game starts
  // This ensures the board is properly positioned and touch coordinates are accurate
  useEffect(() => {
    // Scroll to top immediately
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Simple overflow hidden approach - avoids Android rendering bugs with position:fixed
    const originalOverflow = document.documentElement.style.overflow;
    const originalBodyOverflow = document.body.style.overflow;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      // Restore scroll when leaving game
      document.documentElement.style.overflow = originalOverflow;
      document.body.style.overflow = originalBodyOverflow;
    };
  }, []);

  // Pre-computed cell centers for ultra-fast hit detection
  const cellCentersRef = useRef<{ x: number; y: number }[][]>([]);

  // Initialize canvas context and handle resize with throttling
  useEffect(() => {
    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board) return;

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

    const setupCanvas = () => {
      const rect = board.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Set canvas size accounting for device pixel ratio for crisp lines
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      // Get and cache context - removed desynchronized option for Android compatibility
      const ctx = canvas.getContext('2d', { alpha: true });
      if (ctx) {
        ctxRef.current = ctx;
      }

      // Update board dimensions
      const computedStyle = getComputedStyle(board);
      const gapSize = parseFloat(computedStyle.gap) || 8;
      const totalGapSpace = (boardSize - 1) * gapSize;
      const cellSize = (rect.width - totalGapSpace) / boardSize;
      const cellPlusGap = cellSize + gapSize;

      boardDimensionsRef.current = { cellSize, gapSize, totalGapSpace };

      // Pre-compute all cell centers for O(1) hit detection
      const centers: { x: number; y: number }[][] = [];
      for (let r = 0; r < boardSize; r++) {
        centers[r] = [];
        for (let c = 0; c < boardSize; c++) {
          centers[r][c] = {
            x: c * cellPlusGap + cellSize / 2,
            y: r * cellPlusGap + cellSize / 2
          };
        }
      }
      cellCentersRef.current = centers;
    };

    // Throttled resize handler
    const throttledSetup = () => {
      if (resizeTimeout) return;
      resizeTimeout = setTimeout(() => {
        setupCanvas();
        resizeTimeout = null;
      }, 100);
    };

    // Initial setup
    setupCanvas();

    // Handle resize with throttling
    const resizeObserver = new ResizeObserver(throttledSetup);
    resizeObserver.observe(board);

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, [boardSize]);

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

  // Track if intense mode has been activated
  const intenseActivatedRef = useRef(false);

  // Timer sounds and intense mode trigger
  useEffect(() => {
    if (timer !== lastTimerRef.current) {
      // Switch to INTENSE music when timer hits 30 seconds!
      if (timer === 30 && !intenseActivatedRef.current) {
        intenseActivatedRef.current = true;
        audioRef.current.playGameplayIntenseMusic();
      }
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

  // Cache board dimensions to avoid recalculating on every call
  const updateBoardDimensions = useCallback(() => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;

    const computedStyle = boardRef.current ? getComputedStyle(boardRef.current) : null;
    const gapSize = computedStyle ? parseFloat(computedStyle.gap) || 8 : 8;
    const totalGapSpace = (boardSize - 1) * gapSize;
    const cellSize = (rect.width - totalGapSpace) / boardSize;
    
    boardDimensionsRef.current = { cellSize, gapSize, totalGapSpace };
    return boardDimensionsRef.current;
  }, [boardSize]);

  // Get cell from coordinates relative to board
  // Must account for CSS grid gap (gap-2 = 0.5rem = 8px at default font size)
  // Uses cached rect during drag for performance
  const getCellFromCoords = useCallback((clientX: number, clientY: number, useCachedRect = false): { cell: [number, number] | null; localX: number; localY: number } => {
    // Use cached rect during drag, fresh rect otherwise
    const rect = useCachedRect && boardRectRef.current
      ? boardRectRef.current
      : boardRef.current?.getBoundingClientRect();
    if (!rect) return { cell: null, localX: 0, localY: 0 };

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;

    // Use cached dimensions or calculate if not available
    let dims = boardDimensionsRef.current;
    if (!dims) {
      dims = updateBoardDimensions();
      if (!dims) return { cell: null, localX, localY };
    }

    const { cellSize, gapSize } = dims;
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

    // Distance from touch to cell center
    const distSq = (localX - cellCenterX) ** 2 + (localY - cellCenterY) ** 2;
    const hitRadiusSq = (cellSize * 0.45) ** 2;

    if (distSq <= hitRadiusSq) {
      return { cell: [row, col], localX, localY };
    }

    return { cell: null, localX, localY };
  }, [boardSize, updateBoardDimensions]);

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

  // Helper to check if two cells are adjacent
  const isAdjacent = useCallback((cell1: [number, number], cell2: [number, number]): boolean => {
    const rowDiff = Math.abs(cell1[0] - cell2[0]);
    const colDiff = Math.abs(cell1[1] - cell2[1]);
    return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
  }, []);

  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();

    // Cache the board rect at drag start to avoid repeated DOM measurements
    boardRectRef.current = boardRef.current?.getBoundingClientRect() || null;
    // Also cache dimensions
    updateBoardDimensions();

    const touch = 'touches' in e ? e.touches[0] : e;
    const { cell, localX, localY } = getCellFromCoords(touch.clientX, touch.clientY, true);

    if (cell && !isCellBlocked(cell[0], cell[1])) {
      // Track initial position to distinguish clicks from drags
      dragStartPosRef.current = { x: localX, y: localY };
      hasMovedRef.current = false;
      touchPosRef.current = { x: localX, y: localY };

      const now = Date.now();
      const timeSinceLastTap = now - lastTapTimeRef.current;
      const currentPath = currentPathRef.current;

      // Check if we should continue a tap sequence
      if (tapModeActiveRef.current && timeSinceLastTap < TAP_TIMEOUT_MS && currentPath.length > 0) {
        const lastCell = currentPath[currentPath.length - 1];

        // Check if this cell is already in the path (allow backtracking by tapping previous cell)
        const existingIndex = currentPath.findIndex(([r, c]) => r === cell[0] && c === cell[1]);

        if (existingIndex !== -1) {
          // Backtrack to this cell
          currentPathRef.current = currentPath.slice(0, existingIndex + 1);
          audioRef.current.playLetterSelect();
        } else if (isAdjacent(lastCell, cell)) {
          // Adjacent cell - add to path
          currentPathRef.current = [...currentPath, cell];
          playChainSound(currentPath.length + 1);
        } else {
          // Not adjacent - start fresh sequence
          currentPathRef.current = [cell];
          audioRef.current.playLetterSelect();
        }

        prevPathLengthRef.current = currentPathRef.current.length;
      } else {
        // Start new sequence (either not in tap mode, or timed out)
        // Cancel any existing tap timer
        if (tapSubmitTimerRef.current) {
          clearTimeout(tapSubmitTimerRef.current);
          tapSubmitTimerRef.current = null;
        }
        tapModeActiveRef.current = false;

        currentPathRef.current = [cell];
        audioRef.current.playLetterSelect();
        prevPathLengthRef.current = 1;
      }

      // Set path in ref only - NO React state update
      isDraggingRef.current = true;
      updatePathPoints();
      updateCellHighlights();

      // Start the animation loop - canvas redraws at 60fps
      const animate = () => {
        if (!isDraggingRef.current) return;
        drawTrail();
        rafIdRef.current = requestAnimationFrame(animate);
      };
      rafIdRef.current = requestAnimationFrame(animate);
    }
  }, [getCellFromCoords, isCellBlocked, updateBoardDimensions, drawTrail, updatePathPoints, updateCellHighlights, isAdjacent, playChainSound]);

  // Ultra-optimized move handler - uses pre-computed cell centers, minimal allocations
  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();

    const touch = 'touches' in e ? e.touches[0] : e;
    const rect = boardRectRef.current;
    if (!rect) return;

    const localX = touch.clientX - rect.left;
    const localY = touch.clientY - rect.top;

    // Update touch position ref - animation loop picks this up
    touchPosRef.current = { x: localX, y: localY };

    // Track if user has moved (to distinguish click from drag)
    // Use higher threshold (15px) for mobile touch to avoid false positives
    const startPos = dragStartPosRef.current;
    if (startPos && !hasMovedRef.current) {
      const dx = localX - startPos.x;
      const dy = localY - startPos.y;
      if (dx * dx + dy * dy > 225) { // 15 pixels squared
        hasMovedRef.current = true;
      }
    }

    // Use pre-computed dimensions
    const dims = boardDimensionsRef.current;
    const centers = cellCentersRef.current;
    if (!dims || centers.length === 0) return;

    const { cellSize, gapSize } = dims;
    const cellPlusGap = cellSize + gapSize;
    const col = Math.floor(localX / cellPlusGap);
    const row = Math.floor(localY / cellPlusGap);

    // Bounds check
    if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) return;

    // Use pre-computed cell center for O(1) lookup
    const center = centers[row]?.[col];
    if (!center) return;

    const dx = localX - center.x;
    const dy = localY - center.y;
    const distSq = dx * dx + dy * dy;
    const hitRadiusSq = (cellSize * 0.45) ** 2;

    if (distSq > hitRadiusSq) return;
    if (isCellBlocked(row, col)) return;

    const prevPath = currentPathRef.current;
    const pathLen = prevPath.length;
    if (pathLen === 0) return;

    const last = prevPath[pathLen - 1];
    if (last[0] === row && last[1] === col) return;

    let pathChanged = false;

    // Check if backtracking (going back to previous cell)
    if (pathLen >= 2) {
      const secondToLast = prevPath[pathLen - 2];
      if (secondToLast[0] === row && secondToLast[1] === col) {
        currentPathRef.current = prevPath.slice(0, -1);
        pathChanged = true;
      }
    }

    // Check adjacency for new cell
    if (!pathChanged) {
      const rowDiff = Math.abs(last[0] - row);
      const colDiff = Math.abs(last[1] - col);

      if (rowDiff <= 1 && colDiff <= 1) {
        // Check if cell already in path
        let existingIndex = -1;
        for (let i = 0; i < pathLen; i++) {
          if (prevPath[i][0] === row && prevPath[i][1] === col) {
            existingIndex = i;
            break;
          }
        }

        if (existingIndex === -1) {
          // New cell - add to path
          playChainSound(pathLen + 1);
          prevPathLengthRef.current = pathLen + 1;
          currentPathRef.current = [...prevPath, [row, col] as [number, number]];
          pathChanged = true;
        } else if (existingIndex < pathLen - 2) {
          // Backtrack to earlier cell
          currentPathRef.current = prevPath.slice(0, existingIndex + 1);
          pathChanged = true;
        }
      }
    }

    // Update DOM directly if path changed - NO React re-render
    if (pathChanged) {
      updatePathPoints();
      updateCellHighlights();
    }
  }, [boardSize, playChainSound, isCellBlocked, updatePathPoints, updateCellHighlights]);

  // Helper to submit word in tap mode
  const submitTapWord = useCallback(() => {
    const path = currentPathRef.current;
    if (path.length >= 3) {
      const word = path.map(([r, c]) => board[r][c]).join('');
      send('submit_word', { word, path });
    }

    // Clear tap mode state
    tapModeActiveRef.current = false;
    currentPathRef.current = [];
    pathPointsRef.current = [];
    prevPathLengthRef.current = 0;
    updateCellHighlights();
    setCurrentWord('');

    // Clear canvas
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [board, send, updateCellHighlights]);

  // Start/restart tap mode timer
  const restartTapTimer = useCallback(() => {
    // Clear existing timer
    if (tapSubmitTimerRef.current) {
      clearTimeout(tapSubmitTimerRef.current);
    }
    // Start new timer
    tapSubmitTimerRef.current = setTimeout(() => {
      submitTapWord();
    }, TAP_TIMEOUT_MS);
  }, [submitTapWord]);

  const handleEnd = useCallback(() => {
    // Stop the animation loop first
    isDraggingRef.current = false;

    // Cancel any pending animation frame
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const path = currentPathRef.current;
    const hadMovement = hasMovedRef.current;
    const now = Date.now();

    // Check if this was a tap (no movement) - path already updated in handleStart
    if (!hadMovement && path.length >= 1) {
      const timeSinceLastTap = now - lastTapTimeRef.current;

      // Check if we're continuing a tap sequence (handleStart already updated the path)
      if (tapModeActiveRef.current && timeSinceLastTap < TAP_TIMEOUT_MS) {
        // This tap was already added in handleStart, just update timer
        lastTapTimeRef.current = now;
        restartTapTimer();
      } else {
        // Start new tap mode sequence
        tapModeActiveRef.current = true;
        lastTapTimeRef.current = now;
        restartTapTimer();
      }

      // Keep the path and highlights visible, draw the trail
      updatePathPoints();
      updateCellHighlights();
      drawTrail(); // Draw trail statically for tap mode (animation loop is stopped)

      // Reset drag-specific state but keep tap state
      dragStartPosRef.current = null;
      hasMovedRef.current = false;
      boardRectRef.current = null;
      touchPosRef.current = null;
      return;
    }

    // Reset drag state
    dragStartPosRef.current = null;
    hasMovedRef.current = false;
    boardRectRef.current = null;
    touchPosRef.current = null;

    // If it was a drag with movement, submit and clear tap mode
    if (hadMovement && path.length >= 3) {
      // Cancel any tap timer
      if (tapSubmitTimerRef.current) {
        clearTimeout(tapSubmitTimerRef.current);
        tapSubmitTimerRef.current = null;
      }
      tapModeActiveRef.current = false;

      const word = path.map(([r, c]) => board[r][c]).join('');
      send('submit_word', { word, path });
    }

    // If we were dragging (not in tap mode), clear everything
    if (hadMovement || !tapModeActiveRef.current) {
      // Cancel tap timer if dragging
      if (tapSubmitTimerRef.current) {
        clearTimeout(tapSubmitTimerRef.current);
        tapSubmitTimerRef.current = null;
      }
      tapModeActiveRef.current = false;

      // Clear path and update DOM
      currentPathRef.current = [];
      pathPointsRef.current = [];
      prevPathLengthRef.current = 0;
      updateCellHighlights();
      setCurrentWord('');

      // Clear canvas
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [board, send, updateCellHighlights, updatePathPoints, restartTapTimer, drawTrail]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (tapSubmitTimerRef.current !== null) {
        clearTimeout(tapSubmitTimerRef.current);
      }
    };
  }, []);

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
      className="game-board-container grid bg-navy-gradient text-white select-none p-2 overflow-hidden"
      style={{
        height: '100dvh', // Use dynamic viewport height for mobile
        minHeight: '100vh', // Fallback for browsers without dvh support
        paddingTop: 'env(safe-area-inset-top, 8px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 16px)', // Extra padding for browser chrome
        gridTemplateRows: 'auto 1fr 70px', // Header, Board, Power-ups (70px for visibility)
      }}
    >
      {/* Header */}
      <div className={`py-1 ${isFrozen ? 'animate-pulse text-blue-400' : ''}`}>
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

      {/* The Board - Constrained square container that fits in available space */}
      <div className="flex items-center justify-center overflow-hidden min-h-0 py-1">
        <div
          className="relative w-full"
          style={{
            aspectRatio: '1/1',
            maxWidth: 'min(100%, calc(100dvh - 220px))',
            maxHeight: 'calc(100dvh - 220px)',
          }}
        >
          {/* Grid of letters - absolutely positioned to fill the square container */}
          <div
            ref={boardRef}
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
            className="game-board-grid absolute inset-0 grid gap-2 w-full h-full"
            style={{
              gridTemplateColumns: `repeat(${boardSize}, 1fr)`,
              touchAction: 'none'
            }}
          >
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
                cellRef={(el) => {
                  if (el) {
                    cellRefsMap.current.set(key, el);
                  } else {
                    cellRefsMap.current.delete(key);
                  }
                }}
              />
            );
          }))}
          </div>
          {/* Canvas overlay for trail rendering - OUTSIDE grid to avoid Android rendering issues */}
          <canvas
            ref={canvasRef}
            className="trail-canvas absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 20 }}
          />
        </div>
      </div>

      {/* Power-ups - ensure always visible at bottom */}
      <div className="flex justify-center items-center space-x-4 py-2" style={{ minHeight: '70px' }}>
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
                relative p-3 rounded-xl frosted-glass transition-all
                ${count > 0 ? 'bg-primary/20 border-primary animate-pulse' : 'opacity-50'}
              `}
            >
              {p === 'freeze' && <Snowflake className="w-5 h-5" />}
              {p === 'blowup' && <Bomb className="w-5 h-5" />}
              {p === 'shuffle' && <RotateCw className="w-5 h-5" />}
              {count > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold">
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

