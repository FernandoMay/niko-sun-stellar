import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {
  PROJECT_SEO,
  SITE_DESCRIPTION,
  SITE_URL,
  STATIC_PROJECT_IDS,
  STATIC_ROUTES,
  absoluteUrl,
} from "@/lib/site";

const frontendRoot = process.cwd();

function readFrontendFile(relativePath: string): string {
  return readFileSync(path.join(frontendRoot, relativePath), "utf8");
}

function readJpegSize(buffer: Buffer): { width: number; height: number } {
  let offset = 2; // skip SOI
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  throw new Error("No JPEG SOF marker found.");
}

/** Claims the SEO layer must never make, regardless of the page. */
const FORBIDDEN_SEO_CLAIMS = [
  /APY/i,
  /USDC/,
  /auditado/i,
  /\brating\b/i,
  /aggregateRating/i,
  /ratingValue/i,
  /\b847\b/,
  /\$2\.4M/,
  /12\.5%/,
  /1,420\.50/,
  /dividend/i,
];

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  vi.resetModules();
});

describe("static site module", () => {
  it("stays pure: no network, wallet, indexer, or RPC imports", () => {
    const source = readFrontendFile("lib/site.ts");
    for (const forbidden of [
      "fetch(",
      "useWallet",
      "WalletContext",
      "holderIndexer",
      "useHolderMetrics",
      "EXPLORER_URL",
      "readContract",
      "PUBLIC_EVIDENCE",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("defaults to the production origin and normalizes a trailing slash", async () => {
    expect(SITE_URL).toBe("https://niko-sun.netlify.app");
    expect(SITE_URL.endsWith("/")).toBe(false);

    process.env.NEXT_PUBLIC_SITE_URL = "https://preview.example.com///";
    vi.resetModules();
    const preview = await import("@/lib/site");
    expect(preview.SITE_URL).toBe("https://preview.example.com");
    expect(preview.absoluteUrl("/sitemap.xml")).toBe(
      "https://preview.example.com/sitemap.xml"
    );
  });

  it("builds absolute URLs without duplicating slashes", () => {
    expect(absoluteUrl("/og.jpg")).toBe("https://niko-sun.netlify.app/og.jpg");
    expect(absoluteUrl("og.jpg")).toBe("https://niko-sun.netlify.app/og.jpg");
  });

  it("lists exactly the deployed project IDs", () => {
    expect([...STATIC_PROJECT_IDS]).toEqual(["1", "2", "3", "4"]);
    expect(Object.keys(PROJECT_SEO).sort()).toEqual(["1", "2", "3", "4"]);
  });

  it("excludes the wallet-gated dashboard from the public routes", () => {
    expect([...STATIC_ROUTES]).toEqual([
      "/",
      "/proof/",
      "/project/1/",
      "/project/2/",
      "/project/3/",
      "/project/4/",
    ]);
    expect(STATIC_ROUTES.some((route) => route.startsWith("/dashboard"))).toBe(false);
  });

  it("keeps project SEO copy free of live amounts and unsupported claims", () => {
    for (const [id, seo] of Object.entries(PROJECT_SEO)) {
      expect(seo.name.length).toBeGreaterThan(0);
      expect(seo.description).toContain(seo.name);
      expect(seo.description).toContain("Testnet");
      for (const pattern of FORBIDDEN_SEO_CLAIMS) {
        expect(seo.description, `project ${id}`).not.toMatch(pattern);
      }
      // No minted/supply/price figure is ever encoded as current state.
      expect(seo.description).not.toMatch(/\d{2,}/);
    }
  });
});

describe("root layout metadata", () => {
  const layout = readFrontendFile("app/layout.tsx");

  it("declares metadataBase, canonical, robots, Open Graph, and Twitter", () => {
    expect(layout).toContain("metadataBase: new URL(SITE_URL)");
    expect(layout).toContain('alternates: { canonical: "/" }');
    expect(layout).toContain("robots: { index: true, follow: true }");
    expect(layout).toContain("openGraph: {");
    expect(layout).toContain("twitter: {");
    expect(layout).toContain('card: "summary_large_image"');
    expect(layout).toContain("template: `%s · ${SITE_NAME}`");
  });

  it("publishes the truthful default title and description", () => {
    const site = readFrontendFile("lib/site.ts");
    expect(site).toContain("NIKO SUN — Tokens de proyectos solares en Stellar Soroban (Testnet)");
    expect(site).toContain("Prototipo Soroban en Stellar Testnet");
    expect(site).toContain("Evidencia pública verificable");
    expect(layout).toContain("description: SITE_DESCRIPTION");
    expect(SITE_DESCRIPTION).toContain("XLM nativo");
    for (const pattern of FORBIDDEN_SEO_CLAIMS) {
      expect(SITE_DESCRIPTION).not.toMatch(pattern);
    }
  });

  it("points Open Graph and Twitter at the absolute 1200x630 image", () => {
    expect(layout).toContain("images: [OG_IMAGE]");
    expect(layout).toContain("images: [OG_IMAGE.url]");
    const site = readFrontendFile("lib/site.ts");
    expect(site).toContain('absoluteUrl(OG_IMAGE_PATH)');
    expect(site).toContain("width: 1200");
    expect(site).toContain("height: 630");
  });

  it("emits a single WebSite + SoftwareApplication JSON-LD block with no review claims", () => {
    expect(layout.match(/type="application\/ld\+json"/g) ?? []).toHaveLength(1);
    expect(layout).toContain('"@type": "WebSite"');
    expect(layout).toContain('"@type": "SoftwareApplication"');
    expect(layout).not.toMatch(/aggregateRating|ratingValue|reviewCount|"@type": "Offer"/);
  });

  it("preserves the existing font head links", () => {
    expect(layout).toContain("fonts.googleapis.com/css2?family=Space+Grotesk");
    expect(layout).toContain("family=Material+Symbols+Outlined");
  });
});

describe("robots metadata route", () => {
  it("allows the site, keeps the proof page crawlable, and blocks the dashboard", () => {
    const result = robots();
    expect(result.rules).toHaveLength(1);
    const [rule] = result.rules;
    expect(rule.userAgent).toBe("*");
    expect(rule.allow).toBe("/");
    expect(rule.disallow).toEqual(["/dashboard/"]);
    expect(JSON.stringify(rule)).not.toContain("/proof/");
  });

  it("points at the absolute sitemap URL", () => {
    expect(robots().sitemap).toBe("https://niko-sun.netlify.app/sitemap.xml");
  });
});

describe("sitemap metadata route", () => {
  it("emits the six public routes with trailing slashes", () => {
    expect(sitemap().map((entry) => entry.url)).toEqual([
      "https://niko-sun.netlify.app/",
      "https://niko-sun.netlify.app/proof/",
      "https://niko-sun.netlify.app/project/1/",
      "https://niko-sun.netlify.app/project/2/",
      "https://niko-sun.netlify.app/project/3/",
      "https://niko-sun.netlify.app/project/4/",
    ]);
  });

  it("omits the dashboard, unknown project IDs, and query strings", () => {
    const serialized = JSON.stringify(sitemap());
    expect(serialized).not.toContain("dashboard");
    expect(serialized).not.toContain("/project/999/");
    expect(serialized).not.toContain("?");
  });

  it("does not invent a lastModified date for static content", () => {
    for (const entry of sitemap()) {
      expect(entry).not.toHaveProperty("lastModified");
    }
  });
});

describe("per-page metadata", () => {
  it("gives the proof page an absolute Spanish title, canonical, and OG values", () => {
    const proof = readFrontendFile("app/proof/page.tsx");
    expect(proof).toContain("export const metadata: Metadata");
    expect(proof).toContain("Evidencia pública on-chain");
    expect(proof).toContain("Stellar Testnet");
    expect(proof).toContain('canonical: "/proof/"');
    expect(proof).toContain("openGraph: {");
    expect(proof).toContain("twitter: {");
    expect(proof).toContain("Snapshot histórico");
    for (const pattern of FORBIDDEN_SEO_CLAIMS) {
      expect(proof).not.toMatch(pattern);
    }
  });

  it("keeps the evidence snapshot values untouched", () => {
    const proof = readFrontendFile("app/proof/page.tsx");
    expect(proof).toContain("Network: Stellar Testnet");
    expect(proof).toContain("Reconciled");
    expect(proof).toContain("Total contract inflows (sales + deposits)");
    expect(proof).not.toContain("Total revenue");
  });

  it("generates project metadata from the static SEO map without network calls", () => {
    const projectPage = readFrontendFile("app/project/[id]/page.tsx");
    expect(projectPage).toContain("export const dynamicParams = false");
    expect(projectPage).toContain("export async function generateMetadata");
    expect(projectPage).toContain("await params");
    expect(projectPage).toContain("PROJECT_SEO");
    expect(projectPage).toContain("canonical: `/project/${id}/`");
    expect(projectPage).toContain("robots: { index: true, follow: true }");
    expect(projectPage).toContain("openGraph: {");
    expect(projectPage).toContain("twitter: {");
    for (const forbidden of ["fetch(", "useWallet", "readContract", "useHolderMetrics"]) {
      expect(projectPage).not.toContain(forbidden);
    }
  });

  it("keeps the project H1 in static HTML and avoids a second H1", () => {
    const client = readFrontendFile("app/project/[id]/client.tsx");
    expect(client).toContain("staticName");
    expect(client).toContain("staticProjectName");
    expect(client).not.toContain("Loading project…");
    expect(client.match(/<h1/g) ?? []).toHaveLength(1);
    expect(client).toContain("<h2");
  });

  it("marks the wallet-gated dashboard as noindex, nofollow", () => {
    const dashboard = readFrontendFile("app/dashboard/layout.tsx");
    expect(dashboard).toContain('const DASHBOARD_TITLE = "Dashboard Testnet · NIKO SUN"');
    expect(dashboard).toContain("title: { absolute: DASHBOARD_TITLE }");
    expect(dashboard).toContain("robots: { index: false, follow: false }");
    // The dashboard must not advertise the homepage URL as its own canonical.
    expect(dashboard).toContain('canonical: "/dashboard/"');
    expect(dashboard).toContain('absoluteUrl("/dashboard/")');
    expect(dashboard).toContain("Freighter");
  });

  it("keeps the 404 page noindex and without a canonical URL", () => {
    const notFound = readFrontendFile("app/not-found.tsx");
    expect(notFound).toContain("robots: { index: false, follow: false }");
    expect(notFound).toContain("alternates: { canonical: null }");
    expect(notFound).toContain("Página no encontrada");
  });
});

describe("home hero copy", () => {
  it("drops the investment-promise framing and states the mechanism", () => {
    const hero = readFrontendFile("components/Hero.tsx");
    expect(hero).not.toContain("Invierte en");
    expect(hero).toContain("Compra tokens de");
    expect(hero).toContain("Proyectos Solares");
    expect(hero).toContain("con XLM. Reclama");
    expect(hero).toContain("Ingresos Depositados");
    expect(hero).toContain("on-chain.");
  });

  it("keeps the existing gradient treatment", () => {
    const hero = readFrontendFile("components/Hero.tsx");
    expect(hero).toContain("bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600");
    expect(hero).toContain(
      "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700"
    );
  });
});

describe("open graph image", () => {
  it("ships /public/og.jpg at exactly 1200x630", () => {
    const buffer = readFileSync(path.join(frontendRoot, "public", "og.jpg"));
    expect(buffer.subarray(0, 2).toString("hex")).toBe("ffd8"); // JPEG SOI
    expect(readJpegSize(buffer)).toEqual({ width: 1200, height: 630 });
  });

  it("leaves favicon.png and the original assets untouched", () => {
    expect(existsSync(path.join(frontendRoot, "public", "favicon.png"))).toBe(true);
    expect(readFrontendFile("public/favicon.svg")).toContain("<svg");
    const assets = readFileSync(
      path.join(frontendRoot, "..", "assets", "Gemini_Generated_Image_vw66q7vw66q7vw66.jpg")
    );
    expect(readJpegSize(assets)).toEqual({ width: 1408, height: 768 });
  });
});
