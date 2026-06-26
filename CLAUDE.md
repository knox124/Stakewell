# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Stakewell is a Stellar Soroban dApp where users stake native XLM and earn RWD reward tokens at 12% APY. It consists of three on-chain smart contracts (Rust/Soroban) and a Next.js 14 static frontend deployed to Cloudflare Pages.

## Commands

### Smart Contracts (Rust/Soroban)
```bash
cargo test --workspace          # Run all 9 contract unit tests
cargo build --workspace         # Compile (native, for dev/IDE)

# Build WASM artifacts (requires wasm32v1-none target)
stellar contract build --package stakewell-token
stellar contract build --package stakewell-rewards
stellar contract build --package stakewell-staking
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev    # Dev server at http://localhost:3000
npm run build  # Static export to frontend/out/
npm run lint   # ESLint
```

## Architecture

### Contract Call Chain
```
User → Staking contract → (calls) Rewards.register_stake() on every stake/unstake
                          Rewards → (calls) Token.mint() on claim_rewards
```

- **Token (`contracts/token/`)** — RWD ERC-20-style token; only the Rewards contract (set as `mint_authority` at init) can mint.
- **Rewards (`contracts/rewards/`)** — Tracks per-user accrual. APY formula: `principal_stroops × 1200 × elapsed_seconds / (10_000 × 31_536_000)`. Stores `accrued_unclaimed` + `checkpoint_time` per user. `register_stake()` settles pending accrual before any principal change.
- **Staking (`contracts/staking/`)** — Holds XLM custody. Calls `Rewards.register_stake()` before changing principal. Interacts with the predeployed native XLM SAC (not a custom token contract).

### Frontend Structure
```
frontend/
  app/           # Next.js App Router (layout.tsx, page.tsx, globals.css)
  components/    # UI components (Dashboard, StakePanel, WalletButton, etc.)
  lib/
    contracts.ts # Soroban RPC call wrappers for all contract interactions
    stellar.ts   # Horizon queries (XLM balance, tx submission)
    wallet.ts    # StellarWalletsKit singleton (Freighter + LOBSTR)
```

### Key Frontend Patterns
- **Wallet**: `StellarWalletsKit` v2 static API — `authModal()` to connect, `signTransaction(xdr, {...})` to sign, `disconnect()` to clear.
- **Polling**: SWR polls on-chain state every 7s; Horizon XLM balance every 8s.
- **Live ticker**: `requestAnimationFrame` loop computes accrual client-side at ~60fps, re-seeded from on-chain value every poll cycle.
- **Static export**: `next.config.mjs` sets `output: 'static'`; deploy target is `frontend/out/` via Cloudflare Pages (`wrangler.toml`).

## Deployed Contract Addresses (Testnet)

| Contract | Address |
|----------|---------|
| Token (RWD) | `CAAYCV3BCFUA7UZ37XDFU5BMWNSF22JEESLB7CLARELHA22FHE7HA5MN` |
| Rewards | `CBI5EDHB5TK724BQKTEMIFL6I4DJFSAMTFEOBDBUCJMYQH77G7XLM4RV` |
| Staking | `CCG6HAPL56CUOC4OY6SBNSY3KAOKK4SQIR6KWYW4KASFK52L3KGRG5TT` |
| XLM SAC | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

These are wired into `frontend/.env.local` (copied from `.env.example`).

## CI/CD

`.github/workflows/ci.yml` runs 4 jobs on push/PR to main:
1. **contracts** — `cargo test --workspace` + WASM builds, uploads artifacts
2. **frontend** — `npm ci` + lint + build
3. **integration-check** — `stellar contract inspect` on downloaded WASMs
4. **deploy** — Cloudflare Pages deploy from `frontend/out/` (main branch only, `continue-on-error: true`)

## Soroban Target Note

Contract WASM builds use `wasm32v1-none` (not `wasm32-unknown-unknown`). The CI installs this target explicitly. When building locally: `rustup target add wasm32v1-none`.
