"use client";

import { useWallet } from "@/lib/WalletContext";

export default function WalletModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { connect } = useWallet();

  if (!open) return null;

  const handleFreighter = async () => {
    try {
      await connect();
      onClose();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Error al conectar con Freighter"
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-slate-200 p-8 rounded-xl shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <h3 className="text-[20px] font-display font-bold text-slate-900">
            Conectar Billetera Stellar
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="text-[13px] text-slate-600 my-5 leading-relaxed">
          Selecciona tu proveedor de llaves preferido para interactuar con los
          smart contracts Soroban de NIKO SUN:
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleFreighter}
            className="w-full p-4 rounded-lg bg-slate-50 border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 transition-colors flex items-center justify-between text-slate-900"
          >
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-600">
                electric_bolt
              </span>
              <span className="text-[16px] font-semibold">
                Freighter Wallet
              </span>
            </div>
            <span className="font-mono text-[11px] font-semibold text-emerald-700">
              RECOMENDADO
            </span>
          </button>

          <div className="w-full p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-slate-500">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-slate-400">
                account_balance_wallet
              </span>
              <span className="text-[16px] font-semibold">Lobstr Mobile</span>
            </div>
            <span className="font-mono text-[10px] font-medium text-slate-400">
              UNAVAILABLE
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-5 text-center">
          Freighter es la billetera recomendada para Stellar y Soroban.
          Instálala desde{" "}
          <a
            href="https://freighter.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 underline"
          >
            freighter.app
          </a>
        </p>
      </div>
    </div>
  );
}
