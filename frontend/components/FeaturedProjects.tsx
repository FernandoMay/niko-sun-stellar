"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/WalletContext";
import { CONTRACT_ID } from "@/lib/contract";
import {
  boundedPercent,
  formatIntegerAmount,
  formatStroopsAsXlm,
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

export default function FeaturedProjects() {
  const { readContract } = useWallet();
  const [catalog, setCatalog] = useState<ProjectCatalog>(EMPTY_CATALOG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
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

  return (
    <section
      id="projects"
      className="w-full max-w-7xl mx-auto px-5 lg:px-10 py-12"
    >
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider font-semibold text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Estado On-chain</span>
          </div>
          <h2 className="font-display text-[24px] leading-[32px] lg:text-[40px] lg:leading-[48px] text-slate-900 font-bold">
            Proyectos Solares
          </h2>
          <p className="mt-2 text-[13px] text-slate-500">
            Project IDs are derived from <span className="font-mono">next_project_id - 1</span>. No unavailable project receives a business-data fallback.
          </p>
        </div>
        <div className="rounded-full border border-slate-200 bg-white px-4 py-2 font-mono text-[11px] text-slate-600">
          {isLoading
            ? "Loading Testnet state…"
            : catalog.status === "unavailable"
              ? "Project state unavailable"
              : `${catalog.projects.length} project${catalog.projects.length === 1 ? "" : "s"} loaded`}
        </div>
      </div>

      {catalog.status === "partial" ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
          Some project reads are unavailable. Only the fields that loaded successfully are shown.
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-md">
          Loading project state from Stellar Testnet…
        </div>
      ) : catalog.projects.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-md">
          <div className="font-display text-[18px] font-bold text-slate-900">
            {catalog.status === "empty" ? "No projects are registered" : "Project state unavailable"}
          </div>
          <p className="mt-2 text-[13px] text-slate-500">
            {catalog.status === "empty"
              ? "The contract currently reports no project IDs."
              : "The application does not substitute demo projects when reads fail."}
          </p>
          <a href="/proof" className="mt-4 inline-flex text-[12px] font-semibold text-emerald-700 hover:underline">
            View the verified public snapshot
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {catalog.projects.map((project) => {
            const progress =
              project.totalSupply !== null && project.minted !== null
                ? boundedPercent(project.minted, project.totalSupply)
                : null;
            return (
              <article
                key={project.id}
                className="flex flex-col rounded-xl bg-white border border-slate-200 overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:translate-y-[-4px] relative"
              >
                {project.stateComplete ? (
                  <span className="absolute top-3 right-3 z-10 rounded-full border border-emerald-200 bg-white/95 px-2.5 py-1 text-[9px] font-mono font-bold text-emerald-700">
                    ON-CHAIN
                  </span>
                ) : (
                  <span className="absolute top-3 right-3 z-10 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-mono font-bold text-amber-700">
                    PARTIAL
                  </span>
                )}

                <div className="relative h-48 w-full overflow-hidden">
                  <img
                    className="w-full h-full object-cover"
                    src="https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&h=400&fit=crop"
                    alt="Illustrative solar panel image"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/10 to-transparent" />
                  <span className="absolute bottom-3 left-4 rounded bg-slate-900/80 px-2 py-1 text-[9px] font-mono text-white">
                    ILLUSTRATIVE IMAGE
                  </span>
                </div>

                <div className="p-6 flex flex-1 flex-col justify-between gap-5">
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-[20px] font-display text-slate-900 font-bold">
                        {project.name ?? `Project #${project.id}`}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                          project.active === true
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-slate-200 bg-slate-100 text-slate-500"
                        }`}
                      >
                        {project.active === true ? "Active" : project.active === false ? "Inactive" : "Unavailable"}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-slate-500">
                      Project ID {project.id}
                      {project.creator ? ` · ${project.creator.slice(0, 6)}…${project.creator.slice(-4)}` : ""}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
                    <div>
                      <span className="font-mono text-[10px] text-slate-500 block">PRICE / TOKEN</span>
                      <span className="font-mono text-[14px] text-orange-600 font-bold">
                        {formatStroopsAsXlm(project.price)}
                      </span>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] text-slate-500 block">MINTED</span>
                      <span className="font-mono text-[14px] text-slate-900 font-bold">
                        {project.minted === null ? "—" : formatIntegerAmount(project.minted)}
                      </span>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] text-slate-500 block">SALES BALANCE</span>
                      <span className="font-mono text-[14px] text-slate-900 font-bold">
                        {formatStroopsAsXlm(project.salesBalance)}
                      </span>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] text-slate-500 block">ENERGY</span>
                      <span className="font-mono text-[14px] text-slate-900 font-bold">
                        {project.totalEnergyKwh === null
                          ? "Unavailable"
                          : `${formatIntegerAmount(project.totalEnergyKwh)} kWh`}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center font-mono text-[11px]">
                      <span className="text-slate-500">Mint progress</span>
                      <span className="text-emerald-700 font-bold">
                        {progress === null ? "—" : `${progress}%`}
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                        style={{ width: `${progress ?? 0}%` }}
                      />
                    </div>
                  </div>

                  <a
                    href={`/project/${project.id}`}
                    className="w-full h-11 rounded-lg bg-secondary text-white text-[13px] font-semibold shadow-md shadow-orange-500/20 hover:bg-orange-600 transition-all flex items-center justify-center gap-2"
                  >
                    <span>Ver proyecto</span>
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
