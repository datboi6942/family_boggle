import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { useAudioContext } from '../contexts/AudioContext';
import { User, LogOut, BarChart3, Award, Link } from 'lucide-react';

export const UserProfile = () => {
  const { user, authToken, logout, getStats, linkIpAccount } = useGameStore();
  const audio = useAudioContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const [stats, setStats] = useState(user?.stats || null);
  const [isLoading, setIsLoading] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    const result = await getStats();
    setIsLoading(false);
    if (result.success && result.stats) {
      setStats(result.stats);
    }
  }, [getStats]);

  // Load stats when user is logged in and profile expanded
  useEffect(() => {
    if (isExpanded && authToken && user && !stats) {
      loadStats();
    }
  }, [isExpanded, authToken, user, stats, loadStats]);

  const handleLogout = () => {
    audio.playButtonClick();
    logout();
    setIsExpanded(false);
  };

  const handleLinkAccount = async () => {
    audio.playButtonClick();
    setIsLoading(true);
    setLinkMessage(null);
    const result = await linkIpAccount();
    setIsLoading(false);
    if (result.success) {
      setLinkMessage('Account linked successfully! Your game history has been merged.');
      // Refresh stats
      loadStats();
    } else {
      setLinkMessage(result.message);
    }
  };

  if (!authToken || !user) {
    return null;
  }

  return (
    <div className="relative">
      {/* Profile badge */}
      <button
        onClick={() => {
          audio.playButtonClick();
          setIsExpanded(!isExpanded);
        }}
        className="flex items-center gap-3 frosted-glass px-4 py-3 rounded-xl border border-white/20 hover:border-primary/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <User size={20} className="text-primary" />
        </div>
        <div className="text-left">
          <div className="font-bold text-white">{user.username}</div>
          <div className="text-xs text-white/50">
            {stats ? `${stats.total_games_played} games played` : 'Loading stats...'}
          </div>
        </div>
      </button>

      {/* Expanded profile panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full right-0 mt-2 w-80 z-50 frosted-glass rounded-2xl border border-white/20 p-4 space-y-4"
          >
            {/* User info */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                    <User size={24} className="text-primary" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-lg">{user.username}</div>
                    {user.email && (
                      <div className="text-sm text-white/70">{user.email}</div>
                    )}
                    <div className="text-xs text-white/50">
                      Joined {new Date(user.created_at || '').toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} className="text-white/70" />
                </button>
              </div>

              {/* Link IP account button */}
              <button
                onClick={handleLinkAccount}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
              >
                <Link size={16} />
                <span className="text-sm">Link anonymous game history</span>
              </button>
              {linkMessage && (
                <div className={`text-xs p-2 rounded-lg ${linkMessage.includes('success') ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                  {linkMessage}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-white/70">
                <BarChart3 size={16} />
                <span className="font-medium">Game Statistics</span>
              </div>

              {isLoading ? (
                <div className="text-center py-4 text-white/50">Loading statistics...</div>
              ) : stats ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{stats.total_games_played}</div>
                    <div className="text-xs text-white/70">Games Played</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{stats.total_wins}</div>
                    <div className="text-xs text-white/70">Wins</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{stats.win_rate}%</div>
                    <div className="text-xs text-white/70">Win Rate</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{stats.best_score}</div>
                    <div className="text-xs text-white/70">Best Score</div>
                  </div>
                  <div className="col-span-2 bg-white/5 rounded-xl p-3 text-center">
                    <div className="text-2xl font-bold text-primary">{stats.total_challenges_completed}</div>
                    <div className="text-xs text-white/70">Challenges Completed</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-white/50">No statistics available</div>
              )}
            </div>

            {/* Achievements placeholder */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white/70">
                <Award size={16} />
                <span className="font-medium">Recent Achievements</span>
              </div>
              <div className="text-center py-4 text-white/50 text-sm">
                Achievements will appear here as you earn them
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};