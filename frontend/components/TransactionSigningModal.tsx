"use client";

import { useEffect, useRef } from "react";
import {
  formatIntegerAmount,
  formatStroopsAsXlm,
} from "@/lib/amounts";

interface SigningModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  phase:
    | "idle"
    | "preparing"
    | "signing"
    | "submitting"
    | "success"
    | "error"
    | "rejected"
    | "insufficient_balance"
    | "wallet_missing";
  errorMessage?: string;
  projectName: string;
  tokenAmount: bigint;
  costStroops: bigint;
  walletAddress: string;
  walletBalance: string;
  contractId: string;
}

function shortAddress(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "—";
}

function shortContract(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "—";
}

const PHASE_CONFIG = {
  idle: {
    icon: "key",
    label: "Firmar con Freighter",
    btnClass: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/25",
    showSpinner: false,
  },
  preparing: {
    icon: "sync",
    label: "Preparando transacción…",
    btnClass: "bg-emerald-600 opacity-70 cursor-not-allowed text-white",
    showSpinner: true,
  },
  signing: {
    icon: "key",
    label: "Esperando firma…",
    btnClass: "bg-emerald-600 opacity-70 cursor-not-allowed text-white",
    showSpinner: true,
  },
  submitting: {
    icon: "sync",
    label: "Enviando a Stellar…",
    btnClass: "bg-emerald-600 opacity-70 cursor-not-allowed text-white",
    showSpinner: true,
  },
  success: {
    icon: "check_circle",
    label: "Transacción confirmada",
    btnClass: "bg-emerald-700 text-white",
    showSpinner: false,
  },
  error: {
    icon: "error",
    label: "Error de transacción",
    btnClass: "bg-red-600 text-white",
    showSpinner: false,
  },
  rejected: {
    icon: "cancel",
    label: "Firma rechazada",
    btnClass: "bg-slate-500 text-white",
    showSpinner: false,
  },
  insufficient_balance: {
    icon: "account_balance_wallet",
    label: "Saldo insuficiente",
    btnClass: "bg-red-600 text-white",
    showSpinner: false,
  },
  wallet_missing: {
    icon: "extension",
    label: "Freighter no detectado",
    btnClass: "bg-orange-600 text-white",
    showSpinner: false,
  },
} as const;

export default function TransactionSigningModal({
  open,
  onClose,
  onConfirm,
  phase,
  errorMessage,
  projectName,
  tokenAmount,
  costStroops,
  walletAddress,
  walletBalance,
  contractId,
}: SigningModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const config = PHASE_CONFIG[phase] ?? PHASE_CONFIG.idle;
  const terminal = [
    "success",
    "error",
    "rejected",
    "insufficient_balance",
    "wallet_missing",
  ].includes(phase);

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape" && terminal) onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, open, terminal]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/45 backdrop-blur-md"
      onClick={(event) => {
        if (event.target === event.currentTarget && terminal) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-emerald-500/20"
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-amber-500 to-teal-500" />
        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
          <div>
            <h3 className="font-display text-[16px] font-bold tracking-tight text-slate-900">
              Confirmar purchase_tokens
            </h3>
            <p className="mt-1 font-mono text-xs text-slate-500">
              Stellar Testnet · native XLM settlement
            </p>
          </div>
          {terminal ? (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="Cerrar"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          ) : null}
        </div>

        <div className="p-6 sm:p-8 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="rounded-xl p-5 bg-slate-50 border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Project</div>
                <div className="mt-1 font-display text-[16px] font-bold text-slate-900">{projectName}</div>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-700">
                STROOP-SAFE
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Token amount</div>
                <div className="mt-1 font-mono text-[20px] font-bold text-slate-900">
                  {formatIntegerAmount(tokenAmount)}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Exact debit</div>
                <div className="mt-1 font-mono text-[16px] font-bold text-orange-700">
                  {formatStroopsAsXlm(costStroops)}
                </div>
                <div className="mt-1 font-mono text-[10px] text-slate-400">{costStroops.toString()} stroops</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
            <div className="bg-slate-100 px-4 py-2.5 font-semibold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Stellar Soroban parameters</span>
              <span className="font-mono text-emerald-700 normal-case">Testnet</span>
            </div>
            <div className="divide-y divide-slate-200 bg-white">
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-slate-500">Signing wallet</span>
                <span className="font-mono font-bold text-slate-900">{shortAddress(walletAddress)}</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-slate-500">Contract</span>
                <span className="font-mono font-bold text-slate-900">{shortContract(contractId)}</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-slate-500">Settlement asset</span>
                <span className="font-mono font-bold text-emerald-700">Native XLM</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-slate-500">Network fee</span>
                <span className="font-mono text-slate-700">Calculated by Stellar</span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-4">
                <span className="text-slate-500">Finality boundary</span>
                <span className="font-mono text-slate-700">Closed ledger</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-4 bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <span className="material-symbols-outlined text-emerald-700 text-[22px] mt-0.5">lock</span>
            <div>
              <h4 className="font-display text-[13px] text-emerald-950 font-bold uppercase tracking-wide">Local wallet signature</h4>
              <p className="text-[13px] text-emerald-800 leading-relaxed">
                Freighter signs this purchase invocation locally. NIKO SUN does not receive or store your private key.
              </p>
            </div>
          </div>

          {phase === "error" && errorMessage ? (
            <div className="rounded-xl p-4 bg-red-50 border border-red-200 text-[13px] text-red-700 break-words">
              {errorMessage}
            </div>
          ) : null}
          {phase === "rejected" ? (
            <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 text-[13px] text-amber-800">
              The wallet signature was rejected. No purchase was submitted.
            </div>
          ) : null}
          {phase === "insufficient_balance" ? (
            <div className="rounded-xl p-4 bg-red-50 border border-red-200 text-[13px] text-red-700">
              The connected wallet does not have enough native XLM for the exact debit and network fee.
            </div>
          ) : null}
          {phase === "wallet_missing" ? (
            <div className="rounded-xl p-4 bg-orange-50 border border-orange-200 text-[13px] text-orange-800">
              Install or unlock Freighter, then try again.
            </div>
          ) : null}

          <div className="space-y-3 pt-2">
            {terminal ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className={`w-full sm:flex-1 py-4 px-6 rounded-xl font-display text-[14px] font-bold transition-all flex items-center justify-center gap-2 ${config.btnClass}`}
                >
                  <span className="material-symbols-outlined text-[20px]">{config.icon}</span>
                  {phase === "wallet_missing" ? "Cerrar" : "Entendido"}
                </button>
                {phase === "wallet_missing" ? (
                  <a
                    href="https://freighter.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto py-4 px-6 rounded-xl bg-slate-100 text-slate-700 font-medium border border-slate-200 text-center"
                  >
                    Open Freighter
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={phase !== "idle"}
                  className={`w-full sm:flex-1 py-4 px-6 rounded-xl font-display text-[14px] font-bold shadow-lg transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed ${config.btnClass}`}
                >
                  {config.showSpinner ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[20px]">{config.icon}</span>
                  )}
                  <span>{phase === "idle" ? `Sign ${formatStroopsAsXlm(costStroops)}` : config.label}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  disabled={phase !== "idle"}
                  className="w-full sm:w-auto py-4 px-6 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 font-medium transition-colors disabled:opacity-40"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        {phase === "preparing" || phase === "signing" || phase === "submitting" ? (
          <div className="p-4 bg-emerald-900 text-white flex items-center justify-center gap-3">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-xs font-semibold">{config.label}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
