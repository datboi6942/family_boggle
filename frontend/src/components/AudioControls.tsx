/**
 * Audio controls component - collapsible side panel in bottom left.
 */

import { useState, useCallback } from 'react';
import { Volume2, VolumeX, Music, Music2, Settings, X } from 'lucide-react';
import { useAudioContext } from '../contexts/AudioContext';
import { motion, AnimatePresence } from 'framer-motion';

export function AudioControls() {
  const audio = useAudioContext();
  const [isOpen, setIsOpen] = useState(false);

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
      className="fixed bottom-4 left-4 z-50"
      onClick={handleContainerClick}
      onTouchStart={handleContainerClick}
    >
      {/* Toggle Button */}
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`frosted-glass p-3 rounded-full hover:bg-white/10 transition-all ${isOpen ? 'bg-primary/20' : ''}`}
        title="Audio settings"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : (
          <Settings className="w-5 h-5 text-white/70" />
        )}
      </button>

      {/* Side Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: -20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -20, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute bottom-14 left-0 frosted-glass p-4 rounded-xl w-56"
          >
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Audio Settings</h3>
            
            {/* SFX Section */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">Sound Effects</span>
                <button
                  onClick={handleToggleMute}
                  className={`p-1.5 rounded-lg transition-colors ${audio.isMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`}
                  title={audio.isMuted ? 'Unmute sounds' : 'Mute sounds'}
                >
                  {audio.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audio.sfxVolume}
                onChange={handleSfxVolumeChange}
                className="w-full accent-primary h-1.5"
                disabled={audio.isMuted}
              />
              <div className="text-right text-xs text-white/40 mt-1">
                {Math.round(audio.sfxVolume * 100)}%
              </div>
            </div>

            {/* Music Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">Music</span>
                <button
                  onClick={handleToggleMusicMute}
                  className={`p-1.5 rounded-lg transition-colors ${audio.isMusicMuted ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`}
                  title={audio.isMusicMuted ? 'Unmute music' : 'Mute music'}
                >
                  {audio.isMusicMuted ? <Music className="w-4 h-4" /> : <Music2 className="w-4 h-4" />}
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audio.musicVolume}
                onChange={handleMusicVolumeChange}
                className="w-full accent-primary h-1.5"
                disabled={audio.isMusicMuted}
              />
              <div className="text-right text-xs text-white/40 mt-1">
                {Math.round(audio.musicVolume * 100)}%
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
