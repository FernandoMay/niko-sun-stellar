"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useWallet } from "@/lib/WalletContext";
import { CONTRACT_ID, TX_EXPLORER } from "@/lib/contract";
import ProtocolVerification from "@/components/ProtocolVerification";
import { useHolderMetrics } from "@/hooks/useHolderMetrics";
import {
  boundedPercent,
  formatIntegerAmount,
  formatStroopsAsXlm,
  parseTransferAmount,
  parseUnsignedBigInt,
  sumBigints,
} from "@/lib/amounts";
import {
  deriveTotalMinted,
  readInvestorPortfolio,
  readProjectCatalog,
  readUserProjectIds,
  selectPositiveClaimable,
  sumOwnedProjectAmounts,
  sumPortfolioTokens,
  sumReferentialValueStroops,
  type ClaimablePosition,
  type ContractProject,
  type InvestorPortfolio,
  type ProjectCatalog,
} from "@/lib/contractData";

type View = "dashboard" | "projects" | "claim" | "metrics" | "admin";
type SendTransaction = (
  contractId: string,
  method: string,
  args: unknown[]
) => Promise<{ txHash: string; result?: unknown }>;

type ClaimReceipt = {
  projectId: number;
  amount: bigint;
  txHash: string;
};

const nav = [
  { id: "dashboard" as const, label: "Dashboard", icon: "home" },
  { id: "projects" as const, label: "Proyectos", icon: "battery_charging_full" },
  { id: "claim" as const, label: "Reclamar", icon: "payments" },
  { id: "metrics" as const, label: "Métricas", icon: "bar_chart" },
  { id: "admin" as const, label: "Admin", icon: "settings" },
];

const EMPTY_CATALOG: ProjectCatalog = {
  status: "unavailable",
  nextProjectId: null,
  projectIds: [],
  projects: [],
  unavailableProjectIds: [],
  error: null,
};

const EMPTY_PORTFOLIO: InvestorPortfolio = {
  status: "empty",
  positions: [],
  claimables: {},
  unavailableProjectIds: [],
  error: null,
};

function Logo() {
  return (
    <a href="/" className="flex items-center gap-3.5 group">
      <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-50 to-amber-50 border border-emerald-200 shadow-sm group-hover:border-emerald-500 transition-all p-1">
        <span className="material-symbols-outlined text-emerald-600 text-[22px]">solar_power</span>
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-xl tracking-tight font-extrabold text-slate-900 font-display">
            NIKO<span className="text-amber-600">SUN</span>
          </span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold border border-emerald-300">
            RWA SOLAR
          </span>
        </div>
        <span className="font-mono text-[11px] text-emerald-700 font-semibold tracking-wide">
          Powered by Stellar Soroban
        </span>
      </div>
    </a>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  action,
  onAction,
  disabled = false,
  badge,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  action?: string;
  onAction?: () => void;
  disabled?: boolean;
  badge?: "Estimated" | "Unavailable" | "Partial";
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-md relative overflow-hidden p-5">
      {badge ? (
        <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-50 border border-amber-200 text-amber-700">
          {badge.toUpperCase()}
        </span>
      ) : null}
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </div>
        {action ? (
          <button
            type="button"
            onClick={onAction}
            disabled={disabled}
            className="h-7 bg-orange-600 hover:bg-orange-700 px-2.5 rounded-lg text-xs text-white font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          >
            {action}
          </button>
        ) : null}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-xl font-bold tracking-tight text-slate-900 break-words">
        {value}
      </div>
      {sub ? <div className="mt-2 text-[10px] leading-relaxed text-slate-400">{sub}</div> : null}
    </div>
  );
}

function Sidebar({
  view,
  setView,
  address,
  balance,
  connected,
  connect,
}: {
  view: View;
  setView: (view: View) => void;
  address: string | null;
  balance: string;
  connected: boolean;
  connect: () => Promise<void>;
}) {
  return (
    <aside className="flex w-[236px] shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 max-lg:w-[76px] max-lg:items-center max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:h-[70px] max-md:w-full max-md:flex-row max-md:justify-around max-md:border-t max-md:border-r-0 max-md:px-2 max-md:py-2">
      <div className="mb-10 max-lg:mb-0 max-lg:hidden"><Logo /></div>
      <div className="mb-10 hidden max-lg:block">
        <a href="/" className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-50 to-amber-50 border border-emerald-200">
          <span className="material-symbols-outlined text-emerald-600 text-[22px]">solar_power</span>
        </a>
      </div>
      <nav className="flex w-full flex-col gap-1 max-md:flex-row max-md:justify-around">
        {nav.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 max-lg:justify-center max-lg:px-2 max-md:flex-col max-md:gap-1 max-md:py-1 max-md:text-[10px]",
              view === id && "bg-emerald-50 font-medium text-emerald-700 border border-emerald-200"
            )}
          >
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
            <span className="max-lg:hidden max-md:block">{label}</span>
          </button>
        ))}
        <a
          href="/proof"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 max-lg:justify-center max-lg:px-2 max-md:flex-col max-md:gap-1 max-md:py-1 max-md:text-[10px]"
        >
          <span className="material-symbols-outlined text-[18px]">verified_user</span>
          <span className="max-lg:hidden max-md:block">Proof</span>
        </a>
      </nav>
      <div className="mt-auto w-full max-lg:hidden">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
          <div className="mb-3 flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-full bg-orange-100 text-orange-600">
              <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
            </div>
            <div>
              <div className="font-mono text-[11px] text-slate-700">
                {connected && address ? `${address.slice(0, 4)}...${address.slice(-4)}` : "Sin conectar"}
              </div>
               <div className="text-[10px] text-slate-500">{connected ? (balance === "Unavailable" ? "Unavailable" : `${balance} XLM`) : "—"}</div>

            </div>
          </div>
          <div className="mb-3 flex items-center gap-1.5 text-[10px] text-emerald-700">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Stellar Testnet
          </div>
          {!connected ? (
            <button
              type="button"
              onClick={connect}
              className="h-7 w-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors"
            >
              Conectar wallet
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function ProjectCard({ project }: { project: ContractProject }) {
  const progress =
    project.totalSupply !== null && project.minted !== null
      ? boundedPercent(project.minted, project.totalSupply)
      : null;

  return (
    <a
      href={`/project/${project.id}`}
      className="bg-white border border-slate-200 rounded-xl shadow-md group text-left transition hover:-translate-y-0.5 hover:border-emerald-300 w-full relative block"
    >
      {project.stateComplete ? null : (
        <span className="absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-50 border border-amber-200 text-amber-700">
          PARTIAL
        </span>
      )}
      <div className="h-1 rounded-t-xl bg-emerald-500" />
      <div className="p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 font-semibold text-slate-900">
              {project.name ?? `Project #${project.id}`}
              <span className="material-symbols-outlined text-[12px] text-slate-400 transition group-hover:text-emerald-600">arrow_upward</span>
            </div>
            <div className="text-xs text-slate-500">Project #{project.id}</div>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-1 text-[10px] font-medium border",
              project.active === true
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-50 text-slate-500 border-slate-200"
            )}
          >
            {project.active === true ? "Activo" : project.active === false ? "Inactivo" : "Unavailable"}
          </span>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] text-slate-500">Precio / token</div>
            <div className="mt-1 font-mono text-sm text-orange-600">{formatStroopsAsXlm(project.price)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500">Sales balance</div>
            <div className="mt-1 font-mono text-sm text-slate-700">{formatStroopsAsXlm(project.salesBalance)}</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Tokens minted</span>
          <span className="font-mono text-slate-600">{project.minted === null ? "—" : formatIntegerAmount(project.minted)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-slate-500">Progress</span>
          <span className="font-mono text-slate-600">{progress === null ? "—" : `${progress}%`}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress ?? 0}%` }} />
        </div>
        <div className="mt-5 flex items-center justify-between text-xs font-semibold text-emerald-700">
          <span>Ver detalle</span>
          <span className="material-symbols-outlined text-[13px]">chevron_right</span>
        </div>
      </div>
    </a>
  );
}

function useDashboardContractState(
  readContract: ReturnType<typeof useWallet>["readContract"],
  address: string | null
) {
  const [catalog, setCatalog] = useState<ProjectCatalog>(EMPTY_CATALOG);
  const [portfolio, setPortfolio] = useState<InvestorPortfolio>(EMPTY_PORTFOLIO);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      setCatalog(await readProjectCatalog(readContract, CONTRACT_ID));
    } catch {
      setCatalog(EMPTY_CATALOG);
    } finally {
      setCatalogLoading(false);
    }
  }, [readContract]);

  const refreshPortfolio = useCallback(async () => {
    if (!address) {
      setPortfolio(EMPTY_PORTFOLIO);
      setPortfolioLoading(false);
      return;
    }
    if (catalog.projectIds.length === 0) {
      setPortfolio(EMPTY_PORTFOLIO);
      setPortfolioLoading(false);
      return;
    }

    setPortfolioLoading(true);
    try {
      setPortfolio(
        await readInvestorPortfolio(readContract, CONTRACT_ID, address, catalog.projectIds)
      );
    } catch {
      setPortfolio({
        status: "unavailable",
        positions: [],
        claimables: {},
        unavailableProjectIds: catalog.projectIds,
        error: "Portfolio state is unavailable.",
      });
    } finally {
      setPortfolioLoading(false);
    }
  }, [address, catalog.projectIds, readContract]);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  useEffect(() => {
    void refreshPortfolio();
  }, [refreshPortfolio]);

  return {
    catalog,
    portfolio,
    catalogLoading,
    portfolioLoading,
    refreshCatalog,
    refreshPortfolio,
  };
}

function DashboardView({
  setView,
  catalog,
  portfolio,
  catalogLoading,
  portfolioLoading,
  claimAll,
  claiming,
  connected,
  connect,
  nextProjectId,
  totalMinted,
  holderMetrics,
}: {
  setView: (view: View) => void;
  catalog: ProjectCatalog;
  portfolio: InvestorPortfolio;
  catalogLoading: boolean;
  portfolioLoading: boolean;
  claimAll: () => Promise<void>;
  claiming: boolean;
  connected: boolean;
  connect: () => Promise<void>;
  nextProjectId: number | null;
  totalMinted: string | null;
  holderMetrics: ReturnType<typeof useHolderMetrics>["metrics"];
}) {
  const referentialValue = sumReferentialValueStroops(
    portfolio.positions,
    catalog.projects,
    { catalogStatus: catalog.status, portfolioStatus: portfolio.status }
  );
  const referentialReady = catalog.status === "ready" && portfolio.status === "ready";
  const referentialBadge = !connected
    ? "Unavailable"
    : referentialReady
      ? "Estimated"
      : catalog.status === "partial" || portfolio.status === "partial"
        ? "Partial"
        : "Unavailable";
  const portfolioReady =
    connected && catalog.status === "ready" && portfolio.status === "ready";
  const tokenTotal = portfolioReady ? sumPortfolioTokens(portfolio.positions) : null;
  const claimableTotal = portfolioReady
    ? sumBigints(Object.values(portfolio.claimables))
    : null;
  const positiveClaims = portfolioReady
    ? selectPositiveClaimable(
        Object.entries(portfolio.claimables).map(([projectId, amount]) => ({
          projectId: Number(projectId),
          amount,
        }))
      )
    : [];

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-emerald-600">Resumen de inversión</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 font-display">Portafolio Testnet</h1>
          <p className="mt-2 text-sm text-slate-500">Totales derivados de lecturas del contrato; sin fallbacks de negocio.</p>
        </div>
        <button
          type="button"
          onClick={() => setView("projects")}
          className="hidden bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors sm:flex items-center gap-2"
        >
          Explorar proyectos
          <span className="material-symbols-outlined text-[16px]">arrow_upward</span>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon="payments"
          label="Valor referencial estimado"
          value={connected ? (referentialValue === null ? "—" : formatStroopsAsXlm(referentialValue)) : "—"}
          sub="Precio actual on-chain; no representa costo basis ni fiat value."
          badge={referentialBadge}
        />
        <StatCard
          icon="bolt"
          label="Claimable"
          value={connected ? (claimableTotal === null ? "—" : formatStroopsAsXlm(claimableTotal)) : "—"}
          sub={connected ? "Suma de get_claimable" : "Conecta una wallet para leer tu posición."}
          action="Reclamar todo"
          onAction={claimAll}
          disabled={!portfolioReady || claiming || positiveClaims.length === 0}
          badge={connected && claimableTotal === null ? "Unavailable" : undefined}
        />
        <StatCard
          icon="token"
          label="Tokens en posesión"
          value={connected ? (tokenTotal === null ? "—" : formatIntegerAmount(tokenTotal)) : "—"}
          sub={connected ? "Suma de get_portfolio" : "Conecta una wallet para leer tu posición."}
          badge={connected && tokenTotal === null ? "Unavailable" : undefined}
        />
      </div>

      <ProtocolVerification
        metrics={holderMetrics}
        nextProjectId={nextProjectId}
        totalMinted={totalMinted}
        catalogStatus={catalog.status}
      />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 font-display">Proyectos on-chain</h2>
            <p className="mt-1 text-xs text-slate-500">IDs derivados de next_project_id - 1</p>
          </div>
          <button type="button" onClick={() => setView("projects")} className="text-xs text-emerald-600 hover:text-emerald-700">
            Ver todos <span className="material-symbols-outlined inline text-[12px]">chevron_right</span>
          </button>
        </div>
        {catalogLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-md">Loading project state…</div>
        ) : catalog.projects.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-md">
            {catalog.status === "empty" ? "No projects are registered." : "Project state unavailable."}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {catalog.projects.map((project) => <ProjectCard key={project.id} project={project} />)}
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="bg-white border border-slate-200 rounded-xl shadow-md p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900 font-display">Mi posición</h2>
              <p className="mt-1 text-xs text-slate-500">get_portfolio + get_claimable</p>
            </div>
            <a href="/proof" className="text-xs font-semibold text-emerald-700 hover:underline">Public proof</a>
          </div>
          {!connected ? (
            <button type="button" onClick={connect} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Conectar wallet para leer el portafolio
            </button>
          ) : portfolioLoading ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Loading portfolio…</div>
           ) : !portfolioReady ? (
             <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
               Portfolio or project state is incomplete. No fallback totals are shown.
             </div>
          ) : portfolio.positions.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No positions returned.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="pb-3 font-medium">Proyecto</th>
                    <th className="pb-3 font-medium">Tokens</th>
                    <th className="pb-3 font-medium">Valor referencial</th>
                    <th className="pb-3 font-medium">Claimable</th>
                    <th className="pb-3 font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.positions.map((position) => {
                    const project = catalog.projects.find((item) => item.id === position.projectId);
                    const positionValue = referentialReady && project?.price !== null && project?.price !== undefined
                      ? position.tokenBalance * project.price
                      : null;
                    return (
                      <tr key={position.projectId} className="border-b border-slate-100">
                        <td className="py-4 font-medium text-slate-700">
                          {project?.name ?? `Project #${position.projectId}`}
                        </td>
                        <td className="py-4 font-mono text-slate-600">{formatIntegerAmount(position.tokenBalance)}</td>
                        <td className="py-4 font-mono text-slate-600">
                          {positionValue === null ? "—" : formatStroopsAsXlm(positionValue)}
                          <span className="ml-1 text-[9px] text-amber-700">EST.</span>
                        </td>
                        <td className="py-4 font-mono text-emerald-600">
                          {formatStroopsAsXlm(portfolio.claimables[position.projectId] ?? null)}
                        </td>
                        <td className="py-4 text-emerald-700">
                          {project?.active === true ? "Active" : project?.active === false ? "Inactive" : "Unavailable"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-md p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 font-display">Protocol evidence</h2>
            <span className="material-symbols-outlined text-[16px] text-slate-400">verified_user</span>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-sm font-semibold text-emerald-900">Stellar Testnet</div>
            <div className="mt-2 font-mono text-[11px] leading-relaxed text-emerald-800">
              Holder indexer status: {holderMetrics?.reconciled ? "Reconciled" : holderMetrics?.status ?? "Unavailable"}
            </div>
            <a href="/proof" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline">
               View deployment, project, purchase, contract-inflow, and claim evidence

              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </a>
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            The evidence page separates observed contract values from demo telemetry and estimates.
          </p>
        </div>
      </div>
    </div>
  );
}

function ClaimView({
  catalog,
  portfolio,
  portfolioLoading,
  claimAll,
  claimProject,
  claiming,
  connected,
  connect,
  receipt,
}: {
  catalog: ProjectCatalog;
  portfolio: InvestorPortfolio;
  portfolioLoading: boolean;
  claimAll: () => Promise<void>;
  claimProject: (projectId: number) => Promise<void>;
  claiming: boolean;
  connected: boolean;
  connect: () => Promise<void>;
  receipt: ClaimReceipt | null;
}) {
  const portfolioReady =
    connected && catalog.status === "ready" && portfolio.status === "ready";
  const total = portfolioReady
    ? sumBigints(Object.values(portfolio.claimables))
    : null;
  const positiveClaims = portfolioReady
    ? selectPositiveClaimable(
        Object.entries(portfolio.claimables).map(([projectId, amount]) => ({
          projectId: Number(projectId),
          amount,
        }))
      )
    : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-orange-600">Distribución de ingresos</p>
        <h1 className="text-3xl font-bold text-slate-900 font-display">Reclamar ingresos</h1>
        <p className="mt-2 text-sm text-slate-500">Solo se ofrecen saldos positivos leídos desde get_claimable.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-emerald-50 p-6 relative">
        <div className="text-sm text-slate-500">Total claimable</div>
        <div className="mt-2 font-mono text-3xl font-bold text-slate-900">
          {connected ? (total === null ? "—" : formatStroopsAsXlm(total)) : "—"}
        </div>
        {!connected ? (
          <button type="button" onClick={connect} className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Conectar wallet
          </button>
        ) : null}
        <button
          type="button"
          onClick={claimAll}
           disabled={!portfolioReady || claiming || positiveClaims.length === 0}
          className="mt-6 w-full bg-orange-600 font-semibold text-white hover:bg-orange-700 px-4 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {claiming ? "Procesando..." : "Reclamar todo"}
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-md divide-y divide-slate-100">
        <div className="p-5 font-semibold text-slate-900 font-display">Desglose por proyecto</div>
        {!connected ? (
          <div className="p-5 text-sm text-slate-500">Connect a wallet to read claimable balances.</div>
        ) : portfolioLoading ? (
          <div className="p-5 text-sm text-slate-500">Loading claimable state…</div>
        ) : catalog.projectIds.length === 0 ? (
          <div className="p-5 text-sm text-slate-500">No projects are available.</div>
        ) : (
          catalog.projectIds.map((projectId) => {
            const project = catalog.projects.find((item) => item.id === projectId);
            const amount = portfolio.claimables[projectId];
            const claimable = amount !== undefined && amount > 0n;
            return (
              <div key={projectId} className="flex items-center justify-between gap-4 p-5">
                <div>
                  <div className="font-medium text-slate-700">{project?.name ?? `Project #${projectId}`}</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-400">Project #{projectId}</div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-emerald-600">
                    {amount === undefined ? "Unavailable" : formatStroopsAsXlm(amount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => claimProject(projectId)}
                     disabled={!claimable || claiming || !portfolioReady}
                    className="border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Reclamar
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {receipt ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-emerald-800">Technical transaction receipt</div>
              <div className="mt-1 text-xs text-emerald-700">
                Project #{receipt.projectId} · {formatStroopsAsXlm(receipt.amount)}
              </div>
            </div>
            <a href={TX_EXPLORER(receipt.txHash)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-emerald-700 hover:underline">
              View transaction
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricsView({ catalog, catalogLoading }: { catalog: ProjectCatalog; catalogLoading: boolean }) {
  const complete = catalog.projects.filter((project) => project.stateComplete);
  const completeState = catalog.status === "ready" && complete.length === catalog.projectIds.length;
  const values = completeState
    ? {
        minted: sumBigints(complete.map((project) => project.minted ?? 0n)),
        energy: sumBigints(complete.map((project) => project.totalEnergyKwh ?? 0n)),
        revenue: sumBigints(complete.map((project) => project.totalRevenue ?? 0n)),
        sales: sumBigints(complete.map((project) => project.salesBalance ?? 0n)),
      }
    : null;

  return (
    <div className="flex flex-col gap-7">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-slate-900 font-display">Métricas on-chain</h1>
        <p className="mb-7 text-sm text-slate-500">Solo agregados de get_project y get_sales_balance; sin actividad o energía demo.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard icon="token" label="Tokens minted" value={catalogLoading ? "…" : values ? formatIntegerAmount(values.minted) : "—"} badge={!catalogLoading && !values ? "Unavailable" : undefined} />
        <StatCard icon="bolt" label="Energy recorded" value={catalogLoading ? "…" : values ? `${formatIntegerAmount(values.energy)} kWh` : "—"} badge={!catalogLoading && !values ? "Unavailable" : undefined} />
        <StatCard icon="account_balance" label="Total contract inflows (sales + deposits)" value={catalogLoading ? "…" : values ? formatStroopsAsXlm(values.revenue) : "—"} badge={!catalogLoading && !values ? "Unavailable" : undefined} />
        <StatCard icon="payments" label="Sales balance" value={catalogLoading ? "…" : values ? formatStroopsAsXlm(values.sales) : "—"} badge={!catalogLoading && !values ? "Unavailable" : undefined} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-md">
        <h2 className="font-display text-[16px] font-bold text-slate-900">Evidence boundary</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-600">
          Zero energy is displayed as an observed zero when the contract read succeeds. Telemetry charts, physical capacity, CO₂ estimates, and fiat values are not presented as verified metrics.
        </p>
        <a href="/proof" className="mt-4 inline-flex text-xs font-semibold text-emerald-700 hover:underline">Open public proof</a>
      </div>
    </div>
  );
}

function AdminView({
  catalog,
  refreshCatalog,
}: {
  catalog: ProjectCatalog;
  refreshCatalog: () => Promise<void>;
}) {
  const { signAndSend, connected, address, connect } = useWallet();
  const [ownedIds, setOwnedIds] = useState<number[] | null>(null);
  const [ownershipError, setOwnershipError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ name: "", supply: "", priceStroops: "", minPurchase: "" });
  const [amounts, setAmounts] = useState<Record<number, { deposit: string; withdraw: string }>>({});
  const { readContract } = useWallet();

  useEffect(() => {
    let cancelled = false;
    if (!connected || !address) {
      setOwnedIds(null);
      setOwnershipError(null);
      return;
    }
    setOwnedIds(null);
    setOwnershipError(null);
    void readUserProjectIds(readContract, CONTRACT_ID, address)
      .then((ids) => {
        if (!cancelled) setOwnedIds(ids);
      })
      .catch(() => {
        if (!cancelled) setOwnershipError("Ownership state is unavailable.");
      });
    return () => {
      cancelled = true;
    };
  }, [address, connected, readContract]);

  const ownedSet = useMemo(() => new Set(ownedIds ?? []), [ownedIds]);
  const ownedProjects = catalog.projects.filter(
    (project) => ownedSet.has(project.id) && project.creator === address
  );
  const unverifiedOwnedIds = (ownedIds ?? []).filter(
    (id) => !ownedProjects.some((project) => project.id === id)
  );
  const ownershipVerified =
    connected &&
    address !== null &&
    ownedIds !== null &&
    ownershipError === null &&
    catalog.status === "ready" &&
    catalog.projects.length === catalog.projectIds.length &&
    ownedProjects.every((project) => project.stateComplete) &&
    unverifiedOwnedIds.length === 0 &&
    ownedProjects.length === ownedIds.length;

  const supply = parseUnsignedBigInt(form.supply);
  const price = parseTransferAmount(form.priceStroops);
  const minPurchase = parseUnsignedBigInt(form.minPurchase);
  const createValid =
    connected &&
    form.name.trim().length > 0 &&
    supply !== null &&
    supply > 0n &&
    price !== null &&
    price > 0n &&
    minPurchase !== null &&
    minPurchase > 0n &&
    minPurchase <= supply;

  const handleCreateProject = async () => {
    if (!createValid || !address || supply === null || price === null || minPurchase === null) return;
    setBusy("create");
    setStatus("");
    try {
      await signAndSend(CONTRACT_ID, "create_project", [
        address,
        form.name.trim(),
        supply,
        price,
        minPurchase,
      ]);
      setForm({ name: "", supply: "", priceStroops: "", minPurchase: "" });
      setStatus("Project created. Refreshing on-chain state…");
      await refreshCatalog();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const updateAmount = (
    projectId: number,
    field: "deposit" | "withdraw",
    value: string
  ) => {
    setAmounts((current) => ({
      ...current,
      [projectId]: {
        deposit: current[projectId]?.deposit ?? "",
        withdraw: current[projectId]?.withdraw ?? "",
        [field]: value,
      },
    }));
  };

  const handleDeposit = async (project: ContractProject) => {
    if (!ownershipVerified || !connected || !address || project.creator !== address || !ownedSet.has(project.id)) return;
    const amount = parseTransferAmount(amounts[project.id]?.deposit ?? "");
    if (amount === null || amount <= 0n || project.active !== true || (project.minted ?? 0n) <= 0n) return;
    setBusy(`deposit-${project.id}`);
    setStatus("");
    try {
      await signAndSend(CONTRACT_ID, "deposit_revenue", [address, project.id, amount, 0n]);
      updateAmount(project.id, "deposit", "");
      setStatus(`Contract inflow deposited for project #${project.id}.`);
      await refreshCatalog();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const handleWithdraw = async (project: ContractProject) => {
    if (!ownershipVerified || !connected || !address || project.creator !== address || !ownedSet.has(project.id)) return;
    const amount = parseTransferAmount(amounts[project.id]?.withdraw ?? "");
    if (amount === null || amount <= 0n || project.salesBalance === null || amount > project.salesBalance) return;
    setBusy(`withdraw-${project.id}`);
    setStatus("");
    try {
      await signAndSend(CONTRACT_ID, "withdraw_sales", [address, project.id, amount]);
      updateAmount(project.id, "withdraw", "");
      setStatus(`Sales withdrawal confirmed for project #${project.id}.`);
      await refreshCatalog();
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  const ownedSales = sumOwnedProjectAmounts(
    ownedProjects,
    "salesBalance",
    ownershipVerified
  );
  const ownedRevenue = sumOwnedProjectAmounts(
    ownedProjects,
    "totalRevenue",
    ownershipVerified
  );

  return (
    <div className="flex flex-col gap-7">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-[.18em] text-emerald-600">Creator console</p>
        <h1 className="text-3xl font-bold text-slate-900 font-display">Panel de administración</h1>
        <p className="mt-2 text-sm text-slate-500">La propiedad se verifica con get_user_projects y el creator on-chain.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon="folder_open"
          label="Owned projects"
          value={connected ? ownershipVerified ? String(ownedIds?.length ?? 0) : ownedIds === null ? "…" : "—" : "—"}
          badge={connected && ownedIds !== null && !ownershipVerified ? (catalog.status === "partial" ? "Partial" : "Unavailable") : undefined}
        />
        <StatCard
          icon="payments"
          label="Owned sales balance"
          value={connected ? ownedSales === null ? "—" : formatStroopsAsXlm(ownedSales) : "—"}
          badge={connected && !ownershipVerified ? (catalog.status === "partial" ? "Partial" : "Unavailable") : undefined}
        />
        <StatCard
          icon="bolt"
          label="Owned total contract inflows (sales + deposits)"
          value={connected ? ownedRevenue === null ? "—" : formatStroopsAsXlm(ownedRevenue) : "—"}
          badge={connected && !ownershipVerified ? (catalog.status === "partial" ? "Partial" : "Unavailable") : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <div className="bg-white border border-slate-200 rounded-xl shadow-md p-5">
          <h2 className="mb-5 font-semibold text-slate-900 font-display">Crear nuevo proyecto</h2>
          <div className="flex flex-col gap-4">
            <label className="text-xs text-slate-500">
              Nombre del proyecto
              <input
                className="mt-2 w-full border border-slate-200 rounded-lg bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500"
                placeholder="Nombre exacto"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-500">
              Supply total (tokens)
              <input
                inputMode="numeric"
                className="mt-2 w-full border border-slate-200 rounded-lg bg-white px-3 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-emerald-500"
                placeholder="100000"
                value={form.supply}
                onChange={(event) => setForm((current) => ({ ...current, supply: event.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-500">
              Precio por token (stroops)
              <input
                inputMode="numeric"
                className="mt-2 w-full border border-slate-200 rounded-lg bg-white px-3 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-emerald-500"
                placeholder="10000000"
                value={form.priceStroops}
                onChange={(event) => setForm((current) => ({ ...current, priceStroops: event.target.value }))}
              />
              <span className="mt-1 block font-mono text-[10px] text-slate-400">
                {price === null ? "Enter a positive integer ≤ i128 max" : `${formatStroopsAsXlm(price)} per token`}
              </span>
            </label>
            <label className="text-xs text-slate-500">
              Compra mínima (tokens)
              <input
                inputMode="numeric"
                className="mt-2 w-full border border-slate-200 rounded-lg bg-white px-3 py-2.5 font-mono text-sm text-slate-900 outline-none focus:border-emerald-500"
                placeholder="1"
                value={form.minPurchase}
                onChange={(event) => setForm((current) => ({ ...current, minPurchase: event.target.value }))}
              />
            </label>
            <button
              type="button"
              onClick={handleCreateProject}
              disabled={!createValid || busy !== null}
              className="mt-2 bg-emerald-600 text-white hover:bg-emerald-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === "create" ? "Creando…" : "Crear proyecto"}
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-md p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900 font-display">Owned projects</h2>
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold",
                ownershipVerified
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              )}
            >
              {ownershipVerified
                ? "OWNERSHIP VERIFIED"
                : ownershipError
                  ? "OWNERSHIP UNAVAILABLE"
                  : ownedIds === null
                    ? "OWNERSHIP PENDING"
                    : "OWNERSHIP NOT VERIFIED"}
            </span>
          </div>

          {!connected ? (
            <button type="button" onClick={connect} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Conectar wallet
            </button>
          ) : ownershipError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{ownershipError}</div>
          ) : ownedIds === null ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Loading get_user_projects…</div>
          ) : !ownershipVerified ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Ownership is not verified. Complete get_user_projects, matching creator state, and the full project catalog before enabling owned-project actions.
              {unverifiedOwnedIds.length > 0 ? (
                <span className="mt-2 block">Unverified project IDs: {unverifiedOwnedIds.join(", ")}.</span>
              ) : null}
            </div>
          ) : ownedProjects.length === 0 && unverifiedOwnedIds.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">No owned projects returned.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {ownedProjects.map((project) => {
                const deposit = parseTransferAmount(amounts[project.id]?.deposit ?? "");
                const withdraw = parseTransferAmount(amounts[project.id]?.withdraw ?? "");
                const depositValid = deposit !== null && deposit > 0n && project.active === true && (project.minted ?? 0n) > 0n;
                const withdrawValid = withdraw !== null && withdraw > 0n && project.salesBalance !== null && withdraw <= project.salesBalance;
                return (
                  <div key={project.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-800">{project.name ?? `Project #${project.id}`}</div>
                        <div className="mt-1 font-mono text-[10px] text-slate-500">
                          ID {project.id} · creator {project.creator?.slice(0, 6)}…{project.creator?.slice(-4)} · sales {formatStroopsAsXlm(project.salesBalance)}
                        </div>
                      </div>
                      <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[9px] font-mono font-bold text-emerald-700">ON-CHAIN OWNER</span>
                    </div>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="text-[11px] text-slate-500">
                        Contract inflow amount (stroops)
                        <input
                          inputMode="numeric"
                          value={amounts[project.id]?.deposit ?? ""}
                          onChange={(event) => updateAmount(project.id, "deposit", event.target.value)}
                          placeholder="1000000"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-emerald-500"
                        />
                        <span className="mt-1 block text-[9px] text-slate-400">{deposit === null ? "Positive integer required" : formatStroopsAsXlm(deposit)}</span>
                      </label>
                      <label className="text-[11px] text-slate-500">
                        Withdraw amount (stroops)
                        <input
                          inputMode="numeric"
                          value={amounts[project.id]?.withdraw ?? ""}
                          onChange={(event) => updateAmount(project.id, "withdraw", event.target.value)}
                          placeholder="1000000"
                          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 outline-none focus:border-emerald-500"
                        />
                        <span className="mt-1 block text-[9px] text-slate-400">{withdraw === null ? "Cannot exceed sales balance" : formatStroopsAsXlm(withdraw)}</span>
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeposit(project)}
                        disabled={!depositValid || busy !== null}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy === `deposit-${project.id}` ? "Depositing…" : "Deposit contract inflow"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWithdraw(project)}
                        disabled={!withdrawValid || busy !== null}
                        className="rounded-lg border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {busy === `withdraw-${project.id}` ? "Withdrawing…" : "Withdraw sales"}
                      </button>
                    </div>
                  </div>
                );
              })}

              {unverifiedOwnedIds.map((projectId) => (
                <div key={projectId} className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Project #{projectId} is listed by get_user_projects but its current creator state is unavailable or does not match this wallet. Actions are disabled.
                </div>
              ))}
            </div>
          )}

          {status ? <p className="mt-4 break-words rounded-lg bg-slate-100 p-3 font-mono text-[11px] text-slate-700">{status}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  const { address, balance, connected, connect, disconnect, signAndSend, readContract } = useWallet();
  const [view, setView] = useState<View>("dashboard");
  const [claiming, setClaiming] = useState(false);
  const [receipt, setReceipt] = useState<ClaimReceipt | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const { metrics: holderMetrics } = useHolderMetrics();
  const {
    catalog,
    portfolio,
    catalogLoading,
    portfolioLoading,
    refreshCatalog,
    refreshPortfolio,
  } = useDashboardContractState(readContract, address);

  const positiveClaims = useMemo(
    () =>
      selectPositiveClaimable(
        Object.entries(portfolio.claimables).map(([projectId, amount]) => ({
          projectId: Number(projectId),
          amount,
        }))
      ),
    [portfolio.claimables]
  );

  const nextProjectId =
    catalog.nextProjectId !== null &&
    catalog.nextProjectId <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(catalog.nextProjectId)
      : null;
  const totalMintedValue = deriveTotalMinted(catalog);
  const totalMinted = totalMintedValue === null ? null : totalMintedValue.toString();

  const claimAll = useCallback(async () => {
    if (!connected || !address || positiveClaims.length === 0) return;
    setClaiming(true);
    setClaimError(null);
    setReceipt(null);
    try {
      for (const position of positiveClaims) {
        const result = await signAndSend(CONTRACT_ID, "claim_revenue", [address, position.projectId]);
        setReceipt({ projectId: position.projectId, amount: position.amount, txHash: result.txHash });
      }
    } catch (cause) {
      setClaimError(cause instanceof Error ? cause.message : "The claim could not be confirmed.");
    } finally {
      await refreshPortfolio();
      setClaiming(false);
    }
  }, [address, connected, positiveClaims, refreshPortfolio, signAndSend]);

  const claimProject = useCallback(
    async (projectId: number) => {
      if (!connected || !address) return;
      const position = positiveClaims.find((item) => item.projectId === projectId);
      if (!position) return;
      setClaiming(true);
      setClaimError(null);
      setReceipt(null);
      try {
        const result = await signAndSend(CONTRACT_ID, "claim_revenue", [address, projectId]);
        setReceipt({ projectId, amount: position.amount, txHash: result.txHash });
      } catch (cause) {
        setClaimError(cause instanceof Error ? cause.message : "The claim could not be confirmed.");
      } finally {
        await refreshPortfolio();
        setClaiming(false);
      }
    },
    [address, connected, positiveClaims, refreshPortfolio, signAndSend]
  );

  const title = nav.find((item) => item.id === view)?.label ?? "Dashboard";

  return (
    <main className="min-h-screen bg-surface text-slate-100">
      <div className="flex min-h-screen relative">
        <Sidebar
          view={view}
          setView={setView}
          address={address}
          balance={balance}
          connected={connected}
          connect={connect}
        />
        <div className="min-w-0 flex-1 relative">
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-amber-200/20 via-emerald-100/30 to-transparent blur-[120px] pointer-events-none -z-10" />
          <header className="flex h-[76px] items-center justify-between border-b border-slate-200 bg-white/90 backdrop-blur-xl px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <div className="md:hidden"><Logo /></div>
              <span className="hidden text-xs text-slate-500 md:block font-body">
                App / <span className="text-slate-700">{title}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700 sm:flex">
                <span className="size-1.5 rounded-full bg-emerald-500" /> Stellar Testnet
              </div>
              <button
                type="button"
                onClick={connected ? disconnect : connect}
                className="h-9 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">account_balance_wallet</span>
                {connected && address ? "Disconnect" : "Conectar wallet"}
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] p-6 pb-28 lg:p-10 lg:pb-10">
            {claimError ? (
              <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                Claim failed: {claimError}
              </div>
            ) : null}
            {view === "dashboard" ? (
              <DashboardView
                setView={setView}
                catalog={catalog}
                portfolio={portfolio}
                catalogLoading={catalogLoading}
                portfolioLoading={portfolioLoading}
                claimAll={claimAll}
                claiming={claiming}
                connected={connected}
                connect={connect}
                nextProjectId={nextProjectId}
                totalMinted={totalMinted}
                holderMetrics={holderMetrics}
              />
            ) : null}

            {view === "projects" ? (
              <div>
                <h1 className="mb-2 text-3xl font-bold text-slate-900 font-display">Proyectos on-chain</h1>
                <p className="mb-7 text-sm text-slate-500">Solo project IDs derivados y leídos desde el contrato.</p>
                {catalogLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-md">Loading project state…</div>
                ) : catalog.projects.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-md">
                    {catalog.status === "empty" ? "No projects are registered." : "Project state unavailable."}
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {catalog.projects.map((project) => <ProjectCard key={project.id} project={project} />)}
                  </div>
                )}
              </div>
            ) : null}

            {view === "claim" ? (
              <ClaimView
                catalog={catalog}
                portfolio={portfolio}
                portfolioLoading={portfolioLoading}
                claimAll={claimAll}
                claimProject={claimProject}
                claiming={claiming}
                connected={connected}
                connect={connect}
                receipt={receipt}
              />
            ) : null}

            {view === "admin" ? <AdminView catalog={catalog} refreshCatalog={refreshCatalog} /> : null}
            {view === "metrics" ? <MetricsView catalog={catalog} catalogLoading={catalogLoading} /> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
