import { useGameStore } from '../stores/gameStore';
import { useShallow } from 'zustand/react/shallow';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { useAudioContext } from '../contexts/AudioContext';

export const ModeSelector = () => {
  const { gameMode, hostId, playerId } = useGameStore(
    useShallow(state => ({
      gameMode: state.gameMode,
      hostId: state.hostId,
      playerId: state.playerId,
    }))
  );
  const { send } = useWebSocketContext();
  const audio = useAudioContext();

  const isHost = hostId === playerId;

  const modes = [
    { id: 'classic', label: 'Classic', description: 'Traditional Boggle scoring' },
     { id: 'team', label: 'Team Play', description: 'Up to 5v5 team competition' },
    { id: 'timed_attack', label: 'Timed Attack', description: '60-second rounds, power-up drops' },
    { id: 'word_race', label: 'Word Race', description: 'Race to find target words first' },
  ];

  const handleModeSelect = (modeId: string) => {
    audio.playButtonClick();
    send('set_game_mode', { game_mode: modeId, mode_settings: {} });
  };

   if (!isHost) {
    // Non-hosts see read-only display
    const currentMode = modes.find(m => m.id === gameMode) || modes[0];
    return (
      <div className="space-y-3">
        <h3 className="text-center font-bold text-white/50">GAME MODE</h3>
        <div className="frosted-glass p-3 text-center min-h-[100px] flex flex-col justify-center">
          <p className="text-lg font-bold text-primary">{currentMode.label}</p>
          <p className="text-xs text-white/50 mt-1 px-1">{currentMode.description}</p>
        </div>
      </div>
    );
  }

   return (
    <div className="space-y-3">
      <h3 className="text-center font-bold text-white/50">GAME MODE</h3>
      <div className="grid grid-cols-2 gap-x-2 gap-y-3">
        {modes.map(mode => (
          <button
            key={mode.id}
            onClick={() => handleModeSelect(mode.id)}
            className={`frosted-glass p-3 text-center transition-all min-h-[100px] flex flex-col justify-center items-center ${gameMode === mode.id ? 'border-primary border-2 scale-105' : 'border-white/10 border'}`}
          >
            <p className={`font-bold text-sm ${gameMode === mode.id ? 'text-primary' : 'text-white'}`}>
              {mode.label}
            </p>
            <p className="text-[10px] text-white/50 mt-1 px-1 leading-tight overflow-hidden line-clamp-2">
              {mode.description}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};