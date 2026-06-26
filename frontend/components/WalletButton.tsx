'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface WalletState {
  address: string | null;
  xlmBalance: number;
  isConnecting: boolean;
  error: string | null;
}

interface WalletButtonProps {
  state: WalletState;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function WalletButton({ state, onConnect, onDisconnect }: WalletButtonProps) {
  const [showMenu, setShowMenu] = useState(false);

  const truncate = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  if (!state.address) {
    return (
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onConnect}
        disabled={state.isConnecting}
        className="btn-shine relative flex items-center gap-2 px-5 py-2.5 rounded-xl
          bg-brand-500 hover:bg-brand-400 text-black font-semibold text-sm
          transition-all duration-200 disabled:opacity-50 disabled:cursor-wait"
      >
        {state.isConnecting ? (
          <>
            <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            Connecting…
          </>
        ) : (
          <>
            <WalletIcon />
            Connect Wallet
          </>
        )}
      </motion.button>
    );
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowMenu((v) => !v)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl glass border border-brand-500/30
          hover:border-brand-400/50 transition-all duration-200"
      >
        <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse-slow" />
        <span className="font-mono text-sm text-brand-300">{truncate(state.address)}</span>
        <span className="text-xs text-green-600 font-medium">{state.xlmBalance.toFixed(2)} XLM</span>
        <ChevronIcon open={showMenu} />
      </motion.button>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-56 glass-bright rounded-xl overflow-hidden z-50 shadow-2xl"
          >
            <div className="p-3 border-b border-white/5">
              <p className="text-xs text-green-600">Connected address</p>
              <p className="font-mono text-xs text-brand-300 mt-1 break-all">{state.address}</p>
            </div>
            <div className="p-3 border-b border-white/5">
              <p className="text-xs text-green-600">XLM Balance</p>
              <p className="text-sm font-semibold text-brand-300 mt-0.5">{state.xlmBalance.toFixed(7)} XLM</p>
            </div>
            <button
              onClick={() => { setShowMenu(false); onDisconnect(); }}
              className="w-full text-left px-3 py-3 text-sm text-red-400 hover:bg-red-500/10
                transition-colors duration-150 flex items-center gap-2"
            >
              <DisconnectIcon />
              Disconnect
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}
    </div>
  );
}

function WalletIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-3 h-3 text-green-600 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function DisconnectIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}
