#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env,
};

/// Seconds in a year (non-leap).
const SECONDS_PER_YEAR: u64 = 31_536_000;

#[contracttype]
pub enum DataKey {
    Config,
    UserState(Address),
    StakingContract,
    Initialized,
}

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub token_address: Address,
    pub apy_bps: u32,
}

#[contracttype]
#[derive(Clone, Default)]
pub struct UserState {
    pub principal: i128,
    pub checkpoint_time: u64,
    pub accrued_unclaimed: i128,
}

fn compute_accrual(principal: i128, apy_bps: u32, elapsed_seconds: u64) -> i128 {
    if principal <= 0 || elapsed_seconds == 0 {
        return 0;
    }
    (principal * apy_bps as i128 * elapsed_seconds as i128)
        / (10_000_i128 * SECONDS_PER_YEAR as i128)
}

fn get_user_state(env: &Env, user: &Address) -> UserState {
    env.storage()
        .persistent()
        .get(&DataKey::UserState(user.clone()))
        .unwrap_or_default()
}

fn set_user_state(env: &Env, user: &Address, state: &UserState) {
    env.storage()
        .persistent()
        .set(&DataKey::UserState(user.clone()), state);
}

fn get_config(env: &Env) -> Config {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .expect("not initialized")
}

// Import token contract WASM for inter-contract calls (Rewards → Token)
mod token_contract {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/stakewell_token.wasm"
    );
}

#[contract]
pub struct RewardsContract;

#[contractimpl]
impl RewardsContract {
    /// One-time initializer.
    pub fn init(env: Env, token_address: Address, apy_bps: u32, staking_contract: Address) {
        let already: bool = env
            .storage()
            .instance()
            .get(&DataKey::Initialized)
            .unwrap_or(false);
        assert!(!already, "already initialized");

        env.storage().instance().set(
            &DataKey::Config,
            &Config {
                token_address,
                apy_bps,
            },
        );
        env.storage()
            .instance()
            .set(&DataKey::StakingContract, &staking_contract);
        env.storage()
            .instance()
            .set(&DataKey::Initialized, &true);
    }

    /// Called by the Staking contract whenever a user's principal changes.
    /// Access control: only the registered Staking contract address may call this.
    pub fn register_stake(env: Env, user: Address, new_principal: i128) {
        let staking: Address = env
            .storage()
            .instance()
            .get(&DataKey::StakingContract)
            .expect("not initialized");
        staking.require_auth();

        let config = get_config(&env);
        let now = env.ledger().timestamp();
        let mut state = get_user_state(&env, &user);

        let elapsed = now.saturating_sub(state.checkpoint_time);
        let newly_accrued = compute_accrual(state.principal, config.apy_bps, elapsed);
        state.accrued_unclaimed += newly_accrued;
        state.checkpoint_time = now;
        state.principal = new_principal;

        set_user_state(&env, &user, &state);
    }

    /// Pure read: returns total accrued-but-unclaimed rewards for `user`.
    pub fn accrued_rewards(env: Env, user: Address) -> i128 {
        let config = get_config(&env);
        let now = env.ledger().timestamp();
        let state = get_user_state(&env, &user);
        let elapsed = now.saturating_sub(state.checkpoint_time);
        let live = compute_accrual(state.principal, config.apy_bps, elapsed);
        state.accrued_unclaimed + live
    }

    /// Settle accrual, mint RWD to the user via inter-contract call (Rewards → Token).
    pub fn claim_rewards(env: Env, user: Address) -> i128 {
        user.require_auth();
        let config = get_config(&env);
        let now = env.ledger().timestamp();
        let mut state = get_user_state(&env, &user);

        let elapsed = now.saturating_sub(state.checkpoint_time);
        let live = compute_accrual(state.principal, config.apy_bps, elapsed);
        let total = state.accrued_unclaimed + live;

        if total <= 0 {
            return 0;
        }

        state.accrued_unclaimed = 0;
        state.checkpoint_time = now;
        set_user_state(&env, &user, &state);

        // Inter-contract call: Rewards → Token contract (mint RWD to user)
        let token_client = token_contract::Client::new(&env, &config.token_address);
        token_client.mint(&user, &total);

        env.events().publish(
            (symbol_short!("rwdclaim"),),
            (user, total),
        );

        total
    }

    pub fn get_principal(env: Env, user: Address) -> i128 {
        get_user_state(&env, &user).principal
    }

    pub fn get_apy_bps(env: Env) -> u32 {
        get_config(&env).apy_bps
    }

    pub fn get_token(env: Env) -> Address {
        get_config(&env).token_address
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, testutils::Ledger, Env};

    mod token_wasm {
        soroban_sdk::contractimport!(
            file = "../../target/wasm32v1-none/release/stakewell_token.wasm"
        );
    }

    fn setup() -> (
        Env,
        soroban_sdk::Address,
        soroban_sdk::Address,
        soroban_sdk::Address,
    ) {
        let env = Env::default();
        env.mock_all_auths();

        let token_id = env.register(token_wasm::WASM, ());
        let token_client = token_wasm::Client::new(&env, &token_id);

        let rewards_id = env.register(RewardsContract, ());
        let staking_addr = Address::generate(&env);

        token_client.init(&rewards_id);

        let rewards_client = RewardsContractClient::new(&env, &rewards_id);
        rewards_client.init(&token_id, &1200_u32, &staking_addr);

        (env, token_id, rewards_id, staking_addr)
    }

    #[test]
    fn test_accrued_rewards_math() {
        let (env, _token_id, rewards_id, _staking_addr) = setup();
        let rewards_client = RewardsContractClient::new(&env, &rewards_id);
        let user = Address::generate(&env);

        let principal: i128 = 100 * 10_000_000;

        env.ledger().with_mut(|l| l.timestamp = 1_000_000);
        rewards_client.register_stake(&user, &principal);

        let immediate = rewards_client.accrued_rewards(&user);
        assert_eq!(immediate, 0);

        env.ledger()
            .with_mut(|l| l.timestamp = 1_000_000 + SECONDS_PER_YEAR);
        let after_year = rewards_client.accrued_rewards(&user);

        let expected = 12 * 10_000_000_i128;
        assert_eq!(after_year, expected);
    }

    #[test]
    fn test_claim_rewards_increases_balance() {
        let (env, token_id, rewards_id, _staking_addr) = setup();
        let rewards_client = RewardsContractClient::new(&env, &rewards_id);
        let token_client = token_wasm::Client::new(&env, &token_id);
        let user = Address::generate(&env);

        let principal: i128 = 100 * 10_000_000;
        env.ledger().with_mut(|l| l.timestamp = 1_000_000);
        rewards_client.register_stake(&user, &principal);

        env.ledger()
            .with_mut(|l| l.timestamp = 1_000_000 + SECONDS_PER_YEAR / 2);

        let claimed = rewards_client.claim_rewards(&user);
        assert!(claimed > 0);

        let rwd_balance = token_client.balance(&user);
        assert_eq!(rwd_balance, claimed);
    }

    #[test]
    fn test_no_double_pay() {
        let (env, token_id, rewards_id, _staking_addr) = setup();
        let rewards_client = RewardsContractClient::new(&env, &rewards_id);
        let token_client = token_wasm::Client::new(&env, &token_id);
        let user = Address::generate(&env);

        let principal: i128 = 100 * 10_000_000;
        env.ledger().with_mut(|l| l.timestamp = 1_000_000);
        rewards_client.register_stake(&user, &principal);

        env.ledger()
            .with_mut(|l| l.timestamp = 1_000_000 + SECONDS_PER_YEAR);
        let first_claim = rewards_client.claim_rewards(&user);
        assert!(first_claim > 0);

        let second_claim = rewards_client.claim_rewards(&user);
        assert_eq!(second_claim, 0);

        let total_balance = token_client.balance(&user);
        assert_eq!(total_balance, first_claim);
    }

    #[test]
    fn test_unstake_settles_accrual() {
        let (env, _token_id, rewards_id, _staking_addr) = setup();
        let rewards_client = RewardsContractClient::new(&env, &rewards_id);
        let user = Address::generate(&env);

        let principal: i128 = 100 * 10_000_000;
        env.ledger().with_mut(|l| l.timestamp = 1_000_000);
        rewards_client.register_stake(&user, &principal);

        env.ledger()
            .with_mut(|l| l.timestamp = 1_000_000 + SECONDS_PER_YEAR / 2);

        rewards_client.register_stake(&user, &0_i128);

        let accrued = rewards_client.accrued_rewards(&user);
        let expected = 6 * 10_000_000_i128;
        assert!(
            (accrued - expected).abs() <= 1,
            "accrued={} expected~={}",
            accrued,
            expected
        );
    }
}
