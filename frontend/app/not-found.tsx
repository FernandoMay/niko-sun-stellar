import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `Página no encontrada · ${SITE_NAME}` },
  description:
    "La ruta solicitada no existe en NIKO SUN. Los proyectos y la evidencia pública están disponibles desde la página principal.",
  robots: { index: false, follow: false },
  alternates: { canonical: null },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-5 py-20">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-700">
          404 · Stellar Testnet
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold text-slate-900">
          Página no encontrada
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          La ruta solicitada no existe. Volvé al directorio para explorar los
          proyectos on-chain o abrí la evidencia pública.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="/"
            className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Volver al directorio
          </a>
          <a
            href="/proof/"
            className="rounded-lg border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Ver evidencia pública
          </a>
        </div>
      </div>
    </main>
  );
}
