// Fallback is the v2 contract deployed with initialize. Replace when redeploying the constructor-based contract of feat/xlm-payments.
export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID ||
  "CB7V3676CQBO5OL6DEXI5FORLG37IR2GR7LXCZD7DUZTMSUT7BEEINR3";
// Populated only from a verified deployment receipt; invalid values fail closed.
const deploymentLedgerEnv = process.env.NEXT_PUBLIC_CONTRACT_DEPLOYMENT_LEDGER;
const deploymentLedger =
  typeof deploymentLedgerEnv === "string" && /^\d+$/.test(deploymentLedgerEnv)
    ? Number(deploymentLedgerEnv)
    : null;

export const CONTRACT_DEPLOYMENT_LEDGER: number | null =
  deploymentLedger !== null &&
  Number.isSafeInteger(deploymentLedger) &&
  deploymentLedger > 0
    ? deploymentLedger
    : null;
export const EXPLORER_URL = `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`;
export const LEDGER_EXPLORER_URL = "https://stellar.expert/explorer/testnet/ledger";
export const HOLDER_EXPLORER_URL = EXPLORER_URL;
export const TX_EXPLORER = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const HOLDER_EXPLORER = (address: string) =>
  `https://stellar.expert/explorer/testnet/account/${address}`;
