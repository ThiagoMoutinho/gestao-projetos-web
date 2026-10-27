import type { Metadata } from "next";

import { ApiError } from "@/lib/api/fetcher";
import { getServerSession } from "@/modules/auth/session";
import { loadProjectList } from "@/modules/projects/load-project-list";
import { ProjectList, ProjectListError } from "@/modules/projects/project-list";

export const metadata: Metadata = {
  title: "Projetos · Gestão de Projetos",
  description: "Projetos visíveis para o acesso atual",
};

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { aviso } = await searchParams;
  let projects: Awaited<ReturnType<typeof loadProjectList>> | null = null;
  let message: string | null = null;

  try {
    projects = await loadProjectList();
  } catch (error) {
    message = error instanceof ApiError ? error.message : "A consulta dos projetos falhou.";
  }

  if (!projects || message) {
    return <ProjectListError message={message ?? "A consulta dos projetos falhou."} />;
  }

  const session = await getServerSession();
  const role = session.data?.user?.role;

  return <ProjectList projects={projects} eapPrompt={aviso === "eap"} viewerRole={typeof role === "string" ? role : ""} />;
}
