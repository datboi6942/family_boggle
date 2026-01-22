import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { useAudioContext } from '../contexts/AudioContext';
import { Users } from 'lucide-react';
import { FriendListPanel } from './FriendListPanel';

export const FriendList = () => {
  const { friends, authToken, user } = useGameStore(
    useShallow(state => ({
      friends: state.friends,
      authToken: state.authToken,
      user: state.user,
    }))
  );
  const audio = useAudioContext();
  
  const [isExpanded, setIsExpanded] = useState(false);

  if (!authToken || !user) {
    return null;
  }

  return (
    <div className="relative">
      {/* Friend list button */}
      <button
        onClick={() => {
          audio.playButtonClick();
          setIsExpanded(!isExpanded);
        }}
        className="flex items-center gap-3 frosted-glass px-4 py-3 rounded-xl border border-white/20 hover:border-primary/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <Users size={20} className="text-primary" />
        </div>
        <div className="text-left">
          <div className="font-bold text-white">Friends</div>
          <div className="text-xs text-white/50">
            {friends.length} friend{friends.length !== 1 ? 's' : ''}
          </div>
        </div>
      </button>

      {/* Expanded friend list panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full right-0 mt-2 w-96 z-50"
          >
            <FriendListPanel onClose={() => setIsExpanded(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

