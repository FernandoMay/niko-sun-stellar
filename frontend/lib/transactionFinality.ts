export type PolledTransaction = {
  status: "SUCCESS";
  result?: unknown;
};

const FINALITY_ERROR = "Transaction finality was not confirmed.";

/**
 * Fail closed unless the RPC has returned a successful transaction record.
 * Callers must not treat a submitted transaction hash as confirmation.
 */
export function requireSuccessfulTransaction(value: unknown): PolledTransaction {
  if (
    value === null ||
    typeof value !== "object" ||
    (value as { status?: unknown }).status !== "SUCCESS"
  ) {
    throw new Error(FINALITY_ERROR);
  }

  return value as PolledTransaction;
}
