import type { ListProjects200DataItemStatus } from "@/lib/api/generated/model/listProjects200DataItemStatus";

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
