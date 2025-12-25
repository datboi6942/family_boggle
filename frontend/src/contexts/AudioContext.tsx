/**
 * Audio context for sharing audio manager across all components.
 */

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useAudio } from '../hooks/useAudio';
import type { AudioManager } from '../hooks/useAudio';

const AudioContext = createContext<AudioManager | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const audio = useAudio();

  return (
    <AudioContext.Provider value={audio}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudioContext(): AudioManager {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error('useAudioContext must be used within an AudioProvider');
  }
  return context;
}
