import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface MonsterConfig {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  highlightColor: string;
  shadowColor: string;
  animationClass: string;
  eyeAnimationClass?: string;
  mouthAnimationClass?: string;
  shape: 'circle' | 'blob' | 'square' | 'triangle' | 'star' | 'ghost' | 'diamond' | 'hex';
  eyeStyle: 'normal' | 'big' | 'sleepy' | 'angry' | 'cute' | 'cyclops' | 'wink' | 'sparkle';
  mouthStyle: 'smile' | 'teeth' | 'open' | 'small' | 'wavy' | 'fangs' | 'smirk' | 'kiss';
  extras?: string[];
  pattern?: 'spots' | 'stripes' | 'scales' | 'glow' | 'sparkles';
}

export const MONSTERS: MonsterConfig[] = [
  {
    name: 'Blobby',
    primaryColor: '#22c55e',
    secondaryColor: '#16a34a',
    highlightColor: '#4ade80',
    shadowColor: '#15803d',
    animationClass: 'animate-monster-blobby',
    eyeAnimationClass: 'animate-monster-blink',
    shape: 'blob',
    eyeStyle: 'cute',
    mouthStyle: 'smile',
    pattern: 'spots'
  },
  {
    name: 'Spike',
    primaryColor: '#8b5cf6',
    secondaryColor: '#7c3aed',
    highlightColor: '#a78bfa',
    shadowColor: '#6d28d9',
    animationClass: 'animate-monster-spike',
    eyeAnimationClass: 'animate-monster-squint',
    shape: 'star',
    eyeStyle: 'angry',
    mouthStyle: 'teeth',
    extras: ['spikes'],
    pattern: 'glow'
  },
  {
    name: 'Chompy',
    primaryColor: '#f97316',
    secondaryColor: '#ea580c',
    highlightColor: '#fb923c',
    shadowColor: '#c2410c',
    animationClass: 'animate-monster-chompy',
    mouthAnimationClass: 'animate-monster-chomp',
    shape: 'circle',
    eyeStyle: 'big',
    mouthStyle: 'fangs',
    pattern: 'scales'
  },
  {
    name: 'Floaty',
    primaryColor: '#3b82f6',
    secondaryColor: '#2563eb',
    highlightColor: '#60a5fa',
    shadowColor: '#1d4ed8',
    animationClass: 'animate-monster-floaty',
    eyeAnimationClass: 'animate-monster-drowsy',
    shape: 'ghost',
    eyeStyle: 'sleepy',
    mouthStyle: 'small',
    pattern: 'glow'
  },
  {
    name: 'Grumble',
    primaryColor: '#ef4444',
    secondaryColor: '#dc2626',
    highlightColor: '#f87171',
    shadowColor: '#b91c1c',
    animationClass: 'animate-monster-grumble',
    eyeAnimationClass: 'animate-monster-glare',
    shape: 'square',
    eyeStyle: 'angry',
    mouthStyle: 'wavy',
    extras: ['eyebrows'],
    pattern: 'stripes'
  },
  {
    name: 'Zippy',
    primaryColor: '#eab308',
    secondaryColor: '#ca8a04',
    highlightColor: '#facc15',
    shadowColor: '#a16207',
    animationClass: 'animate-monster-zippy',
    eyeAnimationClass: 'animate-monster-excited',
    shape: 'triangle',
    eyeStyle: 'sparkle',
    mouthStyle: 'open',
    pattern: 'sparkles'
  },
  {
    name: 'Mossy',
    primaryColor: '#166534',
    secondaryColor: '#14532d',
    highlightColor: '#22c55e',
    shadowColor: '#052e16',
    animationClass: 'animate-monster-mossy',
    shape: 'blob',
    eyeStyle: 'sleepy',
    mouthStyle: 'small',
    extras: ['moss'],
    pattern: 'spots'
  },
  {
    name: 'Pebble',
    primaryColor: '#6b7280',
    secondaryColor: '#4b5563',
    highlightColor: '#9ca3af',
    shadowColor: '#374151',
    animationClass: 'animate-monster-pebble',
    eyeAnimationClass: 'animate-monster-blink-slow',
    shape: 'hex',
    eyeStyle: 'sleepy',
    mouthStyle: 'small',
    pattern: 'scales'
  },
  {
    name: 'Bubbles',
    primaryColor: '#ec4899',
    secondaryColor: '#db2777',
    highlightColor: '#f472b6',
    shadowColor: '#be185d',
    animationClass: 'animate-monster-bubbles',
    eyeAnimationClass: 'animate-monster-sparkle',
    shape: 'circle',
    eyeStyle: 'wink',
    mouthStyle: 'kiss',
    extras: ['bubbles'],
    pattern: 'sparkles'
  },
  {
    name: 'Shadow',
    primaryColor: '#1f2937',
    secondaryColor: '#111827',
    highlightColor: '#4b5563',
    shadowColor: '#030712',
    animationClass: 'animate-monster-shadow',
    eyeAnimationClass: 'animate-monster-fade',
    shape: 'ghost',
    eyeStyle: 'cyclops',
    mouthStyle: 'wavy',
    pattern: 'glow'
  },
];

const getBodyPath = (shape: MonsterConfig['shape']): string => {
  switch (shape) {
    case 'blob':
      return 'M50 8 C82 8 96 32 92 54 C88 78 72 92 50 92 C28 92 12 78 8 54 C4 32 18 8 50 8';
    case 'square':
      return 'M18 18 Q18 12 24 12 L76 12 Q82 12 82 18 L82 82 Q82 88 76 88 L24 88 Q18 88 18 82 Z';
    case 'triangle':
      return 'M50 8 L92 86 Q94 90 90 92 L10 92 Q6 90 8 86 Z';
    case 'star':
      return 'M50 5 L58 35 L90 35 L65 55 L75 90 L50 70 L25 90 L35 55 L10 35 L42 35 Z';
    case 'ghost':
      return 'M50 8 C82 8 92 38 92 58 L92 92 L78 78 L64 92 L50 78 L36 92 L22 78 L8 92 L8 58 C8 38 18 8 50 8';
    case 'diamond':
      return 'M50 5 L90 50 L50 95 L10 50 Z';
    case 'hex':
      return 'M50 8 L85 28 L85 72 L50 92 L15 72 L15 28 Z';
    default:
      return '';
  }
};

// Generate gradient definitions for each monster
const getGradientDefs = (monster: MonsterConfig, id: string) => (
  <>
    <defs>
      {/* Main body gradient */}
      <radialGradient id={`bodyGrad-${id}`} cx="30%" cy="30%" r="70%">
        <stop offset="0%" stopColor={monster.highlightColor} />
        <stop offset="50%" stopColor={monster.primaryColor} />
        <stop offset="100%" stopColor={monster.secondaryColor} />
      </radialGradient>

      {/* Inner shadow gradient */}
      <radialGradient id={`innerShadow-${id}`} cx="50%" cy="80%" r="60%">
        <stop offset="0%" stopColor={monster.shadowColor} stopOpacity="0.4" />
        <stop offset="100%" stopColor={monster.shadowColor} stopOpacity="0" />
      </radialGradient>

      {/* Highlight shine */}
      <linearGradient id={`shine-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="white" stopOpacity="0.4" />
        <stop offset="50%" stopColor="white" stopOpacity="0" />
      </linearGradient>

      {/* Glow filter */}
      <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Drop shadow */}
      <filter id={`shadow-${id}`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor={monster.shadowColor} floodOpacity="0.5" />
      </filter>
    </defs>
  </>
);

// Pattern overlays for texture
const getPattern = (pattern: MonsterConfig['pattern'] | undefined, color: string, id: string) => {
  if (!pattern) return null;

  switch (pattern) {
    case 'spots':
      return (
        <g opacity="0.3">
          <circle cx="30" cy="35" r="6" fill={color} />
          <circle cx="70" cy="45" r="5" fill={color} />
          <circle cx="45" cy="65" r="4" fill={color} />
          <circle cx="65" cy="70" r="3" fill={color} />
          <circle cx="35" cy="55" r="3.5" fill={color} />
        </g>
      );
    case 'stripes':
      return (
        <g opacity="0.2">
          <path d="M20 30 Q50 25 80 30" stroke={color} strokeWidth="4" fill="none" />
          <path d="M18 45 Q50 40 82 45" stroke={color} strokeWidth="4" fill="none" />
          <path d="M18 60 Q50 55 82 60" stroke={color} strokeWidth="4" fill="none" />
        </g>
      );
    case 'scales':
      return (
        <g opacity="0.15">
          {[0, 1, 2, 3].map(row =>
            [0, 1, 2, 3, 4].map(col => (
              <path
                key={`scale-${row}-${col}`}
                d={`M${20 + col * 15 + (row % 2) * 7.5} ${25 + row * 15}
                   Q${27 + col * 15 + (row % 2) * 7.5} ${32 + row * 15}
                   ${34 + col * 15 + (row % 2) * 7.5} ${25 + row * 15}`}
                stroke={color}
                strokeWidth="2"
                fill="none"
              />
            ))
          )}
        </g>
      );
    case 'glow':
      return (
        <ellipse
          cx="50"
          cy="50"
          rx="35"
          ry="35"
          fill="white"
          opacity="0.1"
          filter={`url(#glow-${id})`}
        />
      );
    case 'sparkles':
      return (
        <g opacity="0.6">
          <path d="M25 25 L27 28 L30 25 L27 22 Z" fill="white" />
          <path d="M75 35 L77 38 L80 35 L77 32 Z" fill="white" />
          <path d="M35 70 L36 72 L38 70 L36 68 Z" fill="white" />
          <path d="M68 65 L70 68 L73 65 L70 62 Z" fill="white" />
          <circle cx="60" cy="25" r="1.5" fill="white" />
          <circle cx="40" cy="55" r="1" fill="white" />
        </g>
      );
    default:
      return null;
  }
};

const getEyes = (style: MonsterConfig['eyeStyle'], size: number, highlightColor: string) => {
  const scale = size / 100;

  // Common eye white with gradient
  const EyeWhite = ({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) => (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="white" />
      <ellipse cx={cx} cy={cy - ry * 0.2} rx={rx * 0.9} ry={ry * 0.7} fill="#f8fafc" />
    </>
  );

  switch (style) {
    case 'big':
      return (
        <>
          <EyeWhite cx={35} cy={40} rx={10 * scale} ry={11 * scale} />
          <EyeWhite cx={65} cy={40} rx={10 * scale} ry={11 * scale} />
          <circle cx="37" cy="41" r={5 * scale} fill="#1e293b" />
          <circle cx="67" cy="41" r={5 * scale} fill="#1e293b" />
          <circle cx="39" cy="39" r={2 * scale} fill="white" />
          <circle cx="69" cy="39" r={2 * scale} fill="white" />
        </>
      );
    case 'sleepy':
      return (
        <>
          <ellipse cx="35" cy="44" rx={8 * scale} ry={4 * scale} fill="white" />
          <ellipse cx="65" cy="44" rx={8 * scale} ry={4 * scale} fill="white" />
          <ellipse cx="36" cy="44" rx={3 * scale} ry={3 * scale} fill="#1e293b" />
          <ellipse cx="66" cy="44" rx={3 * scale} ry={3 * scale} fill="#1e293b" />
          <path d="M27 40 Q35 38 43 40" stroke="#1e293b" strokeWidth={2 * scale} fill="none" strokeLinecap="round" />
          <path d="M57 40 Q65 38 73 40" stroke="#1e293b" strokeWidth={2 * scale} fill="none" strokeLinecap="round" />
        </>
      );
    case 'angry':
      return (
        <>
          <circle cx="35" cy="42" r={7 * scale} fill="white" />
          <circle cx="65" cy="42" r={7 * scale} fill="white" />
          <circle cx="37" cy="43" r={4 * scale} fill="#1e293b" />
          <circle cx="67" cy="43" r={4 * scale} fill="#1e293b" />
          <circle cx="38" cy="41" r={1.5 * scale} fill="white" />
          <circle cx="68" cy="41" r={1.5 * scale} fill="white" />
          <line x1="26" y1="33" x2="44" y2="38" stroke="#1e293b" strokeWidth={3 * scale} strokeLinecap="round" />
          <line x1="74" y1="33" x2="56" y2="38" stroke="#1e293b" strokeWidth={3 * scale} strokeLinecap="round" />
        </>
      );
    case 'cute':
      return (
        <>
          <circle cx="35" cy="42" r={8 * scale} fill="white" />
          <circle cx="65" cy="42" r={8 * scale} fill="white" />
          <circle cx="36" cy="43" r={5 * scale} fill="#1e293b" />
          <circle cx="66" cy="43" r={5 * scale} fill="#1e293b" />
          <circle cx="38" cy="40" r={2.5 * scale} fill="white" />
          <circle cx="68" cy="40" r={2.5 * scale} fill="white" />
          <circle cx="35" cy="45" r={1 * scale} fill={highlightColor} opacity="0.6" />
          <circle cx="65" cy="45" r={1 * scale} fill={highlightColor} opacity="0.6" />
          {/* Blush */}
          <ellipse cx="22" cy="52" rx={5 * scale} ry={3 * scale} fill="#fca5a5" opacity="0.5" />
          <ellipse cx="78" cy="52" rx={5 * scale} ry={3 * scale} fill="#fca5a5" opacity="0.5" />
        </>
      );
    case 'cyclops':
      return (
        <>
          <circle cx="50" cy="42" r={14 * scale} fill="white" />
          <circle cx="50" cy="42" r={12 * scale} fill="#f1f5f9" />
          <circle cx="52" cy="42" r={7 * scale} fill="#1e293b" />
          <circle cx="55" cy="39" r={3 * scale} fill="white" />
          <circle cx="48" cy="45" r={1.5 * scale} fill={highlightColor} opacity="0.5" />
        </>
      );
    case 'wink':
      return (
        <>
          <circle cx="35" cy="42" r={8 * scale} fill="white" />
          <circle cx="36" cy="43" r={5 * scale} fill="#1e293b" />
          <circle cx="38" cy="40" r={2 * scale} fill="white" />
          {/* Winking eye */}
          <path d="M57 42 Q65 46 73 42" stroke="#1e293b" strokeWidth={3 * scale} fill="none" strokeLinecap="round" />
          {/* Blush */}
          <ellipse cx="22" cy="52" rx={5 * scale} ry={3 * scale} fill="#fca5a5" opacity="0.5" />
          <ellipse cx="78" cy="52" rx={5 * scale} ry={3 * scale} fill="#fca5a5" opacity="0.5" />
        </>
      );
    case 'sparkle':
      return (
        <>
          <circle cx="35" cy="42" r={9 * scale} fill="white" />
          <circle cx="65" cy="42" r={9 * scale} fill="white" />
          <circle cx="36" cy="43" r={5 * scale} fill="#1e293b" />
          <circle cx="66" cy="43" r={5 * scale} fill="#1e293b" />
          {/* Star sparkles in eyes */}
          <path d="M38 39 L39 41 L41 39 L39 37 Z" fill="white" />
          <path d="M68 39 L69 41 L71 39 L69 37 Z" fill="white" />
          <circle cx="34" cy="45" r={1 * scale} fill="white" />
          <circle cx="64" cy="45" r={1 * scale} fill="white" />
        </>
      );
    default:
      return (
        <>
          <circle cx="35" cy="42" r={6 * scale} fill="white" />
          <circle cx="65" cy="42" r={6 * scale} fill="white" />
          <circle cx="37" cy="42" r={3 * scale} fill="#1e293b" />
          <circle cx="67" cy="42" r={3 * scale} fill="#1e293b" />
          <circle cx="38" cy="40" r={1.5 * scale} fill="white" />
          <circle cx="68" cy="40" r={1.5 * scale} fill="white" />
        </>
      );
  }
};

const getMouth = (style: MonsterConfig['mouthStyle'], size: number, _primaryColor: string) => {
  const scale = size / 100;
  const darkColor = '#1a1a2e';

  switch (style) {
    case 'teeth':
      return (
        <>
          <path d="M 28 62 Q 50 78 72 62" fill={darkColor} />
          <path d="M 28 62 L 72 62" stroke="white" strokeWidth={2 * scale} />
          <polygon points="34,62 38,72 30,72" fill="white" />
          <polygon points="46,62 50,74 42,74" fill="white" />
          <polygon points="58,62 62,74 54,74" fill="white" />
          <polygon points="70,62 74,72 66,72" fill="white" />
        </>
      );
    case 'open':
      return (
        <>
          <ellipse cx="50" cy="68" rx={14 * scale} ry={10 * scale} fill={darkColor} />
          <ellipse cx="50" cy="72" rx={8 * scale} ry={5 * scale} fill="#dc2626" opacity="0.8" />
        </>
      );
    case 'small':
      return (
        <path d="M 42 66 Q 50 72 58 66" stroke="white" strokeWidth={2.5 * scale} fill="none" strokeLinecap="round" />
      );
    case 'wavy':
      return (
        <path d="M 28 66 Q 38 72 50 66 Q 62 60 72 66" stroke="white" strokeWidth={3 * scale} fill="none" strokeLinecap="round" />
      );
    case 'fangs':
      return (
        <>
          <path d="M 28 60 Q 50 55 72 60" fill={darkColor} />
          <polygon points="32,58 36,75 28,75" fill="white" />
          <polygon points="68,58 72,75 64,75" fill="white" />
          <path d="M 36 60 L 64 60" stroke="white" strokeWidth={2 * scale} />
        </>
      );
    case 'smirk':
      return (
        <>
          <path d="M 35 66 Q 55 74 70 64" stroke="white" strokeWidth={3 * scale} fill="none" strokeLinecap="round" />
          <circle cx="72" cy="62" r={2 * scale} fill="white" />
        </>
      );
    case 'kiss':
      return (
        <>
          <ellipse cx="50" cy="68" rx={6 * scale} ry={8 * scale} fill="#f472b6" />
          <ellipse cx="50" cy="66" rx={4 * scale} ry={3 * scale} fill="#fb7185" />
        </>
      );
    default:
      return (
        <path d="M 32 66 Q 50 80 68 66" stroke="white" strokeWidth={3 * scale} fill="none" strokeLinecap="round" />
      );
  }
};

const getExtras = (extras: string[] | undefined, monster: MonsterConfig, size: number) => {
  if (!extras) return null;
  const scale = size / 100;

  return extras.map((extra, i) => {
    switch (extra) {
      case 'spikes':
        return (
          <g key={i}>
            <polygon points="50,-2 56,15 44,15" fill={monster.secondaryColor} />
            <polygon points="50,-2 54,12 46,12" fill={monster.highlightColor} opacity="0.5" />
            <polygon points="22,5 34,22 18,22" fill={monster.secondaryColor} />
            <polygon points="78,5 82,22 66,22" fill={monster.secondaryColor} />
          </g>
        );
      case 'eyebrows':
        return (
          <g key={i}>
            <path d="M24 28 Q33 22 44 30" stroke={monster.shadowColor} strokeWidth={5 * scale} strokeLinecap="round" fill="none" />
            <path d="M76 28 Q67 22 56 30" stroke={monster.shadowColor} strokeWidth={5 * scale} strokeLinecap="round" fill="none" />
          </g>
        );
      case 'moss':
        return (
          <g key={i}>
            <circle cx="22" cy="22" r={7 * scale} fill="#4ade80" />
            <circle cx="22" cy="22" r={5 * scale} fill="#22c55e" />
            <circle cx="78" cy="28" r={6 * scale} fill="#4ade80" />
            <circle cx="78" cy="28" r={4 * scale} fill="#22c55e" />
            <circle cx="28" cy="12" r={4 * scale} fill="#4ade80" />
            <circle cx="28" cy="12" r={2.5 * scale} fill="#22c55e" />
            <circle cx="72" cy="15" r={3 * scale} fill="#4ade80" />
          </g>
        );
      case 'bubbles':
        return (
          <g key={i}>
            <circle cx="82" cy="28" r={5 * scale} fill="rgba(255,255,255,0.4)" className="animate-monster-bubble-1" />
            <circle cx="82" cy="28" r={3 * scale} fill="rgba(255,255,255,0.2)" />
            <circle cx="88" cy="45" r={3.5 * scale} fill="rgba(255,255,255,0.35)" className="animate-monster-bubble-2" />
            <circle cx="85" cy="60" r={4 * scale} fill="rgba(255,255,255,0.3)" className="animate-monster-bubble-3" />
            <circle cx="85" cy="60" r={2 * scale} fill="rgba(255,255,255,0.15)" />
          </g>
        );
      default:
        return null;
    }
  });
};

export const MonsterAvatar = ({
  name,
  size = 100,
  isWinner = false,
  animated = true
}: {
  name: string;
  size?: number;
  isWinner?: boolean;
  animated?: boolean;
}) => {
  const monster = MONSTERS.find(m => m.name === name) || MONSTERS[0];
  const id = useMemo(() => `${name}-${Math.random().toString(36).slice(2, 9)}`, [name]);
  const bodyPath = useMemo(() => getBodyPath(monster.shape), [monster.shape]);

  return (
    <div className="relative flex flex-col items-center">
      {isWinner && (
        <motion.div
          initial={{ y: -50, opacity: 0, rotate: -10 }}
          animate={{ y: -20, opacity: 1, rotate: [0, -5, 5, 0] }}
          transition={{
            y: { duration: 0.5 },
            rotate: { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }}
          className="absolute text-4xl z-10"
          style={{ top: -size * 0.15 }}
        >
          👑
        </motion.div>
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={animated ? monster.animationClass : ''}
        style={{ willChange: animated ? 'transform' : 'auto' }}
      >
        {getGradientDefs(monster, id)}

        {/* Drop shadow */}
        <g filter={`url(#shadow-${id})`}>
          {/* Body */}
          {monster.shape === 'circle' ? (
            <circle cx="50" cy="50" r="42" fill={`url(#bodyGrad-${id})`} />
          ) : (
            <path d={bodyPath} fill={`url(#bodyGrad-${id})`} />
          )}
        </g>

        {/* Inner shadow overlay */}
        {monster.shape === 'circle' ? (
          <circle cx="50" cy="50" r="42" fill={`url(#innerShadow-${id})`} />
        ) : (
          <path d={bodyPath} fill={`url(#innerShadow-${id})`} />
        )}

        {/* Highlight shine */}
        {monster.shape === 'circle' ? (
          <ellipse cx="35" cy="30" rx="15" ry="10" fill="white" opacity="0.25" />
        ) : (
          <ellipse cx="35" cy="28" rx="12" ry="8" fill="white" opacity="0.25" />
        )}

        {/* Pattern texture */}
        {getPattern(monster.pattern, monster.shadowColor, id)}

        {/* Extras (spikes, moss, etc.) */}
        {getExtras(monster.extras, monster, size)}

        {/* Eyes with optional animation */}
        <g className={animated && monster.eyeAnimationClass ? monster.eyeAnimationClass : ''}>
          {getEyes(monster.eyeStyle, size, monster.highlightColor)}
        </g>

        {/* Mouth with optional animation */}
        <g className={animated && monster.mouthAnimationClass ? monster.mouthAnimationClass : ''}>
          {getMouth(monster.mouthStyle, size, monster.primaryColor)}
        </g>
      </svg>
    </div>
  );
};
