"use client";

import { useState } from "react";
import PdfCertificate from "@/components/PdfCertificate";
import { TX_EXPLORER } from "@/lib/contract";
import {
  formatIntegerAmount,
  formatStroopsAsXlm,
} from "@/lib/amounts";

interface TransactionSuccessProps {
  open: boolean;
  onClose: () => void;
  txHash: string;
  tokenAmount: bigint;
  costStroops: bigint;
  projectName: string;
  walletAddress: string;
  contractId: string;
}

function shortAddress(value: string) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "—";
}

function shortHash(value: string) {
  return value ? `${value.slice(0, 10)}...${value.slice(-10)}` : "—";
}

export default function TransactionSuccess({
  open,
  onClose,
  txHash,
  tokenAmount,
  costStroops,
  projectName,
  walletAddress,
  contractId,
}: TransactionSuccessProps) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const copyHash = async () => {
    await navigator.clipboard?.writeText(txHash);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/45 backdrop-blur-md">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-emerald-400 to-amber-400" />
        <div className="p-6 sm:p-10">
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 font-mono text-[11px] font-semibold text-emerald-700">
              <span className="size-2 rounded-full bg-emerald-600" />
              STELLAR TESTNET · TRANSACTION CONFIRMED
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-2xl text-center">
            <div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <span className="material-symbols-outlined text-[34px]">check_circle</span>
            </div>
            <h1 className="mt-5 font-display text-[26px] font-bold text-slate-900">
              Technical transaction receipt
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
              purchase_tokens was confirmed for {projectName}. This receipt records the finalized transaction; it is not a legal, audit, custody, physical-asset, or yield certificate.
            </p>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="font-mono text-[11px] uppercase text-slate-500">Transaction</span>
              <code className="font-mono text-[12px] font-bold text-slate-900">{shortHash(txHash)}</code>
              <button
                type="button"
                onClick={() => void copyHash()}
                className="text-emerald-700 hover:text-emerald-900"
                title="Copy transaction hash"
              >
                <span className="material-symbols-outlined text-[15px]">{copied ? "check" : "content_copy"}</span>
              </button>
              <a
                href={TX_EXPLORER(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700 hover:underline"
              >
                View TX
                <span className="material-symbols-outlined text-[13px]">open_in_new</span>
              </a>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Exact debit</div>
              <div className="mt-1 font-mono text-[26px] font-bold text-orange-700">
                {formatStroopsAsXlm(costStroops)}
              </div>
              <div className="mt-1 font-mono text-[10px] text-slate-400">{costStroops.toString()} stroops</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Token amount</div>
              <div className="mt-1 font-mono text-[26px] font-bold text-slate-900">
                {formatIntegerAmount(tokenAmount)}
              </div>
              <div className="mt-1 font-mono text-[10px] text-slate-400">purchase_tokens argument</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Signing wallet</div>
              <div className="mt-1 font-mono text-[14px] font-bold text-slate-900">{shortAddress(walletAddress)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Contract</div>
              <div className="mt-1 font-mono text-[14px] font-bold text-slate-900">{shortAddress(contractId)}</div>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <PdfCertificate
              data={{
                projectName,
                tokenAmount: tokenAmount.toString(),
                amountPaid: formatStroopsAsXlm(costStroops),
                walletAddress,
                txHash,
              }}
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href="/proof"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Public proof
              </a>
              <a
                href="/dashboard"
                className="rounded-lg bg-emerald-600 px-5 py-2 text-center text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Open dashboard
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
