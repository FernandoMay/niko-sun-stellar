import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

/**
 * `/proof/` stays crawlable on purpose: it is the public, verifiable evidence
 * record. Only the wallet-gated dashboard is disallowed, mirroring the
 * `noindex, nofollow` metadata exported by `app/dashboard/layout.tsx`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
