#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token::Client as TokenClient,
    Address, Env, Vec,
};

#[contracttype]
pub enum DataKey {
    Config,
    UserPrincipal(Address),
    Stakers,
    Initialized,
}

#[contracttype]
#[derive(Clone)]
pub struct Config {
    pub rewards_contract: Address,
    pub xlm_token: Address,
}

fn get_config(env: &Env) -> Config {
    env.storage()
        .instance()
        .get(&DataKey::Config)
        .expect("not initialized")
}

fn get_principal(env: &Env, user: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::UserPrincipal(user.clone()))
        .unwrap_or(0)
}

fn set_principal(env: &Env, user: &Address, amount: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::UserPrincipal(user.clone()), &amount);
}

fn add_staker(env: &Env, user: &Address) {
    let mut stakers: Vec<Address> = env
        .storage()
        .persistent()
        .get(&DataKey::Stakers)
        .unwrap_or_else(|| Vec::new(env));
    if !stakers.contains(user) {
        stakers.push_back(user.clone());
        env.storage()
            .persistent()
            .set(&DataKey::Stakers, &stakers);
    }
}

// Import rewards contract WASM for inter-contract calls (Staking → Rewards)
mod rewards_contract {
    soroban_sdk::contractimport!(
        file = "../../target/wasm32v1-none/release/stakewell_rewards.wasm"
    );
}

#[contract]
pub struct StakingContract;

#[contractimpl]
impl StakingContract {
    /// One-time initializer.
    pub fn init(env: Env, rewards_contract: Address, xlm_token: Address) {
        let already: bool = env
            .storage()
            .instance()
            .get(&DataKey::Initialized)
            .unwrap_or(false);
        assert!(!already, "already initialized");

        env.storage().instance().set(
            &DataKey::Config,
            &Config {
                rewards_contract,
                xlm_token,
            },
        );
        env.storage()
            .instance()
            .set(&DataKey::Initialized, &true);
        env.storage()
            .persistent()
            .set(&DataKey::Stakers, &Vec::<Address>::new(&env));
    }

    /// Stake `amount` XLM stroops into the pool.
    pub fn stake(env: Env, user: Address, amount: i128) {
        assert!(amount > 0, "amount must be positive");
        user.require_auth();

        let config = get_config(&env);
        let staking_contract = env.current_contract_address();

        // Transfer XLM from user to staking contract via SAC
        let xlm_client = TokenClient::new(&env, &config.xlm_token);
        xlm_client.transfer(&user, &staking_contract, &amount);

        let old_principal = get_principal(&env, &user);
        let new_principal = old_principal + amount;
        set_principal(&env, &user, new_principal);
        add_staker(&env, &user);

        // Headline inter-contract call: Staking → Rewards
        let rewards_client =
            rewards_contract::Client::new(&env, &config.rewards_contract);
        rewards_client.register_stake(&user, &new_principal);

        env.events().publish(
            (symbol_short!("staked"),),
            (user, amount, new_principal),
        );
    }

    /// Unstake `amount` XLM stroops from the pool.
    pub fn unstake(env: Env, user: Address, amount: i128) {
        assert!(amount > 0, "amount must be positive");
        user.require_auth();

        let config = get_config(&env);
        let staking_contract = env.current_contract_address();

        let current_principal = get_principal(&env, &user);
        assert!(
            amount <= current_principal,
            "cannot unstake more than staked principal"
        );

        let new_principal = current_principal - amount;

        // Settle accrual BEFORE reducing principal — Staking → Rewards
        let rewards_client =
            rewards_contract::Client::new(&env, &config.rewards_contract);
        rewards_client.register_stake(&user, &new_principal);

        // Transfer XLM back to user via SAC
        let xlm_client = TokenClient::new(&env, &config.xlm_token);
        xlm_client.transfer(&staking_contract, &user, &amount);

        set_principal(&env, &user, new_principal);

        env.events().publish(
            (symbol_short!("unstaked"),),
            (user, amount, new_principal),
        );
    }

    pub fn get_staked(env: Env, user: Address) -> i128 {
        get_principal(&env, &user)
    }

    pub fn list_stakers(env: Env) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::Stakers)
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn get_rewards_contract(env: Env) -> Address {
        get_config(&env).rewards_contract
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Ledger},
        Env,
    };

    mod token_wasm {
        soroban_sdk::contractimport!(
            file = "../../target/wasm32v1-none/release/stakewell_token.wasm"
        );
    }

    mod rewards_wasm {
        soroban_sdk::contractimport!(
            file = "../../target/wasm32v1-none/release/stakewell_rewards.wasm"
        );
    }

    fn setup_full() -> (
        Env,
        soroban_sdk::Address, // token contract
        soroban_sdk::Address, // rewards contract
        soroban_sdk::Address, // staking contract
        soroban_sdk::Address, // xlm sac address
    ) {
        let env = Env::default();
        env.mock_all_auths();

        // Register a stellar asset contract as our "XLM"
        let xlm_admin = Address::generate(&env);
        let xlm_sac = env.register_stellar_asset_contract_v2(xlm_admin.clone());
        let xlm_addr = xlm_sac.address();

        let token_id = env.register(token_wasm::WASM, ());
        let token_client = token_wasm::Client::new(&env, &token_id);

        let rewards_id = env.register(rewards_wasm::WASM, ());
        let rewards_client = rewards_wasm::Client::new(&env, &rewards_id);

        let staking_id = env.register(StakingContract, ());
        let staking_client = StakingContractClient::new(&env, &staking_id);

        token_client.init(&rewards_id);
        rewards_client.init(&token_id, &1200_u32, &staking_id);
        staking_client.init(&rewards_id, &xlm_addr);

        (env, token_id, rewards_id, staking_id, xlm_addr)
    }

    /// Test 5: stake correctly locks principal and calls register_stake with the right new total.
    #[test]
    fn test_stake_locks_principal() {
        let (env, _token_id, rewards_id, staking_id, xlm_addr) = setup_full();
        let staking_client = StakingContractClient::new(&env, &staking_id);
        let rewards_client = rewards_wasm::Client::new(&env, &rewards_id);

        let user = Address::generate(&env);
        let amount: i128 = 50 * 10_000_000;

        let xlm_sac_client = soroban_sdk::token::StellarAssetClient::new(&env, &xlm_addr);
        xlm_sac_client.mint(&user, &(100 * 10_000_000_i128));

        env.ledger().with_mut(|l| l.timestamp = 1_000_000);
        staking_client.stake(&user, &amount);

        assert_eq!(staking_client.get_staked(&user), amount);
        assert_eq!(rewards_client.get_principal(&user), amount);
    }

    /// Test 6: unstake fails gracefully if amount exceeds principal.
    #[test]
    #[should_panic(expected = "cannot unstake more than staked principal")]
    fn test_unstake_exceeds_principal_fails() {
        let (env, _token_id, _rewards_id, staking_id, xlm_addr) = setup_full();
        let staking_client = StakingContractClient::new(&env, &staking_id);

        let user = Address::generate(&env);
        let amount: i128 = 50 * 10_000_000;

        let xlm_sac_client = soroban_sdk::token::StellarAssetClient::new(&env, &xlm_addr);
        xlm_sac_client.mint(&user, &(100 * 10_000_000_i128));

        env.ledger().with_mut(|l| l.timestamp = 1_000_000);
        staking_client.stake(&user, &amount);

        staking_client.unstake(&user, &(100 * 10_000_000_i128));
    }
}
