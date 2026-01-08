/**
 * Audio manager hook for Family Boggle game.
 * Uses Web Audio API for reliable, consistent sound playback.
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

// Web Audio API context and buffer cache
let audioContext: AudioContext | null = null;
const bufferCache: Map<string, AudioBuffer> = new Map();
const loadingPromises: Map<string, Promise<AudioBuffer | null>> = new Map();

// Track if audio context has been resumed (required on mobile)
let audioContextResumed = false;

// Get or create AudioContext
function getAudioContext(): AudioContext {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

// Resume audio context (required after user interaction on mobile)
async function resumeAudioContext(): Promise<void> {
  if (audioContextResumed) return;

  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
      audioContextResumed = true;
      console.log('AudioContext resumed');
    } catch (e) {
      console.warn('Failed to resume AudioContext:', e);
    }
  } else {
    audioContextResumed = true;
  }
}

// Load an audio file into an AudioBuffer
async function loadAudioBuffer(src: string): Promise<AudioBuffer | null> {
  // Return cached buffer if available
  if (bufferCache.has(src)) {
    return bufferCache.get(src)!;
  }

  // Return existing promise if already loading
  if (loadingPromises.has(src)) {
    return loadingPromises.get(src)!;
  }

  // Start loading
  const loadPromise = (async () => {
    try {
      const response = await fetch(src);
      if (!response.ok) {
        console.warn(`Failed to fetch audio: ${src}`);
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const ctx = getAudioContext();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      bufferCache.set(src, audioBuffer);
      return audioBuffer;
    } catch (e) {
      console.warn(`Failed to load audio: ${src}`, e);
      return null;
    } finally {
      loadingPromises.delete(src);
    }
  })();

  loadingPromises.set(src, loadPromise);
  return loadPromise;
}

// Play an audio buffer with Web Audio API
function playBuffer(buffer: AudioBuffer, volume: number = 1.0): AudioBufferSourceNode | null {
  try {
    const ctx = getAudioContext();

    // Create nodes
    const source = ctx.createBufferSource();
    const gainNode = ctx.createGain();

    // Configure
    source.buffer = buffer;
    gainNode.gain.value = volume;

    // Connect: source -> gain -> destination
    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Play immediately
    source.start(0);

    return source;
  } catch (e) {
    console.warn('Failed to play audio buffer:', e);
    return null;
  }
}

// Preload commonly used SFX
function preloadCommonSfx(): void {
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

  // Preload chain sounds
  for (let i = 1; i <= 10; i++) {
    commonSfx.push(SFX.letterChain(i));
  }

  // Load all in parallel
  commonSfx.forEach(src => loadAudioBuffer(src));
}

// Resume audio on first user interaction
if (typeof window !== 'undefined') {
  const resumeHandler = () => {
    resumeAudioContext();
    // Start preloading after context is ready
    preloadCommonSfx();

    document.removeEventListener('touchstart', resumeHandler);
    document.removeEventListener('touchend', resumeHandler);
    document.removeEventListener('click', resumeHandler);
    document.removeEventListener('keydown', resumeHandler);
  };
  document.addEventListener('touchstart', resumeHandler, { passive: true });
  document.addEventListener('touchend', resumeHandler, { passive: true });
  document.addEventListener('click', resumeHandler, { passive: true });
  document.addEventListener('keydown', resumeHandler, { passive: true });

  // Also preload after a delay even without interaction
  setTimeout(() => {
    preloadCommonSfx();
  }, 1000);
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
    return saved === 'true';
  });

  const [sfxVolume, setSfxVolumeState] = useState(() => {
    const saved = localStorage.getItem('boggle-sfx-volume');
    return saved ? parseFloat(saved) : 0.7;
  });

  const [musicVolume, setMusicVolumeState] = useState(() => {
    const saved = localStorage.getItem('boggle-music-volume');
    return saved ? parseFloat(saved) : 0.4;
  });

  // Music uses HTML Audio for looping (Web Audio looping is more complex)
  const currentMusicRef = useRef<HTMLAudioElement | null>(null);
  const currentMusicSrcRef = useRef<string | null>(null);
  const crossfadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Play SFX using Web Audio API - much more reliable than HTML Audio
  const playSfx = useCallback(async (src: string, volume?: number) => {
    if (isMuted) return;

    // Ensure context is resumed
    await resumeAudioContext();

    // Get or load the buffer
    const buffer = await loadAudioBuffer(src);
    if (!buffer) return;

    // Play with Web Audio API
    playBuffer(buffer, volume ?? sfxVolume);
  }, [isMuted, sfxVolume]);

  // Play music using HTML Audio (better for looping)
  const playMusic = useCallback((src: string, loop: boolean = true, crossfade: boolean = false) => {
    // Clear any existing crossfade
    if (crossfadeIntervalRef.current) {
      clearInterval(crossfadeIntervalRef.current);
      crossfadeIntervalRef.current = null;
    }

    // If already playing this track, just update volume
    if (currentMusicSrcRef.current === src && currentMusicRef.current && !currentMusicRef.current.paused) {
      currentMusicRef.current.volume = isMusicMuted ? 0 : musicVolume;
      return;
    }

    const oldAudio = currentMusicRef.current;
    const targetVolume = isMusicMuted ? 0 : musicVolume;

    // Create new audio element for music
    const audio = new Audio(src);
    audio.loop = loop;
    audio.preload = 'auto';

    if (crossfade && oldAudio && !oldAudio.paused) {
      // Start new track at 0 volume, crossfade over 500ms
      audio.volume = 0;
      const startVolume = oldAudio.volume;
      const steps = 10;
      const stepTime = 50; // 500ms total
      let step = 0;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }

      crossfadeIntervalRef.current = setInterval(() => {
        step++;
        const progress = step / steps;

        // Fade out old
        if (oldAudio) {
          oldAudio.volume = Math.max(0, startVolume * (1 - progress));
        }
        // Fade in new
        audio.volume = targetVolume * progress;

        if (step >= steps) {
          if (crossfadeIntervalRef.current) {
            clearInterval(crossfadeIntervalRef.current);
            crossfadeIntervalRef.current = null;
          }
          // Stop old audio completely
          if (oldAudio) {
            oldAudio.pause();
            oldAudio.currentTime = 0;
          }
          audio.volume = targetVolume;
        }
      }, stepTime);
    } else {
      // No crossfade - stop previous immediately
      if (oldAudio) {
        oldAudio.pause();
        oldAudio.currentTime = 0;
      }
      audio.volume = targetVolume;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((e) => {
          console.warn('Music play failed:', e.message);
          // Retry after user interaction
          const retryPlay = () => {
            audio.play().catch(() => {});
            document.removeEventListener('click', retryPlay);
            document.removeEventListener('touchstart', retryPlay);
          };
          document.addEventListener('click', retryPlay, { once: true });
          document.addEventListener('touchstart', retryPlay, { once: true });
        });
      }
    }

    currentMusicRef.current = audio;
    currentMusicSrcRef.current = src;
  }, [isMusicMuted, musicVolume]);

  const preloadMusicTrack = useCallback((src: string) => {
    // Preload music by creating a temporary audio element
    const audio = new Audio(src);
    audio.preload = 'auto';
    audio.load();
  }, []);

  const stopMusic = useCallback(() => {
    if (currentMusicRef.current) {
      currentMusicRef.current.pause();
      currentMusicRef.current.currentTime = 0;
      currentMusicRef.current = null;
      currentMusicSrcRef.current = null;
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
      preloadMusicTrack(MUSIC.gameplayIntense);
      preloadMusicTrack(MUSIC.summary); // Preload summary music for smooth transition
    },
    playGameplayIntenseMusic: () => playMusic(MUSIC.gameplayIntense, true, true), // crossfade
    preloadGameplayIntenseMusic: () => preloadMusicTrack(MUSIC.gameplayIntense),
    playMenuMusic: () => playMusic(MUSIC.menu),
    playSummaryMusic: () => playMusic(MUSIC.summary, true, true), // crossfade from gameplay
    playCountdownRiser: () => playMusic(MUSIC.countdownRiser, false),
    stopMusic,
    pauseMusic,
    resumeMusic,
  };
}
