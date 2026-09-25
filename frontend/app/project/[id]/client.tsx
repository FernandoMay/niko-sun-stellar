"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@/lib/WalletContext";
import { CONTRACT_ID } from "@/lib/contract";
import TransactionSigningModal from "@/components/TransactionSigningModal";
import TransactionSuccess from "@/components/TransactionSuccess";

/* ──────────────────── Constants ──────────────────── */

const PROJECT = {
  contractId: CONTRACT_ID,
  name: "Parque Solar Lima Norte",
  flag: "\uD83C\uDDF5\uD83C\uDDF7",
  slug: "lima-norte",
  location: "Comas / Los Olivos, Lima",
  coords: "-11.9561, -77.0537",
  capacityKwp: 150,
  apy: 12.5,
  pricePerToken: 10, // XLM
  tokenWp: 1.5, // 1 token = 1.5 Wp
  monthlyProductionKwh: 45200, // 45.2 MWh
  co2Tons: 32.4,
  fundingPct: 85,
  totalSupply: 100_000,
  soldSupply: 85_000,
  sunarpPartida: "14829104",
  inyeccionLinea: "L\u00EDnea MT 10 kV ENEL",
  assetId: "SLN-RWA-01",
  ppaYears: 10,
  heroImage:
    "https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&h=500&fit=crop",
};

const XLM_TO_USD = 0.13;

const DIVIDENDS = [
  {
    fecha: "Sep 2026",
    kwh: "4,520",
    total: "4,250 XLM",
    rendimiento: "0.05 XLM/token",
    hash: "a3f8...9c2d",
  },
  {
    fecha: "Ago 2026",
    kwh: "4,310",
    total: "3,980 XLM",
    rendimiento: "0.047 XLM/token",
    hash: "b7e1...4f8a",
  },
  {
    fecha: "Jul 2026",
    kwh: "3,980",
    total: "3,620 XLM",
    rendimiento: "0.043 XLM/token",
    hash: "c2d9...7b3e",
  },
];

const LEGAL_DOCS = [
  { name: "PPA 10 A\u00F1os", icon: "description", ext: "pdf" },
  { name: "Contrato de Usufructo", icon: "gavel", ext: "pdf" },
  { name: "Dictamen T\u00E9cnico DNV", icon: "verified", ext: "pdf" },
  { name: "Certificado SUNARP", icon: "workspace_premium", ext: "pdf" },
];

/* ──────────────────── Helpers ──────────────────── */

function fmt(n: number, decimals = 2) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function shortAddr(a: string) {
  if (!a) return "";
  return a.slice(0, 6) + "..." + a.slice(-4);
}

/* ──────────────────── Component ──────────────────── */

export default function ProjectDetailClient({ id }: { id?: string }) {
  const {
    connected,
    address,
    balance,
    signAndSend,
    connect,
    fetchBalance,
    readContract,
  } = useWallet();

  /* ── Investment calculator state ── */
  const [currency, setCurrency] = useState<"XLM" | "USDC">("XLM");
  const [tokenCount, setTokenCount] = useState<number>(1);

  /* ── Mounted guard for hydration (prevents React #418) ── */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* ── On-chain project override (keep PROJECT as mock fallback) ── */
  const [chainProject, setChainProject] = useState<{
    pricePerToken: number;
    totalSupply: number;
    soldSupply: number;
    fundingPct: number;
    totalEnergyKwh: number;
    isReal: boolean;
  } | null>(null);
  const [claimableXlm, setClaimableXlm] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const pid = Number(id);
    if (Number.isNaN(pid)) return;
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
        const raw = await readContract(CONTRACT_ID, "get_project", [pid]);
        const p = decode(raw) as Record<string, unknown>;
        const totalSupply = BigInt((p.total_supply ?? p.totalSupply ?? 0) as string | number | bigint);
        const minted = BigInt((p.minted ?? 0) as string | number | bigint);
        const price = BigInt((p.price ?? 0) as string | number | bigint);
        const totalEnergyKwh = BigInt((p.total_energy_kwh ?? p.totalEnergyKwh ?? 0) as string | number | bigint);
        const fundingPct = totalSupply > BigInt(0) ? Number((minted * BigInt(100)) / totalSupply) : PROJECT.fundingPct;
        const pricePerToken = Number(price) / 1_000_000;
        if (!cancelled) {
          setChainProject({
            pricePerToken: pricePerToken > 0 ? pricePerToken : PROJECT.pricePerToken,
            totalSupply: Number(totalSupply) > 0 ? Number(totalSupply) : PROJECT.totalSupply,
            soldSupply: Number(minted),
            fundingPct,
            totalEnergyKwh: Number(totalEnergyKwh),
            isReal: true,
          });
        }
      } catch (e) {
        console.warn(`get_project(${pid}) failed, using mock fallback`, e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, readContract]);

  useEffect(() => {
    if (!connected || !address || !id) {
      setClaimableXlm(null);
      return;
    }
    const pid = Number(id);
    if (Number.isNaN(pid)) return;
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
        const raw = await readContract(CONTRACT_ID, "get_claimable", [address, pid]);
        const val = decode(raw);
        const bi = BigInt(val as string | number | bigint);
        if (!cancelled) setClaimableXlm((Number(bi) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 }));
      } catch (e) {
        console.warn("get_claimable failed", e);
        if (!cancelled) setClaimableXlm(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, address, id, readContract]);

  const displayProject = chainProject
    ? {
        ...PROJECT,
        pricePerToken: chainProject.pricePerToken,
        totalSupply: chainProject.totalSupply,
        soldSupply: chainProject.soldSupply,
        fundingPct: chainProject.fundingPct,
      }
    : PROJECT;
  const onChainEnergy = chainProject?.totalEnergyKwh ?? PROJECT.monthlyProductionKwh;
  const isDemoChain = !chainProject?.isReal;

  /* ── Signing modal state machine ── */
  type SigningPhase =
    | "idle"
    | "preparing"
    | "signing"
    | "submitting"
    | "success"
    | "error"
    | "rejected"
    | "insufficient_balance"
    | "wallet_missing";
  const [signingOpen, setSigningOpen] = useState(false);
  const [signingPhase, setSigningPhase] = useState<SigningPhase>("idle");
  const [signingError, setSigningError] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");

  /* ── IoT telemetry tab ── */
  const [telemetryTab, setTelemetryTab] = useState<"Hoy" | "7 D\u00EDas" | "Este Mes" | "Hist\u00F3rico">("Hoy");

  /* ── Derived calculations ── */
  const pricePerToken = displayProject.pricePerToken; // XLM (real on-chain when available)
  const costXlm = tokenCount * pricePerToken;
  const costUsd = costXlm * XLM_TO_USD;
  const capacityAdjudicada = tokenCount * displayProject.tokenWp;
  const retornoDiario = (costXlm * displayProject.apy) / 365;
  const retornoAnual = costXlm * (displayProject.apy / 100);
  const co2Mitigado = tokenCount * 0.32; // ~0.32 ton CO2 per token per year

  /* ── Handle buy: opens modal, then executes on confirm ── */
  const openSigningModal = useCallback(() => {
    if (!connected) {
      connect();
      return;
    }
    setSigningError("");
    setTxHash("");
    setSigningPhase("idle");
    setSigningOpen(true);
  }, [connected, connect]);

  const executeBuy = useCallback(async () => {
    // Edge case: wallet not connected (shouldn't happen if modal opened, but guard)
    if (!connected || !address) {
      setSigningPhase("wallet_missing");
      return;
    }

    // Edge case: insufficient balance
    const balanceNum = parseFloat(balance.replace(/,/g, ""));
    if (balanceNum < costXlm) {
      setSigningPhase("insufficient_balance");
      return;
    }

    setSigningPhase("preparing");

    try {
      await new Promise((r) => setTimeout(r, 300));

      // ── Purchase tokens ──
      // contract: purchase_tokens(buyer: Address, project_id: u64, amount: u128)
      setSigningPhase("signing");
      const projectIdForTx = BigInt(Number(id) || 1);
      const { txHash: hash } = await signAndSend(
        CONTRACT_ID,
        "purchase_tokens",
        [address, projectIdForTx, BigInt(tokenCount)]
      );

      setTxHash(hash);
      setSigningPhase("success");
      fetchBalance();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      // Detect Freighter rejection (user closed popup without signing)
      if (
        msg.includes("reject") ||
        msg.includes("cancel") ||
        msg.includes("decline") ||
        msg.includes("User declined") ||
        msg.includes("denied") ||
        msg.includes("Request closed")
      ) {
        setSigningPhase("rejected");
      }
      // Detect Freighter not installed
      else if (
        msg.includes("not installed") ||
        msg.includes("freighter") ||
        msg.includes("Freighter") ||
        msg.includes("is not defined") ||
        msg.includes("window.freighter")
      ) {
        setSigningPhase("wallet_missing");
      }
      // Detect insufficient balance
      else if (
        msg.includes("insufficient") ||
        msg.includes("balance") ||
        msg.includes("underfunded") ||
        msg.includes("NOT_ENOUGH_BALANCE")
      ) {
        setSigningPhase("insufficient_balance");
      }
      // Detect contract failure (on-chain panic)
      else if (msg.includes("Transaction failed on-chain")) {
        setSigningError(msg);
        setSigningPhase("error");
      }
      // All other errors
      // All other errors
      else {
        setSigningError(msg);
        setSigningPhase("error");
      }
    }
  }, [
    connected,
    address,
    balance,
    costXlm,
    tokenCount,
    pricePerToken,
    signAndSend,
    id,
  ]);

  /* ── SVG solar curve data ── */
  const solarPoints = [
    0, 12, 35, 62, 85, 100, 110, 115, 118, 118, 114, 105, 92, 74, 52, 30,
    14, 0,
  ];

  return (
    <div className="relative min-h-screen bg-slate-50 font-body text-slate-900">
      {/* ═══════════ A) Ambient glow background ═══════════ */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[600px] w-[900px] rounded-full bg-gradient-to-br from-emerald-200/25 via-emerald-100/15 to-transparent blur-[160px]" />
        <div className="absolute top-1/3 -right-20 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-orange-200/20 via-amber-100/10 to-transparent blur-[140px]" />
        <div className="absolute bottom-0 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-t from-emerald-100/20 to-transparent blur-[120px]" />
      </div>

      {/* ═══════════ B) Fixed header ═══════════ */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 lg:px-10">
          <a
            href="/"
            className="flex items-center gap-2 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-900"
          >
            <span className="material-symbols-outlined text-[18px]">
              arrow_back
            </span>
            Volver al Directorio
          </a>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600" />
              </span>
              En Operaci\u00F3n Comercial (PPA 10 A\u00F1os)
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Stellar Testnet
            </span>
          </div>
        </div>
      </header>

      {/* ═══════════ Main ═══════════ */}
      <main className="mx-auto max-w-7xl px-5 lg:px-10 pt-20 pb-20">
        {/* ═══════════ C) Breadcrumb ═══════════ */}
        <nav className="mb-6 flex items-center gap-2 text-[13px] text-slate-500">
          <a href="/" className="hover:text-slate-900 transition-colors">
            Proyectos Solares
          </a>
          <span className="material-symbols-outlined text-[14px]">
            chevron_right
          </span>
          <span>Per&uacute;</span>
          <span className="material-symbols-outlined text-[14px]">
            chevron_right
          </span>
          <span className="font-medium text-slate-900">
            Lima Norte (150 kWp)
          </span>
          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
            <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
            IoT Oracle Activo
          </span>
        </nav>

        {/* ═══════════ D) Project header ═══════════ */}
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              PPA Activo &mdash; 10 A&ntilde;os
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
              <span className="material-symbols-outlined text-[12px]">
                verified
              </span>
              Auditor&iacute;a Legal Verificada
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Asset ID: {PROJECT.assetId}
            </span>
          </div>

          <h1 className="font-display text-[32px] font-bold leading-tight text-slate-900 lg:text-[42px]">
            {PROJECT.name} {PROJECT.flag}
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-slate-600">
            Parque solar fotovoltaico de 150 kWp en Lima Norte, con Power
            Purchase Agreement (PPA) a 10 a&ntilde;os. Producci&oacute;n verificada por IoT
            en tiempo real, dividendos distribuidos on-chain via smart contracts
            Soroban en la red Stellar.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50">
              <span className="material-symbols-outlined text-[16px]">
                description
              </span>
              Ficha T\u00E9cnica PDF
            </button>
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[16px]">
                open_in_new
              </span>
              Ver en Soroban Explorer
            </a>
            <span className="font-mono text-[11px] text-slate-400">
              {shortAddr(CONTRACT_ID)}
            </span>
          </div>
        </div>

        {/* ═══════════ E) 6-metric banner grid ═══════════ */}
        <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              icon: "solar_power",
              label: "Capacidad",
              value: `${displayProject.capacityKwp} kWp`,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              icon: "trending_up",
              label: "APY",
              value: "12.5%",
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              icon: "token",
              label: "Precio",
              value: `${displayProject.pricePerToken} XLM`,
              color: "text-orange-600",
              bg: "bg-orange-50",
            },
            {
              icon: "bolt",
              label: "Producci\u00F3n",
              value: `${(onChainEnergy / 1000).toFixed(1)} MWh`,
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              icon: "eco",
              label: "CO\u2082",
              value: "32.4 Ton",
              color: "text-emerald-600",
              bg: "bg-emerald-50",
            },
            {
              icon: "account_balance",
              label: "Fondeo",
              value: `${displayProject.fundingPct}%`,
              color: "text-emerald-600",
              bg: "bg-emerald-50",
              extra: (
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${displayProject.fundingPct}%` }}
                  />
                </div>
              ),
            },
          ].map((m, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span
                className={`material-symbols-outlined mb-1.5 text-[20px] ${m.color}`}
              >
                {m.icon}
              </span>
              <div className="text-[12px] font-medium text-slate-500">
                {m.label}
              </div>
              <div className="font-mono text-[18px] font-bold text-slate-900">
                {m.value}
              </div>
              {m.extra}
            </div>
          ))}
        </div>

        {/* ═══════════ F) 2-column layout ═══════════ */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* ──── LEFT COLUMN (8 cols) ──── */}
          <div className="space-y-8 lg:col-span-8">
            {/* Hero image */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-lg">
              <img
                src={PROJECT.heroImage}
                alt="Parque Solar Lima Norte"
                className="h-[320px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />
              <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                  <span className="material-symbols-outlined text-[14px]">
                    router
                  </span>
                  NODO #04
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-white/20 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
                  <span className="material-symbols-outlined text-[14px]">
                    electric_bolt
                  </span>
                  Inyecci&oacute;n de Red: 118.4 kW
                </span>
              </div>
            </div>

            {/* Location metadata */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-display text-[16px] font-bold text-slate-900">
                Informaci&oacute;n del Activo
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Ubicaci&oacute;n
                  </div>
                  <div className="text-[14px] font-medium text-slate-900">
                    {PROJECT.location}
                  </div>
                  <div className="mt-1 font-mono text-[12px] text-slate-500">
                    {PROJECT.coords}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    SUNARP
                  </div>
                  <div className="text-[14px] font-medium text-slate-900">
                    Partida N&deg; {PROJECT.sunarpPartida}
                  </div>
                  <div className="mt-1 font-mono text-[12px] text-slate-500">
                    Registro de Propiedad
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Punto de Inyecci&oacute;n
                  </div>
                  <div className="text-[14px] font-medium text-slate-900">
                    {PROJECT.inyeccionLinea}
                  </div>
                  <div className="mt-1 font-mono text-[12px] text-slate-500">
                    ENEL Distribuci&oacute;n
                  </div>
                </div>
              </div>
            </div>

            {/* IoT Telemetry section */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-display text-[16px] font-bold text-slate-900">
                  <span className="material-symbols-outlined text-[20px] text-emerald-600">
                    sensors
                  </span>
                  Telemetr&iacute;a IoT en Tiempo Real
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <span className="material-symbols-outlined text-[10px]">
                    key
                  </span>
                  Firma Ed25519
                </span>
              </div>

              {/* Time switcher tabs */}
              <div className="mb-5 flex gap-1 rounded-lg bg-slate-100 p-1">
                {(["Hoy", "7 D\u00EDas", "Este Mes", "Hist\u00F3rico"] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      onClick={() => setTelemetryTab(tab)}
                      className={`flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-all ${
                        telemetryTab === tab
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {tab}
                    </button>
                  )
                )}
              </div>

              {/* 4 live gauges */}
              <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: "Potencia",
                    value: "118.4",
                    unit: "kW",
                    icon: "bolt",
                    color: "text-amber-600",
                  },
                  {
                    label: "Irradiancia",
                    value: "940",
                    unit: "W/m\u00B2",
                    icon: "wb_sunny",
                    color: "text-orange-500",
                  },
                  {
                    label: "Temp.",
                    value: "42.1",
                    unit: "\u00B0C",
                    icon: "thermostat",
                    color: "text-red-500",
                  },
                  {
                    label: "Eficiencia",
                    value: "98.2",
                    unit: "%",
                    icon: "speed",
                    color: "text-emerald-600",
                  },
                ].map((g, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-center"
                  >
                    <span
                      className={`material-symbols-outlined mb-1 text-[18px] ${g.color}`}
                    >
                      {g.icon}
                    </span>
                    <div className="font-mono text-[22px] font-bold text-slate-900">
                      {g.value}
                      <span className="ml-0.5 text-[12px] font-medium text-slate-500">
                        {g.unit}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">{g.label}</div>
                  </div>
                ))}
              </div>
              {/* Gauge DEMO badge — on-chain anchor */}
              <div
                className={`mb-5 flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-mono ${
                  isDemoChain
                    ? "bg-amber-50 border-amber-200 text-amber-700"
                    : "bg-emerald-50 border-emerald-200 text-emerald-700"
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">
                  {isDemoChain ? "science" : "verified"}
                </span>
                {isDemoChain
                  ? `DEMO • Simulado — último anclaje on-chain: ${onChainEnergy.toLocaleString("en-US")} kWh`
                  : `Anclaje on-chain: ${onChainEnergy.toLocaleString("en-US")} kWh`}
                {claimableXlm != null && connected && (
                  <span className="ml-auto font-bold">claimable: {claimableXlm} XLM</span>
                )}
              </div>

              {/* SVG solar production curve */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-2 text-[12px] font-medium text-slate-500">
                  Curva de Producci&oacute;n Solar &mdash; {telemetryTab}
                </div>
                <svg
                  viewBox="0 0 360 120"
                  className="h-32 w-full"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <linearGradient
                      id="solarGrad"
                      x1="0%"
                      y1="0%"
                      x2="0%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#059669" stopOpacity="0.4" />
                      <stop
                        offset="100%"
                        stopColor="#059669"
                        stopOpacity="0.02"
                      />
                    </linearGradient>
                  </defs>
                  <path
                    d={`M0,${120 - (solarPoints[0] / 120) * 120} ${solarPoints
                      .map(
                        (p, i) =>
                          `L${(i / (solarPoints.length - 1)) * 360},${
                            120 - (p / 120) * 120
                          }`
                      )
                      .join(" ")} L360,120 L0,120 Z`}
                    fill="url(#solarGrad)"
                  />
                  <path
                    d={`M0,${120 - (solarPoints[0] / 120) * 120} ${solarPoints
                      .map(
                        (p, i) =>
                          `L${(i / (solarPoints.length - 1)) * 360},${
                            120 - (p / 120) * 120
                          }`
                      )
                      .join(" ")}`}
                    stroke="#059669"
                    strokeWidth="2"
                    fill="none"
                  />
                  {/* current point */}
                  <circle
                    cx="200"
                    cy={120 - (118 / 120) * 120}
                    r="4"
                    fill="#059669"
                  />
                  <text
                    x="206"
                    y={120 - (118 / 120) * 120 - 6}
                    fill="#059669"
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                  >
                    118.4 kW
                  </text>
                </svg>
              </div>
            </div>

            {/* Legal & Financial Architecture (RWA) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-display text-[16px] font-bold text-slate-900">
                Arquitectura Legal y Financiera (RWA)
              </h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: "handshake",
                    title: "Off-taker",
                    desc: "ENEL Distribuci\u00F3n Per\u00FA. Contrato PPA 10 a\u00F1os a tarifa indexada. Compromiso de compra garantizado.",
                    accent: "border-l-emerald-500",
                  },
                  {
                    icon: "account_balance",
                    title: "Fideicomiso Bancario",
                    desc: "Banco de Cr\u00E9dito del Per\u00FA (BCP). Fondo fiduciario segregado para distribuci\u00F3n de dividendos a token holders.",
                    accent: "border-l-blue-500",
                  },
                  {
                    icon: "verified",
                    title: "Auditor\u00EDa T\u00E9cnica DNV",
                    desc: "DNV GL certificada. Inspecci\u00F3n semestral de paneles, inversores y medici\u00F3n IoT independiente.",
                    accent: "border-l-orange-500",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border border-slate-100 border-l-4 ${item.accent} bg-slate-50 p-4`}
                  >
                    <span className="material-symbols-outlined mb-2 text-[24px] text-slate-700">
                      {item.icon}
                    </span>
                    <div className="mb-1 font-display text-[14px] font-bold text-slate-900">
                      {item.title}
                    </div>
                    <div className="text-[13px] leading-relaxed text-slate-600">
                      {item.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dividend Distribution table */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-display text-[16px] font-bold text-slate-900">
                Distribuci&oacute;n de Dividendos
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="pb-2 pr-4 font-semibold text-slate-500">
                        Fecha
                      </th>
                      <th className="pb-2 pr-4 font-semibold text-slate-500">
                        kWh
                      </th>
                      <th className="pb-2 pr-4 font-semibold text-slate-500">
                        Total
                      </th>
                      <th className="pb-2 pr-4 font-semibold text-slate-500">
                        Rendimiento/Token
                      </th>
                      <th className="pb-2 font-semibold text-slate-500">
                        Hash Stellar
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {DIVIDENDS.map((d, i) => (
                      <tr
                        key={i}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-3 pr-4 font-medium text-slate-900">
                          {d.fecha}
                        </td>
                        <td className="py-3 pr-4 font-mono text-slate-700">
                          {d.kwh}
                        </td>
                        <td className="py-3 pr-4 font-mono font-semibold text-emerald-600">
                          {d.total}
                        </td>
                        <td className="py-3 pr-4 font-mono text-slate-700">
                          {d.rendimiento}
                        </td>
                        <td className="py-3">
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-mono text-[12px] text-slate-600">
                            <span className="material-symbols-outlined text-[12px] text-emerald-600">
                              link
                            </span>
                            {d.hash}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Downloadable Legal Documents */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 font-display text-[16px] font-bold text-slate-900">
                Documentos Legales Descargables
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {LEGAL_DOCS.map((doc, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-4 transition-colors hover:bg-slate-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[20px] text-red-500">
                        {doc.icon}
                      </span>
                      <div>
                        <div className="text-[13px] font-medium text-slate-900">
                          {doc.name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-400 uppercase">
                          .{doc.ext}
                        </div>
                      </div>
                    </div>
                    <button className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50">
                      <span className="material-symbols-outlined text-[14px]">
                        download
                      </span>
                      Descargar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ──── RIGHT COLUMN (4 cols, sticky) ──── */}
          <div className="lg:col-span-4">
            <div className="sticky top-20 space-y-4">
              {/* Investment widget card */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                {/* Card header */}
                <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-orange-50 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-[14px] font-bold text-slate-900">
                      Inversi&oacute;n Directa Soroban
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                      <span className="material-symbols-outlined text-[12px]">
                        trending_up
                      </span>
                      12.5% APY
                    </span>
                  </div>
                </div>

                {/* Currency selector */}
                <div className="px-6 pt-5">
                  <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1">
                    {(["XLM", "USDC"] as const).map((c) => (
                      <button
                        key={c}
                        onClick={() => setCurrency(c)}
                        className={`flex-1 rounded-md py-1.5 text-[12px] font-semibold transition-all ${
                          currency === c
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Token input + pills */}
                <div className="px-6 pb-4">
                  <label className="mb-1.5 block text-[12px] font-medium text-slate-500">
                    Cantidad de Tokens
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={tokenCount}
                    onChange={(e) =>
                      setTokenCount(Math.max(1, parseInt(e.target.value) || 1))
                    }
                    className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[24px] font-bold text-slate-900 outline-none transition-all focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <div className="mb-4 flex gap-2">
                    {[10, 50, 100].map((n) => (
                      <button
                        key={n}
                        onClick={() => setTokenCount(n)}
                        className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[12px] font-semibold text-slate-600 transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        +{n}
                      </button>
                    ))}
                    <button
                      onClick={() => setTokenCount(PROJECT.totalSupply - PROJECT.soldSupply)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[12px] font-semibold text-slate-600 transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                    >
                      M&aacute;x
                    </button>
                  </div>
                </div>

                {/* Real-time calculated metrics */}
                <div className="mx-6 mb-4 space-y-2 rounded-xl bg-slate-50 p-4">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-slate-500">Costo Total</span>
                    <span className="font-mono font-bold text-slate-900">
                      {fmt(costXlm, 0)} XLM
                      <span className="ml-1 text-[11px] font-normal text-slate-400">
                        (${fmt(costUsd)} USD)
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-slate-500">
                      Capacidad Adjudicada
                    </span>
                    <span className="font-mono font-bold text-emerald-600">
                      {fmt(capacityAdjudicada, 1)} Wp
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-slate-500">Retorno Diario</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {fmt(retornoDiario)} XLM
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-slate-500">Retorno Anual</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {fmt(retornoAnual)} XLM
                    </span>
                  </div>
                  <div className="flex justify-between text-[13px]">
                    <span className="text-slate-500">CO&#x2082; Mitigado</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {fmt(co2Mitigado, 2)} ton/a&ntilde;o
                    </span>
                  </div>
                </div>

                {/* Wallet pill */}
                <div className="px-6 pb-4">
                  {!mounted ? (
                    <div className="mb-3 flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-2">
                      <span className="h-4 w-4 rounded-full bg-slate-200 animate-pulse" />
                    </div>
                  ) : connected ? (
                    <div className="mb-3 flex items-center justify-between rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="font-mono text-[12px] font-medium text-emerald-700">
                          {shortAddr(address || "")}
                        </span>
                      </div>
                      <span className="font-mono text-[12px] text-slate-500">
                        {balance} XLM
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={connect}
                      className="mb-3 flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-2 text-[13px] font-medium text-slate-600 transition-all hover:bg-slate-100"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        account_balance_wallet
                      </span>
                      Conectar Freighter
                    </button>
                  )}
                </div>

                {/* CTA button */}
                <div className="px-6 pb-5">
                  <button
                    onClick={openSigningModal}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 hover:shadow-xl active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      lock
                    </span>
                    Confirmar y Firmar en Stellar
                  </button>
                </div>

                {/* 3 micro-guarantees */}
                <div className="border-t border-slate-100 px-6 py-4">
                  <div className="space-y-2">
                    {[
                      {
                        icon: "shield",
                        text: "Sin custodia — tu clave, tus tokens",
                      },
                      {
                        icon: "swap_horiz",
                        text: "Mercado secundario DEX (Soroswap)",
                      },
                      {
                        icon: "token",
                        text: "Certificado NFT por cada token",
                      },
                    ].map((g, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-[11px] text-slate-500"
                      >
                        <span className="material-symbols-outlined text-[14px] text-emerald-600">
                          {g.icon}
                        </span>
                        {g.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Asesor&iacute;a Institucional support box */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-slate-600">
                    support_agent
                  </span>
                  <span className="font-display text-[14px] font-bold text-slate-900">
                    Asesor&iacute;a Institucional
                  </span>
                </div>
                <p className="mb-3 text-[12px] leading-relaxed text-slate-500">
                  Inversores institucionales: contáctanos para allocations
                  dedicados, estructura legal personalizada y onboarding
                  corporativo.
                </p>
                <button className="w-full rounded-lg border border-slate-200 bg-white py-2 text-[12px] font-semibold text-slate-700 transition-all hover:bg-slate-50">
                  Contactar Equipo
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ═══════════ Signing Modal ═══════════ */}
      <TransactionSigningModal
        open={signingOpen}
        onClose={() => {
          setSigningOpen(false);
          // Reset to idle after close animation
          setTimeout(() => setSigningPhase("idle"), 200);
        }}
        onConfirm={executeBuy}
        phase={signingPhase}
        errorMessage={signingError}
        projectName={displayProject.name}
        projectFlag={displayProject.flag}
        assetId={displayProject.assetId}
        tokenCount={tokenCount}
        costXlm={costXlm}
        costUsd={costUsd}
        apy={displayProject.apy}
        capacityWp={capacityAdjudicada}
        walletAddress={address || ""}
        walletBalance={balance}
        contractId={CONTRACT_ID}
      />

      {/* ═══════════ Success Screen ═══════════ */}
      <TransactionSuccess
        open={signingPhase === "success" && !!txHash}
        onClose={() => {
          setSigningOpen(false);
          setSigningPhase("idle");
          setTxHash("");
        }}
        txHash={txHash}
        tokenCount={tokenCount}
        costXlm={costXlm}
        costUsd={costUsd}
        projectName={displayProject.name}
        projectFlag={displayProject.flag}
        assetId={displayProject.assetId}
        walletAddress={address || ""}
        apy={displayProject.apy}
        capacityWp={capacityAdjudicada}
        contractId={CONTRACT_ID}
      />
    </div>
  );
}
