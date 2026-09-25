"use client";

import { useEffect, useState } from "react";
import {
  CONTRACT_DEPLOYMENT_LEDGER,
  CONTRACT_ID,
  EXPLORER_URL,
  LEDGER_EXPLORER_URL,
} from "@/lib/contract";
import {
  formatHolderCount,
  formatLastIndexed,
  formatRelativeTime,
  formatTokenAmount,
  formatWarning,
  type HolderMetrics,
} from "@/lib/holderIndexer";

type Props = {
  metrics: HolderMetrics | null;
  nextProjectId?: number | null;
  totalMinted?: string | null;
};

function shortContract(id: string) {
  return `${id.slice(0, 6)}...${id.slice(-4)}`;
}

export default function ProtocolVerification({
  metrics,
  nextProjectId,
  totalMinted,
}: Props) {
  const [nowTick, setNowTick] = useState(0);

  // tick every 5s to refresh relative time
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const holderDisplay =
    metrics?.holderCount !== null && metrics?.holderCount !== undefined
      ? formatHolderCount(metrics.holderCount)
      : "—";
  const isStale =
    metrics?.status === "stale" ||
    (metrics?.isStale === true && metrics?.status !== "error");
  const isReconciled =
    metrics !== null &&
    metrics.reconciled === true &&
    metrics.status === "indexed" &&
    metrics.holderCount !== null &&
    metrics.contractMinted === metrics.indexedBalanceTotal &&
    !isStale;
  const isReconciliationPending =
    metrics?.status === "reconciling" && !isReconciled;
  const isUnavailable = metrics?.status === "error";
  const isIndexing =
    metrics === null ||
    (!isStale &&
      !isReconciliationPending &&
      !isReconciled &&
      !isUnavailable);
  const stateDisplay = isReconciled
    ? "Reconciled"
    : isReconciliationPending
      ? "Reconciliation pending"
      : isStale
        ? "Stale"
        : isUnavailable
          ? "Unavailable"
          : "Indexing...";
  const stateTone = isReconciled ? "text-slate-900" : "text-amber-700";
  const hasObservedBalances =
    metrics !== null &&
    metrics.status !== "indexing" &&
    metrics.status !== "error";
  const contractMintedDisplay =
    metrics && hasObservedBalances ? formatTokenAmount(metrics.contractMinted) : "—";
  const indexedBalanceDisplay =
    metrics && hasObservedBalances
      ? formatTokenAmount(metrics.indexedBalanceTotal)
      : "—";
  const lastIndexed = metrics?.lastIndexedAt
    ? formatLastIndexed(metrics.lastIndexedAt)
    : "—";
  const relative = metrics?.lastIndexedAt
    ? formatRelativeTime(metrics.lastIndexedAt)
    : "";
  const warning = formatWarning(metrics?.warning);

  const hasDeploymentReceipt =
    CONTRACT_DEPLOYMENT_LEDGER !== null &&
    Number.isSafeInteger(CONTRACT_DEPLOYMENT_LEDGER) &&
    CONTRACT_DEPLOYMENT_LEDGER > 0;
  const hasStateEvidence =
    !isStale &&
    (metrics?.status === "indexed" || metrics?.status === "reconciling");
  const hasClaimableEvidence =
    hasDeploymentReceipt &&
    hasStateEvidence &&
    metrics !== null &&
    metrics.activeHolders !== null;
  const hasProjectEvidence =
    hasDeploymentReceipt &&
    hasStateEvidence &&
    nextProjectId != null &&
    Number.isSafeInteger(nextProjectId) &&
    nextProjectId >= 0;
  const contractStatus = hasDeploymentReceipt
    ? hasStateEvidence
      ? "Verified"
      : "Read incomplete"
    : "Awaiting deployment receipt";
  const unverifiedReadStatus = hasDeploymentReceipt
    ? "Read incomplete"
    : "Awaiting deployment receipt";
  const claimableStatus = hasClaimableEvidence ? "On-chain" : unverifiedReadStatus;
  const projectStatus = hasProjectEvidence ? "On-chain" : unverifiedReadStatus;

  // Keep hook alive for rerenders; suppress lint for unused var.
  void nowTick;

  return (
    <section className="w-full max-w-7xl mx-auto px-5 lg:px-10 mt-8">
      <div className="rounded-xl bg-white border border-slate-200 shadow-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-display text-[13px] font-bold tracking-widest uppercase text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-[18px]">
              verified_user
            </span>
            Protocol Status
          </h3>
          <span className="font-mono text-[11px] px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
            Stellar Testnet
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Left column */}
          <div className="divide-y divide-slate-100">
            <Row
              icon="contract"
              color={contractStatus === "Verified" ? "text-emerald-600" : "text-amber-600"}
              label="Soroban contract"
              value={contractStatus}
              statusIcon={contractStatus === "Verified" ? "check" : "pending"}
              href={EXPLORER_URL}
              hrefLabel="View Contract →"
              title={CONTRACT_ID}
              sub={shortContract(CONTRACT_ID)}
            />
            <Row
              icon="database"
              color={isReconciled ? "text-emerald-600" : "text-amber-600"}
              label="Contract state"
              value={<span className={stateTone}>{stateDisplay}</span>}
              statusIcon={isReconciled ? "check" : "pending"}
              sub={
                hasProjectEvidence
                  ? `(next_project_id: ${nextProjectId})`
                  : `(${unverifiedReadStatus.toLowerCase()})`
              }
            />
            <Row
              icon="token"
              color={isReconciled ? "text-emerald-600" : "text-amber-600"}
              label="Token balances"
              value={<span className={stateTone}>{stateDisplay}</span>}
              statusIcon={isReconciled ? "check" : "pending"}
              sub={
                isReconciliationPending
                  ? `(contract minted: ${contractMintedDisplay} · indexed: ${indexedBalanceDisplay})`
                  : metrics
                    ? `(contract minted: ${contractMintedDisplay})`
                    : totalMinted != null
                      ? `(total minted: ${totalMinted})`
                      : undefined
              }
            />
            <Row
              icon="group"
              color={isReconciled ? "text-emerald-600" : "text-amber-600"}
              label="Holder count"
              statusIcon={isReconciled ? "check" : "pending"}
              value={
                isIndexing || isReconciliationPending || isUnavailable ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">—</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-mono animate-pulse inline-flex items-center gap-1">
                      <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                      {stateDisplay}
                    </span>
                  </span>
                ) : (
                  <span className="font-mono font-bold text-slate-900">{holderDisplay}</span>
                )
              }
              sub={
                isStale
                  ? "Stale · cached metrics; not current verification"
                  : isReconciliationPending
                    ? "Not verified until balances match"
                    : isUnavailable
                      ? "Holder metrics unavailable"
                      : isReconciled
                        ? "Reconciled · Stellar Testnet"
                        : metrics?.source ?? "Stellar Testnet"
              }
            />
            <Row
              icon="payments"
              color={hasClaimableEvidence ? "text-emerald-600" : "text-amber-600"}
              label="Claimable balances"
              value={claimableStatus}
              statusIcon={hasClaimableEvidence ? "check" : "pending"}
            />
            <Row
              icon="solar_power"
              color={hasProjectEvidence ? "text-emerald-600" : "text-amber-600"}
              label="Project state"
              value={projectStatus}
              statusIcon={hasProjectEvidence ? "check" : "pending"}
            />
          </div>

          {/* Right column — network & index time */}
          <div className="p-5 flex flex-col gap-4 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-slate-500 font-semibold">
                Network
              </span>
              <span className="font-mono text-[12px] font-semibold text-slate-900 inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                Stellar Testnet
              </span>
            </div>

            <div className="rounded-lg bg-white border border-slate-200 p-4">
              <div className="font-mono text-[11px] uppercase tracking-widest text-slate-500 font-semibold mb-1">
                Last indexed
              </div>
              <div className="font-mono text-[13px] font-semibold text-slate-900">
                <span className={isStale ? "text-amber-700" : "text-slate-900"}>
                  {stateDisplay}
                </span>{" "}
                {lastIndexed}
                {relative ? (
                  <span className="ml-2 font-normal text-slate-500">· {relative}</span>
                ) : null}
                {metrics && metrics.latestLedger > 0 ? (
                  <span className="ml-2 font-normal text-slate-500">
                    · ledger {metrics.latestLedger}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <a
                  href={EXPLORER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                >
                  View Contract
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </a>
                <a
                  href={LEDGER_EXPLORER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1"
                >
                  View Ledger
                  <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                </a>
                {isStale && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-mono font-bold">
                    Stale
                  </span>
                )}
              </div>
            </div>

            <p className="font-mono text-[11px] leading-relaxed text-slate-500">
              Holder balances are reconstructed only from successful purchase events for{" "}
              <span className="font-semibold text-slate-700">{shortContract(CONTRACT_ID)}</span> and
              checked against every project&apos;s minted supply. The count is shown as verified
              only after the indexed and contract totals reconcile exactly.
            </p>
            {warning ? (
              <p
                role="status"
                className="font-mono text-[11px] leading-relaxed text-amber-700"
              >
                {warning}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function Row({
  icon,
  color,
  label,
  value,
  sub,
  href,
  hrefLabel,
  title,
  statusIcon = "check",
}: {
  icon: string;
  color: string;
  label: string;
  value: React.ReactNode;
  sub?: string;
  href?: string;
  hrefLabel?: string;
  title?: string;
  statusIcon?: string;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`material-symbols-outlined ${color} text-[18px] shrink-0`}>{icon}</span>
        <span className="font-mono text-[12px] font-medium text-slate-700 truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="font-mono text-[12px] font-semibold text-slate-900 inline-flex items-center gap-1">
          <span className={`material-symbols-outlined ${color} text-[14px]`}>{statusIcon}</span>
          {value}
        </span>
        {sub && <span className="font-mono text-[11px] text-slate-500 hidden sm:inline">{sub}</span>}
        {href && hrefLabel && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] font-semibold text-emerald-700 hover:underline inline-flex items-center gap-1"
            title={title}
          >
            {hrefLabel}
          </a>
        )}
      </div>
    </div>
  );
}
