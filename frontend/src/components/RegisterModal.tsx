import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { X } from 'lucide-react';
import { useAudioContext } from '../contexts/AudioContext';

interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

export const RegisterModal = ({ isOpen, onClose, onSwitchToLogin }: RegisterModalProps) => {
  const { register } = useGameStore();
  const audio = useAudioContext();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!username || !password) {
      setError('Username and password are required');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    audio.playButtonClick();
    setIsLoading(true);
    setError(null);

    const result = await register(username, password, email || undefined);
    setIsLoading(false);

    if (result.success) {
      audio.playPowerupEarned();
      onClose();
      // Reset form
      setUsername('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
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
                Create Account
              </h2>
              <p className="text-sm text-center text-white/70">
                Save your game progress and statistics
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white/70">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-3 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-primary"
                    placeholder="Choose a username"
                    disabled={isLoading}
                    autoComplete="username"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white/70">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-3 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-primary"
                    placeholder="Your email (optional)"
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white/70">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-3 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-primary"
                    placeholder="At least 8 characters"
                    disabled={isLoading}
                    autoComplete="new-password"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white/70">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full p-3 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-primary"
                    placeholder="Re-enter your password"
                    disabled={isLoading}
                    autoComplete="new-password"
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
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>

              <div className="text-center">
                <p className="text-sm text-white/50">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      audio.playButtonClick();
                      onSwitchToLogin();
                    }}
                    className="text-primary font-medium hover:underline"
                  >
                    Login here
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