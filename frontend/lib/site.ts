/**
 * Static SEO constants for NIKO SUN.
 *
 * This module is intentionally pure: no fetch, no wallet context, no holder
 * indexer, no RPC. It is imported by build-time metadata (root layout, robots,
 * sitemap and the static export of `/project/[id]`), so anything that touches the
 * network here would break `next build` for the static export.
 *
 * Values here describe the *shape* of the public site only. Live minted, supply,
 * balance and price numbers stay on-chain and are never encoded as current state.
 */

const DEFAULT_SITE_URL = "https://niko-sun.netlify.app";

/** Strips trailing slashes so `absoluteUrl` never emits a double slash. */
function normalizeSiteUrl(value: string | undefined | null): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return DEFAULT_SITE_URL;
  return candidate.replace(/\/+$/, "");
}

/**
 * Absolute origin for canonical URLs, Open Graph and the sitemap.
 * Falls back to the production origin when `NEXT_PUBLIC_SITE_URL` is absent so a
 * missing env var can never break a deploy.
 */
export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const SITE_NAME = "NIKO SUN";

export const SITE_LOCALE = "es_ES";

/**
 * Truthful default description: testnet prototype, native XLM purchase, claim of
 * creator-deposited on-chain income, public verifiable evidence.
 * No APY, ratings, audited, or physical-generation claims.
 */
export const SITE_DESCRIPTION =
  "Prototipo Soroban en Stellar Testnet: compra tokens de proyectos solares con XLM nativo y reclama ingresos ya depositados por el creator. Evidencia pública verificable.";

/** Default document title for the root layout (child pages override it). */
export const SITE_TITLE =
  "NIKO SUN — Tokens de proyectos solares en Stellar Soroban (Testnet)";

/** Joins a site-relative path onto `SITE_URL` without duplicating slashes. */
export function absoluteUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${suffix}`;
}

/** 1200x630 Open Graph / Twitter card, served from the site origin. */
export const OG_IMAGE_PATH = "/og.jpg";

export const OG_IMAGE = {
  url: absoluteUrl(OG_IMAGE_PATH),
  width: 1200,
  height: 630,
  alt: "Logotipo de NIKO SUN sobre fondo blanco",
} as const;

/**
 * Deployed project IDs. `generateStaticParams` and the sitemap read from here so
 * there is a single source of truth for what exists on-chain.
 */
export const STATIC_PROJECT_IDS = ["1", "2", "3", "4"] as const;

/**
 * Public, indexable routes. `/dashboard/` is intentionally excluded: it is a
 * wallet-gated surface with `robots: noindex`, not an SEO landing page.
 */
export const STATIC_ROUTES = [
  "/",
  "/proof/",
  ...STATIC_PROJECT_IDS.map((id) => `/project/${id}/`),
] as const;

export type ProjectSeo = {
  /** Project name as registered in the Soroban contract. */
  name: string;
  /** SEO description; describes mechanism and evidence, never live amounts. */
  description: string;
};

const PROJECT_DESCRIPTION_SUFFIX =
  " (nombre registrado en el contrato Soroban de Stellar Testnet). Compra tokens con XLM nativo y reclama solo los ingresos que el creator haya depositado on-chain. Supply, precio y saldos se leen del contrato.";

/**
 * SEO copy for exactly the deployed projects. The names match the on-chain
 * project names; no location, capacity, generation, or return figure is asserted.
 */
export const PROJECT_SEO: Readonly<Record<string, ProjectSeo>> = {
  "1": {
    name: "Solar Lima Miraflores",
    description: `Proyecto «Solar Lima Miraflores»${PROJECT_DESCRIPTION_SUFFIX}`,
  },
  "2": {
    name: "Solar Lima Norte",
    description: `Proyecto «Solar Lima Norte»${PROJECT_DESCRIPTION_SUFFIX}`,
  },
  "3": {
    name: "Solar Arequipa",
    description: `Proyecto «Solar Arequipa»${PROJECT_DESCRIPTION_SUFFIX}`,
  },
  "4": {
    name: "Solar San Martín",
    description: `Proyecto «Solar San Martín»${PROJECT_DESCRIPTION_SUFFIX}`,
  },
};

/** Static name lookup used to render an SSR H1 before any RPC read resolves. */
export function projectSeoName(id: string | undefined | null): string | null {
  if (!id) return null;
  return PROJECT_SEO[id]?.name ?? null;
}
