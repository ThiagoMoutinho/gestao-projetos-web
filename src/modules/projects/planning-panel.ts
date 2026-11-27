import { civilDay, planDivergence, type PlanDivergence } from "./eap-deadline.ts";
import { meaningfulText } from "./field-display.ts";
import { nextDeliveryItem } from "./project-portfolio.ts";

/** Subconjunto dos itens do monitoramento usado pelo painel (o contrato real é maior). */
export type PlanningItem = {
  entityType: string;
  entityId: string;
  title: string;
  status: string;
  baselineStartAt: string | null;
  baselineEndAt: string | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  overdue: boolean;
  rescheduleCount: number;
  /** Cumprimento de prazo calculado pela API (ver `deadlinePerformance` do monitoramento). */
  deadlinePerformance?: string | null;
};

/**
 * Itens (fases, tarefas e marcos) já concluídos depois do prazo vigente: atraso histórico, que não se confunde com o atraso
 * ativo (item ainda aberto após o prazo). A classificação vem pronta da API; aqui só se conta.
 */
export function doneLateCount(items: ReadonlyArray<Pick<PlanningItem, "deadlinePerformance">>) {
  return items.filter((item) => item.deadlinePerformance === "DONE_LATE").length;
}

export type DayRange = { start: string | null; end: string | null };

export type ConsolidatedSchedule = {
  /** Datas originalmente planejadas (linha de base) dos compromissos efetivos. */
  baseline: DayRange;
  /** Datas planejadas hoje (prazo vigente) dos compromissos efetivos. */
  current: DayRange;
  /** Quantidade de compromissos com data vigente considerados. */
  commitments: number;
};

/** Cancelada não é compromisso; fase é contêiner e entra apenas pelas tarefas e marcos que contém. */
function isCommitment(item: PlanningItem) {
  return (item.entityType === "TASK" || item.entityType === "MILESTONE") && item.status !== "CANCELADA";
}

function spanOfDays(pairs: ReadonlyArray<readonly [string | null, string | null]>): DayRange {
  const starts: string[] = [];
  const ends: string[] = [];
  for (const [start, end] of pairs) {
    const first = civilDay(start) ?? civilDay(end);
    const last = civilDay(end) ?? civilDay(start);
    if (first) starts.push(first);
    if (last) ends.push(last);
  }
  starts.sort();
  ends.sort();
  return { start: starts[0] ?? null, end: ends.at(-1) ?? null };
}

/**
 * Consolida o cronograma do projeto: menor início e maior término entre tarefas e marcos, separadamente na linha de base e
 * no planejamento vigente. Fases não entram (seriam contêineres duplicando as datas dos filhos) e datas reais nunca
 * substituem as planejadas. Sem datas, devolve vazio: nada é inventado. Mesma base de `planDivergence` e das datas
 * consolidadas das fases (tarefas e marcos).
 */
export function consolidateSchedule(items: ReadonlyArray<PlanningItem>): ConsolidatedSchedule {
  const commitments = items.filter(isCommitment);
  return {
    baseline: spanOfDays(commitments.map((item) => [item.baselineStartAt, item.baselineEndAt] as const)),
    current: spanOfDays(commitments.map((item) => [item.plannedStartAt, item.plannedEndAt] as const)),
    commitments: commitments.filter((item) => item.plannedStartAt || item.plannedEndAt).length,
  };
}

function dayNumber(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date) / 86_400_000;
}

/** Dias corridos entre dois dias civis (AAAA-MM-DD): positivo quando `to` é depois de `from`. */
export function daysBetween(from: string, to: string) {
  return Math.round(dayNumber(to) - dayNumber(from));
}

/**
 * Desvio da linha de base: diferença entre o término consolidado vigente e o da linha de base, em dias corridos.
 * Positivo = prazo estendido; negativo = antecipado; null quando falta uma das datas.
 */
export function baselineDeviation(schedule: Pick<ConsolidatedSchedule, "baseline" | "current">) {
  const { baseline, current } = schedule;
  return baseline.end && current.end ? daysBetween(baseline.end, current.end) : null;
}

/** Sinaliza apenas quando o planejamento gravado no próprio projeto diverge do consolidado dos itens. */
export function projectPlanDivergence(
  project: { plannedStartAt: string | null; plannedEndAt: string | null },
  schedule: Pick<ConsolidatedSchedule, "current">,
): PlanDivergence | null {
  // `planDivergence` compara instantes; o consolidado está em dias civis (Belém), então volta ao meio-dia do mesmo dia.
  const noon = (day: string | null) => (day ? `${day}T12:00:00.000-03:00` : null);
  const divergence = planDivergence(
    { startAt: project.plannedStartAt, endAt: project.plannedEndAt },
    { startAt: noon(schedule.current.start), endAt: noon(schedule.current.end) },
  );
  // Projeto sem planejamento gravado é o caso normal: o consolidado é a referência, sem aviso.
  return divergence && !divergence.noPlan ? divergence : null;
}

export type MilestoneState = "done" | "awaiting" | "overdue" | "pending";

export type TimelineMilestone = {
  id: string;
  title: string;
  day: string;
  state: MilestoneState;
  rescheduled: boolean;
  /** Próxima entrega pelo critério único da Visão Geral (pode estar atrasada). */
  next: boolean;
};

/** Marcos com data vigente e situação para a linha do tempo; "próximo" é o critério único da próxima entrega. */
export function timelineMilestones(items: ReadonlyArray<PlanningItem>): TimelineMilestone[] {
  const milestones = items.filter((item) => item.entityType === "MILESTONE");
  const next = nextDeliveryItem(milestones.map((item) => ({ ...item, plannedEndAt: item.plannedEndAt })));
  return milestones
    .flatMap((item) => {
      const day = civilDay(item.plannedEndAt);
      if (!day) return [];
      const state: MilestoneState =
        item.status === "APROVADO"
          ? "done"
          : item.status === "ENTREGUE"
            ? "awaiting"
            : item.overdue
              ? "overdue"
              : "pending";
      return [
        {
          id: item.entityId,
          title: item.title,
          day,
          state,
          rescheduled: item.rescheduleCount > 0,
          next: next?.entityId === item.entityId,
        },
      ];
    })
    .sort((left, right) => left.day.localeCompare(right.day));
}

export function milestoneProgress(items: ReadonlyArray<PlanningItem>) {
  const milestones = items.filter((item) => item.entityType === "MILESTONE");
  return { done: milestones.filter((item) => item.status === "APROVADO").length, total: milestones.length };
}

export type Timeline = {
  /** Eixo comum em dias civis. */
  from: string;
  to: string;
  /** Posição (0–100) de cada data no eixo. */
  position: (day: string) => number;
  today: number | null;
};

/** Eixo que cobre a linha de base, o prazo vigente e os marcos; null sem nenhuma data. "Hoje" só aparece dentro do eixo. */
export function buildTimeline(
  schedule: Pick<ConsolidatedSchedule, "baseline" | "current">,
  milestones: ReadonlyArray<TimelineMilestone>,
  today: string,
): Timeline | null {
  const days = [
    schedule.baseline.start,
    schedule.baseline.end,
    schedule.current.start,
    schedule.current.end,
    ...milestones.map((milestone) => milestone.day),
  ]
    .filter((day): day is string => day !== null)
    .sort();
  if (days.length === 0) return null;
  const from = days[0];
  const to = days.at(-1) as string;
  const span = daysBetween(from, to);
  const position = (day: string) => (span === 0 ? 50 : (daysBetween(from, day) / span) * 100);
  return { from, to, position, today: today >= from && today <= to ? position(today) : null };
}

export type RequiredFieldId =
  | "PROBLEM"
  | "PURPOSE"
  | "SCOPE"
  | "SCHEDULE"
  | "MANAGER"
  | "SPONSOR"
  | "TECHNICAL_LEAD"
  | "SUPPLIER";

export type FieldState = "filled" | "pending" | "structural" | "unknown";

export type RequiredField = { id: RequiredFieldId; label: string; criterion: string; state: FieldState };

type Member = { role: string };

export type CompletenessInput = {
  /** Texto publicado de cada campo de contexto; null = não carregado. */
  context: { PROBLEM: string | null; PURPOSE: string | null; SCOPE: string | null } | null;
  /** Prazo e marcos: derivados do monitoramento; null = não carregado. */
  schedule: { milestonesWithDate: number; hasCurrentEnd: boolean } | null;
  members: ReadonlyArray<Member> | null;
};

/**
 * Os oito campos obrigatórios do Planejamento, cada um com critério objetivo de preenchimento:
 * Problema, Finalidade e Escopo: texto publicado com conteúdo; Prazo e marcos: prazo vigente consolidado e ao menos um marco
 * com data; Gestor, Patrocinador, Responsável técnico e Fornecedor: ao menos um participante com o papel correspondente.
 */
export function requiredFields(input: CompletenessInput): RequiredField[] {
  const text = (key: "PROBLEM" | "PURPOSE" | "SCOPE"): FieldState =>
    input.context === null ? "unknown" : meaningfulText(input.context[key]) ? "filled" : "pending";
  const role = (name: string): FieldState =>
    input.members === null ? "unknown" : input.members.some((member) => member.role === name) ? "filled" : "pending";
  const schedule: FieldState =
    input.schedule === null
      ? "unknown"
      : input.schedule.hasCurrentEnd && input.schedule.milestonesWithDate > 0
        ? "filled"
        : "pending";
  return [
    { id: "PROBLEM", label: "Problema", criterion: "Texto do problema a resolver publicado.", state: text("PROBLEM") },
    { id: "PURPOSE", label: "Finalidade", criterion: "Texto da finalidade publicado.", state: text("PURPOSE") },
    { id: "SCOPE", label: "Escopo", criterion: "Texto do escopo publicado.", state: text("SCOPE") },
    {
      id: "SCHEDULE",
      label: "Prazo e marcos",
      criterion: "Prazo vigente consolidado e ao menos um marco com data planejada.",
      state: schedule,
    },
    { id: "MANAGER", label: "Gestor", criterion: "Ao menos um participante com o papel Gestor.", state: role("GESTOR") },
    {
      id: "SPONSOR",
      label: "Patrocinador",
      criterion: "Ao menos um participante com o papel Patrocinador.",
      state: role("PATROCINADOR"),
    },
    {
      id: "TECHNICAL_LEAD",
      label: "Responsável técnico",
      criterion: "Ao menos um participante com o papel Responsável técnico.",
      state: role("RESPONSAVEL_TECNICO"),
    },
    { id: "SUPPLIER", label: "Fornecedor", criterion: "Ao menos um participante com o papel Fornecedor.", state: role("FORNECEDOR") },
  ];
}

/**
 * Percentual sobre os oito campos (preenchidos ÷ 8). Null enquanto algum campo não puder ser avaliado (dados indisponíveis):
 * um percentual parcial seria enganoso.
 */
export function completeness(fields: ReadonlyArray<RequiredField>) {
  const filled = fields.filter((field) => field.state === "filled").length;
  const known = fields.every((field) => field.state !== "unknown");
  return {
    filled,
    total: fields.length,
    percent: known ? Math.round((filled / fields.length) * 100) : null,
    pending: fields.filter((field) => field.state === "pending" || field.state === "structural"),
  };
}
