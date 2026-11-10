import type {
  PortfolioMilestone,
  ProjectListRow,
  ProjectMonitoringSignals,
  ProjectStatus,
} from "../projects/project-portfolio.ts";

/**
 * Agregações do painel do Início. Tudo parte da situação calculada pela API e dos sinais do
 * monitoramento de prazos; nada é estimado aqui. Dados indisponíveis são contados à parte.
 */

type Row = Pick<ProjectListRow, "id" | "name" | "status" | "situation" | "suppliers" | "updatedAt">;
type Signals = Readonly<Record<string, ProjectMonitoringSignals | null>>;

export type DashboardIndicatorKey = "total" | "EM_EXECUCAO" | "EM_ATENCAO" | "CRITICO" | "CONCLUIDO";

export const DASHBOARD_INDICATORS: ReadonlyArray<{ key: DashboardIndicatorKey; label: string }> = [
  { key: "total", label: "Total de projetos" },
  { key: "EM_EXECUCAO", label: "Em andamento" },
  { key: "EM_ATENCAO", label: "Em atenção" },
  { key: "CRITICO", label: "Críticos" },
  { key: "CONCLUIDO", label: "Concluídos" },
];

/** Ordem de leitura executiva: primeiro o que exige ação, por último o que já terminou. */
export const STATUS_ORDER: ReadonlyArray<ProjectStatus> = [
  "CRITICO",
  "EM_ATENCAO",
  "EM_EXECUCAO",
  "EM_VALIDACAO",
  "NAO_INICIADO",
  "SUSPENSO",
  "CONCLUIDO",
];

function countByStatus(rows: ReadonlyArray<Pick<Row, "status">>) {
  const counts = new Map<ProjectStatus, number>();
  for (const row of rows) {
    if (row.status) {
      counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
    }
  }
  return counts;
}

/** Projeto ainda em curso: não concluído formalmente (sem situação calculada também conta como em curso). */
export function isActive(row: Pick<Row, "status">) {
  return row.status !== "CONCLUIDO";
}

export function dashboardIndicators(rows: ReadonlyArray<Pick<Row, "status">>) {
  const counts = countByStatus(rows);
  return DASHBOARD_INDICATORS.map((indicator) => {
    const value = indicator.key === "total" ? rows.length : (counts.get(indicator.key) ?? 0);
    return { ...indicator, value, share: rows.length === 0 ? 0 : value / rows.length };
  });
}

/** Distribuição por situação calculada; a fração considera só os projetos com situação conhecida. */
export function statusDistribution(rows: ReadonlyArray<Pick<Row, "status">>) {
  const counts = countByStatus(rows);
  const known = [...counts.values()].reduce((sum, value) => sum + value, 0);
  return {
    known,
    unavailable: rows.length - known,
    segments: STATUS_ORDER.flatMap((status) => {
      const count = counts.get(status) ?? 0;
      return count > 0 ? [{ status, count, share: count / known }] : [];
    }),
  };
}

const ATTENTION_RANK: Partial<Record<ProjectStatus, number>> = { CRITICO: 0, EM_ATENCAO: 1 };

/** Projetos críticos e em atenção: críticos primeiro, depois o maior atraso. */
export function attentionProjects<T extends Row>(rows: ReadonlyArray<T>, limit = 6) {
  const list = rows
    .filter((row) => row.status !== null && ATTENTION_RANK[row.status] !== undefined)
    .sort(
      (left, right) =>
        (ATTENTION_RANK[left.status as ProjectStatus] ?? 9) - (ATTENTION_RANK[right.status as ProjectStatus] ?? 9) ||
        (right.situation?.delayDays ?? 0) - (left.situation?.delayDays ?? 0) ||
        left.name.localeCompare(right.name, "pt-BR"),
    );
  return { total: list.length, items: list.slice(0, limit) };
}

export type SupplierLoad = { name: string; total: number; critical: number; attention: number };

/** Projetos em curso por fornecedor (um projeto com dois fornecedores conta para os dois). */
export function supplierLoad(rows: ReadonlyArray<Pick<Row, "status" | "suppliers">>, limit = 6) {
  const active = rows.filter(isActive);
  const bySupplier = new Map<string, SupplierLoad>();
  for (const row of active) {
    for (const name of row.suppliers ?? []) {
      const current = bySupplier.get(name) ?? { name, total: 0, critical: 0, attention: 0 };
      current.total += 1;
      if (row.status === "CRITICO") current.critical += 1;
      if (row.status === "EM_ATENCAO") current.attention += 1;
      bySupplier.set(name, current);
    }
  }
  const sorted = [...bySupplier.values()].sort(
    (left, right) =>
      right.total - left.total || right.critical - left.critical || left.name.localeCompare(right.name, "pt-BR"),
  );
  return {
    items: sorted.slice(0, limit),
    hidden: Math.max(0, sorted.length - limit),
    max: sorted[0]?.total ?? 0,
    withoutSupplier: active.filter((row) => row.suppliers !== null && row.suppliers.length === 0).length,
    unavailable: active.filter((row) => row.suppliers === null).length,
  };
}

/** Diferença em dias entre dois dias civis (AAAA-MM-DD); positivo quando `to` é depois de `from`. */
export function daysBetween(from: string, to: string) {
  const parse = (value: string) => {
    const [year, month, day] = value.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((parse(to) - parse(from)) / 86_400_000);
}

export function relativeDayLabel(days: number) {
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days === -1) return "Ontem";
  return days > 0 ? `Em ${days} dias` : `Há ${-days} dias`;
}

export type UpcomingMilestone = PortfolioMilestone & { projectId: string; projectName: string; daysUntil: number };

/**
 * Próximos marcos a entregar nos projetos em curso (não suspensos), do mais próximo ao mais distante.
 * Marcos vencidos não entram na lista: são contados à parte, como pendência.
 */
export function upcomingMilestones(rows: ReadonlyArray<Row>, signals: Signals, today: string, limit = 6) {
  const open = rows
    .filter((row) => isActive(row) && row.status !== "SUSPENSO")
    .flatMap((row) =>
      (signals[row.id]?.openMilestones ?? []).map((milestone) => ({
        ...milestone,
        projectId: row.id,
        projectName: row.name,
        daysUntil: daysBetween(today, milestone.plannedOn),
      })),
    );
  const upcoming = open
    .filter((milestone) => !milestone.overdue)
    .sort(
      (left, right) =>
        left.plannedOn.localeCompare(right.plannedOn) || left.projectName.localeCompare(right.projectName, "pt-BR"),
    );
  return { items: upcoming.slice(0, limit), total: upcoming.length, overdue: open.length - upcoming.length };
}

/** Pendências somadas dos projetos em curso; projetos sem monitoramento consultável são contados à parte. */
export function portfolioPending(rows: ReadonlyArray<Row>, signals: Signals) {
  const totals = { overdueTasks: 0, overdueMilestones: 0, awaitingHomologation: 0, inCorrections: 0, readyForClosure: 0, unavailable: 0 };
  for (const row of rows.filter(isActive)) {
    const signal = signals[row.id];
    if (!signal) {
      totals.unavailable += 1;
      continue;
    }
    totals.overdueTasks += signal.overdueTasks;
    totals.overdueMilestones += signal.overdueMilestones;
    totals.awaitingHomologation += signal.awaitingHomologation;
    totals.inCorrections += signal.inCorrections;
    if (row.situation?.readyForClosure) totals.readyForClosure += 1;
  }
  return totals;
}

/** Projetos com cadastro atualizado mais recentemente. */
export function recentlyUpdated<T extends Pick<Row, "updatedAt">>(rows: ReadonlyArray<T>, limit = 5) {
  return [...rows].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, limit);
}
