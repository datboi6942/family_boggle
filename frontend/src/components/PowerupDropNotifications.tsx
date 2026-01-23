import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { Snowflake, Bomb, RotateCw, Lock } from 'lucide-react';
import { useAudioContext } from '../contexts/AudioContext';
import { useEffect, useRef } from 'react';

const powerupIcons: Record<string, React.ReactNode> = {
  freeze: <Snowflake className="w-5 h-5" />,
  blowup: <Bomb className="w-5 h-5" />,
  shuffle: <RotateCw className="w-5 h-5" />,
  lock: <Lock className="w-5 h-5" />,
};

export const PowerupDropNotifications = () => {
  const { powerupDropNotifications } = useGameStore(
    useShallow(state => ({
      powerupDropNotifications: state.powerupDropNotifications,
    }))
  );
  const audio = useAudioContext();
  const prevCountRef = useRef(powerupDropNotifications.length);

  useEffect(() => {
    // If a new notification was added, play sound
    if (powerupDropNotifications.length > prevCountRef.current) {
      audio.playPowerupEarned();
    }
    prevCountRef.current = powerupDropNotifications.length;
  }, [powerupDropNotifications.length, audio]);

  if (powerupDropNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-20 left-0 right-0 z-50 pointer-events-none flex flex-col items-center space-y-2">
      <AnimatePresence>
        {powerupDropNotifications.map((notification) => (
          <motion.div
            key={notification.id}
            initial={{ opacity: 0, y: -20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            className="frosted-glass px-4 py-3 rounded-xl shadow-lg border-2 border-primary/50 flex items-center gap-3 pointer-events-auto"
          >
            <div className="text-primary">
              {powerupIcons[notification.powerup] || <div className="w-5 h-5 bg-primary rounded-full" />}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white">{notification.message}</span>
              <span className="text-xs text-white/60">Added to your inventory</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};