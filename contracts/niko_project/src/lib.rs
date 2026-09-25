#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Map, String, Vec,
};

// ========================================
// CONSTANTS
// ========================================

/// Precision multiplier for reward calculations (1e18).
/// Prevents integer division precision loss.
const PRECISION: u128 = 1_000_000_000_000_000_000;

// Storage keys
const ADMIN: soroban_sdk::Symbol = symbol_short!("ADMIN");
const TOKEN: soroban_sdk::Symbol = symbol_short!("TOKEN");
const NEXT_ID: soroban_sdk::Symbol = symbol_short!("NEXT_ID");
const PROJECTS: soroban_sdk::Symbol = symbol_short!("PROJECTS");
const NAMES: soroban_sdk::Symbol = symbol_short!("NAMES");
const SALES: soroban_sdk::Symbol = symbol_short!("SALES");
const REWARD_PAID: soroban_sdk::Symbol = symbol_short!("RWPAID");
const PENDING: soroban_sdk::Symbol = symbol_short!("PENDING");
const PENDING_CLAIM: soroban_sdk::Symbol = symbol_short!("PNDCLAIM");
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
    // CONSTRUCTOR
    // ========================================

    /// Bind the administrator and payment token atomically at deployment.
    pub fn __constructor(env: Env, admin: Address, token: Address) {
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&TOKEN, &token);
        env.storage().instance().set(&NEXT_ID, &1_u64);
        env.storage().instance().set(&TOTAL_SALES, &0_u128);
    }

    // ========================================
    // PRIVATE HELPERS
    // ========================================

    /// Build a token client bound to the payment token configured at
    /// construction time.
    fn token_client(env: &Env) -> token::TokenClient<'_> {
        let token_address: Address = env
            .storage()
            .instance()
            .get(&TOKEN)
            .expect("missing token configuration");
        token::TokenClient::new(env, &token_address)
    }

    /// Load the projects map together with a specific project, panicking
    /// with a consistent message when the project does not exist.
    fn load_project(env: &Env, project_id: u64) -> (Map<u64, Project>, Project) {
        let projects: Map<u64, Project> = env
            .storage()
            .instance()
            .get(&PROJECTS)
            .unwrap_or(Map::new(env));
        let project = projects.get(project_id).expect("project not found");
        (projects, project)
    }

    // ========================================
    // ADMIN / TOKEN VIEWS
    // ========================================

    /// Get the contract admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&ADMIN)
            .expect("missing admin configuration")
    }

    /// Get the payment token address used for purchases and revenue.
    pub fn get_token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&TOKEN)
            .expect("missing token configuration")
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

        let project_id: u64 = env.storage().instance().get(&NEXT_ID).unwrap_or(1);
        let next = project_id.checked_add(1).expect("project ID overflow");
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
        let mut up = user_projects.get(creator.clone()).unwrap_or(Vec::new(&env));
        up.push_back(project_id);
        user_projects.set(creator, up);
        env.storage().instance().set(&USER_PROJECTS, &user_projects);

        project_id
    }

    // ========================================
    // PURCHASE TOKENS (mint)
    // ========================================

    /// Purchase project tokens. The required XLM payment is transferred
    /// from the buyer to the contract via the configured payment token.
    /// The project must already exist and be active.
    pub fn purchase_tokens(env: Env, buyer: Address, project_id: u64, amount: u128) {
        buyer.require_auth();

        let (mut projects, mut project) = Self::load_project(&env, project_id);

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
        assert!(total_price <= i128::MAX as u128, "price exceeds i128 range");

        // ── Move payment: buyer -> contract ──
        Self::token_client(&env).transfer(
            &buyer,
            &env.current_contract_address(),
            &(total_price as i128),
        );

        // ── Reward settlement (before the buyer's balance changes) ──
        // Settle earned-but-unclaimed rewards at the old balance so a new
        // purchase cannot claim rewards that accrued before it.
        let mut balances: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&PENDING)
            .unwrap_or(Map::new(&env));
        let current_balance = balances.get((project_id, buyer.clone())).unwrap_or(0);

        let mut reward_paid: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&REWARD_PAID)
            .unwrap_or(Map::new(&env));
        let paid = reward_paid.get((project_id, buyer.clone())).unwrap_or(0);

        if current_balance == 0 {
            // A first purchase cannot have accrued rewards. Checkpoint the
            // current index before adding the new balance.
            reward_paid.set((project_id, buyer.clone()), project.reward_per_token_stored);
        } else {
            let reward_delta = project
                .reward_per_token_stored
                .checked_sub(paid)
                .unwrap_or(0);
            let newly_earned = current_balance
                .checked_mul(reward_delta)
                .expect("reward calc overflow")
                / PRECISION;

            if newly_earned > 0 {
                let mut pending_claim: Map<(u64, Address), u128> = env
                    .storage()
                    .instance()
                    .get(&PENDING_CLAIM)
                    .unwrap_or(Map::new(&env));
                let prev_pending = pending_claim.get((project_id, buyer.clone())).unwrap_or(0);
                pending_claim.set(
                    (project_id, buyer.clone()),
                    prev_pending
                        .checked_add(newly_earned)
                        .expect("pending claim overflow"),
                );
                env.storage().instance().set(&PENDING_CLAIM, &pending_claim);
            }

            reward_paid.set((project_id, buyer.clone()), project.reward_per_token_stored);
        }
        env.storage().instance().set(&REWARD_PAID, &reward_paid);

        // ── Update project state with checked arithmetic ──
        project.minted = project.minted.checked_add(amount).expect("minted overflow");
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
        let total_sales: u128 = env.storage().instance().get(&TOTAL_SALES).unwrap_or(0);
        env.storage().instance().set(
            &TOTAL_SALES,
            &total_sales
                .checked_add(total_price)
                .expect("total sales overflow"),
        );

        // Update buyer's balance (after the reward settlement above)
        balances.set(
            (project_id, buyer.clone()),
            current_balance
                .checked_add(amount)
                .expect("buyer balance overflow"),
        );
        env.storage().instance().set(&PENDING, &balances);

        // Event for the holder indexer: filter by buyer and reconstruct
        // balances from the project ID and token amount in the data payload.
        env.events().publish(
            (symbol_short!("purchase"), buyer.clone()),
            (project_id, amount),
        );
    }

    // ========================================
    // DEPOSIT REVENUE
    // ========================================

    /// Deposit revenue for distribution to token holders. Only the project
    /// creator may deposit, and only once tokens have been minted.
    pub fn deposit_revenue(
        env: Env,
        depositor: Address,
        project_id: u64,
        amount: u128,
        energy_kwh_delta: u128,
    ) {
        depositor.require_auth();

        let (mut projects, mut project) = Self::load_project(&env, project_id);

        assert!(project.creator == depositor, "not project creator");
        assert!(project.active, "project not active");
        assert!(amount > 0, "no funds deposited");
        assert!(project.minted > 0, "no tokens minted");
        assert!(amount <= i128::MAX as u128, "amount exceeds i128 range");

        // ── Move revenue: depositor -> contract ──
        Self::token_client(&env).transfer(
            &depositor,
            &env.current_contract_address(),
            &(amount as i128),
        );

        // Multiply before divide to preserve precision
        let reward_increase =
            amount.checked_mul(PRECISION).expect("reward calc overflow") / project.minted;
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

    /// Increment energy generated (accumulative). Creator only.
    pub fn update_energy(env: Env, caller: Address, project_id: u64, energy_delta: u128) {
        caller.require_auth();

        let (mut projects, mut project) = Self::load_project(&env, project_id);

        assert!(project.creator == caller, "not project creator");
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

    /// Claim accrued revenue plus any rewards settled before a balance
    /// increase. Payouts are transferred from the contract to the investor.
    pub fn claim_revenue(env: Env, investor: Address, project_id: u64) -> u128 {
        investor.require_auth();

        let (_, project) = Self::load_project(&env, project_id);

        let balances: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&PENDING)
            .unwrap_or(Map::new(&env));
        let balance = balances.get((project_id, investor.clone())).unwrap_or(0);

        let mut reward_paid: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&REWARD_PAID)
            .unwrap_or(Map::new(&env));
        let paid = reward_paid.get((project_id, investor.clone())).unwrap_or(0);
        let reward_delta = project
            .reward_per_token_stored
            .checked_sub(paid)
            .unwrap_or(0);

        // Multiply before divide to preserve precision.
        let accrued = balance
            .checked_mul(reward_delta)
            .expect("reward calc overflow")
            / PRECISION;

        let mut pending_claim: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&PENDING_CLAIM)
            .unwrap_or(Map::new(&env));
        let pending = pending_claim
            .get((project_id, investor.clone()))
            .unwrap_or(0);
        let earned = accrued.checked_add(pending).expect("earned overflow");

        if earned == 0 {
            return 0;
        }
        assert!(earned <= i128::MAX as u128, "earned exceeds i128 range");

        // Update reward checkpoint.
        reward_paid.set(
            (project_id, investor.clone()),
            project.reward_per_token_stored,
        );
        env.storage().instance().set(&REWARD_PAID, &reward_paid);

        // Clear the settled amount now that it is being paid out.
        if pending > 0 {
            pending_claim.remove((project_id, investor.clone()));
            env.storage().instance().set(&PENDING_CLAIM, &pending_claim);
        }

        let mut claimed: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&CLAIMED)
            .unwrap_or(Map::new(&env));
        let prev_claimed = claimed.get((project_id, investor.clone())).unwrap_or(0);
        claimed.set(
            (project_id, investor.clone()),
            prev_claimed.checked_add(earned).expect("claimed overflow"),
        );
        env.storage().instance().set(&CLAIMED, &claimed);

        // ── Pay out: contract -> investor ──
        Self::token_client(&env).transfer(
            &env.current_contract_address(),
            &investor,
            &(earned as i128),
        );

        earned
    }

    // ========================================
    // WITHDRAW SALES
    // ========================================

    /// Withdraw sales balance (creator only).
    pub fn withdraw_sales(env: Env, caller: Address, project_id: u64, amount: u128) {
        caller.require_auth();

        let (_, project) = Self::load_project(&env, project_id);
        assert!(project.creator == caller, "not project creator");
        assert!(amount > 0, "invalid amount");
        assert!(amount <= i128::MAX as u128, "amount exceeds i128 range");

        let mut sales: Map<u64, u128> = env
            .storage()
            .instance()
            .get(&SALES)
            .unwrap_or(Map::new(&env));
        let balance = sales.get(project_id).unwrap_or(0);
        assert!(balance >= amount, "insufficient balance");

        sales.set(
            project_id,
            balance.checked_sub(amount).expect("sales underflow"),
        );
        env.storage().instance().set(&SALES, &sales);

        let total_sales: u128 = env.storage().instance().get(&TOTAL_SALES).unwrap_or(0);
        env.storage().instance().set(
            &TOTAL_SALES,
            &total_sales
                .checked_sub(amount)
                .expect("total sales underflow"),
        );

        // ── Pay out: contract -> creator ──
        Self::token_client(&env).transfer(
            &env.current_contract_address(),
            &caller,
            &(amount as i128),
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
        names.get(project_id).unwrap_or(String::from_str(&env, ""))
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

    /// Get claimable amount for an investor, including settled rewards.
    pub fn get_claimable(env: Env, investor: Address, project_id: u64) -> u128 {
        let (_, project) = Self::load_project(&env, project_id);

        let balances: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&PENDING)
            .unwrap_or(Map::new(&env));
        let balance = balances.get((project_id, investor.clone())).unwrap_or(0);

        let reward_paid: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&REWARD_PAID)
            .unwrap_or(Map::new(&env));
        let paid = reward_paid.get((project_id, investor.clone())).unwrap_or(0);
        let reward_delta = project
            .reward_per_token_stored
            .checked_sub(paid)
            .unwrap_or(0);
        let accrued = balance
            .checked_mul(reward_delta)
            .expect("reward calc overflow")
            / PRECISION;

        let pending_claim: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&PENDING_CLAIM)
            .unwrap_or(Map::new(&env));
        let pending = pending_claim.get((project_id, investor)).unwrap_or(0);

        accrued.checked_add(pending).expect("claimable overflow")
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
        let reward_paid: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&REWARD_PAID)
            .unwrap_or(Map::new(&env));
        let pending_claims: Map<(u64, Address), u128> = env
            .storage()
            .instance()
            .get(&PENDING_CLAIM)
            .unwrap_or(Map::new(&env));

        let mut positions = Vec::new(&env);
        for pid in project_ids.iter() {
            let project = projects.get(pid).expect("project not found");
            let balance = balances.get((pid, investor.clone())).unwrap_or(0);
            let total_claimed = claimed.get((pid, investor.clone())).unwrap_or(0);
            let paid = reward_paid.get((pid, investor.clone())).unwrap_or(0);
            let delta = project
                .reward_per_token_stored
                .checked_sub(paid)
                .unwrap_or(0);
            let accrued = balance.checked_mul(delta).expect("reward calc overflow") / PRECISION;
            let pending = pending_claims.get((pid, investor.clone())).unwrap_or(0);
            let claimable = accrued.checked_add(pending).expect("claimable overflow");

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
        env.storage().instance().get(&TOTAL_SALES).unwrap_or(0)
    }

    // ========================================
    // PROJECT STATUS
    // ========================================

    /// Toggle project active status (creator only).
    pub fn set_project_status(env: Env, caller: Address, project_id: u64, active: bool) {
        caller.require_auth();

        let (mut projects, mut project) = Self::load_project(&env, project_id);
        assert!(project.creator == caller, "not project creator");

        project.active = active;
        projects.set(project_id, project);
        env.storage().instance().set(&PROJECTS, &projects);
    }

    // ========================================
    // TRANSFER OWNERSHIP
    // ========================================

    /// Transfer project ownership (creator only).
    pub fn transfer_ownership(env: Env, caller: Address, project_id: u64, new_creator: Address) {
        caller.require_auth();

        let (mut projects, mut project) = Self::load_project(&env, project_id);
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

        env.storage().instance().set(&USER_PROJECTS, &user_projects);
    }
}

// ========================================
// TESTS
// ========================================

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events as _},
        xdr, Address, Env, IntoVal, TryFromVal, Val,
    };

    /// Deploy the contract with a fresh admin and a real Stellar Asset
    /// Contract as the payment token, and mock all auths for the test.
    fn setup() -> (Env, Address, Address, NikoProjectClient<'static>) {
        let env = Env::default();
        let admin = Address::generate(&env);
        let token_admin = Address::generate(&env);
        let sac = env.register_stellar_asset_contract_v2(token_admin);
        let token_address = sac.address();

        let contract_id = env.register(NikoProject, (&admin, &token_address));
        let client = NikoProjectClient::new(&env, &contract_id);

        env.mock_all_auths();

        (env, admin, token_address, client)
    }

    /// Mint `amount` of the test payment token to `to`.
    fn mint(env: &Env, token_address: &Address, to: &Address, amount: i128) {
        token::StellarAssetClient::new(env, token_address).mint(to, &amount);
    }

    #[test]
    fn test_constructor() {
        let (_env, admin, token_address, client) = setup();
        assert_eq!(client.get_admin(), admin);
        assert_eq!(client.get_token(), token_address);
        assert_eq!(client.next_project_id(), 1);
    }

    #[test]
    fn test_create_project() {
        let (env, admin, _token_address, client) = setup();

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
        let (env, admin, token_address, client) = setup();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        let buyer = Address::generate(&env);
        mint(&env, &token_address, &buyer, 1_000_000);

        let token_client = token::TokenClient::new(&env, &token_address);
        let buyer_before = token_client.balance(&buyer);
        let contract_before = token_client.balance(&client.address);

        client.purchase_tokens(&buyer, &project_id, &50);

        let project = client.get_project(&project_id);
        assert_eq!(project.minted, 50);

        // price(100) * amount(50) = 5000 moved from buyer to contract
        assert_eq!(token_client.balance(&buyer), buyer_before - 5000);
        assert_eq!(
            token_client.balance(&client.address),
            contract_before + 5000
        );
    }

    #[test]
    fn test_purchase_tokens_emits_one_purchase_event() {
        let (env, admin, token_address, client) = setup();
        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );
        let buyer = Address::generate(&env);
        mint(&env, &token_address, &buyer, 1_000_000);

        client.purchase_tokens(&buyer, &project_id, &50);

        let events = env.events().all().filter_by_contract(&client.address);
        assert_eq!(events.events().len(), 1);
        let event = &events.events()[0];
        let xdr::ContractEventBody::V0(body) = event.body.clone();
        let purchase_topic: Val = symbol_short!("purchase").into_val(&env);
        let buyer_topic: Val = buyer.clone().into_val(&env);
        let project_id_value: Val = project_id.into_val(&env);
        assert_eq!(
            body.topics.get(0),
            Some(&xdr::ScVal::try_from_val(&env, &purchase_topic).unwrap())
        );
        assert_eq!(
            body.topics.get(1),
            Some(&xdr::ScVal::try_from_val(&env, &buyer_topic).unwrap())
        );
        let xdr::ScVal::Vec(Some(data)) = body.data else {
            panic!("purchase event data must be a vector");
        };
        assert_eq!(data.len(), 2);
        assert_eq!(
            data.get(0),
            Some(&xdr::ScVal::try_from_val(&env, &project_id_value).unwrap())
        );
        let amount_data: Val = 50u128.into_val(&env);
        assert_eq!(
            data.get(1),
            Some(&xdr::ScVal::try_from_val(&env, &amount_data).unwrap())
        );
    }

    #[test]
    #[should_panic]
    fn test_purchase_tokens_insufficient_balance() {
        let (env, admin, _token_address, client) = setup();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        // Buyer never minted any token balance, so the transfer must fail.
        let buyer = Address::generate(&env);
        client.purchase_tokens(&buyer, &project_id, &50);
    }

    #[test]
    #[should_panic(expected = "project not found")]
    fn test_purchase_tokens_unknown_project_panics() {
        let (env, _admin, token_address, client) = setup();

        let buyer = Address::generate(&env);
        mint(&env, &token_address, &buyer, 1_000_000);

        // No project has ever been created: proves there is no auto-create.
        client.purchase_tokens(&buyer, &999, &50);
    }

    #[test]
    fn test_deposit_revenue() {
        let (env, admin, token_address, client) = setup();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        let buyer = Address::generate(&env);
        mint(&env, &token_address, &buyer, 1_000_000);
        client.purchase_tokens(&buyer, &project_id, &100);

        mint(&env, &token_address, &admin, 1_000_000);
        let token_client = token::TokenClient::new(&env, &token_address);
        let depositor_before = token_client.balance(&admin);
        let contract_before = token_client.balance(&client.address);

        client.deposit_revenue(&admin, &project_id, &5000, &100);

        let project = client.get_project(&project_id);
        assert!(project.reward_per_token_stored > 0);
        assert_eq!(project.total_energy_kwh, 100);

        assert_eq!(token_client.balance(&admin), depositor_before - 5000);
        assert_eq!(
            token_client.balance(&client.address),
            contract_before + 5000
        );
    }

    #[test]
    #[should_panic(expected = "not project creator")]
    fn test_deposit_revenue_non_creator_panics() {
        let (env, admin, token_address, client) = setup();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        let buyer = Address::generate(&env);
        mint(&env, &token_address, &buyer, 1_000_000);
        client.purchase_tokens(&buyer, &project_id, &100);

        // buyer is not the project creator
        mint(&env, &token_address, &buyer, 1_000_000);
        client.deposit_revenue(&buyer, &project_id, &5000, &100);
    }

    #[test]
    #[should_panic(expected = "no tokens minted")]
    fn test_deposit_revenue_no_minted_panics() {
        let (env, admin, token_address, client) = setup();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        mint(&env, &token_address, &admin, 1_000_000);
        client.deposit_revenue(&admin, &project_id, &5000, &100);
    }

    #[test]
    fn test_claim_revenue() {
        let (env, admin, token_address, client) = setup();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        let buyer = Address::generate(&env);
        mint(&env, &token_address, &buyer, 1_000_000);
        client.purchase_tokens(&buyer, &project_id, &100);

        mint(&env, &token_address, &admin, 1_000_000);
        client.deposit_revenue(&admin, &project_id, &10000, &200);

        let claimable = client.get_claimable(&buyer, &project_id);
        assert!(claimable > 0);

        let token_client = token::TokenClient::new(&env, &token_address);
        let buyer_before = token_client.balance(&buyer);

        let claimed = client.claim_revenue(&buyer, &project_id);
        assert!(claimed > 0);
        assert_eq!(claimed, claimable);
        assert_eq!(token_client.balance(&buyer), buyer_before + claimed as i128);
    }

    /// Regression test: a buyer who purchases AFTER a revenue deposit has
    /// already happened must not be able to claim any share of that
    /// earlier deposit.
    #[test]
    fn test_late_buyer_gets_no_share_of_earlier_deposit() {
        let (env, admin, token_address, client) = setup();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        // Early buyer purchases first.
        let early_buyer = Address::generate(&env);
        mint(&env, &token_address, &early_buyer, 1_000_000);
        client.purchase_tokens(&early_buyer, &project_id, &100);

        // Revenue is deposited while only the early buyer holds tokens.
        mint(&env, &token_address, &admin, 1_000_000);
        client.deposit_revenue(&admin, &project_id, &10000, &200);

        // Late buyer purchases AFTER the deposit.
        let late_buyer = Address::generate(&env);
        mint(&env, &token_address, &late_buyer, 1_000_000);
        client.purchase_tokens(&late_buyer, &project_id, &100);

        // The late buyer must have zero claimable from the earlier deposit.
        let late_claimable = client.get_claimable(&late_buyer, &project_id);
        assert_eq!(late_claimable, 0);

        let late_claimed = client.claim_revenue(&late_buyer, &project_id);
        assert_eq!(late_claimed, 0);

        // The early buyer still gets their full share.
        let early_claimable = client.get_claimable(&early_buyer, &project_id);
        assert!(early_claimable > 0);
    }

    #[test]
    fn test_repeat_buyer_preserves_accrued_reward_when_balance_increases() {
        let (env, admin, token_address, client) = setup();
        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        let buyer = Address::generate(&env);
        mint(&env, &token_address, &buyer, 1_000_000);
        client.purchase_tokens(&buyer, &project_id, &100);

        mint(&env, &token_address, &admin, 1_000_000);
        client.deposit_revenue(&admin, &project_id, &10000, &200);

        // A second purchase settles the first balance's 10,000 reward before
        // adding the new tokens; the new tokens cannot double-claim it.
        client.purchase_tokens(&buyer, &project_id, &100);
        assert_eq!(client.get_claimable(&buyer, &project_id), 10000);

        let token_client = token::TokenClient::new(&env, &token_address);
        let buyer_before = token_client.balance(&buyer);
        assert_eq!(client.claim_revenue(&buyer, &project_id), 10000);
        assert_eq!(token_client.balance(&buyer), buyer_before + 10000);
    }

    #[test]
    fn test_withdraw_sales() {
        let (env, admin, token_address, client) = setup();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        let buyer = Address::generate(&env);
        mint(&env, &token_address, &buyer, 1_000_000);
        client.purchase_tokens(&buyer, &project_id, &100);

        let sales_balance = client.get_sales_balance(&project_id);
        assert_eq!(sales_balance, 10000);

        let token_client = token::TokenClient::new(&env, &token_address);
        let admin_before = token_client.balance(&admin);

        client.withdraw_sales(&admin, &project_id, &5000);
        assert_eq!(client.get_sales_balance(&project_id), 5000);
        assert_eq!(token_client.balance(&admin), admin_before + 5000);
    }

    #[test]
    #[should_panic(expected = "not project creator")]
    fn test_withdraw_sales_non_creator_panics() {
        let (env, admin, token_address, client) = setup();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        let buyer = Address::generate(&env);
        mint(&env, &token_address, &buyer, 1_000_000);
        client.purchase_tokens(&buyer, &project_id, &100);

        client.withdraw_sales(&buyer, &project_id, &1000);
    }

    #[test]
    #[should_panic(expected = "insufficient balance")]
    fn test_withdraw_sales_over_withdraw_panics() {
        let (env, admin, token_address, client) = setup();

        let project_id = client.create_project(
            &admin,
            &String::from_str(&env, "Solar Lima"),
            &1000,
            &100,
            &10,
        );

        let buyer = Address::generate(&env);
        mint(&env, &token_address, &buyer, 1_000_000);
        client.purchase_tokens(&buyer, &project_id, &100);

        client.withdraw_sales(&admin, &project_id, &999_999_999);
    }

    #[test]
    fn test_user_projects() {
        let (env, admin, _token_address, client) = setup();

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
