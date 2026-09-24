#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Map, String, Vec,
};

// ========================================
// CONSTANTS
// ========================================

/// Precision multiplier for reward calculations (1e18).
/// Prevents integer division precision loss.
const PRECISION: u128 = 1_000_000_000_000_000_000;

// Storage keys
const NEXT_ID: soroban_sdk::Symbol = symbol_short!("NEXT_ID");
const PROJECTS: soroban_sdk::Symbol = symbol_short!("PROJECTS");
const NAMES: soroban_sdk::Symbol = symbol_short!("NAMES");
const SALES: soroban_sdk::Symbol = symbol_short!("SALES");
const REWARD_PAID: soroban_sdk::Symbol = symbol_short!("RWPAID");
const PENDING: soroban_sdk::Symbol = symbol_short!("PENDING");
const CLAIMED: soroban_sdk::Symbol = symbol_short!("CLAIMED");
const USER_PROJECTS: soroban_sdk::Symbol = symbol_short!("USRPRJ");
const TOTAL_SALES: soroban_sdk::Symbol = symbol_short!("T_SALES");

// ========================================
// TYPES
// ========================================

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct Project {
    pub creator: Address,
    pub total_supply: u128,
    pub minted: u128,
    pub min_purchase: u128,
    pub price: u128,
    pub created_at: u64,
    pub active: bool,
    pub total_energy_kwh: u128,
    pub total_revenue: u128,
    pub reward_per_token_stored: u128,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct InvestorPosition {
    pub project_id: u64,
    pub token_balance: u128,
    pub claimable_amount: u128,
    pub total_claimed: u128,
}

// ========================================
// CONTRACT
// ========================================

#[contract]
pub struct NikoProject;

#[contractimpl]
impl NikoProject {
    // ========================================
    // INIT
    // ========================================

    /// Initialize the contract. Sets the first project ID to 1.
    pub fn initialize(env: Env) {
        if env.storage().instance().has(&NEXT_ID) {
            panic!("already initialized");
        }
        env.storage().instance().set(&NEXT_ID, &1_u64);
        env.storage().instance().set(&TOTAL_SALES, &0_u128);
    }

    // ========================================
    // CREATE PROJECT
    // ========================================

    /// Create a new solar project. Returns the project ID.
    pub fn create_project(
        env: Env,
        creator: Address,
        name: String,
        total_supply: u128,
        price: u128,
        min_purchase: u128,
    ) -> u64 {
        creator.require_auth();

        // Validate inputs
        assert!(total_supply > 0, "supply must be > 0");
        assert!(price > 0, "price must be > 0");
        assert!(
            min_purchase > 0 && min_purchase <= total_supply,
            "invalid min_purchase"
        );

        let project_id: u64 = env
            .storage()
            .instance()
            .get(&NEXT_ID)
            .unwrap_or(1);
        let next = project_id
            .checked_add(1)
            .expect("project ID overflow");
        env.storage().instance().set(&NEXT_ID, &next);

        let project = Project {
            creator: creator.clone(),
            total_supply,
            minted: 0,
            min_purchase,
            price,
            created_at: env.ledger().timestamp(),
            active: true,
            total_energy_kwh: 0,
            total_revenue: 0,
            reward_per_token_stored: 0,
        };

        // Store project
        let mut projects: Map<u64, Project> = env
            .storage()
            .instance()
            .get(&PROJECTS)
            .unwrap_or(Map::new(&env));
        projects.set(project_id, project);
        env.storage().instance().set(&PROJECTS, &projects);

        // Store name
        let mut names: Map<u64, String> = env
            .storage()
            .instance()
            .get(&NAMES)
            .unwrap_or(Map::new(&env));
        names.set(project_id, name);
        env.storage().instance().set(&NAMES, &names);

        // Track user projects
        let mut user_projects: Map<Address, Vec<u64>> = env
            .storage()
            .instance()
            .get(&USER_PROJECTS)
            .unwrap_or(Map::new(&env));
        let mut up = user_projects
            .get(creator.clone())
            .unwrap_or(Vec::new(&env));
        up.push_back(project_id);
        user_projects.set(creator, up);
        env.storage()
            .instance()
            .set(&USER_PROJECTS, &user_projects);

        project_id
    }

    // ========================================
    // PURCHASE TOKENS (mint)
    // ========================================

    /// Purchase project tokens. Send native tokens (XLM) as payment.
    /// Auto-initializes and creates project #1 if not yet set up (hackathon convenience).
    pub fn purchase_tokens(
        env: Env,
        buyer: Address,
        project_id: u64,
        amount: u128,
        payment: u128,
    ) {
        buyer.require_auth();

        // ── Auto-init: if contract not initialized, initialize it ──
        if !env.storage().instance().has(&NEXT_ID) {
            env.storage().instance().set(&NEXT_ID, &1_u64);
            env.storage()
                .instance()
                .set(&TOTAL_SALES, &0_u128);
        }

        // ── Auto-create project #1 if it doesn't exist ──
        let mut projects: Map<u64, Project> = env
            .storage()
            .instance()
            .get(&PROJECTS)
            .unwrap_or(Map::new(&env));

        if !projects.contains_key(project_id) {
            let default_project = Project {
                creator: buyer.clone(),
                total_supply: 100_000,
                minted: 0,
                min_purchase: 1,
                price: 10_000_000, // 10 XLM per token in stroops
                created_at: env.ledger().timestamp(),
                active: true,
                total_energy_kwh: 0,
                total_revenue: 0,
                reward_per_token_stored: 0,
            };
            projects.set(project_id, default_project);
            env.storage().instance().set(&PROJECTS, &projects);

            // Store name
            let mut names: Map<u64, String> = env
                .storage()
                .instance()
                .get(&NAMES)
                .unwrap_or(Map::new(&env));
            names.set(
                project_id,
                String::from_str(&env, "Parque Solar Lima Norte"),
            );
            env.storage().instance().set(&NAMES, &names);

            // Update NEXT_ID if needed
            let current_next: u64 = env
                .storage()
                .instance()
                .get(&NEXT_ID)
                .unwrap_or(1);
            if project_id >= current_next {
                env.storage()
                    .instance()
                    .set(&NEXT_ID, &(project_id + 1));
            }

            // Re-read projects after mutation
            projects = env
                .storage()
                .instance()
                .get(&PROJECTS)
                .unwrap_or(Map::new(&env));
        }

        let mut project = projects
            .get(project_id)
            .expect("project not found");

        // ── Security checks ──
        assert!(project.active, "project not active");
        assert!(amount >= project.min_purchase, "below minimum purchase");
        assert!(
            project
                .minted
                .checked_add(amount)
                .is_some_and(|v| v <= project.total_supply),
            "insufficient supply"
        );

        // Calculate total price with overflow protection
        let total_price = project
            .price
            .checked_mul(amount)
            .expect("price * amount overflow");
        assert!(payment >= total_price, "insufficient payment");

        // ── Update state with checked arithmetic ──
        project.minted = project
            .minted
            .checked_add(amount)
            .expect("minted overflow");
        project.total_revenue = project
            .total_revenue
            .checked_add(total_price)
            .expect("total_revenue overflow");
        projects.set(project_id, project.clone());
        env.storage().instance().set(&PROJECTS, &projects);

        // Update sales balance
        let mut sales: Map<u64, u128> = env
            .storage()
            .instance()
            .get(&SALES)
            .unwrap_or(Map::new(&env));
        let current_sales = sales.get(project_id).unwrap_or(0);
        sales.set(
            project_id,
            current_sales
                .checked_add(total_price)
                .expect("sales overflow"),
        );
        env.storage().instance().set(&SALES, &sales);

        // Update total sales
        let total_sales: u128 = env
            .storage()
            .instance()
            .get(&TOTAL_SALES)
            .unwrap_or(0);
        env.storage().instance().set(
            &TOTAL_SALES,
            &total_sales
                .checked_add(total_price)
                .expect("total sales overflow"),
        );

        // Update buyer's balance
        let mut balances: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&PENDING)
            .unwrap_or(Map::new(&env));
        let current = balances
            .get((project_id, buyer.clone()))
            .unwrap_or(0);
        balances.set(
            (project_id, buyer.clone()),
            current
                .checked_add(amount)
                .expect("buyer balance overflow"),
        );
        env.storage().instance().set(&PENDING, &balances);

        // Event for off-chain holder indexer: topic filterable by buyer,
        // data (project_id, amount) allows reconstructing Map<buyer, balance> without reading storage.
        // Chose (symbol_short!("purchase"), buyer) as topics so Horizon/RPC getEvents
        // can filter by buyer address; alternative (single topic) would require scanning all events.
        env.events().publish(
            (symbol_short!("purchase"), buyer.clone()),
            (project_id, amount),
        );
    }

    // ========================================
    // DEPOSIT REVENUE
    // ========================================

    /// Deposit revenue for distribution to token holders.
    pub fn deposit_revenue(
        env: Env,
        depositor: Address,
        project_id: u64,
        amount: u128,
        energy_kwh_delta: u128,
    ) {
        depositor.require_auth();

        let mut projects: Map<u64, Project> = env
            .storage()
            .instance()
            .get(&PROJECTS)
            .unwrap_or(Map::new(&env));
        let mut project = projects
            .get(project_id)
            .expect("project not found");

        assert!(project.active, "project not active");
        assert!(amount > 0, "no funds deposited");
        assert!(project.minted > 0, "no tokens minted");

        // Multiply before divide to preserve precision
        let reward_increase = amount
            .checked_mul(PRECISION)
            .expect("reward calc overflow")
            / project.minted;
        assert!(reward_increase > 0, "reward increase too small");

        project.reward_per_token_stored = project
            .reward_per_token_stored
            .checked_add(reward_increase)
            .expect("reward_per_token overflow");
        project.total_revenue = project
            .total_revenue
            .checked_add(amount)
            .expect("total_revenue overflow");

        if energy_kwh_delta > 0 {
            project.total_energy_kwh = project
                .total_energy_kwh
                .checked_add(energy_kwh_delta)
                .expect("energy overflow");
        }

        projects.set(project_id, project);
        env.storage().instance().set(&PROJECTS, &projects);
    }

    // ========================================
    // UPDATE ENERGY
    // ========================================

    /// Increment energy generated (accumulative).
    pub fn update_energy(
        env: Env,
        caller: Address,
        project_id: u64,
        energy_delta: u128,
    ) {
        caller.require_auth();

        let mut projects: Map<u64, Project> = env
            .storage()
            .instance()
            .get(&PROJECTS)
            .unwrap_or(Map::new(&env));
        let mut project = projects
            .get(project_id)
            .expect("project not found");

        assert!(project.active, "project not active");

        project.total_energy_kwh = project
            .total_energy_kwh
            .checked_add(energy_delta)
            .expect("energy overflow");
        projects.set(project_id, project);
        env.storage().instance().set(&PROJECTS, &projects);
    }

    // ========================================
    // CLAIM REVENUE
    // ========================================

    /// Claim pending revenue for a project.
    pub fn claim_revenue(
        env: Env,
        investor: Address,
        project_id: u64,
    ) -> u128 {
        investor.require_auth();

        let projects: Map<u64, Project> = env
            .storage()
            .instance()
            .get(&PROJECTS)
            .unwrap_or(Map::new(&env));
        let project = projects
            .get(project_id)
            .expect("project not found");

        let balances: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&PENDING)
            .unwrap_or(Map::new(&env));
        let balance = balances
            .get((project_id, investor.clone()))
            .unwrap_or(0);

        if balance == 0 {
            return 0;
        }

        let reward_paid: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&REWARD_PAID)
            .unwrap_or(Map::new(&env));
        let paid = reward_paid
            .get((project_id, investor.clone()))
            .unwrap_or(0);

        let reward_delta = project
            .reward_per_token_stored
            .checked_sub(paid)
            .unwrap_or(0);

        // Multiply before divide to preserve precision
        let earned = balance
            .checked_mul(reward_delta)
            .unwrap_or(0)
            / PRECISION;

        if earned == 0 {
            return 0;
        }

        // Update state
        let mut rwp = reward_paid;
        rwp.set(
            (project_id, investor.clone()),
            project.reward_per_token_stored,
        );
        env.storage().instance().set(&REWARD_PAID, &rwp);

        let mut claimed: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&CLAIMED)
            .unwrap_or(Map::new(&env));
        let prev_claimed = claimed
            .get((project_id, investor.clone()))
            .unwrap_or(0);
        claimed.set(
            (project_id, investor),
            prev_claimed
                .checked_add(earned)
                .expect("claimed overflow"),
        );
        env.storage().instance().set(&CLAIMED, &claimed);

        earned
    }

    // ========================================
    // WITHDRAW SALES
    // ========================================

    /// Withdraw sales balance (creator only).
    pub fn withdraw_sales(
        env: Env,
        caller: Address,
        project_id: u64,
        amount: u128,
    ) {
        caller.require_auth();

        let projects: Map<u64, Project> = env
            .storage()
            .instance()
            .get(&PROJECTS)
            .unwrap_or(Map::new(&env));
        let project = projects
            .get(project_id)
            .expect("project not found");
        assert!(project.creator == caller, "not project creator");
        assert!(amount > 0, "invalid amount");

        let mut sales: Map<u64, u128> = env
            .storage()
            .instance()
            .get(&SALES)
            .unwrap_or(Map::new(&env));
        let balance = sales.get(project_id).unwrap_or(0);
        assert!(balance >= amount, "insufficient balance");

        sales.set(
            project_id,
            balance
                .checked_sub(amount)
                .expect("sales underflow"),
        );
        env.storage().instance().set(&SALES, &sales);

        let total_sales: u128 = env
            .storage()
            .instance()
            .get(&TOTAL_SALES)
            .unwrap_or(0);
        env.storage().instance().set(
            &TOTAL_SALES,
            &total_sales
                .checked_sub(amount)
                .expect("total sales underflow"),
        );
    }

    // ========================================
    // VIEW FUNCTIONS
    // ========================================

    /// Get project details.
    pub fn get_project(env: Env, project_id: u64) -> Project {
        let projects: Map<u64, Project> = env
            .storage()
            .instance()
            .get(&PROJECTS)
            .unwrap_or(Map::new(&env));
        projects.get(project_id).expect("project not found")
    }

    /// Get project name.
    pub fn get_project_name(env: Env, project_id: u64) -> String {
        let names: Map<u64, String> = env
            .storage()
            .instance()
            .get(&NAMES)
            .unwrap_or(Map::new(&env));
        names
            .get(project_id)
            .unwrap_or(String::from_str(&env, ""))
    }

    /// Get sales balance for a project.
    pub fn get_sales_balance(env: Env, project_id: u64) -> u128 {
        let sales: Map<u64, u128> = env
            .storage()
            .instance()
            .get(&SALES)
            .unwrap_or(Map::new(&env));
        sales.get(project_id).unwrap_or(0)
    }

    /// Get claimable amount for an investor.
    pub fn get_claimable(
        env: Env,
        investor: Address,
        project_id: u64,
    ) -> u128 {
        let projects: Map<u64, Project> = env
            .storage()
            .instance()
            .get(&PROJECTS)
            .unwrap_or(Map::new(&env));
        let project = projects
            .get(project_id)
            .expect("project not found");

        let balances: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&PENDING)
            .unwrap_or(Map::new(&env));
        let balance = balances
            .get((project_id, investor.clone()))
            .unwrap_or(0);

        if balance == 0 {
            return 0;
        }

        let reward_paid: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&REWARD_PAID)
            .unwrap_or(Map::new(&env));
        let paid = reward_paid
            .get((project_id, investor))
            .unwrap_or(0);

        let reward_delta = project
            .reward_per_token_stored
            .checked_sub(paid)
            .unwrap_or(0);

        balance
            .checked_mul(reward_delta)
            .unwrap_or(0)
            / PRECISION
    }

    /// Get investor portfolio.
    pub fn get_portfolio(
        env: Env,
        investor: Address,
        project_ids: Vec<u64>,
    ) -> Vec<InvestorPosition> {
        let projects: Map<u64, Project> = env
            .storage()
            .instance()
            .get(&PROJECTS)
            .unwrap_or(Map::new(&env));
        let balances: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&PENDING)
            .unwrap_or(Map::new(&env));
        let claimed: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&CLAIMED)
            .unwrap_or(Map::new(&env));

        let mut positions = Vec::new(&env);
        for pid in project_ids.iter() {
            let project = projects.get(pid).expect("project not found");
            let balance = balances
                .get((pid, investor.clone()))
                .unwrap_or(0);
            let total_claimed = claimed
                .get((pid, investor.clone()))
                .unwrap_or(0);

            let claimable = if balance > 0 {
                let reward_paid: Map<(u64, Address), u128> = env
                    .storage()
                    .instance()
                    .get(&REWARD_PAID)
                    .unwrap_or(Map::new(&env));
                let paid = reward_paid
                    .get((pid, investor.clone()))
                    .unwrap_or(0);
                let delta = project
                    .reward_per_token_stored
                    .checked_sub(paid)
                    .unwrap_or(0);
                balance
                    .checked_mul(delta)
                    .unwrap_or(0)
                    / PRECISION
            } else {
                0
            };

            positions.push_back(InvestorPosition {
                project_id: pid,
                token_balance: balance,
                claimable_amount: claimable,
                total_claimed,
            });
        }
        positions
    }

    /// Get user's project IDs.
    pub fn get_user_projects(env: Env, user: Address) -> Vec<u64> {
        let user_projects: Map<Address, Vec<u64>> = env
            .storage()
            .instance()
            .get(&USER_PROJECTS)
            .unwrap_or(Map::new(&env));
        user_projects.get(user).unwrap_or(Vec::new(&env))
    }

    /// Get next project ID.
    pub fn next_project_id(env: Env) -> u64 {
        env.storage().instance().get(&NEXT_ID).unwrap_or(1)
    }

    /// Get total sales balance across all projects.
    pub fn get_total_sales(env: Env) -> u128 {
        env.storage()
            .instance()
            .get(&TOTAL_SALES)
            .unwrap_or(0)
    }

    // ========================================
    // PROJECT STATUS
    // ========================================

    /// Toggle project active status (creator only).
    pub fn set_project_status(
        env: Env,
        caller: Address,
        project_id: u64,
        active: bool,
    ) {
        caller.require_auth();

        let mut projects: Map<u64, Project> = env
            .storage()
            .instance()
            .get(&PROJECTS)
            .unwrap_or(Map::new(&env));
        let mut project = projects
            .get(project_id)
            .expect("project not found");
        assert!(project.creator == caller, "not project creator");

        project.active = active;
        projects.set(project_id, project);
        env.storage().instance().set(&PROJECTS, &projects);
    }

    // ========================================
    // TRANSFER OWNERSHIP
    // ========================================

    /// Transfer project ownership (creator only).
    pub fn transfer_ownership(
        env: Env,
        caller: Address,
        project_id: u64,
        new_creator: Address,
    ) {
        caller.require_auth();

        let mut projects: Map<u64, Project> = env
            .storage()
            .instance()
            .get(&PROJECTS)
            .unwrap_or(Map::new(&env));
        let mut project = projects
            .get(project_id)
            .expect("project not found");
        assert!(project.creator == caller, "not project creator");

        let old_creator = project.creator.clone();
        project.creator = new_creator.clone();
        projects.set(project_id, project);
        env.storage().instance().set(&PROJECTS, &projects);

        // Update user_projects mapping
        let mut user_projects: Map<Address, Vec<u64>> = env
            .storage()
            .instance()
            .get(&USER_PROJECTS)
            .unwrap_or(Map::new(&env));

        // Remove from old creator
        let old_list = user_projects
            .get(old_creator.clone())
            .unwrap_or(Vec::new(&env));
        let mut new_old_list = Vec::new(&env);
        for pid in old_list.iter() {
            if pid != project_id {
                new_old_list.push_back(pid);
            }
        }
        user_projects.set(old_creator, new_old_list);

        // Add to new creator
        let mut new_list = user_projects
            .get(new_creator.clone())
            .unwrap_or(Vec::new(&env));
        new_list.push_back(project_id);
        user_projects.set(new_creator, new_list);

        env.storage()
            .instance()
            .set(&USER_PROJECTS, &user_projects);
    }
}

// ========================================
// TESTS
// ========================================

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    fn setup() -> (Env, Address, NikoProjectClient<'static>) {
        let env = Env::default();
        let contract_id = env.register(NikoProject, ());
        let client = NikoProjectClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        (env, admin, client)
    }

    #[test]
    fn test_initialize() {
        let (env, _, client) = setup();
        client.initialize();
        assert_eq!(client.next_project_id(), 1);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_initialize_twice() {
        let (env, _, client) = setup();
        client.initialize();
        client.initialize();
    }

    #[test]
    fn test_create_project() {
        let (env, admin, client) = setup();
        client.initialize();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        assert_eq!(project_id, 1);
        assert_eq!(client.next_project_id(), 2);

        let project = client.get_project(&project_id);
        assert_eq!(project.creator, admin);
        assert_eq!(project.total_supply, 1000);
        assert_eq!(project.price, 100);
        assert!(project.active);
    }

    #[test]
    fn test_purchase_tokens() {
        let (env, admin, client) = setup();
        client.initialize();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        let buyer = Address::generate(&env);
        client.purchase_tokens(&buyer, &project_id, &50, &5000);

        let project = client.get_project(&project_id);
        assert_eq!(project.minted, 50);
    }

    #[test]
    fn test_deposit_revenue() {
        let (env, admin, client) = setup();
        client.initialize();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        let buyer = Address::generate(&env);
        client.purchase_tokens(&buyer, &project_id, &100, &10000);

        client.deposit_revenue(&admin, &project_id, &5000, &100);

        let project = client.get_project(&project_id);
        assert!(project.reward_per_token_stored > 0);
        assert_eq!(project.total_energy_kwh, 100);
    }

    #[test]
    fn test_claim_revenue() {
        let (env, admin, client) = setup();
        client.initialize();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        let buyer = Address::generate(&env);
        client.purchase_tokens(&buyer, &project_id, &100, &10000);
        client.deposit_revenue(&admin, &project_id, &10000, &200);

        let claimable = client.get_claimable(&buyer, &project_id);
        assert!(claimable > 0);

        let claimed = client.claim_revenue(&buyer, &project_id);
        assert!(claimed > 0);
    }

    #[test]
    fn test_withdraw_sales() {
        let (env, admin, client) = setup();
        client.initialize();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        let buyer = Address::generate(&env);
        client.purchase_tokens(&buyer, &project_id, &100, &10000);

        let sales_balance = client.get_sales_balance(&project_id);
        assert_eq!(sales_balance, 10000);

        client.withdraw_sales(&admin, &project_id, &5000);
        assert_eq!(client.get_sales_balance(&project_id), 5000);
    }

    #[test]
    fn test_user_projects() {
        let (env, admin, client) = setup();
        client.initialize();

        client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );
        client.create_project(
            &admin,
            &String::from_str(&env, "Solar Cusco"),
            &2000,
            &200,
            &20,
        );

        let projects = client.get_user_projects(&admin);
        assert_eq!(projects.len(), 2);
    }
}
