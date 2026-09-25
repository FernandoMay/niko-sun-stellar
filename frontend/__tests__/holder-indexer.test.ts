import { describe, expect, it } from "vitest";
import { Address, nativeToScVal, xdr } from "@stellar/stellar-sdk";
import {
  buildPurchaseEventFilter,
  canProbeActiveHolders,
  decodePurchaseEvent,
  decideReconciliation,
  getProjectReadBounds,
  MAX_ACTIVE_HOLDER_PROBES,
  MAX_PROJECT_READS,
  parseCachedMetrics,
  reconstructHolders,
  type RpcEventLike,
} from "../lib/holderIndexer";

const CONTRACT_ID =
  "CB7V3676CQBO5OL6DEXI5FORLG37IR2GR7LXCZD7DUZTMSUT7BEEINR3";
const BUYER_A = "GABGH363YQNYYAUN2M6YAPYFLPDMU5GZIJDWOEC2G3AUEH3TLPSXN3TX";
const BUYER_B = "GC755Q7SO6ZHWP4FOSR52R7W624DWO7RAD6UAQ5TLTEUBXBKMJ5AVIZ6";

function cacheEntry(overrides: Record<string, unknown> = {}) {
  return {
    holderCount: 1,
    activeHolders: 0,
    totalTransfers: 1,
    contractMinted: "1",
    indexedBalanceTotal: "1",
    reconciled: true,
    oldestLedger: 100,
    latestLedger: 100,
    lastIndexedAt: "2026-09-24T00:00:00.000Z",
    source: "Stellar Testnet",
    status: "indexed",
    isStale: false,
    ...overrides,
  };
}

function purchaseEvent({
  buyer = BUYER_A,
  projectId = 1,
  amount = 50n,
  successful = true,
  ledger = 100,
  topic = [
    nativeToScVal("purchase", { type: "symbol" }),
    Address.fromString(buyer).toScVal(),
  ],
  value = xdr.ScVal.scvVec([
    nativeToScVal(projectId, { type: "u64" }),
    nativeToScVal(amount, { type: "u128" }),
  ]),
}: {
  buyer?: string;
  projectId?: number | bigint;
  amount?: bigint;
  successful?: boolean;
  ledger?: number;
  topic?: readonly unknown[];
  value?: unknown;
} = {}): RpcEventLike {
  return {
    contractId: CONTRACT_ID,
    topic,
    value,
    inSuccessfulContractCall: successful,
    ledger,
  };
}

describe("holder event indexer primitives", () => {
  it("builds a symbol purchase topic filter instead of a plain event name", () => {
    const filter = buildPurchaseEventFilter(CONTRACT_ID);
    const expectedTopic = "AAAADwAAAAhwdXJjaGFzZQ==";

    expect(filter.type).toBe("contract");
    expect(filter.contractIds).toEqual([CONTRACT_ID]);
    expect(filter.topics).toEqual([[expectedTopic]]);
    expect(JSON.stringify(filter)).not.toContain("purchase_tokens");
  });

  it("decodes the buyer, project id, and amount from realistic ScVal data", () => {
    const event = purchaseEvent({ buyer: BUYER_A, projectId: 7, amount: 123n });

    expect(decodePurchaseEvent(event)).toEqual({
      buyer: BUYER_A,
      projectId: 7,
      amount: 123n,
    });
  });

  it("ignores failed calls, malformed events, and non-positive amounts", () => {
    expect(
      decodePurchaseEvent(purchaseEvent({ successful: false }))
    ).toBeNull();
    expect(decodePurchaseEvent(purchaseEvent({ topic: [] }))).toBeNull();
    expect(
      decodePurchaseEvent(
        purchaseEvent({
          value: xdr.ScVal.scvVec([
            nativeToScVal(1n, { type: "u64" }),
          ]),
        })
      )
    ).toBeNull();
    expect(decodePurchaseEvent(purchaseEvent({ amount: 0n }))).toBeNull();
    expect(
      decodePurchaseEvent(
        purchaseEvent({
          value: xdr.ScVal.scvVec([
            nativeToScVal(BigInt(Number.MAX_SAFE_INTEGER) + 1n, {
              type: "u64",
            }),
            nativeToScVal(1n, { type: "u128" }),
          ]),
        })
      )
    ).toBeNull();
  });

  it("keeps one holder when the same buyer purchases repeatedly", () => {
    const balances = reconstructHolders([
      {
        buyer: BUYER_A,
        projectId: 1,
        amount: 50n,
      },
      {
        buyer: BUYER_A,
        projectId: 1,
        amount: 25n,
      },
    ]);

    expect(balances.size).toBe(1);
    expect(balances.get(BUYER_A)).toBe(75n);
  });

  it("adds a second holder when a different buyer purchases", () => {
    const balances = reconstructHolders([
      { buyer: BUYER_A, projectId: 1, amount: 50n },
      { buyer: BUYER_B, projectId: 1, amount: 25n },
    ]);

    expect(balances.size).toBe(2);
    expect(balances.get(BUYER_A)).toBe(50n);
    expect(balances.get(BUYER_B)).toBe(25n);
  });

  it("marks exact mint reconciliation as indexed", () => {
    expect(
      decideReconciliation({
        scanComplete: true,
        contractMinted: 75n,
        indexedBalanceTotal: 75n,
        observedHolderCount: 1,
      })
    ).toEqual({ holderCount: 1, reconciled: true, status: "indexed" });
  });

  it("marks a complete supply mismatch as reconciling", () => {
    expect(
      decideReconciliation({
        scanComplete: true,
        contractMinted: 100n,
        indexedBalanceTotal: 75n,
        observedHolderCount: 1,
      })
    ).toEqual({ holderCount: null, reconciled: false, status: "reconciling" });
  });

  it("keeps a complete zero result when the observed count is valid", () => {
    const balances = reconstructHolders([]);
    const decision = decideReconciliation({
      scanComplete: true,
      contractMinted: 0n,
      indexedBalanceTotal: 0n,
      observedHolderCount: balances.size,
    });

    expect(decision).toEqual({
      holderCount: 0,
      reconciled: true,
      status: "indexed",
    });
  });

  it("never turns a missing or invalid observed count into zero", () => {
    for (const invalidCount of [undefined, null, -1, 1.5, Number.NaN]) {
      const decision = decideReconciliation({
        scanComplete: true,
        contractMinted: 0n,
        indexedBalanceTotal: 0n,
        observedHolderCount: invalidCount as unknown as number,
      });

      expect(decision).toEqual({
        holderCount: null,
        reconciled: false,
        status: "reconciling",
      });
    }
  });

  it("returns no count while a scan is incomplete", () => {
    const decision = decideReconciliation({
      scanComplete: false,
      contractMinted: 0n,
      indexedBalanceTotal: 0n,
      observedHolderCount: 0,
    });

    expect(decision.holderCount).toBeNull();
    expect(decision.status).toBe("indexing");
  });

  it("rejects cache entries that contradict reconciliation invariants", () => {
    expect(parseCachedMetrics(cacheEntry({ holderCount: null }))).toBeNull();
    expect(
      parseCachedMetrics(
        cacheEntry({ contractMinted: "2", indexedBalanceTotal: "1" })
      )
    ).toBeNull();
    expect(parseCachedMetrics(cacheEntry({ status: "stale" }))).toBeNull();
    expect(
      parseCachedMetrics(cacheEntry({ lastIndexedAt: "not-a-timestamp" }))
    ).toBeNull();
  });

  it("accepts an explicit error cache only as unavailable", () => {
    const parsed = parseCachedMetrics(
      cacheEntry({
        holderCount: null,
        reconciled: false,
        status: "error",
        isStale: true,
      })
    );

    expect(parsed?.status).toBe("error");
    expect(parsed?.holderCount).toBeNull();
    expect(parsed?.isStale).toBe(true);
  });

  it("makes project and active-holder work bounds explicit", () => {
    expect(getProjectReadBounds(MAX_PROJECT_READS)).toEqual({
      readCount: MAX_PROJECT_READS,
      exceedsCap: false,
    });
    expect(getProjectReadBounds(MAX_PROJECT_READS + 1)).toEqual({
      readCount: MAX_PROJECT_READS,
      exceedsCap: true,
    });
    expect(canProbeActiveHolders(MAX_ACTIVE_HOLDER_PROBES)).toBe(true);
    expect(canProbeActiveHolders(MAX_ACTIVE_HOLDER_PROBES + 1)).toBe(false);
  });
});
