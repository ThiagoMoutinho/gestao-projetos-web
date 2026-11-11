import type { ListProjects200DataItemStatus } from "@/lib/api/generated/model/listProjects200DataItemStatus";

import type { EapStatusKind } from "./eap-status";

const STATUS_LABELS: Record<ListProjects200DataItemStatus, string> = {
  NAO_INICIADO: "Não iniciado",
  EM_EXECUCAO: "Em execução",
  EM_ATENCAO: "Em atenção",
  CRITICO: "Crítico",
  EM_VALIDACAO: "Em validação",
  CONCLUIDO: "Concluído",
  SUSPENSO: "Suspenso",
};

export function projectStatusLabel(status: ListProjects200DataItemStatus) {
  return STATUS_LABELS[status];
}

const STATUS_KINDS: Record<ListProjects200DataItemStatus, EapStatusKind> = {
  NAO_INICIADO: "not-started",
  EM_EXECUCAO: "in-progress",
  EM_ATENCAO: "attention",
  CRITICO: "rejected",
  EM_VALIDACAO: "delivered",
  CONCLUIDO: "done",
  SUSPENSO: "suspended",
};

/** Cor do selo da situação do projeto, na mesma paleta dos selos da EAP. */
export function projectStatusKind(status: ListProjects200DataItemStatus): EapStatusKind {
  return STATUS_KINDS[status];
}

export function projectStatusVariant(
  status: ListProjects200DataItemStatus,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "CRITICO" || status === "SUSPENSO") {
    return "destructive";
  }

  if (status === "CONCLUIDO") {
    return "secondary";
  }

  if (status === "NAO_INICIADO") {
    return "outline";
  }

  return "default";
}

/** Cor (token --status-*, igual em qualquer paleta) de cada situação calculada: ponto dos indicadores, borda lateral das linhas e segmentos do Início. */
export const PROJECT_STATUS_COLOR: Record<ListProjects200DataItemStatus, string> = {
  NAO_INICIADO: "var(--status-idle)",
  EM_EXECUCAO: "var(--status-running)",
  EM_ATENCAO: "var(--status-attention)",
  CRITICO: "var(--status-critical)",
  EM_VALIDACAO: "var(--status-validation)",
  CONCLUIDO: "var(--status-done)",
  SUSPENSO: "var(--status-idle)",
};
