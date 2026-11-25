"use client";

import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  CircleHelp,
  Diamond,
  History as HistoryIcon,
  Hourglass,
  Layers,
  Network,
  PencilLine,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getScheduleMonitoring, listScheduleHistory } from "@/lib/api/generated/cronograma/cronograma";
import type { GetScheduleMonitoring200 } from "@/lib/api/generated/model/getScheduleMonitoring200";
import type { ListScheduleHistory200 } from "@/lib/api/generated/model/listScheduleHistory200";
import { cn } from "@/lib/utils";

import {
  actualProjectRange,
  buildAxis,
  daysAgo,
  matchesFilter,
  phaseRows,
  type Axis,
  type HistoryFilter,
  type PhaseRow,
} from "./cronograma";
import { DEADLINE_TONE_CLASS, deadlineIndicator } from "./deadline-situation";
import { canReschedule, type EapAccess } from "./eap-access";
import { civilDay } from "./eap-deadline";
import { formatCivilDate } from "./eap-date-field";
import type { ProjectDetail } from "./eap-present";
import { EapStatusBadge } from "./eap-status-badge";
import { baselineDeviation, buildTimeline, consolidateSchedule, daysBetween } from "./planning-panel";
import { ScheduleHistoryList } from "./planning-overview";
import { DrawerCard, DrawerCount, DrawerEmpty, DrawerNav, OverviewDetailDrawer } from "./overview-detail-drawer";
import { OVERVIEW_CARD, SECTION_TONE } from "./overview-panel";
import { ProjectPlanningDialog } from "./project-planning-dialog";
import { headlineChange, historyDelta, HISTORY_ENTITY_LABEL, personName } from "./schedule-history";
import { projectStatusKind, projectStatusLabel } from "./project-status";

/** Mesmo acabamento dos cartões da Visão Geral, com a altura do conteúdo (sem `min-h-full`, que esticava a página). */
const CARD = `${OVERVIEW_CARD.replace("min-h-full ", "")} gap-4 p-5`;

type Monitoring = { status: "loading" } | { status: "ready"; data: GetScheduleMonitoring200 } | { status: "error" };
type History = { status: "loading" } | { status: "ready"; data: ListScheduleHistory200 } | { status: "error" };

const dayText = (value: string | null) => (value ? formatCivilDate(civilDay(value) ?? value) : "—");
const plural = (value: number, one: string, many: string) => `${value} ${Math.abs(value) === 1 ? one : many}`;
const shortDay = (day: string) => {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
};

/**
 * Página Cronograma do projeto: indicadores de prazo, barras por fase (linha de base, prazo vigente e execução real), histórico
 * de reprogramações e solicitações. Só leitura: datas mudam por reprogramação justificada na EAP; nada aqui altera prazos.
 */
export function ProjectCronograma({ project, access, onBack, onOpenEap, onSaved }: { project: ProjectDetail; access: EapAccess; onBack: () => void; onOpenEap: () => void; onSaved: () => void }) {
  const [monitoring, setMonitoring] = useState<Monitoring>({ status: "loading" });
  const [history, setHistory] = useState<History>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const today = civilDay(new Date()) ?? "";

  useEffect(() => {
    let active = true;
    getScheduleMonitoring(project.id)
      .then((response) => active && setMonitoring(response.status === 200 ? { status: "ready", data: response.data } : { status: "error" }))
      .catch(() => active && setMonitoring({ status: "error" }));
    listScheduleHistory(project.id, { limit: 200, includeInitial: "true" })
      .then((response) => active && setHistory(response.status === 200 ? { status: "ready", data: response.data } : { status: "error" }))
      .catch(() => active && setHistory({ status: "error" }));
    return () => {
      active = false;
    };
  }, [project.id, attempt]);

  function retry() {
    setMonitoring({ status: "loading" });
    setHistory({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  const data = monitoring.status === "ready" ? monitoring.data : null;
  const consolidated = useMemo(() => consolidateSchedule(data?.items ?? []), [data]);
  const actual = useMemo(() => {
    const range = actualProjectRange(data?.items ?? []);
    return { start: civilDay(data?.project.actualStartAt ?? null) ?? range.start, end: civilDay(data?.project.actualEndAt ?? null) };
  }, [data]);
  const rows = useMemo(
    () =>
      phaseRows(
        (project.phases ?? []).map((phase) => ({
          id: phase.id,
          name: phase.name,
          progressBasisPoints: phase.progressBasisPoints,
          tasks: phase.tasks?.length ?? 0,
          impediments: phase.tasks?.filter((task) => task.hasImpediment).length ?? 0,
          statusLabel: phase.statusLabel,
        })),
        data?.items ?? [],
      ),
    [project.phases, data],
  );
  const axis = useMemo(() => buildAxis(rows, today), [rows, today]);
  const deviation = baselineDeviation(consolidated);
  const status = data?.situation.status ?? null;
  const deadline = deadlineIndicator(monitoring);
  const pending = history.status === "ready" ? history.data.data.filter((item) => item.status === "PENDENTE") : [];
  const lastAgo = history.status === "ready" ? daysAgo(history.data.lastRescheduleAt, today) : null;
  const canEditDates = canReschedule(access);
  const [planning, setPlanning] = useState(false);
  const remaining = consolidated.current.end && today ? daysBetween(today, consolidated.current.end) : null;

  return (
    <div className="@container flex flex-col gap-[18px]">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <span className="mb-[9px] block text-[11px] leading-none font-bold tracking-[0.12em] text-primary uppercase">Cronograma do projeto</span>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl leading-[1.25] font-semibold tracking-[-0.025em] text-foreground">{project.name}</h1>
            {status ? <EapStatusBadge kind={projectStatusKind(status)} label={projectStatusLabel(status)} /> : null}
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground">
            Planejamento consolidado da EAP · linha de base preservada · alteração de prazo exige justificativa
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={onBack}>
            <ArrowLeft aria-hidden="true" /> Visão Geral
          </Button>
          <Button type="button" size="sm" variant={canEditDates ? "outline" : "default"} className="gap-1.5" onClick={onOpenEap}>
            <Network aria-hidden="true" /> Abrir na EAP
          </Button>
          {canEditDates ? (
            <Button type="button" size="sm" onClick={() => setPlanning(true)}>
              Definir planejamento
            </Button>
          ) : null}
        </div>
      </header>

      <ProjectPlanningDialog
        open={planning}
        onClose={() => setPlanning(false)}
        projectId={project.id}
        title="Definir planejamento do projeto"
        schedule={
          data
            ? {
                single: false,
                plannedStartAt: data.project.plannedStartAt,
                plannedEndAt: data.project.plannedEndAt,
                baselineStartAt: data.project.baselineStartAt,
                baselineEndAt: data.project.baselineEndAt,
                actualStartAt: data.project.actualStartAt,
                actualEndAt: data.project.actualEndAt,
              }
            : project.schedule
        }
        closed={project.status === "CONCLUIDO"}
        onSaved={() => {
          onSaved();
          retry();
        }}
      />

      {monitoring.status === "error" ? (
        <Card className={CARD}>
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Não foi possível consultar o cronograma do projeto.</p>
            <Button type="button" size="sm" variant="outline" onClick={retry}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <SummaryCard
            loading={!data}
            historyLoading={history.status === "loading"}
            consolidated={consolidated}
            actual={actual}
            deviation={deviation}
            remaining={remaining}
            deadline={deadline}
            reschedules={data?.reschedules.total ?? 0}
            pending={pending.length}
            lastAgo={lastAgo}
            today={today}
            recorded={Boolean(data?.project.plannedEndAt)}
            canDefine={canEditDates}
            onDefine={() => setPlanning(true)}
          />

          <PhaseChart rows={rows} axis={axis} loading={!data} onOpenEap={onOpenEap} />

          <div className="grid items-stretch gap-[18px] xl:grid-cols-2">
            <HistoryCard history={history} onRetry={retry} />
            <PendingCard history={history} pending={pending} />
          </div>
        </>
      )}
    </div>
  );
}

/** Cabeçalho dos cartões — mesmo chrome do SectionCard da Visão Geral. */
function PanelHeader({
  icon: Icon,
  tone = "purple",
  title,
  subtitle,
  aside,
}: {
  icon: LucideIcon;
  tone?: keyof typeof SECTION_TONE;
  title: string;
  subtitle: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="-mx-5 -mt-5 flex shrink-0 items-start justify-between gap-3 rounded-t-xl border-b border-border/60 bg-muted/30 px-5 pt-5 pb-4 dark:border-border">
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset", SECTION_TONE[tone])} aria-hidden="true">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <p className="text-xs leading-snug text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}

/**
 * Resumo do prazo — mesmo padrão do cartão "Prazo e cronograma" da Visão Geral:
 * quatro indicadores, linha do tempo consolidada e rodapé com ações.
 */
function SummaryCard({
  loading,
  historyLoading,
  consolidated,
  actual,
  deviation,
  remaining,
  deadline,
  reschedules,
  pending,
  lastAgo,
  today,
  recorded,
  canDefine,
  onDefine,
}: {
  loading: boolean;
  historyLoading: boolean;
  consolidated: ReturnType<typeof consolidateSchedule>;
  actual: { start: string | null; end: string | null };
  deviation: number | null;
  remaining: number | null;
  deadline: ReturnType<typeof deadlineIndicator>;
  reschedules: number;
  pending: number;
  lastAgo: number | null;
  today: string;
  recorded: boolean;
  canDefine: boolean;
  onDefine: () => void;
}) {
  const timeline = buildTimeline(
    {
      baseline: {
        start: consolidated.baseline.start ?? actual.start,
        end: consolidated.baseline.end ?? actual.end,
      },
      current: {
        start: consolidated.current.start ?? actual.start,
        end: consolidated.current.end ?? actual.end,
      },
    },
    [],
    today,
  );

  const metrics = [
    {
      label: "Início",
      value: consolidated.current.start ? formatCivilDate(consolidated.current.start) : "—",
      detail: `Real: ${actual.start ? formatCivilDate(actual.start) : "não iniciado"}`,
    },
    {
      label: "Prazo vigente",
      value: consolidated.current.end ? formatCivilDate(consolidated.current.end) : "—",
      detail:
        remaining !== null
          ? remaining >= 0
            ? `Vence em ${plural(remaining, "dia", "dias")}`
            : `Venceu há ${plural(-remaining, "dia", "dias")}`
          : consolidated.baseline.end
            ? `Linha de base ${formatCivilDate(consolidated.baseline.end)}`
            : "Sem prazo vigente",
    },
    {
      label: "Desvio",
      value: deviation === null ? "—" : deviation === 0 ? "Sem desvio" : `${deviation > 0 ? "+" : "−"}${plural(Math.abs(deviation), "dia", "dias")}`,
      detail:
        deviation !== null && deviation > 0
          ? "Em atraso vs. linha de base"
          : deviation !== null && deviation < 0
            ? "Adiantado vs. linha de base"
            : "Comparado à linha de base",
      tone: deviation !== null && deviation > 0 ? ("warning" as const) : undefined,
    },
    {
      label: "Reprogramações",
      value: historyLoading ? "…" : String(reschedules),
      detail: pending > 0 ? plural(pending, "pendente", "pendentes") : lastAgo !== null ? `Última há ${plural(lastAgo, "dia", "dias")}` : "Nenhuma pendente",
      tone: pending > 0 ? ("warning" as const) : undefined,
    },
  ];

  return (
    <Card className={cn(CARD, "flex flex-col")}>
      <PanelHeader
        icon={CalendarRange}
        tone="purple"
        title="Resumo do prazo"
        subtitle="Planejamento consolidado da EAP"
        aside={
          deadline.kind === "badge" ? (
            <span title={deadline.badge.hint} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", DEADLINE_TONE_CLASS[deadline.badge.tone])}>
              {deadline.badge.label}
            </span>
          ) : null
        }
      />

      {loading ? (
        <Skeleton className="h-32 rounded-xl motion-reduce:animate-none" role="status" aria-label="Carregando o resumo do prazo" />
      ) : (
        <div className="flex flex-col gap-3.5">
          <ul aria-label="Resumo do prazo" className="grid grid-cols-2 overflow-hidden rounded-xl bg-muted/35 sm:grid-cols-4 dark:bg-muted/20">
            {metrics.map((item, index) => (
              <li
                key={item.label}
                className={cn(
                  "flex flex-col gap-1 px-3 py-3",
                  index % 2 === 1 && "border-l border-border/50 dark:border-border",
                  index >= 2 && "border-t border-border/50 dark:border-border sm:border-t-0",
                  index > 0 && "sm:border-l sm:border-border/50 dark:sm:border-border",
                )}
              >
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <span
                  className={cn(
                    "text-base leading-tight font-semibold tracking-[-0.01em] tabular-nums",
                    item.tone === "warning" ? "text-status-attention-ink" : "text-foreground",
                  )}
                >
                  {item.value}
                </span>
                <span className="text-[11px] leading-snug text-muted-foreground">{item.detail}</span>
              </li>
            ))}
          </ul>

          {timeline ? (
            <div className="rounded-xl bg-muted/30 px-4 py-4 dark:bg-muted/20">
              <div className="mb-3.5 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Linha do tempo</p>
                  <p className="text-xs text-muted-foreground">Linha de base, prazo vigente e execução real</p>
                </div>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legenda">
                  {[
                    ["bg-muted-foreground/40", "Linha de base"],
                    ["bg-primary", "Prazo vigente"],
                    ["bg-status-running", "Real"],
                  ].map(([tone, label]) => (
                    <li key={label} className="flex items-center gap-1.5">
                      <span className={cn("size-2.5 shrink-0 rounded-sm", tone)} aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3.5 text-xs">
                <span className="text-muted-foreground">Linha de base</span>
                <SummaryLane timeline={timeline} range={consolidated.baseline} className="bg-muted-foreground/40" label="Linha de base" />
                <span className="text-muted-foreground">Vigente</span>
                <SummaryLane timeline={timeline} range={consolidated.current} className="bg-primary" label="Prazo vigente" />
                <span className="text-muted-foreground">Real</span>
                <SummaryLane timeline={timeline} range={actual} className="bg-status-running" label="Execução real" />
                <span />
                <div className="relative h-4 text-[11px] text-muted-foreground">
                  <span className="absolute left-0">{shortDay(timeline.from)}</span>
                  {timeline.today !== null ? (
                    <span className="absolute -translate-x-1/2 whitespace-nowrap text-foreground/80" style={{ left: `${timeline.today}%` }}>
                      Hoje
                    </span>
                  ) : null}
                  <span className="absolute right-0 whitespace-nowrap">{shortDay(timeline.to)}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="rounded-xl bg-muted/30 px-4 py-3.5 text-xs text-muted-foreground dark:bg-muted/20">
              Nenhuma data planejada. O resumo aparece quando houver compromissos datados na EAP.
            </p>
          )}

          {!recorded ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed px-3.5 py-2.5 text-xs text-muted-foreground">
              <span>Datas do projeto ainda não gravadas; o consolidado da EAP é a referência.</span>
              {canDefine ? (
                <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onDefine}>
                  Definir
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border/60 pt-3 dark:border-border">
        <div className="min-w-0 space-y-0.5 text-xs">
          {pending > 0 ? (
            <span className="flex items-center gap-1.5 font-medium text-warning-foreground">
              <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
              {plural(pending, "solicitação aguardando análise", "solicitações aguardando análise")}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {historyLoading ? "Consultando reprogramações…" : plural(reschedules, "reprogramação registrada", "reprogramações registradas")}
              {lastAgo !== null ? ` · última há ${plural(lastAgo, "dia", "dias")}` : ""}
            </span>
          )}
        </div>
        {canDefine ? (
          <Button type="button" variant="outline" size="xs" className="gap-1.5" aria-label="Editar as datas do projeto" onClick={onDefine}>
            <PencilLine aria-hidden="true" />
            Editar datas
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function SummaryLane({
  timeline,
  range,
  className,
  label,
}: {
  timeline: NonNullable<ReturnType<typeof buildTimeline>>;
  range: { start: string | null; end: string | null };
  className: string;
  label: string;
}) {
  if (!range.start && !range.end) return <span className="text-[11px] text-muted-foreground">Não definida</span>;
  const start = timeline.position((range.start ?? range.end) as string);
  const end = timeline.position((range.end ?? range.start) as string);
  return (
    <div className="relative h-2.5 rounded-full bg-track" title={`${label}: ${formatCivilDate((range.start ?? range.end) as string)} a ${formatCivilDate((range.end ?? range.start) as string)}`}>
      <span className={cn("absolute inset-y-0 rounded-full", className)} style={{ left: `${start}%`, width: `${Math.max(end - start, 1.5)}%` }} />
      {timeline.today !== null ? <span aria-hidden="true" className="absolute inset-y-0 border-l border-dashed border-foreground/50" style={{ left: `${timeline.today}%` }} /> : null}
    </div>
  );
}

const BAR_TONE: Record<PhaseRow["tone"], string> = {
  done: "bg-status-done",
  overdue: "bg-status-critical",
  progress: "bg-status-running",
  idle: "bg-status-idle",
};

const MARK_TONE: Record<PhaseRow["milestones"][number]["state"], string> = {
  done: "bg-status-done",
  awaiting: "bg-status-validation",
  overdue: "bg-status-critical",
  pending: "bg-muted-foreground/60",
};

const MARK_LABEL: Record<PhaseRow["milestones"][number]["state"], string> = {
  done: "Concluído",
  awaiting: "Em validação",
  overdue: "Atrasado",
  pending: "Pendente",
};

function Lane({ axis, range, className, label }: { axis: Axis; range: { start: string | null; end: string | null }; className: string; label: string }) {
  if (!range.start && !range.end) return <div className="h-2" aria-hidden="true" />;
  const start = axis.position((range.start ?? range.end) as string);
  const end = axis.position((range.end ?? range.start) as string);
  return (
    <div className="relative h-full" title={`${label}: ${formatCivilDate((range.start ?? range.end) as string)} a ${formatCivilDate((range.end ?? range.start) as string)}`}>
      <span className={cn("absolute inset-y-0 rounded-full", className)} style={{ left: `${start}%`, width: `${Math.max(end - start, 1.2)}%` }} />
    </div>
  );
}

function PhaseChart({ rows, axis, loading, onOpenEap }: { rows: PhaseRow[]; axis: Axis | null; loading: boolean; onOpenEap: () => void }) {
  return (
    <Card className={cn(CARD, "flex flex-col")}>
      <PanelHeader
        icon={Layers}
        tone="blue"
        title="Cronograma por fase"
        subtitle="Linha de base, prazo vigente, execução real e marcos no mesmo eixo"
        aside={
          <ul className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legenda do cronograma">
            {[
              ["bg-muted-foreground/35", "Linha de base"],
              ["bg-status-running", "Em andamento"],
              ["bg-status-done", "Concluído"],
              ["bg-status-critical", "Atrasado"],
              ["bg-status-validation", "Em validação"],
            ].map(([color, text]) => (
              <li key={text} className="flex items-center gap-1.5">
                <span className={cn("size-2.5 rounded-sm", color)} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
        }
      />

      {loading ? (
        <div className="flex flex-col gap-2.5" role="status" aria-label="Carregando o cronograma por fase">
          <Skeleton className="h-14 rounded-xl motion-reduce:animate-none" />
          <Skeleton className="h-14 rounded-xl motion-reduce:animate-none" />
          <Skeleton className="h-14 rounded-xl motion-reduce:animate-none" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl bg-muted/30 px-4 py-3.5 text-sm text-muted-foreground dark:bg-muted/20">O projeto ainda não tem fases. Crie as fases na EAP para montar o cronograma.</p>
      ) : !axis ? (
        <p className="rounded-xl bg-muted/30 px-4 py-3.5 text-sm text-muted-foreground dark:bg-muted/20">Nenhuma fase, tarefa ou marco tem data planejada. O cronograma aparece quando houver datas.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[13rem_minmax(0,1fr)_3.5rem] items-end gap-x-4 pb-2 text-[11px] text-muted-foreground">
              <span>Fase / marco</span>
              <div className="relative h-5">
                {axis.ticks.map((tick) => (
                  <span key={tick.day} className="absolute -translate-x-1/2" style={{ left: `${tick.left}%` }}>
                    {shortDay(tick.day)}
                  </span>
                ))}
                {axis.today !== null ? (
                  <span className="absolute -bottom-1 -translate-x-1/2 rounded bg-foreground px-1 text-[10px] font-semibold text-background" style={{ left: `${axis.today}%` }}>
                    hoje
                  </span>
                ) : null}
              </div>
              <span className="text-right">Progresso</span>
            </div>
            <ul className="divide-y divide-border/60 dark:divide-border">
              {rows.map((row) => (
                <li key={row.id} className="grid grid-cols-[13rem_minmax(0,1fr)_3.5rem] items-center gap-x-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {plural(row.tasks, "tarefa", "tarefas")}
                      {row.statusLabel ? ` · ${row.statusLabel.toLowerCase()}` : ""}
                      {row.impediments > 0 ? ` · ${plural(row.impediments, "impedimento", "impedimentos")}` : ""}
                      {row.awaitingMilestones > 0 ? ` · ${plural(row.awaitingMilestones, "marco aguardando validação", "marcos aguardando validação")}` : ""}
                    </p>
                  </div>
                  <div
                    className="relative flex flex-col gap-1 py-1"
                    role="img"
                    aria-label={`${row.name}: linha de base ${row.baseline.end ? `até ${formatCivilDate(row.baseline.end)}` : "não definida"}, prazo vigente ${row.current.end ? `até ${formatCivilDate(row.current.end)}` : "não definido"}`}
                  >
                    <div className="relative h-1">
                      <Lane axis={axis} range={row.baseline} className="bg-muted-foreground/35" label="Linha de base" />
                    </div>
                    <div className="relative h-2.5">
                      <Lane axis={axis} range={row.current} className={BAR_TONE[row.tone]} label="Prazo vigente" />
                    </div>
                    <div className="relative h-1">
                      <Lane
                        axis={axis}
                        range={{ start: row.actual.start, end: row.actual.end ?? (row.actual.start && today(axis) ? today(axis) : row.actual.start) }}
                        className="bg-foreground/70"
                        label="Execução real"
                      />
                    </div>
                    {row.milestones.map((mark) => (
                      <span
                        key={mark.id}
                        title={`${mark.title} · ${formatCivilDate(mark.day)} · ${MARK_LABEL[mark.state]}${mark.rescheduled ? " · reprogramado" : ""}`}
                        className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 ring-2 ring-card", MARK_TONE[mark.state])}
                        style={{ left: `${axis.position(mark.day)}%` }}
                      />
                    ))}
                    {axis.today !== null ? <span aria-hidden="true" className="absolute inset-y-0 border-l border-dashed border-foreground/50" style={{ left: `${axis.today}%` }} /> : null}
                  </div>
                  <p className="text-right text-sm font-semibold tabular-nums">{row.progressPercent === null ? "—" : `${row.progressPercent}%`}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs dark:border-border">
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onOpenEap}>
          Abrir na EAP →
        </Button>
        <span className="text-muted-foreground">Datas reais e progresso vêm da EAP.</span>
      </div>
    </Card>
  );
}

/** Fim da barra de execução em andamento: o dia de hoje, quando ele cabe no eixo. */
function today(axis: Axis) {
  const now = civilDay(new Date());
  return now && now >= axis.from && now <= axis.to ? now : null;
}

const PREVIEW = 5;

const FILTERS: ReadonlyArray<{ id: HistoryFilter; label: string; icon: LucideIcon }> = [
  { id: "ALL", label: "Todas", icon: Layers },
  { id: "EFFECTIVE", label: "Efetivadas", icon: CheckCircle2 },
  { id: "PENDING", label: "Pendentes", icon: CircleHelp },
  { id: "REJECTED", label: "Rejeitadas", icon: XCircle },
  { id: "INITIAL", label: "Definição inicial", icon: Diamond },
];

function HistoryCard({ history, onRetry }: { history: History; onRetry: () => void }) {
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const items = history.status === "ready" ? history.data.data : [];
  const counts = FILTERS.map((entry) => ({
    ...entry,
    count: items.filter((item) => matchesFilter(item, entry.id)).length,
  }));
  const navItems = counts
    .map((entry) => ({ id: entry.id, label: entry.label, icon: entry.icon, count: entry.count }))
    .filter((item) => item.id === "ALL" || item.id === filter || item.count > 0);
  const matching = items.filter((item) => matchesFilter(item, filter));
  const visible = matching.slice(0, PREVIEW);
  return (
    <>
      <Card className={cn(CARD, "flex h-full flex-col")}>
        <PanelHeader
          icon={HistoryIcon}
          tone="amber"
          title="Reprogramações e solicitações"
          subtitle="Histórico unificado de mudanças de prazo"
          aside={history.status === "ready" ? <Badge variant="secondary">{items.length}</Badge> : null}
        />

        {history.status === "loading" ? (
          <div className="flex flex-col gap-2" role="status" aria-label="Carregando o histórico de reprogramações">
            <Skeleton className="h-12 rounded-xl motion-reduce:animate-none" />
            <Skeleton className="h-12 rounded-xl motion-reduce:animate-none" />
          </div>
        ) : history.status === "error" ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Não foi possível consultar o histórico de reprogramações.</p>
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3.5">
            <div role="tablist" aria-label="Filtrar histórico" className="flex flex-wrap gap-1">
              {navItems.map((entry) => {
                const Icon = entry.icon;
                const active = filter === entry.id;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(entry.id as HistoryFilter)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none",
                      active ? "border-primary/30 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {entry.label}
                    <span className={cn("rounded-full px-1.5 py-px text-label font-semibold", active ? "bg-primary/15" : "bg-muted text-foreground/80")}>
                      {entry.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="min-h-0 flex-1">
              {visible.length === 0 ? (
                <p className="rounded-xl bg-muted/30 px-3.5 py-3 text-xs text-muted-foreground dark:bg-muted/20">Nenhum registro neste filtro.</p>
              ) : (
                <ScheduleHistoryList items={visible} comfortable />
              )}
            </div>

            {matching.length > PREVIEW ? (
              <div className="mt-auto border-t border-border/60 pt-3 dark:border-border">
                <Button type="button" variant="outline" size="xs" onClick={() => setDrawerOpen(true)}>
                  Ver todos ({matching.length})
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Card>

      <OverviewDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Reprogramações e solicitações"
        description="Histórico unificado de mudanças de prazo do projeto."
        icon={HistoryIcon}
        iconClassName={SECTION_TONE.amber}
        eyebrow="Cronograma do projeto"
      >
        <div className="flex flex-col gap-5">
          <DrawerNav
            label="Filtrar histórico por situação"
            active={filter}
            onSelect={(id) => setFilter(id as HistoryFilter)}
            items={navItems}
          />
          <DrawerCard icon={HistoryIcon} title="Registros" aside={<DrawerCount value={matching.length} />}>
            {matching.length === 0 ? (
              <DrawerEmpty>Nenhum registro neste filtro.</DrawerEmpty>
            ) : (
              <ScheduleHistoryList items={matching} comfortable />
            )}
          </DrawerCard>
        </div>
      </OverviewDetailDrawer>
    </>
  );
}

function PendingCard({ history, pending }: { history: History; pending: ListScheduleHistory200["data"] }) {
  return (
    <Card className={cn(CARD, "flex h-full flex-col")}>
      <PanelHeader
        icon={Hourglass}
        tone="amber"
        title="Solicitações aguardando análise"
        subtitle="Propostas que ainda não alteram o prazo"
        aside={history.status === "ready" ? <Badge variant="secondary">{pending.length}</Badge> : null}
      />
      {history.status === "loading" ? (
        <Skeleton className="h-16 rounded-xl motion-reduce:animate-none" role="status" aria-label="Carregando as solicitações" />
      ) : history.status === "error" ? (
        <p role="alert" className="text-xs text-muted-foreground">Não foi possível consultar as solicitações.</p>
      ) : pending.length === 0 ? (
        <div className="flex flex-1 items-center rounded-xl bg-muted/30 px-4 py-8 dark:bg-muted/20">
          <p className="text-sm text-muted-foreground">Nenhuma solicitação aguardando análise.</p>
        </div>
      ) : (
        <ul className="flex flex-1 flex-col gap-2.5">
          {pending.map((item) => {
            const lead = headlineChange(item);
            const delta = lead?.previous && lead.next ? Math.round((Date.parse(lead.next) - Date.parse(lead.previous)) / 86_400_000) : historyDelta(item);
            return (
              <li key={item.id} className="rounded-xl border border-status-attention/30 bg-status-attention-soft/60 p-3.5 text-sm dark:bg-status-attention-soft/20">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-foreground">
                    {HISTORY_ENTITY_LABEL[item.entityType] ?? item.entityType}
                    {item.entityTitle ? ` · ${item.entityTitle}` : ""}
                  </p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", DEADLINE_TONE_CLASS.warning)}>Pendente</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Solicitada por {personName(item.requestedBy, "solicitante não registrado")} · {dayText(item.requestedAt ?? item.occurredAt)}
                </p>
                {lead ? (
                  <p className="mt-1.5 text-sm">
                    <span className="text-muted-foreground line-through">{dayText(lead.previous)}</span> → <strong>{dayText(lead.next)}</strong>
                    {delta ? (
                      <span className="ml-2 text-xs font-semibold text-status-attention-ink">
                        {delta > 0 ? "+" : "−"}
                        {Math.abs(delta)} d
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {item.justification ? <p className="mt-1.5 text-xs text-muted-foreground italic">“{item.justification}”</p> : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-auto pt-2 text-[11px] text-muted-foreground">A análise (aprovar ou rejeitar) ainda não está disponível nesta versão.</p>
    </Card>
  );
}
