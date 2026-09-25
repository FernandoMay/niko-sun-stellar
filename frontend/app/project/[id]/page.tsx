import ProjectDetailClient from "./client";

export const dynamicParams = false;

// Static export cannot discover chain state at build time; keep these IDs aligned with deployed projects.
const STATIC_PROJECT_IDS = ["1", "2", "3", "4"] as const;

export function generateStaticParams() {
  return STATIC_PROJECT_IDS.map((id) => ({ id }));
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetailClient id={id} />;
}
