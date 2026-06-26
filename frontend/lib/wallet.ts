'use client';

import { NETWORK_PASSPHRASE } from './contracts';

let _initialized = false;

export async function initWalletKit(): Promise<void> {
  if (_initialized) return;

  const [
    { StellarWalletsKit },
    { FreighterModule },
    { LobstrModule },
    { Networks },
  ] = await Promise.all([
    import('@creit.tech/stellar-wallets-kit'),
    import('@creit.tech/stellar-wallets-kit/modules/freighter'),
    import('@creit.tech/stellar-wallets-kit/modules/lobstr'),
    import('@creit.tech/stellar-wallets-kit/types'),
  ]);

  StellarWalletsKit.init({
    modules: [
      new FreighterModule(),
      new LobstrModule(),
    ],
    network: Networks.TESTNET,
  } as Parameters<typeof StellarWalletsKit.init>[0]);

  _initialized = true;
}

export async function connectWallet(): Promise<{ address: string }> {
  await initWalletKit();
  const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
  return StellarWalletsKit.authModal();
}

export async function disconnectWallet(): Promise<void> {
  if (!_initialized) return;
  const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
  return StellarWalletsKit.disconnect();
}

export async function signTransaction(xdrString: string, address: string): Promise<string> {
  await initWalletKit();
  const { StellarWalletsKit } = await import('@creit.tech/stellar-wallets-kit');
  const result = await StellarWalletsKit.signTransaction(xdrString, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  });
  return result.signedTxXdr;
}
