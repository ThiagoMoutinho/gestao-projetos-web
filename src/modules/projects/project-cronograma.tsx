"use client";

import { ArrowLeft, CalendarRange, History as HistoryIcon, Hourglass, Network } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Presence } from "@/components/ui/presence";
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
import { baselineDeviation, consolidateSchedule, daysBetween } from "./planning-panel";
import { EapSchedule } from "./eap-schedule";
import { ScheduleHistoryList } from "./planning-overview";
import { OVERVIEW_CARD } from "./overview-panel";

/** Mesmo acabamento dos cartões da Visão Geral, com a altura do conteúdo (sem `min-h-full`, que esticava a página). */
const CARD = OVERVIEW_CARD.replace("min-h-full ", "");
import { headlineChange, historyDelta, HISTORY_ENTITY_LABEL, personName } from "./schedule-history";
import { projectStatusKind, projectStatusLabel } from "./project-status";

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
    <div className="flex flex-col gap-[18px]">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">Cronograma do projeto</p>
          <h1 className="truncate text-2xl leading-[1.25] font-semibold tracking-[-0.025em] text-[#172033]">{project.name}</h1>
          <p className="text-[11.5px] text-muted-foreground">
            Planejamento consolidado da EAP · linha de base preservada · toda alteração de prazo exige justificativa
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {status ? <EapStatusBadge kind={projectStatusKind(status)} label={projectStatusLabel(status)} /> : null}
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

      <PlanningDialog
        open={planning}
        onClose={() => setPlanning(false)}
        projectId={project.id}
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
        <Card className={cn(CARD, "p-5")}>
          <div role="alert" className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Não foi possível consultar o cronograma do projeto.</p>
            <Button type="button" size="sm" variant="outline" onClick={retry}>
              Tentar novamente
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <section aria-label="Indicadores do cronograma" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Tile label="Início" loading={!data} value={consolidated.current.start ? formatCivilDate(consolidated.current.start) : "—"} detail={`Real: ${actual.start ? formatCivilDate(actual.start) : "não iniciado"}`} />
            <Tile
              label="Prazo vigente"
              loading={!data}
              value={consolidated.current.end ? formatCivilDate(consolidated.current.end) : "—"}
              detail={
                <>
                  {remaining !== null ? <span className="block">{remaining >= 0 ? `Vence em ${plural(remaining, "dia", "dias")}` : `Venceu há ${plural(-remaining, "dia", "dias")}`}</span> : null}
                  {deadline.kind === "badge" ? (
                    <span title={deadline.badge.hint} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", DEADLINE_TONE_CLASS[deadline.badge.tone])}>
                      {deadline.badge.label}
                    </span>
                  ) : null}
                </>
              }
            />
            <Tile label="Linha de base" loading={!data} value={consolidated.baseline.end ? formatCivilDate(consolidated.baseline.end) : "—"} detail={consolidated.baseline.start ? `Início ${formatCivilDate(consolidated.baseline.start)}` : "Sem linha de base"} />
            <Tile
              label="Desvio da linha de base"
              loading={!data}
              value={deviation === null ? "—" : deviation === 0 ? "Sem desvio" : `${deviation > 0 ? "+" : "−"}${plural(Math.abs(deviation), "dia", "dias")}`}
              valueClass={deviation !== null && deviation > 0 ? "text-warning-foreground" : deviation !== null && deviation < 0 ? "text-success-foreground" : undefined}
              detail={data && data.situation.delayDays > 0 ? `Maior atraso de item: ${plural(data.situation.delayDays, "dia", "dias")}` : "Nenhum item atrasado"}
            />
            <Tile
              label="Reprogramações"
              loading={!data || history.status === "loading"}
              value={String(data?.reschedules.total ?? 0)}
              detail={
                <>
                  {pending.length > 0 ? (
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", DEADLINE_TONE_CLASS.warning)}>{plural(pending.length, "pendente", "pendentes")}</span>
                  ) : null}
                  {lastAgo !== null ? <span className="block">última há {plural(lastAgo, "dia", "dias")}</span> : null}
                </>
              }
            />
          </section>

          <PhaseChart rows={rows} axis={axis} loading={!data} projectName={project.name} onOpenEap={onOpenEap} />

          <div className="grid items-start gap-[18px] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <HistoryCard history={history} onRetry={retry} />
            <div className="flex flex-col gap-[18px]">
              <PendingCard history={history} pending={pending} />
              <DatesCard loading={!data} consolidated={consolidated} actual={actual} recorded={Boolean(data?.project.plannedEndAt)} canDefine={canEditDates} onDefine={() => setPlanning(true)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, detail, loading, valueClass }: { label: string; value: string; detail: React.ReactNode; loading: boolean; valueClass?: string }) {
  return (
    <Card className={cn(CARD, "gap-1 px-4 py-3.5")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-28 motion-reduce:animate-none" role="status" aria-label={`Carregando ${label.toLowerCase()}`} />
      ) : (
        <p className={cn("text-xl font-bold tracking-[-0.01em] text-[#344054] dark:text-foreground", valueClass)}>{value}</p>
      )}
      <div className="min-h-4 text-xs text-muted-foreground">{loading ? null : detail}</div>
    </Card>
  );
}

const BAR_TONE: Record<PhaseRow["tone"], string> = {
  done: "bg-success",
  overdue: "bg-destructive",
  progress: "bg-primary",
  idle: "bg-primary/45",
};

const MARK_TONE: Record<PhaseRow["milestones"][number]["state"], string> = {
  done: "bg-success",
  awaiting: "bg-warning",
  overdue: "bg-destructive",
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

function PhaseChart({ rows, axis, loading, onOpenEap }: { rows: PhaseRow[]; axis: Axis | null; loading: boolean; projectName: string; onOpenEap: () => void }) {
  return (
    <Card className={cn(CARD, "gap-3 p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#EDF0F3] pb-3 dark:border-border">
        <div className="flex items-start gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-[#f4ecfb] text-[#7450bf]" aria-hidden="true">
            <CalendarRange className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-medium">Cronograma por fase</h2>
            <p className="text-xs text-muted-foreground">Barra fina cinza: linha de base · barra grossa: prazo vigente · barra escura: execução real · losango: marco</p>
          </div>
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legenda do cronograma">
          {[
            ["bg-muted-foreground/35", "Linha de base"],
            ["bg-primary", "Em andamento"],
            ["bg-success", "Concluído"],
            ["bg-destructive", "Atrasado"],
            ["bg-warning", "Em validação"],
          ].map(([color, text]) => (
            <li key={text} className="flex items-center gap-1">
              <span className={cn("size-2.5 rounded-sm", color)} aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </div>

      {loading ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Carregando o cronograma por fase">
          <Skeleton className="h-14 rounded-md motion-reduce:animate-none" />
          <Skeleton className="h-14 rounded-md motion-reduce:animate-none" />
          <Skeleton className="h-14 rounded-md motion-reduce:animate-none" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">O projeto ainda não tem fases. Crie as fases na EAP para montar o cronograma.</p>
      ) : !axis ? (
        <p className="text-sm text-muted-foreground">Nenhuma fase, tarefa ou marco tem data planejada. O cronograma aparece quando houver datas.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[13rem_minmax(0,1fr)_3.5rem] items-end gap-x-4 pb-1 text-[11px] text-muted-foreground">
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
            <ul className="divide-y divide-[#EDF0F3] dark:divide-border">
              {rows.map((row) => (
                <li key={row.id} className="grid grid-cols-[13rem_minmax(0,1fr)_3.5rem] items-center gap-x-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {plural(row.tasks, "tarefa", "tarefas")}
                      {row.statusLabel ? ` · ${row.statusLabel.toLowerCase()}` : ""}
                      {row.impediments > 0 ? ` · ${plural(row.impediments, "impedimento", "impedimentos")}` : ""}
                      {row.awaitingMilestones > 0 ? ` · ${plural(row.awaitingMilestones, "marco aguardando validação", "marcos aguardando validação")}` : ""}
                    </p>
                  </div>
                  <div className="relative flex flex-col gap-1 py-1" role="img" aria-label={`${row.name}: linha de base ${row.baseline.end ? `até ${formatCivilDate(row.baseline.end)}` : "não definida"}, prazo vigente ${row.current.end ? `até ${formatCivilDate(row.current.end)}` : "não definido"}`}>
                    <div className="relative h-1">
                      <Lane axis={axis} range={row.baseline} className="bg-muted-foreground/35" label="Linha de base" />
                    </div>
                    <div className="relative h-2.5">
                      <Lane axis={axis} range={row.current} className={BAR_TONE[row.tone]} label="Prazo vigente" />
                    </div>
                    <div className="relative h-1">
                      <Lane axis={axis} range={{ start: row.actual.start, end: row.actual.end ?? (row.actual.start && today(axis) ? today(axis) : row.actual.start) }} className="bg-foreground/70" label="Execução real" />
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

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EDF0F3] pt-3 text-xs dark:border-border">
        <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onOpenEap}>
          Abrir na EAP →
        </Button>
        <span className="text-muted-foreground">Datas reais e progresso vêm da EAP; nada aqui altera datas sem justificativa.</span>
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

const FILTERS: ReadonlyArray<{ id: HistoryFilter; label: string }> = [
  { id: "ALL", label: "Todas" },
  { id: "EFFECTIVE", label: "Efetivadas" },
  { id: "PENDING", label: "Pendentes" },
  { id: "REJECTED", label: "Rejeitadas" },
  { id: "INITIAL", label: "Definição inicial" },
];

function HistoryCard({ history, onRetry }: { history: History; onRetry: () => void }) {
  const [filter, setFilter] = useState<HistoryFilter>("ALL");
  const items = history.status === "ready" ? history.data.data : [];
  const counts = FILTERS.map((entry) => ({ ...entry, count: items.filter((item) => matchesFilter(item, entry.id)).length }));
  const matching = items.filter((item) => matchesFilter(item, filter));
  const [showAll, setShowAll] = useState(false);
  const visible = matching.slice(0, PREVIEW);
  return (
    <Card className={cn(CARD, "gap-3 p-5")}>
      <div className="flex items-start justify-between gap-2 border-b border-[#EDF0F3] pb-3 dark:border-border">
        <div className="flex items-start gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-warning/20 text-warning-foreground" aria-hidden="true">
            <HistoryIcon className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-medium">Reprogramações e solicitações</h2>
            <p className="text-xs text-muted-foreground">Histórico unificado: efetivadas, solicitações e definições iniciais</p>
          </div>
        </div>
        {history.status === "ready" ? <Badge variant="secondary">{items.length} registros</Badge> : null}
      </div>

      {history.status === "loading" ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Carregando o histórico de reprogramações">
          <Skeleton className="h-12 rounded-md motion-reduce:animate-none" />
          <Skeleton className="h-12 rounded-md motion-reduce:animate-none" />
        </div>
      ) : history.status === "error" ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Não foi possível consultar o histórico de reprogramações.</p>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Filtrar histórico" className="flex flex-wrap gap-1.5">
            {counts.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={filter === entry.id}
                onClick={() => {
                  setFilter(entry.id);
                  setShowAll(false);
                }}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none",
                  filter === entry.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {entry.label} ({entry.count})
              </button>
            ))}
          </div>
          {visible.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum registro neste filtro.</p>
          ) : (
            <ScheduleHistoryList items={visible} />
          )}
          <Presence open={showAll && matching.length > PREVIEW}>
            <ScheduleHistoryList items={matching.slice(PREVIEW)} />
          </Presence>
          {matching.length > PREVIEW ? (
            <Button type="button" variant="link" size="sm" className="h-auto w-fit p-0 text-xs" aria-expanded={showAll} onClick={() => setShowAll((value) => !value)}>
              {showAll ? "Ver menos" : `Ver todos (${matching.length}) →`}
            </Button>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Reprogramações efetivadas diretamente (modelo anterior) não têm solicitante nem aprovador registrados. A definição inicial das datas não conta como reprogramação.
          </p>
        </>
      )}
    </Card>
  );
}

function PendingCard({ history, pending }: { history: History; pending: ListScheduleHistory200["data"] }) {
  return (
    <Card className={cn(CARD, "gap-3 p-5")}>
      <div className="flex items-start justify-between gap-2 border-b border-[#EDF0F3] pb-3 dark:border-border">
        <div className="flex items-start gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-warning/20 text-warning-foreground" aria-hidden="true">
            <Hourglass className="size-4" />
          </span>
          <div>
            <h2 className="text-base font-medium">Solicitações aguardando análise</h2>
            <p className="text-xs text-muted-foreground">Propostas não alteram o prazo até a aprovação</p>
          </div>
        </div>
        {history.status === "ready" ? <Badge variant="secondary">{pending.length}</Badge> : null}
      </div>
      {history.status === "loading" ? (
        <Skeleton className="h-16 rounded-md motion-reduce:animate-none" role="status" aria-label="Carregando as solicitações" />
      ) : history.status === "error" ? (
        <p role="alert" className="text-xs text-muted-foreground">Não foi possível consultar as solicitações.</p>
      ) : pending.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma solicitação aguardando análise.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map((item) => {
            const lead = headlineChange(item);
            const delta = lead?.previous && lead.next ? Math.round((Date.parse(lead.next) - Date.parse(lead.previous)) / 86_400_000) : historyDelta(item);
            return (
              <li key={item.id} className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">
                    {HISTORY_ENTITY_LABEL[item.entityType] ?? item.entityType}
                    {item.entityTitle ? ` · ${item.entityTitle}` : ""}
                  </p>
                  <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium", DEADLINE_TONE_CLASS.warning)}>Pendente</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Solicitada por {personName(item.requestedBy, "solicitante não registrado")} · {dayText(item.requestedAt ?? item.occurredAt)}
                </p>
                {lead ? (
                  <p className="mt-1 text-sm">
                    <span className="text-muted-foreground line-through">{dayText(lead.previous)}</span> → <strong>{dayText(lead.next)}</strong>
                    {delta ? <span className="ml-2 text-xs font-semibold text-warning-foreground">{delta > 0 ? "+" : "−"}{Math.abs(delta)} d</span> : null}
                  </p>
                ) : null}
                {item.justification ? <p className="mt-1 text-xs italic">“{item.justification}”</p> : null}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">A análise (aprovar ou rejeitar) ainda não está disponível nesta versão do sistema.</p>
    </Card>
  );
}

function DatesCard({ loading, consolidated, actual, recorded, canDefine, onDefine }: { loading: boolean; consolidated: ReturnType<typeof consolidateSchedule>; actual: ReturnType<typeof actualProjectRange>; recorded: boolean; canDefine: boolean; onDefine: () => void }) {
  const rows = [
    { label: "Início", baseline: consolidated.baseline.start, current: consolidated.current.start, real: actual.start },
    { label: "Término", baseline: consolidated.baseline.end, current: consolidated.current.end, real: actual.end },
  ];
  return (
    <Card className={cn(CARD, "gap-3 p-5")}>
      <div className="border-b border-[#EDF0F3] pb-3 dark:border-border">
        <h2 className="text-base font-medium">Datas do projeto</h2>
        <p className="text-xs text-muted-foreground">Planejado, linha de base e real, consolidados da EAP</p>
      </div>
      {loading ? (
        <Skeleton className="h-20 rounded-md motion-reduce:animate-none" role="status" aria-label="Carregando as datas do projeto" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-1.5 font-normal" />
              <th className="pb-1.5 font-normal">Linha de base</th>
              <th className="pb-1.5 font-normal">Vigente</th>
              <th className="pb-1.5 font-normal">Real</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-[#EDF0F3] dark:border-border">
                <th scope="row" className="py-2 pr-2 text-left font-normal text-muted-foreground">{row.label}</th>
                <td className="py-2">{row.baseline ? formatCivilDate(row.baseline) : "—"}</td>
                <td className="py-2">{row.current ? formatCivilDate(row.current) : "—"}</td>
                <td className="py-2">{row.real ? formatCivilDate(row.real) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {!loading && !recorded ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
          <span>Datas do projeto não gravadas: o consolidado da EAP é a referência.</span>
          {canDefine ? (
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onDefine}>
              Definir
            </Button>
          ) : null}
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">O término real só aparece quando houver conclusão registrada na EAP.</p>
    </Card>
  );
}

/** Definir planejamento: datas gravadas no próprio projeto, com a mesma regra de justificativa e histórico da EAP. */
function PlanningDialog({
  open,
  onClose,
  projectId,
  schedule,
  closed,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  schedule: Parameters<typeof EapSchedule>[0]["schedule"];
  closed: boolean;
  onSaved: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Definir planejamento do projeto</DialogTitle>
          <DialogDescription>
            Datas gravadas no próprio projeto. A linha de base original é preservada e toda alteração de data exige justificativa e fica no histórico.
          </DialogDescription>
        </DialogHeader>
        <EapSchedule
          projectId={projectId}
          target={{ entityType: "PROJECT" }}
          schedule={schedule}
          state={closed ? "DONE" : "OPEN"}
          closed={closed}
          canReschedule
          onSaved={async () => onSaved()}
        />
      </DialogContent>
    </Dialog>
  );
}
