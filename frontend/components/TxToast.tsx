'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { txLink } from '@/lib/contracts';

export type TxStatus =
  | { state: 'idle' }
  | { state: 'pending'; label: string }
  | { state: 'success'; hash: string; label: string }
  | { state: 'cancelled' }
  | { state: 'error'; message: string };

interface TxToastProps {
  status: TxStatus;
  onDismiss: () => void;
}

export function TxToast({ status, onDismiss }: TxToastProps) {
  const visible = status.state !== 'idle';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50"
        >
          <div className={`glass-bright rounded-2xl p-4 shadow-2xl border ${
            status.state === 'success' ? 'border-brand-500/40 glow-green' :
            status.state === 'error' ? 'border-red-500/30' :
            status.state === 'cancelled' ? 'border-yellow-500/30' :
            'border-white/10'
          }`}>
            <div className="flex items-start gap-3">
              <StatusIcon state={status.state} />
              <div className="flex-1 min-w-0">
                {status.state === 'pending' && (
                  <>
                    <p className="text-sm font-semibold text-white">{status.label}</p>
                    <p className="text-xs text-green-600 mt-0.5">Waiting for confirmation…</p>
                  </>
                )}
                {status.state === 'success' && (
                  <>
                    <p className="text-sm font-semibold text-brand-300">{status.label}</p>
                    {status.hash && (
                      <a
                        href={txLink(status.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-500 hover:text-brand-300 underline mt-0.5 block font-mono truncate"
                      >
                        {status.hash.slice(0, 16)}…{status.hash.slice(-8)} ↗
                      </a>
                    )}
                  </>
                )}
                {status.state === 'cancelled' && (
                  <>
                    <p className="text-sm font-semibold text-yellow-400">Transaction Cancelled</p>
                    <p className="text-xs text-yellow-600 mt-0.5">You rejected the signature request.</p>
                  </>
                )}
                {status.state === 'error' && (
                  <>
                    <p className="text-sm font-semibold text-red-400">Transaction Failed</p>
                    <p className="text-xs text-red-600 mt-0.5 line-clamp-2">{status.message}</p>
                  </>
                )}
              </div>
              <button
                onClick={onDismiss}
                className="text-green-700 hover:text-white transition-colors flex-shrink-0 mt-0.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress bar for pending */}
            {status.state === 'pending' && (
              <div className="mt-3 h-0.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-brand-500 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '95%' }}
                  transition={{ duration: 25, ease: 'linear' }}
                />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatusIcon({ state }: { state: TxStatus['state'] }) {
  if (state === 'pending') {
    return (
      <div className="w-8 h-8 rounded-full border-2 border-brand-500/30 border-t-brand-400 animate-spin flex-shrink-0" />
    );
  }
  if (state === 'success') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
        className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center flex-shrink-0"
      >
        <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </motion.div>
    );
  }
  if (state === 'cancelled') {
    return (
      <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  );
}
