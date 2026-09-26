import type { Metadata } from "next";
import { OG_IMAGE, SITE_LOCALE, SITE_NAME, absoluteUrl } from "@/lib/site";

/**
 * The dashboard is a wallet-gated application surface, not an SEO landing page.
 * `noindex, nofollow` keeps it out of the index and mirrors the `/dashboard/`
 * disallow rule exported by `app/robots.ts`.
 */
const DASHBOARD_TITLE = "Dashboard Testnet · NIKO SUN";

const DASHBOARD_DESCRIPTION =
  "Dashboard de NIKO SUN en Stellar Testnet. Requiere conectar una wallet Freighter para consultar posiciones, saldos y reclamos on-chain. Superficie privada, no indexada.";

export const metadata: Metadata = {
  title: { absolute: DASHBOARD_TITLE },
  description: DASHBOARD_DESCRIPTION,
  // Overrides the root layout so this page never advertises the homepage URL
  // or the homepage description as its own.
  alternates: { canonical: "/dashboard/" },
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: SITE_LOCALE,
    siteName: SITE_NAME,
    url: absoluteUrl("/dashboard/"),
    title: DASHBOARD_TITLE,
    description: DASHBOARD_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DASHBOARD_TITLE,
    description: DASHBOARD_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
