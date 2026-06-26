/**
 * Contract addresses and configuration for Stakewell.
 * These are injected at build time via NEXT_PUBLIC_ environment variables.
 * For local development, copy .env.example to .env.local and fill in the values
 * after deploying the contracts to testnet.
 */

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
  'Test SDF Network ; September 2015';

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  'https://soroban-testnet.stellar.org';

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ||
  'https://horizon-testnet.stellar.org';

export const CONTRACT_STAKING =
  process.env.NEXT_PUBLIC_CONTRACT_STAKING || '';

export const CONTRACT_REWARDS =
  process.env.NEXT_PUBLIC_CONTRACT_REWARDS || '';

export const CONTRACT_TOKEN =
  process.env.NEXT_PUBLIC_CONTRACT_TOKEN || '';

// XLM Stellar Asset Contract address on testnet
export const XLM_SAC_ADDRESS =
  process.env.NEXT_PUBLIC_XLM_SAC || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCN4';

// APY in basis points (set at contract deploy time)
export const APY_BPS = parseInt(process.env.NEXT_PUBLIC_APY_BPS || '1200');
export const APY_PERCENT = APY_BPS / 100; // 12.0

export const SECONDS_PER_YEAR = 31_536_000;
export const STROOPS_PER_XLM = 10_000_000;

/** Format stroops to XLM string with fixed decimals */
export function formatXLM(stroops: bigint | number, decimals = 4): string {
  const val = Number(stroops) / STROOPS_PER_XLM;
  return val.toFixed(decimals);
}

/** Format RWD stroops to RWD string */
export function formatRWD(stroops: bigint | number, decimals = 6): string {
  const val = Number(stroops) / STROOPS_PER_XLM;
  return val.toFixed(decimals);
}

/** Compute live accrual client-side for the ticker.
 *  matches the on-chain formula: principal * apy_bps * elapsed / (10_000 * SECONDS_PER_YEAR)
 */
export function computeAccrual(
  principalStroops: number,
  checkpointTimeSec: number,
  accruedUnclaimed: number,
  nowMs: number
): number {
  const elapsed = Math.max(0, nowMs / 1000 - checkpointTimeSec);
  const live = (principalStroops * APY_BPS * elapsed) / (10_000 * SECONDS_PER_YEAR);
  return accruedUnclaimed + live;
}

export const STELLAR_EXPERT_BASE = 'https://stellar.expert/explorer/testnet';

export function txLink(hash: string): string {
  return `${STELLAR_EXPERT_BASE}/tx/${hash}`;
}

export function contractLink(addr: string): string {
  return `${STELLAR_EXPERT_BASE}/contract/${addr}`;
}
