import { useGameStore } from './stores/gameStore';
import { JoinScreen } from './components/JoinScreen';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { Countdown } from './components/Countdown';
import { GameSummary } from './components/GameSummary';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { AudioProvider } from './contexts/AudioContext';
import { AudioControls } from './components/AudioControls';

function App() {
  const { status } = useGameStore();

  return (
    <AudioProvider>
      <WebSocketProvider>
        <div className="h-[100dvh] w-screen bg-background">
          {status === 'join' && <JoinScreen />}
          {status === 'lobby' && <Lobby />}
          {status === 'countdown' && <Countdown />}
          {status === 'playing' && <GameBoard />}
          {status === 'summary' && <GameSummary />}
          <AudioControls />
        </div>
      </WebSocketProvider>
    </AudioProvider>
  );
}

export default App;
