/**
 * Cumprimento de prazo, separado da situação do item. A regra é a mesma do monitoramento da API:
 * concluir dentro de um prazo reprogramado não equivale a concluir no prazo original.
 */
export type DeadlinePerformance =
  | "DONE_ON_ORIGINAL"
  | "DONE_ON_RESCHEDULED"
  | "DONE_LATE"
  | "OPEN_ON_TIME"
  | "OPEN_ON_RESCHEDULED"
  | "OPEN_OVERDUE";

export type DeadlineState = "OPEN" | "DONE" | "CLOSED";

export type DeadlineTone = "good" | "info" | "warning" | "danger";

type DeadlineDates = {
  plannedEndAt: string | null;
  baselineEndAt: string | null;
  actualEndAt: string | null;
};

const INDICATORS: Record<DeadlinePerformance, { label: string; description: string; tone: DeadlineTone }> = {
  DONE_ON_ORIGINAL: {
    label: "Conclusão no prazo original",
    description: "Concluído até a data do planejamento original.",
    tone: "good",
  },
  DONE_ON_RESCHEDULED: {
    label: "Conclusão no prazo reprogramado",
    description: "Cumpriu o prazo vigente, mas depois do prazo original.",
    tone: "info",
  },
  DONE_LATE: {
    label: "Conclusão com atraso",
    description: "Concluído depois do prazo vigente.",
    tone: "danger",
  },
  OPEN_ON_TIME: {
    label: "Em execução no prazo",
    description: "O prazo vigente ainda não venceu.",
    tone: "good",
  },
  OPEN_ON_RESCHEDULED: {
    label: "Em execução no prazo reprogramado",
    description: "O prazo original já passou; o prazo vigente ainda não.",
    tone: "warning",
  },
  OPEN_OVERDUE: {
    label: "Prazo vencido",
    description: "O prazo vigente já passou sem conclusão.",
    tone: "danger",
  },
};

/** Dia civil (AAAA-MM-DD) no fuso de Belém, comparável como texto. */
export function civilDay(value: string | Date | null) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function deadlinePerformance(
  state: DeadlineState,
  dates: DeadlineDates,
  today = civilDay(new Date()),
): DeadlinePerformance | null {
  const planned = civilDay(dates.plannedEndAt);
  if (state === "CLOSED" || !planned) {
    return null;
  }
  const original = civilDay(dates.baselineEndAt) ?? planned;

  if (state === "DONE") {
    const actual = civilDay(dates.actualEndAt);
    if (!actual) {
      return null;
    }
    if (actual > planned) {
      return "DONE_LATE";
    }
    return actual <= original ? "DONE_ON_ORIGINAL" : "DONE_ON_RESCHEDULED";
  }

  if (today && today > planned) {
    return "OPEN_OVERDUE";
  }
  return today && today > original ? "OPEN_ON_RESCHEDULED" : "OPEN_ON_TIME";
}

export function deadlineIndicator(performance: DeadlinePerformance | null) {
  return performance ? INDICATORS[performance] : null;
}

/** Houve reprogramação quando o prazo vigente difere do planejamento original. */
export function wasRescheduled(dates: { plannedStartAt?: string | null; plannedEndAt: string | null; baselineStartAt?: string | null; baselineEndAt: string | null }) {
  const differs = (current: string | null | undefined, original: string | null | undefined) =>
    Boolean(original) && civilDay(current ?? null) !== civilDay(original ?? null);
  return differs(dates.plannedEndAt, dates.baselineEndAt) || differs(dates.plannedStartAt, dates.baselineStartAt);
}

type DateRange = { startAt: string | null; endAt: string | null };

export type PlanDivergence = {
  /** A fase não tem planejamento gravado, mas os itens já indicam datas. */
  noPlan: boolean;
  start: boolean;
  end: boolean;
  /** Os itens terminam depois do término planejado da fase. */
  itemsEndLater: boolean;
};

/**
 * Compara o planejamento gravado da fase com as datas consolidadas dos itens, por dia civil.
 * Só sinaliza: nunca altera o planejamento. Sem datas nos itens, não há o que comparar.
 */
export function planDivergence(planned: DateRange, consolidated: DateRange): PlanDivergence | null {
  const items = { start: civilDay(consolidated.startAt), end: civilDay(consolidated.endAt) };
  if (!items.start && !items.end) {
    return null;
  }
  const plan = { start: civilDay(planned.startAt), end: civilDay(planned.endAt) };
  if (!plan.start && !plan.end) {
    return { noPlan: true, start: false, end: false, itemsEndLater: false };
  }
  const start = items.start !== null && items.start !== plan.start;
  const end = items.end !== null && items.end !== plan.end;
  if (!start && !end) {
    return null;
  }
  return { noPlan: false, start, end, itemsEndLater: end && plan.end !== null && items.end !== null && items.end > plan.end };
}

type CivilRange = { start: string; end: string };

/**
 * Ajuste em cascata (mesma regra da API): período da fase estendido para cobrir o item, em dias
 * civis AAAA-MM-DD. Retorna null quando o item já cabe na fase ou não tem data.
 */
export function phaseCoverage(phase: CivilRange, item: CivilRange): CivilRange | null {
  const itemStart = item.start || item.end;
  const itemEnd = item.end || item.start;
  if (!itemStart || !itemEnd) {
    return null;
  }
  if (!phase.start && !phase.end) {
    return { start: itemStart, end: itemEnd };
  }
  const start = phase.start && itemStart < phase.start ? itemStart : phase.start;
  const end = phase.end && itemEnd > phase.end ? itemEnd : phase.end;
  return start === phase.start && end === phase.end ? null : { start, end };
}

/** Período que cobre todos os itens (menor início e maior término), em dias civis; vazio sem datas. */
export function spanOf(items: ReadonlyArray<CivilRange>): CivilRange {
  const starts = items.map((item) => item.start || item.end).filter(Boolean).sort();
  const ends = items.map((item) => item.end || item.start).filter(Boolean).sort();
  return { start: starts[0] ?? "", end: ends.at(-1) ?? "" };
}

/**
 * Datas reais registradas na fase × indicadas pelos itens, por dia civil. Só há divergência quando
 * as duas existem e diferem; campo vazio é preenchido pelo recálculo, não sinalizado aqui.
 */
export function actualDivergence(recorded: DateRange, consolidated: DateRange) {
  const differs = (a: string | null, b: string | null) => Boolean(a && b) && civilDay(a) !== civilDay(b);
  const start = differs(recorded.startAt, consolidated.startAt);
  const end = differs(recorded.endAt, consolidated.endAt);
  return start || end ? { start, end } : null;
}

/**
 * Validação comum às datas reais, usada no registro, na correção e na conclusão.
 * Retorna a mensagem do primeiro problema ou null.
 */
export function actualDatesProblem(input: {
  start: string;
  end: string;
  today: string;
  requireBoth?: boolean;
}) {
  if (input.requireBoth && (!input.start || !input.end)) {
    return "Para concluir, informe as datas reais de início e de término.";
  }
  if ([input.start, input.end].some((value) => value && value > input.today)) {
    return "Datas realizadas não podem estar no futuro.";
  }
  if (input.end && !input.start) {
    return "A data real de término exige uma data real de início.";
  }
  if (input.start && input.end && input.end < input.start) {
    return "A data real de término não pode ser anterior à data de início.";
  }
  return null;
}

/** Corrigir uma data real já registrada (alterar ou apagar) exige justificativa. */
export function correctsActualDate(previous: string, next: string) {
  return previous !== "" && next !== previous;
}
