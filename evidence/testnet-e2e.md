# Testnet end-to-end evidence

## Result

The bounded local WSL Stellar Testnet E2E passed against the public deployment recorded in this evidence pack. The scenario covered project creation, four purchases, native-XLM settlement, one explicit contract-inflow deposit, two proportional claims, and holder-indexer reconciliation.

The prepared GitHub Actions workflow is **billing-blocked and has not passed CI**. No CI success is claimed here.

## Final reconciliation

| Check | Observed result |
|---|---|
| Network | Stellar Testnet |
| Purchase events | `4` |
| Unique holders | `3` |
| Indexed token total | `4` |
| Contract minted total | `4` |
| Reconciled | `true` |
| Snapshot ledger | [`4856253`](https://stellar.expert/explorer/testnet/ledger/4856253) |

Holder distribution:

- Holder A owns `2` tokens.
- Holder B owns `1` token.
- Holder C owns `1` token and remains claimable for `250000` stroops (`0.0250000 XLM`).

## Evidence boundary

The E2E result proves the recorded Testnet transaction and reconciliation scenario. It does not prove physical-asset ownership, legal enforceability, off-chain telemetry, audited generation, guaranteed yield, or mainnet readiness. Demo telemetry is excluded from the verified totals.
