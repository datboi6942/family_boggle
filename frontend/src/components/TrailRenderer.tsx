import { useRef, useCallback, useEffect } from 'react';

// Detect iOS once at module load
const IS_IOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

export interface TrailRendererProps {
  boardSize: number;
  pathPoints: { x: number; y: number }[];
  touchPos: { x: number; y: number };
  isDragging: boolean;
}

export const TrailRenderer = ({
  boardSize,
  pathPoints,
  touchPos,
  isDragging,
}: TrailRendererProps) => {
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

  // Animation loop ref
  const rafIdRef = useRef<number | null>(null);

  // Update path pixel positions for trail drawing
  // iOS: updates SVG polyline points attribute
  // Android: updates canvas path points
  const updatePathPoints = useCallback((points: { x: number; y: number }[]) => {
    // iOS: update SVG polyline directly (no animation loop needed)
    // Include finger position if dragging
    if (IS_IOS && svgPathRef.current) {
      let pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
      // Add current touch position if dragging
      if (isDragging) {
        pointsStr += ` ${touchPos.x},${touchPos.y}`;
      }
      svgPathRef.current.setAttribute('points', pointsStr);
    }
  }, [isDragging, touchPos]);

  // iOS: update SVG trail with current finger position during drag
  const updateIOSSvgTrail = useCallback(() => {
    if (!IS_IOS || !svgPathRef.current || !isDragging) return;

    if (pathPoints.length === 0) return;

    const pointsStr = pathPoints.map(p => `${p.x},${p.y}`).join(' ') + ` ${touchPos.x},${touchPos.y}`;
    svgPathRef.current.setAttribute('points', pointsStr);
  }, [pathPoints, touchPos, isDragging]);

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

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (pathPoints.length === 0) return;

    const interp = interpolatedTouchRef.current;

    // Android/Desktop: smooth interpolation
    if (isDragging) {
      interp.x += (touchPos.x - interp.x) * 0.5;
      interp.y += (touchPos.y - interp.y) * 0.5;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.beginPath();
    ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
    for (let i = 1; i < pathPoints.length; i++) {
      ctx.lineTo(pathPoints[i].x, pathPoints[i].y);
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
  }, [pathPoints, touchPos, isDragging]);

  // OPTIMIZED: Animation loop that only runs during active drag
  // iOS: completely disabled - no canvas animation needed
  const startAnimationLoop = useCallback(() => {
    // iOS: skip animation loop entirely - we only use CSS cell highlights
    if (isIOSRef.current) return;

    if (rafIdRef.current !== null) return; // Already running

    const animate = () => {
      // Stop if no longer dragging and no path to show
      if (!isDragging && pathPoints.length === 0) {
        rafIdRef.current = null;
        return;
      }

      drawTrail();
      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);
  }, [drawTrail, isDragging, pathPoints]);

  const stopAnimationLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // Start animation loop when dragging starts
  useEffect(() => {
    if (isDragging) {
      startAnimationLoop();
    } else {
      // If not dragging but we have a path (tap mode), draw once
      if (pathPoints.length > 0) {
        drawTrail();
      }
    }
    return () => {
      stopAnimationLoop();
    };
  }, [isDragging, startAnimationLoop, stopAnimationLoop, pathPoints, drawTrail]);

  // Update SVG trail on touch movement (iOS only)
  useEffect(() => {
    if (IS_IOS && isDragging) {
      updateIOSSvgTrail();
    }
  }, [touchPos, isDragging, updateIOSSvgTrail]);

  // Update SVG trail when path points change
  useEffect(() => {
    if (IS_IOS) {
      updatePathPoints(pathPoints);
    }
  }, [pathPoints, updatePathPoints]);

  // Initialize canvas context (Android/Desktop only - iOS uses SVG)
  useEffect(() => {
    if (IS_IOS) return; // iOS uses SVG, not canvas

    const canvas = canvasRef.current;
    const board = canvas?.parentElement; // Parent container should be the board wrapper
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

  // Clear trail when path is empty and not dragging
  useEffect(() => {
    if (pathPoints.length === 0 && !isDragging) {
      if (IS_IOS && svgPathRef.current) {
        svgPathRef.current.setAttribute('points', '');
      } else {
        const ctx = ctxRef.current;
        const canvas = canvasRef.current;
        if (ctx && canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
  }, [pathPoints, isDragging]);

  return IS_IOS ? (
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
  );
};