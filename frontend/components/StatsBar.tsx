"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/WalletContext";
import { CONTRACT_ID, EXPLORER_URL } from "@/lib/contract";
import { useHolderMetrics } from "@/hooks/useHolderMetrics";
import {
  formatHolderCount,
  formatLastIndexed,
  formatTokenAmount,
  formatWarning,
} from "@/lib/holderIndexer";
import {
  formatIntegerAmount,
  formatStroopsAsXlm,
  sumBigints,
} from "@/lib/amounts";
import {
  readProjectCatalog,
  type ProjectCatalog,
} from "@/lib/contractData";

const EMPTY_CATALOG: ProjectCatalog = {
  status: "unavailable",
  nextProjectId: null,
  projectIds: [],
  projects: [],
  unavailableProjectIds: [],
  error: null,
};

export default function StatsBar() {
  const { readContract } = useWallet();
  const { metrics: holderMetrics, loading: holderLoading } = useHolderMetrics();
  const [catalog, setCatalog] = useState<ProjectCatalog>(EMPTY_CATALOG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void readProjectCatalog(readContract, CONTRACT_ID)
      .then((next) => {
        if (!cancelled) setCatalog(next);
      })
      .catch(() => {
        if (!cancelled) setCatalog(EMPTY_CATALOG);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [readContract]);

  const completeProjects = catalog.projects.filter((project) => project.stateComplete);
  const totalsAvailable =
    catalog.status === "ready" &&
    completeProjects.length === catalog.projectIds.length;

  const minted = totalsAvailable
    ? sumBigints(completeProjects.map((project) => project.minted ?? 0n))
    : null;
  const energy = totalsAvailable
    ? sumBigints(completeProjects.map((project) => project.totalEnergyKwh ?? 0n))
    : null;
  const sales = totalsAvailable
    ? sumBigints(completeProjects.map((project) => project.salesBalance ?? 0n))
    : null;

  const projectValue =
    catalog.status === "empty"
      ? "0"
      : catalog.status === "unavailable"
        ? "—"
        : `${completeProjects.length}/${catalog.projectIds.length}`;

  const holderCount =
    holderMetrics?.holderCount !== null && holderMetrics?.holderCount !== undefined
      ? formatHolderCount(holderMetrics.holderCount)
      : "—";
  const holderReconciled =
    holderMetrics?.reconciled === true &&
    holderMetrics?.status === "indexed" &&
    holderMetrics.contractMinted === holderMetrics.indexedBalanceTotal;
  const holderLabel = holderLoading
    ? "Indexing..."
    : holderMetrics?.status === "error"
      ? "Unavailable"
      : holderReconciled
        ? "Reconciled"
        : holderMetrics?.status === "stale"
          ? "Stale"
          : "Pending";
  const holderWarning = formatWarning(holderMetrics?.warning);

  const cards = [
    {
      label: "Projects On-chain",
      value: isLoading ? "…" : projectValue,
      sub:
        catalog.status === "partial"
          ? "Partial read"
          : catalog.status === "unavailable"
            ? "Unavailable"
            : "next_project_id derived",
      icon: "solar_power",
      iconColor: "text-orange-500",
    },
    {
      label: "Tokens Minted",
      value: isLoading ? "…" : minted === null ? "—" : formatIntegerAmount(minted),
      sub: minted === null ? "Unavailable" : "Contract supply",
      icon: "token",
      iconColor: "text-emerald-600",
    },
    {
      label: "Sales Balance",
      value: isLoading ? "…" : sales === null ? "—" : formatStroopsAsXlm(sales),
      sub: sales === null ? "Unavailable" : "Native XLM",
      icon: "payments",
      iconColor: "text-emerald-600",
    },
    {
      label: "Energy Recorded",
      value: isLoading ? "…" : energy === null ? "—" : `${formatIntegerAmount(energy)} kWh`,
      sub: energy === null ? "Unavailable" : "On-chain counter",
      icon: "eco",
      iconColor: "text-emerald-600",
    },
  ];

  return (
    <section className="w-full max-w-7xl mx-auto px-5 lg:px-10 -mt-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col p-5 rounded-xl bg-white border border-emerald-100 shadow-md transition-all duration-300 hover:shadow-lg hover:border-emerald-200"
          >
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[13px] tracking-wide uppercase font-semibold">{card.label}</span>
              <span className={`material-symbols-outlined ${card.iconColor} text-[20px]`}>
                {card.icon}
              </span>
            </div>
            <span className="font-mono text-[20px] leading-[28px] lg:text-[32px] lg:leading-[40px] text-slate-900 mt-3 font-bold tracking-tight break-words">
              {card.value}
            </span>
            <span className="font-mono text-[10px] text-slate-500 mt-2">{card.sub}</span>
          </div>
        ))}

        <div className="col-span-2 lg:col-span-4 flex flex-col p-5 rounded-xl bg-white border border-emerald-100 shadow-md">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[13px] tracking-wide uppercase font-semibold text-slate-500">
                Holder Indexer
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <span className="font-mono text-[28px] font-bold text-slate-900">{holderCount}</span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
                  {holderLabel}
                </span>
              </div>
            </div>
            <div className="font-mono text-[10px] leading-relaxed text-slate-500 sm:text-right">
              {holderMetrics
                ? `${formatLastIndexed(holderMetrics.lastIndexedAt)} · ledger ${holderMetrics.latestLedger}`
                : "Waiting for the first read"}
              {holderWarning ? <div className="text-amber-700">{holderWarning}</div> : null}
              {holderMetrics && holderMetrics.contractMinted !== null
                ? `Contract minted ${formatTokenAmount(holderMetrics.contractMinted)} · indexed ${formatTokenAmount(holderMetrics.indexedBalanceTotal)}`
                : null}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[10px] font-semibold text-emerald-700">
            <span>Stellar Testnet</span>
            <a href={EXPLORER_URL} target="_blank" rel="noopener noreferrer" className="hover:underline">
              View Contract ↗
            </a>
            <a href="/proof" className="hover:underline">
              View Public Proof ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
