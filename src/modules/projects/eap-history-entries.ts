import type { ListEapAudit200DataItem } from "@/lib/api/generated/model/listEapAudit200DataItem";
import type { ListEapAudit200DataItemDetailsKind } from "@/lib/api/generated/model/listEapAudit200DataItemDetailsKind";

export type HistoryTone =
  | "cancel"
  | "reactivate"
  | "progress"
  | "delivery"
  | "accept"
  | "adjustments"
  | "reject"
  | "automatic"
  | "evidence"
  | "impediment"
  | "reschedule"
  | "neutral";

export type HistoryNote = { label: string; text: string };

export type HistoryEntry = {
  id: string;
  kindLabel: string;
  tone: HistoryTone;
  title: string;
  actor: string;
  createdAt: string;
  transition: { from: string; to: string } | null;
  notes: HistoryNote[];
  cause: string | null;
  related: HistoryEntry[];
};

type Formatters = {
  statusLabel: (status: string) => string;
  date: (value: string) => string;
};

const KINDS: Record<ListEapAudit200DataItemDetailsKind, { label: string; tone: HistoryTone }> = {
  CANCELLATION: { label: "Cancelamento", tone: "cancel" },
  REACTIVATION: { label: "Reativação", tone: "reactivate" },
  AUTOMATIC_STATUS: { label: "Ajuste automático", tone: "automatic" },
  STATUS: { label: "Situação", tone: "neutral" },
  PROGRESS: { label: "Andamento", tone: "progress" },
  DELIVERY: { label: "Entrega", tone: "delivery" },
  ACCEPTANCE: { label: "Aceite", tone: "accept" },
  ADJUSTMENTS_REQUESTED: { label: "Correções", tone: "adjustments" },
  REJECTION: { label: "Rejeição", tone: "reject" },
  RESUBMISSION_AUTHORIZED: { label: "Reenvio autorizado", tone: "neutral" },
  RESCHEDULE: { label: "Reprogramação", tone: "reschedule" },
  PLANNING_DEFINED: { label: "Planejamento", tone: "neutral" },
  CREATION: { label: "Criação", tone: "neutral" },
  UPDATE: { label: "Alteração", tone: "neutral" },
  DELETION: { label: "Exclusão", tone: "neutral" },
  REORDER: { label: "Reordenação", tone: "neutral" },
  EVIDENCE: { label: "Evidência", tone: "evidence" },
  IMPEDIMENT_OPENED: { label: "Impedimento", tone: "impediment" },
  IMPEDIMENT_UPDATED: { label: "Impedimento", tone: "impediment" },
  IMPEDIMENT_RESOLVED: { label: "Resolução", tone: "accept" },
  IMPEDIMENT_FLAGGED: { label: "Impedimento", tone: "impediment" },
  IMPEDIMENT_UNFLAGGED: { label: "Impedimento", tone: "neutral" },
  OTHER: { label: "Registro", tone: "neutral" },
};

const LEGACY_TITLES: Partial<Record<ListEapAudit200DataItemDetailsKind, string>> = {
  IMPEDIMENT_FLAGGED: "Impedimento sinalizado (motivo não registrado).",
  IMPEDIMENT_UNFLAGGED: "Impedimento retirado.",
};

const JUSTIFICATION_LABELS: Partial<Record<ListEapAudit200DataItemDetailsKind, string>> = {
  CANCELLATION: "Justificativa do cancelamento",
  REACTIVATION: "Justificativa da reativação",
  RESUBMISSION_AUTHORIZED: "Justificativa da autorização",
  RESCHEDULE: "Justificativa da reprogramação",
};

const NOTE_LABELS: Partial<Record<ListEapAudit200DataItemDetailsKind, string>> = {
  DELIVERY: "Observações da entrega",
  ADJUSTMENTS_REQUESTED: "Justificativa",
  REJECTION: "Motivo da rejeição",
};

const SAME_ACTION_MS = 2000;

function percentText(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function openDurationText(minutes: number) {
  if (minutes < 60) return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hora" : `${hours} horas`;
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const dayText = days === 1 ? "1 dia" : `${days} dias`;
  if (rest === 0) return dayText;
  return `${dayText} e ${rest === 1 ? "1 hora" : `${rest} horas`}`;
}

function title(item: ListEapAudit200DataItem) {
  const { kind, fromPercent, toPercent } = item.details;
  if (kind === "PROGRESS" && toPercent !== null) {
    return fromPercent !== null && fromPercent !== toPercent
      ? `Andamento alterado de ${percentText(fromPercent)} para ${percentText(toPercent)}.`
      : `Andamento registrado em ${percentText(toPercent)}.`;
  }
  return LEGACY_TITLES[kind] ?? item.summary;
}

function notes(item: ListEapAudit200DataItem): HistoryNote[] {
  const { kind, justification, note, nonconformities, adjustments, round, reason, previousReason, resolutionNote, openMinutes } =
    item.details;
  const list: HistoryNote[] = [];
  if (round !== null) list.push({ label: "Rodada", text: `Entrega ${round}` });
  if (justification) list.push({ label: JUSTIFICATION_LABELS[kind] ?? "Justificativa", text: justification });
  if (note) list.push({ label: NOTE_LABELS[kind] ?? "Parecer", text: note });
  if (nonconformities) list.push({ label: "Inconformidades", text: nonconformities });
  if (adjustments) list.push({ label: "Correções necessárias", text: adjustments });
  if (previousReason) list.push({ label: "Motivo anterior", text: previousReason });
  if (reason) list.push({ label: previousReason ? "Novo motivo" : "Motivo do impedimento", text: reason });
  if (resolutionNote) list.push({ label: "Resolução", text: resolutionNote });
  if (openMinutes !== null) list.push({ label: "Tempo em aberto", text: openDurationText(openMinutes) });
  return list;
}

function present(item: ListEapAudit200DataItem, format: Formatters): HistoryEntry {
  const { kind, fromStatus, toStatus, cause } = item.details;
  return {
    id: item.id,
    kindLabel: KINDS[kind].label,
    tone: KINDS[kind].tone,
    title: title(item),
    actor: item.actorName?.trim() || "Usuário não identificado",
    createdAt: format.date(item.createdAt),
    transition:
      fromStatus && toStatus && fromStatus !== toStatus
        ? { from: format.statusLabel(fromStatus), to: format.statusLabel(toStatus) }
        : null,
    notes: notes(item),
    cause,
    related: [],
  };
}

/**
 * Ajustes automáticos gravados na mesma ação aparecem como desdobramento do evento que os causou.
 * Nenhum registro é descartado: o ajuste continua listado dentro do evento principal.
 */
export function presentHistory(items: ListEapAudit200DataItem[], format: Formatters): HistoryEntry[] {
  const entries = items.map((item) => present(item, format));
  const parentOf = new Map<number, number>();

  items.forEach((item, index) => {
    if (!item.details.automatic) return;
    const at = Date.parse(item.createdAt);
    let best: number | null = null;
    items.forEach((candidate, candidateIndex) => {
      if (
        candidate.details.automatic ||
        candidate.entityId !== item.entityId ||
        candidate.actorId !== item.actorId
      ) {
        return;
      }
      const distance = Math.abs(Date.parse(candidate.createdAt) - at);
      if (distance > SAME_ACTION_MS) return;
      if (best === null || distance < Math.abs(Date.parse(items[best].createdAt) - at)) {
        best = candidateIndex;
      }
    });
    if (best !== null) parentOf.set(index, best);
  });

  parentOf.forEach((parent, child) => entries[parent].related.push(entries[child]));
  return entries.filter((_, index) => !parentOf.has(index));
}
