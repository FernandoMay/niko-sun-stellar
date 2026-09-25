"use client";

import { PUBLIC_EVIDENCE } from "@/lib/publicEvidence";

const linkClass =
  "text-[13px] text-slate-600 hover:text-emerald-700 transition-colors";
const unavailableClass =
  "text-[13px] text-slate-400";

export default function Footer() {
  return (
    <footer className="w-full bg-white border-t border-slate-200 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-5 lg:px-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="md:col-span-2 space-y-5">
            <div className="flex items-center gap-2">
              <span className="text-[24px] font-display font-bold tracking-tight text-slate-900">
                NIKO SUN
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-emerald-800 font-mono text-[11px] font-semibold">
                TESTNET PROTOCOL
              </span>
            </div>
            <p className="text-[13px] text-slate-600 max-w-md leading-relaxed">
              Compra participaciones registradas en un contrato Soroban y
              reclama únicamente los ingresos que el creator deposita en la red.
            </p>
            <div className="font-mono text-[12px] text-emerald-700 font-semibold">
              Built by NIKO-SUN • Powered by Stellar Soroban
            </div>
          </div>

          <div className="flex flex-col space-y-3">
            <span className="text-[13px] text-slate-900 font-bold uppercase tracking-wider">
              Ecosystem
            </span>
            <a href="/#projects" className={linkClass}>
              Proyectos Solares
            </a>
            <a href="/proof" className={linkClass}>
              Evidencia Pública
            </a>
            <a
              href={PUBLIC_EVIDENCE.contract.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              Contrato en Stellar Expert
            </a>
            <span className={unavailableClass}>Telemetría IoT: no verificada</span>
          </div>

          <div className="flex flex-col space-y-3">
            <span className="text-[13px] text-slate-900 font-bold uppercase tracking-wider">
              Recursos & Red
            </span>
            <a href="/proof" className={linkClass}>
              Evidence Pack
            </a>
            <a href="/dashboard" className={linkClass}>
              Testnet Dashboard
            </a>
            <a
              href="https://github.com/FernandoMay/niko-sun-stellar"
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
              title="Repositorio oficial — github.com/FernandoMay/niko-sun-stellar"
            >
              GitHub Source
            </a>
            <span className={unavailableClass}>Canales comunitarios: no disponibles</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 font-mono text-[11px] leading-relaxed">
          <strong className="text-slate-900 font-semibold">
            Testnet evidence boundary:
          </strong>{" "}
          This interface does not represent an audit, legal title, fiduciary
          custody, guaranteed yield, verified physical generation, fiat valuation,
          or off-chain IoT telemetry. Use only the observed values and transaction
          links in the public proof pack.
        </div>
      </div>
    </footer>
  );
}
