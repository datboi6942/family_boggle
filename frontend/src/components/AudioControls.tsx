/**
 * Audio controls component for muting/unmuting sounds and music.
 */

import { useState, useCallback } from 'react';
import { Volume2, VolumeX, Music, Music2 } from 'lucide-react';
import { useAudioContext } from '../contexts/AudioContext';
import { motion, AnimatePresence } from 'framer-motion';

export function AudioControls() {
  const audio = useAudioContext();
  const [showVolume, setShowVolume] = useState(false);

  // Stop propagation to prevent parent handlers from interfering
  const handleToggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    audio.toggleMute();
  }, [audio]);

  const handleToggleMusicMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    audio.toggleMusicMute();
  }, [audio]);

  const handleSfxVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    audio.setSfxVolume(parseFloat(e.target.value));
  }, [audio]);

  const handleMusicVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    audio.setMusicVolume(parseFloat(e.target.value));
  }, [audio]);

  const handleContainerClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2"
      onClick={handleContainerClick}
      onTouchStart={handleContainerClick}
    >
      <AnimatePresence>
        {showVolume && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="frosted-glass p-3 rounded-xl flex flex-col gap-3 mb-2"
          >
            {/* SFX Volume */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70 w-10">SFX</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audio.sfxVolume}
                onChange={handleSfxVolumeChange}
                className="w-24 accent-primary"
              />
              <span className="text-xs text-white/50 w-8">{Math.round(audio.sfxVolume * 100)}%</span>
            </div>
            {/* Music Volume */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/70 w-10">Music</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audio.musicVolume}
                onChange={handleMusicVolumeChange}
                className="w-24 accent-primary"
              />
              <span className="text-xs text-white/50 w-8">{Math.round(audio.musicVolume * 100)}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        {/* Volume slider toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowVolume(!showVolume); }}
          className="frosted-glass p-3 rounded-full hover:bg-white/10 transition-colors"
          title="Volume settings"
        >
          <Volume2 className="w-5 h-5 text-white/70" />
        </button>

        {/* SFX Mute */}
        <button
          onClick={handleToggleMute}
          className={`frosted-glass p-3 rounded-full hover:bg-white/10 transition-colors ${audio.isMuted ? 'bg-red-500/20' : ''}`}
          title={audio.isMuted ? 'Unmute sounds' : 'Mute sounds'}
        >
          {audio.isMuted ? (
            <VolumeX className="w-5 h-5 text-red-400" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>

        {/* Music Mute */}
        <button
          onClick={handleToggleMusicMute}
          className={`frosted-glass p-3 rounded-full hover:bg-white/10 transition-colors ${audio.isMusicMuted ? 'bg-red-500/20' : ''}`}
          title={audio.isMusicMuted ? 'Unmute music' : 'Mute music'}
        >
          {audio.isMusicMuted ? (
            <Music className="w-5 h-5 text-red-400" />
          ) : (
            <Music2 className="w-5 h-5 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}
