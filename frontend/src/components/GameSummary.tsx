import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useAudioContext } from '../contexts/AudioContext';
import { MonsterAvatar } from './MonsterAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { WordAwardAnimation } from './summary/WordAwardAnimation';
import { Trophy, Sparkles, ChevronDown, ChevronUp, Check, X } from 'lucide-react';

// Mobile detection - confetti and spring animations cause lag on mobile devices
const IS_IOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

const IS_ANDROID = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

// Use reduced animations on all mobile devices for consistent smooth performance
const IS_MOBILE = IS_IOS || IS_ANDROID;

export const GameSummary = () => {
  const { results, winner, wordAwards, longestWordFound, longestPossibleWord, allPossibleWords, totalPossibleWords, players, playerId, playersWantingPlayAgain, resetSession } = useGameStore(
    useShallow(state => ({
      results: state.results,
      winner: state.winner,
      wordAwards: state.wordAwards,
      longestWordFound: state.longestWordFound,
      longestPossibleWord: state.longestPossibleWord,
      allPossibleWords: state.allPossibleWords,
      totalPossibleWords: state.totalPossibleWords,
      players: state.players,
      playerId: state.playerId,
      playersWantingPlayAgain: state.playersWantingPlayAgain,
      resetSession: state.resetSession,
    }))
  );
  const { send } = useWebSocketContext();
  const audio = useAudioContext();
  const [phase, setPhase] = useState<'animating' | 'longest-word' | 'celebrating'>('animating');
  const [showAllWords, setShowAllWords] = useState(false);
  const musicStartedRef = useRef(false);

  // Restore scroll state when entering summary (game locks scroll)
  useEffect(() => {
    // Restore body scroll - clear any scroll locks from game
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.top = '';
    document.body.style.left = '';
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Stable audio function refs that always use the latest audio context
  // Now uses crossfade, so no need for stopMusic or delay
  const playSummaryMusic = useCallback(() => {
    audio.playSummaryMusic(); // Will crossfade from gameplay music
  }, [audio]);

  const playVictoryFanfare = useCallback(() => audio.playVictoryFanfare(), [audio]);
  const playConfettiBurst = useCallback(() => audio.playConfettiBurst(), [audio]);
  const playLongestWordAward = useCallback(() => audio.playLongestWordAward(), [audio]);

  // Calculate which words were found by players
  const foundWordsSet = useMemo(() => {
    const set = new Set<string>();
    results?.forEach(r => r.words.forEach(w => set.add(w.toUpperCase())));
    return set;
  }, [results]);

  const totalFoundWords = foundWordsSet.size;

  // Start summary music when summary phase begins
  useEffect(() => {
    if (!musicStartedRef.current) {
      musicStartedRef.current = true;
      // Play summary music immediately
      playSummaryMusic();

      // Backup: try again after a short delay in case first attempt failed
      const backupTimeout = setTimeout(() => {
        playSummaryMusic();
      }, 500);

      return () => clearTimeout(backupTimeout);
    }
  }, [playSummaryMusic]);

  useEffect(() => {
    // If there are no word awards to animate, skip to longest-word or celebration
    if (wordAwards && wordAwards.length === 0 && phase === 'animating') {
      if (longestWordFound) {
        setPhase('longest-word');
      } else {
        setPhase('celebrating');
      }
    }
  }, [wordAwards, longestWordFound, phase]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (phase === 'celebrating') {
      // Play victory sounds
      playVictoryFanfare();
      if (!IS_MOBILE) {
        playConfettiBurst(); // Skip on mobile - multiple sounds cause lag
      }

      // Mobile: simplified confetti - fewer particles, no repeated bursts
      if (IS_MOBILE) {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#8b5cf6', '#22c55e', '#f97316', '#eab308'],
          disableForReducedMotion: true,
        });
      } else {
        confetti({
          particleCount: 100,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#8b5cf6', '#22c55e', '#f97316', '#eab308']
        });

        // Secondary bursts - Desktop only
        const duration = 2 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

        interval = setInterval(function() {
          const timeLeft = animationEnd - Date.now();
          if (timeLeft <= 0) {
            clearInterval(interval);
            return;
          }
          const particleCount = 30 * (timeLeft / duration);
          confetti({ ...defaults, particleCount, origin: { x: Math.random(), y: Math.random() - 0.2 } });
        }, 300);
      }
    } else if (phase === 'longest-word') {
      // Play longest word award sound
      playLongestWordAward();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [phase, playVictoryFanfare, playConfettiBurst, playLongestWordAward]);

  const handleAnimationsComplete = () => {
    // After word awards, show longest word animation if available
    if (longestWordFound) {
      setPhase('longest-word');
    } else {
      setPhase('celebrating');
    }
  };

  const handleLongestWordComplete = () => {
    setPhase('celebrating');
  };

  return (
    <div className="flex flex-col h-full bg-navy-gradient min-h-screen overflow-hidden">
      <AnimatePresence mode="wait">
        {phase === 'animating' && wordAwards && wordAwards.length > 0 ? (
          <motion.div
            key="animating-phase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1"
          >
            <WordAwardAnimation onAllCompleted={handleAnimationsComplete} />
          </motion.div>
        ) : phase === 'longest-word' && longestWordFound ? (
          <motion.div
            key="longest-word-phase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex-1 flex flex-col items-center justify-center p-6"
          >
            {/* Longest Word Award Animation */}
            {/* Mobile: use tween instead of spring for smoother animations */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'tween', duration: 0.4, ease: 'backOut', delay: 0.2 }}
              className="mb-6"
            >
              <div className="relative">
                <Trophy className="w-24 h-24 text-yellow-500" />
                {/* Mobile: use CSS animation class instead of Framer Motion infinite loop */}
                <div className="absolute inset-0 flex items-center justify-center ios-pulse">
                  <Sparkles className="w-32 h-32 text-yellow-400/30" />
                </div>
              </div>
            </motion.div>

            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-yellow-500 text-sm font-black uppercase tracking-widest mb-2"
            >
              Longest Word Award
            </motion.h2>

            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'tween', duration: 0.3, ease: 'backOut', delay: 0.6 }}
              className="frosted-glass px-8 py-6 border-2 border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.4)] mb-6"
            >
              <h3 className="text-4xl font-black uppercase tracking-tighter italic text-white text-center">
                {longestWordFound.word}
              </h3>
              <p className="text-yellow-500 font-bold text-center mt-1">{longestWordFound.length} letters</p>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col items-center"
            >
              <MonsterAvatar name={longestWordFound.character} size={80} animated={true} />
              <p className="text-white font-bold mt-2">{longestWordFound.username}</p>
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              onClick={handleLongestWordComplete}
              className="mt-8 px-8 py-3 bg-yellow-500 text-black font-black rounded-xl active:scale-95 transition-transform"
            >
              CONTINUE
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="celebration-phase"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col p-6 overflow-y-auto"
          >
            <div className="text-center mb-10">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={IS_MOBILE ? { type: 'tween', duration: 0.3, ease: 'backOut' } : { type: 'spring', damping: 12 }}
                className="inline-block"
              >
                <MonsterAvatar name={winner?.character || 'Blobby'} size={150} isWinner={true} />
              </motion.div>
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-5xl font-black mt-4 italic text-white"
              >
                {winner?.username?.toUpperCase() || 'PLAYER'} WINS!
              </motion.h1>
              <p className="text-primary font-black text-2xl mt-2">{winner?.score ?? 0} PTS</p>
            </div>

            {/* Board Words Summary Section */}
            {(totalPossibleWords > 0 || totalFoundWords > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="max-w-2xl mx-auto w-full mb-6"
              >
                <div className="frosted-glass p-4 border border-white/10">
                  {/* Stats Row */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Board Statistics</p>
                        <p className="text-lg font-black text-white">
                          <span className="text-green-400">{totalFoundWords}</span>
                          <span className="text-white/40"> / </span>
                          <span className="text-white/70">{totalPossibleWords}</span>
                          <span className="text-white/40 text-sm ml-2">words found</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-primary">
                        {totalPossibleWords > 0 ? Math.round((totalFoundWords / totalPossibleWords) * 100) : 0}%
                      </p>
                      <p className="text-[10px] text-white/40 uppercase">discovered</p>
                    </div>
                  </div>

                  {/* Longest Possible Word */}
                  {longestPossibleWord && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-yellow-500/70 uppercase font-bold tracking-wider">Longest Possible</p>
                          <p className="text-lg font-black text-yellow-500 uppercase tracking-tight">{longestPossibleWord}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-500/50 font-bold">{longestPossibleWord.length} letters</span>
                          {foundWordsSet.has(longestPossibleWord.toUpperCase()) ? (
                            <Check className="w-5 h-5 text-green-400" />
                          ) : (
                            <X className="w-5 h-5 text-red-400/50" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expand/Collapse Button - only show if we have all words data */}
                  {allPossibleWords && allPossibleWords.length > 0 && (
                    <button
                      onClick={() => setShowAllWords(!showAllWords)}
                      className="w-full flex items-center justify-center gap-2 py-2 text-white/50 hover:text-white/80 transition-colors"
                    >
                      <span className="text-xs font-bold uppercase">
                        {showAllWords ? 'Hide' : 'Show'} All {totalPossibleWords} Words
                      </span>
                      {showAllWords ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}

                  {/* All Words Grid */}
                  <AnimatePresence>
                    {showAllWords && allPossibleWords && allPossibleWords.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-white/10 pt-3 mt-2">
                          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1 max-h-[300px] overflow-y-auto">
                            {allPossibleWords?.map((word, i) => {
                              const wasFound = foundWordsSet.has(word.toUpperCase());
                              return (
                                <div
                                  key={`${word}-${i}`}
                                  className={`px-2 py-1 rounded text-xs font-bold text-center truncate ${
                                    wasFound
                                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                      : 'bg-white/5 text-white/30 border border-white/10'
                                  }`}
                                  title={word}
                                >
                                  {word}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-white/40">
                            <span className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/30" />
                              Found
                            </span>
                            <span className="flex items-center gap-1">
                              <div className="w-3 h-3 rounded bg-white/5 border border-white/10" />
                              Missed
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}

            <div className="space-y-4 max-w-2xl mx-auto w-full">
              <h2 className="text-white/50 font-bold uppercase tracking-widest text-center mb-4">Final Leaderboard</h2>
              {results?.filter(res => res && res.username).map((res, i) => {
                const hasLongestWord = longestWordFound?.player_id === res.player_id;
                const isWinner = winner?.player_id === res.player_id;
                return (
                  <motion.div
                    key={res.player_id || res.username || i}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className={`frosted-glass p-4 flex items-center justify-between ${
                      isWinner ? 'border-primary border-2 scale-105 shadow-xl' : ''
                    } ${hasLongestWord ? 'ring-2 ring-yellow-500/50' : ''}`}
                  >
                    <div className="flex items-center space-x-4">
                      <span className="text-xl font-black text-white/30">{i + 1}</span>
                      <MonsterAvatar name={res.character || 'Blobby'} size={50} isWinner={isWinner} animated={false} />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-lg">{res.username || 'Player'}</p>
                          {hasLongestWord && (
                            <Trophy className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        <p className="text-xs text-white/40">{res.words?.length ?? 0} words found</p>
                        {(res.challenges_completed ?? 0) > 0 && (
                          <p className="text-xs text-green-400">{res.challenges_completed} challenge{res.challenges_completed !== 1 ? 's' : ''} completed</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <p className="text-2xl font-black text-primary">{res.total_score ?? res.score ?? 0}</p>
                      {(res.word_score !== undefined || res.challenge_score !== undefined) && (
                        <div className="text-[10px] text-white/40 text-right space-y-0.5 mt-1">
                          <div>Words: {res.word_score ?? 0}</div>
                          {(res.challenge_score ?? 0) > 0 && (
                            <div className="text-green-400">Challenges: +{res.challenge_score}</div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Challenges Section - All challenges for all players */}
            {results && results.filter(r => r && r.all_challenges && r.all_challenges.length > 0).length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1 }}
                className="max-w-2xl mx-auto w-full mt-8"
              >
                <h2 className="text-white/50 font-bold uppercase tracking-widest text-center mb-4">Challenge Results</h2>
                <div className="space-y-3">
                  {results.filter(res => res && res.username && res.all_challenges && res.all_challenges.length > 0).map((res, playerIndex) => {
                    const completedChallenges = res.all_challenges.filter(c => c.completed);
                    const totalChallengePoints = completedChallenges.reduce((sum, c) => sum + (c.points_earned ?? c.points ?? 0), 0);

                    return (
                      <div key={res.player_id || playerIndex} className="frosted-glass p-4">
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <MonsterAvatar name={res.character || 'Blobby'} size={32} animated={false} />
                            <span className="font-bold text-white">{res.username || 'Player'}</span>
                          </div>
                          <div className="text-right">
                            {(res.challenges_completed ?? 0) > 0 && (
                              <>
                                <div className="text-sm font-bold text-green-400">
                                  +{totalChallengePoints} pts
                                </div>
                                <div className="text-xs text-white/40">
                                  {res.challenges_completed}/{res.all_challenges.length} completed
                                </div>
                              </>
                            )}
                            {(res.challenges_completed ?? 0) === 0 && (
                              <span className="text-xs text-white/40">
                                0/{res.all_challenges.length} completed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Show all completed challenges */}
                        {completedChallenges.length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-bold text-green-400 mb-2 uppercase tracking-wide">Completed</div>
                            <div className="grid gap-2 max-h-64 overflow-y-auto">
                              {completedChallenges.map((challenge, i) => {
                                const difficultyColors = {
                                  very_easy: 'text-gray-400',
                                  easy: 'text-blue-400',
                                  medium: 'text-yellow-400',
                                  hard: 'text-orange-400',
                                  very_hard: 'text-red-400'
                                };
                                const difficultyLabels = {
                                  very_easy: 'Very Easy',
                                  easy: 'Easy',
                                  medium: 'Medium',
                                  hard: 'Hard',
                                  very_hard: 'Very Hard'
                                };

                                return (
                                  <motion.div
                                    key={challenge.id || i}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 1.2 + playerIndex * 0.1 + Math.min(i, 10) * 0.05 }}
                                    className="flex items-center justify-between p-2 rounded-lg bg-green-500/10 border border-green-500/30"
                                  >
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <Check className="w-3 h-3 text-green-400" />
                                        <p className="text-sm font-bold text-green-400">
                                          {challenge.name || 'Challenge'}
                                        </p>
                                      </div>
                                      <p className="text-[10px] text-white/40 ml-5">{challenge.description || ''}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                      <span className={`text-[9px] ${difficultyColors[challenge.difficulty as keyof typeof difficultyColors] || 'text-white/50'}`}>
                                        {difficultyLabels[challenge.difficulty as keyof typeof difficultyLabels] || challenge.difficulty}
                                      </span>
                                      <span className="text-xs font-bold text-green-400">
                                        +{challenge.points_earned ?? challenge.points ?? 0}
                                      </span>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Show in-progress challenges (limited to top 5) */}
                        {res.all_challenges.filter(c => !c.completed && c.progress > 0).slice(0, 5).length > 0 && (
                          <div>
                            <div className="text-xs font-bold text-white/50 mb-2 uppercase tracking-wide">In Progress</div>
                            <div className="grid gap-2">
                              {res.all_challenges
                                .filter(c => !c.completed && c.progress > 0)
                                .slice(0, 5)
                                .map((challenge, i) => (
                                  <div
                                    key={challenge.id || i}
                                    className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10"
                                  >
                                    <div className="flex-1">
                                      <p className="text-sm font-bold text-white/70">
                                        {challenge.name || 'Challenge'}
                                      </p>
                                      <p className="text-[10px] text-white/40">{challenge.description || ''}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-2">
                                      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-primary"
                                          style={{ width: `${Math.min(100, (challenge.ratio ?? 0) * 100)}%` }}
                                        />
                                      </div>
                                      <span className="text-xs font-bold text-white/50 min-w-[3rem] text-right">
                                        {challenge.progress ?? 0}/{challenge.target ?? 0}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Play Again Section */}
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="max-w-md mx-auto w-full mt-12"
            >
              {/* Show waiting players */}
              {playersWantingPlayAgain.length > 0 && (
                <div className="mb-4 p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-xs text-white/50 uppercase font-bold tracking-wider mb-3 text-center">
                    Waiting to play again ({playersWantingPlayAgain.length}/{players.length})
                  </p>
                  <div className="flex justify-center gap-2 flex-wrap">
                    {players.map(player => {
                      const isReady = playersWantingPlayAgain.includes(player.id);
                      return (
                        <div
                          key={player.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${
                            isReady
                              ? 'bg-green-500/20 border border-green-500/50'
                              : 'bg-white/5 border border-white/10 opacity-50'
                          }`}
                        >
                          <MonsterAvatar name={player.character} size={24} animated={false} />
                          <span className={`text-sm font-bold ${isReady ? 'text-green-400' : 'text-white/50'}`}>
                            {player.username}
                          </span>
                          {isReady && <Check className="w-4 h-4 text-green-400" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Play Again Button */}
              {playerId && playersWantingPlayAgain.includes(playerId) ? (
                <div className="w-full py-5 bg-green-500/20 border-2 border-green-500/50 rounded-2xl font-black text-xl text-center text-green-400 mb-2">
                  <div className="flex items-center justify-center gap-3">
                    <Check className="w-6 h-6" />
                    <span>WAITING FOR OTHERS...</span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => send('want_play_again', {})}
                  className="w-full py-5 bg-primary rounded-2xl font-black text-xl mb-2 shadow-2xl active:scale-95 transition-transform"
                >
                  PLAY AGAIN
                </button>
              )}
            </motion.div>

            <motion.button
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.7 }}
              onClick={() => resetSession()}
              className="w-full max-w-md mx-auto py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-white/50 active:scale-95 transition-all mb-8"
            >
              LEAVE GAME
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


