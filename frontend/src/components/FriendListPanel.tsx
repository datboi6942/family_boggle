import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { useAudioContext } from '../contexts/AudioContext';
import { Users, UserPlus, UserMinus, X } from 'lucide-react';

export const FriendListPanel = ({ onClose }: { onClose?: () => void }) => {
  const { friends, friendRequests, loadFriends, loadFriendRequests, sendFriendRequest, removeFriend, authToken, user } = useGameStore(
    useShallow(state => ({
      friends: state.friends,
      friendRequests: state.friendRequests,
      loadFriends: state.loadFriends,
      loadFriendRequests: state.loadFriendRequests,
      sendFriendRequest: state.sendFriendRequest,
      removeFriend: state.removeFriend,
      authToken: state.authToken,
      user: state.user,
    }))
  );
  const audio = useAudioContext();
  
  const [isLoading, setIsLoading] = useState(false);
  const [newFriendUsername, setNewFriendUsername] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (authToken) {
      refreshFriends();
    }
  }, [authToken]);

  const refreshFriends = async () => {
    setIsLoading(true);
    await Promise.all([
      loadFriends(),
      loadFriendRequests('pending')
    ]);
    setIsLoading(false);
  };

  const handleSendRequest = async () => {
    if (!newFriendUsername.trim()) return;
    
    audio.playButtonClick();
    setIsLoading(true);
    setMessage(null);
    
    const result = await sendFriendRequest(newFriendUsername.trim());
    
    setIsLoading(false);
    setMessageType(result.success ? 'success' : 'error');
    setMessage(result.message);
    
    if (result.success) {
      setNewFriendUsername('');
      await refreshFriends();
    }
  };

  const handleRemoveFriend = async (friendId: number, friendUsername: string) => {
    audio.playButtonClick();
    if (!confirm(`Remove ${friendUsername} from your friends list?`)) return;
    
    setIsLoading(true);
    const result = await removeFriend(friendId);
    setIsLoading(false);
    
    if (result.success) {
      setMessageType('success');
      setMessage(result.message);
    } else {
      setMessageType('error');
      setMessage(result.message);
    }
  };

  const pendingRequests = friendRequests.filter(req => req.status === 'pending');
  const incomingRequests = pendingRequests.filter(req => req.receiver_id === user?.id);
  const outgoingRequests = pendingRequests.filter(req => req.sender_id === user?.id);

  if (!authToken || !user) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="frosted-glass rounded-2xl border border-white/20 p-4 space-y-4 max-h-[80vh] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Users size={20} />
          <span className="font-bold text-lg">Friends</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            title="Close"
          >
            <X size={18} className="text-white/70" />
          </button>
        )}
      </div>

      {/* Add friend section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-white/70">
          <UserPlus size={16} />
          <span className="font-medium">Add Friend</span>
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            value={newFriendUsername}
            onChange={(e) => setNewFriendUsername(e.target.value)}
            placeholder="Enter username"
            className="flex-1 frosted-glass border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-primary/50"
            onKeyDown={(e) => e.key === 'Enter' && handleSendRequest()}
          />
          <button
            onClick={handleSendRequest}
            disabled={!newFriendUsername.trim() || isLoading}
            className="frosted-glass bg-primary/30 border border-primary/50 rounded-xl px-4 py-3 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-transform"
          >
            Add
          </button>
        </div>
      </div>

      {/* Message display */}
      {message && (
        <div className={`p-3 rounded-lg ${messageType === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
          <div className="text-sm">{message}</div>
        </div>
      )}

      {/* Friend requests section */}
      {(incomingRequests.length > 0 || outgoingRequests.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-white/70">
            <span className="font-medium">Friend Requests</span>
            <span className="text-xs bg-primary/30 px-2 py-1 rounded-full">
              {incomingRequests.length + outgoingRequests.length}
            </span>
          </div>
          
          {incomingRequests.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-white/50 uppercase tracking-wider">Incoming</div>
              {incomingRequests.map(req => (
                <FriendRequestItem 
                  key={req.id} 
                  request={req} 
                  type="incoming" 
                  onAction={refreshFriends}
                />
              ))}
            </div>
          )}
          
          {outgoingRequests.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-white/50 uppercase tracking-wider">Sent</div>
              {outgoingRequests.map(req => (
                <FriendRequestItem 
                  key={req.id} 
                  request={req} 
                  type="outgoing" 
                  onAction={refreshFriends}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Friends list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-white/70">
          <span className="font-medium">Your Friends</span>
          <span className="text-xs bg-white/10 px-2 py-1 rounded-full">
            {friends.length}
          </span>
        </div>
        
        {isLoading ? (
          <div className="text-center py-8 text-white/50">Loading friends...</div>
        ) : friends.length === 0 ? (
          <div className="text-center py-8 text-white/50">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <div>No friends yet</div>
            <div className="text-xs mt-1">Add friends to play together!</div>
          </div>
        ) : (
          <div className="space-y-2">
            {friends.map(friend => (
              <motion.div
                key={friend.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users size={18} className="text-primary/70" />
                  </div>
                  <div>
                    <div className="font-bold text-white">{friend.username}</div>
                    <div className="text-xs text-white/50">
                      Friends since {new Date(friend.friends_since).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveFriend(friend.id, friend.username)}
                  className="p-2 bg-white/5 hover:bg-red-500/20 hover:text-red-300 rounded-lg transition-colors"
                  title="Remove friend"
                >
                  <UserMinus size={16} className="text-white/70" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

interface FriendRequestItemProps {
  request: any;
  type: 'incoming' | 'outgoing';
  onAction: () => void;
}

const FriendRequestItem = ({ request, type, onAction }: FriendRequestItemProps) => {
  const { respondToFriendRequest } = useGameStore();
  const audio = useAudioContext();
  const [isResponding, setIsResponding] = useState(false);

  const handleRespond = async (action: 'accept' | 'reject') => {
    audio.playButtonClick();
    setIsResponding(true);
    await respondToFriendRequest(request.id, action);
    setIsResponding(false);
    onAction();
  };

  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
      <div>
        <div className="font-bold text-white">
          {type === 'incoming' ? request.sender_username : request.receiver_username}
        </div>
        <div className="text-xs text-white/50">
          {type === 'incoming' ? 'Sent you a friend request' : 'Request sent'}
        </div>
      </div>
      {type === 'incoming' ? (
        <div className="flex space-x-2">
          <button
            onClick={() => handleRespond('accept')}
            disabled={isResponding}
            className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => handleRespond('reject')}
            disabled={isResponding}
            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Reject
          </button>
        </div>
      ) : (
        <div className="text-xs text-white/50 px-3 py-1 bg-white/10 rounded-full">
          Pending
        </div>
      )}
    </div>
  );
};