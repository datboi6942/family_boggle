import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useAudioContext } from '../contexts/AudioContext';
import { motion } from 'framer-motion';

export const Countdown = () => {
  const { timer } = useGameStore();
  const audio = useAudioContext();
  const lastTimerRef = useRef<number | null>(null);
  const musicStartedRef = useRef(false);

  // Play countdown riser music when countdown starts
  useEffect(() => {
    if (!musicStartedRef.current) {
      audio.playCountdownRiser();
      musicStartedRef.current = true;
    }
    return () => {
      musicStartedRef.current = false;
    };
  }, [audio]);

  // Play countdown sounds on timer change
  useEffect(() => {
    if (lastTimerRef.current !== timer) {
      if (timer > 0 && timer <= 3) {
        audio.playCountdownBeep();
      } else if (timer === 0 || lastTimerRef.current === 1) {
        audio.playCountdownGo();
      }
      lastTimerRef.current = timer;
    }
  }, [timer, audio]);

  return (
    <div className="flex items-center justify-center h-full bg-navy-gradient">
      <motion.div
        key={timer}
        initial={{ scale: 2, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        className="text-[15rem] font-black italic text-primary drop-shadow-[0_0_30px_rgba(139,92,246,0.5)]"
      >
        {timer > 0 ? timer : 'GO!'}
      </motion.div>
    </div>
  );
};
