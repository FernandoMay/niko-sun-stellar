"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/lib/WalletContext";
import WalletModal from "./WalletModal";

export default function Header() {
  const { address, connected, connecting, connect, disconnect, balance } =
    useWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const handleConnect = async () => {
    try {
      await connect();
    } catch {
      setModalOpen(true);
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-sm">
        <div className="h-16 max-w-7xl mx-auto px-5 lg:px-10 flex items-center justify-between gap-6">
          {/* Official NIKO SUN logo, cropped from the clean brand asset. */}
          <a href="/" className="flex items-center group" aria-label="NIKO SUN, volver al inicio">
            <img
              src="/niko-sun-logo.png"
              alt="NIKO SUN — Solar power and RWA tokens"
              width={930}
              height={428}
              className="h-14 w-auto max-w-[220px] object-contain transition-transform group-hover:scale-[1.02]"
              decoding="async"
            />
          </a>

          {/* Nav */}
          <nav className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-50 border border-stone-200/80 shadow-inner">
            <a
              href="/#projects"
              className="text-emerald-900 bg-emerald-100/80 border border-emerald-300 rounded-full px-4 py-1.5 text-xs font-semibold shadow-sm transition-all"
            >
              Proyectos Solares
            </a>
            <a
              href="/#how"
              className="text-stone-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-full px-4 py-1.5 text-xs font-medium transition-all"
            >
              Cómo Funciona
            </a>
            <a
              href="/#tech"
              className="text-stone-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-full px-4 py-1.5 text-xs font-medium transition-all"
            >
              Seguridad & RWA
            </a>
            <a
              href="/dashboard"
              className="text-stone-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-full px-4 py-1.5 text-xs font-medium transition-all"
            >
              Dashboard
            </a>
            <a
              href="/proof"
              className="text-stone-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-full px-4 py-1.5 text-xs font-medium transition-all flex items-center gap-1"
            >
              Public Proof{" "}
              <span className="material-symbols-outlined text-[13px] text-stone-400">
                open_in_new
              </span>
            </a>
          </nav>

          {/* Network + Wallet */}
          <div className="flex items-center gap-3.5">
            {mounted && connected && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
                </span>
                <span className="font-mono text-xs font-semibold text-emerald-800">
                  Stellar Testnet
                </span>
                <span className="text-[10px] text-stone-500 border-l border-emerald-200 pl-1.5 font-mono">
                  SOROBAN
                </span>
              </div>
            )}

            {!mounted ? (
              <div className="h-10 w-40 rounded-xl bg-slate-100 animate-pulse" />
            ) : connected && address ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={disconnect}
                  className="h-10 px-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-bold shadow-sm hover:bg-emerald-100 transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    account_circle
                  </span>
                  {address.slice(0, 4)}...{address.slice(-4)}
                </button>
                <div className="flex flex-col items-end">
                  <span className="font-mono text-[11px] text-emerald-700 font-bold">
                    {balance === "Unavailable" ? "Unavailable" : `${balance} XLM`}
                  </span>

                  <span className="font-mono text-[10px] text-slate-500">
                    Saldo
                  </span>
                </div>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                disabled={connecting}
                className="h-10 px-5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">
                  account_balance_wallet
                </span>
                <span>
                  {connecting ? "Conectando..." : "Conectar Freighter"}
                </span>
              </button>
            )}
          </div>
        </div>
      </header>

      <WalletModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}

