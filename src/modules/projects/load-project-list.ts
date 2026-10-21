import { ApiError } from "@/lib/api/fetcher";
import { listProjectMembers } from "@/lib/api/generated/participantes/participantes";
import type { ListProjects200DataItem } from "@/lib/api/generated/model/listProjects200DataItem";
import { getProject, listProjects } from "@/lib/api/generated/projetos/projetos";
import type { ListProjects200DataItemStatus } from "@/lib/api/generated/model/listProjects200DataItemStatus";

export type ProjectListRow = {
  id: string;
  name: string;
  description: string | null;
  status: ListProjects200DataItemStatus;
  ownerName: string | null;
  managers: string[] | null;
};

export async function loadProjectList(): Promise<ProjectListRow[]> {
  const listed = await listProjects();

  if (listed.status !== 200) {
    throw new ApiError(listed.status, "HTTP_ERROR", "Não foi possível consultar os projetos.");
  }

  const rows = await Promise.all(listed.data.data.map(loadProjectRow));

  return rows.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

async function loadProjectRow(project: ListProjects200DataItem): Promise<ProjectListRow> {
  const [ownerName, managers] = await Promise.all([
    readOwnerName(project.id),
    readManagerNames(project.id),
  ]);

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    ownerName,
    managers,
  };
}

async function readOwnerName(projectId: string) {
  try {
    const detail = await getProject(projectId);

    if (detail.status !== 200) {
      return null;
    }

    const name = detail.data.owner.name.trim();

    return name || null;
  } catch {
    return null;
  }
}

async function readManagerNames(projectId: string) {
  try {
    const members = await listProjectMembers(projectId);

    if (members.status !== 200) {
      return null;
    }

    const names = new Map<string, string>();

    for (const member of members.data.data) {
      if (member.role !== "GESTOR") {
        continue;
      }

      const name = member.user.name.trim();

      if (name) {
        names.set(member.userId, name);
      }
    }

    return [...names.values()].sort((left, right) => left.localeCompare(right, "pt-BR"));
  } catch {
    return null;
  }
}
