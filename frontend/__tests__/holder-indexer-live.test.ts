import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getHolderCount, type HolderMetrics } from "../lib/holderIndexer";
import { CONTRACT_DEPLOYMENT_LEDGER, CONTRACT_ID } from "../lib/contract";

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 45_000;
const TEST_TIMEOUT_MS = 60_000;
const DECIMAL_INTEGER = /^(0|[1-9]\d*)$/;
const SAFE_STAGE = /^[a-z0-9_]+$/;
const LIVE_TEST_REQUESTED = process.env.LIVE_HOLDER_TEST === "true";

type ObservedMetrics = {
  contractMinted: string;
  holderCount: number | null;
  reconciled: boolean;
  status: HolderMetrics["status"];
  warning: string;
};

type ExpectedMetrics = {
  contractMinted: bigint;
  holderCount: number;
  reconciled: boolean;
};

type MetricsEvidence = ObservedMetrics & {
  stage: string;
  expected: {
    contractMinted: string;
    holderCount: number;
    reconciled: boolean;
    status: "indexed";
    warning: "";
  };
};

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!hasValue(value)) {
    throw new Error(`Missing required live-test environment variable: ${name}`);
  }
  return value;
}

function parseExpectedMinted(value: string): bigint {
  if (!DECIMAL_INTEGER.test(value)) {
    throw new Error("EXPECTED_MINTED must be a non-negative decimal integer");
  }
  return BigInt(value);
}

function parseExpectedHolders(value: string): number {
  if (!DECIMAL_INTEGER.test(value)) {
    throw new Error("EXPECTED_HOLDERS must be a non-negative decimal integer");
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error("EXPECTED_HOLDERS must be a safe non-negative integer");
  }
  return parsed;
}

function parseExpectedReconciled(value: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error('EXPECTED_RECONCILED must be exactly "true" or "false"');
}

function observedMetrics(metrics: HolderMetrics): ObservedMetrics {
  return {
    contractMinted: metrics.contractMinted.toString(),
    holderCount: metrics.holderCount,
    reconciled: metrics.reconciled,
    status: metrics.status,
    warning: sanitizeWarning(metrics.warning),
  };
}

function sanitizeWarning(value: unknown): string {
  if (typeof value !== "string") return "";
  const printable = Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join("");
  return printable
    .replace(/\bS[A-Z2-7]{55}\b/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 512);
}

function matchesExpected(
  observed: ObservedMetrics,
  expected: ExpectedMetrics
): boolean {
  return (
    observed.contractMinted === expected.contractMinted.toString() &&
    observed.holderCount === expected.holderCount &&
    observed.reconciled === expected.reconciled &&
    observed.status === "indexed" &&
    observed.warning === ""
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

async function getMetricsBeforeDeadline(
  deadline: number
): Promise<HolderMetrics | null> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return null;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolveTimeout) => {
    timer = setTimeout(() => resolveTimeout(null), remaining);
  });

  try {
    return await Promise.race([getHolderCount(), timeout]);
  } catch {
    return null;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function writeMetricsEvidence(
  outputPath: string | undefined,
  evidence: MetricsEvidence
): Promise<void> {
  if (!hasValue(outputPath)) return;
  const destination = resolve(process.cwd(), outputPath);
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await writeFile(destination, `${JSON.stringify(evidence, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

describe("live holder indexer", () => {
  it.skipIf(!LIVE_TEST_REQUESTED)(
    "reconciles the configured live contract metrics",
    async () => {
      const expected: ExpectedMetrics = {
        contractMinted: parseExpectedMinted(requiredEnv("EXPECTED_MINTED")),
        holderCount: parseExpectedHolders(requiredEnv("EXPECTED_HOLDERS")),
        reconciled: parseExpectedReconciled(
          requiredEnv("EXPECTED_RECONCILED")
        ),
      };
      const stage = requiredEnv("LIVE_STAGE");
      if (!SAFE_STAGE.test(stage)) {
        throw new Error("LIVE_STAGE must contain only lowercase letters, digits, and underscores");
      }

      // The contract ID and deployment ledger are required inputs; the indexer
      // reads the ID and ledger from the real contract module at runtime.
      const configuredContractId = requiredEnv("NEXT_PUBLIC_CONTRACT_ID");
      const configuredDeploymentLedger = Number(
        requiredEnv("NEXT_PUBLIC_CONTRACT_DEPLOYMENT_LEDGER")
      );
      expect(CONTRACT_ID).toBe(configuredContractId);
      expect(CONTRACT_DEPLOYMENT_LEDGER).toBe(configuredDeploymentLedger);

      const deadline = Date.now() + POLL_TIMEOUT_MS;
      let latestObserved: ObservedMetrics | null = null;

      while (Date.now() < deadline) {
        const metrics = await getMetricsBeforeDeadline(deadline);
        if (metrics) {
          latestObserved = observedMetrics(metrics);
          if (matchesExpected(latestObserved, expected)) break;
        }

        const remaining = deadline - Date.now();
        if (remaining <= 0) break;
        await wait(Math.min(POLL_INTERVAL_MS, remaining));
      }

      if (latestObserved === null) {
        throw new Error(
          `Live holder-indexer polling produced no metrics within ${POLL_TIMEOUT_MS / 1_000}s. Observed metrics: none`
        );
      }

      const evidence: MetricsEvidence = {
        ...latestObserved,
        stage,
        expected: {
          contractMinted: expected.contractMinted.toString(),
          holderCount: expected.holderCount,
          reconciled: expected.reconciled,
          status: "indexed",
          warning: "",
        },
      };

      try {
        expect(latestObserved).toEqual({
          contractMinted: expected.contractMinted.toString(),
          holderCount: expected.holderCount,
          reconciled: expected.reconciled,
          status: "indexed",
          warning: "",
        });
      } catch {
        throw new Error(
          `Live holder-indexer metrics did not match. Observed metrics: ${JSON.stringify(latestObserved)}`
        );
      }

      await writeMetricsEvidence(process.env.LIVE_METRICS_OUTPUT, evidence);
    },
    TEST_TIMEOUT_MS
  );
});
