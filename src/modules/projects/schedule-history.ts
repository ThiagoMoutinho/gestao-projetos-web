import type { ListScheduleHistory200 } from "@/lib/api/generated/model/listScheduleHistory200";
import type { ListScheduleHistory200DataItem } from "@/lib/api/generated/model/listScheduleHistory200DataItem";
import { civilDay } from "./eap-deadline.ts";
import { daysBetween } from "./planning-panel.ts";

export type HistoryItem = ListScheduleHistory200DataItem;
export type HistoryCounts = ListScheduleHistory200["counts"];
type Status = HistoryItem["status"];

export type HistoryTone = "neutral" | "success" | "warning" | "danger";

/** Situação de cada registro do histórico. O registro do modelo anterior nunca é chamado de "aprovado" nem de "solicitado". */
export const HISTORY_STATUS: Record<Status, { label: string; tone: HistoryTone; hint: string }> = {
  EFETIVADA_DIRETAMENTE: {
    label: "Efetivada diretamente (modelo anterior)",
    tone: "neutral",
    hint: "Reprogramação feita antes do fluxo de solicitação: não tem solicitante nem aprovador registrados.",
  },
  DEFINIDA: { label: "Definição inicial", tone: "neutral", hint: "Primeira definição de datas; não conta como reprogramação." },
  PENDENTE: { label: "Pendente de análise", tone: "warning", hint: "Não altera o prazo vigente até ser aprovada." },
  APROVADA: { label: "Aprovada", tone: "success", hint: "Aprovada: o prazo vigente foi atualizado." },
  REJEITADA: { label: "Rejeitada", tone: "danger", hint: "Rejeitada: o prazo vigente não foi alterado." },
  CANCELADA: { label: "Cancelada", tone: "neutral", hint: "Cancelada antes da análise: o prazo vigente não foi alterado." },
  CANCELADA_CONFLITO: {
    label: "Cancelada por conflito",
    tone: "neutral",
    hint: "O prazo vigente mudou depois do pedido; a solicitação ficou obsoleta.",
  },
};

export const HISTORY_ENTITY_LABEL: Record<string, string> = { PROJECT: "Projeto", PHASE: "Fase", TASK: "Tarefa", MILESTONE: "Marco" };

/** Só estas situações representam data efetivamente alterada no cronograma vigente. */
export function isEffective(item: Pick<HistoryItem, "status">) {
  return item.status === "EFETIVADA_DIRETAMENTE" || item.status === "APROVADA";
}

/** Itens do resumo: reprogramações efetivadas diretamente + solicitações de qualquer situação (sem definições iniciais). */
export function historyCount(counts: HistoryCounts) {
  const requests = counts.requests;
  return counts.legacyDirect + requests.pendente + requests.aprovada + requests.rejeitada + requests.cancelada + requests.canceladaConflito;
}

/** Término tem prioridade na manchete; marco usa só o término. Sem mudança classificada, devolve null. */
export function headlineChange(item: Pick<HistoryItem, "changes">) {
  const changes = item.changes;
  return changes.find((change) => change.field === "END" && change.kind === "RESCHEDULED") ?? changes.find((change) => change.kind === "RESCHEDULED") ?? changes[0] ?? null;
}

/**
 * Variação do término em dias corridos (positivo = prazo estendido), somente quando a data foi de fato alterada.
 * Proposta pendente, rejeitada ou cancelada não tem variação: não mudou nada.
 */
export function historyDelta(item: HistoryItem) {
  if (!isEffective(item)) return null;
  const end = item.changes.find((change) => change.field === "END" && change.kind === "RESCHEDULED");
  if (!end?.previous || !end.next) return null;
  const from = civilDay(end.previous);
  const to = civilDay(end.next);
  return from && to ? daysBetween(from, to) : null;
}

/** Nome da pessoa ou o motivo de não haver: nunca um nome inventado. */
export function personName(person: HistoryItem["requestedBy"], absent: string) {
  if (!person) return absent;
  return person.name?.trim() ? person.name : "Nome não disponível";
}

/** Quem analisou: depende da situação; legado e definição inicial não têm analista registrado. */
export function reviewerText(item: Pick<HistoryItem, "source" | "status" | "reviewedBy">) {
  if (item.source !== "REQUEST") return "Não registrado (modelo anterior)";
  if (item.reviewedBy) return personName(item.reviewedBy, "Não registrado");
  return item.status === "PENDENTE" ? "Aguardando análise" : "Sem análise registrada";
}
