"use client";

import { CalendarRange, Check, PencilLine, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Presence } from "@/components/ui/presence";
import { Skeleton } from "@/components/ui/skeleton";
import { listScheduleHistory } from "@/lib/api/generated/cronograma/cronograma";
import type { GetScheduleMonitoring200 } from "@/lib/api/generated/model/getScheduleMonitoring200";
import type { ListScheduleHistory200 } from "@/lib/api/generated/model/listScheduleHistory200";
import { cn } from "@/lib/utils";

import { DEADLINE_TONE_CLASS, deadlineBadge } from "./deadline-situation";
import { canReschedule, type EapAccess } from "./eap-access";
import { formatCivilDate } from "./eap-date-field";
import { civilDay } from "./eap-deadline";
import type { ScheduleView } from "./eap-present";
import { EapSchedule } from "./eap-schedule";
import { SectionCard } from "./overview-panel";
import { baselineDeviation, buildTimeline, consolidateSchedule, milestoneProgress, timelineMilestones, type PlanningItem } from "./planning-panel";
import { actualProjectRange, daysAgo } from "./cronograma";

type Monitoring = { status: "loading" } | { status: "ready"; data: GetScheduleMonitoring200 } | { status: "error" };
type History = { status: "loading" } | { status: "ready"; data: ListScheduleHistory200 } | { status: "error" };

const plural = (value: number, one: string, many: string) => `${value} ${Math.abs(value) === 1 ? one : many}`;
const shortDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;

const MARK: Record<string, string> = {
  done: "bg-success",
  awaiting: "bg-warning",
  overdue: "bg-destructive",
  pending: "bg-muted-foreground/60",
  next: "bg-primary",
};
const MARK_LABEL: Record<string, string> = { done: "Concluído", awaiting: "Em validação", overdue: "Atrasado", pending: "Pendente", next: "Próximo" };

/**
 * "Prazo e cronograma" da Visão Geral: resumo do planejamento consolidado da EAP (início, prazo vigente, desvio e marcos),
 * linha de base × prazo vigente com os marcos, e o caminho para a página Cronograma. O detalhe das reprogramações e das
 * solicitações fica no Cronograma; aqui só a contagem. Datas do projeto continuam editáveis por quem pode reprogramar.
 */
export function ScheduleSummaryCard({
  projectId,
  monitoring,
  schedule,
  access,
  closed,
  onScheduleSaved,
}: {
  projectId: string;
  monitoring: Monitoring;
  schedule: ScheduleView;
  access: EapAccess;
  closed: boolean;
  onScheduleSaved: () => void;
}) {
  const router = useRouter();
  const data = monitoring.status === "ready" ? monitoring.data : null;
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState<History>({ status: "loading" });
  const today = civilDay(new Date()) ?? "";

  const items = useMemo<PlanningItem[]>(() => data?.items ?? [], [data]);
  const consolidated = useMemo(() => consolidateSchedule(items), [items]);
  const milestones = useMemo(() => timelineMilestones(items), [items]);
  const actual = useMemo(() => actualProjectRange((data?.items ?? []) as never), [data]);
  const timeline = buildTimeline(consolidated, milestones, today);
  const deviation = baselineDeviation(consolidated);
  const progress = milestoneProgress(items);
  const awaiting = items.filter((item) => item.entityType === "MILESTONE" && item.status === "ENTREGUE").length;
  const badge = data ? deadlineBadge(data.deadlineSituation) : null;
  const editable = canReschedule(access);

  useEffect(() => {
    if (!data) return;
    let active = true;
    listScheduleHistory(projectId, { limit: 1, includeInitial: "false" })
      .then((response) => active && setHistory(response.status === 200 ? { status: "ready", data: response.data } : { status: "error" }))
      .catch(() => active && setHistory({ status: "error" }));
    return () => {
      active = false;
    };
  }, [projectId, data]);

  const currentView: ScheduleView = data
    ? {
        single: false,
        plannedStartAt: data.project.plannedStartAt,
        plannedEndAt: data.project.plannedEndAt,
        baselineStartAt: data.project.baselineStartAt,
        baselineEndAt: data.project.baselineEndAt,
        actualStartAt: data.project.actualStartAt,
        actualEndAt: data.project.actualEndAt,
      }
    : schedule;
  const pending = history.status === "ready" ? history.data.counts.requests.pendente : 0;
  const lastAgo = history.status === "ready" ? daysAgo(history.data.lastRescheduleAt, today) : null;

  return (
    <SectionCard
      title="Prazo e cronograma"
      subtitle="Resumo do planejamento consolidado da EAP"
      icon={CalendarRange}
      tone="purple"
      unbounded
      showToggle={false}
      action={
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {badge ? (
            <span data-testid="planning-deadline-situation" title={badge.hint} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", DEADLINE_TONE_CLASS[badge.tone])}>
              {badge.label}
            </span>
          ) : null}
          {editable ? (
            <Button type="button" variant="outline" size="sm" className="gap-1.5" aria-pressed={editing} aria-label={editing ? "Concluir a edição das datas do projeto" : "Editar as datas do projeto"} onClick={() => setEditing((value) => !value)}>
              {editing ? <Check aria-hidden="true" /> : <PencilLine aria-hidden="true" />}
              {editing ? "Concluir" : "Editar datas"}
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={() => router.push(`/projetos/${projectId}?aba=cronograma`)}>
            Abrir cronograma →
          </Button>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs dark:border-border">
          {pending > 0 ? (
            <span className="flex items-center gap-1.5 font-medium text-warning-foreground">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              {plural(pending, "solicitação de reprogramação aguardando análise", "solicitações de reprogramação aguardando análise")}
            </span>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground">
            {data ? plural(data.reschedules.total, "reprogramação", "reprogramações") : ""}
            {lastAgo !== null ? ` · última há ${plural(lastAgo, "dia", "dias")}` : ""}
          </span>
        </div>
      }
    >
      <Presence open={editing}>
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="mb-1 text-xs font-semibold">Datas do projeto</p>
          <p className="mb-3 text-xs text-muted-foreground">
            Planejamento gravado no próprio projeto. A linha de base original é preservada e toda alteração de data exige justificativa e fica no histórico.
          </p>
          <EapSchedule
            projectId={projectId}
            target={{ entityType: "PROJECT" }}
            schedule={currentView}
            state={closed ? "DONE" : "OPEN"}
            closed={closed}
            canReschedule={editable}
            onSaved={async () => onScheduleSaved()}
          />
        </div>
      </Presence>

      {monitoring.status === "loading" ? (
        <Skeleton className="h-32 rounded-lg motion-reduce:animate-none" role="status" aria-label="Carregando o resumo do cronograma" />
      ) : monitoring.status === "error" ? (
        <p role="alert" className="text-xs text-muted-foreground">Não foi possível consultar o cronograma do projeto.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <div className="grid grid-cols-2 gap-2.5">
            <Tile label="Início" value={consolidated.current.start ? formatCivilDate(consolidated.current.start) : "—"} detail={`Real: ${actual.start ? formatCivilDate(actual.start) : "não iniciado"}`} />
            <Tile label="Prazo vigente" value={consolidated.current.end ? formatCivilDate(consolidated.current.end) : "—"} detail={consolidated.baseline.end ? `Linha de base ${formatCivilDate(consolidated.baseline.end)}` : "Sem linha de base"} />
            <Tile
              label="Desvio da linha de base"
              value={deviation === null ? "—" : deviation === 0 ? "Sem desvio" : `${deviation > 0 ? "+" : "−"}${plural(Math.abs(deviation), "dia", "dias")}`}
              valueClass={deviation !== null && deviation > 0 ? "text-warning-foreground" : undefined}
            />
            <Tile label="Marcos concluídos" value={`${progress.done} de ${progress.total}`} detail={awaiting > 0 ? `${awaiting} em validação` : undefined} />
          </div>

          {timeline ? (
            <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-3 self-center text-xs">
              <span className="text-muted-foreground">Linha de base</span>
              <Lane timeline={timeline} range={consolidated.baseline} className="bg-muted-foreground/30" label="Linha de base" />
              <span className="text-muted-foreground">Vigente</span>
              <Lane timeline={timeline} range={consolidated.current} className="bg-primary" label="Prazo vigente" />
              <span className="text-muted-foreground">Marcos</span>
              <div className="relative h-5">
                {milestones.map((milestone) => {
                  const kind = milestone.state === "pending" && milestone.next ? "next" : milestone.state;
                  return (
                    <span
                      key={milestone.id}
                      role="img"
                      aria-label={`${milestone.title}, ${formatCivilDate(milestone.day)}: ${MARK_LABEL[kind]}${milestone.rescheduled ? ", reprogramado" : ""}`}
                      title={`${milestone.title} · ${formatCivilDate(milestone.day)} · ${MARK_LABEL[kind]}`}
                      className={cn("absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45", MARK[kind])}
                      style={{ left: `${timeline.position(milestone.day)}%` }}
                    />
                  );
                })}
                {timeline.today !== null ? <span aria-hidden="true" className="absolute inset-y-0 border-l border-dashed border-foreground/60" style={{ left: `${timeline.today}%` }} /> : null}
              </div>
              <span />
              <div className="relative h-4 text-[11px] text-muted-foreground">
                <span className="absolute left-0">{shortDay(timeline.from)}</span>
                {consolidated.baseline.end && timeline.position(consolidated.baseline.end) < 68 ? (
                  <span className="absolute -translate-x-full whitespace-nowrap" style={{ left: `${timeline.position(consolidated.baseline.end)}%` }}>
                    {shortDay(consolidated.baseline.end)} · linha de base
                  </span>
                ) : null}
                <span className="absolute right-0 whitespace-nowrap">{shortDay(timeline.to)} · prazo vigente</span>
              </div>
            </div>
          ) : (
            <p className="self-center text-xs text-muted-foreground">Nenhuma tarefa ou marco com data planejada. O cronograma aparece quando houver compromissos datados.</p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function Tile({ label, value, detail, valueClass }: { label: string; value: string; detail?: string; valueClass?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border bg-card px-3.5 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg leading-tight font-bold tracking-[-0.01em] text-foreground dark:text-foreground", valueClass)}>{value}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function Lane({ timeline, range, className, label }: { timeline: NonNullable<ReturnType<typeof buildTimeline>>; range: { start: string | null; end: string | null }; className: string; label: string }) {
  if (!range.start && !range.end) return <span className="text-[11px] text-muted-foreground">Não definida</span>;
  const start = timeline.position((range.start ?? range.end) as string);
  const end = timeline.position((range.end ?? range.start) as string);
  return (
    <div className="relative h-2.5 rounded-full bg-track" title={`${label}: ${formatCivilDate((range.start ?? range.end) as string)} a ${formatCivilDate((range.end ?? range.start) as string)}`}>
      <span className={cn("absolute inset-y-0 rounded-full", className)} style={{ left: `${start}%`, width: `${Math.max(end - start, 1.5)}%` }} />
    </div>
  );
}
