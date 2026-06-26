'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { STROOPS_PER_XLM, CONTRACT_STAKING } from '@/lib/contracts';
import { invokeContract, addressToScVal, i128ToScVal } from '@/lib/stellar';
import type { TxStatus } from './TxToast';

interface StakePanelProps {
  address: string;
  xlmBalance: number;
  onTxStatus: (status: TxStatus) => void;
  onSuccess: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

export function StakePanel({ address, xlmBalance, onTxStatus, onSuccess, signTransaction }: StakePanelProps) {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const xlmAmount = parseFloat(amount || '0');
  const stroops = BigInt(Math.floor(xlmAmount * STROOPS_PER_XLM));

  // Validation
  const tooMuch = xlmAmount > xlmBalance;
  const tooLittle = xlmAmount > 0 && xlmAmount < 0.0000001;
  const isValid = xlmAmount > 0 && !tooMuch && !tooLittle;

  const handleStake = async () => {
    if (!isValid || isLoading) return;

    setIsLoading(true);
    onTxStatus({ state: 'pending', label: `Staking ${xlmAmount} XLM` });

    const result = await invokeContract(
      CONTRACT_STAKING,
      'stake',
      [addressToScVal(address), i128ToScVal(stroops)],
      address,
      signTransaction
    );

    setIsLoading(false);

    if (result.ok) {
      setAmount('');
      onTxStatus({ state: 'success', hash: result.hash, label: `Staked ${xlmAmount} XLM` });
      onSuccess();
    } else if (result.cancelled) {
      onTxStatus({ state: 'cancelled' });
    } else {
      let friendly = result.error;
      if (friendly.toLowerCase().includes('insufficient')) {
        friendly = 'Insufficient XLM balance. You need more XLM to stake this amount.';
      }
      onTxStatus({ state: 'error', message: friendly });
    }
  };

  const setPercent = (pct: number) => {
    const val = (xlmBalance * pct) / 100;
    // Keep a small amount for fees
    const adjusted = Math.max(0, val - (pct === 100 ? 1.5 : 0));
    setAmount(adjusted > 0 ? adjusted.toFixed(7) : '');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-bright rounded-2xl p-6 card-3d"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center">
          <StakeIcon />
        </div>
        <div>
          <h2 className="font-semibold text-white">Stake XLM</h2>
          <p className="text-xs text-green-700">Lock XLM to start earning RWD</p>
        </div>
      </div>

      {/* Balance display */}
      <div className="mb-4 p-3 rounded-xl bg-surface-800/60 border border-white/5">
        <div className="flex justify-between text-xs text-green-700 mb-1">
          <span>Available balance</span>
          <span>{xlmBalance.toFixed(7)} XLM</span>
        </div>
        <div className="flex gap-2">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={pct}
              onClick={() => setPercent(pct)}
              className="flex-1 text-xs py-1 rounded-lg bg-brand-500/10 hover:bg-brand-500/20
                text-brand-400 hover:text-brand-300 transition-colors border border-brand-500/20"
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Amount input */}
      <div className="mb-4">
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 transition-all
          ${tooMuch ? 'border-red-500/50 bg-red-500/5' :
            isValid ? 'border-brand-500/40 bg-brand-500/5' :
            'border-white/10 bg-surface-800/40'}
          input-ring`}
        >
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.0000000"
            min="0"
            step="0.0000001"
            className="flex-1 bg-transparent font-mono text-lg text-white placeholder-green-900
              focus:outline-none"
          />
          <span className="text-sm font-medium text-green-600 flex-shrink-0">XLM</span>
        </div>

        {/* Validation messages */}
        {tooMuch && (
          <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
            <span>⚠</span> Insufficient balance. You have {xlmBalance.toFixed(4)} XLM.
          </p>
        )}
        {xlmAmount > 0 && !tooMuch && (
          <p className="text-xs text-green-700 mt-1.5">
            ≈ {(xlmAmount * 0.12).toFixed(4)} RWD/year at 12% APY
          </p>
        )}
      </div>

      {/* Stake button */}
      <motion.button
        whileHover={isValid && !isLoading ? { scale: 1.02 } : {}}
        whileTap={isValid && !isLoading ? { scale: 0.98 } : {}}
        onClick={handleStake}
        disabled={!isValid || isLoading}
        className={`btn-shine w-full py-3.5 rounded-xl font-semibold text-sm transition-all duration-200
          ${isValid && !isLoading
            ? 'bg-brand-500 hover:bg-brand-400 text-black cursor-pointer glow-green'
            : 'bg-surface-700 text-green-800 cursor-not-allowed'
          }`}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
            Staking…
          </span>
        ) : (
          `Stake ${xlmAmount > 0 ? xlmAmount.toFixed(4) + ' XLM' : 'XLM'}`
        )}
      </motion.button>
    </motion.div>
  );
}

function StakeIcon() {
  return (
    <svg className="w-5 h-5 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}
