"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/WalletContext";
import { CONTRACT_ID, EXPLORER_URL, LEDGER_EXPLORER_URL } from "@/lib/contract";
import { useHolderMetrics } from "@/hooks/useHolderMetrics";
import {
  formatHolderCount,
  formatLastIndexed,
  formatTokenAmount,
  formatWarning,
} from "@/lib/holderIndexer";

type ChainMetrics = {
  totalTokenizedXlm: string | null;
  projectsCount: number | null;
  energyKwh: string | null;
};

function parseChainBigInt(value: unknown): bigint | null {
  if (typeof value === "bigint") return value >= BigInt(0) ? value : null;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  return null;
}

function formatScaledBigInt(
  value: bigint,
  decimalPlaces: number,
  maxFractionDigits: number
): string {
  const sign = value < BigInt(0) ? "-" : "";
  const absolute = value < BigInt(0) ? -value : value;
  const scale = BigInt(10) ** BigInt(decimalPlaces);
  const whole = absolute / scale;
  const fraction = (absolute % scale)
    .toString()
    .padStart(decimalPlaces, "0")
    .slice(0, maxFractionDigits)
    .replace(/0+$/, "");
  return `${sign}${formatTokenAmount(whole)}${fraction ? `.${fraction}` : ""}`;
}

function formatTokenizedXlm(value: bigint): string | null {
  const xlmMilli = value / BigInt(1_000);
  if (xlmMilli === BigInt(0)) return null;
  const xlmWhole = xlmMilli / BigInt(1_000);
  if (xlmWhole >= BigInt(1_000_000)) {
    return `$${formatScaledBigInt(xlmWhole, 6, 1)}M`;
  }
  if (xlmWhole >= BigInt(1_000)) {
    return `${formatScaledBigInt(xlmWhole, 3, 1)}k XLM`;
  }
  return `${formatScaledBigInt(value, 6, 6)} XLM`;
}

export default function StatsBar() {
  const { readContract } = useWallet();
  const { metrics: holderMetrics, loading: holderLoading } = useHolderMetrics();
  const [chain, setChain] = useState<ChainMetrics>({
    totalTokenizedXlm: null,
    projectsCount: null,
    energyKwh: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const isDemoChain = chain.totalTokenizedXlm == null && chain.projectsCount == null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sdk = await import("@stellar/stellar-sdk");
        const decode = (val: unknown) => {
          try {
            return (sdk as unknown as { scValToNative: (v: unknown) => unknown }).scValToNative(val as never);
          } catch {
            return val;
          }
        };
        let projectCount: number | null = null;
        try {
          const rawNext = await readContract(CONTRACT_ID, "next_project_id", []);
          const nextValue = parseChainBigInt(decode(rawNext));
          if (nextValue !== null && nextValue <= BigInt(Number.MAX_SAFE_INTEGER)) {
            projectCount = Math.max(0, Number(nextValue) - 1);
          }
        } catch {
          projectCount = null;
        }
        const ids =
          projectCount === null
            ? []
            : Array.from({ length: Math.min(projectCount, 12) }, (_, index) => index + 1);
        let totalValue = BigInt(0);
        let totalEnergy = BigInt(0);
        let successCount = 0;
        for (const id of ids) {
          try {
            const raw = await readContract(CONTRACT_ID, "get_project", [id]);
            const p = decode(raw) as Record<string, unknown>;
            const totalSupply = parseChainBigInt(p.total_supply ?? p.totalSupply);
            const price = parseChainBigInt(p.price);
            const energy = parseChainBigInt(
              p.total_energy_kwh ?? p.totalEnergyKwh
            );
            if (totalSupply === null || price === null || energy === null) continue;
            totalValue += totalSupply * price;
            totalEnergy += energy;
            successCount++;
          } catch {
            // A failed project read does not fabricate a project value.
          }
        }
        try {
          await readContract(CONTRACT_ID, "get_total_sales", []);
        } catch {
          // This optional read is not used as a holder-count source.
        }
        if (cancelled) return;
        setChain({
          totalTokenizedXlm: formatTokenizedXlm(totalValue),
          projectsCount:
            projectCount !== null && projectCount <= 12 && successCount > 0
              ? successCount
              : null,
          energyKwh:
            totalEnergy > BigInt(0) ? formatTokenAmount(totalEnergy) : null,
        });
      } catch (e) {
        console.warn("StatsBar chain fetch failed", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [readContract]);

  const staticCards = [
    {
      label: "Total Tokenizado",
      value: chain.totalTokenizedXlm ?? "$2.4M+",
      sub: chain.totalTokenizedXlm != null ? "Testnet · On-chain (supply×price)" : "Testnet · Represented",
      subColor: "text-emerald-700",
      icon: "monetization_on",
      iconColor: "text-emerald-600",
      isDemo: chain.totalTokenizedXlm == null,
    },
    {
      label: "Proyectos Activos",
      value: chain.projectsCount != null ? String(chain.projectsCount) : "12",
      sub: "Auditados y Conectados a Red",
      subColor: "text-orange-600",
      icon: "solar_power",
      iconColor: "text-orange-500",
      isDemo: chain.projectsCount == null,
    },
  ];

  const energyCard = {
    label: "Energía Limpia",
    value: chain.energyKwh ?? "1.2M",
    unit: "kWh",
    sub: "890 Toneladas CO₂ Evitadas",
    subColor: "text-emerald-700",
    icon: "eco",
    iconColor: "text-emerald-600",
    isDemo: chain.energyKwh == null,
  };

  const holderCountValue =
    holderMetrics?.holderCount !== null && holderMetrics?.holderCount !== undefined
      ? formatHolderCount(holderMetrics.holderCount)
      : "—";
  const holderIsStale =
    holderMetrics?.status === "stale" ||
    (holderMetrics?.isStale === true && holderMetrics?.status !== "error");
  const holderIsReconciled =
    holderMetrics !== null &&
    holderMetrics.reconciled === true &&
    holderMetrics.status === "indexed" &&
    holderMetrics.holderCount !== null &&
    holderMetrics.contractMinted === holderMetrics.indexedBalanceTotal &&
    !holderIsStale;
  const holderIsPending =
    holderMetrics?.status === "reconciling" && !holderIsReconciled;
  const holderIsUnavailable = holderMetrics?.status === "error";
  const showIndexing =
    !holderIsReconciled &&
    !holderIsPending &&
    !holderIsStale &&
    !holderIsUnavailable;
  const holderStateLabel = holderIsReconciled
    ? "Reconciled"
    : holderIsPending
      ? "Reconciliation pending"
      : holderIsStale
        ? "Stale"
        : holderIsUnavailable
          ? "Unavailable"
          : "Indexing...";
  const holderWarning = formatWarning(holderMetrics?.warning);
  const showHolderValue =
    !showIndexing && !holderIsPending && !holderIsUnavailable;

  return (
    <section className="w-full max-w-7xl mx-auto px-5 lg:px-10 -mt-3">
      {isDemoChain && !isLoading && (
        <div className="mb-3 flex justify-end">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-50 border border-amber-200 text-amber-700">
            DEMO • Testnet
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {staticCards.map((m, i) => (
          <div
            key={i}
            className="flex flex-col p-5 rounded-xl bg-white border border-emerald-100 shadow-md transition-all duration-300 hover:shadow-lg hover:border-emerald-200 relative"
            style={isLoading ? { opacity: 0.85 } : undefined}
          >
            {m.isDemo && !isLoading && (
              <span className="absolute top-2 right-2 px-1 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-50 border border-amber-200 text-amber-700">
                DEMO
              </span>
            )}
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-[13px] tracking-wide uppercase font-semibold text-slate-500">{m.label}</span>
              <span className={`material-symbols-outlined ${m.iconColor} text-[20px]`}>{m.icon}</span>
            </div>
            <span className="font-mono text-[20px] leading-[28px] lg:text-[40px] lg:leading-[48px] text-slate-900 mt-3 font-bold tracking-tight">
              {m.value}
            </span>
            <span className={`font-mono text-[11px] ${m.subColor} font-semibold mt-2`}>{m.sub}</span>
          </div>
        ))}

        {/* Holder card — dynamic, no hardcoded number */}
        <div className="flex flex-col p-5 rounded-xl bg-white border border-emerald-100 shadow-md transition-all duration-300 hover:shadow-lg hover:border-emerald-200 relative">
          {!holderIsReconciled && !holderLoading ? (
            <span className="absolute top-2 right-2 px-1 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-50 border border-amber-200 text-amber-700">
              {holderStateLabel}
            </span>
          ) : null}
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[13px] tracking-wide uppercase font-semibold text-slate-500">
              Inversores Globales
            </span>
            <span className="material-symbols-outlined text-amber-600 text-[20px]">group</span>
          </div>
          <span className="font-mono text-[20px] leading-[28px] lg:text-[40px] lg:leading-[48px] text-slate-900 mt-3 font-bold tracking-tight inline-flex items-baseline gap-2">
            {showHolderValue ? (
              holderCountValue
            ) : (
              <span className="inline-flex items-center gap-2">
                <span>—</span>
                <span className="font-mono text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 animate-pulse">
                  {holderStateLabel}
                </span>
              </span>
            )}
          </span>
          <span className="font-mono text-[11px] text-amber-700 font-semibold mt-2">
            {holderIsPending
              ? `Contract minted ${formatTokenAmount(holderMetrics?.contractMinted)} · indexed ${formatTokenAmount(holderMetrics?.indexedBalanceTotal)}`
              : holderIsUnavailable
                ? "Holder metrics unavailable"
                : "Cobrando Rendimientos Diarios"}
          </span>
          {holderWarning ? (
            <span className="font-mono text-[10px] text-amber-700 leading-relaxed mt-1">
              {holderWarning}
            </span>
          ) : null}
          <span className="font-mono text-[10px] text-slate-500 mt-1">
            {holderMetrics?.lastIndexedAt
              ? `${holderStateLabel} ${formatLastIndexed(holderMetrics.lastIndexedAt)}${holderMetrics.latestLedger > 0 ? ` · ledger ${holderMetrics.latestLedger}` : ""}`
              : `${holderStateLabel} —`}
          </span>
          <div className="font-mono text-[10px] text-emerald-700 hover:text-emerald-800 hover:underline mt-1 inline-flex items-center gap-2">
            <span>Stellar Testnet</span>
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1"
            >
              View Contract
              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
            </a>
            <a
              href={LEDGER_EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1"
            >
              View Ledger
              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
            </a>
          </div>
        </div>

        <div
          className="flex flex-col p-5 rounded-xl bg-white border border-emerald-100 shadow-md transition-all duration-300 hover:shadow-lg hover:border-emerald-200 relative"
          style={isLoading ? { opacity: 0.85 } : undefined}
        >
          {energyCard.isDemo && !isLoading && (
            <span className="absolute top-2 right-2 px-1 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-50 border border-amber-200 text-amber-700">
              DEMO
            </span>
          )}
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[13px] tracking-wide uppercase font-semibold text-slate-500">{energyCard.label}</span>
            <span className={`material-symbols-outlined ${energyCard.iconColor} text-[20px]`}>{energyCard.icon}</span>
          </div>
          <span className="font-mono text-[20px] leading-[28px] lg:text-[40px] lg:leading-[48px] text-slate-900 mt-3 font-bold tracking-tight">
            {energyCard.value}
            {energyCard.unit && (
              <span className="text-[20px] font-normal text-slate-500"> {energyCard.unit}</span>
            )}
          </span>
          <span className={`font-mono text-[11px] ${energyCard.subColor} font-semibold mt-2`}>{energyCard.sub}</span>
        </div>
      </div>
    </section>
  );
}
