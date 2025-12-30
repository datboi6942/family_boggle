import { useLayoutEffect, useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useAudioContext } from '../contexts/AudioContext';
import { motion } from 'framer-motion';

export const Countdown = () => {
  const { timer } = useGameStore();
  const audio = useAudioContext();
  const lastTimerRef = useRef<number | null>(null);
  const musicStartedRef = useRef(false);

  // Keep a ref to audio so effects can access latest version
  const audioRef = useRef(audio);
  audioRef.current = audio;

  // Stop any previous music and play countdown riser when countdown starts
  useEffect(() => {
    if (!musicStartedRef.current) {
      // Stop lobby music first
      audioRef.current.stopMusic();
      // Small delay to ensure clean transition
      const timeoutId = setTimeout(() => {
        audioRef.current.playCountdownRiser();
      }, 50);
      musicStartedRef.current = true;
      return () => clearTimeout(timeoutId);
    }
  }, []);

  // Play countdown sounds immediately on timer change (useLayoutEffect for sync timing)
  useLayoutEffect(() => {
    if (lastTimerRef.current !== timer) {
      if (timer > 0 && timer <= 3) {
        audioRef.current.playCountdownBeep();
      } else if (timer === 0) {
        audioRef.current.playCountdownGo();
      }
      lastTimerRef.current = timer;
    }
  }, [timer]);

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


