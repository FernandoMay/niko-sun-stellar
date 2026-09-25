export type PublicEvidence = {
  schemaVersion: 1;
  network: "Stellar Testnet";
  sourceCommit: "1400127";
  sourceUrl: string;
  observedAt: "2026-09-24";
  observedAtPrecision: "date";
  snapshotLedger: number;
  contract: {
    id: string;
    explorerUrl: string;
    deploymentTxHash: string;
    deploymentTxUrl: string;
    deploymentLedger: number;
    wasmSha256: string;
    optimizedWasmBytes: number;
  };
  project: {
    id: number;
    name: string;
    creator: string;
    active: boolean;
    totalSupply: string;
    priceStroops: string;
    minPurchase: string;
    minted: string;
    salesBalanceStroops: string;
    totalRevenueStroops: string;
    energyKwh: string;
    rewardPerTokenStored: string;
  };
  purchases: Array<{
    id: string;
    buyer: string;
    tokenAmount: string;
    priceStroops: string;
    txHash: string;
    txUrl: string;
    ledger: number;
  }>;
  revenue: {
    depositTxHash: string;
    depositTxUrl: string;
    depositLedger: number;
    amountStroops: string;
  };
  claims: Array<{
    holder: "A" | "B" | "C";
    address: string;
    status: "claimed" | "claimable";
    paidStroops: string;
    claimableStroops: string;
    txHash: string | null;
    txUrl: string | null;
    ledger: number | null;
  }>;
  indexer: {
    purchaseEvents: string;
    uniqueHolders: string;
    indexedTokenTotal: string;
    contractMinted: string;
    reconciled: true;
  };
  ledgerExplorerUrl: string;
  notes: {
    valueBasis:
      "Observed on-chain Testnet state; total contract inflows include sales + deposits, not claimable revenue.";
    historicalSnapshot: "Historical snapshot; live Testnet state may be newer.";
    cClaimStatus: "C remains claimable; no claim transaction is recorded.";
    telemetry: "Demo telemetry and estimates are excluded from this snapshot.";
  };
};

const TESTNET_EXPLORER = "https://stellar.expert/explorer/testnet";
const CONTRACT_ID =
  "CAW37S6RDQCRCHUBMFG4KMMZHSNI6AD5AR5MG5OQS76J7FU7JUDR3UAK";
const SOURCE_COMMIT = "14001277497245b16bb472e07218af1988d210b9";

export const PUBLIC_EVIDENCE = {
  schemaVersion: 1,
  network: "Stellar Testnet",
  sourceCommit: "1400127",
  sourceUrl: `https://github.com/FernandoMay/niko-sun-stellar/commit/${SOURCE_COMMIT}`,
  observedAt: "2026-09-24",
  observedAtPrecision: "date",
  snapshotLedger: 4856253,
  contract: {
    id: CONTRACT_ID,
    explorerUrl: `${TESTNET_EXPLORER}/contract/${CONTRACT_ID}`,
    deploymentTxHash:
      "e5ae473e9bd2dc33945a892101b4d4a588f69ad9c2199cec85f211acaa59b783",
    deploymentTxUrl: `${TESTNET_EXPLORER}/tx/e5ae473e9bd2dc33945a892101b4d4a588f69ad9c2199cec85f211acaa59b783`,
    deploymentLedger: 4855641,
    wasmSha256:
      "f86d3f5caa3c9c539bb86db1bfe8ebe89388a35d6591fa3ba63f1f97f4291077",
    optimizedWasmBytes: 17446,
  },
  project: {
    id: 1,
    name: "Solar Lima Miraflores",
    creator: "GASERVWNLHAWMG6V5NBL5EGYFKOOZDQYSUUW7REMJRET5JNZWWQLQB4G",
    active: true,
    totalSupply: "100000",
    priceStroops: "10000000",
    minPurchase: "1",
    minted: "4",
    salesBalanceStroops: "40000000",
    totalRevenueStroops: "41000000",
    energyKwh: "0",
    rewardPerTokenStored: "250000000000000000000000",
  },
  purchases: [
    {
      id: "A1",
      buyer: "GASERVWNLHAWMG6V5NBL5EGYFKOOZDQYSUUW7REMJRET5JNZWWQLQB4G",
      tokenAmount: "1",
      priceStroops: "10000000",
      txHash: "060bc82e3fd471ae99c097cc7a2492a0188249c765f6defb6b85d13318aab9a4",
      txUrl: `${TESTNET_EXPLORER}/tx/060bc82e3fd471ae99c097cc7a2492a0188249c765f6defb6b85d13318aab9a4`,
      ledger: 4855730,
    },
    {
      id: "A2",
      buyer: "GASERVWNLHAWMG6V5NBL5EGYFKOOZDQYSUUW7REMJRET5JNZWWQLQB4G",
      tokenAmount: "1",
      priceStroops: "10000000",
      txHash: "c07737620af3337b278c855b935c1215362288c655251bc5d58589e081a8a9df",
      txUrl: `${TESTNET_EXPLORER}/tx/c07737620af3337b278c855b935c1215362288c655251bc5d58589e081a8a9df`,
      ledger: 4855852,
    },
    {
      id: "B",
      buyer: "GA7PBYLH364F7BIMAKCTFTDYMF736WJNA5AFLJMI6CLX4J5BLBTCRKHW",
      tokenAmount: "1",
      priceStroops: "10000000",
      txHash: "fbbdef21f990cd8450067ab1396e0fec69b28012eef6c8a77bd805fceb962230",
      txUrl: `${TESTNET_EXPLORER}/tx/fbbdef21f990cd8450067ab1396e0fec69b28012eef6c8a77bd805fceb962230`,
      ledger: 4855862,
    },
    {
      id: "C",
      buyer: "GABGH363YQNYYAUN2M6YAPYFLPDMU5GZIJDWOEC2G3AUEH3TLPSXN3TX",
      tokenAmount: "1",
      priceStroops: "10000000",
      txHash: "af78b46a2b0414b93909ab0b4272c0b87d69c4af24a7c655c4f3e75f4c2b44c7",
      txUrl: `${TESTNET_EXPLORER}/tx/af78b46a2b0414b93909ab0b4272c0b87d69c4af24a7c655c4f3e75f4c2b44c7`,
      ledger: 4855998,
    },
  ],
  revenue: {
    depositTxHash:
      "569cd5a407f32394cffb345c25af110fa36a53426c8e207bfbbae67c8b2490a8",
    depositTxUrl: `${TESTNET_EXPLORER}/tx/569cd5a407f32394cffb345c25af110fa36a53426c8e207bfbbae67c8b2490a8`,
    depositLedger: 4856239,
    amountStroops: "1000000",
  },
  claims: [
    {
      holder: "A",
      address: "GASERVWNLHAWMG6V5NBL5EGYFKOOZDQYSUUW7REMJRET5JNZWWQLQB4G",
      status: "claimed",
      paidStroops: "500000",
      claimableStroops: "0",
      txHash:
        "1643d8babc99cc2289f288b0672c8f72b60453059dd2fa271379f9f466f82800",
      txUrl: `${TESTNET_EXPLORER}/tx/1643d8babc99cc2289f288b0672c8f72b60453059dd2fa271379f9f466f82800`,
      ledger: 4856247,
    },
    {
      holder: "B",
      address: "GA7PBYLH364F7BIMAKCTFTDYMF736WJNA5AFLJMI6CLX4J5BLBTCRKHW",
      status: "claimed",
      paidStroops: "250000",
      claimableStroops: "0",
      txHash:
        "200b4f7d159d21cdebf06ab750510098b0d8168aec5145dadc83df454b87df0e",
      txUrl: `${TESTNET_EXPLORER}/tx/200b4f7d159d21cdebf06ab750510098b0d8168aec5145dadc83df454b87df0e`,
      ledger: 4856253,
    },
    {
      holder: "C",
      address: "GABGH363YQNYYAUN2M6YAPYFLPDMU5GZIJDWOEC2G3AUEH3TLPSXN3TX",
      status: "claimable",
      paidStroops: "0",
      claimableStroops: "250000",
      txHash: null,
      txUrl: null,
      ledger: null,
    },
  ],
  indexer: {
    purchaseEvents: "4",
    uniqueHolders: "3",
    indexedTokenTotal: "4",
    contractMinted: "4",
    reconciled: true,
  },
  ledgerExplorerUrl: `${TESTNET_EXPLORER}/ledger/${4856253}`,
  notes: {
    valueBasis:
      "Observed on-chain Testnet state; total contract inflows include sales + deposits, not claimable revenue.",
    historicalSnapshot: "Historical snapshot; live Testnet state may be newer.",
    cClaimStatus:
      "C remains claimable; no claim transaction is recorded.",
    telemetry: "Demo telemetry and estimates are excluded from this snapshot.",
  },
} as const satisfies PublicEvidence;
