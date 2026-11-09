import type { GetScheduleMonitoring200DeadlineSituation } from "@/lib/api/generated/model/getScheduleMonitoring200DeadlineSituation";

export type DeadlineBadge = {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
  hint: string;
};

const NOT_EVALUATED = "Dependências e riscos formais ainda não têm registro no sistema e não foram avaliados.";

/** Selo da situação do prazo calculada pela API. Projeto suspenso (`status` nulo) não tem selo. */
export function deadlineBadge(situation: GetScheduleMonitoring200DeadlineSituation): DeadlineBadge | null {
  switch (situation.status) {
    case "CONCLUIDO":
      return { label: "Concluído", tone: "success", hint: "Projeto formalmente encerrado." };
    case "ATRASADO":
      return { label: "Atrasado", tone: "danger", hint: "Existe compromisso vigente vencido e não concluído." };
    case "EM_ATENCAO":
      return {
        label: "Em atenção",
        tone: "warning",
        hint: `Compromisso com vencimento nos próximos 30 dias e indicador objetivo de risco. ${NOT_EVALUATED}`,
      };
    case "NO_PRAZO":
      return situation.hasDatedCommitments
        ? { label: "No prazo", tone: "success", hint: `Nenhum atraso ou risco identificado nos registros. ${NOT_EVALUATED}` }
        : { label: "Sem compromissos datados", tone: "neutral", hint: "Não há prazos definidos: o cumprimento do prazo não pode ser avaliado." };
    default:
      return null;
  }
}

/** Cores do selo, as mesmas no indicador da Visão Geral e no selo do Planejamento. */
export const DEADLINE_TONE_CLASS: Record<DeadlineBadge["tone"], string> = {
  success: "bg-success/15 text-success-foreground",
  warning: "bg-warning/15 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

export type DeadlineIndicator =
  | { kind: "loading" }
  | { kind: "unavailable" }
  /** Projeto suspenso: a API devolve status nulo e não há situação de prazo a mostrar. */
  | { kind: "hidden" }
  | { kind: "badge"; badge: DeadlineBadge };

/**
 * Estado do indicador de prazo da Visão Geral a partir da consulta de monitoramento. Só repassa o que a API calculou:
 * sem dados (carregando ou falha) não há classificação, e não se recorre a outro cálculo.
 */
export function deadlineIndicator(
  monitoring: { status: "loading" } | { status: "error" } | { status: "ready"; data: { deadlineSituation: GetScheduleMonitoring200DeadlineSituation } },
): DeadlineIndicator {
  if (monitoring.status === "loading") {
    return { kind: "loading" };
  }
  if (monitoring.status === "error") {
    return { kind: "unavailable" };
  }
  const badge = deadlineBadge(monitoring.data.deadlineSituation);
  return badge ? { kind: "badge", badge } : { kind: "hidden" };
}
