/**
 * Holder event indexer and contract-state reconciliation.
 *
 * The indexer only derives holders from successful purchase events emitted by
 * the configured contract. Contract state is read independently and is used to
 * verify the indexed balance total; it is never used to invent holder wallets.
 */

import {
  Account,
  Address,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { CONTRACT_DEPLOYMENT_LEDGER, CONTRACT_ID } from "./contract";

const SERVER_URL =
  process.env.NEXT_PUBLIC_STELLAR_RPC_URL ||
  "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
const CACHE_KEY = `niko-holder-cache-v2:${CONTRACT_ID}`;
const DUMMY_ACCOUNT =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/** RPC page size used for every event request. */
export const EVENT_PAGE_LIMIT = 100;
/** Safety cap for a single browser-side indexer run. */
export const MAX_EVENT_PAGES = 100;
/** Approximate XDR payload cap for a single browser-side indexer run. */
export const MAX_EVENT_BYTES = 8 * 1024 * 1024;
/** Recent-ledger window used only until a deployment receipt is configured. */
export const RECENT_LEDGER_WINDOW = 100_000;
/** Maximum number of project records reconciled in one browser-side run. */
export const MAX_PROJECT_READS = 1_000;
/** Maximum number of holder portfolios probed for active balances in one run. */
export const MAX_ACTIVE_HOLDER_PROBES = 1_000;
/** Wall-clock limit for each contract-state read; reads remain sequential. */
export const RPC_READ_TIMEOUT_MS = 15_000;
/** Maximum warning text retained in memory or rendered by the UI. */
export const MAX_WARNING_LENGTH = 240;

export type HolderStatus =
  | "indexed"
  | "indexing"
  | "reconciling"
  | "stale"
  | "error";

export type HolderMetrics = {
  holderCount: number | null;
  activeHolders: number | null;
  totalTransfers: number | null;
  contractMinted: bigint;
  indexedBalanceTotal: bigint;
  reconciled: boolean;
  oldestLedger: number | null;
  latestLedger: number;
  lastIndexedAt: string;
  source: "Stellar Testnet";
  status: HolderStatus;
  isStale: boolean;
  warning?: string;
};

export type RpcEventLike = {
  contractId?: unknown;
  topic?: readonly unknown[];
  value?: unknown;
  inSuccessfulContractCall?: boolean;
  ledger?: number;
  [key: string]: unknown;
};

export type DecodedPurchaseEvent = {
  buyer: string;
  projectId: number;
  amount: bigint;
};

export type ReconciliationInput = {
  scanComplete: boolean;
  contractMinted: bigint;
  indexedBalanceTotal: bigint;
  observedHolderCount: number;
};

export type ReconciliationDecision = {
  holderCount: number | null;
  reconciled: boolean;
  status: Extract<HolderStatus, "indexed" | "indexing" | "reconciling">;
};

/**
 * Builds the only event filter used by the indexer.
 *
 * Soroban topic filters contain XDR/base64 ScVals, not plain event names.
 */
export function buildPurchaseEventFilter(
  contractId: string = CONTRACT_ID
): rpc.Api.EventFilter {
  let purchaseTopic: string;
  try {
    purchaseTopic = xdr.ScVal.scvSymbol("purchase").toXDR("base64") as string;
  } catch {
    // Some ESM test/bundler combinations expose an unnormalized XDR string.
    // Encoding the same symbol bytes preserves the wire representation used by
    // Soroban RPC; the final value is the standard symbol XDR encoding.
    try {
      purchaseTopic = xdr.ScVal.scvSymbol(
        Uint8Array.from([112, 117, 114, 99, 104, 97, 115, 101])
      ).toXDR("base64") as string;
    } catch {
      purchaseTopic = "AAAADwAAAAhwdXJjaGFzZQ==";
    }
  }
  return {
    type: "contract",
    contractIds: [contractId],
    topics: [[purchaseTopic]],
  };
}

/** Alias kept small and explicit for callers that prefer the generic name. */
export const buildEventFilter = buildPurchaseEventFilter;

type ScValDecoder = (value: xdr.ScVal) => unknown;

function decodeScVal(value: unknown, decoder: ScValDecoder): unknown {
  return decoder(value as xdr.ScVal);
}

function canonicalAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    return Address.fromString(value).toString();
  } catch {
    return null;
  }
}

function displayProjectId(value: unknown): number | null {
  if (typeof value === "bigint") {
    if (value < BigInt(0) || value > BigInt(Number.MAX_SAFE_INTEGER)) return null;
    return Number(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return value;
  }
  return null;
}

function positiveBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value > BigInt(0) ? value : null;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? BigInt(value) : null;
  }
  return null;
}

/**
 * Decodes one successful purchase event using the contract's exact event shape:
 * topic[0] = purchase, topic[1] = buyer, value = [projectId, amount].
 *
 * Malformed and unsuccessful events return null rather than contributing a
 * guessed balance.
 */
export function decodePurchaseEvent(
  event: RpcEventLike | rpc.Api.EventResponse,
  decoder: ScValDecoder = scValToNative
): DecodedPurchaseEvent | null {
  if (event.inSuccessfulContractCall !== true) return null;
  if (!Array.isArray(event.topic) || event.topic.length < 2) return null;
  if (event.value === undefined || event.value === null) return null;

  try {
    const eventName = decodeScVal(event.topic[0], decoder);
    const buyer = canonicalAddress(decodeScVal(event.topic[1], decoder));
    const payload = decodeScVal(event.value, decoder);

    if (eventName !== "purchase" || buyer === null) return null;
    if (!Array.isArray(payload) || payload.length < 2) return null;

    const projectId = displayProjectId(payload[0]);
    const amount = positiveBigInt(payload[1]);
    if (projectId === null || amount === null) return null;

    return { buyer, projectId, amount };
  } catch {
    return null;
  }
}

/** Alias for consumers that use the shorter decoder name. */
export const decodeEvent = decodePurchaseEvent;

/**
 * Reconstructs positive balances from decoded purchases.
 *
 * The map is intentionally the only holder source; repeated purchases by one
 * address add to its balance and do not create another holder.
 */
export function reconstructHolders(
  events: readonly DecodedPurchaseEvent[]
): Map<string, bigint> {
  const balances = new Map<string, bigint>();

  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const buyer = canonicalAddress(event.buyer);
    const amount = positiveBigInt(event.amount);
    if (buyer === null || displayProjectId(event.projectId) === null || amount === null) {
      continue;
    }
    balances.set(buyer, (balances.get(buyer) ?? BigInt(0)) + amount);
  }

  for (const [address, balance] of balances) {
    if (balance <= BigInt(0)) balances.delete(address);
  }

  return balances;
}

function sumBalances(balances: ReadonlyMap<string, bigint>): bigint {
  let total = BigInt(0);
  for (const balance of balances.values()) {
    if (balance > BigInt(0)) total += balance;
  }
  return total;
}

function countPositiveHolders(balances: ReadonlyMap<string, bigint>): number {
  let count = 0;
  for (const balance of balances.values()) {
    if (balance > BigInt(0)) count += 1;
  }
  return count;
}

/**
 * Makes the completeness and supply-reconciliation decision independently of
 * the RPC transport so it can be tested and reused by the UI state machine.
 *
 * A complete scan is not enough to publish a count: the observed count itself
 * must be a valid non-negative integer. Missing, malformed, or negative counts
 * remain unavailable rather than being coerced to zero.
 */
export function decideReconciliation(
  input: ReconciliationInput
): ReconciliationDecision {
  if (!input || input.scanComplete !== true) {
    return { holderCount: null, reconciled: false, status: "indexing" };
  }

  const observedCountIsValid =
    typeof input.observedHolderCount === "number" &&
    Number.isSafeInteger(input.observedHolderCount) &&
    input.observedHolderCount >= 0;
  const suppliesAreValid =
    typeof input.contractMinted === "bigint" &&
    input.contractMinted >= BigInt(0) &&
    typeof input.indexedBalanceTotal === "bigint" &&
    input.indexedBalanceTotal >= BigInt(0);

  if (!observedCountIsValid || !suppliesAreValid) {
    return { holderCount: null, reconciled: false, status: "reconciling" };
  }

  if (input.contractMinted !== input.indexedBalanceTotal) {
    return { holderCount: null, reconciled: false, status: "reconciling" };
  }

  return {
    holderCount: input.observedHolderCount,
    reconciled: true,
    status: "indexed",
  };
}

/** Alias for callers that name the operation after its domain. */
export const reconcileHolderBalances = decideReconciliation;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatHolderCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("en-US");
}

export function formatTokenAmount(
  value: bigint | null | undefined
): string {
  if (value === null || value === undefined) return "—";
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** Bounds text before it reaches the DOM or the local cache. */
export function formatWarning(warning: unknown): string {
  if (typeof warning !== "string" || warning.length === 0) return "";
  if (warning.length <= MAX_WARNING_LENGTH) return warning;
  return `${warning.slice(0, MAX_WARNING_LENGTH - 1)}…`;
}

export function formatLastIndexed(
  isoString: string | null | undefined
): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "—";
    const dtf = new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
    const parts = dtf.formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const day = get("day");
    const month = get("month");
    const monthShort = month === "Sept" ? "Sep" : month;
    const year = get("year");
    const hour = get("hour");
    const minute = get("minute");
    return `${day} ${monthShort} ${year} · ${hour}:${minute} UTC`;
  } catch {
    return "—";
  }
}

/**
 * Relative time helper for the verification panel, e.g. "18 sec ago".
 */
export function formatRelativeTime(isoString: string | null | undefined): string {
  try {
    if (!isoString) return "";
    const then = new Date(isoString).getTime();
    if (isNaN(then)) return "";
    const diffMs = Date.now() - then;
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return `${sec} sec ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min} min ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr} hr ago`;
    const days = Math.floor(hr / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Observed-metrics cache. No wallets or event payloads are cached.
// ---------------------------------------------------------------------------

function isNullableSafeCount(value: unknown): value is number | null {
  return (
    value === null ||
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0)
  );
}

function parseCachedBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value >= BigInt(0) ? value : null;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

function isHolderStatus(value: unknown): value is HolderStatus {
  return (
    value === "indexed" ||
    value === "indexing" ||
    value === "reconciling" ||
    value === "stale" ||
    value === "error"
  );
}

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  return Number.isFinite(Date.parse(value));
}

/**
 * Parses the versioned cache without trusting contradictory state flags.
 * Exported as a pure boundary so malformed or forged cache entries can be
 * tested without a browser storage implementation.
 */
export function parseCachedMetrics(value: unknown): HolderMetrics | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.source !== "Stellar Testnet") return null;
  if (!isValidTimestamp(candidate.lastIndexedAt)) return null;
  if (
    typeof candidate.latestLedger !== "number" ||
    !Number.isSafeInteger(candidate.latestLedger) ||
    candidate.latestLedger < 0
  ) {
    return null;
  }
  if (!isNullableSafeCount(candidate.holderCount)) return null;
  if (!isNullableSafeCount(candidate.activeHolders)) return null;
  if (!isNullableSafeCount(candidate.totalTransfers)) return null;
  if (
    candidate.oldestLedger !== null &&
    (typeof candidate.oldestLedger !== "number" ||
      !Number.isSafeInteger(candidate.oldestLedger) ||
      candidate.oldestLedger < 0)
  ) {
    return null;
  }
  if (typeof candidate.reconciled !== "boolean") return null;
  if (typeof candidate.isStale !== "boolean") return null;
  if (!isHolderStatus(candidate.status)) return null;
  if (candidate.warning !== undefined && typeof candidate.warning !== "string") {
    return null;
  }

  const contractMinted = parseCachedBigInt(candidate.contractMinted);
  const indexedBalanceTotal = parseCachedBigInt(candidate.indexedBalanceTotal);
  if (contractMinted === null || indexedBalanceTotal === null) return null;

  const holderCount = candidate.holderCount;
  const status = candidate.status;
  const reconciled = candidate.reconciled;
  const isStale = candidate.isStale;

  if (reconciled) {
    if (
      status !== "indexed" ||
      isStale ||
      holderCount === null ||
      !isNullableSafeCount(holderCount) ||
      contractMinted !== indexedBalanceTotal
    ) {
      return null;
    }
  } else if (status === "indexed") {
    return null;
  }

  // Non-reconciled states never publish a definitive count. A stale cache is
  // the sole exception because its numeric value is explicitly non-verified.
  if (!reconciled && holderCount !== null && status !== "stale") return null;
  if (status === "stale" && !isStale) return null;
  if (status === "error" && (!isStale || holderCount !== null)) return null;
  if (status === "indexing" && (isStale || holderCount !== null)) return null;
  if (status === "reconciling" && (isStale || holderCount !== null)) return null;
  if (status === "indexed" && (isStale || !reconciled)) return null;

  const warning = formatWarning(candidate.warning);
  return {
    holderCount,
    activeHolders: candidate.activeHolders,
    totalTransfers: candidate.totalTransfers,
    contractMinted,
    indexedBalanceTotal,
    reconciled,
    oldestLedger: candidate.oldestLedger,
    latestLedger: candidate.latestLedger,
    lastIndexedAt: candidate.lastIndexedAt,
    source: "Stellar Testnet",
    status,
    isStale,
    ...(warning ? { warning } : {}),
  };
}

function readCache(): HolderMetrics | null {
  if (typeof window === "undefined") return null;
  try {
    if (!window.localStorage) return null;
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return parseCachedMetrics(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeCache(metrics: HolderMetrics): void {
  if (typeof window === "undefined") return;
  try {
    if (!window.localStorage) return;
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify(metrics, (_key, value: unknown) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );
  } catch {
    // Storage is an optimization only; the next RPC run remains authoritative.
  }
}

function hasUsableCache(cached: HolderMetrics | null): cached is HolderMetrics {
  return cached !== null && cached.holderCount !== null;
}

function withStaleCache(
  cached: HolderMetrics | null,
  warning: string,
  nowIso: string
): HolderMetrics {
  if (hasUsableCache(cached)) {
    return {
      ...cached,
      reconciled: false,
      status: "stale",
      isStale: true,
      warning: formatWarning(warning),
    };
  }
  return withUnavailableMetrics(warning, nowIso);
}

function withUnavailableMetrics(warning: string, nowIso: string): HolderMetrics {
  return {
    holderCount: null,
    activeHolders: null,
    totalTransfers: null,
    contractMinted: BigInt(0),
    indexedBalanceTotal: BigInt(0),
    reconciled: false,
    oldestLedger: null,
    latestLedger: 0,
    lastIndexedAt: nowIso,
    source: "Stellar Testnet",
    status: "error",
    isStale: true,
    warning: formatWarning(warning),
  };
}

// ---------------------------------------------------------------------------
// Contract views
// ---------------------------------------------------------------------------

function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number = RPC_READ_TIMEOUT_MS
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Stellar RPC read timed out"));
    }, timeoutMs);
    Promise.resolve()
      .then(operation)
      .then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        }
      );
  });
}

function u64ScVal(value: number | bigint): xdr.ScVal {
  return nativeToScVal(BigInt(value.toString()), { type: "u64" });
}

function projectIdsScVal(projectIds: readonly number[]): xdr.ScVal {
  return xdr.ScVal.scvVec(projectIds.map((id) => u64ScVal(id)));
}

async function readContractView(
  server: rpc.Server,
  method: string,
  args: readonly xdr.ScVal[]
): Promise<xdr.ScVal> {
  const contract = new Contract(CONTRACT_ID);
  const operation = contract.call(method, ...(args as never[]));
  const source = new Account(DUMMY_ACCOUNT, "0");
  const transaction = new TransactionBuilder(source, {
    fee: "100",
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const simulation = await withTimeout(() =>
    server.simulateTransaction(transaction)
  );
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error("Contract view simulation failed");
  }
  const result = simulation.result?.retval;
  if (!result) throw new Error("Contract view returned no value");
  return result as xdr.ScVal;
}

function nonNegativeBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value >= BigInt(0) ? value : null;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

export type ProjectReadBounds = {
  readCount: number;
  exceedsCap: boolean;
};

/** Decides how many project records can be read without hiding omitted data. */
export function getProjectReadBounds(projectCount: number): ProjectReadBounds {
  const normalizedCount =
    Number.isSafeInteger(projectCount) && projectCount >= 0 ? projectCount : 0;
  return {
    readCount: Math.min(normalizedCount, MAX_PROJECT_READS),
    exceedsCap: normalizedCount > MAX_PROJECT_READS,
  };
}

export function canProbeActiveHolders(holderCount: number): boolean {
  return (
    Number.isSafeInteger(holderCount) &&
    holderCount >= 0 &&
    holderCount <= MAX_ACTIVE_HOLDER_PROBES
  );
}

type ContractStateScan = {
  complete: boolean;
  contractMinted: bigint;
  projectIds: number[];
  projectCount: number;
  projectCapExceeded: boolean;
  rpcFailed: boolean;
};

async function readContractState(server: rpc.Server): Promise<ContractStateScan> {
  const empty: ContractStateScan = {
    complete: false,
    contractMinted: BigInt(0),
    projectIds: [],
    projectCount: 0,
    projectCapExceeded: false,
    rpcFailed: false,
  };

  try {
    const rawNext = await readContractView(server, "next_project_id", []);
    const nextValue = nonNegativeBigInt(scValToNative(rawNext));
    if (nextValue === null || nextValue < BigInt(1)) {
      return { ...empty, rpcFailed: true };
    }
    if (nextValue - BigInt(1) > BigInt(MAX_PROJECT_READS)) {
      return {
        ...empty,
        projectCapExceeded: true,
      };
    }
    if (nextValue > BigInt(Number.MAX_SAFE_INTEGER)) {
      return { ...empty, rpcFailed: true };
    }

    const projectCount = Number(nextValue) - 1;
    const bounds = getProjectReadBounds(projectCount);
    if (bounds.exceedsCap) {
      return {
        ...empty,
        projectCount,
        projectCapExceeded: true,
      };
    }

    const projectIds: number[] = [];
    let contractMinted = BigInt(0);
    let complete = true;
    let rpcFailed = false;

    // Sequential reads plus a per-read timeout keep project reconciliation
    // bounded even when the contract reports many projects.
    for (let id = 1; id <= bounds.readCount; id += 1) {
      try {
        const rawProject = await readContractView(server, "get_project", [
          u64ScVal(id),
        ]);
        const project = scValToNative(rawProject);
        if (!project || typeof project !== "object" || Array.isArray(project)) {
          complete = false;
          continue;
        }
        const minted = nonNegativeBigInt(
          (project as Record<string, unknown>).minted
        );
        if (minted === null) {
          complete = false;
          continue;
        }
        contractMinted += minted;
        projectIds.push(id);
      } catch {
        complete = false;
        rpcFailed = true;
      }
    }

    return {
      complete,
      contractMinted,
      projectIds,
      projectCount,
      projectCapExceeded: false,
      rpcFailed,
    };
  } catch {
    return { ...empty, rpcFailed: true };
  }
}

async function countActiveHolders(
  server: rpc.Server,
  addresses: readonly string[],
  projectIds: readonly number[]
): Promise<number | null> {
  if (!canProbeActiveHolders(addresses.length)) return null;
  if (addresses.length === 0) return 0;
  if (projectIds.length === 0) return 0;

  let active = 0;
  // Keep portfolio reads sequential; countActiveHolders applies a hard cap and
  // every individual view is protected by RPC_READ_TIMEOUT_MS.
  for (const address of addresses) {
    try {
      const raw = await readContractView(server, "get_portfolio", [
        Address.fromString(address).toScVal(),
        projectIdsScVal(projectIds),
      ]);
      const positions = scValToNative(raw);
      if (!Array.isArray(positions)) return null;

      let hasClaimable = false;
      for (const position of positions) {
        if (!position || typeof position !== "object") continue;
        const positionRecord = position as Record<string, unknown>;
        const claimable = nonNegativeBigInt(
          positionRecord.claimable_amount ?? positionRecord.claimableAmount
        );
        if (claimable === null) return null;
        if (claimable > BigInt(0)) hasClaimable = true;
      }
      if (hasClaimable) active += 1;
    } catch {
      return null;
    }
  }
  return active;
}

// ---------------------------------------------------------------------------
// Event scanning
// ---------------------------------------------------------------------------

type EventScan = {
  decodedEvents: DecodedPurchaseEvent[];
  complete: boolean;
  responseSeen: boolean;
  oldestLedger: number | null;
  latestLedger: number | null;
  hitPageCap: boolean;
  hitByteCap: boolean;
  retentionStartedAfterScan: boolean;
  usedBoundedWindow: boolean;
  rpcFailed: boolean;
};

function finiteLedger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function estimateEventBytes(event: RpcEventLike): number {
  let bytes = 0;
  const values: unknown[] = [
    ...(Array.isArray(event.topic) ? event.topic : []),
    event.value,
  ];
  for (const value of values) {
    if (
      value &&
      typeof value === "object" &&
      "toXDR" in value &&
      typeof (value as { toXDR?: unknown }).toXDR === "function"
    ) {
      try {
        const xdrValue = (value as { toXDR: (format: string) => string | Uint8Array })
          .toXDR("base64");
        bytes += xdrValue.length;
        continue;
      } catch {
        // Fall through to the bounded JSON estimate.
      }
    }
    try {
      bytes += JSON.stringify(value, (_key, item: unknown) =>
        typeof item === "bigint" ? item.toString() : item
      ).length;
    } catch {
      bytes += 64;
    }
  }
  return Math.max(1, bytes);
}

async function scanPurchaseEvents(
  server: rpc.Server,
  startLedger: number,
  authoritativeStart: boolean
): Promise<EventScan> {
  const result: EventScan = {
    decodedEvents: [],
    complete: false,
    responseSeen: false,
    oldestLedger: null,
    latestLedger: null,
    hitPageCap: false,
    hitByteCap: false,
    retentionStartedAfterScan: false,
    usedBoundedWindow: !authoritativeStart,
    rpcFailed: false,
  };
  const filter = buildPurchaseEventFilter();
  let bytes = 0;
  let cursor: string | undefined;

  for (let page = 0; page < MAX_EVENT_PAGES; page += 1) {
    let response: rpc.Api.GetEventsResponse;
    try {
      if (cursor) {
        const requestCursor = cursor;
        response = await withTimeout(() =>
          server.getEvents({
            cursor: requestCursor,
            filters: [filter],
            limit: EVENT_PAGE_LIMIT,
          })
        );
      } else {
        response = await withTimeout(() =>
          server.getEvents({
            startLedger,
            filters: [filter],
            limit: EVENT_PAGE_LIMIT,
          })
        );
      }
    } catch {
      result.rpcFailed = true;
      return result;
    }

    result.responseSeen = true;
    const responseOldest = finiteLedger(response.oldestLedger);
    const responseLatest = finiteLedger(response.latestLedger);
    if (responseOldest !== null) {
      if (authoritativeStart && responseOldest > startLedger) {
        result.retentionStartedAfterScan = true;
      }
    }
    if (responseLatest !== null) {
      result.latestLedger =
        result.latestLedger === null
          ? responseLatest
          : Math.max(result.latestLedger, responseLatest);
    }

    if (!Array.isArray(response.events)) {
      result.rpcFailed = true;
      return result;
    }
    const events = response.events;
    if (events.length > EVENT_PAGE_LIMIT) {
      result.hitPageCap = true;
      return result;
    }
    for (const event of events as unknown as RpcEventLike[]) {
      const ledger = finiteLedger(event.ledger);
      if (ledger !== null) {
        result.oldestLedger =
          result.oldestLedger === null
            ? ledger
            : Math.min(result.oldestLedger, ledger);
      }

      const eventBytes = estimateEventBytes(event);
      if (bytes + eventBytes > MAX_EVENT_BYTES) {
        result.hitByteCap = true;
        return result;
      }
      bytes += eventBytes;

      const decoded = decodePurchaseEvent(event);
      if (decoded) result.decodedEvents.push(decoded);
    }

    if (response.cursor !== undefined && typeof response.cursor !== "string") {
      result.rpcFailed = true;
      return result;
    }
    const nextCursor = typeof response.cursor === "string" ? response.cursor : "";
    if (!nextCursor) {
      result.complete =
        authoritativeStart &&
        !result.retentionStartedAfterScan &&
        events.length < EVENT_PAGE_LIMIT;
      return result;
    }
    if (nextCursor === cursor) {
      result.rpcFailed = true;
      return result;
    }

    // Follow a non-empty cursor even when this page has no matching events;
    // only an absent cursor (or a bounded final page) proves completion.
    cursor = nextCursor;
    if (page + 1 >= MAX_EVENT_PAGES) {
      result.hitPageCap = true;
      return result;
    }
  }

  result.hitPageCap = true;
  return result;
}

// ---------------------------------------------------------------------------
// Public indexer entry point
// ---------------------------------------------------------------------------

function validConfiguredLedger(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value > 0;
}

function scanStart(
  latestLedger: number
): { startLedger: number; authoritativeStart: boolean } {
  if (validConfiguredLedger(CONTRACT_DEPLOYMENT_LEDGER)) {
    return { startLedger: CONTRACT_DEPLOYMENT_LEDGER, authoritativeStart: true };
  }
  const boundedStart =
    latestLedger > 0
      ? Math.max(1, latestLedger - RECENT_LEDGER_WINDOW + 1)
      : 1;
  return { startLedger: boundedStart, authoritativeStart: false };
}

function warningForScan(
  scan: EventScan,
  state: ContractStateScan
): string | undefined {
  const warnings: string[] = [];
  if (scan.rpcFailed) warnings.push("Soroban RPC event query failed");
  if (scan.hitByteCap || scan.hitPageCap) {
    warnings.push("Event scan reached its configured safety cap");
  }
  if (scan.retentionStartedAfterScan) {
    warnings.push("The event node retention window predates deployment");
  }
  if (!scan.complete && !scan.rpcFailed && !scan.hitByteCap && !scan.hitPageCap) {
    warnings.push(
      scan.usedBoundedWindow
        ? "A verified deployment ledger is not configured; the recent-window scan is incomplete"
        : "Event cursor pagination did not reach a complete end"
    );
  }
  if (state.projectCapExceeded) {
    warnings.push(
      `Project state exceeds the ${MAX_PROJECT_READS}-read cap; reconciliation is incomplete`
    );
  }
  if (state.rpcFailed) {
    warnings.push("Soroban RPC contract-state query failed");
  }
  if (!state.complete && !state.projectCapExceeded && !state.rpcFailed) {
    warnings.push("Contract state reconciliation is incomplete");
  }
  return warnings.length > 0 ? formatWarning(warnings.join(" ")) : undefined;
}

function latestOrZero(...values: Array<number | null>): number {
  let latest = 0;
  for (const value of values) {
    if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
      latest = Math.max(latest, value);
    }
  }
  return latest;
}

export async function getHolderCount(): Promise<HolderMetrics> {
  const nowIso = new Date().toISOString();
  const cached = readCache();

  try {
    const server = new rpc.Server(SERVER_URL);
    let latestLedger = 0;
    let latestLedgerReadFailed = false;
    try {
      const latest = await withTimeout(() => server.getLatestLedger());
      const parsedLatestLedger = finiteLedger(latest.sequence);
      if (parsedLatestLedger === null) {
        latestLedgerReadFailed = true;
      } else {
        latestLedger = parsedLatestLedger;
      }
    } catch {
      latestLedger = 0;
      latestLedgerReadFailed = true;
    }

    const { startLedger, authoritativeStart } = scanStart(latestLedger);
    const eventScan = await scanPurchaseEvents(
      server,
      startLedger,
      authoritativeStart
    );
    const state = await readContractState(server);
    const balances = reconstructHolders(eventScan.decodedEvents);
    const indexedBalanceTotal = sumBalances(balances);
    const observedHolderCount = countPositiveHolders(balances);
    const scanComplete =
      eventScan.complete && state.complete && !latestLedgerReadFailed;
    const decision = decideReconciliation({
      scanComplete,
      contractMinted: state.contractMinted,
      indexedBalanceTotal,
      observedHolderCount,
    });
    const scanWarningText = formatWarning(
      [
        warningForScan(eventScan, state),
        latestLedgerReadFailed
          ? "Stellar RPC latest-ledger query failed"
          : undefined,
      ]
        .filter((value): value is string => typeof value === "string")
        .join(" ")
    );
    const scanWarning = scanWarningText || undefined;
    const latest = latestOrZero(eventScan.latestLedger, latestLedger);
    const transfers = eventScan.responseSeen
      ? eventScan.decodedEvents.length
      : null;

    if (!scanComplete) {
      if (hasUsableCache(cached)) {
        return withStaleCache(
          cached,
          scanWarning ??
            "The current indexer scan is incomplete; showing cached metrics",
          nowIso
        );
      }
      if (eventScan.rpcFailed || state.rpcFailed || latestLedgerReadFailed) {
        return withUnavailableMetrics(
          scanWarning ??
            "Unable to reach the Stellar Testnet RPC; holder metrics are unavailable",
          nowIso
        );
      }
      const metrics: HolderMetrics = {
        holderCount: null,
        activeHolders: null,
        totalTransfers: transfers,
        contractMinted: state.contractMinted,
        indexedBalanceTotal,
        reconciled: false,
        oldestLedger: eventScan.oldestLedger,
        latestLedger: latest,
        lastIndexedAt: nowIso,
        source: "Stellar Testnet",
        status: "indexing",
        isStale: false,
        ...(scanWarning ? { warning: scanWarning } : {}),
      };
      writeCache(metrics);
      return metrics;
    }

    const activeHolders = await countActiveHolders(
      server,
      Array.from(balances.keys()),
      state.projectIds
    );
    const warnings = [
      scanWarning,
      !canProbeActiveHolders(balances.size)
        ? `Active-holder probes exceed the ${MAX_ACTIVE_HOLDER_PROBES}-probe cap; activeHolders is unavailable`
        : undefined,
      decision.status === "reconciling"
        ? "Indexed balances do not match contract minted supply"
        : undefined,
    ].filter((value): value is string => typeof value === "string");
    const warning = formatWarning(warnings.join(" "));
    const metrics: HolderMetrics = {
      holderCount: decision.holderCount,
      activeHolders,
      totalTransfers: transfers,
      contractMinted: state.contractMinted,
      indexedBalanceTotal,
      reconciled: decision.reconciled,
      oldestLedger: eventScan.oldestLedger,
      latestLedger: latest,
      lastIndexedAt: nowIso,
      source: "Stellar Testnet",
      status: decision.status,
      isStale: false,
      ...(warning ? { warning } : {}),
    };
    writeCache(metrics);
    return metrics;
  } catch {
    return withStaleCache(
      cached,
      "Unable to reach the Stellar Testnet RPC; showing the last observed metrics when available",
      nowIso
    );
  }
}

export const HOLDER_CACHE_KEY = CACHE_KEY;
