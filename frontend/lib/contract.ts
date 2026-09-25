// Final Testnet deployment: constructor-bound native XLM settlement + purchase events.
// Contract: CAW37S6RDQCRCHUBMFG4KMMZHSNI6AD5AR5MG5OQS76J7FU7JUDR3UAK
// Deployment TX: e5ae473e9bd2dc33945a892101b4d4a588f69ad9c2199cec85f211acaa59b783 (ledger 4855641)
// Project TX: e3f84facfdadd6ee422170d31da8411caeadc6312b87e89e1cdbf48ecb8cbdef (ledger 4855673)
// WASM: f86d3f5caa3c9c539bb86db1bfe8ebe89388a35d6591fa3ba63f1f97f4291077
const FINAL_CONTRACT_ID =
  "CAW37S6RDQCRCHUBMFG4KMMZHSNI6AD5AR5MG5OQS76J7FU7JUDR3UAK";
const FINAL_DEPLOYMENT_LEDGER = 4855641;
const LEGACY_CONTRACT_IDS = new Set([
  "CDVT6PV536ALTEEXCAVWASGUOG5PHUJCA2WTVWYPZI5Z5KKTECCL6GY4",
  "CB7V3676CQBO5OL6DEXI5FORLG37IR2GR7LXCZD7DUZTMSUT7BEEINR3",
  "CCKZROKNAMQSXK3MEYDB6SBXFZZXES75NIFUULH2JVV4JJDXLL5XGEDJ",
]);
const configuredContractId = process.env.NEXT_PUBLIC_CONTRACT_ID?.trim();
const usesFinalDeployment =
  !configuredContractId || LEGACY_CONTRACT_IDS.has(configuredContractId);

export const CONTRACT_ID =
  configuredContractId && !LEGACY_CONTRACT_IDS.has(configuredContractId)
    ? configuredContractId
    : FINAL_CONTRACT_ID;

// Populated only from a verified deployment receipt; invalid values fail closed.
const deploymentLedgerEnv = process.env.NEXT_PUBLIC_CONTRACT_DEPLOYMENT_LEDGER;
const deploymentLedger =
  typeof deploymentLedgerEnv === "string" && /^\d+$/.test(deploymentLedgerEnv)
    ? Number(deploymentLedgerEnv)
    : null;
const validDeploymentLedger =
  deploymentLedger !== null &&
  Number.isSafeInteger(deploymentLedger) &&
  deploymentLedger > 0;

export const CONTRACT_DEPLOYMENT_LEDGER: number | null = validDeploymentLedger
  ? deploymentLedger
  : usesFinalDeployment
    ? FINAL_DEPLOYMENT_LEDGER
    : null;
export const EXPLORER_URL = `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`;
export const LEDGER_EXPLORER_URL = "https://stellar.expert/explorer/testnet/ledger";
export const HOLDER_EXPLORER_URL = EXPLORER_URL;
export const TX_EXPLORER = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const HOLDER_EXPLORER = (address: string) =>
  `https://stellar.expert/explorer/testnet/account/${address}`;
