import type { ListEapMilestones200DataItemStatus } from "@/lib/api/generated/model/listEapMilestones200DataItemStatus";
import type { ListEapPhases200DataItemStatus } from "@/lib/api/generated/model/listEapPhases200DataItemStatus";
import type { ListEapTasks200DataItemStatus } from "@/lib/api/generated/model/listEapTasks200DataItemStatus";

/** Prévia da regra da API para o formulário; a situação gravada é sempre calculada no servidor. */
export function deriveTaskStatus(progressPercent: number): ListEapTasks200DataItemStatus {
  if (progressPercent >= 100) {
    return "CONCLUIDA";
  }
  return progressPercent > 0 ? "EM_ANDAMENTO" : "NAO_INICIADA";
}

/** Família visual da situação: cinza, azul, verde, roxo (aguardando aceite), laranja (ajustes), vermelho (rejeitado), âmbar e cancelada. */
export type EapStatusKind =
  | "not-started"
  | "in-progress"
  | "done"
  | "delivered"
  | "adjustments"
  | "rejected"
  | "suspended"
  | "cancelled"
  | "attention";

export function phaseStatusKind(status: ListEapPhases200DataItemStatus): EapStatusKind {
  if (status === "CONCLUIDA") return "done";
  if (status === "SUSPENSA") return "suspended";
  if (status === "EM_ANDAMENTO") return "in-progress";
  return "not-started";
}

export function taskStatusKind(status: ListEapTasks200DataItemStatus): EapStatusKind {
  if (status === "CONCLUIDA") return "done";
  if (status === "CANCELADA") return "cancelled";
  if (status === "IMPEDIDA") return "attention";
  if (status === "EM_ANDAMENTO") return "in-progress";
  return "not-started";
}

export function milestoneStatusKind(status: ListEapMilestones200DataItemStatus): EapStatusKind {
  if (status === "APROVADO") return "done";
  if (status === "ENTREGUE") return "delivered";
  if (status === "AJUSTES_SOLICITADOS") return "adjustments";
  if (status === "REJEITADO") return "rejected";
  return "not-started";
}
