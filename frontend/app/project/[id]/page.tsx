import ProjectDetailClient from "./client";

export const dynamicParams = false;

export function generateStaticParams() {
  return [{ id: "1" }];
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProjectDetailClient id={id} />;
}
