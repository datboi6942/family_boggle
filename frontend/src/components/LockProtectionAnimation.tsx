import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';

interface LockProtectionAnimationProps {
  lockJustConsumed: boolean;
}

export const LockProtectionAnimation = ({ lockJustConsumed }: LockProtectionAnimationProps) => {
  return (
    <AnimatePresence>
      {lockJustConsumed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
        >
          {/* Green glow background */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0.2, 0.3, 0] }}
            transition={{ duration: 2, times: [0, 0.1, 0.3, 0.5, 1] }}
            className="absolute inset-0 bg-green-500"
          />

          {/* Shield icon animation */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: [0, 1.5, 1.2], rotate: [0, 0, 0] }}
            transition={{
              duration: 0.6,
              times: [0, 0.4, 1],
              ease: "backOut"
            }}
            className="relative"
          >
            <motion.div
              animate={{
                boxShadow: [
                  '0 0 0px rgba(34, 197, 94, 0)',
                  '0 0 60px rgba(34, 197, 94, 0.8)',
                  '0 0 100px rgba(34, 197, 94, 0.6)',
                  '0 0 40px rgba(34, 197, 94, 0.3)',
                ]
              }}
              transition={{ duration: 1.5, times: [0, 0.2, 0.5, 1] }}
              className="rounded-full p-8 bg-green-500/30 backdrop-blur-sm border-4 border-green-400"
            >
              <Shield className="w-24 h-24 text-green-400" />
            </motion.div>
          </motion.div>

          {/* "PROTECTED!" text */}
          <motion.div
            initial={{ y: 50, opacity: 0, scale: 0.5 }}
            animate={{ y: 80, opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.4, ease: "backOut" }}
            className="absolute text-center"
            style={{ top: '50%' }}
          >
            <span className="text-3xl font-black text-green-400 tracking-wider drop-shadow-[0_0_20px_rgba(34,197,94,0.8)]">
              PROTECTED!
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};