import { useGameStore } from '../stores/gameStore';
import { motion } from 'framer-motion';

export const Countdown = () => {
  const { timer } = useGameStore();

  return (
    <div className="flex items-center justify-center h-full bg-navy-gradient">
      <motion.div
        key={timer}
        initial={{ scale: 2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="text-[15rem] font-black italic text-primary drop-shadow-[0_0_30px_rgba(139,92,246,0.5)]"
      >
        {timer}
      </motion.div>
    </div>
  );
};
