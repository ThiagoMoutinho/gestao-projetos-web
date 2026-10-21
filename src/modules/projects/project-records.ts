import type { ListEapMilestones200DataItemStatus } from "@/lib/api/generated/model/listEapMilestones200DataItemStatus";
import type { ListEapMilestones200DataItemType } from "@/lib/api/generated/model/listEapMilestones200DataItemType";
import type { ListEapPhases200DataItemStatus } from "@/lib/api/generated/model/listEapPhases200DataItemStatus";
import type { ListEapTasks200DataItemStatus } from "@/lib/api/generated/model/listEapTasks200DataItemStatus";
import type { ListProjectMembers200DataItemRole } from "@/lib/api/generated/model/listProjectMembers200DataItemRole";

const PHASE_LABELS: Record<ListEapPhases200DataItemStatus, string> = {
  NAO_INICIADA: "Não iniciada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  SUSPENSA: "Suspensa",
};

const TASK_LABELS: Record<ListEapTasks200DataItemStatus, string> = {
  NAO_INICIADA: "Não iniciada",
  EM_ANDAMENTO: "Em andamento",
  IMPEDIDA: "Impedida",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const MILESTONE_LABELS: Record<ListEapMilestones200DataItemStatus, string> = {
  PENDENTE: "Pendente",
  ENTREGUE: "Entregue",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
};

const MILESTONE_TYPES: Record<ListEapMilestones200DataItemType, string> = {
  ENTREGA: "Entrega",
  APROVACAO: "Aprovação",
};

const ROLE_LABELS: Record<ListProjectMembers200DataItemRole, string> = {
  DONO_PROJETO: "Dono do projeto",
  GESTOR: "Gestor",
  PO: "PO",
  DESENVOLVEDOR: "Desenvolvedor",
  RESPONSAVEL_TECNICO: "Responsável técnico",
  FORNECEDOR: "Fornecedor",
  OBSERVADOR: "Observador",
};

export type RecordTone = "default" | "secondary" | "destructive" | "outline";

export const PHASE_STATUSES = Object.keys(PHASE_LABELS) as ListEapPhases200DataItemStatus[];
export const TASK_STATUSES = Object.keys(TASK_LABELS) as ListEapTasks200DataItemStatus[];

export function phaseStatusLabel(status: ListEapPhases200DataItemStatus) {
  return PHASE_LABELS[status];
}

export function taskStatusLabel(status: ListEapTasks200DataItemStatus) {
  return TASK_LABELS[status];
}

export function milestoneStatusLabel(status: ListEapMilestones200DataItemStatus) {
  return MILESTONE_LABELS[status];
}

export function milestoneTypeLabel(type: ListEapMilestones200DataItemType) {
  return MILESTONE_TYPES[type];
}

export function projectRoleLabel(role: ListProjectMembers200DataItemRole) {
  return ROLE_LABELS[role];
}

export function phaseStatusTone(status: ListEapPhases200DataItemStatus): RecordTone {
  if (status === "SUSPENSA") {
    return "destructive";
  }

  if (status === "CONCLUIDA") {
    return "secondary";
  }

  if (status === "NAO_INICIADA") {
    return "outline";
  }

  return "default";
}

export function taskStatusTone(status: ListEapTasks200DataItemStatus): RecordTone {
  if (status === "IMPEDIDA" || status === "CANCELADA") {
    return "destructive";
  }

  if (status === "CONCLUIDA") {
    return "secondary";
  }

  if (status === "NAO_INICIADA") {
    return "outline";
  }

  return "default";
}

export function milestoneStatusTone(status: ListEapMilestones200DataItemStatus): RecordTone {
  if (status === "REJEITADO") {
    return "destructive";
  }

  if (status === "APROVADO") {
    return "secondary";
  }

  if (status === "PENDENTE") {
    return "outline";
  }

  return "default";
}

export function recordedDate(value: string | null) {
  if (!value) {
    return "Não informada";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Não informada";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function personName(userId: string | null, names: Map<string, string> | null) {
  if (!userId) {
    return "Não informado";
  }

  if (!names) {
    return "Não foi possível consultar";
  }

  return names.get(userId) ?? "Não identificado";
}
