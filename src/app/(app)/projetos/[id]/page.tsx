import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ApiError } from "@/lib/api/fetcher";
import { getServerSession } from "@/modules/auth/session";
import { loadProjectDetail } from "@/modules/projects/load-project-detail";
import {
  ProjectAccessDenied,
  ProjectDetail,
  ProjectDetailError,
} from "@/modules/projects/project-detail";

export const metadata: Metadata = {
  title: "Projeto · Gestão de Projetos",
  description: "Detalhes do projeto visível para o acesso atual",
};

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aba?: string }>;
}) {
  const { id } = await params;
  const { aba } = await searchParams;
  let project: Awaited<ReturnType<typeof loadProjectDetail>> | null = null;
  let message: string | null = null;
  let denied = false;

  try {
    project = await loadProjectDetail(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    denied = error instanceof ApiError && error.status === 403;
    message = error instanceof ApiError ? error.message : "A consulta do projeto falhou.";
  }

  if (denied) {
    return <ProjectAccessDenied message={message ?? "Você não tem permissão para consultar este projeto."} />;
  }

  if (!project || message) {
    return <ProjectDetailError message={message ?? "A consulta do projeto falhou."} />;
  }

  const session = await getServerSession();
  const user = session.data?.user;

  if (!user) {
    redirect("/login");
  }

  return (
    <ProjectDetail
      project={project}
      openEap={aba === "eap"}
      actor={{
        userId: user.id,
        globalRole: typeof user.role === "string" ? user.role : "",
      }}
    />
  );
}
