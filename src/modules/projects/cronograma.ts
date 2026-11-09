/** Lógica pura da página Cronograma (sem React): linhas por fase, eixo comum e totais. Os números vêm da API; aqui só se organiza. */

import { civilDay } from "./eap-deadline.ts";
import { daysBetween } from "./planning-panel.ts";

export type ScheduleItem = {
  entityType: string;
  entityId: string;
  phaseId: string;
  title: string;
  status: string;
  baselineStartAt: string | null;
  baselineEndAt: string | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
  overdue: boolean;
  rescheduleCount: number;
};

export type PhaseInput = {
  id: string;
  name: string;
  /** Em pontos-base (0 a 10000), como calculado pela API; null quando a fase não tem progresso calculável. */
  progressBasisPoints: number | null;
  tasks: number;
  impediments: number;
  /** Situação da fase como já exibida na EAP (por exemplo, "Concluída"). */
  statusLabel?: string;
};

export type DayRange = { start: string | null; end: string | null };

export type MilestoneMark = { id: string; title: string; day: string; state: "done" | "awaiting" | "overdue" | "pending"; rescheduled: boolean };

export type PhaseRow = {
  id: string;
  name: string;
  baseline: DayRange;
  current: DayRange;
  actual: DayRange;
  /** Concluída, atrasada ou em andamento, para a cor da barra vigente. */
  tone: "done" | "overdue" | "progress" | "idle";
  progressPercent: number | null;
  tasks: number;
  impediments: number;
  statusLabel: string | null;
  milestones: MilestoneMark[];
  awaitingMilestones: number;
};

function span(pairs: ReadonlyArray<readonly [string | null, string | null]>): DayRange {
  const starts: string[] = [];
  const ends: string[] = [];
  for (const [start, end] of pairs) {
    const first = civilDay(start) ?? civilDay(end);
    const last = civilDay(end) ?? civilDay(start);
    if (first) starts.push(first);
    if (last) ends.push(last);
  }
  return { start: starts.sort()[0] ?? null, end: ends.sort().at(-1) ?? null };
}

const NONE: DayRange = { start: null, end: null };

/** Uma linha por fase, na ordem recebida. Datas da própria fase; sem datas, o intervalo das tarefas e marcos dela. */
export function phaseRows(phases: ReadonlyArray<PhaseInput>, items: ReadonlyArray<ScheduleItem>): PhaseRow[] {
  return phases.map((phase) => {
    const own = items.find((item) => item.entityType === "PHASE" && item.entityId === phase.id);
    const children = items.filter((item) => item.phaseId === phase.id && item.entityType !== "PHASE" && item.status !== "CANCELADA");
    const childRange = (pick: (item: ScheduleItem) => readonly [string | null, string | null]) => span(children.map(pick));
    const ownRange = (start: string | null | undefined, end: string | null | undefined) => (start || end ? span([[start ?? null, end ?? null]]) : NONE);
    const choose = (own_: DayRange, fallback: DayRange) => (own_.start || own_.end ? own_ : fallback);

    const baseline = choose(ownRange(own?.baselineStartAt, own?.baselineEndAt), childRange((item) => [item.baselineStartAt, item.baselineEndAt]));
    const current = choose(ownRange(own?.plannedStartAt, own?.plannedEndAt), childRange((item) => [item.plannedStartAt, item.plannedEndAt]));
    const actual = choose(ownRange(own?.actualStartAt, own?.actualEndAt), childRange((item) => [item.actualStartAt, item.actualEndAt]));

    const milestones = children
      .filter((item) => item.entityType === "MILESTONE")
      .flatMap((item): MilestoneMark[] => {
        const day = civilDay(item.plannedEndAt);
        if (!day) return [];
        const state = item.status === "APROVADO" ? "done" : item.status === "ENTREGUE" ? "awaiting" : item.overdue ? "overdue" : "pending";
        return [{ id: item.entityId, title: item.title, day, state, rescheduled: item.rescheduleCount > 0 }];
      })
      .sort((a, b) => a.day.localeCompare(b.day));

    const tone: PhaseRow["tone"] = own?.status === "CONCLUIDA" ? "done" : own?.overdue ? "overdue" : own?.status === "EM_ANDAMENTO" ? "progress" : "idle";

    return {
      id: phase.id,
      name: phase.name,
      baseline,
      current,
      actual,
      tone,
      progressPercent: phase.progressBasisPoints === null ? null : Math.round(phase.progressBasisPoints / 100),
      tasks: phase.tasks,
      impediments: phase.impediments,
      statusLabel: phase.statusLabel ?? null,
      milestones,
      awaitingMilestones: milestones.filter((mark) => mark.state === "awaiting").length,
    };
  });
}

export type Axis = {
  from: string;
  to: string;
  position: (day: string) => number;
  today: number | null;
  /** Rótulos do eixo (início, quartos e fim), em dias civis. */
  ticks: Array<{ day: string; left: number }>;
};

function addDays(day: string, amount: number) {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + amount)).toISOString().slice(0, 10);
}

/** Eixo comum a todas as linhas: cobre linha de base, vigente, real e marcos. Sem nenhuma data, null. */
export function buildAxis(rows: ReadonlyArray<PhaseRow>, today: string): Axis | null {
  const days = rows
    .flatMap((row) => [row.baseline.start, row.baseline.end, row.current.start, row.current.end, row.actual.start, row.actual.end, ...row.milestones.map((mark) => mark.day)])
    .filter((day): day is string => day !== null)
    .sort();
  if (days.length === 0) return null;
  const from = days[0];
  const to = days.at(-1) as string;
  const total = daysBetween(from, to);
  const position = (day: string) => (total === 0 ? 50 : (daysBetween(from, day) / total) * 100);
  const ticks =
    total === 0
      ? [{ day: from, left: 50 }]
      : [0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const day = addDays(from, Math.round(total * fraction));
          return { day, left: position(day) };
        });
  return { from, to, position, today: today >= from && today <= to ? position(today) : null, ticks };
}

/** Início e término reais do projeto para a tabela de datas: o menor início e o maior término reais registrados. */
export function actualProjectRange(items: ReadonlyArray<ScheduleItem>): DayRange {
  return span(items.filter((item) => item.entityType !== "PHASE").map((item) => [item.actualStartAt, item.actualEndAt] as const));
}

/** "há N dias" a partir de um instante; null sem data. */
export function daysAgo(instant: string | null, today: string): number | null {
  const day = civilDay(instant);
  return day ? Math.max(0, daysBetween(day, today)) : null;
}

export type HistoryFilter = "ALL" | "EFFECTIVE" | "PENDING" | "REJECTED" | "INITIAL";

type Filterable = { source: string; status: string };

export function matchesFilter(item: Filterable, filter: HistoryFilter) {
  switch (filter) {
    case "ALL":
      return true;
    case "EFFECTIVE":
      return item.status === "EFETIVADA_DIRETAMENTE" || item.status === "APROVADA";
    case "PENDING":
      return item.status === "PENDENTE";
    case "REJECTED":
      return item.status === "REJEITADA";
    case "INITIAL":
      return item.source === "INITIAL_DEFINITION";
  }
}
