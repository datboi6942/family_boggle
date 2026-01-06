import { useLayoutEffect, useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useAudioContext } from '../contexts/AudioContext';
import { motion, AnimatePresence } from 'framer-motion';

export const Countdown = () => {
  const { timer } = useGameStore();
  const audio = useAudioContext();
  const lastTimerRef = useRef<number | null>(null);
  const musicStartedRef = useRef(false);

  // Keep a ref to audio so effects can access latest version
  const audioRef = useRef(audio);
  audioRef.current = audio;

  // CRITICAL: Scroll to top and lock scroll during countdown
  // This ensures the game board will be properly positioned when the game starts
  useEffect(() => {
    // Force scroll to top immediately - this is crucial for touch accuracy
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Lock body scroll during countdown to prevent any accidental scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.top = '0';
    document.body.style.left = '0';

    return () => {
      // Don't restore scroll here - GameBoard will take over scroll lock
      // Only restore if going back to lobby (which will handle its own cleanup)
    };
  }, []);

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
    <div
      className="flex items-center justify-center bg-navy-gradient fixed inset-0"
      style={{
        height: '100dvh',
        minHeight: '-webkit-fill-available',
      }}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={timer}
          initial={{ scale: 2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="text-[15rem] font-black italic text-primary drop-shadow-[0_0_30px_rgba(139,92,246,0.5)]"
        >
          {timer > 0 ? timer : 'GO!'}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};


