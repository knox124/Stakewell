'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { txLink } from '@/lib/contracts';

export interface ActivityEvent {
  id: string;
  type: 'staked' | 'unstaked' | 'rwdclaim' | string;
  ledger: number;
  data: unknown;
  hash?: string;
}

interface ActivityFeedProps {
  events: ActivityEvent[];
  isLoading: boolean;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  staked: { label: 'Staked', color: 'text-brand-400', icon: '▲' },
  unstaked: { label: 'Unstaked', color: 'text-orange-400', icon: '▼' },
  rwdclaim: { label: 'Claimed', color: 'text-accent-400', icon: '✦' },
};

export function ActivityFeed({ events, isLoading }: ActivityFeedProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="glass rounded-xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
          Pool Activity
        </h3>
        {isLoading && (
          <span className="text-xs text-green-700">Updating…</span>
        )}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-green-800">No events yet.</p>
          <p className="text-xs text-green-900 mt-1">Stake XLM to appear here.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {events.map((event) => {
              const cfg = TYPE_CONFIG[event.type] ?? { label: event.type, color: 'text-white', icon: '•' };
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
                >
                  <span className={`text-sm ${cfg.color} w-4 text-center flex-shrink-0`}>
                    {cfg.icon}
                  </span>
                  <span className={`text-xs font-medium ${cfg.color} w-14 flex-shrink-0`}>
                    {cfg.label}
                  </span>
                  <span className="text-xs text-green-700 flex-1">
                    Ledger #{event.ledger.toLocaleString()}
                  </span>
                  {event.hash && (
                    <a
                      href={txLink(event.hash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-800 hover:text-brand-400 font-mono"
                    >
                      {event.hash.slice(0, 8)}… ↗
                    </a>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
