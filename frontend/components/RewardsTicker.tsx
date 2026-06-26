'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { computeAccrual, APY_PERCENT, STROOPS_PER_XLM } from '@/lib/contracts';

interface RewardsTickerProps {
  principalStroops: number;
  checkpointTimeSec: number;
  accruedUnclaimedStroops: number;
  /** Called periodically with fresh on-chain value to re-sync */
  onChainAccrued?: number;
}

/**
 * The hero component: a live, real-time counter showing accruing RWD rewards.
 * 
 * Strategy:
 * - Computes accrual client-side using the on-chain formula at ~10fps for smooth animation.
 * - Re-syncs with on-chain `accrued_rewards` whenever `onChainAccrued` updates (via SWR polling).
 * - Shows the integer part with a rolling-digit animation, decimal part scrolling smoothly.
 */
export function RewardsTicker({
  principalStroops,
  checkpointTimeSec,
  accruedUnclaimedStroops,
  onChainAccrued,
}: RewardsTickerProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [prevInt, setPrevInt] = useState(0);
  const animRef = useRef<number>();
  const startTimeRef = useRef<number>(Date.now());
  const baseAccruedRef = useRef(accruedUnclaimedStroops);
  const baseCheckpointRef = useRef(checkpointTimeSec);

  // When on-chain value updates, reset the base
  useEffect(() => {
    if (onChainAccrued !== undefined && onChainAccrued >= 0) {
      baseAccruedRef.current = onChainAccrued;
      baseCheckpointRef.current = Date.now() / 1000;
      startTimeRef.current = Date.now();
    }
  }, [onChainAccrued]);

  useEffect(() => {
    baseAccruedRef.current = accruedUnclaimedStroops;
    baseCheckpointRef.current = checkpointTimeSec;
  }, [accruedUnclaimedStroops, checkpointTimeSec]);

  useEffect(() => {
    let lastValue = -1;

    const tick = () => {
      const nowMs = Date.now();
      const totalStroops = computeAccrual(
        principalStroops,
        baseCheckpointRef.current,
        baseAccruedRef.current,
        nowMs
      );
      const rwdValue = totalStroops / STROOPS_PER_XLM;

      if (Math.abs(rwdValue - lastValue) > 0.000001) {
        const newInt = Math.floor(rwdValue);
        setDisplayValue(rwdValue);
        setPrevInt((prev) => {
          if (newInt > prev) return newInt;
          return prev;
        });
        lastValue = rwdValue;
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [principalStroops]);

  const intPart = Math.floor(displayValue);
  const decPart = (displayValue - intPart).toFixed(6).slice(2); // 6 decimal digits

  const isEarning = principalStroops > 0;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Live indicator */}
      <div className="flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${isEarning ? 'bg-brand-400 animate-pulse' : 'bg-green-800'}`} />
        <span className={`text-xs font-medium uppercase tracking-widest ${isEarning ? 'text-brand-400' : 'text-green-700'}`}>
          {isEarning ? 'Live Accrual' : 'Not Staking'}
        </span>
      </div>

      {/* The big number */}
      <div className="flex items-baseline gap-0.5 select-none">
        {/* Integer part — digit roll animation */}
        <AnimatePresence mode="wait">
          <motion.span
            key={intPart}
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="text-5xl sm:text-6xl font-mono font-bold gradient-text tabular-nums"
          >
            {intPart.toLocaleString()}
          </motion.span>
        </AnimatePresence>

        <span className="text-5xl sm:text-6xl font-mono font-bold text-brand-600">.</span>

        {/* Decimal part — scrolling */}
        <span className="text-3xl sm:text-4xl font-mono font-semibold text-brand-400 tabular-nums opacity-80">
          {decPart}
        </span>

        <span className="ml-2 text-lg font-semibold text-brand-500 self-end mb-1">RWD</span>
      </div>

      {/* APY label */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-green-700">Earning at</span>
        <span className="font-semibold text-brand-300">{APY_PERCENT}% APY</span>
        {isEarning && (
          <span className="text-green-700">on {(principalStroops / STROOPS_PER_XLM).toFixed(2)} XLM staked</span>
        )}
      </div>
    </div>
  );
}
