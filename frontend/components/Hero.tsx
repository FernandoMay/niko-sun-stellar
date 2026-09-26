"use client";

import {
  formatIntegerAmount,
  formatStroopsAsXlm,
} from "@/lib/amounts";
import { PUBLIC_EVIDENCE } from "@/lib/publicEvidence";

export default function Hero() {
  const evidence = PUBLIC_EVIDENCE;

  return (
    <section className="relative w-full overflow-hidden pb-10 bg-gradient-to-b from-emerald-50/60 via-white to-surface">
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-gradient-to-b from-amber-200/20 via-emerald-100/30 to-transparent blur-[120px] pointer-events-none -z-10" />
      <div className="absolute top-48 right-10 w-96 h-96 bg-emerald-200/20 blur-[140px] pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-5 lg:px-10 pt-8 lg:pt-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 flex flex-col items-start space-y-5">
            <div className="inline-flex items-center gap-3 px-5 py-2 rounded-full bg-white border border-emerald-200 shadow-sm">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
              </span>
              <span className="font-mono text-[11px] tracking-wider text-slate-700 font-semibold uppercase">
                Stellar Soroban • Testnet Snapshot
              </span>
            </div>

            <h1 className="font-display text-[28px] leading-[36px] lg:text-[56px] lg:leading-[64px] text-slate-900 tracking-tight font-bold max-w-2xl">
              Compra tokens de{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600">
                Proyectos Solares
              </span>{" "}
              con XLM. Reclama{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700">
                Ingresos Depositados
              </span>{" "}
              on-chain.
            </h1>

            <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
              <span className="material-symbols-outlined text-emerald-600 text-[14px]">
                lock_open
              </span>
              <span className="font-medium text-slate-600">
                CONTRACT: {evidence.contract.id.slice(0, 8)}…{evidence.contract.id.slice(-4)}
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-medium text-slate-600">LEDGER: {evidence.snapshotLedger}</span>
            </div>

            <p className="font-body text-[14px] leading-[22px] lg:text-[16px] lg:leading-[26px] text-slate-600 max-w-xl">
              Compra participaciones con XLM nativo mediante un contrato Soroban.
              Consulta el estado real del proyecto y reclama solo los ingresos
              que el creator haya depositado on-chain.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 w-full sm:w-auto">
              <a
                href="#projects"
                className="h-11 px-8 rounded-lg bg-emerald-600 text-white text-[14px] font-semibold shadow-md shadow-emerald-600/25 hover:bg-emerald-700 transition-all flex items-center gap-2 group"
              >
                <span>Explorar Proyectos</span>
                <span className="material-symbols-outlined text-[20px] transition-transform group-hover:translate-x-1">
                  solar_power
                </span>
              </a>
              <a
                href="/dashboard"
                className="h-11 px-6 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-[14px] font-semibold shadow-sm transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-amber-500 text-[18px]">
                  account_balance_wallet
                </span>
                <span>Abrir Dashboard Testnet</span>
              </a>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-slate-500 font-mono text-[12px]">
              <a href="/proof" className="inline-flex items-center gap-2 hover:text-emerald-700">
                <span className="material-symbols-outlined text-emerald-600 text-[16px]">
                  verified_user
                </span>
                <span className="font-medium text-slate-600">Protocol snapshot</span>
              </a>
              <span className="inline-flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500 text-[16px]">
                  science
                </span>
                <span className="font-medium text-slate-600">Demo telemetry excluded</span>
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 relative mt-8 lg:mt-0">
            <div className="relative w-full rounded-xl bg-white border border-emerald-100 p-6 shadow-xl shadow-emerald-950/5 overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-[18px] font-display font-bold text-slate-900">
                    Protocol snapshot
                  </span>
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
                  HISTORICAL SNAPSHOT
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Active projects</div>
                  <div className="mt-1 font-mono text-[28px] font-bold text-slate-900">1</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Tokens minted</div>
                  <div className="mt-1 font-mono text-[28px] font-bold text-slate-900">
                    {formatIntegerAmount(evidence.project.minted)}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Holders</div>
                  <div className="mt-1 font-mono text-[28px] font-bold text-slate-900">
                    {evidence.indexer.uniqueHolders}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Total contract inflows (sales + deposits)</div>
                  <div className="mt-1 font-mono text-[16px] font-bold text-emerald-700">
                    {formatStroopsAsXlm(evidence.project.totalRevenueStroops)}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                    check_circle
                  </span>
                  <span className="text-[13px] font-semibold text-emerald-900">Holder indexer reconciled</span>
                </div>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-emerald-800">
                  4 purchase events • 3 unique holders • indexed total 4 = contract minted 4
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 font-mono text-[10px] text-slate-500">
                 <span>Snapshot ledger {evidence.snapshotLedger} · observed {evidence.observedAt}</span>
                 <span className="ml-2 text-amber-700">Live Testnet may be newer</span>
                <a href="/proof" className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline">
                  View public proof
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
