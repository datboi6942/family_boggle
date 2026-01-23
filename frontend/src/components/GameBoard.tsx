import { useRef, useCallback, useMemo, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useAudioContext } from '../contexts/AudioContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Snowflake, Bomb, RotateCw, Lock, Shield } from 'lucide-react';
import { PowerUpBar } from './PowerUpBar';
import { LockProtectionAnimation } from './LockProtectionAnimation';
import { BoardRenderer } from './BoardRenderer';
import { useTouchController } from '../hooks/useTouchController';
import { TargetWordsDisplay } from './TargetWordsDisplay';
import { TeamDisplay } from './TeamDisplay';
import { PowerupDropNotifications } from './PowerupDropNotifications';

// Letter point values (same as backend scoring.py)

const DEBUG = false;

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

  /* Frost effect for freeze powerup */
  @keyframes frost-shimmer {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 0.9; }
  }
  .frost-overlay {
    animation: frost-shimmer 2s ease-in-out infinite;
  }
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

  /* Frost effect for freeze powerup */
  @keyframes frost-shimmer {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.8; }
  }
  @keyframes frost-pulse {
    0%, 100% {
      box-shadow: 0 0 20px rgba(96, 165, 250, 0.4),
                  0 0 40px rgba(96, 165, 250, 0.2),
                  inset 0 0 30px rgba(96, 165, 250, 0.1);
    }
    50% {
      box-shadow: 0 0 30px rgba(96, 165, 250, 0.6),
                  0 0 60px rgba(96, 165, 250, 0.3),
                  inset 0 0 40px rgba(96, 165, 250, 0.15);
    }
  }
  .frost-overlay {
    animation: frost-shimmer 2s ease-in-out infinite;
  }
  .frost-border {
    animation: frost-pulse 2s ease-in-out infinite;
  }
`;

export const GameBoard = () => {
  // Use shallow comparison to prevent unnecessary re-renders when unrelated state changes
  const { playerId, board, boardSize, timer, bonusTime, lastWordResult, players, blockedCells, isFrozen, frozenTimerValue, isLockArmed, lockJustConsumed, gameMode, modeSettings } = useGameStore(
    useShallow(state => ({
      playerId: state.playerId,
      board: state.board,
      boardSize: state.boardSize,
      timer: state.timer,
      bonusTime: state.bonusTime,
      lastWordResult: state.lastWordResult,
      players: state.players,
      blockedCells: state.blockedCells,
       isFrozen: state.isFrozen,
       frozenTimerValue: state.frozenTimerValue,
       isLockArmed: state.isLockArmed,
       lockJustConsumed: state.lockJustConsumed,
       gameMode: state.gameMode,
       modeSettings: state.modeSettings,
    }))
  );

   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const settings = modeSettings as any;

  const { send } = useWebSocketContext();
  const audio = useAudioContext();

  // NO React state during drag - use refs for everything
  const currentWordRef = useRef('');
  const wordDisplayRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const musicStartedRef = useRef(false);
  const lastTimerRef = useRef<number>(timer);


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

  // Clear trail (canvas for Android, SVG for iOS)
   const clearTrail = useCallback(() => {
    if (DEBUG) console.log('clearTrail called', { IS_IOS, hasSVG: !!svgPathRef.current, hasCanvas: !!canvasRef.current });
    // iOS: clear SVG path
    if (IS_IOS && svgPathRef.current) {
      svgPathRef.current.setAttribute('points', '');
    }
    // Android: clear canvas
    if (!IS_IOS) {
      const ctx = ctxRef.current;
      const canvas = canvasRef.current;
      if (ctx && canvas) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [svgPathRef, ctxRef, canvasRef]);

  // Cell DOM refs for direct manipulation - NO REACT RE-RENDERS
  const cellRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  const handleCellRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) {
      cellRefsMap.current.set(key, el);
    } else {
      cellRefsMap.current.delete(key);
    }
  }, []);

  // Animation loop ref
  const rafIdRef = useRef<number | null>(null);

  // Previous path for efficient cell highlight updates
  const previousPathRef = useRef<Set<string>>(new Set());

  // Throttling for handleMove - limit to ~60fps (16ms between updates)


  // Touch controller hook - manages all touch/swipe logic
  const {
    handleStart,
    handleMove,
    handleEnd,
    touchPos: touchPosRef,
    isDragging: isDraggingRef,
    boardDimensions: boardDimensionsRef,
    pathPoints: pathPointsRef,
  } = useTouchController({
    board,
    boardSize,
    blockedCells,
    send,
    audio,
    onPathChange: (newPath) => {
      // Update cell highlights when path changes
      updateCellHighlights(newPath);
      // Update path points for trail rendering
      updatePathPoints(newPath);
    },
    onTouchStart: (_touchPos) => {
      // Update touch position for interpolation
      interpolatedTouchRef.current.x = _touchPos.x;
      interpolatedTouchRef.current.y = _touchPos.y;
      // Start animation loop for canvas trail
      startAnimationLoop();
    },
    onTouchMove: (_touchPos) => {
      void _touchPos; // unused parameter
      // iOS: update SVG trail immediately with finger position
      if (IS_IOS) {
        updateIOSSvgTrail();
      }
    },
    onTouchEnd: () => {
      // Nothing needed for now
    },
  });
  
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
  const updateCellHighlights = useCallback((path: [number, number][]) => {
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
  }, [board, previousPathRef, cellRefsMap, wordDisplayRef, currentWordRef]);

  // Update path pixel positions for trail drawing
  // iOS: updates SVG polyline points attribute
  // Android: updates canvas path points
  const updatePathPoints = useCallback((path: [number, number][]) => {
    if (DEBUG) console.log('updatePathPoints', { pathLength: path.length, hasDims: !!boardDimensionsRef.current });
    const dims = boardDimensionsRef.current;

    if (path.length === 0 || !dims) {
      pathPointsRef.current = [];
      clearTrail();
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
  }, [boardDimensionsRef, isDraggingRef, pathPointsRef, touchPosRef, svgPathRef, clearTrail]);

  // iOS: update SVG trail with current finger position during drag
  const updateIOSSvgTrail = useCallback(() => {
    if (!IS_IOS || !svgPathRef.current || !isDraggingRef.current) return;

    const points = pathPointsRef.current;
    if (points.length === 0) return;

    const touch = touchPosRef.current;
    const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ') + ` ${touch.x},${touch.y}`;
    svgPathRef.current.setAttribute('points', pointsStr);
  }, [svgPathRef, isDraggingRef, pathPointsRef, touchPosRef]);

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
    const touchPosVal = touchPosRef.current;
    const isDraggingVal = isDraggingRef.current;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length === 0) return;

    const interp = interpolatedTouchRef.current;

    // Android/Desktop: smooth interpolation
    if (isDraggingVal) {
      interp.x += (touchPosVal.x - interp.x) * 0.5;
      interp.y += (touchPosVal.y - interp.y) * 0.5;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    if (isDraggingVal) {
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
  }, [isIOSRef, ctxRef, canvasRef, dprRef, pathPointsRef, touchPosRef, isDraggingRef, interpolatedTouchRef]);



  // Keep a ref to audio so effects can access latest version
  const audioRef = useRef(audio);
  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

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
  }, [drawTrail, isIOSRef, rafIdRef, isDraggingRef, pathPointsRef]);

    const stopAnimationLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    clearTrail();
  }, [rafIdRef, clearTrail]);

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

  // Track last bonus time for detecting when it runs out
  const lastBonusTimeRef = useRef(bonusTime);

  // Reset intense mode flag when component mounts (new game)
  useEffect(() => {
    intenseActivatedRef.current = false;
    lastTimerRef.current = 999;
  }, []);

  // Intense music trigger - check on every timer change AND on an interval for reliability
  useEffect(() => {
    // Check if we should switch to intense music (total remaining time <= 30 and not already activated)
    const checkIntenseMusic = () => {
      const totalRemainingTime = timer + bonusTime;
      if (!intenseActivatedRef.current && totalRemainingTime <= 30 && totalRemainingTime > 0) {
        intenseActivatedRef.current = true;
        audioRef.current.playGameplayIntenseMusic();
      }
    };

    // Check immediately when timer changes
    if (timer !== lastTimerRef.current) {
      checkIntenseMusic();
    }

    // Also set up a backup interval check (in case effect timing is off)
    const intervalId = setInterval(checkIntenseMusic, 1000);

    return () => clearInterval(intervalId);
  }, [timer, bonusTime]);

  // Timer warning sounds and game end - handles both main timer and bonus time
  useEffect(() => {
    const totalRemainingTime = timer + bonusTime;
    const lastTotalTime = (lastTimerRef.current || 0) + (lastBonusTimeRef.current || 0);
    
    // Only check if total time actually changed
    if (totalRemainingTime === lastTotalTime) return;
    
    // Timer warning when 10 seconds or less in total remaining time
    if (totalRemainingTime <= 10 && totalRemainingTime > 0) {
      audioRef.current.playTimerWarning();
    }

    // Game end sound when total time hits 0 from a positive value
    if (totalRemainingTime === 0 && lastTotalTime > 0) {
      audioRef.current.playGameEnd();
    }

    // Update refs
    lastTimerRef.current = timer;
    lastBonusTimeRef.current = bonusTime;
  }, [timer, bonusTime]);

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

   // Track previous isFrozen state to detect transitions
  const prevIsFrozenRef = useRef(isFrozen);
  const lastFreezeSoundTimeRef = useRef(0);

   // Frozen/powerup sounds
  useEffect(() => {
    console.log('FREEZE EFFECT: isFrozen changed', { 
      prev: prevIsFrozenRef.current, 
      current: isFrozen,
      timer, 
      bonusTime 
    });
    
    // Detect transition from false to true (freeze activated)
    if (!prevIsFrozenRef.current && isFrozen) {
      const now = Date.now();
      // Extra safety: only play if at least 500ms since last freeze sound
      if (now - lastFreezeSoundTimeRef.current > 500) {
        console.log('Freeze activated - playing sound');
        audioRef.current.playPowerupFreeze();
        lastFreezeSoundTimeRef.current = now;
      } else {
        console.log('Freeze sound throttled (too soon after previous)');
      }
    }
    
    // Update previous value
    prevIsFrozenRef.current = isFrozen;
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [isFrozen]);

  useEffect(() => {
    if (blockedCells.length > 0) {
      audioRef.current.playPowerupBomb();
    }
  }, [blockedCells]);

  // Sound when lock blocks a shuffle
  useEffect(() => {
    if (lockJustConsumed) {
      // Play the lock sound to indicate protection was activated
      audioRef.current.playPowerupLock();
    }
  }, [lockJustConsumed]);

  // Cache board dimensions to avoid recalculating on every call


  // Get cell from coordinates relative to board
  // Must account for CSS grid gap (gap-2 = 0.5rem = 8px at default font size)
  // Uses cached rect during drag for performance


  // Play chain sound immediately when path grows
  // iOS: Uses deferred playback to avoid blocking touch handlers










  // Ultra-optimized move handler - uses pre-computed cell centers, minimal allocations
  // THROTTLED to ~60fps to prevent excessive processing on mobile








  // Convert blocked cells to string array for BoardRenderer
  const blockedCellStrings = useMemo(() => 
    blockedCells.map(([r, c]) => `${r}-${c}`), 
    [blockedCells]
  );

  const formattedTimer = useMemo(() => {
    // When frozen, show the captured frozen timer value (timer appears paused)
    // Otherwise show total time (timer + bonusTime)
    const displayTime = isFrozen && frozenTimerValue !== null
      ? frozenTimerValue
      : timer + bonusTime;
    const mins = Math.floor(displayTime / 60);
    const secs = displayTime % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [timer, bonusTime, isFrozen, frozenTimerValue]);

  // Show bonus time indicator when player has accumulated freeze time
  const bonusTimeIndicator = useMemo(() => {
    if (bonusTime > 0) {
      const bonusMins = Math.floor(bonusTime / 60);
      const bonusSecs = bonusTime % 60;
      return `+${bonusMins}:${bonusSecs.toString().padStart(2, '0')}`;
    }
    return null;
  }, [bonusTime]);

   const me = useMemo(() => players.find(p => p.id === playerId), [players, playerId]);

    const hasExtraDisplay = gameMode === 'word_race' || gameMode === 'team';
   const gridRows = hasExtraDisplay ? 'auto auto 1fr 80px' : 'auto 1fr 80px';
   const boardOffset = hasExtraDisplay ? '400px' : '280px';

   return (
    <div
      className="game-board-container grid bg-navy-gradient text-white select-none p-2 overflow-hidden"
      style={{
        height: 'calc(100svh - 50px)', // Aggressively shrink to guarantee power-ups visible above browser chrome
        maxHeight: 'calc(-webkit-fill-available - 50px)', // iOS Safari fallback
        paddingTop: 'env(safe-area-inset-top, 8px)',
        paddingBottom: '16px',
         gridTemplateRows: gridRows, // Header, [TargetWords/Team], Board, Power-ups (80px for visibility)
      }}
    >
      {/* Header */}
      {/* iOS: use ios-pulse (transform-based) instead of animate-pulse (opacity-based) */}
      <div className={`py-1 ${isFrozen ? 'ios-pulse text-blue-400' : ''}`}>
        <div className="flex justify-between items-center gap-2">
          {/* Timer */}
          <div className={`frosted-glass px-3 py-2 flex items-center space-x-2 shrink-0 ${isFrozen ? 'border-blue-400 border-2' : ''}`}>
            {isFrozen ? <Snowflake className="w-5 h-5 animate-spin" /> : <div className="w-3 h-3 bg-red-500 rounded-full recording-pulse" />}
            <div className="flex flex-col items-start">
              <span className="text-xl sm:text-2xl font-black font-mono tabular-nums">{formattedTimer}</span>
                {bonusTimeIndicator && (
                  <div className="flex items-center gap-1 mt-[-2px]">
                    <span className="text-xs text-green-400 font-bold">
                      {bonusTimeIndicator}
                    </span>
                    <span className="text-xs text-white/60 ml-1">
                      bonus time
                    </span>
                  </div>
                )}
                {/* Round indicator for timed attack mode */}
                {gameMode === 'timed_attack' && settings?.current_round && settings?.max_rounds && (
                  <div className="flex items-center gap-1 mt-1">
                    <span className="text-xs text-yellow-400 font-bold">
                        Round {settings.current_round}/{settings.max_rounds}
                    </span>
                  </div>
                )}
            </div>
          </div>

          {/* Lock Status Indicator - shown when lock is armed */}
          <AnimatePresence mode="wait">
            {lockJustConsumed ? (
              <motion.div
                key="lock-consumed"
                initial={{ scale: 0, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="frosted-glass px-2 py-2 flex items-center space-x-1 shrink-0 bg-green-500/30 border-2 border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)]"
              >
                <Shield className="w-5 h-5 text-green-400" />
                <span className="text-xs font-bold text-green-400 uppercase">Blocked!</span>
              </motion.div>
            ) : isLockArmed ? (
              <motion.div
                key="lock-armed"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="frosted-glass px-2 py-2 flex items-center space-x-1 shrink-0 bg-green-500/20 border-2 border-green-400"
              >
                <Shield className="w-5 h-5 text-green-400" />
                <span className="text-xs font-bold text-green-400 uppercase">Protected</span>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Current Word / Word Result (center) - Shows result inline when available */}
          <div className="flex-1 text-center min-w-0 overflow-hidden">
            <AnimatePresence mode="wait">
              {lastWordResult ? (
                <motion.div
                  key={lastWordResult.valid ? `valid-${lastWordResult.points}` : `invalid-${lastWordResult.reason}`}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "tween", duration: 0.15 }}
                  className="flex flex-col items-center justify-center"
                >
                  <span className={`text-sm sm:text-lg font-black ${lastWordResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                    {lastWordResult.valid ? `+${lastWordResult.points} POINTS!` : lastWordResult.reason}
                  </span>
                  {lastWordResult.powerup && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "tween", duration: 0.15, delay: 0.1 }}
                      className="flex items-center gap-1 bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full text-xs"
                    >
                      {lastWordResult.powerup === 'freeze' && <Snowflake className="w-3 h-3" />}
                      {lastWordResult.powerup === 'blowup' && <Bomb className="w-3 h-3" />}
                      {lastWordResult.powerup === 'shuffle' && <RotateCw className="w-3 h-3" />}
                      {lastWordResult.powerup === 'lock' && <Lock className="w-3 h-3" />}
                      <span className="font-bold">+1</span>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <div
                  ref={wordDisplayRef}
                  className="text-lg sm:text-2xl font-black tracking-wider text-primary truncate"
                  style={{ display: 'none' }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* Score */}
          <div className="frosted-glass px-3 py-2 text-right shrink-0">
            <p className="text-[10px] sm:text-xs text-white/50 uppercase font-bold leading-none">Score</p>
            <p className="text-xl sm:text-2xl font-black text-primary leading-none">{me?.score || 0}</p>
          </div>
        </div>
       </div>

        {/* Target Words Display for word_race mode */}
        {gameMode === 'word_race' && <TargetWordsDisplay />}

        {/* Team Display for team mode */}
        {gameMode === 'team' && <TeamDisplay />}

       {/* The Board - Constrained square container that fits in available space */}
      <div className="flex items-center justify-center overflow-hidden min-h-0 py-1">
        <div
          className={`relative w-full transition-all duration-300 rounded-2xl ${
            isFrozen
              ? 'frost-border ring-4 ring-blue-400/60 border-2 border-blue-300/50'
              : isLockArmed
                ? 'ring-4 ring-green-400/50 shadow-[0_0_20px_rgba(34,197,94,0.3)]'
                : ''
          }`}
           style={{
             aspectRatio: '1/1',
             maxWidth: `min(100%, calc(100svh - ${boardOffset}))`,
             maxHeight: `calc(100svh - ${boardOffset})`,
          }}
        >
          {/* Frost overlay when frozen */}
          {isFrozen && (
            <div
              className="frost-overlay absolute inset-0 rounded-2xl pointer-events-none z-30"
              style={{
                background: 'linear-gradient(135deg, rgba(147, 197, 253, 0.15) 0%, rgba(96, 165, 250, 0.1) 50%, rgba(147, 197, 253, 0.15) 100%)',
                backdropFilter: 'brightness(1.05) saturate(0.9)',
              }}
            />
          )}
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
               gridTemplateRows: `repeat(${boardSize}, 1fr)`,
               touchAction: 'none'
             }}
          >
          <BoardRenderer
            board={board}
            boardSize={boardSize}
            blockedCells={blockedCellStrings}
            onCellRef={handleCellRef}
          />
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

       <PowerupDropNotifications />
       <PowerUpBar playerId={playerId} players={players} isLockArmed={isLockArmed} />

      <LockProtectionAnimation lockJustConsumed={lockJustConsumed} />

    </div>
  );
};

