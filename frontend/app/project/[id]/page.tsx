import type { Metadata } from "next";
import ProjectDetailClient from "./client";
import {
  OG_IMAGE,
  PROJECT_SEO,
  SITE_LOCALE,
  SITE_NAME,
  STATIC_PROJECT_IDS,
  absoluteUrl,
} from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return STATIC_PROJECT_IDS.map((id) => ({ id }));
}

type ProjectPageProps = { params: Promise<{ id: string }> };

/**
 * Metadata comes from the static `PROJECT_SEO` map only — no RPC, no fetch — so
 * the static export can build it for every deployed project.
 */
export async function generateMetadata({ params }: ProjectPageProps): Promise<Metadata> {
  const { id } = await params;
  const seo = PROJECT_SEO[id];

  if (!seo) {
    return {
      title: { absolute: `Proyecto no disponible · ${SITE_NAME}` },
      robots: { index: false, follow: false },
    };
  }

  const title = `${seo.name} — ${SITE_NAME} | Stellar Testnet`;
  const url = absoluteUrl(`/project/${id}/`);

  return {
    title: { absolute: title },
    description: seo.description,
    alternates: { canonical: `/project/${id}/` },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: SITE_LOCALE,
      siteName: SITE_NAME,
      url,
      title,
      description: seo.description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: seo.description,
      images: [OG_IMAGE.url],
    },
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { id } = await params;
  return <ProjectDetailClient id={id} staticName={PROJECT_SEO[id]?.name ?? null} />;
}
