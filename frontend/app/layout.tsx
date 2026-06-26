import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stakewell — Stake XLM, Earn RWD',
  description:
    'Stake native XLM on Stellar Soroban and watch your RWD rewards accrue in real time. Powered by 3 on-chain smart contracts.',
  keywords: ['stellar', 'soroban', 'staking', 'defi', 'xlm', 'rewards'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0f0d" />
      </head>
      <body className="min-h-screen bg-surface-900 text-green-100 bg-dots hex-bg">
        {children}
      </body>
    </html>
  );
}
