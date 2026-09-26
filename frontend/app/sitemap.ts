import type { MetadataRoute } from "next";
import { STATIC_ROUTES, absoluteUrl } from "@/lib/site";

export const dynamic = "force-static";

/**
 * Only the public, statically exported routes are listed. `/dashboard/`,
 * unknown project IDs such as `/project/999/`, and query strings are excluded.
 * No `lastModified` is emitted because a static export has no real content date
 * to report; inventing one would be a false freshness signal.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route),
    changeFrequency: "monthly" as const,
    priority: route === "/" ? 1 : route === "/proof/" ? 0.8 : 0.7,
  }));
}
