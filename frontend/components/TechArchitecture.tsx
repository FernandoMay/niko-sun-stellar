"use client";

import { useState } from "react";
import { PUBLIC_EVIDENCE } from "@/lib/publicEvidence";

const protocolSteps = [
  {
    icon: "account_balance_wallet",
    title: "Native XLM Purchase",
    desc: "purchase_tokens receives native XLM and updates the project's minted supply and sales balance.",
  },
  {
    icon: "database",
    title: "Observable Project State",
    desc: "Project name, supply, price, active status, energy, revenue, and sales balance are read from contract views.",
  },
  {
    icon: "payments",
    title: "Explicit Revenue Deposit",
    desc: "Only the project creator can deposit revenue; no off-chain yield is presented as an on-chain balance.",
  },
  {
    icon: "receipt_long",
    title: "Proportional Claims",
    desc: "get_claimable derives each holder's amount and claim_revenue transfers native XLM to that holder.",
  },
];

export default function TechArchitecture() {
  const [copied, setCopied] = useState(false);
  const contractId = PUBLIC_EVIDENCE.contract.id;
  const shortContract = `${contractId.slice(0, 6)}...${contractId.slice(-4)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contractId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="tech" className="w-full bg-gradient-to-b from-emerald-50/50 to-slate-100/70 border-y border-slate-200 py-16 mt-12">
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 flex flex-col space-y-6">
            <span className="font-mono text-[11px] uppercase tracking-widest text-orange-700 bg-orange-100 border border-orange-200 px-5 py-2 rounded-full w-fit font-semibold">
              Evidencia antes queAfirmaciones
            </span>
            <h2 className="font-display text-[24px] leading-[32px] lg:text-[40px] lg:leading-[48px] text-slate-900 font-bold">
              Soroban + Native XLM Settlement
            </h2>
            <p className="text-[14px] text-slate-600 leading-relaxed">
              NIKO SUN demonstrates a narrow, transaction-verifiable flow:
              project state, purchases, explicit creator deposits, holder claims,
              and event-based reconciliation. The interface does not claim an
              oracle, legal title, audit, fiat valuation, or guaranteed return.
            </p>

            <div className="space-y-5 pt-2">
              {protocolSteps.map((step) => (
                <div key={step.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-emerald-600 text-[20px]">
                      {step.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[16px] text-slate-900 font-bold font-display">
                      {step.title}
                    </h3>
                    <p className="text-[13px] text-slate-600 leading-relaxed mt-0.5">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-xl bg-white border border-slate-200 p-6 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <div className="text-[16px] font-display font-bold text-slate-900">
                    Public Protocol Receipt
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                    Observed state • no demo telemetry
                  </div>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-700">
                  RECONCILED
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="font-mono text-[10px] uppercase text-slate-500">Project</div>
                  <div className="mt-1 text-[14px] font-bold text-slate-900">
                    {PUBLIC_EVIDENCE.project.name}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="font-mono text-[10px] uppercase text-slate-500">Snapshot ledger</div>
                  <div className="mt-1 font-mono text-[14px] font-bold text-slate-900">
                    {PUBLIC_EVIDENCE.snapshotLedger}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="font-mono text-[10px] uppercase text-slate-500">Purchase events</div>
                  <div className="mt-1 font-mono text-[14px] font-bold text-slate-900">
                    {PUBLIC_EVIDENCE.indexer.purchaseEvents}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="font-mono text-[10px] uppercase text-slate-500">Unique holders</div>
                  <div className="mt-1 font-mono text-[14px] font-bold text-slate-900">
                    {PUBLIC_EVIDENCE.indexer.uniqueHolders}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-600 text-[18px]">
                    verified_user
                  </span>
                  <span className="text-[13px] font-semibold text-emerald-900">
                    Stellar Testnet contract
                  </span>
                </div>
                <a
                  href={PUBLIC_EVIDENCE.contract.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block font-mono text-[12px] font-bold text-emerald-700 hover:underline"
                  title={contractId}
                >
                  {shortContract}
                </a>
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="px-2.5 py-1.5 rounded border border-emerald-200 bg-white text-emerald-700 text-[11px] font-medium hover:bg-emerald-50 transition-colors flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      {copied ? "check" : "content_copy"}
                    </span>
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                  <a
                    href="/proof"
                    className="px-2.5 py-1.5 rounded border border-emerald-200 bg-white text-emerald-700 text-[11px] font-medium hover:bg-emerald-50 transition-colors"
                  >
                    Ver evidencia
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
