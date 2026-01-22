import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { X } from 'lucide-react';
import { useAudioContext } from '../contexts/AudioContext';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToRegister: () => void;
}

export const LoginModal = ({ isOpen, onClose, onSwitchToRegister }: LoginModalProps) => {
  const { login } = useGameStore();
  const audio = useAudioContext();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    audio.playButtonClick();
    setIsLoading(true);
    setError(null);

    const result = await login(username, password);
    setIsLoading(false);

    if (result.success) {
      audio.playPowerupEarned();
      onClose();
      // Reset form
      setUsername('');
      setPassword('');
    } else {
      setError(result.message);
    }
  };

  const handleClose = () => {
    audio.playButtonClick();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClose}
              className="absolute -top-4 -right-4 z-10 frosted-glass w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-transform border border-white/20"
            >
              <X size={24} />
            </button>

            <div className="frosted-glass rounded-2xl p-6 space-y-4">
              <h2 className="text-xl font-bold text-center text-primary uppercase tracking-wide">
                Login to Your Account
              </h2>
              <p className="text-sm text-center text-white/70">
                Access your game statistics and achievements
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white/70">
                    Username
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-3 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-primary"
                    placeholder="Enter your username"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white/70">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-primary"
                    placeholder="Enter your password"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-center text-sm text-red-200"
                  >
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-primary rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Logging in...' : 'Login'}
                </button>
              </form>

              <div className="text-center">
                <p className="text-sm text-white/50">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      audio.playButtonClick();
                      onSwitchToRegister();
                    }}
                    className="text-primary font-medium hover:underline"
                  >
                    Register here
                  </button>
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};