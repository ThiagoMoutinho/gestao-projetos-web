import { ApiError } from "@/lib/api/fetcher";
import { getExecutiveSummary, getScheduleMonitoring } from "@/lib/api/generated/cronograma/cronograma";
import { listEapPhases } from "@/lib/api/generated/eap/eap";
import type { GetScheduleMonitoring200ItemsItem } from "@/lib/api/generated/model/getScheduleMonitoring200ItemsItem";
import type { ListProjects200DataItem } from "@/lib/api/generated/model/listProjects200DataItem";
import { listProjectMembers } from "@/lib/api/generated/participantes/participantes";
import { getProject, listProjects } from "@/lib/api/generated/projetos/projetos";
import { getProjectOverview } from "@/lib/api/generated/visão-institucional/visão-institucional";

import { civilDateInput } from "./eap-present";
import { consolidateSchedule } from "./planning-panel";
import {
  awaitingValidationFrom,
  nextDeliveryFrom,
  buildTeam,
  currentPlanDate,
  lastMovementFrom,
  resolveCompanies,
  type PortfolioMilestone,
  type ProjectListRow,
  type ProjectMonitoringSignals,
} from "./project-portfolio";

export type { ProjectListRow } from "./project-portfolio";

/** Linhas do portfólio e, por projeto, os sinais do monitoramento de prazos (null quando a consulta falhou). */
export type PortfolioSnapshot = {
  rows: ProjectListRow[];
  signals: Record<string, ProjectMonitoringSignals | null>;
};

/**
 * Projetos acessíveis ao usuário (a API já aplica as permissões) com os dados da listagem.
 * Cada dado complementar é consultado à parte: se uma consulta falhar, só aquele campo fica
 * indisponível, sem valores inventados.
 */
export async function loadProjectList(): Promise<ProjectListRow[]> {
  return (await loadPortfolioSnapshot()).rows;
}

/** Mesmas consultas da listagem, preservando também os sinais de monitoramento usados no Início. */
export async function loadPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const listed = await listProjects();

  if (listed.status !== 200) {
    throw new ApiError(listed.status, "HTTP_ERROR", "Não foi possível consultar os projetos.");
  }

  const loaded = await Promise.all(listed.data.data.map(loadProjectRow));
  const rows = loaded.map((item) => item.row).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  return { rows, signals: Object.fromEntries(loaded.map((item) => [item.row.id, item.signals])) };
}

async function loadProjectRow(
  project: ListProjects200DataItem,
): Promise<{ row: ProjectListRow; signals: ProjectMonitoringSignals | null }> {
  const [ownerName, people, progress, monitoring, companyProfile, movement] = await Promise.all([
    readOwnerName(project.id),
    readPeople(project.id),
    readProgress(project.id),
    readMonitoring(project.id),
    readResponsibleCompany(project.id),
    readLastMovement(project.id),
  ]);
  const company = resolveCompanies(companyProfile, people?.suppliers ?? null);

  const row: ProjectListRow = {
    id: project.id,
    name: project.name,
    description: project.description,
    glpiTicketId: project.glpiTicketId,
    status: monitoring?.situation.status ?? null,
    situation: monitoring?.situation ?? null,
    registeredStatus: project.status,
    // Prazo vigente como na Visão Geral: o consolidado da EAP e, sem datas nos itens, o gravado no projeto.
    plannedStartAt: currentPlanDate(monitoring?.schedule.start ?? null, project.plannedStartAt),
    plannedEndAt: currentPlanDate(monitoring?.schedule.end ?? null, project.plannedEndAt),
    updatedAt: project.updatedAt,
    lastMovementAt: movement?.at ?? null,
    movementAvailable: movement !== null,
    ownerId: project.ownerId,
    ownerName,
    managers: people?.managers ?? null,
    team: people?.team ?? null,
    suppliers: people?.suppliers ?? null,
    companies: company.companies,
    companySource: company.companySource,
    progressBasisPoints: progress?.basisPoints ?? null,
    progressAvailable: progress !== null,
    eapEmpty: progress?.phaseCount === 0,
    nextDelivery: monitoring?.nextDelivery ?? null,
    awaitingValidation: monitoring?.awaitingValidation ?? null,
    nextDeliveryAvailable: monitoring !== null,
    viewerIsOwner: project.isOwner,
    viewerRoles: [...project.roles],
  };

  return { row, signals: monitoring?.signals ?? null };
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

/**
 * "Empresa responsável" da ficha institucional (versão publicada; o rascunho ainda não validado não entra).
 * null = campo vazio; undefined = a ficha não pôde ser consultada.
 */
async function readResponsibleCompany(projectId: string): Promise<string | null | undefined> {
  try {
    const overview = await getProjectOverview(projectId);
    return overview.status === 200 ? (overview.data.profile.responsibleCompany.published?.value ?? null) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Última movimentação relevante do acompanhamento, das movimentações do resumo executivo (só alterações reais: situação,
 * conclusão, impedimentos, entregas, homologação, reprogramação e planejamento; acessos não contam). null = consulta indisponível.
 */
async function readLastMovement(projectId: string): Promise<{ at: string | null } | null> {
  try {
    const summary = await getExecutiveSummary(projectId);
    return summary.status === 200 ? { at: lastMovementFrom(summary.data.movements) } : null;
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

    return {
      managers: byRole("GESTOR"),
      suppliers: byRole("FORNECEDOR"),
      // A função do catálogo (ex.: Stakeholder) aparece no lugar do rótulo do acesso (Observador).
      team: buildTeam(members.data.data.map((member) => ({ userId: member.userId, role: member.function?.name ?? member.role, name: member.user.name }))),
    };
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
      schedule: consolidateSchedule(monitoring.data.items).current,
      nextDelivery: nextDeliveryFrom(monitoring.data.items),
      awaitingValidation: awaitingValidationFrom(monitoring.data.items),
      signals: {
        openMilestones: openMilestonesFrom(monitoring.data.items),
        overdueTasks: monitoring.data.overdue.tasks,
        overdueMilestones: monitoring.data.overdue.milestones,
        awaitingHomologation: monitoring.data.homologation.awaiting,
        inCorrections: monitoring.data.homologation.inCorrections,
      } satisfies ProjectMonitoringSignals,
    };
  } catch {
    return null;
  }
}

/** Marcos ainda a entregar (pendentes ou devolvidos) com data prevista, no mesmo critério da próxima entrega. */
function openMilestonesFrom(items: ReadonlyArray<GetScheduleMonitoring200ItemsItem>): PortfolioMilestone[] {
  return items.flatMap((item) => {
    const plannedOn = civilDateInput(item.plannedEndAt);
    if (item.entityType !== "MILESTONE" || !plannedOn || item.status === "APROVADO" || item.status === "ENTREGUE") {
      return [];
    }
    return [
      {
        id: item.entityId,
        title: item.title,
        status: item.status,
        plannedOn,
        overdue: item.overdue,
        responsibleName: item.responsibleName?.trim() || null,
      },
    ];
  });
}
