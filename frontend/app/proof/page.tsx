import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  formatIntegerAmount,
  formatStroopsAsXlm,
} from "@/lib/amounts";
import { PUBLIC_EVIDENCE } from "@/lib/publicEvidence";
import {
  OG_IMAGE,
  SITE_LOCALE,
  SITE_NAME,
  absoluteUrl,
} from "@/lib/site";

/**
 * This page renders a frozen, historical snapshot recorded at
 * `PUBLIC_EVIDENCE.snapshotLedger`. The copy states that explicitly instead of
 * presenting the numbers as current live state.
 */
export const metadata: Metadata = {
  title: {
    absolute: `Evidencia pública on-chain · ${SITE_NAME} Stellar Testnet`,
  },
  description: `Evidencia pública del prototipo Soroban en Stellar Testnet: contrato desplegado, estado del proyecto, compras, depósitos y reclamos observados en el ledger ${PUBLIC_EVIDENCE.snapshotLedger}, con enlaces al explorador. Snapshot histórico, no estado en vivo.`,
  alternates: { canonical: "/proof/" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: SITE_LOCALE,
    siteName: SITE_NAME,
    url: absoluteUrl("/proof/"),
    title: `Evidencia pública on-chain · ${SITE_NAME} Stellar Testnet`,
    description: `Evidencia pública del prototipo Soroban en Stellar Testnet: contrato desplegado, estado del proyecto, compras, depósitos y reclamos observados en el ledger ${PUBLIC_EVIDENCE.snapshotLedger}, con enlaces al explorador. Snapshot histórico, no estado en vivo.`,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: `Evidencia pública on-chain · ${SITE_NAME} Stellar Testnet`,
    description: `Evidencia pública del prototipo Soroban en Stellar Testnet: contrato desplegado, estado del proyecto, compras, depósitos y reclamos observados en el ledger ${PUBLIC_EVIDENCE.snapshotLedger}, con enlaces al explorador. Snapshot histórico, no estado en vivo.`,
    images: [OG_IMAGE.url],
  },
};

function ExplorerLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
    >
      {children}
      <span className="material-symbols-outlined text-[13px]">open_in_new</span>
    </a>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 break-words font-mono text-[13px] font-bold text-slate-900">
        {value}
      </div>
    </div>
  );
}

function Section({
  id,
  index,
  title,
  description,
  children,
}: {
  id: string;
  index: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white shadow-md">
      <div className="border-b border-slate-100 px-6 py-5 lg:px-8">
        <div className="flex items-start gap-4">
          <span className="font-mono text-[12px] font-bold text-emerald-600">{index}</span>
          <div>
            <h2 className="font-display text-[22px] font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-6 lg:p-8">{children}</div>
    </section>
  );
}

export default function ProofPage() {
  const evidence = PUBLIC_EVIDENCE;

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main className="mx-auto w-full max-w-7xl px-5 pb-20 pt-28 lg:px-10">
        <div className="mb-8 rounded-2xl border border-emerald-200 bg-white p-6 shadow-md lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-[10px] font-bold text-emerald-700">
                  Protocol snapshot
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-[10px] font-semibold text-slate-600">
                  Network: Stellar Testnet
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-[10px] font-bold text-emerald-700">
                  Reconciled
                </span>
              </div>
              <h1 className="font-display text-[32px] font-bold tracking-tight text-slate-900 lg:text-[42px]">
                NIKO SUN — Evidencia pública del protocolo
              </h1>
              <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-slate-600">
                Los valores siguientes son estado on-chain observado en Stellar Testnet o evidencia directa de transacciones. Se excluyen telemetría demo, metadatos físicos estimados, afirmaciones legales y valoración fiat.
              </p>
            </div>
            <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-[11px] text-slate-600">
               <div>Observed: {evidence.observedAt} ({evidence.observedAtPrecision})</div>
               <div className="mt-1 text-amber-700">{evidence.notes.historicalSnapshot}</div>
               <div className="mt-1">
                Snapshot ledger:{" "}
                <ExplorerLink href={evidence.ledgerExplorerUrl}>
                  {evidence.snapshotLedger}
                </ExplorerLink>
              </div>
              <div className="mt-1">
                Source:{" "}
                <ExplorerLink href={evidence.sourceUrl}>{evidence.sourceCommit}</ExplorerLink>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Section
            id="deployment"
            index="01"
            title="Deployment"
            description="Contract identity, deployment receipt, source commit, and exact WASM digest."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric label="Contract" value={evidence.contract.id} />
              <Metric
                label="Deployment ledger"
                value={
                  <ExplorerLink href={evidence.contract.deploymentTxUrl}>
                    {evidence.contract.deploymentLedger}
                  </ExplorerLink>
                }
              />
              <Metric
                label="Deployment TX"
                value={
                  <ExplorerLink href={evidence.contract.deploymentTxUrl}>
                    {evidence.contract.deploymentTxHash.slice(0, 12)}…{evidence.contract.deploymentTxHash.slice(-8)}
                  </ExplorerLink>
                }
              />
              <Metric label="WASM SHA-256" value={evidence.contract.wasmSha256} />
              <Metric label="Optimized WASM" value={`${evidence.contract.optimizedWasmBytes} bytes`} />
              <Metric
                label="Public contract"
                value={<ExplorerLink href={evidence.contract.explorerUrl}>View Contract</ExplorerLink>}
              />
            </div>
          </Section>

          <Section
            id="project"
            index="02"
            title="Project"
            description="Project #1 state read from get_project, get_project_name, and get_sales_balance."
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-[20px] font-bold text-slate-900">
                  {evidence.project.name}
                </h3>
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  Creator: {evidence.project.creator}
                </p>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                Active
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Total supply" value={formatIntegerAmount(evidence.project.totalSupply)} />
              <Metric label="Minted" value={formatIntegerAmount(evidence.project.minted)} />
              <Metric label="Price / token" value={formatStroopsAsXlm(evidence.project.priceStroops)} />
              <Metric label="Minimum purchase" value={`${evidence.project.minPurchase} token`} />
              <Metric label="Sales balance" value={formatStroopsAsXlm(evidence.project.salesBalanceStroops)} />
              <Metric label="Total contract inflows (sales + deposits)" value={formatStroopsAsXlm(evidence.project.totalRevenueStroops)} />
              <Metric label="Energy recorded" value={`${evidence.project.energyKwh} kWh`} />
              <Metric label="Reward index" value={evidence.project.rewardPerTokenStored} />
            </div>
          </Section>

          <Section
            id="transactions"
            index="03"
             title="Purchases + Contract Inflows/Claims"

             description="Four successful purchases, one explicit contract-inflow deposit, and the final proportional claim state. Total contract inflows include sales plus deposits; claimable amounts are shown separately."

          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[12px]">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">Event</th>
                    <th className="pb-3 pr-4 font-medium">Holder</th>
                    <th className="pb-3 pr-4 font-medium">Tokens</th>
                    <th className="pb-3 pr-4 font-medium">Amount</th>
                    <th className="pb-3 pr-4 font-medium">Ledger</th>
                    <th className="pb-3 font-medium">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.purchases.map((purchase) => (
                    <tr key={purchase.id} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-semibold text-slate-900">{purchase.id}</td>
                      <td className="py-3 pr-4 font-mono text-slate-600">
                        {purchase.buyer.slice(0, 6)}…{purchase.buyer.slice(-4)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-slate-700">{purchase.tokenAmount}</td>
                      <td className="py-3 pr-4 font-mono text-slate-700">
                        {formatStroopsAsXlm(purchase.priceStroops)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-slate-600">{purchase.ledger}</td>
                      <td className="py-3">
                        <ExplorerLink href={purchase.txUrl}>View TX</ExplorerLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                   <div className="font-semibold text-orange-900">Contract inflow deposit</div>

                  <div className="mt-1 font-mono text-[11px] text-orange-700">
                    {formatStroopsAsXlm(evidence.revenue.amountStroops)} at ledger {evidence.revenue.depositLedger}
                  </div>
                </div>
                <ExplorerLink href={evidence.revenue.depositTxUrl}>View deposit TX</ExplorerLink>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-[12px]">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="pb-3 pr-4 font-medium">Holder</th>
                    <th className="pb-3 pr-4 font-medium">Final status</th>
                    <th className="pb-3 pr-4 font-medium">Paid</th>
                    <th className="pb-3 pr-4 font-medium">Claimable</th>
                    <th className="pb-3 pr-4 font-medium">Ledger</th>
                    <th className="pb-3 font-medium">Transaction</th>
                  </tr>
                </thead>
                <tbody>
                  {evidence.claims.map((claim) => (
                    <tr key={claim.holder} className="border-b border-slate-100">
                      <td className="py-3 pr-4 font-semibold text-slate-900">
                        {claim.holder} · {claim.address.slice(0, 6)}…{claim.address.slice(-4)}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={
                            claim.status === "claimed"
                              ? "font-semibold text-emerald-700"
                              : "font-semibold text-orange-700"
                          }
                        >
                          {claim.status === "claimed" ? "Claimed" : "Claimable"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-slate-700">
                        {formatStroopsAsXlm(claim.paidStroops)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-slate-700">
                        {formatStroopsAsXlm(claim.claimableStroops)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-slate-600">
                        {claim.ledger ?? "—"}
                      </td>
                      <td className="py-3">
                        {claim.txUrl ? (
                          <ExplorerLink href={claim.txUrl}>View TX</ExplorerLink>
                        ) : (
                          <span className="font-mono text-[11px] text-orange-700">No claim TX</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] font-medium text-orange-700">{evidence.notes.cClaimStatus}</p>
          </Section>

          <Section
            id="reconciliation"
            index="04"
            title="Indexer Reconciliation"
            description="Purchase-event balances are compared with contract-minted supply before the holder count is marked verified."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Metric label="Purchase events" value={evidence.indexer.purchaseEvents} />
              <Metric label="Unique holders" value={evidence.indexer.uniqueHolders} />
              <Metric label="Indexed total" value={evidence.indexer.indexedTokenTotal} />
              <Metric label="Contract minted" value={evidence.indexer.contractMinted} />
              <Metric
                label="Final state"
                value={<span className="text-emerald-700">Reconciled</span>}
              />
            </div>
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[12px] leading-relaxed text-emerald-900">
              The indexer observed four purchase events and three unique holders. Its reconstructed token total is exactly four, matching contract minted supply. The verified final holder distribution is A: 2, B: 1, C: 1.
            </div>
            <p className="mt-4 font-mono text-[10px] leading-relaxed text-slate-500">
              {evidence.notes.valueBasis}. {evidence.notes.telemetry}
            </p>
          </Section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
