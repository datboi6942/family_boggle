/**
 * Audio manager hook for Family Boggle game.
 * Handles all sound effects and background music.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// Audio file paths
const AUDIO_BASE = '/audio';

const SFX = {
  letterSelect: `${AUDIO_BASE}/sfx/letter_select.wav`,
  letterChain: (n: number) => `${AUDIO_BASE}/sfx/letter_chain_${Math.min(n, 10)}.wav`,
  wordValid: `${AUDIO_BASE}/sfx/word_valid.wav`,
  wordInvalid: `${AUDIO_BASE}/sfx/word_invalid.wav`,
  wordAlreadyFound: `${AUDIO_BASE}/sfx/word_already_found.wav`,
  powerupEarned: `${AUDIO_BASE}/sfx/powerup_earned.wav`,
  powerupFreeze: `${AUDIO_BASE}/sfx/powerup_freeze.wav`,
  powerupBomb: `${AUDIO_BASE}/sfx/powerup_bomb.wav`,
  powerupShuffle: `${AUDIO_BASE}/sfx/powerup_shuffle.wav`,
  powerupLock: `${AUDIO_BASE}/sfx/powerup_lock.wav`,
  timerTick: `${AUDIO_BASE}/sfx/timer_tick.wav`,
  timerWarning: `${AUDIO_BASE}/sfx/timer_warning.wav`,
  gameStart: `${AUDIO_BASE}/sfx/game_start.wav`,
  countdownBeep: `${AUDIO_BASE}/sfx/countdown_beep.wav`,
  countdownGo: `${AUDIO_BASE}/sfx/countdown_go.wav`,
  gameEnd: `${AUDIO_BASE}/sfx/game_end.wav`,
};

const CELEBRATION = {
  victoryFanfare: `${AUDIO_BASE}/celebration/victory_fanfare.wav`,
  wordAwardReveal: `${AUDIO_BASE}/celebration/word_award_reveal.wav`,
  pointsFly: `${AUDIO_BASE}/celebration/points_fly.wav`,
  pointsLand: `${AUDIO_BASE}/celebration/points_land.wav`,
  uniqueWordBonus: `${AUDIO_BASE}/celebration/unique_word_bonus.wav`,
  challengeComplete: `${AUDIO_BASE}/celebration/challenge_complete.wav`,
  longestWordAward: `${AUDIO_BASE}/celebration/longest_word_award.wav`,
  leaderboardReveal: `${AUDIO_BASE}/celebration/leaderboard_reveal.wav`,
  confettiBurst: `${AUDIO_BASE}/celebration/confetti_burst.wav`,
  scoreTick: `${AUDIO_BASE}/celebration/score_tick.wav`,
  finalScoreReveal: `${AUDIO_BASE}/celebration/final_score_reveal.wav`,
  buttonClick: `${AUDIO_BASE}/celebration/button_click.wav`,
  buttonHover: `${AUDIO_BASE}/celebration/button_hover.wav`,
};

const MUSIC = {
  gameplay: `${AUDIO_BASE}/music/gameplay_loop.wav`,
  gameplayIntense: `${AUDIO_BASE}/music/gameplay_intense.wav`,
  menu: `${AUDIO_BASE}/music/menu_loop.wav`,
  summary: `${AUDIO_BASE}/music/summary_loop.wav`,
  countdownRiser: `${AUDIO_BASE}/music/countdown_riser.wav`,
};

// Audio cache for preloading - stores template elements
const MAX_AUDIO_CACHE_SIZE = 25;
const audioCache: Map<string, HTMLAudioElement> = new Map();
const audioCacheOrder: string[] = []; // Track access order for LRU

// Pool of active audio instances for cleanup
const activeAudioPool: HTMLAudioElement[] = [];
const MAX_ACTIVE_AUDIO = 20; // Max concurrent sounds

// Track if audio has been unlocked (required on mobile)
let audioUnlocked = false;

// Callbacks to run after audio is unlocked
const pendingAudioCallbacks: Array<() => void> = [];

function unlockAudio(): void {
  if (audioUnlocked) return;
  
  // Create a silent audio context to unlock audio on mobile
  try {
    const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      ctx.resume();
    }
    
    // Also try to play/pause all cached audio elements to unlock them
    audioCache.forEach((audio) => {
      const playPromise = audio.play();
      if (playPromise) {
        playPromise.then(() => {
          audio.pause();
          audio.currentTime = 0;
        }).catch(() => {
          // Ignore - not all audio may be ready
        });
      }
    });
    
    audioUnlocked = true;
    console.log('Audio unlocked');
    
    // Run any pending audio callbacks
    while (pendingAudioCallbacks.length > 0) {
      const callback = pendingAudioCallbacks.shift();
      if (callback) {
        try {
          callback();
        } catch (e) {
          console.warn('Pending audio callback failed:', e);
        }
      }
    }
  } catch (e) {
    console.warn('Failed to unlock audio:', e);
  }
}

// Add a callback to run after audio is unlocked
function onAudioUnlocked(callback: () => void): void {
  if (audioUnlocked) {
    callback();
  } else {
    pendingAudioCallbacks.push(callback);
  }
}

// Unlock audio on first user interaction
if (typeof window !== 'undefined') {
  const unlockHandler = () => {
    unlockAudio();
    document.removeEventListener('touchstart', unlockHandler);
    document.removeEventListener('touchend', unlockHandler);
    document.removeEventListener('click', unlockHandler);
    document.removeEventListener('keydown', unlockHandler);
  };
  document.addEventListener('touchstart', unlockHandler, { passive: true });
  document.addEventListener('touchend', unlockHandler, { passive: true });
  document.addEventListener('click', unlockHandler, { passive: true });
  document.addEventListener('keydown', unlockHandler, { passive: true });
}

function getAudio(src: string): HTMLAudioElement {
  if (!audioCache.has(src)) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audioCache.set(src, audio);
    audioCacheOrder.push(src);

    // LRU eviction - remove oldest entries when cache exceeds limit
    while (audioCacheOrder.length > MAX_AUDIO_CACHE_SIZE) {
      const oldest = audioCacheOrder.shift();
      if (oldest) {
        const oldAudio = audioCache.get(oldest);
        if (oldAudio) {
          oldAudio.pause();
          oldAudio.src = ''; // Release resources
        }
        audioCache.delete(oldest);
      }
    }
  } else {
    // Move to end of access order (most recently used)
    const idx = audioCacheOrder.indexOf(src);
    if (idx !== -1) {
      audioCacheOrder.splice(idx, 1);
      audioCacheOrder.push(src);
    }
  }
  return audioCache.get(src)!;
}

// Create a fresh audio instance for reliable playback
// This prevents issues where reusing the same Audio element causes sounds to not play
function createFreshAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src);
  audio.preload = 'auto';

  // Track in pool for cleanup
  activeAudioPool.push(audio);

  // Clean up after playback ends
  audio.addEventListener('ended', () => {
    const idx = activeAudioPool.indexOf(audio);
    if (idx !== -1) {
      activeAudioPool.splice(idx, 1);
    }
    audio.src = ''; // Release resources
  }, { once: true });

  // Also clean up on error
  audio.addEventListener('error', () => {
    const idx = activeAudioPool.indexOf(audio);
    if (idx !== -1) {
      activeAudioPool.splice(idx, 1);
    }
  }, { once: true });

  // If pool is too large, clean up oldest non-playing sounds
  while (activeAudioPool.length > MAX_ACTIVE_AUDIO) {
    const oldest = activeAudioPool.shift();
    if (oldest && oldest.paused) {
      oldest.src = '';
    } else if (oldest) {
      // If still playing, put it back and try the next
      activeAudioPool.push(oldest);
      break;
    }
  }

  return audio;
}

// Preload an audio file so it's ready to play instantly
function preloadAudio(src: string): void {
  const audio = getAudio(src);
  // Force the browser to start loading
  audio.load();
}

// Preload commonly used SFX for faster playback
function preloadCommonSfx(): void {
  // Preload all SFX that are used during gameplay
  const commonSfx = [
    SFX.letterSelect,
    SFX.wordValid,
    SFX.wordInvalid,
    SFX.wordAlreadyFound,
    SFX.powerupEarned,
    SFX.powerupFreeze,
    SFX.powerupBomb,
    SFX.powerupShuffle,
    SFX.powerupLock,
    SFX.timerWarning,
    SFX.gameStart,
    SFX.countdownBeep,
    SFX.countdownGo,
    SFX.gameEnd,
  ];

  // Also preload chain sounds
  for (let i = 1; i <= 10; i++) {
    commonSfx.push(SFX.letterChain(i));
  }

  commonSfx.forEach(src => preloadAudio(src));
}

// Preload common sounds when module loads
if (typeof window !== 'undefined') {
  // Delay preloading slightly to not block initial page load
  setTimeout(preloadCommonSfx, 500);
}

export interface AudioManager {
  // Settings
  isMuted: boolean;
  isMusicMuted: boolean;
  sfxVolume: number;
  musicVolume: number;
  toggleMute: () => void;
  toggleMusicMute: () => void;
  setSfxVolume: (vol: number) => void;
  setMusicVolume: (vol: number) => void;

  // Sound effects
  playLetterSelect: () => void;
  playLetterChain: (chainLength: number) => void;
  playWordValid: () => void;
  playWordInvalid: () => void;
  playWordAlreadyFound: () => void;
  playPowerupEarned: () => void;
  playPowerupFreeze: () => void;
  playPowerupBomb: () => void;
  playPowerupShuffle: () => void;
  playPowerupLock: () => void;
  playTimerTick: () => void;
  playTimerWarning: () => void;
  playGameStart: () => void;
  playCountdownBeep: () => void;
  playCountdownGo: () => void;
  playGameEnd: () => void;

  // Celebration sounds
  playVictoryFanfare: () => void;
  playWordAwardReveal: () => void;
  playPointsFly: () => void;
  playPointsLand: () => void;
  playUniqueWordBonus: () => void;
  playChallengeComplete: () => void;
  playLongestWordAward: () => void;
  playLeaderboardReveal: () => void;
  playConfettiBurst: () => void;
  playScoreTick: () => void;
  playFinalScoreReveal: () => void;
  playButtonClick: () => void;
  playButtonHover: () => void;

  // Music
  playGameplayMusic: () => void;
  playGameplayIntenseMusic: () => void;
  preloadGameplayIntenseMusic: () => void;
  playMenuMusic: () => void;
  playSummaryMusic: () => void;
  playCountdownRiser: () => void;
  stopMusic: () => void;
  pauseMusic: () => void;
  resumeMusic: () => void;
}

export function useAudio(): AudioManager {
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('boggle-audio-muted');
    return saved === 'true';
  });

  const [isMusicMuted, setIsMusicMuted] = useState(() => {
    const saved = localStorage.getItem('boggle-music-muted');
    // Default to NOT muted if no preference saved
    return saved === 'true';
  });

  // Track pending music to play after audio is unlocked
  const pendingMusicRef = useRef<{ src: string; loop: boolean } | null>(null);

  const [sfxVolume, setSfxVolumeState] = useState(() => {
    const saved = localStorage.getItem('boggle-sfx-volume');
    return saved ? parseFloat(saved) : 0.7;
  });

  const [musicVolume, setMusicVolumeState] = useState(() => {
    const saved = localStorage.getItem('boggle-music-volume');
    return saved ? parseFloat(saved) : 0.4;
  });

  const currentMusicRef = useRef<HTMLAudioElement | null>(null);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem('boggle-audio-muted', String(isMuted));
  }, [isMuted]);

  useEffect(() => {
    localStorage.setItem('boggle-music-muted', String(isMusicMuted));
  }, [isMusicMuted]);

  useEffect(() => {
    localStorage.setItem('boggle-sfx-volume', String(sfxVolume));
  }, [sfxVolume]);

  useEffect(() => {
    localStorage.setItem('boggle-music-volume', String(musicVolume));
  }, [musicVolume]);

  // Update music volume when it changes
  useEffect(() => {
    if (currentMusicRef.current) {
      currentMusicRef.current.volume = isMusicMuted ? 0 : musicVolume;
    }
  }, [musicVolume, isMusicMuted]);

  const playSfx = useCallback((src: string, volume?: number) => {
    if (isMuted) return;

    const doPlaySfx = () => {
      try {
        // Create a fresh audio instance for each play
        // This prevents conflicts when sounds are triggered rapidly
        const audio = createFreshAudio(src);
        audio.volume = volume ?? sfxVolume;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((e) => {
            console.warn('Audio play failed:', e.message);
            // On failure, clean up the audio element
            const idx = activeAudioPool.indexOf(audio);
            if (idx !== -1) {
              activeAudioPool.splice(idx, 1);
            }
            audio.src = '';
          });
        }
      } catch (e) {
        // Ignore audio errors
      }
    };

    // Try to unlock audio first
    unlockAudio();

    // If audio is unlocked, play immediately
    if (audioUnlocked) {
      doPlaySfx();
    } else {
      // Queue to play after unlock (only for important sounds like countdown)
      onAudioUnlocked(doPlaySfx);
    }
  }, [isMuted, sfxVolume]);

  const playMusic = useCallback((src: string, loop: boolean = true) => {
    const doPlayMusic = () => {
      try {
        const audio = getAudio(src);

        // If already playing this track, just update volume and return
        if (currentMusicRef.current === audio && !audio.paused) {
          audio.volume = isMusicMuted ? 0 : musicVolume;
          return;
        }

        // Stop previous music if different track
        if (currentMusicRef.current && currentMusicRef.current !== audio) {
          currentMusicRef.current.pause();
          currentMusicRef.current.currentTime = 0;
        }

        audio.loop = loop;
        audio.volume = isMusicMuted ? 0 : musicVolume;
        audio.currentTime = 0;

        // Always try to play
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch((e) => {
            console.warn('Music play failed:', e.message);
            // Try loading and playing again
            audio.load();
            setTimeout(() => {
              audio.play().catch(() => {});
            }, 100);
          });
        }

        currentMusicRef.current = audio;
      } catch (e) {
        console.warn('Music error:', e);
        // Queue retry for when audio is unlocked
        pendingMusicRef.current = { src, loop };
      }
    };

    // Try to unlock audio first
    unlockAudio();

    // If audio is unlocked, play immediately; otherwise queue it
    if (audioUnlocked) {
      doPlayMusic();
    } else {
      // Store pending music and queue callback
      pendingMusicRef.current = { src, loop };
      onAudioUnlocked(() => {
        if (pendingMusicRef.current && pendingMusicRef.current.src === src) {
          doPlayMusic();
        }
      });
    }
  }, [isMusicMuted, musicVolume]);

  // Preload a music track so it's ready to play
  const preloadMusicTrack = useCallback((src: string) => {
    preloadAudio(src);
  }, []);

  const stopMusic = useCallback(() => {
    if (currentMusicRef.current) {
      currentMusicRef.current.pause();
      currentMusicRef.current.currentTime = 0;
      currentMusicRef.current = null;
    }
  }, []);

  const pauseMusic = useCallback(() => {
    currentMusicRef.current?.pause();
  }, []);

  const resumeMusic = useCallback(() => {
    currentMusicRef.current?.play().catch(() => {});
  }, []);

  return {
    // Settings
    isMuted,
    isMusicMuted,
    sfxVolume,
    musicVolume,
    toggleMute: () => setIsMuted(m => !m),
    toggleMusicMute: () => setIsMusicMuted(m => !m),
    setSfxVolume: (vol: number) => setSfxVolumeState(Math.max(0, Math.min(1, vol))),
    setMusicVolume: (vol: number) => setMusicVolumeState(Math.max(0, Math.min(1, vol))),

    // Sound effects
    playLetterSelect: () => playSfx(SFX.letterSelect),
    playLetterChain: (n: number) => playSfx(SFX.letterChain(n)),
    playWordValid: () => playSfx(SFX.wordValid),
    playWordInvalid: () => playSfx(SFX.wordInvalid),
    playWordAlreadyFound: () => playSfx(SFX.wordAlreadyFound),
    playPowerupEarned: () => playSfx(SFX.powerupEarned),
    playPowerupFreeze: () => playSfx(SFX.powerupFreeze),
    playPowerupBomb: () => playSfx(SFX.powerupBomb),
    playPowerupShuffle: () => playSfx(SFX.powerupShuffle),
    playPowerupLock: () => playSfx(SFX.powerupLock),
    playTimerTick: () => playSfx(SFX.timerTick, 0.3),
    playTimerWarning: () => playSfx(SFX.timerWarning),
    playGameStart: () => playSfx(SFX.gameStart),
    playCountdownBeep: () => playSfx(SFX.countdownBeep),
    playCountdownGo: () => playSfx(SFX.countdownGo),
    playGameEnd: () => playSfx(SFX.gameEnd),

    // Celebration sounds
    playVictoryFanfare: () => playSfx(CELEBRATION.victoryFanfare),
    playWordAwardReveal: () => playSfx(CELEBRATION.wordAwardReveal),
    playPointsFly: () => playSfx(CELEBRATION.pointsFly),
    playPointsLand: () => playSfx(CELEBRATION.pointsLand),
    playUniqueWordBonus: () => playSfx(CELEBRATION.uniqueWordBonus),
    playChallengeComplete: () => playSfx(CELEBRATION.challengeComplete),
    playLongestWordAward: () => playSfx(CELEBRATION.longestWordAward),
    playLeaderboardReveal: () => playSfx(CELEBRATION.leaderboardReveal),
    playConfettiBurst: () => playSfx(CELEBRATION.confettiBurst),
    playScoreTick: () => playSfx(CELEBRATION.scoreTick, 0.4),
    playFinalScoreReveal: () => playSfx(CELEBRATION.finalScoreReveal),
    playButtonClick: () => playSfx(CELEBRATION.buttonClick),
    playButtonHover: () => playSfx(CELEBRATION.buttonHover, 0.3),

    // Music
    playGameplayMusic: () => {
      playMusic(MUSIC.gameplay);
      // Preload intense track so it's ready when timer hits 30s
      preloadMusicTrack(MUSIC.gameplayIntense);
    },
    playGameplayIntenseMusic: () => playMusic(MUSIC.gameplayIntense),
    preloadGameplayIntenseMusic: () => preloadMusicTrack(MUSIC.gameplayIntense),
    playMenuMusic: () => playMusic(MUSIC.menu),
    playSummaryMusic: () => playMusic(MUSIC.summary),
    playCountdownRiser: () => playMusic(MUSIC.countdownRiser, false),
    stopMusic,
    pauseMusic,
    resumeMusic,
  };
}
