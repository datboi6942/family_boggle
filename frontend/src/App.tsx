import { useGameStore } from './stores/gameStore';
import { JoinScreen } from './components/JoinScreen';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { Countdown } from './components/Countdown';
import { GameSummary } from './components/GameSummary';
import { WebSocketProvider } from './contexts/WebSocketContext';

function App() {
  const { status } = useGameStore();

  return (
    <WebSocketProvider>
      <div className="h-[100dvh] w-screen bg-background">
        {status === 'join' && <JoinScreen />}
        {status === 'lobby' && <Lobby />}
        {status === 'countdown' && <Countdown />}
        {status === 'playing' && <GameBoard />}
        {status === 'summary' && <GameSummary />}
      </div>
    </WebSocketProvider>
  );
}

export default App;
