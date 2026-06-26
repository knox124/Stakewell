'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import { WalletButton, type WalletState } from '@/components/WalletButton';
import { StakePanel } from '@/components/StakePanel';
import { Dashboard } from '@/components/Dashboard';
import { ActivityFeed, type ActivityEvent } from '@/components/ActivityFeed';
import { TxToast, type TxStatus } from '@/components/TxToast';
import { WalletNotInstalled } from '@/components/WalletNotInstalled';
import { Orb3D } from '@/components/Orb3D';
import { connectWallet, disconnectWallet, signTransaction } from '@/lib/wallet';
import {
  fetchXLMBalance,
  readContract,
  addressToScVal,
  fetchContractEvents,
} from '@/lib/stellar';
import {
  CONTRACT_STAKING,
  CONTRACT_REWARDS,
  CONTRACT_TOKEN,
  contractLink,
} from '@/lib/contracts';

// ─── SWR fetchers ────────────────────────────────────────────────────────────

async function fetchUserData(address: string) {
  const [staked, accrued] = await Promise.all([
    readContract(CONTRACT_STAKING, 'get_staked', [addressToScVal(address)], address),
    readContract(CONTRACT_REWARDS, 'accrued_rewards', [addressToScVal(address)], address),
  ]);

  return {
    stakedStroops: toNumber(staked),
    accruedStroops: toNumber(accrued),
    timestamp: Math.floor(Date.now() / 1000),
  };
}

function toNumber(val: unknown): number {
  if (typeof val === 'bigint') return Number(val);
  if (typeof val === 'number') return val;
  return 0;
}

async function fetchEvents(): Promise<ActivityEvent[]> {
  if (!CONTRACT_STAKING) return [];
  const events = await fetchContractEvents(CONTRACT_STAKING, 20);
  return events.map((e) => ({
    id: e.id,
    type: e.type,
    ledger: e.ledger,
    data: e.data,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [wallet, setWallet] = useState<WalletState>({
    address: null,
    xlmBalance: 0,
    isConnecting: false,
    error: null,
  });
  const [txStatus, setTxStatus] = useState<TxStatus>({ state: 'idle' });
  const [walletNotInstalled, setWalletNotInstalled] = useState(false);

  // Build the sign function that closes over the current address
  const makeSignFn = useCallback(
    (addr: string) => async (xdr: string) => signTransaction(xdr, addr),
    []
  );
  const [signFn, setSignFn] = useState<((xdr: string) => Promise<string>) | null>(null);

  const { data: userData, mutate: refreshUserData } = useSWR(
    wallet.address ? ['userData', wallet.address] : null,
    () => fetchUserData(wallet.address!),
    { refreshInterval: 7000 }
  );

  const { data: xlmBalance, mutate: refreshBalance } = useSWR(
    wallet.address ? ['balance', wallet.address] : null,
    () => fetchXLMBalance(wallet.address!),
    { refreshInterval: 8000 }
  );

  const { data: events, isLoading: eventsLoading } = useSWR('events', fetchEvents, {
    refreshInterval: 15000,
  });

  useEffect(() => {
    if (xlmBalance !== undefined) {
      setWallet((w) => ({ ...w, xlmBalance: xlmBalance ?? 0 }));
    }
  }, [xlmBalance]);

  const handleConnect = useCallback(async () => {
    setWallet((w) => ({ ...w, isConnecting: true, error: null }));
    setWalletNotInstalled(false);

    try {
      const { address } = await connectWallet();
      const balance = await fetchXLMBalance(address);
      setSignFn(() => makeSignFn(address));
      setWallet({ address, xlmBalance: balance, isConnecting: false, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.toLowerCase().includes('not installed') ||
        msg.toLowerCase().includes('not found') ||
        msg.toLowerCase().includes('extension')
      ) {
        setWalletNotInstalled(true);
      }
      setWallet((w) => ({ ...w, isConnecting: false, error: msg }));
    }
  }, [makeSignFn]);

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnectWallet();
    } catch {}
    setWallet({ address: null, xlmBalance: 0, isConnecting: false, error: null });
    setSignFn(null);
    setWalletNotInstalled(false);
  }, []);

  const handleTxSuccess = useCallback(() => {
    refreshUserData();
    refreshBalance();
    setTimeout(() => setTxStatus({ state: 'idle' }), 8000);
  }, [refreshUserData, refreshBalance]);

  const stakedStroops = userData?.stakedStroops ?? 0;
  const accruedStroops = userData?.accruedStroops ?? 0;
  const checkpointTimeSec = userData?.timestamp ?? Math.floor(Date.now() / 1000);
  const noSigner = () => Promise.reject(new Error('no signer'));

  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="sticky top-0 z-30 glass border-b border-white/5">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-brand-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                <line x1="12" y1="2" x2="12" y2="22" />
                <line x1="2" y1="8.5" x2="22" y2="8.5" />
                <line x1="2" y1="15.5" x2="22" y2="15.5" />
              </svg>
            </div>
            <span className="font-semibold text-white tracking-tight">Stakewell</span>
            <span className="hidden sm:block text-xs px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 border border-brand-500/20">
              Testnet
            </span>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <WalletButton state={wallet} onConnect={handleConnect} onDisconnect={handleDisconnect} onTxStatus={setTxStatus} />
          </motion.div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-8">
        <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-brand-500/20 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-slow" />
              <span className="text-xs text-brand-400 font-medium">Live on Stellar Testnet</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
              <span className="text-white">Stake XLM.</span>
              <br />
              <span className="gradient-text">Earn RWD.</span>
              <br />
              <span className="text-white">In Real Time.</span>
            </h1>
            <p className="text-green-700 text-lg mb-6 max-w-md mx-auto lg:mx-0">
              Stake native XLM on Soroban and watch your RWD rewards accrue every second. 12% APY, 3 smart contracts, all on-chain.
            </p>
            {!wallet.address && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleConnect}
                className="btn-shine px-8 py-3.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-black font-semibold text-sm glow-green"
              >
                Connect Wallet to Start →
              </motion.button>
            )}
            {CONTRACT_STAKING && (
              <div className="mt-8 space-y-1.5">
                <p className="text-xs text-green-800 uppercase tracking-widest">Deployed Contracts</p>
                {[
                  { label: 'Staking', addr: CONTRACT_STAKING },
                  { label: 'Rewards', addr: CONTRACT_REWARDS },
                  { label: 'Token', addr: CONTRACT_TOKEN },
                ].map(({ label, addr }) => addr ? (
                  <a key={label} href={contractLink(addr)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group">
                    <span className="text-xs text-green-800 w-14">{label}</span>
                    <span className="font-mono text-xs text-green-700 group-hover:text-brand-400 transition-colors">
                      {addr.slice(0, 10)}…{addr.slice(-6)}
                    </span>
                    <span className="text-xs text-green-900 group-hover:text-brand-500">↗</span>
                  </a>
                ) : null)}
              </div>
            )}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 100 }}
            className="flex-shrink-0 hidden md:block"
          >
            <Orb3D size={200} />
          </motion.div>
        </div>
      </section>

      {/* Wallet not installed */}
      <AnimatePresence>
        {walletNotInstalled && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 mb-6">
            <WalletNotInstalled walletName="Freighter" />
          </div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        {!wallet.address ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-4">
            <ArchitectureExplainer />
          </motion.div>
        ) : (
          <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-5">
              <StakePanel
                address={wallet.address}
                xlmBalance={wallet.xlmBalance}
                onTxStatus={setTxStatus}
                onSuccess={handleTxSuccess}
                signTransaction={signFn ?? noSigner}
              />
              <ActivityFeed events={events ?? []} isLoading={eventsLoading} />
            </div>
            <Dashboard
              address={wallet.address}
              stakedStroops={stakedStroops}
              checkpointTimeSec={checkpointTimeSec}
              accruedUnclaimedStroops={accruedStroops}
              onChainAccrued={userData?.accruedStroops}
              onTxStatus={setTxStatus}
              onSuccess={handleTxSuccess}
              signTransaction={signFn ?? noSigner}
            />
          </div>
        )}
      </div>

      <TxToast status={txStatus} onDismiss={() => setTxStatus({ state: 'idle' })} />
    </main>
  );
}

function ArchitectureExplainer() {
  const cards = [
    {
      icon: '🔒',
      title: 'Staking Contract',
      desc: 'Holds your XLM in custody. Calls the Rewards contract on every stake and unstake to checkpoint your accrual.',
    },
    {
      icon: '📈',
      title: 'Rewards Contract',
      desc: 'Tracks per-user accrual at 12% APY. Calls the Token contract to mint RWD when you claim.',
    },
    {
      icon: '🪙',
      title: 'RWD Token',
      desc: 'The reward token. Minted exclusively by the Rewards contract — no inflation without real staking.',
    },
  ];

  return (
    <div className="grid sm:grid-cols-3 gap-4">
      {cards.map((card, i) => (
        <motion.div
          key={card.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * i }}
          className="glass rounded-xl p-5 card-3d"
        >
          <div className="text-2xl mb-3">{card.icon}</div>
          <h3 className="font-semibold text-white text-sm mb-2">{card.title}</h3>
          <p className="text-xs text-green-700 leading-relaxed">{card.desc}</p>
        </motion.div>
      ))}
    </div>
  );
}
