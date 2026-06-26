'use client';

import { motion } from 'framer-motion';

interface WalletNotInstalledProps {
  walletName?: string;
}

export function WalletNotInstalled({ walletName = 'Freighter' }: WalletNotInstalledProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-bright rounded-2xl p-6 border border-yellow-500/20 max-w-sm mx-auto"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/15 flex items-center justify-center">
          <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-white">Wallet Not Found</h3>
          <p className="text-xs text-yellow-600">{walletName} extension required</p>
        </div>
      </div>

      <p className="text-sm text-green-600 mb-4">
        To use Stakewell, you need a Stellar wallet. Install {walletName} — the official Stellar wallet — to get started.
      </p>

      <a
        href="https://freighter.app"
        target="_blank"
        rel="noopener noreferrer"
        className="btn-shine flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
          bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-sm font-medium
          border border-yellow-500/30 transition-all duration-200"
      >
        Install Freighter ↗
      </a>
    </motion.div>
  );
}
