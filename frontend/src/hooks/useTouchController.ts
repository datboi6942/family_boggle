import { useRef, useCallback, useEffect } from 'react';

const DEBUG = false;

// Detect iOS once at module load
const IS_IOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

// Tap mode timeout (1.5 seconds to tap next letter or auto-submit)
const TAP_TIMEOUT_MS = 1500;
// Throttle move events to ~60fps (16ms between updates)
const MOVE_THROTTLE_MS = 16;

export interface UseTouchControllerProps {
  board: string[][];
  boardSize: number;
  blockedCells: [number, number][];
  send: (type: string, data: unknown) => void;
  audio: {
    playLetterChain: (length: number) => void;
    playLetterChainDeferred: (length: number) => void;
    playFirstTouchDeferred: () => void;
    playLetterSelect: () => void;
  };
  onPathChange?: (path: [number, number][]) => void;
  onTouchStart?: (touchPos: { x: number; y: number }) => void;
  onTouchMove?: (touchPos: { x: number; y: number }) => void;
  onTouchEnd?: () => void;
}

export interface UseTouchControllerReturn {
  handleStart: (e: React.TouchEvent | React.MouseEvent) => void;
  handleMove: (e: React.TouchEvent | React.MouseEvent) => void;
  handleEnd: () => void;
  getCellFromCoords: (clientX: number, clientY: number, useCachedRect?: boolean) => { cell: [number, number] | null; localX: number; localY: number };
  isCellBlocked: (r: number, c: number) => boolean;
  currentPath: React.MutableRefObject<[number, number][]>;
  touchPos: React.MutableRefObject<{ x: number; y: number }>;
  isDragging: React.MutableRefObject<boolean>;
  boardDimensions: React.MutableRefObject<{ cellSize: number; gapSize: number; totalGapSpace: number } | null>;
  boardRect: React.MutableRefObject<DOMRect | null>;
  pathPoints: React.MutableRefObject<{ x: number; y: number }[]>;
  cellCenters: React.MutableRefObject<{ x: number; y: number }[][]>;
  updateBoardDimensions: () => { cellSize: number; gapSize: number; totalGapSpace: number } | null;
}

export const useTouchController = ({
  board,
  boardSize,
  blockedCells,
  send,
  audio,
  onPathChange,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: UseTouchControllerProps): UseTouchControllerReturn => {
  // All path state in refs - NO React state during drag
  const touchPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentPathRef = useRef<[number, number][]>([]);

  const isDraggingRef = useRef(false);
  const boardDimensionsRef = useRef<{ cellSize: number; gapSize: number; totalGapSpace: number } | null>(null);
  const boardRectRef = useRef<DOMRect | null>(null);
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);
  const pathPointsRef = useRef<{ x: number; y: number }[]>([]);
  const cellCentersRef = useRef<{ x: number; y: number }[][]>([]);

  // Tap mode state - allows tapping letters sequentially to build words
  const tapModeActiveRef = useRef(false);
  const lastTapTimeRef = useRef(0);
  const tapSubmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Throttling for handleMove - limit to ~60fps (16ms between updates)
  const lastMoveProcessTimeRef = useRef(0);
  
  // Sound throttling
  const lastSoundTimeRef = useRef(0);
  const prevPathLengthRef = useRef(0);

  // Keep blockedCells in a ref for use in handlers
  const blockedCellsRef = useRef(blockedCells);
  useEffect(() => {
    blockedCellsRef.current = blockedCells;
  }, [blockedCells]);

  // Cache board dimensions to avoid recalculating on every call
  const updateBoardDimensions = useCallback(() => {
    // This function will be implemented by the parent component
    // that has access to the board DOM element
    return boardDimensionsRef.current;
  }, []);

  // Get cell from coordinates relative to board
  const getCellFromCoords = useCallback((clientX: number, clientY: number, useCachedRect = false): { cell: [number, number] | null; localX: number; localY: number } => {
    // Use cached rect during drag, fresh rect otherwise
    const rect = useCachedRect && boardRectRef.current
      ? boardRectRef.current
      : null;
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
      if (IS_IOS) {
        // iOS: Use deferred playback - schedules after touch handler completes
        audio.playLetterChainDeferred(pathLength);
      } else {
        audio.playLetterChain(pathLength);
      }
      lastSoundTimeRef.current = now;
    }
  }, [audio]);

  const isCellBlocked = useCallback((r: number, c: number): boolean => {
    return blockedCellsRef.current.some(([br, bc]) => br === r && bc === c);
  }, []);

  // Helper to check if two cells are adjacent
  const isAdjacent = useCallback((cell1: [number, number], cell2: [number, number]): boolean => {
    const rowDiff = Math.abs(cell1[0] - cell2[0]);
    const colDiff = Math.abs(cell1[1] - cell2[1]);
    return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
  }, []);

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
    
    // Notify parent to clear highlights
    if (DEBUG) console.log('submitTapWord -> onPathChange([])');
    onPathChange?.([]);
  }, [board, send, onPathChange]);

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

  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();

    // Cache the board rect at drag start to avoid repeated DOM measurements
    const boardElement = (e.currentTarget as HTMLElement);
    boardRectRef.current = boardElement.getBoundingClientRect();
    
    // Update dimensions based on the board element
    const rect = boardRectRef.current;
    const computedStyle = getComputedStyle(boardElement);
    const gapSize = parseFloat(computedStyle.gap) || 8;
    const totalGapSpace = (boardSize - 1) * gapSize;
    const cellSize = (rect.width - totalGapSpace) / boardSize;
    boardDimensionsRef.current = { cellSize, gapSize, totalGapSpace };

    // Pre-compute cell centers for O(1) hit detection
    const cellPlusGap = cellSize + gapSize;
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

    const touch = 'touches' in e ? e.touches[0] : e;
    const { cell, localX, localY } = getCellFromCoords(touch.clientX, touch.clientY, true);

    if (cell && !isCellBlocked(cell[0], cell[1])) {
      // Track initial position to distinguish clicks from drags
      dragStartPosRef.current = { x: localX, y: localY };
      hasMovedRef.current = false;
      // Update in place to avoid allocation
      touchPosRef.current.x = localX;
      touchPosRef.current.y = localY;

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
          // iOS: Use deferred playback to avoid blocking touch
          if (IS_IOS) {
            audio.playFirstTouchDeferred();
          } else {
            audio.playLetterSelect();
          }
        } else if (isAdjacent(lastCell, cell)) {
          // Adjacent cell - add to path
          currentPathRef.current = [...currentPath, cell];
          playChainSound(currentPath.length + 1);
        } else {
          // Not adjacent - start fresh sequence
          currentPathRef.current = [cell];
          // iOS: Use deferred playback to avoid blocking touch
          if (IS_IOS) {
            audio.playFirstTouchDeferred();
          } else {
            audio.playLetterSelect();
          }
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
        // iOS: Use deferred playback to avoid blocking touch
        if (IS_IOS) {
          audio.playFirstTouchDeferred();
        } else {
          audio.playLetterSelect();
        }
        prevPathLengthRef.current = 1;
      }

      // Set path in ref only - NO React state update
      isDraggingRef.current = true;
      
      // Update path points for trail rendering
      if (currentPathRef.current.length > 0 && boardDimensionsRef.current) {
        const { cellSize, gapSize } = boardDimensionsRef.current;
        pathPointsRef.current = currentPathRef.current.map(([r, c]) => ({
          x: c * (cellSize + gapSize) + cellSize / 2,
          y: r * (cellSize + gapSize) + cellSize / 2,
        }));
      }
      
      // Notify parent
      onPathChange?.(currentPathRef.current);
      onTouchStart?.({ x: localX, y: localY });
    }
  }, [getCellFromCoords, isCellBlocked, isAdjacent, playChainSound, audio, boardSize, onPathChange, onTouchStart]);

  // Ultra-optimized move handler - uses pre-computed cell centers, minimal allocations
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

    // Notify parent about touch movement
    onTouchMove?.({ x: localX, y: localY });

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

    // Update path points and notify parent if path changed
    if (pathChanged) {
      // Update path points for trail rendering
      pathPointsRef.current = currentPathRef.current.map(([r, c]) => ({
        x: c * (cellSize + gapSize) + cellSize / 2,
        y: r * (cellSize + gapSize) + cellSize / 2,
      }));
      
      onPathChange?.(currentPathRef.current);
    }
  }, [boardSize, playChainSound, isCellBlocked, onPathChange, onTouchMove]);

  const handleEnd = useCallback(() => {
    // Mark drag as ended
    isDraggingRef.current = false;
    if (DEBUG) console.log('handleEnd', { path: currentPathRef.current.length, hadMovement: hasMovedRef.current, isDragging: isDraggingRef.current });

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

      // Keep the path and highlights visible
      onTouchEnd?.();
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
      
      // Notify parent to clear everything
      if (DEBUG) console.log('handleEnd clearing path -> onPathChange([])');
      onPathChange?.([]);
    }

    onTouchEnd?.();
  }, [board, send, restartTapTimer, onPathChange, onTouchEnd]);

  // Cleanup tap timer on unmount
  useEffect(() => {
    return () => {
      if (tapSubmitTimerRef.current !== null) {
        clearTimeout(tapSubmitTimerRef.current);
      }
    };
  }, []);

  return {
    handleStart,
    handleMove,
    handleEnd,
    getCellFromCoords,
    isCellBlocked,
    currentPath: currentPathRef,
    touchPos: touchPosRef,
    isDragging: isDraggingRef,
    boardDimensions: boardDimensionsRef,
    boardRect: boardRectRef,
    pathPoints: pathPointsRef,
    cellCenters: cellCentersRef,
    updateBoardDimensions,
  };
};