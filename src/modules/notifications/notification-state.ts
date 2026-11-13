/**
 * Apresentação das notificações do acompanhamento semanal. Nada aqui calcula regra de negócio: o backend decide o que é
 * enviado, quando e quando uma pendência se resolve. Estas funções só traduzem os campos recebidos em rótulos e tons,
 * sem reescrever o conteúdo congelado (título e corpo) das notificações.
 */
export type NotificationKind = "PREVENTIVE" | "OVERDUE" | "ESCALATION";

export const NOTIFICATION_KINDS: ReadonlyArray<NotificationKind> = ["PREVENTIVE", "OVERDUE", "ESCALATION"];

export function isNotificationKind(value: unknown): value is NotificationKind {
  return value === "PREVENTIVE" || value === "OVERDUE" || value === "ESCALATION";
}

export const KIND_LABEL: Record<NotificationKind, string> = {
  PREVENTIVE: "Prazo da validação",
  OVERDUE: "Ciclo sem validação",
  ESCALATION: "Escalonamento",
};

export const KIND_HINT: Record<NotificationKind, string> = {
  PREVENTIVE: "Aviso preventivo: a validação semanal do resumo executivo vence na quarta-feira.",
  OVERDUE: "O ciclo semanal encerrou sem a validação regular do PMO.",
  ESCALATION: "Vários ciclos seguidos sem validação regular do PMO.",
};

export type KindTone = "info" | "warning" | "critical";

export const KIND_TONE: Record<NotificationKind, KindTone> = {
  PREVENTIVE: "info",
  OVERDUE: "warning",
  ESCALATION: "critical",
};

/** Cores semânticas sobre os tokens do design system; sempre acompanham texto e ícone (nunca só a cor). */
export const TONE_CLASS: Record<KindTone, { badge: string; rail: string; icon: string }> = {
  info: { badge: "border-primary/40 bg-card text-primary", rail: "bg-primary", icon: "bg-primary/10 text-primary" },
  warning: { badge: "border-warning/50 bg-card text-warning-foreground", rail: "bg-warning", icon: "bg-warning/25 text-warning-foreground" },
  critical: { badge: "border-destructive/40 bg-card text-destructive", rail: "bg-destructive", icon: "bg-destructive/10 text-destructive" },
};

/** Eixo da leitura (por destinatário). Ler nunca resolve a pendência. */
export type ReadState = "UNREAD" | "READ";
export const READ_LABEL: Record<ReadState, string> = { UNREAD: "Não lida", READ: "Lida" };

export function readState(readAt: string | null | undefined): ReadState {
  return readAt ? "READ" : "UNREAD";
}

/** Eixo da pendência (da notificação). Só o sistema resolve: validação, suspensão, conclusão ou fim do prazo. */
export type PendingState = "PENDING" | "RESOLVED";
export const PENDING_LABEL: Record<PendingState, string> = { PENDING: "Pendente", RESOLVED: "Resolvida" };

export function pendingState(resolvedAt: string | null | undefined): PendingState {
  return resolvedAt ? "RESOLVED" : "PENDING";
}

const RESOLUTION_LABEL: Record<string, string> = {
  VALIDATED: "Validada pelo PMO",
  PROJECT_SUSPENDED: "Projeto suspenso",
  PROJECT_CONCLUDED: "Projeto concluído",
  CYCLE_EXPIRED: "Prazo do ciclo encerrado",
};

/** Motivo da resolução em português; um motivo desconhecido não é inventado: cai em "Resolvida". */
export function resolutionLabel(reason: string | null | undefined): string {
  return (reason && RESOLUTION_LABEL[reason]) || "Resolvida";
}

/** AAAA-MM-DD → dd/mm/aaaa, sem converter fuso (datas civis). */
export function civilDay(day: string): string {
  const [year, month, date] = day.split("-");
  return year && month && date ? `${date}/${month}/${year}` : day;
}

/** AAAA-MM-DD → dd/mm. */
export function shortDay(day: string): string {
  const [, month, date] = day.split("-");
  return month && date ? `${date}/${month}` : day;
}

const MOMENT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Belem",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Instante (ISO) no horário de Belém: dd/mm/aaaa, hh:mm. */
export function formatMoment(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : MOMENT.format(date);
}

type CycleFields = { kind: NotificationKind; cycleStart: string; sequenceStart: string | null; dueDate: string };

/** Ciclo (avisos preventivo e de atraso) ou início da sequência sem validação (escalonamento). */
export function cycleSummary(item: CycleFields): { label: string; value: string } {
  if (item.kind === "ESCALATION") {
    return { label: "Sem validação desde o ciclo de", value: civilDay(item.sequenceStart ?? item.cycleStart) };
  }
  return { label: "Ciclo", value: `${shortDay(item.cycleStart)} a ${shortDay(item.dueDate)}` };
}

/** No escalonamento a data é o prazo de 10 dias corridos; nos demais, o fim do ciclo (vencimento original, nunca alterado). */
export function dueSummary(item: CycleFields): { label: string; value: string } {
  return {
    label: item.kind === "ESCALATION" ? "Prazo do escalonamento" : "Vencimento original",
    value: civilDay(item.dueDate),
  };
}

export const VISIBILITY_LABEL: Record<"TO" | "CC", string> = { TO: "Destinatário", CC: "Em cópia" };

/** Visão do ADMIN/PMO: quantos destinatários ainda não leram (a leitura é individual). */
export function unreadSummary(unread: number, recipients: number): string {
  if (recipients === 0) return "Sem destinatários";
  if (unread === 0) return recipients === 1 ? "Lida" : "Lida por todos";
  return unread === recipients ? (recipients === 1 ? "Não lida" : "Ninguém leu ainda") : `${unread} de ${recipients} ainda não leram`;
}
