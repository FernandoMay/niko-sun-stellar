# NIKO SUN — Solar Project Settlement on Stellar Testnet

> Buy project tokens with native XLM and claim creator-deposited revenue through a Soroban contract.

**Built for Stellar Odyssey Perú 2026** — Track 03: Real-World Assets & Compliant Rails

## 🌞 What is NIKO SUN?

NIKO SUN is a Stellar Soroban prototype for project-token purchases and proportional revenue claims. The current public proof is limited to the observed Testnet deployment and transaction state.

- **Explore** projects from on-chain project views
- **Purchase** project tokens with native XLM
- **Claim** revenue explicitly deposited by a project creator
- **Reconcile** purchase events against contract-minted supply

The interface does not claim verified physical generation, legal title, audited IoT telemetry, fiat valuation, or guaranteed yield. See [`evidence/`](evidence/README.md) and `/proof` for the public record.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│  Frontend (Next.js + Stellar SDK)           │
│  Freighter signatures and contract views    │
├─────────────────────────────────────────────┤
│  Smart Contract (Soroban / Rust)            │
│  • Project state and creator ownership      │
│  • Native-XLM token purchases               │
│  • Explicit creator revenue deposits        │
│  • Proportional holder claims               │
├─────────────────────────────────────────────┤
│  Stellar Testnet                            │
│  • Public contract and transaction records  │
│  • Holder-event indexer reconciliation      │
└─────────────────────────────────────────────┘
```

## 📦 Project Structure

```
niko-sun-stellar/
├── contracts/
│   └── niko_project/
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs          # Soroban smart contract
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Landing page
│   │   ├── dashboard/page.tsx  # On-chain portfolio and admin views
│   │   ├── proof/page.tsx      # Public evidence page
│   │   └── project/[id]/page.tsx  # On-chain project detail
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Hero.tsx
│   │   ├── StatsBar.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── FeaturedProjects.tsx
│   │   ├── TechArchitecture.tsx
│   │   ├── Footer.tsx
│   │   └── WalletButton.tsx    # Freighter integration
│   ├── globals.css
│   └── package.json
├── evidence/                     # Public Testnet proof pack
├── scripts/
│   └── deploy.sh               # Testnet deployment
├── .github/workflows/ci.yml    # CI/CD
└── Cargo.toml                  # Workspace
```

## 🚀 Quick Start

### Prerequisites

- [Rust](https://rustup.rs/) with `wasm32v1-none` target
- [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup)
- [Node.js](https://nodejs.org/) 20+
- [Freighter](https://freighter.app/) browser extension

### Smart Contract

```bash
# Install Stellar CLI
cargo install --locked stellar-cli

# Add wasm target
rustup target add wasm32v1-none

# Build contract
cd contracts/niko_project
cargo build --target wasm32v1-none --release

# Run tests
cargo test

# Deploy to testnet
cd ../..
./scripts/deploy.sh testnet
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your contract ID
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🔑 Smart Contract Features

| Function | Description |
|----------|-------------|
| `__constructor()` | Bind the administrator and native XLM payment token at deployment |
| `create_project()` | Create a new solar project |
| `purchase_tokens()` | Buy project tokens with XLM |
| `deposit_revenue()` | Deposit energy revenue for distribution |
| `claim_revenue()` | Claim pending revenue |
| `withdraw_sales()` | Creator withdraws sales balance |
| `update_energy()` | Update energy generation data |
| `get_project()` | Read project details |
| `get_claimable()` | Check claimable revenue |
| `get_portfolio()` | Get investor portfolio |

## Live state semantics

The values shown by the dashboard are protocol state, not seeded UI data. A failed or incomplete transaction does not partially mutate the contract.

| Operation | State that changes | State that does not change |
|---|---|---|
| `create_project` | Stores the name, supply, price, minimum purchase, active flag, creator, and zeroed financial/energy fields | No tokens are minted and no XLM moves |
| Successful `purchase_tokens` | Increments `minted`, project `total_revenue`, `sales_balance`, the buyer's project balance, and emits a `purchase` event | Does not create a claim or change energy |
| Successful `deposit_revenue` | Transfers creator XLM, increments `total_revenue`, updates the reward-per-token index, and optionally adds the supplied energy delta | Does not increase `minted` or `sales_balance` |
| `update_energy` | Adds the creator-authorized energy delta | Does not move XLM or create revenue |
| Successful `claim_revenue` | Reduces the holder's pending claim and records the amount claimed | Does not change project supply, sales, revenue, or energy |
| `withdraw_sales` | Reduces the creator's `sales_balance` and the global sales total | Does not change `minted`, `total_revenue`, or energy |

For native XLM, `10000000` stroops equals `1.0000000 XLM`. The dashboard uses bigint-safe values and shows `Unavailable` or an incomplete state when a required RPC read fails; it never substitutes zero for an unknown read.

## Project isolation and route matrix

Project discovery is driven by `next_project_id - 1`. Every project read and holder claim is keyed by its `project_id`; state from one project is never reused as a fallback for another.

| Route | Contract behavior | UI boundary |
|---|---|---|
| `/project/1` | Reads project `1` and its live views | Active demo project with historical proof |
| `/project/2` | Reads project `2` | Live project; starts with real zero activity until a transaction occurs |
| `/project/3` | Reads project `3` | Live project; starts with real zero activity until a transaction occurs |
| `/project/4` | Reads project `4` | Live project; starts with real zero activity until a transaction occurs |
| `/project/999` | No project record | Static export returns a real `404` |

The current registered projects are:

| ID | Name | Supply | Price | Minimum |
|---:|---|---:|---:|---:|
| `1` | Solar Lima Miraflores | `100000` | `1.0000000 XLM` | `1` |
| `2` | Solar Lima Norte | `15` | `1.0000000 XLM` | `1` |
| `3` | Solar Arequipa | `20` | `1.0000000 XLM` | `1` |
| `4` | Solar San Martín | `10` | `1.0000000 XLM` | `1` |

Projects `2`-`4` were created after the immutable `/proof` snapshot. Their registration transactions and initial zero state are recorded in [`evidence/transactions.md`](evidence/transactions.md); they are intentionally not retroactively included in the historical proof totals.

## Snapshot versus live state

- `/dashboard`, project pages, and the landing verification read the chain at runtime.
- `/proof` is an immutable historical snapshot at ledger `4856253`, observed on `2026-09-24`.
- The proof page may differ from the dashboard after later successful transactions; that difference is expected and must not be hidden.
- See [`evidence/README.md`](evidence/README.md) for the evidence boundary and [`evidence/transactions.md`](evidence/transactions.md) for post-snapshot registrations.

### Live read verification

With the Stellar CLI configured for Testnet, verify any project directly without trusting the UI:

```bash
stellar contract invoke \
  --id CAW37S6RDQCRCHUBMFG4KMMZHSNI6AD5AR5MG5OQS76J7FU7JUDR3UAK \
  --source-account niko_deployer \
  --network testnet \
  --send=no \
  -- get_project --project_id 2
```

Repeat with `--project_id 3` and `--project_id 4`. The returned `minted`, `total_revenue`, `total_energy_kwh`, and `sales_balance` are the current protocol values; a successful transaction is the only thing that changes them.

## 🎨 Design System

- **Primary**: Emerald (#059669)
- **Secondary**: Orange (#ea580c)
- **Tertiary**: Amber (#d97706)
- **Fonts**: Geist (display), Inter (body), JetBrains Mono (data)
- **Icons**: Material Symbols Rounded

## 📊 Revenue Distribution Pattern

NIKO SUN uses a **proportional revenue distribution** pattern (inspired by Synthetix):

1. Revenue is deposited with `deposit_revenue()`
2. `rewardPerTokenStored` increases proportionally
3. Each holder's claimable = `balance × (rewardPerToken - rewardPaid)`
4. Claims are independent of deposit timing

## 🔒 Evidence and security boundary

- Address-based authentication via `require_auth()`
- Project creator-only revenue and administrative functions
- Holder balances reconcile against contract-minted supply
- The public Testnet evidence is not an external audit or legal opinion
- Physical-asset metadata and off-chain telemetry are not represented as verified unless added to the evidence pack

## 📄 License

MIT

## 🙏 Acknowledgments

- [Stellar Development Foundation](https://stellar.org)
- [Soroban](https://soroban.stellar.org)
- [Freighter](https://freighter.app)
- Original NIKO SUN EVM contracts by [NIKOSUN-ORG](https://github.com/NIKOSUN-ORG)

---

Built with ☀️ for Stellar Odyssey Perú 2026
