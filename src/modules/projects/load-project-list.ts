import { ApiError } from "@/lib/api/fetcher";
import { getScheduleMonitoring } from "@/lib/api/generated/cronograma/cronograma";
import { listEapPhases } from "@/lib/api/generated/eap/eap";
import type { ListProjects200DataItem } from "@/lib/api/generated/model/listProjects200DataItem";
import { listProjectMembers } from "@/lib/api/generated/participantes/participantes";
import { getProject, listProjects } from "@/lib/api/generated/projetos/projetos";

import { awaitingValidationFrom, nextDeliveryFrom, type ProjectListRow } from "./project-portfolio";

export type { ProjectListRow } from "./project-portfolio";

/**
 * Projetos acessíveis ao usuário (a API já aplica as permissões) com os dados da listagem.
 * Cada dado complementar é consultado à parte: se uma consulta falhar, só aquele campo fica
 * indisponível, sem valores inventados.
 */
export async function loadProjectList(): Promise<ProjectListRow[]> {
  const listed = await listProjects();

  if (listed.status !== 200) {
    throw new ApiError(listed.status, "HTTP_ERROR", "Não foi possível consultar os projetos.");
  }

  const rows = await Promise.all(listed.data.data.map(loadProjectRow));

  return rows.sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

async function loadProjectRow(project: ListProjects200DataItem): Promise<ProjectListRow> {
  const [ownerName, people, progress, monitoring] = await Promise.all([
    readOwnerName(project.id),
    readPeople(project.id),
    readProgress(project.id),
    readMonitoring(project.id),
  ]);

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    glpiTicketId: project.glpiTicketId,
    status: monitoring?.situation.status ?? null,
    situation: monitoring?.situation ?? null,
    registeredStatus: project.status,
    plannedStartAt: project.plannedStartAt,
    plannedEndAt: project.plannedEndAt,
    updatedAt: project.updatedAt,
    ownerId: project.ownerId,
    ownerName,
    managers: people?.managers ?? null,
    suppliers: people?.suppliers ?? null,
    progressBasisPoints: progress?.basisPoints ?? null,
    progressAvailable: progress !== null,
    eapEmpty: progress?.phaseCount === 0,
    nextDelivery: monitoring?.nextDelivery ?? null,
    awaitingValidation: monitoring?.awaitingValidation ?? null,
    nextDeliveryAvailable: monitoring !== null,
    viewerIsOwner: project.isOwner,
    viewerRoles: [...project.roles],
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

/** Gestores e fornecedores vêm dos participantes do projeto (papéis GESTOR e FORNECEDOR). */
async function readPeople(projectId: string) {
  try {
    const members = await listProjectMembers(projectId);

    if (members.status !== 200) {
      return null;
    }

    const byRole = (role: "GESTOR" | "FORNECEDOR") => {
      const names = new Map<string, string>();
      for (const member of members.data.data) {
        const name = member.user.name.trim();
        if (member.role === role && name) {
          names.set(member.userId, name);
        }
      }
      return [...names.values()].sort((left, right) => left.localeCompare(right, "pt-BR"));
    };

    return { managers: byRole("GESTOR"), suppliers: byRole("FORNECEDOR") };
  } catch {
    return null;
  }
}

/** Andamento consolidado calculado pela API (mesma regra da EAP); null quando a consulta falha. */
async function readProgress(projectId: string) {
  try {
    const phases = await listEapPhases(projectId);
    return phases.status === 200
      ? { basisPoints: phases.data.summary.progressBasisPoints, phaseCount: phases.data.data.length }
      : null;
  } catch {
    return null;
  }
}

/** Monitoramento de prazos: situação calculada do projeto (regras da API) e próxima entrega. */
async function readMonitoring(projectId: string) {
  try {
    const monitoring = await getScheduleMonitoring(projectId);
    if (monitoring.status !== 200) {
      return null;
    }
    const { status, delayDays, pendingValidation, closureRequirementsMissing, readyForClosure } = monitoring.data.situation;
    return {
      situation: { status, delayDays, pendingValidation, closureRequirementsMissing, readyForClosure },
      nextDelivery: nextDeliveryFrom(monitoring.data.items),
      awaitingValidation: awaitingValidationFrom(monitoring.data.items),
    };
  } catch {
    return null;
  }
}
