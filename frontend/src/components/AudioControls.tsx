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
  const handleToggleMute = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    audio.toggleMute();
    // Play a test sound to confirm it's working (only if unmuting)
    if (audio.isMuted) {
      setTimeout(() => audio.playButtonClick(), 50);
    }
  }, [audio]);

  const handleToggleMusicMute = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
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

  // Determine icon based on mute state
  const isBothMuted = audio.isMuted && audio.isMusicMuted;
  const isAnyMuted = audio.isMuted || audio.isMusicMuted;

  return (
    <div
      className="fixed bottom-4 left-4 z-50"
      onClick={handleContainerClick}
      onTouchStart={handleContainerClick}
    >
      {/* Toggle Button - shows muted state */}
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); setIsOpen(!isOpen); }}
        className={`frosted-glass p-3 rounded-full transition-all ${isOpen ? 'bg-primary/30 ring-2 ring-primary' : ''} ${isBothMuted ? 'bg-red-500/20' : isAnyMuted ? 'bg-yellow-500/20' : ''}`}
        title="Audio settings"
      >
        {isOpen ? (
          <X className="w-5 h-5 text-white" />
        ) : isBothMuted ? (
          <VolumeX className="w-5 h-5 text-red-400" />
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
                  onTouchEnd={handleToggleMute}
                  className={`p-2 rounded-lg transition-colors active:scale-95 ${audio.isMuted ? 'bg-red-500/30 text-red-400 ring-1 ring-red-500' : 'bg-green-500/20 text-green-400 ring-1 ring-green-500'}`}
                  title={audio.isMuted ? 'Unmute sounds' : 'Mute sounds'}
                >
                  {audio.isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audio.sfxVolume}
                onChange={handleSfxVolumeChange}
                className="w-full accent-primary h-2 rounded-lg"
                disabled={audio.isMuted}
              />
              <div className="flex justify-between text-xs text-white/40 mt-1">
                <span>{audio.isMuted ? 'MUTED' : 'ON'}</span>
                <span>{Math.round(audio.sfxVolume * 100)}%</span>
              </div>
            </div>

            {/* Music Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-white">Music</span>
                <button
                  onClick={handleToggleMusicMute}
                  onTouchEnd={handleToggleMusicMute}
                  className={`p-2 rounded-lg transition-colors active:scale-95 ${audio.isMusicMuted ? 'bg-red-500/30 text-red-400 ring-1 ring-red-500' : 'bg-green-500/20 text-green-400 ring-1 ring-green-500'}`}
                  title={audio.isMusicMuted ? 'Unmute music' : 'Mute music'}
                >
                  {audio.isMusicMuted ? <Music className="w-5 h-5" /> : <Music2 className="w-5 h-5" />}
                </button>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={audio.musicVolume}
                onChange={handleMusicVolumeChange}
                className="w-full accent-primary h-2 rounded-lg"
                disabled={audio.isMusicMuted}
              />
              <div className="flex justify-between text-xs text-white/40 mt-1">
                <span>{audio.isMusicMuted ? 'MUTED' : 'ON'}</span>
                <span>{Math.round(audio.musicVolume * 100)}%</span>
              </div>
            </div>

            {/* Test Sound Button */}
            <button
              onClick={(e) => { e.stopPropagation(); audio.playButtonClick(); }}
              onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); audio.playButtonClick(); }}
              className="w-full mt-3 py-2 px-3 bg-primary/20 hover:bg-primary/30 rounded-lg text-xs font-bold text-primary transition-colors active:scale-95"
            >
              🔊 Test Sound
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
