import { Snowflake, Bomb, RotateCw, Lock } from 'lucide-react';
import { useAudioContext } from '../contexts/AudioContext';
import { useWebSocketContext } from '../contexts/WebSocketContext';

interface PowerUpBarProps {
  playerId: string | null;
  players: Array<{
    id: string;
    username: string;
    character: string;
    is_ready: boolean;
    score: number;
    powerups: string[];
  }>;
  isLockArmed: boolean;
}

export const PowerUpBar = ({ playerId, players, isLockArmed }: PowerUpBarProps) => {
  const { send } = useWebSocketContext();
  const audio = useAudioContext();

  const me = players.find(p => p.id === playerId);
  const powerups = ['freeze', 'blowup', 'shuffle', 'lock'];

  return (
    <div className="flex justify-center items-center space-x-4 py-3" style={{ minHeight: '80px' }}>
      {powerups.map(p => {
        const count = me?.powerups?.filter(x => x === p).length || 0;
        // Lock shows as "armed" if player has activated it
        const isLockActive = p === 'lock' && isLockArmed;
        return (
          <button
            key={p}
            disabled={count === 0 && !isLockActive}
            onClick={() => {
              send('use_powerup', { powerup: p });
              if (p === 'shuffle') {
                audio.playPowerupShuffle();
              } else if (p === 'lock') {
                audio.playPowerupLock();
              }
            }}
            className={`
              relative p-3 rounded-xl frosted-glass transition-all
              ${isLockActive
                ? 'bg-green-500/30 border-2 border-green-400 shadow-[0_0_12px_rgba(34,197,94,0.4)]'
                : count > 0
                  ? 'bg-primary/20 border-primary ios-pulse'
                  : 'opacity-50'}
            `}
          >
            {p === 'freeze' && <Snowflake className="w-5 h-5" />}
            {p === 'blowup' && <Bomb className="w-5 h-5" />}
            {p === 'shuffle' && <RotateCw className="w-5 h-5" />}
            {p === 'lock' && <Lock className={`w-5 h-5 ${isLockActive ? 'text-green-400' : ''}`} />}
            {count > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-primary w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold">
                {count}
              </span>
            )}
            {isLockActive && (
              <span className="absolute -top-1.5 -right-1.5 bg-green-500 w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold text-white">
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};