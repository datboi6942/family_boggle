import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Medal, Award, ChevronDown, ChevronUp, Gamepad2 } from 'lucide-react';

interface LeaderboardEntry {
  username: string;
  best_score: number;
  best_words_count: number;
  total_games_played: number;
  total_wins: number;
  challenges_completed: number;
}

interface PlayerStats {
  username: string;
  best_score: number;
  best_words_count: number;
  total_games_played: number;
  total_wins: number;
  challenges_completed: number;
  win_rate: number;
}

// Use the same host as the frontend (routes through nginx which preserves client IP)
const API_BASE = `${window.location.protocol}//${window.location.host}`;

export const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [isNewPlayer, setIsNewPlayer] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [leaderboardRes, statsRes] = await Promise.all([
          fetch(`${API_BASE}/api/leaderboard?limit=5`),
          fetch(`${API_BASE}/api/player-stats`)
        ]);

        if (leaderboardRes.ok) {
          const data = await leaderboardRes.json();
          setLeaderboard(data.leaderboard || []);
        }

        if (statsRes.ok) {
          const data = await statsRes.json();
          setPlayerStats(data.stats);
          setIsNewPlayer(data.is_new_player);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      case 1:
        return <Medal className="w-5 h-5 text-gray-300" />;
      case 2:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 h-5 text-center text-white/40 font-bold">{index + 1}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-sm frosted-glass p-4 animate-pulse">
        <div className="h-8 bg-white/10 rounded mb-4"></div>
        <div className="space-y-2">
          <div className="h-10 bg-white/5 rounded"></div>
          <div className="h-10 bg-white/5 rounded"></div>
          <div className="h-10 bg-white/5 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="w-full max-w-sm frosted-glass overflow-hidden"
    >
      {/* Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm uppercase tracking-wider">High Scores</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-white/50" />
        ) : (
          <ChevronDown className="w-5 h-5 text-white/50" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden max-h-[60vh] overflow-y-auto"
          >
            {/* Your Stats Section */}
            {!isNewPlayer && playerStats && (
              <div className="px-4 pb-3 border-b border-white/10">
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Your Stats</p>
                <div className="bg-primary/10 border border-primary/30 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-primary">{playerStats.username}</span>
                    <span className="text-xl font-black text-primary">{playerStats.best_score}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div>
                      <p className="text-white/40">Games</p>
                      <p className="font-bold text-white">{playerStats.total_games_played}</p>
                    </div>
                    <div>
                      <p className="text-white/40">Wins</p>
                      <p className="font-bold text-green-400">{playerStats.total_wins}</p>
                    </div>
                    <div>
                      <p className="text-white/40">Win Rate</p>
                      <p className="font-bold text-white">{playerStats.win_rate}%</p>
                    </div>
                  </div>
                  {playerStats.challenges_completed > 0 && (
                    <p className="text-[10px] text-center mt-2 text-yellow-400">
                      {playerStats.challenges_completed} challenges completed
                    </p>
                  )}
                </div>
              </div>
            )}

            {isNewPlayer && (
              <div className="px-4 pb-3 border-b border-white/10">
                <div className="bg-white/5 rounded-lg p-3 text-center">
                  <Gamepad2 className="w-6 h-6 text-primary mx-auto mb-1" />
                  <p className="text-xs text-white/60">Welcome, new player!</p>
                  <p className="text-[10px] text-white/40">Play a game to start tracking your stats</p>
                </div>
              </div>
            )}

            {/* Leaderboard Section */}
            <div className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Top Players by Best Score</p>
              {leaderboard.length === 0 ? (
                <div className="text-center py-4 text-white/40 text-sm">
                  No scores yet. Be the first!
                </div>
              ) : (
                <div className="space-y-2">
                  {leaderboard.map((entry, index) => {
                    const winRate = entry.total_games_played > 0
                      ? Math.round((entry.total_wins / entry.total_games_played) * 100)
                      : 0;

                    return (
                      <motion.div
                        key={`${entry.username}-${index}`}
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          index === 0 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {getRankIcon(index)}
                          <div>
                            <p className="font-bold text-sm">{entry.username}</p>
                            <p className="text-[10px] text-white/40">
                              {entry.total_wins}/{entry.total_games_played} wins ({winRate}%)
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-primary text-lg">{entry.best_score}</p>
                          <p className="text-[10px] text-white/40">best score</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
