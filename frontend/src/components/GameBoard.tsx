import { useRef, useCallback, useMemo, memo, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
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
// iOS: use recording-pulse (transform-based) instead of animate-pulse (opacity-based)
const TimerDisplay = memo(({ formattedTimer, isFrozen }: { formattedTimer: string; isFrozen: boolean }) => (
  <div className={`flex items-center gap-2 ${isFrozen ? 'text-blue-400' : 'text-white'}`}>
    {isFrozen ? <Snowflake className="w-4 h-4 animate-spin" /> : <div className="w-2 h-2 bg-red-500 rounded-full recording-pulse" />}
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

// Detect iOS once at module load
const IS_IOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

// CSS for cell states - applied via direct DOM manipulation
// iOS: NO transitions, NO animations - instant state changes only
// Android: smooth transitions
const CELL_STYLES = IS_IOS ? `
  .cell {
    /* iOS: NO transitions - they cause lag during touch */
  }
  .cell.selected {
    background: rgba(139, 92, 246, 0.8) !important;
    border: 2px solid white !important;
    transform: scale(1.08);
    z-index: 10;
  }
  .cell.selected .cell-index { display: block !important; }
  .cell.selected .cell-points { color: rgba(255,255,255,0.7) !important; }
  .cell.first {
    border-color: #4ade80 !important;
  }
  .cell.last:not(.first) {
    background: white !important;
    color: #8B5CF6 !important;
  }
  .cell.last:not(.first) .cell-points { color: rgba(139, 92, 246, 0.7) !important; }
` : `
  .cell {
    transition: transform 0.08s ease-out, background 0.08s ease-out;
    backface-visibility: hidden;
  }
  .cell.selected {
    background: rgba(139, 92, 246, 0.8) !important;
    border: 2px solid white !important;
    transform: scale(1.1) translate3d(0,0,0);
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
  // Use shallow comparison to prevent unnecessary re-renders when unrelated state changes
  const { playerId, board, boardSize, timer, lastWordResult, players, blockedCells, isFrozen } = useGameStore(
    useShallow(state => ({
      playerId: state.playerId,
      board: state.board,
      boardSize: state.boardSize,
      timer: state.timer,
      lastWordResult: state.lastWordResult,
      players: state.players,
      blockedCells: state.blockedCells,
      isFrozen: state.isFrozen,
    }))
  );

  const { send } = useWebSocketContext();
  const audio = useAudioContext();

  // NO React state during drag - use refs for everything
  const currentWordRef = useRef('');
  const wordDisplayRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const musicStartedRef = useRef(false);
  const lastTimerRef = useRef<number>(timer);
  const lastSoundTimeRef = useRef(0);
  const prevPathLengthRef = useRef(0);

  // Canvas ref for butter-smooth 60fps trail rendering (Android/Desktop)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const dprRef = useRef<number>(window.devicePixelRatio || 1); // Cache DPR to avoid reading every frame

  // iOS: SVG-based trail (hardware accelerated, no canvas performance issues)
  const svgPathRef = useRef<SVGPolylineElement>(null);

  // iOS detection - use module-level constant
  const isIOSRef = useRef<boolean>(IS_IOS);

  // Interpolation state for smoother trailing line
  const interpolatedTouchRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Cell DOM refs for direct manipulation - NO REACT RE-RENDERS
  const cellRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  // All path state in refs - NO React state during drag
  const touchPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPathRef = useRef<[number, number][]>([]);
  const previousPathRef = useRef<Set<string>>(new Set()); // Track previously highlighted cells for efficient updates
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

  // Throttling for handleMove - limit to ~60fps (16ms between updates)
  const lastMoveProcessTimeRef = useRef(0);
  const MOVE_THROTTLE_MS = 16;
  
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

  // Direct DOM manipulation for cell highlighting - NO REACT RE-RENDERS
  // iOS: ultra-minimal DOM updates - skip index numbers and minimize class toggles
  const updateCellHighlights = useCallback(() => {
    const path = currentPathRef.current;
    const cellRefs = cellRefsMap.current;
    const prevPath = previousPathRef.current;

    // Build current path set for efficient lookup
    const currentPathSet = new Set<string>();
    path.forEach(([r, c]) => currentPathSet.add(`${r}-${c}`));

    // Clear highlights only from cells that were highlighted but aren't in current path
    prevPath.forEach((key) => {
      if (!currentPathSet.has(key)) {
        const el = cellRefs.get(key);
        if (el) {
          el.classList.remove('selected', 'first', 'last');
          // iOS: skip index update - unnecessary DOM write
          if (!IS_IOS) {
            const indexEl = el.querySelector('.cell-index') as HTMLElement;
            if (indexEl) indexEl.textContent = '';
          }
        }
      }
    });

    // Apply highlights to path cells
    const pathLen = path.length;
    path.forEach(([r, c], i) => {
      const key = `${r}-${c}`;
      const el = cellRefs.get(key);
      if (el) {
        // Always update classes since position in path may have changed
        el.classList.add('selected');
        el.classList.toggle('first', i === 0);
        el.classList.toggle('last', i === pathLen - 1);
        // iOS: skip index update - unnecessary DOM write
        if (!IS_IOS) {
          const indexEl = el.querySelector('.cell-index') as HTMLElement;
          if (indexEl) indexEl.textContent = String(i + 1);
        }
      }
    });

    // Update previous path for next comparison
    previousPathRef.current = currentPathSet;

    // Update current word display via direct DOM (NO React re-render)
    const wordDisplay = wordDisplayRef.current;
    if (wordDisplay) {
      if (pathLen > 0) {
        const word = path.map(([r, c]) => board[r]?.[c] ?? '').join('');
        currentWordRef.current = word;
        wordDisplay.textContent = word;
        wordDisplay.style.display = 'block';
      } else {
        currentWordRef.current = '';
        wordDisplay.textContent = '';
        wordDisplay.style.display = 'none';
      }
    }
  }, [board]);

  // Update path pixel positions for trail drawing
  // iOS: updates SVG polyline points attribute
  // Android: updates canvas path points
  const updatePathPoints = useCallback(() => {
    const path = currentPathRef.current;
    const dims = boardDimensionsRef.current;

    if (path.length === 0 || !dims) {
      pathPointsRef.current = [];
      // iOS: clear SVG path
      if (IS_IOS && svgPathRef.current) {
        svgPathRef.current.setAttribute('points', '');
      }
      return;
    }

    const { cellSize, gapSize } = dims;
    pathPointsRef.current = path.map(([r, c]) => ({
      x: c * (cellSize + gapSize) + cellSize / 2,
      y: r * (cellSize + gapSize) + cellSize / 2,
    }));

    // iOS: update SVG polyline directly (no animation loop needed)
    // Include finger position if dragging
    if (IS_IOS && svgPathRef.current) {
      let pointsStr = pathPointsRef.current.map(p => `${p.x},${p.y}`).join(' ');
      // Add current touch position if dragging
      if (isDraggingRef.current) {
        const touch = touchPosRef.current;
        pointsStr += ` ${touch.x},${touch.y}`;
      }
      svgPathRef.current.setAttribute('points', pointsStr);
    }
  }, []);

  // iOS: update SVG trail with current finger position during drag
  const updateIOSSvgTrail = useCallback(() => {
    if (!IS_IOS || !svgPathRef.current || !isDraggingRef.current) return;

    const points = pathPointsRef.current;
    if (points.length === 0) return;

    const touch = touchPosRef.current;
    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ') + ` ${touch.x},${touch.y}`;
    svgPathRef.current.setAttribute('points', pointsStr);
  }, []);

  // Canvas drawing function - ultra-optimized for 60fps
  // iOS: DISABLED - canvas during touch is fundamentally broken on iOS Safari
  // Android: full effects with shadow glow
  const drawTrail = useCallback(() => {
    // iOS: Skip canvas rendering entirely - rely on CSS cell highlights only
    if (isIOSRef.current) return;

    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    const dpr = dprRef.current;
    const points = pathPointsRef.current;
    const touchPos = touchPosRef.current;
    const isDragging = isDraggingRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length === 0) return;

    const interp = interpolatedTouchRef.current;

    // Android/Desktop: smooth interpolation
    if (isDragging) {
      interp.x += (touchPos.x - interp.x) * 0.5;
      interp.y += (touchPos.y - interp.y) * 0.5;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    if (isDragging) {
      ctx.lineTo(interp.x, interp.y);
    }

    // Android: shadow for nice glow
    ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
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

  // Calculate board dimensions and cell centers (runs on BOTH iOS and Android)
  // This is separate from canvas setup because iOS doesn't use canvas
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;

    const setupBoardDimensions = () => {
      const rect = board.getBoundingClientRect();

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
        setupBoardDimensions();
        resizeTimeout = null;
      }, 100);
    };

    // Initial setup
    setupBoardDimensions();

    // Handle resize with throttling
    const resizeObserver = new ResizeObserver(throttledSetup);
    resizeObserver.observe(board);

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, [boardSize]);

  // Initialize canvas context (Android/Desktop only - iOS uses SVG)
  useEffect(() => {
    if (IS_IOS) return; // iOS uses SVG, not canvas

    const canvas = canvasRef.current;
    const board = boardRef.current;
    if (!canvas || !board) return;

    const setupCanvas = () => {
      const rect = board.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      // Set canvas size accounting for device pixel ratio for crisp lines
      // Note: Setting width/height clears the canvas AND resets context state
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      // Get context (or reuse existing reference)
      let ctx = ctxRef.current;
      if (!ctx) {
        ctx = canvas.getContext('2d', { alpha: true });
        ctxRef.current = ctx;
      }

      // IMPORTANT: Must reapply context settings after EVERY resize
      // because setting canvas.width/height resets all context state
      if (ctx) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }

      // Update cached DPR
      dprRef.current = dpr;
    };

    // Initial setup
    setupCanvas();

    // Handle resize
    const resizeObserver = new ResizeObserver(() => setupCanvas());
    resizeObserver.observe(board);

    return () => {
      resizeObserver.disconnect();
    };
  }, [boardSize]);

  // OPTIMIZED: Animation loop that only runs during active drag
  // iOS: completely disabled - no canvas animation needed
  const startAnimationLoop = useCallback(() => {
    // iOS: skip animation loop entirely - we only use CSS cell highlights
    if (isIOSRef.current) return;

    if (rafIdRef.current !== null) return; // Already running

    const animate = () => {
      // Stop if no longer dragging and no path to show
      if (!isDraggingRef.current && pathPointsRef.current.length === 0) {
        rafIdRef.current = null;
        return;
      }

      drawTrail();
      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);
  }, [drawTrail]);

  const stopAnimationLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnimationLoop();
    };
  }, [stopAnimationLoop]);

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
  // iOS: throttle more aggressively to prevent lag during rapid dragging
  const playChainSound = useCallback((pathLength: number) => {
    const now = Date.now();
    const minInterval = IS_IOS ? 150 : 50; // iOS needs more throttling
    if (now - lastSoundTimeRef.current > minInterval) {
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
      // Update in place to avoid allocation
      touchPosRef.current.x = localX;
      touchPosRef.current.y = localY;
      // Initialize interpolated position to avoid jump from (0,0)
      interpolatedTouchRef.current.x = localX;
      interpolatedTouchRef.current.y = localY;

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

      // Start animation loop and draw immediately
      startAnimationLoop();
    }
  }, [getCellFromCoords, isCellBlocked, updateBoardDimensions, updatePathPoints, updateCellHighlights, isAdjacent, playChainSound, startAnimationLoop]);

  // Ultra-optimized move handler - uses pre-computed cell centers, minimal allocations
  // THROTTLED to ~60fps to prevent excessive processing on mobile
  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    e.preventDefault();

    const touch = 'touches' in e ? e.touches[0] : e;
    const rect = boardRectRef.current;
    if (!rect) return;

    const localX = touch.clientX - rect.left;
    const localY = touch.clientY - rect.top;

    // ALWAYS update touch position for smooth trail drawing (not throttled)
    touchPosRef.current.x = localX;
    touchPosRef.current.y = localY;

    // iOS: update SVG trail immediately with finger position
    if (IS_IOS) {
      updateIOSSvgTrail();
    }

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

    // THROTTLE: Skip expensive cell detection if called too frequently
    // iOS: no throttle needed - SVG updates are cheap and we want responsive cell detection
    if (!IS_IOS) {
      const now = performance.now();
      if (now - lastMoveProcessTimeRef.current < MOVE_THROTTLE_MS) {
        return; // Skip this frame, touch position is already updated for canvas
      }
      lastMoveProcessTimeRef.current = now;
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
  }, [boardSize, playChainSound, isCellBlocked, updatePathPoints, updateCellHighlights, updateIOSSvgTrail]);

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
    updateCellHighlights(); // This also clears the word display

    // Clear trail (canvas or SVG)
    if (IS_IOS) {
      if (svgPathRef.current) {
        svgPathRef.current.setAttribute('points', '');
      }
    } else {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
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
    // Mark drag as ended - animation loop will stop itself when path is cleared
    isDraggingRef.current = false;

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
      return;
    }

    // Reset drag state
    dragStartPosRef.current = null;
    hasMovedRef.current = false;
    boardRectRef.current = null;

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
      updateCellHighlights(); // This also clears the word display

      // Clear trail (canvas or SVG)
      if (IS_IOS) {
        if (svgPathRef.current) {
          svgPathRef.current.setAttribute('points', '');
        }
      } else {
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [board, send, updateCellHighlights, updatePathPoints, restartTapTimer, drawTrail]);

  // Cleanup tap timer on unmount (animation loop cleanup is handled separately)
  useEffect(() => {
    return () => {
      if (tapSubmitTimerRef.current !== null) {
        clearTimeout(tapSubmitTimerRef.current);
      }
    };
  }, []);

  // Create a Set for O(1) blocked cell lookups
  const blockedSet = useMemo(() => {
    return new Set(blockedCells.map(([r, c]) => `${r}-${c}`));
  }, [blockedCells]);

  // Create stable ref callbacks for cells - prevents memo bypass
  const cellRefCallbacks = useMemo(() => {
    const callbacks = new Map<string, (el: HTMLDivElement | null) => void>();
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const key = `${r}-${c}`;
        callbacks.set(key, (el: HTMLDivElement | null) => {
          if (el) {
            cellRefsMap.current.set(key, el);
          } else {
            cellRefsMap.current.delete(key);
          }
        });
      }
    }
    return callbacks;
  }, [boardSize]);

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
        height: 'calc(100svh - 50px)', // Aggressively shrink to guarantee power-ups visible above browser chrome
        maxHeight: 'calc(-webkit-fill-available - 50px)', // iOS Safari fallback
        paddingTop: 'env(safe-area-inset-top, 8px)',
        paddingBottom: '16px',
        gridTemplateRows: 'auto 1fr 80px', // Header, Board, Power-ups (80px for visibility)
      }}
    >
      {/* Header */}
      {/* iOS: use ios-pulse (transform-based) instead of animate-pulse (opacity-based) */}
      <div className={`py-1 ${isFrozen ? 'ios-pulse text-blue-400' : ''}`}>
        <div className="flex justify-between items-center gap-2">
          {/* Timer */}
          <div className={`frosted-glass px-3 py-2 flex items-center space-x-2 shrink-0 ${isFrozen ? 'border-blue-400 border-2' : ''}`}>
            {isFrozen ? <Snowflake className="w-5 h-5 animate-spin" /> : <div className="w-3 h-3 bg-red-500 rounded-full recording-pulse" />}
            <span className="text-xl sm:text-2xl font-black font-mono tabular-nums">{formattedTimer}</span>
          </div>

          {/* Current Word (center) - Updated via ref, no React re-renders */}
          {/* iOS: removed animate-pulse for performance - word changes provide visual feedback */}
          <div className="flex-1 text-center min-w-0 overflow-hidden">
            <div
              ref={wordDisplayRef}
              className="text-lg sm:text-2xl font-black tracking-wider text-primary truncate"
              style={{ display: 'none' }}
            />
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
            maxWidth: 'min(100%, calc(100svh - 280px))',
            maxHeight: 'calc(100svh - 280px)',
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
                cellRef={cellRefCallbacks.get(key)!}
              />
            );
          }))}
          </div>
          {/* Trail overlay - different implementations for iOS vs Android */}
          {IS_IOS ? (
            /* iOS: SVG-based trail - hardware accelerated, no canvas performance issues */
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ zIndex: 20 }}
            >
              <polyline
                ref={svgPathRef}
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            /* Android/Desktop: Canvas-based trail with glow effects */
            <canvas
              ref={canvasRef}
              className="trail-canvas absolute inset-0 w-full h-full pointer-events-none"
              style={{
                zIndex: 20,
                transform: 'translate3d(0,0,0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            />
          )}
        </div>
      </div>

      {/* Power-ups - ensure always visible at bottom */}
      {/* iOS: use ios-pulse (transform-based) instead of animate-pulse (opacity-based) */}
      <div className="flex justify-center items-center space-x-4 py-3" style={{ minHeight: '80px' }}>
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
                ${count > 0 ? 'bg-primary/20 border-primary ios-pulse' : 'opacity-50'}
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
      {/* iOS: use tween instead of spring for smoother animations */}
      <AnimatePresence mode="wait">
        {lastWordResult && (
          <motion.div
            key={lastWordResult.valid ? `valid-${lastWordResult.points}` : `invalid-${lastWordResult.reason}`}
            initial={{ y: 20, opacity: 0, scale: 0.8 }}
            animate={{ y: -50, opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
            className={`
              fixed left-1/2 bottom-32 -translate-x-1/2 px-6 py-3 rounded-full font-bold z-50 flex flex-col items-center
              ${lastWordResult.valid ? 'bg-success text-white' : 'bg-error text-white'}
            `}
            style={{ transform: 'translate3d(-50%, 0, 0)' }}
          >
            <span>{lastWordResult.valid ? `+${lastWordResult.points} POINTS!` : lastWordResult.reason}</span>
            {/* Powerup Earned Animation */}
            {lastWordResult.powerup && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "tween", duration: 0.25, ease: "backOut", delay: 0.15 }}
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

