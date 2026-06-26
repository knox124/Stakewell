# MASTER BUILD PROMPT — Stake & Earn Rewards Pool (Stellar Soroban dApp)

Copy everything below this line into a fresh coding agent session (Claude Code, Antigravity, etc.) as a single prompt.

---

## ROLE & GOAL

You are building a **complete, production-grade, fully working Stellar Soroban dApp** called **Stake & Earn Rewards Pool**. This is for a hackathon-style challenge that is graded against a strict checklist. Treat every requirement below as **mandatory and individually verifiable** — not aspirational. Do not skip, fake, simulate, or stub anything. If something cannot be completed for real, stop and report it instead of inventing a placeholder.

**Concept:** A user stakes XLM into a pool. While staked, it accrues yield at a fixed APY, paid out in a separate reward token (`RWD`). The user can watch a live counter showing their accrued-but-unclaimed rewards ticking up in real time, claim rewards at any point without unstaking, or unstake their principal at any point. This requires a genuine 3-contract chain: `Staking` holds custody of staked XLM and notifies `Rewards` of stake changes; `Rewards` calculates accrual and pays out by calling the `Token` contract directly. Both inter-contract relationships must be real and provable on-chain.

---

## HARD RULES (violating any of these is a failure of the task)

1. **Never fabricate a transaction hash, contract address, or account ID.** Every hash/address that ends up in the README MUST come from an actual command you ran against Stellar testnet. A real Stellar transaction hash is exactly 64 lowercase hex characters (`0-9a-f` only); a real contract address is 56 characters starting with `C`. Validate both patterns before writing them anywhere. If you don't have a real one yet, write `PENDING — generate after deployment`, never a placeholder-looking string.
2. **Never claim a screenshot exists if you didn't capture it.** If you cannot capture a literal screenshot (e.g. of a running CI pipeline before it's actually been pushed and run), say so explicitly in the README with instructions for the human to capture it later, rather than describing a fake one.
3. **Every checklist item below must have a corresponding, explicitly labeled section in the README** — use the exact item wording as a heading or sub-heading so it's trivially matchable during review.
4. **Both inter-contract relationships must be real Soroban-to-Soroban contract invocation** (`env.invoke_contract` or the typed SDK client equivalent) — not faked "simulated" calls, not contracts that never actually call each other:
   - `Staking` → `Rewards` (on every stake/unstake, to checkpoint accrual)
   - `Rewards` → `Token` (on claim, to actually pay out)
5. **Build incrementally with meaningful, separate git commits** (minimum 12) reflecting real progressive stages — not one giant commit. See the commit plan near the end of this document.
6. **Test output, CI runs, and deployments must all be real and actually executed by you during this build**, not narrated as if they happened.

---

## TECH STACK

Match the proven working setup from the prior project in this series unless there's a strong reason to deviate:
- **Smart contracts:** Rust + Soroban SDK (latest stable — check the current `soroban-sdk` crate version at build time)
- **Frontend:** Next.js 14 (App Router) + TypeScript, configured as a **static export** (`output: 'export'` in `next.config.mjs`) so it can deploy cleanly to Cloudflare Workers static assets (or Vercel/Netlify if preferred)
- **Wallet integration:** `@creit.tech/stellar-wallets-kit` (StellarWalletsKit), with Freighter as the primary tested path
- **Data fetching/polling:** SWR
- **Styling:** Tailwind CSS
- **Animation (tasteful, sparing):** Framer Motion
- **Deployment:** Cloudflare Workers (with a root `wrangler.toml` pointing at the frontend's static export `out/` directory) — or Vercel/Netlify if you have a strong reason
- **CI/CD:** GitHub Actions

---

## SMART CONTRACT ARCHITECTURE

### Contract 1: `token` — `RWD` reward token
- Standard fungible token interface: `balance`, `transfer`, `mint` (restricted to the `Rewards` contract address only — set this authorization at init), `decimals`, `symbol`
- Staked principal itself should be **native XLM** via the Stellar Asset Contract (SAC) wrapper — don't write a redundant token contract for the staked asset, just use the existing SAC interface for XLM. Document this decision in code comments and the README.

### Contract 2: `rewards` — accrual & payout logic
State per user: `principal: i128`, `checkpoint_time: u64`, `accrued_unclaimed: i128`.
APY: a fixed constant set at contract init (e.g. 12% APY) — store it as a contract config value, not a magic number scattered in code.

Functions required:
- `init(token_address: Address, apy_bps: u32)` — one-time setup, `apy_bps` = APY in basis points (e.g. 1200 = 12%)
- `register_stake(user: Address, new_principal: i128)` — **callable only by the `Staking` contract** (enforce with an address check + `require_auth` on the staking contract's own call). Before updating principal, settle: compute elapsed-time accrual on the *old* principal and add it to `accrued_unclaimed`, then reset `checkpoint_time = now`, then set `principal = new_principal`
- `accrued_rewards(user: Address) -> i128` — pure read: `accrued_unclaimed + (principal * apy_bps * elapsed_seconds) / (10_000 * SECONDS_PER_YEAR)`
- `claim_rewards(user: Address) -> i128` — settles current accrual the same way `register_stake` does, then **calls the `token` contract's `mint`/`transfer` function via inter-contract invocation** to pay the user, resets `accrued_unclaimed = 0`, `checkpoint_time = now`, emits a `rewards_claimed` event, returns amount paid

### Contract 3: `staking` — custody of principal
Functions required:
- `stake(user: Address, amount: i128)` — `require_auth(user)`, transfers `amount` XLM from the user into this contract's custody (via the native SAC `transfer` call — this is itself an inter-contract call, document it even though it's not the headline one), looks up the user's current principal, adds `amount`, then **calls `rewards.register_stake(user, new_total_principal)`** — this is the first headline inter-contract call
- `unstake(user: Address, amount: i128)` — `require_auth(user)`, validates amount ≤ current principal, **calls `rewards.register_stake(user, new_total_principal)`** to settle accrual before reducing principal, then transfers `amount` XLM back to the user, emits an `unstaked` event
- `get_staked(user: Address) -> i128` — read
- `list_stakers() -> Vec<Address>` (optional, for an activity/leaderboard feed)

**Events to emit** (`env.events().publish`): `staked`, `unstaked`, `rewards_claimed`. The frontend must listen for/poll these for the real-time stake/unstake/claim feed — this satisfies the "event streaming & real-time updates" requirement.

### Testing (mandatory, real, must actually pass)
Write **at least 6** Rust unit tests across the `staking` and `rewards` crates, executed with `cargo test`:
1. `stake` correctly locks principal and triggers a `register_stake` call with the right new total
2. `accrued_rewards` returns ~0 at `t=0` and the mathematically correct value at a known later timestamp, for a known APY
3. `claim_rewards` actually invokes the token contract and the user's token balance increases by exactly the claimed amount
4. `claim_rewards` resets `accrued_unclaimed` to 0 and doesn't double-pay on a second immediate claim
5. `unstake` settles accrual correctly before returning principal (accrued rewards aren't lost when unstaking)
6. `unstake` fails gracefully if `amount` exceeds the user's current principal

Capture the real terminal output of a full passing test run — this is the source for both the README's test section and the required test-output screenshot.

---

## FRONTEND REQUIREMENTS

### Wallet flow
- Connect/disconnect via StellarWalletsKit
- Display connected address (truncated) and live XLM balance, refreshed via SWR polling (every 5–10s) and after every transaction

### Core UI screens/components
1. **Stake panel** — amount input, "Stake" button, shows current wallet XLM balance for reference, builds/signs/submits the `stake` transaction
2. **Dashboard** — for the connected user:
   - **Staked amount** (their current principal)
   - **Live APY counter**: a numeric ticker showing accrued-but-unclaimed `RWD` rewards, visibly incrementing — compute this client-side from `principal`, `checkpoint_time`, and the known APY (re-synced against the real on-chain `accrued_rewards` value every poll cycle so it's both smooth and ultimately accurate), exactly like the vesting ticker pattern used in the prior Payment Streaming Vault project
   - Current APY displayed clearly (e.g. "12% APY")
   - **Claim Rewards** button — claims without unstaking
   - **Unstake** input/button — partial or full unstake
3. **Transaction feedback** — every transaction (stake/unstake/claim) must show: pending state, then success (with tx hash + Stellar Expert link) or failure (with a human-readable reason), never a silent failure
4. **Activity feed** — recent `staked`/`unstaked`/`rewards_claimed` events, updating without a full page reload — a simple global pool feed (not just the connected user's) is a nice differentiator if time allows

### Required error handling — at least these 3 distinct, clearly differentiated states:
1. **Wallet not installed/found** — detect and show an actionable message ("Install Freighter" with link)
2. **User rejected the signature request** — distinguish from a real failure, show a calm "transaction cancelled" message
3. **Insufficient balance** — pre-validate before submitting (can't stake more XLM than you hold; can't unstake more than your principal) and/or catch the contract error and explain it in plain language

### Mobile responsiveness
- Genuinely responsive at ~375px (iPhone SE) and ~768px (tablet) — stacked cards instead of side-by-side panels on mobile, a fixed/prominent primary action button, no horizontal overflow

---

## DESIGN DIRECTION

Avoid the generic dark-glassmorphism crypto-dashboard look. Pick one distinctive, intentional visual identity and apply it consistently — the live APY/rewards counter is the hero moment of this UI (similar role to the vesting ticker in the previous project), so design typography and layout around making that number feel alive and satisfying to watch grow. Motion should support meaning (counter ticking, a subtle pulse on claim success) — avoid decorative animation for its own sake. Consult any available frontend design skill/guidance in your environment before finalizing styling.

---

## CI/CD PIPELINE

`.github/workflows/ci.yml`, running on every push/PR to main, as real separate jobs/steps:
1. **Contracts job:** install Rust + `wasm32-unknown-unknown` target, run `cargo test` for both `staking` and `rewards` crates, build optimized WASM for all three contracts
2. **Frontend job:** install Node deps, run lint, run `npm run build`
3. Badge for this workflow at the top of the README, reflecting a real passing run — push and let it actually execute before writing it up

---

## DEPLOYMENT WORKFLOW (must be executed for real)

1. Generate/fund a deployer testnet account via Friendbot
2. Deploy the `token` (`RWD`) contract to testnet — record the real contract address
3. Deploy the `rewards` contract, initialized with the token address and APY — record the real contract address
4. Deploy the `staking` contract, initialized with the rewards contract address — record the real contract address
5. Grant the `rewards` contract mint authority on the `token` contract (whatever mechanism your token contract uses for this) — verify it for real
6. From a funded test account: actually call `stake`, wait long enough for visible accrual, call `claim_rewards`, then call `unstake` — capture the **real transaction hashes** for all three
7. Verify all three contract addresses and all transaction hashes resolve on `https://stellar.expert/explorer/testnet/...` before putting them in the README
8. Deploy the frontend (Cloudflare Workers static assets, matching the working pattern from the prior project) and get a real live URL; wire the deployed contract addresses into its build-time environment variables (remember: with `output: 'export'`, `NEXT_PUBLIC_*` vars must be set wherever the build runs, not just locally)

---

## README STRUCTURE (mirror this exactly, heading-for-heading)

```
# Stake & Earn Rewards Pool

[CI/CD badge] [Stellar Testnet badge] [License badge]

Live Demo: <real url>
Demo Video (1–2 min): <real url — record after the app fully works>

## Project Description
## Architecture (diagram: Staking <-> Rewards <-> Token <-> Frontend <-> Wallet)
## Tech Stack
## Smart Contracts (Testnet)
| Contract | Address | Stellar Expert Link |
## Inter-Contract Calls
  - Staking -> Rewards: explain exactly when/why register_stake is called
  - Rewards -> Token: explain exactly when/why claim_rewards invokes the token contract
  - Transaction Hash Evidence: stake tx, claim tx, unstake tx (real hashes + Stellar Expert links)
## Wallet Connection (Connect / Disconnect)
## Staking Mechanics & APY Calculation
## Error Handling (list the 3+ handled error types explicitly)
## Screenshots
  - Wallet connected state
  - Stake flow
  - Live APY/rewards ticker on the dashboard
  - Successful claim + transaction confirmation
  - Mobile responsive UI
  - CI/CD pipeline run (actual screenshot of the Actions tab, green check)
  - Test output (actual terminal output, 6+ passing tests)
## Setup Instructions (clone, install, env vars, run locally, deploy contracts)
## Testing (how to run `cargo test`, paste real output)
## Commit History Summary
## License
```

---

## COMMIT PLAN (minimum 12 commits, real and incremental — do not squash)

1. `chore: project scaffold (Next.js + Soroban workspace)`
2. `feat: RWD token contract`
3. `feat: rewards contract — accrual model and register_stake`
4. `feat: rewards contract — claim_rewards with token payout`
5. `feat: staking contract — stake with custody + rewards checkpoint`
6. `feat: staking contract — unstake with accrual settlement`
7. `test: rewards + staking unit tests (6+ passing)`
8. `feat: wallet connect/disconnect via StellarWalletsKit`
9. `feat: stake UI flow`
10. `feat: live APY ticker + dashboard + claim/unstake UI`
11. `feat: error handling (wallet missing, rejected signature, insufficient balance)`
12. `feat: mobile responsive layout`
13. `ci: GitHub Actions pipeline for contracts + frontend`
14. `chore: testnet deployment + real contract addresses wired in`
15. `docs: README with full evidence (addresses, tx hashes, screenshots)`

---

## FINAL VERIFICATION CHECKLIST — confirm every line is literally true before declaring done

- [ ] All three contracts actually deployed on testnet, addresses verified on Stellar Expert
- [ ] Real `stake`, `claim_rewards`, and `unstake` transactions executed, all hashes verified on Stellar Expert
- [ ] `register_stake` provably called from `staking` into `rewards` (visible in code + reflected in real transaction effects)
- [ ] `claim_rewards` provably calls the token contract and the user's RWD balance actually increases
- [ ] 6+ contract tests written and actually passing, output captured
- [ ] CI workflow actually ran and passed, screenshot captured from the real Actions tab
- [ ] Wallet connect, disconnect, balance display, and 3 distinct error states all manually verified working
- [ ] Mobile layout manually checked at ~375px
- [ ] Live demo URL is real, loads, and matches what's in the README
- [ ] No placeholder/fake hashes, addresses, or screenshots anywhere in the repo
- [ ] 12+ real, incremental commits in git history

Begin building now. Work through the contract layer first, verify it with real tests and a real testnet deployment, then build the frontend against the real deployed addresses, then finish with CI/CD and the README.
