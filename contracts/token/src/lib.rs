#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String,
};

#[contracttype]
pub enum DataKey {
    Balance(Address),
    MintAuthority,
    Initialized,
}

fn get_balance(env: &Env, addr: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(addr.clone()))
        .unwrap_or(0)
}

fn set_balance(env: &Env, addr: &Address, amount: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::Balance(addr.clone()), &amount);
}

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    /// One-time initializer. Sets the `mint_authority` (the Rewards contract address).
    /// After this, only that address can call `mint`.
    pub fn init(env: Env, mint_authority: Address) {
        let already: bool = env
            .storage()
            .instance()
            .get(&DataKey::Initialized)
            .unwrap_or(false);
        assert!(!already, "already initialized");
        env.storage()
            .instance()
            .set(&DataKey::MintAuthority, &mint_authority);
        env.storage()
            .instance()
            .set(&DataKey::Initialized, &true);
    }

    /// Mint `amount` RWD tokens to `to`.
    /// Restricted: only the Rewards contract (mint authority) may call this.
    pub fn mint(env: Env, to: Address, amount: i128) {
        assert!(amount > 0, "amount must be positive");
        let authority: Address = env
            .storage()
            .instance()
            .get(&DataKey::MintAuthority)
            .expect("not initialized");
        // Require auth from the mint authority (Rewards contract)
        authority.require_auth();

        let current = get_balance(&env, &to);
        set_balance(&env, &to, current + amount);

        env.events().publish(
            (symbol_short!("mint"),),
            (to, amount),
        );
    }

    /// Transfer `amount` RWD tokens from `from` to `to`.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        assert!(amount > 0, "amount must be positive");
        from.require_auth();
        let from_balance = get_balance(&env, &from);
        assert!(from_balance >= amount, "insufficient balance");
        set_balance(&env, &from, from_balance - amount);
        let to_balance = get_balance(&env, &to);
        set_balance(&env, &to, to_balance + amount);

        env.events().publish(
            (symbol_short!("transfer"),),
            (from, to, amount),
        );
    }

    /// Returns the RWD balance of `addr`.
    pub fn balance(env: Env, addr: Address) -> i128 {
        get_balance(&env, &addr)
    }

    /// Token decimals — 7, matching Stellar convention.
    pub fn decimals(_env: Env) -> u32 {
        7
    }

    /// Token symbol.
    pub fn symbol(env: Env) -> String {
        String::from_str(&env, "RWD")
    }

    /// Token name.
    pub fn name(env: Env) -> String {
        String::from_str(&env, "Stakewell Reward")
    }

    /// Returns the current mint authority (Rewards contract address).
    pub fn mint_authority(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::MintAuthority)
            .expect("not initialized")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_mint_and_balance() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(TokenContract, ());
        let client = TokenContractClient::new(&env, &contract_id);

        let rewards_addr = Address::generate(&env);
        let user = Address::generate(&env);

        client.init(&rewards_addr);
        client.mint(&user, &1_000_0000000_i128);
        assert_eq!(client.balance(&user), 1_000_0000000_i128);
    }

    #[test]
    fn test_transfer() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(TokenContract, ());
        let client = TokenContractClient::new(&env, &contract_id);

        let rewards_addr = Address::generate(&env);
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.init(&rewards_addr);
        client.mint(&alice, &500_0000000_i128);
        client.transfer(&alice, &bob, &200_0000000_i128);
        assert_eq!(client.balance(&alice), 300_0000000_i128);
        assert_eq!(client.balance(&bob), 200_0000000_i128);
    }

    #[test]
    fn test_symbol_and_decimals() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(TokenContract, ());
        let client = TokenContractClient::new(&env, &contract_id);

        let rewards_addr = Address::generate(&env);
        client.init(&rewards_addr);

        assert_eq!(client.symbol(), soroban_sdk::String::from_str(&env, "RWD"));
        assert_eq!(client.decimals(), 7);
    }
}
