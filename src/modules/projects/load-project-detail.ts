import { ApiError } from "@/lib/api/fetcher";
import { listEapMilestones, listEapPhases, listEapTasks } from "@/lib/api/generated/eap/eap";
import type { ListEapPhases200DataItem } from "@/lib/api/generated/model/listEapPhases200DataItem";
import type { ListProjectMembers200DataItemRole } from "@/lib/api/generated/model/listProjectMembers200DataItemRole";
import { listProjectMembers } from "@/lib/api/generated/participantes/participantes";
import { getProject } from "@/lib/api/generated/projetos/projetos";

import { presentMilestone, presentPhase, presentTask } from "./eap-present";
import { projectRoleLabel, recordedDate } from "./project-records";

export type {
  ProjectDateField,
  ProjectDetail,
  ProjectMemberView,
  ProjectMilestoneView,
  ProjectPhaseView,
  ProjectTaskView,
} from "./eap-present";

import type {
  ProjectDetail,
  ProjectMilestoneView,
  ProjectPhaseView,
  ProjectTaskView,
} from "./eap-present";

export async function loadProjectDetail(id: string): Promise<ProjectDetail> {
  const projectResponse = await getProject(id);

  if (projectResponse.status !== 200) {
    throw new ApiError(projectResponse.status, "HTTP_ERROR", "Não foi possível consultar o projeto.");
  }

  const project = projectResponse.data;
  const members = await readMembers(id);
  const names = members
    ? new Map(members.map((member) => [member.userId, member.name]))
    : null;
  const phases = await readPhases(id, names);
  const managers = members
    ? uniqueNames(
        members.filter((member) => member.role === "GESTOR").map((member) => member.name),
      )
    : null;

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    ownerId: project.ownerId,
    ownerName: project.owner.name.trim() || "Não informado",
    managers,
    glpiTicketId: project.glpiTicketId,
    createdAt: recordedDate(project.createdAt),
    updatedAt: recordedDate(project.updatedAt),
    viewerRoles: project.roles.map((role) => projectRoleLabel(role)),
    memberRoles: project.roles,
    members: members
      ? members.map((member) => ({
          id: member.id,
          userId: member.userId,
          name: member.name,
          email: member.email,
          role: member.role,
          roleLabel: projectRoleLabel(member.role),
        }))
      : null,
    phases,
    schedule: {
      single: false,
      plannedStartAt: project.plannedStartAt,
      plannedEndAt: project.plannedEndAt,
      baselineStartAt: project.baselineStartAt,
      baselineEndAt: project.baselineEndAt,
      actualStartAt: null,
      actualEndAt: null,
    },
  };
}

async function readMembers(projectId: string) {
  try {
    const response = await listProjectMembers(projectId);

    if (response.status !== 200) {
      return null;
    }

    return response.data.data
      .map((member) => ({
        id: member.id,
        userId: member.userId,
        name: member.user.name.trim() || "Não informado",
        email: member.user.email,
        role: member.role,
      }))
      .sort((left, right) => {
        const byRole = roleOrder(left.role) - roleOrder(right.role);
        return byRole || left.name.localeCompare(right.name, "pt-BR");
      });
  } catch {
    return null;
  }
}

async function readPhases(projectId: string, names: Map<string, string> | null) {
  try {
    const response = await listEapPhases(projectId);

    if (response.status !== 200) {
      return null;
    }

    const phases = [...response.data.data].sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "pt-BR"),
    );

    return Promise.all(phases.map((phase) => readPhase(projectId, phase, names)));
  } catch {
    return null;
  }
}

async function readPhase(
  projectId: string,
  phase: ListEapPhases200DataItem,
  names: Map<string, string> | null,
): Promise<ProjectPhaseView> {
  const [tasks, milestones] = await Promise.all([
    readTasks(projectId, phase.id, names),
    readMilestones(projectId, phase.id, names),
  ]);

  return presentPhase(phase, { tasks, milestones }, names);
}

async function readTasks(
  projectId: string,
  phaseId: string,
  names: Map<string, string> | null,
): Promise<ProjectTaskView[] | null> {
  try {
    const response = await listEapTasks(projectId, phaseId);

    if (response.status !== 200) {
      return null;
    }

    return response.data.data.map((task) => ({ ...presentTask(task, names), sortOrder: readSortOrder(task) }));
  } catch {
    return null;
  }
}

async function readMilestones(
  projectId: string,
  phaseId: string,
  names: Map<string, string> | null,
): Promise<ProjectMilestoneView[] | null> {
  try {
    const response = await listEapMilestones(projectId, phaseId);

    if (response.status !== 200) {
      return null;
    }

    return response.data.data.map((milestone) => ({
      ...presentMilestone(milestone, names),
      sortOrder: readSortOrder(milestone),
    }));
  } catch {
    return null;
  }
}

function readSortOrder(record: object) {
  const value = "sortOrder" in record ? record.sortOrder : undefined;
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

function uniqueNames(names: string[]) {
  return [...new Set(names.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "pt-BR"),
  );
}

function roleOrder(role: ListProjectMembers200DataItemRole) {
  const order: ListProjectMembers200DataItemRole[] = [
    "DONO_PROJETO",
    "GESTOR",
    "PO",
    "RESPONSAVEL_TECNICO",
    "DESENVOLVEDOR",
    "FORNECEDOR",
    "OBSERVADOR",
  ];

  return order.indexOf(role);
}
