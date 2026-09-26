"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/lib/WalletContext";
import { CONTRACT_ID, EXPLORER_URL } from "@/lib/contract";
import TransactionSigningModal from "@/components/TransactionSigningModal";
import TransactionSuccess from "@/components/TransactionSuccess";
import {
  boundedPercent,
  formatIntegerAmount,
  formatStroopsAsXlm,
  parseTransferAmount,
  parseUnsignedBigInt,
} from "@/lib/amounts";
import {
  readProjectCatalog,
  type ProjectCatalog,
} from "@/lib/contractData";

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

const EMPTY_CATALOG: ProjectCatalog = {
  status: "unavailable",
  nextProjectId: null,
  projectIds: [],
  projects: [],
  unavailableProjectIds: [],
  error: null,
};

function parseProjectId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = parseUnsignedBigInt(value);
  if (parsed === null || parsed < 1n || parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    return null;
  }
  return Number(parsed);
}

function shortAddress(value: string | null | undefined) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "—";
}

export default function ProjectDetailClient({
  id,
  staticName,
}: {
  id?: string;
  /** Static project name from `PROJECT_SEO`; renders the H1 before any RPC read. */
  staticName?: string | null;
}) {
  const {
    connected,
    address,
    balance,
    signAndSend,
    connect,
    fetchBalance,
    readContract,
  } = useWallet();
  const projectId = useMemo(() => parseProjectId(id), [id]);
  const [catalog, setCatalog] = useState<ProjectCatalog>(EMPTY_CATALOG);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claimable, setClaimable] = useState<bigint | null>(null);
  const [tokenInput, setTokenInput] = useState("1");
  const [signingOpen, setSigningOpen] = useState(false);
  const [signingPhase, setSigningPhase] = useState<SigningPhase>("idle");
  const [signingError, setSigningError] = useState("");
  const [txHash, setTxHash] = useState("");

  const refreshProject = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await readProjectCatalog(readContract, CONTRACT_ID);
      setCatalog(next);
    } catch {
      setCatalog(EMPTY_CATALOG);
      setLoadError("Project state is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [readContract]);

  useEffect(() => {
    void refreshProject();
  }, [refreshProject]);

  const project = useMemo(
    () => catalog.projects.find((item) => item.id === projectId) ?? null,
    [catalog.projects, projectId]
  );
  const projectKnown =
    projectId !== null && catalog.projectIds.includes(projectId);

  const refreshClaimable = useCallback(async () => {
    if (!connected || !address || !projectKnown) {
      setClaimable(null);
      return;
    }
    try {
      const value = await readContract(CONTRACT_ID, "get_claimable", [address, projectId]);
      const amount = parseUnsignedBigInt(value);
      setClaimable(amount);
    } catch {
      setClaimable(null);
    }
  }, [address, connected, projectId, projectKnown, readContract]);

  useEffect(() => {
    void refreshClaimable();
  }, [refreshClaimable]);

  const tokenAmount = parseUnsignedBigInt(tokenInput);
  const remaining =
    project?.totalSupply !== null &&
    project?.totalSupply !== undefined &&
    project.minted !== null
      ? project.totalSupply > project.minted
        ? project.totalSupply - project.minted
        : 0n
      : null;
  const rawCost =
    project?.price !== null && project?.price !== undefined && tokenAmount !== null
      ? project.price * tokenAmount
      : null;
  const costStroops = parseTransferAmount(rawCost);
  const purchaseStateReady =
    project !== null &&
    project.creator !== null &&
    project.totalSupply !== null &&
    project.minted !== null &&
    project.minPurchase !== null &&
    project.price !== null &&
    project.active !== null;
  const purchaseValid =
    purchaseStateReady &&
    project !== null &&
    project.minPurchase !== null &&
    project.active === true &&
    tokenAmount !== null &&
    tokenAmount >= project.minPurchase &&
    remaining !== null &&
    tokenAmount <= remaining &&
    costStroops !== null &&
    costStroops > 0n;
  const progress =
    project?.totalSupply !== null &&
    project?.totalSupply !== undefined &&
    project.minted !== null
      ? boundedPercent(project.minted, project.totalSupply)
      : null;

  const handleConnect = async () => {
    try {
      await connect();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setSigningError(message);
      setSigningPhase(
        /freighter|not installed|is not defined|requestAccess|request access/i.test(message)
          ? "wallet_missing"
          : "error"
      );
      setSigningOpen(true);
    }
  };

  const openSigning = async () => {
    if (!projectKnown || !purchaseValid) return;
    if (!connected) {
      await handleConnect();
      return;
    }
    setSigningError("");
    setTxHash("");
    setSigningPhase("idle");
    setSigningOpen(true);
  };

  const executePurchase = useCallback(async () => {
    if (
      !connected ||
      !address ||
      !projectKnown ||
      !purchaseValid ||
      projectId === null ||
      tokenAmount === null ||
      costStroops === null
    ) {
      return;
    }

    setSigningPhase("preparing");
    try {
      setSigningPhase("signing");
      const result = await signAndSend(CONTRACT_ID, "purchase_tokens", [
        address,
        projectId,
        tokenAmount,
      ]);
      setTxHash(result.txHash);
      setSigningPhase("success");
      await Promise.all([refreshProject(), refreshClaimable(), fetchBalance()]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      if (/reject|cancel|decline|denied|request closed/i.test(message)) {
        setSigningPhase("rejected");
      } else if (/freighter|not installed|is not defined/i.test(message)) {
        setSigningPhase("wallet_missing");
      } else if (/insufficient|balance|underfunded|not_enough_balance/i.test(message)) {
        setSigningPhase("insufficient_balance");
      } else {
        setSigningError(message);
        setSigningPhase("error");
      }
    }
  }, [
    address,
    connected,
    costStroops,
    fetchBalance,
    projectId,
    projectKnown,
    purchaseValid,
    refreshClaimable,
    refreshProject,
    signAndSend,
    tokenAmount,
  ]);

  // The static name keeps the exported HTML (and the H1) stable without a network
  // read; the on-chain name replaces it once the catalog resolves.
  const staticProjectName = staticName ?? (projectId !== null ? `Project #${projectId}` : "Proyecto solar");
  const projectName = project?.name ?? staticProjectName;
  const unavailable = !loading && !projectKnown;

  return (
    <div className="relative min-h-screen bg-slate-50 font-body text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[600px] w-[900px] rounded-full bg-gradient-to-br from-emerald-200/25 via-emerald-100/15 to-transparent blur-[160px]" />
        <div className="absolute top-1/3 -right-20 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-orange-200/20 via-amber-100/10 to-transparent blur-[140px]" />
      </div>

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 lg:px-10">
          <a href="/" className="flex items-center gap-2 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-900">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Volver al directorio
          </a>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {project?.active === true ? "Active" : "On-chain state"}
            </span>
            <span className="font-mono text-[11px] text-slate-400">Stellar Testnet</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 lg:px-10 pt-20 pb-20">
        <nav className="mb-6 flex items-center gap-2 text-[13px] text-slate-500">
          <a href="/" className="hover:text-slate-900">Proyectos Solares</a>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="font-medium text-slate-900">Project #{projectId ?? "—"}</span>
          {projectKnown ? (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              ON-CHAIN ID
            </span>
          ) : null}
        </nav>

        {unavailable ? (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-6" role="status">
            <h2 className="font-display text-[20px] font-bold text-amber-900">
              Project #{id ?? "—"} is unavailable
            </h2>
            <p className="mt-2 text-[13px] text-amber-800">
              The requested ID is not present in the contract-derived project range. Purchase actions are disabled; project 1 is never used as a fallback.
            </p>
            <a href="/" className="mt-4 inline-flex text-xs font-semibold text-amber-900 hover:underline">Return to the project directory</a>
          </div>
        ) : null}

        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                project?.active === true
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-100 text-slate-500"
              }`}
            >
              {project?.active === true ? "Active" : project?.active === false ? "Inactive" : "Unavailable"}
            </span>
            {project && !project.stateComplete ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700">
                PARTIAL READ
              </span>
            ) : null}
            <a href="/proof" className="font-mono text-[11px] text-emerald-700 hover:underline">
              View public evidence
            </a>
          </div>

          <h1 className="font-display text-[32px] font-bold leading-tight text-slate-900 lg:text-[42px]">
            {projectName}
          </h1>
          {loading ? (
            <p className="mt-1 font-mono text-[11px] text-slate-500" role="status">
              Cargando estado on-chain del contrato…
            </p>
          ) : null}
          <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-slate-600">
            Financial and token values on this page come directly from the contract. Physical location, capacity, legal title, APY, CO₂, audit status, and IoT telemetry are not inferred when evidence is unavailable.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={EXPLORER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              View Contract
            </a>
            <span className="font-mono text-[11px] text-slate-400">{shortAddress(CONTRACT_ID)}</span>
          </div>
        </div>

        <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total supply", value: formatIntegerAmount(project?.totalSupply ?? null), icon: "inventory_2" },
            { label: "Minted", value: formatIntegerAmount(project?.minted ?? null), icon: "token" },
            { label: "Price / token", value: formatStroopsAsXlm(project?.price ?? null), icon: "payments" },
            { label: "Minimum purchase", value: project?.minPurchase === null || project?.minPurchase === undefined ? "—" : `${formatIntegerAmount(project.minPurchase)} token`, icon: "exposure" },
            { label: "Energy recorded", value: project?.totalEnergyKwh === null || project?.totalEnergyKwh === undefined ? "Unavailable" : `${formatIntegerAmount(project.totalEnergyKwh)} kWh`, icon: "bolt" },
            { label: "Sales balance", value: formatStroopsAsXlm(project?.salesBalance ?? null), icon: "account_balance" },
             { label: "Total contract inflows (sales + deposits)", value: formatStroopsAsXlm(project?.totalRevenue ?? null), icon: "query_stats" },

            { label: "Creator", value: shortAddress(project?.creator), icon: "person" },
          ].map((metric) => (
            <div key={metric.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="material-symbols-outlined mb-1.5 text-[20px] text-emerald-600">{metric.icon}</span>
              <div className="text-[11px] font-medium text-slate-500">{metric.label}</div>
              <div className="mt-1 break-words font-mono text-[15px] font-bold text-slate-900">{metric.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-8">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&h=500&fit=crop"
                alt="Illustrative solar panel image"
                className="h-[320px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />
              <span className="absolute bottom-4 left-4 rounded-full bg-slate-900/80 px-3 py-1 font-mono text-[10px] font-semibold text-white">
                ILLUSTRATIVE IMAGE · NOT PROJECT EVIDENCE
              </span>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-display text-[16px] font-bold text-slate-900">On-chain project state</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Project name</div>
                  <div className="mt-1 text-[14px] font-medium text-slate-900">{project?.name ?? "Unavailable"}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Creator</div>
                  <div className="mt-1 font-mono text-[12px] text-slate-600">{project?.creator ?? "Unavailable"}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Mint progress</div>
                  <div className="mt-1 font-mono text-[14px] font-semibold text-slate-900">{progress === null ? "Unavailable" : `${progress}%`}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Reward index</div>
                  <div className="mt-1 break-all font-mono text-[11px] text-slate-600">{project?.rewardPerTokenStored ?? "Unavailable"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="font-display text-[16px] font-bold text-slate-900">Evidence boundary</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
                This page intentionally omits unverified physical metadata, legal documents, oracle readings, APY, capacity, CO₂ estimates, fiat conversion, and secondary-market claims. The public proof page contains the auditable transaction and state record.
              </p>
              <a href="/proof" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
                Open deployment, project, purchase, and claim evidence
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </a>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="sticky top-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-orange-50 px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-display text-[14px] font-bold text-slate-900">Comprar con XLM</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">TESTNET</span>
                </div>
              </div>

              <div className="space-y-5 p-6">
                <div>
                  <label htmlFor="token-amount" className="mb-1.5 block text-[12px] font-medium text-slate-500">
                    Cantidad de tokens
                  </label>
                  <input
                    id="token-amount"
                    type="text"
                    inputMode="numeric"
                    value={tokenInput}
                    onChange={(event) => setTokenInput(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[22px] font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setTokenInput(project?.minPurchase?.toString() ?? "")}
                      disabled={project?.minPurchase === null || project?.minPurchase === undefined}
                      className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-semibold text-slate-600 disabled:opacity-40"
                    >
                      Mínimo
                    </button>
                    <button
                      type="button"
                      onClick={() => setTokenInput(remaining === null ? "" : (remaining / 2n).toString())}
                      disabled={remaining === null || remaining === 0n}
                      className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-semibold text-slate-600 disabled:opacity-40"
                    >
                      50% disponible
                    </button>
                    <button
                      type="button"
                      onClick={() => setTokenInput(remaining?.toString() ?? "")}
                      disabled={remaining === null || remaining === 0n}
                      className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-semibold text-slate-600 disabled:opacity-40"
                    >
                      Máx.
                    </button>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl bg-slate-50 p-4 text-[13px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Precio / token</span>
                    <span className="font-mono font-bold text-slate-900">{formatStroopsAsXlm(project?.price ?? null)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Costo exacto</span>
                    <span className="font-mono font-bold text-orange-700">{costStroops === null ? "Unavailable" : formatStroopsAsXlm(costStroops)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Disponible</span>
                    <span className="font-mono font-bold text-slate-700">{formatIntegerAmount(remaining)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Claimable de tu wallet</span>
                    <span className="font-mono font-bold text-emerald-700">{claimable === null ? "Unavailable" : formatStroopsAsXlm(claimable)}</span>
                  </div>
                </div>

                {connected ? (
                  <div className="flex items-center justify-between rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2">
                     <span className="font-mono text-[12px] font-medium text-emerald-700">{shortAddress(address)}</span>
                     <span className="font-mono text-[12px] text-slate-500">{balance === "Unavailable" ? "Unavailable" : `${balance} XLM`}</span>
                   </div>

                ) : (
                   <button
                     type="button"
                     onClick={() => void handleConnect()}
                     className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-100"
                   >

                    Conectar Freighter
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void openSigning()}
                  disabled={!projectKnown || !purchaseValid || loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-[14px] font-bold text-white shadow-lg shadow-emerald-600/25 transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                  {projectKnown ? "Confirmar en Stellar" : "Proyecto unavailable"}
                </button>

                {!projectKnown && !loading ? (
                  <p className="text-[11px] text-amber-700">Purchase is disabled for an unknown project ID.</p>
                ) : null}
                {loadError ? <p className="text-[11px] text-amber-700">{loadError}</p> : null}
              </div>
            </div>
          </div>
        </div>
      </main>

      <TransactionSigningModal
        open={signingOpen}
        onClose={() => {
          setSigningOpen(false);
          window.setTimeout(() => setSigningPhase("idle"), 200);
        }}
        onConfirm={executePurchase}
        phase={signingPhase}
        errorMessage={signingError}
        projectName={projectName}
        tokenAmount={tokenAmount ?? 0n}
        costStroops={costStroops ?? 0n}
        walletAddress={address ?? ""}
        walletBalance={balance}
        contractId={CONTRACT_ID}
      />

      <TransactionSuccess
        open={signingPhase === "success" && txHash.length > 0}
        onClose={() => {
          setSigningOpen(false);
          setSigningPhase("idle");
          setTxHash("");
        }}
        txHash={txHash}
        tokenAmount={tokenAmount ?? 0n}
        costStroops={costStroops ?? 0n}
        projectName={projectName}
        walletAddress={address ?? ""}
        contractId={CONTRACT_ID}
      />
    </div>
  );
}
