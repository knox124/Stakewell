'use client';

import { motion } from 'framer-motion';

interface Orb3DProps {
  size?: number;
  className?: string;
}

/**
 * Decorative 3D-shaded orb with animated glow rings.
 * Used as the visual centerpiece of the landing/hero area.
 */
export function Orb3D({ size = 180, className = '' }: Orb3DProps) {
  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer glow rings */}
      {[1.4, 1.25, 1.1].map((scale, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border border-brand-500/20"
          style={{ width: size * scale, height: size * scale }}
          animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.02, 1] }}
          transition={{
            duration: 3 + i,
            repeat: Infinity,
            delay: i * 0.8,
            ease: 'easeInOut',
          }}
        />
      ))}

      {/* Rotating ring */}
      <motion.div
        className="absolute rounded-full border-2 border-dashed border-brand-500/30"
        style={{ width: size * 1.15, height: size * 1.15 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />

      {/* Main sphere */}
      <motion.div
        animate={{ y: [-4, 4, -4] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative rounded-full orb-3d"
        style={{ width: size, height: size }}
      >
        {/* Inner highlight */}
        <div
          className="absolute rounded-full bg-white/10"
          style={{
            width: size * 0.3,
            height: size * 0.2,
            top: '18%',
            left: '20%',
            filter: 'blur(6px)',
          }}
        />

        {/* XLM/S symbol */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            style={{ width: size * 0.38, height: size * 0.38 }}
            className="drop-shadow-lg"
          >
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="rgba(134,239,172,0.9)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </motion.div>

      {/* Orbiting dot */}
      <motion.div
        className="absolute w-3 h-3 rounded-full bg-brand-400 shadow-lg shadow-brand-400/50"
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: `${size / 2}px ${size / 2}px` }}
      >
        <div
          className="absolute"
          style={{
            left: '50%',
            top: '50%',
            transform: `translate(-50%, -50%) translateX(${size * 0.62}px)`,
          }}
        >
          <div className="w-3 h-3 rounded-full bg-brand-400 shadow-lg shadow-brand-400/60" />
        </div>
      </motion.div>
    </div>
  );
}
