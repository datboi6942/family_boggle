import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useAudioContext } from '../contexts/AudioContext';
import { motion, AnimatePresence } from 'framer-motion';

export const Chat = () => {
  const { chatMessages, playerId } = useGameStore(
    useShallow(state => ({
      chatMessages: state.chatMessages,
      playerId: state.playerId,
    }))
  );
  const { send } = useWebSocketContext();
  const audio = useAudioContext();
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    audio.playButtonClick();
    send('chat_message', { text: message.trim() });
    setMessage('');
    
    // Keep focus on input after sending
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto mb-3 space-y-2 p-2 rounded-xl bg-black/10 max-h-64">
        <AnimatePresence initial={false}>
          {chatMessages.map((msg, idx) => {
            const isOwnMessage = msg.player_id === playerId;
            return (
              <motion.div
                key={`${msg.timestamp}-${idx}`}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center space-x-2 mb-0.5">
                  {!isOwnMessage && (
                    <span className="text-xs font-bold text-white/70 truncate max-w-[80px]">
                      {msg.username}
                    </span>
                  )}
                  <span className="text-[10px] text-white/40">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div
                  className={`rounded-2xl px-3 py-2 max-w-[80%] break-words ${isOwnMessage
                    ? 'bg-primary/20 border border-primary/30 text-white'
                    : 'bg-white/10 border border-white/10 text-white'
                    }`}
                >
{msg.text}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
      <form onSubmit={handleSubmit} className="flex space-x-2">
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 frosted-glass border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-primary/50"
          maxLength={200}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!message.trim()}
          className="frosted-glass bg-primary/30 border border-primary/50 rounded-xl px-4 py-3 text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 transition-transform"
        >
          Send
        </button>
      </form>
    </div>
  );
};