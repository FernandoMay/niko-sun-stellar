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
