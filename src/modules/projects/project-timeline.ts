/**
 * Linha do tempo consolidada do projeto (sem React): junta fontes que a API já expõe, sem inventar eventos.
 *  - histórico unificado de reprogramações (efetivadas, solicitações; a definição inicial não é evento);
 *  - rodadas de entrega dos marcos (envio e decisão);
 *  - impedimentos das tarefas (registro e resolução);
 *  - auditoria do próprio projeto, exceto reprogramação e planejamento (já cobertos pelo histórico de reprogramações).
 * Cada evento tem id próprio por origem, então a mesma ocorrência nunca aparece duas vezes.
 */

import { civilDay } from "./eap-deadline.ts";
import { daysBetween } from "./planning-panel.ts";
import { HISTORY_ENTITY_LABEL, isEffective, headlineChange, type HistoryItem } from "./schedule-history.ts";

export type TimelineTone = "danger" | "success" | "warning" | "info" | "neutral";

export type TimelineEvent = {
  id: string;
  /** Instante do evento (ISO), usado só para ordenar. */
  at: string;
  title: string;
  detail: string;
  tone: TimelineTone;
  badge: { label: string; tone: TimelineTone } | null;
};

const dayMonth = (instant: string) => {
  const day = civilDay(instant);
  return day ? `${day.slice(8, 10)}/${day.slice(5, 7)}` : "";
};
const fullDate = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`;
const joinDetail = (parts: Array<string | null | undefined>) => parts.filter((part): part is string => Boolean(part && part.trim())).join(" · ");
const nameOf = (person: { name: string | null } | null | undefined) => (person?.name?.trim() ? person.name : null);

/** Reprogramações e solicitações. Definição inicial das datas não é reprogramação nem evento da linha do tempo. */
export function scheduleEvents(items: ReadonlyArray<HistoryItem>): TimelineEvent[] {
  return items
    .filter((item) => item.source !== "INITIAL_DEFINITION")
    .map((item): TimelineEvent => {
      const lead = headlineChange(item);
      const what = `${HISTORY_ENTITY_LABEL[item.entityType] ?? item.entityType}${item.entityTitle ? ` ${item.entityTitle}` : ""}`;
      const proposed = item.source === "REQUEST" && !isEffective(item);
      const from = lead?.previous ? civilDay(lead.previous) : null;
      const to = lead?.next ? civilDay(lead.next) : null;
      const label = lead?.field === "START" ? "Início" : "Término";
      const change = to ? `${label} ${from ? `${from.slice(8, 10)}/${from.slice(5, 7)} → ` : ""}${fullDate(to)}` : null;
      const actor = item.source === "REQUEST" ? nameOf(item.requestedBy) : nameOf(item.registeredBy);
      const delta = isEffective(item) && from && to ? daysBetween(from, to) : null;
      const badge: TimelineEvent["badge"] =
        item.status === "PENDENTE"
          ? { label: "Pendente", tone: "warning" }
          : item.status === "REJEITADA"
            ? { label: "Rejeitada", tone: "danger" }
            : item.status === "CANCELADA" || item.status === "CANCELADA_CONFLITO"
              ? { label: "Cancelada", tone: "neutral" }
              : delta
                ? { label: `${delta > 0 ? "+" : "−"}${Math.abs(delta)} d`, tone: delta > 0 ? "danger" : "success" }
                : null;
      return {
        id: `schedule:${item.id}`,
        at: item.occurredAt,
        title: `${proposed ? "Solicitação de reprogramação" : "Reprogramação"} · ${what}`,
        detail: joinDetail([change, actor, dayMonth(item.occurredAt)]),
        tone: delta !== null && delta > 0 ? "danger" : item.status === "PENDENTE" ? "warning" : "info",
        badge,
      };
    });
}

export type DeliveryRoundInput = {
  id: string;
  status: "EM_ANALISE" | "ACEITA" | "AJUSTES_SOLICITADOS" | "REJEITADA";
  submittedByName: string | null;
  submittedAt: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
};

/** Envio de cada rodada e, quando houver, a decisão sobre ela. Rodada antiga sem data de envio não gera evento de envio. */
export function deliveryEvents(milestoneTitle: string, rounds: ReadonlyArray<DeliveryRoundInput>): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const round of rounds) {
    if (round.submittedAt) {
      events.push({
        id: `delivery:${round.id}:sent`,
        at: round.submittedAt,
        title: `Entrega enviada · ${milestoneTitle}`,
        detail: joinDetail([round.submittedByName ? `Entregue por ${round.submittedByName}` : null, dayMonth(round.submittedAt)]),
        tone: "warning",
        badge: round.status === "EM_ANALISE" ? { label: "Em validação", tone: "warning" } : null,
      });
    }
    if (round.decidedAt && round.status !== "EM_ANALISE") {
      const approved = round.status === "ACEITA";
      events.push({
        id: `delivery:${round.id}:decision`,
        at: round.decidedAt,
        title: `${approved ? "Marco aprovado" : round.status === "REJEITADA" ? "Entrega rejeitada" : "Ajustes solicitados"} · ${milestoneTitle}`,
        detail: joinDetail([round.decidedByName ? `Decisão de ${round.decidedByName}` : null, dayMonth(round.decidedAt)]),
        tone: approved ? "success" : round.status === "REJEITADA" ? "danger" : "warning",
        badge: approved ? { label: "Aprovado", tone: "success" } : round.status === "REJEITADA" ? { label: "Rejeitado", tone: "danger" } : { label: "Ajustes", tone: "warning" },
      });
    }
  }
  return events;
}

export type ImpedimentInput = {
  id: string;
  description: string;
  openedByName: string | null;
  openedAt: string;
  resolvedByName: string | null;
  resolvedAt: string | null;
};

export function impedimentEvents(taskTitle: string, impediments: ReadonlyArray<ImpedimentInput>): TimelineEvent[] {
  return impediments.flatMap((item): TimelineEvent[] => {
    const opened: TimelineEvent = {
      id: `impediment:${item.id}:opened`,
      at: item.openedAt,
      title: `Impedimento registrado · ${taskTitle}`,
      detail: joinDetail([item.description, item.openedByName, dayMonth(item.openedAt)]),
      tone: "info",
      badge: null,
    };
    if (!item.resolvedAt) return [opened];
    return [
      opened,
      {
        id: `impediment:${item.id}:resolved`,
        at: item.resolvedAt,
        title: `Impedimento resolvido · ${taskTitle}`,
        detail: joinDetail([item.resolvedByName, dayMonth(item.resolvedAt)]),
        tone: "success",
        badge: { label: "Resolvido", tone: "success" },
      },
    ];
  });
}

export type AuditInput = { id: string; summary: string; actorName: string | null; createdAt: string; kind: string };

/** Auditoria do projeto. Reprogramação e definição de planejamento já vêm do histórico de reprogramações: ficam de fora para não duplicar. */
export function auditEvents(items: ReadonlyArray<AuditInput>): TimelineEvent[] {
  return items
    .filter((item) => item.kind !== "RESCHEDULE" && item.kind !== "PLANNING_DEFINED")
    .map((item) => ({
      id: `audit:${item.id}`,
      at: item.createdAt,
      title: item.summary,
      detail: joinDetail([item.actorName, dayMonth(item.createdAt)]),
      tone: "neutral" as const,
      badge: null,
    }));
}

/** Mais recente primeiro; mesmo id nunca se repete; sem data válida o evento é descartado (não há como ordená-lo). */
export function mergeTimeline(...groups: ReadonlyArray<ReadonlyArray<TimelineEvent>>): TimelineEvent[] {
  const seen = new Set<string>();
  return groups
    .flat()
    .filter((event) => !Number.isNaN(Date.parse(event.at)) && !seen.has(event.id) && seen.add(event.id))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Origem do evento, deduzida do prefixo do id (schedule, delivery, impediment, audit); usada só para escolher o ícone. */
export type TimelineSource = "schedule" | "delivery" | "impediment" | "audit" | "other";

export function timelineSource(id: string): TimelineSource {
  const prefix = id.split(":")[0];
  return prefix === "schedule" || prefix === "delivery" || prefix === "impediment" || prefix === "audit" ? prefix : "other";
}

/** "hoje", "ontem" ou "há N dias" (até 30 dias); vazio depois disso ou sem data válida (a data completa já vem no detalhe do evento). */
export function relativeDay(instant: string, now: Date = new Date()): string {
  const day = civilDay(instant);
  const today = civilDay(now);
  if (!day || !today) return "";
  const diff = daysBetween(day, today);
  if (diff < 0 || diff > 30) return "";
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  return `há ${diff} dias`;
}
