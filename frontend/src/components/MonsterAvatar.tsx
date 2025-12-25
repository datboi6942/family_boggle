import { motion } from 'framer-motion';

export const MONSTERS = [
  { name: 'Blobby', color: '#22c55e', animation: { y: [0, -10, 0], scaleY: [1, 0.9, 1] } },
  { name: 'Spike', color: '#8b5cf6', animation: { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } },
  { name: 'Chompy', color: '#f97316', animation: { skewX: [0, 10, -10, 0] } },
  { name: 'Floaty', color: '#3b82f6', animation: { y: [-20, 20, -20] } },
  { name: 'Grumble', color: '#ef4444', animation: { x: [-5, 5, -5] } },
  { name: 'Zippy', color: '#eab308', animation: { opacity: [1, 0.5, 1], scale: [1, 1.2, 1] } },
  { name: 'Mossy', color: '#166534', animation: { rotate: [0, 360], transition: { duration: 5, repeat: Infinity } } },
  { name: 'Pebble', color: '#6b7280', animation: { scale: [1, 0.95, 1] } },
  { name: 'Bubbles', color: '#ec4899', animation: { y: [0, -30, 0], x: [0, 10, -10, 0] } },
  { name: 'Shadow', color: '#1f2937', animation: { scale: [1, 1.5, 1], opacity: [0.3, 0.7, 0.3] } },
];

export const MonsterAvatar = ({ name, size = 100, isWinner = false }: { name: string, size?: number, isWinner?: boolean }) => {
  const monster = MONSTERS.find(m => m.name === name) || MONSTERS[0];
  
  return (
    <div className="relative flex flex-col items-center">
      {isWinner && (
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: -20, opacity: 1 }}
          className="absolute text-4xl"
        >
          👑
        </motion.div>
      )}
      <motion.svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        animate={monster.animation}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        <circle cx="50" cy="50" r="40" fill={monster.color} />
        <circle cx="35" cy="40" r="5" fill="white" />
        <circle cx="65" cy="40" r="5" fill="white" />
        <circle cx="37" cy="40" r="2" fill="black" />
        <circle cx="67" cy="40" r="2" fill="black" />
        <path d="M 35 70 Q 50 80 65 70" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" />
      </motion.svg>
    </div>
  );
};
