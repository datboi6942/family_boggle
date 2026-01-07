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
    const lowerError = errorMessage.toLowerCase();

    if (lowerError.includes('permission') || lowerError.includes('denied')) {
      setScanError('Camera permission denied. Please allow camera access in your browser settings.');
    } else if (lowerError.includes('not found') || lowerError.includes('no device')) {
      setScanError('No camera found. Please use manual code entry.');
    } else if (lowerError.includes('not readable') || lowerError.includes('in use')) {
      setScanError('Camera is in use by another app. Please close other apps and try again.');
    } else {
      setScanError('Unable to start camera. Try manual code entry or refresh the page.');
    }
  };

  const openScanner = async () => {
    audio.playButtonClick();
    setScanError(null);

    // Check if camera API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('Camera API not available. Protocol:', window.location.protocol, 'Host:', window.location.host);

      if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setScanError('Camera requires HTTPS. Please access via https:// or localhost. Use manual code entry for now.');
      } else {
        setScanError('Camera not supported in this browser. Please use manual code entry or try a different browser.');
      }
      return;
    }

    // Test camera access before opening scanner
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } }
      });
      // Stop the test stream
      stream.getTracks().forEach(track => track.stop());
      // Camera is accessible, open scanner
      setShowScanner(true);
    } catch (error) {
      console.error('Camera access test failed:', error);
      const err = error as Error;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setScanError('Camera permission denied. Please allow camera access and try again.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setScanError('No camera found on this device.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setScanError('Camera is in use by another application.');
      } else {
        setScanError(`Camera error: ${err.message}. Try refreshing the page.`);
      }
    }
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

          {scanError && !showScanner && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/20 border border-red-500/50 rounded-xl p-3 text-center text-sm text-red-200"
            >
              {scanError}
            </motion.div>
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
                    allowMultiple={true}
                    scanDelay={500}
                    constraints={{
                      facingMode: { ideal: 'environment' },
                      aspectRatio: 1
                    }}
                    components={{
                      finder: true
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


