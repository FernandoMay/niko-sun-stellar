# Public transaction evidence

All amounts below use exact base units. Stellar native XLM uses seven decimal places, so `10000000` stroops equals `1.0000000 XLM`.

## Project creation

| ID | Transaction | Ledger | Result |
|---:|---|---:|---|
| `1` | [`e3f84fac…bdef`](https://stellar.expert/explorer/testnet/tx/e3f84facfdadd6ee422170d31da8411caeadc6312b87e89e1cdbf48ecb8cbdef) | `4855673` | Created **Solar Lima Miraflores** |

Project state: active; supply `100000`; price `10000000` stroops (`1.0000000 XLM`); minimum `1`; minted `4`; sales balance `40000000` stroops (`4.0000000 XLM`); total contract inflows (sales + deposits) `41000000` stroops (`4.1000000 XLM`); energy `0`; reward index `250000000000000000000000`. The `41000000` total is not claimable revenue; claimable balances are listed below.

## Purchases

| Event | Buyer | Tokens | Amount | Transaction | Ledger |
|---|---|---:|---:|---|---:|
| A1 | `GASERV…LQB4G` | `1` | `1.0000000 XLM` | [`060bc82e…b9a4`](https://stellar.expert/explorer/testnet/tx/060bc82e3fd471ae99c097cc7a2492a0188249c765f6defb6b85d13318aab9a4) | `4855730` |
| A2 | `GASERV…LQB4G` | `1` | `1.0000000 XLM` | [`c0773762…8a9df`](https://stellar.expert/explorer/testnet/tx/c07737620af3337b278c855b935c1215362288c655251bc5d58589e081a8a9df) | `4855852` |
| B | `GA7PBY…RKHW` | `1` | `1.0000000 XLM` | [`fbbdef21…62230`](https://stellar.expert/explorer/testnet/tx/fbbdef21f990cd8450067ab1396e0fec69b28012eef6c8a77bd805fceb962230) | `4855862` |
| C | `GABGH3…N3TX` | `1` | `1.0000000 XLM` | [`af78b46a…44c7`](https://stellar.expert/explorer/testnet/tx/af78b46a2b0414b93909ab0b4272c0b87d69c4af24a7c655c4f3e75f4c2b44c7) | `4855998` |

## Contract inflows and claims

The total contract inflow includes the sales balance and explicit creator deposits; it is not a claimable revenue balance. A creator deposited `1000000` stroops (`0.1000000 XLM`) at ledger `4856239`: [`569cd5a4…490a8`](https://stellar.expert/explorer/testnet/tx/569cd5a407f32394cffb345c25af110fa36a53426c8e207bfbbae67c8b2490a8).

| Holder | Final status | Paid | Claimable | Transaction | Ledger |
|---|---|---:|---:|---|---:|
| A | Claimed | `0.0500000 XLM` | `0.0000000 XLM` | [`1643d8ba…2800`](https://stellar.expert/explorer/testnet/tx/1643d8babc99cc2289f288b0672c8f72b60453059dd2fa271379f9f466f82800) | `4856247` |
| B | Claimed | `0.0250000 XLM` | `0.0000000 XLM` | [`200b4f7d…7df0e`](https://stellar.expert/explorer/testnet/tx/200b4f7d159d21cdebf06ab750510098b0d8168aec5145dadc83df454b87df0e) | `4856253` |
| C | **Claimable** | `0.0000000 XLM` | `0.0250000 XLM` | No claim transaction | — |

C must not be labeled as claimed.
