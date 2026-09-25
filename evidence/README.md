# NIKO SUN public evidence

This directory is the review path for the public Stellar Testnet snapshot exposed at `/proof`.

## Quick path

1. Confirm the [contract deployment](deployment.md), source commit, WASM hash, and snapshot ledger.
2. Check the [project, purchases, contract inflows, and claims](transactions.md).
3. Compare [holder-indexer reconciliation](testnet-e2e.md) with contract state.
4. Validate machine-readable values in [`contract-state.json`](contract-state.json).
5. Open the in-app [public proof page](../frontend/app/proof/page.tsx).

## Evidence rules

- This is a historical snapshot at ledger `4856253`; the live Testnet chain may have advanced since observation.
- On-chain values are labeled as observed Testnet state.
- Native XLM is converted from stroops with seven decimal places and bigint-safe arithmetic.
- Estimates and demo telemetry do not feed verified totals.
- C remains claimable; no claim transaction is recorded for C.
- Three post-snapshot projects (IDs `2`-`4`) are registered on-chain and intentionally excluded from the historical totals; see [transactions.md](transactions.md).
- Live mutation semantics and project-ID isolation are documented in the repository [README](../README.md#live-state-semantics).
- Total contract inflows combine sales and deposits; they are not the claimable balance.
- The GitHub Actions workflow is billing-blocked, so this pack does not claim CI success.
- This evidence is not an audit, legal opinion, physical-asset title, or yield guarantee.

## Snapshot identity

- Network: `Stellar Testnet`
- Source commit: `1400127`
- Observed on: `2026-09-24` (date precision)
- Snapshot ledger: `4856253`
- Contract: `CAW37S6RDQCRCHUBMFG4KMMZHSNI6AD5AR5MG5OQS76J7FU7JUDR3UAK`
