import { useState, useRef, useCallback, useEffect } from 'react';
import { useGameStore } from '../stores/gameStore';
import { useAudioContext } from '../contexts/AudioContext';
import { MONSTERS, MonsterAvatar } from './MonsterAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import { Leaderboard } from './Leaderboard';
import { Scanner } from '@yudiel/react-qr-scanner';
import { QrCode, X } from 'lucide-react';

export const JoinScreen = () => {
  const { setUsername, setCharacter, setLobbyId, setPlayerId, setStatus, setMode, username, character } = useGameStore();
  const audio = useAudioContext();
  const [lobbyInput, setLobbyInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const musicStartedRef = useRef(false);

  // Restore scroll state when entering join screen (game locks scroll)
  useEffect(() => {
    // Restore body scroll - clear any scroll locks from game
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    document.body.style.height = '';
    document.body.style.top = '';
    document.body.style.left = '';
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Check camera availability
  useEffect(() => {
    const checkCamera = async () => {
      try {
        if (navigator.mediaDevices?.enumerateDevices) {
          // Just check if we can enumerate devices to see if camera exists
          const devices = await navigator.mediaDevices.enumerateDevices();
          const hasCamera = devices.some(device => device.kind === 'videoinput');
          setCameraAvailable(hasCamera);
        }
      } catch (error) {
        setCameraAvailable(false);
      }
    };
    checkCamera();
  }, []);

  // Start menu music on first user interaction (mobile browsers block autoplay)
  const startMusicOnInteraction = useCallback(() => {
    if (!musicStartedRef.current) {
      audio.playMenuMusic();
      musicStartedRef.current = true;
    }
  }, [audio]);

  const handleScan = (result: string) => {
    if (result) {
      audio.playButtonClick();
      setLobbyInput(result.toUpperCase());
      setShowScanner(false);
      setScanError(null);
    }
  };

  const handleScanError = (error: unknown) => {
    console.error('QR Scan error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('permission')) {
      setScanError('Camera access required to scan QR codes');
    } else {
      setScanError('Unable to access camera. Please try manual entry.');
    }
  };

  const openScanner = () => {
    audio.playButtonClick();
    setScanError(null);
    setShowScanner(true);
  };

  const closeScanner = () => {
    audio.playButtonClick();
    setShowScanner(false);
    setScanError(null);
  };

  const handleStart = (mode: 'create' | 'join') => {
    if (!username) return;

    audio.playButtonClick();

    const pId = Math.random().toString(36).substring(7);
    setPlayerId(pId);
    setMode(mode);

    if (mode === 'create') {
      const lId = Math.random().toString(36).substring(7).toUpperCase();
      setLobbyId(lId);
    } else {
      if (!lobbyInput) return;
      setLobbyId(lobbyInput.toUpperCase());
    }

    setStatus('lobby');
  };

  return (
    <div
      className="flex flex-col items-center justify-start sm:justify-center min-h-screen p-6 pb-12 space-y-6 bg-navy-gradient pt-12 sm:pt-6 overflow-y-auto"
      onClick={startMusicOnInteraction}
      onTouchStart={startMusicOnInteraction}
    >
      <motion.h1
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-pink-500 italic shrink-0"
      >
        FAMILY BOGGLE
      </motion.h1>

      <div className="w-full max-w-sm space-y-4 frosted-glass p-6 sm:p-8 shrink-0">
        <input
          type="text"
          placeholder="ENTER USERNAME"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-4 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-primary text-center text-xl font-bold"
        />

        <div className="grid grid-cols-5 gap-2 py-4">
          {MONSTERS.map((m) => (
            <button
              key={m.name}
              onClick={() => {
                audio.playButtonClick();
                setCharacter(m.name);
              }}
              onMouseEnter={() => audio.playButtonHover()}
              className={`aspect-square rounded-lg border-2 transition-all overflow-hidden flex items-center justify-center ${character === m.name ? 'border-primary bg-primary/20 scale-110' : 'border-transparent'}`}
            >
              <MonsterAvatar name={m.name} size={36} animated={true} />
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleStart('create')}
            className="w-full py-4 bg-primary rounded-xl font-black text-xl shadow-lg active:scale-95 transition-transform"
          >
            CREATE LOBBY
          </button>

          {cameraAvailable && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-transparent px-2 text-white/30">or</span>
                </div>
              </div>

              <button
                onClick={openScanner}
                className="w-full py-4 bg-white/5 border border-white/20 rounded-xl font-bold active:scale-95 transition-transform flex items-center justify-center gap-2"
              >
                <QrCode size={20} />
                SCAN QR CODE
              </button>
            </>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-transparent px-2 text-white/30">or enter code</span>
            </div>
          </div>

          <div className="flex items-stretch gap-2">
            <input
              type="text"
              placeholder="LOBBY CODE"
              value={lobbyInput}
              onChange={(e) => setLobbyInput(e.target.value)}
              className="flex-1 min-w-0 p-4 bg-white/5 border border-white/20 rounded-xl focus:outline-none focus:border-primary text-center font-bold"
            />
            <button
              onClick={() => handleStart('join')}
              className="px-6 py-4 bg-white/10 rounded-xl font-bold active:scale-95 transition-transform shrink-0"
            >
              JOIN
            </button>
          </div>
        </div>
      </div>

      {/* High Scores Leaderboard */}
      <div className="w-full max-w-sm shrink-0 mb-6">
        <Leaderboard />
      </div>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeScanner}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closeScanner}
                className="absolute -top-4 -right-4 z-10 frosted-glass w-12 h-12 rounded-full flex items-center justify-center active:scale-95 transition-transform border border-white/20"
              >
                <X size={24} />
              </button>

              <div className="frosted-glass rounded-2xl p-6 space-y-4">
                <h2 className="text-xl font-bold text-center text-primary uppercase tracking-wide">
                  Scan QR Code
                </h2>
                <p className="text-sm text-center text-white/70">
                  Point your camera at the QR code
                </p>

                <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
                  <Scanner
                    onScan={(result) => {
                      if (result && result.length > 0) {
                        handleScan(result[0].rawValue);
                      }
                    }}
                    onError={handleScanError}
                    constraints={{
                      facingMode: 'environment'
                    }}
                    styles={{
                      container: {
                        width: '100%',
                        height: '100%'
                      }
                    }}
                  />
                </div>

                {scanError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-center text-sm text-red-200"
                  >
                    {scanError}
                  </motion.div>
                )}

                <p className="text-xs text-center text-white/50">
                  Or close this to enter code manually
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};


