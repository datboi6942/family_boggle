export interface MonsterConfig {
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
