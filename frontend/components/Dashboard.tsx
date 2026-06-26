'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { RewardsTicker } from './RewardsTicker';
import { STROOPS_PER_XLM, CONTRACT_STAKING, CONTRACT_REWARDS, APY_PERCENT, formatXLM } from '@/lib/contracts';
import { invokeContract, addressToScVal, i128ToScVal } from '@/lib/stellar';
import type { TxStatus } from './TxToast';

interface DashboardProps {
  address: string;
  stakedStroops: number;
  checkpointTimeSec: number;
  accruedUnclaimedStroops: number;
  onChainAccrued?: number;
  onTxStatus: (status: TxStatus) => void;
  onSuccess: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

export function Dashboard({
  address,
  stakedStroops,
  checkpointTimeSec,
  accruedUnclaimedStroops,
  onChainAccrued,
  onTxStatus,
  onSuccess,
  signTransaction,
}: DashboardProps) {
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [unstakeLoading, setUnstakeLoading] = useState(false);

  const stakedXLM = stakedStroops / STROOPS_PER_XLM;
  const unstakeXLM = parseFloat(unstakeAmount || '0');
  const unstakeStroops = BigInt(Math.floor(unstakeXLM * STROOPS_PER_XLM));

  const unstakeTooMuch = unstakeXLM > stakedXLM;
  const unstakeValid = unstakeXLM > 0 && !unstakeTooMuch;

  const handleClaim = async () => {
    if (claimLoading) return;
    setClaimLoading(true);
    onTxStatus({ state: 'pending', label: 'Claiming RWD rewards' });

    const result = await invokeContract(
      CONTRACT_REWARDS,
      'claim_rewards',
      [addressToScVal(address)],
      address,
      signTransaction
    );

    setClaimLoading(false);
    if (result.ok) {
      onTxStatus({ state: 'success', hash: result.hash, label: 'Rewards claimed' });
      onSuccess();
    } else if (result.cancelled) {
      onTxStatus({ state: 'cancelled' });
    } else {
      onTxStatus({ state: 'error', message: result.error });
    }
  };

  const handleUnstake = async () => {
    if (!unstakeValid || unstakeLoading) return;
    setUnstakeLoading(true);
    onTxStatus({ state: 'pending', label: `Unstaking ${unstakeXLM.toFixed(4)} XLM` });

    const result = await invokeContract(
      CONTRACT_STAKING,
      'unstake',
      [addressToScVal(address), i128ToScVal(unstakeStroops)],
      address,
      signTransaction
    );

    setUnstakeLoading(false);
    if (result.ok) {
      setUnstakeAmount('');
      onTxStatus({ state: 'success', hash: result.hash, label: `Unstaked ${unstakeXLM.toFixed(4)} XLM` });
      onSuccess();
    } else if (result.cancelled) {
      onTxStatus({ state: 'cancelled' });
    } else {
      let msg = result.error;
      if (msg.toLowerCase().includes('more than staked')) {
        msg = `You can only unstake up to ${stakedXLM.toFixed(4)} XLM (your current principal).`;
      }
      onTxStatus({ state: 'error', message: msg });
    }
  };

  return (
    <div className="space-y-4">
      {/* Hero rewards ticker */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-bright rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden"
      >
        {/* 3D background orb */}
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full orb-3d opacity-10 translate-x-20 -translate-y-20 animate-spin-slow pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 rounded-full orb-3d opacity-5 -translate-x-10 translate-y-10 animate-float pointer-events-none" />

        <p className="text-xs uppercase tracking-widest text-green-700 mb-4">Accrued Rewards</p>
        <RewardsTicker
          principalStroops={stakedStroops}
          checkpointTimeSec={checkpointTimeSec}
          accruedUnclaimedStroops={accruedUnclaimedStroops}
          onChainAccrued={onChainAccrued}
        />

        {/* Claim button */}
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleClaim}
          disabled={claimLoading}
          className="btn-shine mt-6 px-8 py-3 rounded-xl bg-accent-500 hover:bg-accent-400
            text-white font-semibold text-sm transition-all duration-200 disabled:opacity-50
            disabled:cursor-wait shadow-lg shadow-accent-500/20"
        >
          {claimLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Claiming…
            </span>
          ) : (
            '✦ Claim Rewards'
          )}
        </motion.button>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-xl p-4"
        >
          <p className="text-xs text-green-700 mb-1">Staked Principal</p>
          <p className="text-2xl font-mono font-bold text-brand-300">
            {formatXLM(stakedStroops, 4)}
          </p>
          <p className="text-xs text-green-700 mt-0.5">XLM</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="glass rounded-xl p-4"
        >
          <p className="text-xs text-green-700 mb-1">Current APY</p>
          <p className="text-2xl font-mono font-bold text-brand-300">{APY_PERCENT}%</p>
          <p className="text-xs text-green-700 mt-0.5">Fixed · Paid in RWD</p>
        </motion.div>
      </div>

      {/* Unstake panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-xl p-5"
      >
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <UnstakeIcon />
          Unstake XLM
        </h3>

        <div className="flex gap-2">
          <div className={`flex-1 flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-all
            ${unstakeTooMuch ? 'border-red-500/40' : 'border-white/10'}
            input-ring`}
          >
            <input
              type="number"
              value={unstakeAmount}
              onChange={(e) => setUnstakeAmount(e.target.value)}
              placeholder={`max ${stakedXLM.toFixed(4)}`}
              min="0"
              max={stakedXLM}
              step="0.0000001"
              className="flex-1 bg-transparent font-mono text-sm text-white placeholder-green-900
                focus:outline-none"
            />
            <button
              onClick={() => setUnstakeAmount(stakedXLM.toFixed(7))}
              className="text-xs text-brand-500 hover:text-brand-300"
            >
              MAX
            </button>
          </div>
          <motion.button
            whileHover={unstakeValid ? { scale: 1.03 } : {}}
            whileTap={unstakeValid ? { scale: 0.97 } : {}}
            onClick={handleUnstake}
            disabled={!unstakeValid || unstakeLoading}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
              ${unstakeValid && !unstakeLoading
                ? 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30'
                : 'bg-surface-700 text-green-900 cursor-not-allowed'
              }`}
          >
            {unstakeLoading ? '…' : 'Unstake'}
          </motion.button>
        </div>

        {unstakeTooMuch && (
          <p className="text-xs text-red-400 mt-1.5">
            ⚠ Maximum unstake is {stakedXLM.toFixed(4)} XLM.
          </p>
        )}

        <p className="text-xs text-green-800 mt-2">
          Rewards are settled before unstaking — you won&apos;t lose accrued RWD.
        </p>
      </motion.div>
    </div>
  );
}

function UnstakeIcon() {
  return (
    <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
    </svg>
  );
}
