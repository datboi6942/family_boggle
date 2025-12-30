import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface MonsterConfig {
  name: string;
  color: string;
  animationClass: string;
  eyeAnimationClass?: string;
  mouthAnimationClass?: string;
  shape: 'circle' | 'blob' | 'square' | 'triangle' | 'star' | 'ghost';
  eyeStyle: 'normal' | 'big' | 'sleepy' | 'angry' | 'cute' | 'cyclops';
  mouthStyle: 'smile' | 'teeth' | 'open' | 'small' | 'wavy' | 'fangs';
  extras?: string[];
}

export const MONSTERS: MonsterConfig[] = [
  {
    name: 'Blobby',
    color: '#22c55e',
    animationClass: 'animate-monster-blobby',
    eyeAnimationClass: 'animate-monster-blink',
    shape: 'blob',
    eyeStyle: 'cute',
    mouthStyle: 'smile'
  },
  {
    name: 'Spike',
    color: '#8b5cf6',
    animationClass: 'animate-monster-spike',
    eyeAnimationClass: 'animate-monster-squint',
    shape: 'star',
    eyeStyle: 'angry',
    mouthStyle: 'teeth',
    extras: ['spikes']
  },
  {
    name: 'Chompy',
    color: '#f97316',
    animationClass: 'animate-monster-chompy',
    mouthAnimationClass: 'animate-monster-chomp',
    shape: 'circle',
    eyeStyle: 'big',
    mouthStyle: 'fangs'
  },
  {
    name: 'Floaty',
    color: '#3b82f6',
    animationClass: 'animate-monster-floaty',
    eyeAnimationClass: 'animate-monster-drowsy',
    shape: 'ghost',
    eyeStyle: 'sleepy',
    mouthStyle: 'small'
  },
  {
    name: 'Grumble',
    color: '#ef4444',
    animationClass: 'animate-monster-grumble',
    eyeAnimationClass: 'animate-monster-glare',
    shape: 'square',
    eyeStyle: 'angry',
    mouthStyle: 'wavy',
    extras: ['eyebrows']
  },
  {
    name: 'Zippy',
    color: '#eab308',
    animationClass: 'animate-monster-zippy',
    eyeAnimationClass: 'animate-monster-excited',
    shape: 'triangle',
    eyeStyle: 'big',
    mouthStyle: 'open'
  },
  {
    name: 'Mossy',
    color: '#166534',
    animationClass: 'animate-monster-mossy',
    shape: 'blob',
    eyeStyle: 'sleepy',
    mouthStyle: 'small',
    extras: ['moss']
  },
  {
    name: 'Pebble',
    color: '#6b7280',
    animationClass: 'animate-monster-pebble',
    eyeAnimationClass: 'animate-monster-blink-slow',
    shape: 'square',
    eyeStyle: 'sleepy',
    mouthStyle: 'small'
  },
  {
    name: 'Bubbles',
    color: '#ec4899',
    animationClass: 'animate-monster-bubbles',
    eyeAnimationClass: 'animate-monster-sparkle',
    shape: 'circle',
    eyeStyle: 'cute',
    mouthStyle: 'open',
    extras: ['bubbles']
  },
  {
    name: 'Shadow',
    color: '#1f2937',
    animationClass: 'animate-monster-shadow',
    eyeAnimationClass: 'animate-monster-fade',
    shape: 'ghost',
    eyeStyle: 'cyclops',
    mouthStyle: 'wavy'
  },
];

const getBodyPath = (shape: MonsterConfig['shape']): string => {
  switch (shape) {
    case 'blob':
      return 'M50 10 C80 10 95 35 90 55 C85 80 70 90 50 90 C30 90 15 80 10 55 C5 35 20 10 50 10';
    case 'square':
      return 'M15 20 Q15 15 20 15 L80 15 Q85 15 85 20 L85 80 Q85 85 80 85 L20 85 Q15 85 15 80 Z';
    case 'triangle':
      return 'M50 10 L90 85 Q90 90 85 90 L15 90 Q10 90 10 85 Z';
    case 'star':
      return 'M50 5 L58 35 L90 35 L65 55 L75 90 L50 70 L25 90 L35 55 L10 35 L42 35 Z';
    case 'ghost':
      return 'M50 10 C80 10 90 40 90 60 L90 90 L75 75 L60 90 L50 75 L40 90 L25 75 L10 90 L10 60 C10 40 20 10 50 10';
    default:
      return '';
  }
};

const getEyes = (style: MonsterConfig['eyeStyle'], size: number) => {
  const scale = size / 100;
  switch (style) {
    case 'big':
      return (
        <>
          <circle cx="35" cy="40" r={8 * scale} fill="white" />
          <circle cx="65" cy="40" r={8 * scale} fill="white" />
          <circle cx="37" cy="40" r={4 * scale} fill="black" />
          <circle cx="67" cy="40" r={4 * scale} fill="black" />
        </>
      );
    case 'sleepy':
      return (
        <>
          <ellipse cx="35" cy="42" rx={6 * scale} ry={3 * scale} fill="white" />
          <ellipse cx="65" cy="42" rx={6 * scale} ry={3 * scale} fill="white" />
          <circle cx="36" cy="42" r={2 * scale} fill="black" />
          <circle cx="66" cy="42" r={2 * scale} fill="black" />
        </>
      );
    case 'angry':
      return (
        <>
          <circle cx="35" cy="40" r={5 * scale} fill="white" />
          <circle cx="65" cy="40" r={5 * scale} fill="white" />
          <circle cx="37" cy="41" r={3 * scale} fill="black" />
          <circle cx="67" cy="41" r={3 * scale} fill="black" />
          <line x1="28" y1="32" x2="42" y2="36" stroke="black" strokeWidth={2 * scale} strokeLinecap="round" />
          <line x1="72" y1="32" x2="58" y2="36" stroke="black" strokeWidth={2 * scale} strokeLinecap="round" />
        </>
      );
    case 'cute':
      return (
        <>
          <circle cx="35" cy="40" r={6 * scale} fill="white" />
          <circle cx="65" cy="40" r={6 * scale} fill="white" />
          <circle cx="36" cy="41" r={4 * scale} fill="black" />
          <circle cx="66" cy="41" r={4 * scale} fill="black" />
          <circle cx="38" cy="39" r={1.5 * scale} fill="white" />
          <circle cx="68" cy="39" r={1.5 * scale} fill="white" />
        </>
      );
    case 'cyclops':
      return (
        <>
          <circle cx="50" cy="40" r={10 * scale} fill="white" />
          <circle cx="52" cy="40" r={5 * scale} fill="black" />
          <circle cx="54" cy="38" r={2 * scale} fill="white" />
        </>
      );
    default:
      return (
        <>
          <circle cx="35" cy="40" r={5 * scale} fill="white" />
          <circle cx="65" cy="40" r={5 * scale} fill="white" />
          <circle cx="37" cy="40" r={2 * scale} fill="black" />
          <circle cx="67" cy="40" r={2 * scale} fill="black" />
        </>
      );
  }
};

const getMouth = (style: MonsterConfig['mouthStyle'], size: number) => {
  const scale = size / 100;
  switch (style) {
    case 'teeth':
      return (
        <>
          <path d="M 30 65 Q 50 80 70 65" stroke="white" strokeWidth={3 * scale} fill="none" strokeLinecap="round" />
          <rect x="38" y="65" width={6 * scale} height={8 * scale} fill="white" rx={1 * scale} />
          <rect x="48" y="65" width={6 * scale} height={8 * scale} fill="white" rx={1 * scale} />
          <rect x="58" y="65" width={6 * scale} height={8 * scale} fill="white" rx={1 * scale} />
        </>
      );
    case 'open':
      return (
        <ellipse cx="50" cy="68" rx={12 * scale} ry={8 * scale} fill="#1a1a2e" />
      );
    case 'small':
      return (
        <path d="M 42 68 Q 50 72 58 68" stroke="white" strokeWidth={2 * scale} fill="none" strokeLinecap="round" />
      );
    case 'wavy':
      return (
        <path d="M 30 68 Q 40 72 50 68 Q 60 64 70 68" stroke="white" strokeWidth={3 * scale} fill="none" strokeLinecap="round" />
      );
    case 'fangs':
      return (
        <>
          <path d="M 30 62 L 70 62" stroke="white" strokeWidth={3 * scale} strokeLinecap="round" />
          <polygon points="35,62 38,75 32,75" fill="white" />
          <polygon points="65,62 68,75 62,75" fill="white" />
        </>
      );
    default:
      return (
        <path d="M 35 70 Q 50 80 65 70" stroke="white" strokeWidth={3 * scale} fill="none" strokeLinecap="round" />
      );
  }
};

const getExtras = (extras: string[] | undefined, color: string, size: number) => {
  if (!extras) return null;
  const scale = size / 100;

  return extras.map((extra, i) => {
    switch (extra) {
      case 'spikes':
        return (
          <g key={i}>
            <polygon points="50,0 55,15 45,15" fill={color} />
            <polygon points="25,10 35,22 22,22" fill={color} />
            <polygon points="75,10 78,22 65,22" fill={color} />
          </g>
        );
      case 'eyebrows':
        return (
          <g key={i}>
            <line x1="25" y1="28" x2="42" y2="32" stroke={color} strokeWidth={4 * scale} strokeLinecap="round" />
            <line x1="75" y1="28" x2="58" y2="32" stroke={color} strokeWidth={4 * scale} strokeLinecap="round" />
          </g>
        );
      case 'moss':
        return (
          <g key={i}>
            <circle cx="25" cy="25" r={5 * scale} fill="#22c55e" opacity={0.7} />
            <circle cx="75" cy="30" r={4 * scale} fill="#22c55e" opacity={0.7} />
            <circle cx="30" cy="15" r={3 * scale} fill="#22c55e" opacity={0.7} />
          </g>
        );
      case 'bubbles':
        return (
          <g key={i} className="animate-monster-bubble-float">
            <circle cx="80" cy="30" r={3 * scale} fill="rgba(255,255,255,0.5)" className="animate-monster-bubble-1" />
            <circle cx="85" cy="45" r={2 * scale} fill="rgba(255,255,255,0.5)" className="animate-monster-bubble-2" />
            <circle cx="78" cy="55" r={2.5 * scale} fill="rgba(255,255,255,0.5)" className="animate-monster-bubble-3" />
          </g>
        );
      default:
        return null;
    }
  });
};

export const MonsterAvatar = ({ name, size = 100, isWinner = false, animated = true }: { name: string, size?: number, isWinner?: boolean, animated?: boolean }) => {
  const monster = MONSTERS.find(m => m.name === name) || MONSTERS[0];

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
        {/* Body */}
        {monster.shape === 'circle' ? (
          <circle cx="50" cy="50" r="40" fill={monster.color} />
        ) : (
          <path d={bodyPath} fill={monster.color} />
        )}

        {/* Extras (spikes, moss, etc.) */}
        {getExtras(monster.extras, monster.color, size)}

        {/* Eyes with optional animation */}
        <g className={animated && monster.eyeAnimationClass ? monster.eyeAnimationClass : ''}>
          {getEyes(monster.eyeStyle, size)}
        </g>

        {/* Mouth with optional animation */}
        <g className={animated && monster.mouthAnimationClass ? monster.mouthAnimationClass : ''}>
          {getMouth(monster.mouthStyle, size)}
        </g>
      </svg>
    </div>
  );
};

