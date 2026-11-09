"use client";

import { CalendarRange, Check, ChevronDown, CircleCheck, CircleDot, Circle, OctagonAlert, PencilLine, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { type ProjectDetail, type ScheduleView } from "./eap-present";
import { EapSchedule } from "./eap-schedule";
import { SectionCard } from "./overview-panel";
import {
  HISTORY_ENTITY_LABEL,
  HISTORY_STATUS,
  headlineChange,
  historyCount,
  historyDelta,
  isEffective,
  personName,
  reviewerText,
  type HistoryItem,
} from "./schedule-history";
import {
  baselineDeviation,
  buildTimeline,
  completeness,
  consolidateSchedule,
  daysBetween,
  doneLateCount,
  milestoneProgress,
  projectPlanDivergence,
  requiredFields,
  timelineMilestones,
  type MilestoneState,
  type PlanningItem,
  type RequiredField,
} from "./planning-panel";

type Monitoring = { status: "loading" } | { status: "ready"; data: GetScheduleMonitoring200 } | { status: "error" };

export type PlanningContext = {
  /** Texto publicado de cada campo; null enquanto carrega ou se não foi possível carregar. */
  texts: { PROBLEM: string | null; PURPOSE: string | null; SCOPE: string | null } | null;
  /** Bloco de leitura e edição do contexto (Problema, Finalidade e Escopo), já existente. */
  node: React.ReactNode;
};

type History = { status: "loading" } | { status: "ready"; data: ListScheduleHistory200 } | { status: "error" };

const PREVIEW = 3;
/** Máximo aceito pela API por consulta; com mais registros, mostra os mais recentes e avisa. */
const FULL_LIMIT = 200;

const day = (value: string | null) => (value ? formatCivilDate(civilDay(value) ?? "") : "Não informada");
const dayTime = (value: string) =>
  new Date(value).toLocaleString("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const plural = (value: number, one: string, many: string) => `${value} ${Math.abs(value) === 1 ? one : many}`;
const monthLabel = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)).replace(" de ", "/").replace(". ", "/").replace(".", "");

/**
 * Painel de Planejamento da Visão Geral: preenchimento dos campos obrigatórios, situação do prazo, indicadores,
 * cronograma (linha de base × prazo vigente × marcos), últimas reprogramações, contexto e participantes. Tudo vem de dados
 * existentes (monitoramento, auditoria de reprogramações, perfil e participantes); nada é estimado nem ilustrativo.
 */
export function PlanningPanel({
  projectId,
  monitoring,
  schedule,
  members,
  context,
  access,
  closed,
  onScheduleSaved,
}: {
  projectId: string;
  monitoring: Monitoring;
  /** Planejamento gravado no próprio projeto (formulário de edição de datas). */
  schedule: ScheduleView;
  members: ProjectDetail["members"];
  context: PlanningContext;
  access: EapAccess;
  closed: boolean;
  onScheduleSaved: () => void;
}) {
  const data = monitoring.status === "ready" ? monitoring.data : null;
  const [editing, setEditing] = useState(false);
  const today = civilDay(new Date()) ?? "";

  const items = useMemo<PlanningItem[]>(() => data?.items ?? [], [data]);
  const consolidated = useMemo(() => consolidateSchedule(items), [items]);
  const milestones = useMemo(() => timelineMilestones(items), [items]);
  const deviation = baselineDeviation(consolidated);
  const progress = milestoneProgress(items);
  const divergence = data ? projectPlanDivergence(data.project, consolidated) : null;
  const badge = data ? deadlineBadge(data.deadlineSituation) : null;

  const fields = requiredFields({
    context: context.texts,
    schedule: data ? { milestonesWithDate: milestones.length, hasCurrentEnd: consolidated.current.end !== null } : null,
    members,
  });
  const fill = completeness(fields);

  const history = useScheduleHistory(projectId, data ? data.reschedules.total : null);
  const editable = canReschedule(access);

  // Âncora #cronograma (por exemplo, "Consultar cronograma" na lista de projetos): rola até o cronograma depois de o layout
  // assentar e, se a pessoa não rolou nesse meio tempo, confirma a posição uma segunda vez. Respeita movimento reduzido.
  useEffect(() => {
    const timers: number[] = [];
    let touched = false;
    const markTouched = () => {
      touched = true;
    };
    const reveal = () => {
      if (window.location.hash !== "#cronograma") {
        return;
      }
      touched = false;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const go = (smooth: boolean) =>
        document.getElementById("cronograma")?.scrollIntoView({ behavior: smooth && !reduced ? "smooth" : "auto", block: "start" });
      timers.push(
        window.setTimeout(() => go(true), 350),
        window.setTimeout(() => {
          if (!touched) {
            go(false);
          }
        }, 1400),
      );
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    window.addEventListener("popstate", reveal);
    window.addEventListener("wheel", markTouched, { passive: true });
    window.addEventListener("touchmove", markTouched, { passive: true });
    window.addEventListener("keydown", markTouched);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("hashchange", reveal);
      window.removeEventListener("popstate", reveal);
      window.removeEventListener("wheel", markTouched);
      window.removeEventListener("touchmove", markTouched);
      window.removeEventListener("keydown", markTouched);
    };
  }, []);

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

  return (
    <SectionCard
      title="Planejamento"
      subtitle="Cronograma, escopo e responsáveis: o que foi planejado e os compromissos assumidos."
      icon={CalendarRange}
      tone="purple"
      unbounded
      showToggle={false}
      action={
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <FillMeter fields={fields} fill={fill} />
          {monitoring.status === "loading" ? (
            <Skeleton className="h-6 w-20 rounded-full motion-reduce:animate-none" role="status" aria-label="Carregando a situação do prazo" />
          ) : badge ? (
            <span data-testid="planning-deadline-situation">
              <span title={badge.hint} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", DEADLINE_TONE_CLASS[badge.tone])}>
                {badge.label}
              </span>
            </span>
          ) : null}
          {editable ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              aria-pressed={editing}
              aria-label={editing ? "Concluir a edição das datas do projeto" : "Editar as datas do projeto"}
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? <Check aria-hidden="true" /> : <PencilLine aria-hidden="true" />}
              {editing ? "Concluir" : "Editar"}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="flex flex-col gap-4">
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

        <PendingNotice fields={fields} />

        <Indicators
          monitoring={monitoring}
          today={today}
          current={consolidated.current.end}
          baselineEnd={consolidated.baseline.end}
          deviation={deviation}
          total={data?.reschedules.total ?? null}
          lastAt={history.status === "ready" ? history.data.lastRescheduleAt : null}
          lastLoading={history.status === "loading"}
          progress={progress}
          items={items}
          divergence={divergence}
          escalated={data?.reschedules.escalated ?? 0}
          doneLate={doneLateCount(items)}
        />

        <div className="grid gap-5 border-t pt-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <TimelineBlock monitoring={monitoring} consolidated={consolidated} milestones={milestones} today={today} deviation={deviation} />
          <ScheduleHistoryBlock history={history} projectId={projectId} />
        </div>

        <div id="planejamento-contexto" className="grid scroll-mt-6 gap-5 border-t pt-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <section aria-label="Contexto e planejamento" className="min-w-0">
            <h3 className="text-sm font-semibold">Contexto e planejamento</h3>
            <p className="mb-3 text-xs text-muted-foreground">Por que o projeto existe e até onde ele vai.</p>
            {context.node}
          </section>
          <Participants members={members} />
        </div>
      </div>
    </SectionCard>
  );
}

/** Histórico unificado do cronograma (mais recentes, sem definições iniciais); recarrega quando o total do monitoramento muda. */
function useScheduleHistory(projectId: string, total: number | null) {
  const [state, setState] = useState<History>({ status: "loading" });
  useEffect(() => {
    if (total === null) {
      return;
    }
    let active = true;
    listScheduleHistory(projectId, { limit: PREVIEW, includeInitial: "false" })
      .then((response) => active && setState(response.status === 200 ? { status: "ready", data: response.data } : { status: "error" }))
      .catch(() => active && setState({ status: "error" }));
    return () => {
      active = false;
    };
  }, [projectId, total]);
  return total === null ? ({ status: "loading" } as History) : state;
}

function FillMeter({ fields, fill }: { fields: RequiredField[]; fill: ReturnType<typeof completeness> }) {
  const unknown = fields.some((field) => field.state === "unknown");
  return (
    <div className="flex min-w-0 flex-col gap-1" title={fields.map((field) => `${field.label}: ${field.criterion}`).join("\n")}>
      <p className="flex items-baseline gap-2 text-xs text-muted-foreground">
        Preenchimento
        <span className="font-semibold text-foreground">
          {unknown ? "Indisponível" : `${fill.filled} de ${fill.total} campos · ${fill.percent}%`}
        </span>
      </p>
      <div
        role="meter"
        aria-label="Preenchimento dos campos obrigatórios do planejamento"
        aria-valuemin={0}
        aria-valuemax={fill.total}
        aria-valuenow={fill.filled}
        className="flex gap-1"
      >
        {fields.map((field) => (
          <span
            key={field.id}
            aria-hidden="true"
            className={cn("h-1 w-5 rounded-full transition-colors duration-200 motion-reduce:transition-none", field.state === "filled" ? "bg-primary" : "bg-muted")}
          />
        ))}
      </div>
    </div>
  );
}

function PendingNotice({ fields }: { fields: RequiredField[] }) {
  const pending = fields.filter((field) => field.state === "pending");
  const structural = fields.filter((field) => field.state === "structural");
  const unknown = fields.some((field) => field.state === "unknown");
  if (pending.length === 0 && structural.length === 0 && !unknown) {
    return null;
  }
  const contextPending = pending.some((field) => ["PROBLEM", "PURPOSE", "SCOPE"].includes(field.id));
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
      <p className="min-w-0">
        {pending.length > 0 ? (
          <>
            <strong className="font-semibold">Falta definir:</strong> {pending.map((field) => field.label.toLowerCase()).join(", ")}.{" "}
          </>
        ) : null}
        {structural.length > 0 ? (
          <span className="text-muted-foreground">
            {structural.map((field) => field.label).join(", ")}: pendente de implementação estrutural (o papel ainda não existe no sistema).
          </span>
        ) : null}
        {unknown ? <span className="text-muted-foreground"> Alguns campos não puderam ser verificados.</span> : null}
      </p>
      {contextPending ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => document.getElementById("planejamento-contexto")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" })}
        >
          Completar agora →
        </Button>
      ) : null}
    </div>
  );
}

function Tile({ label, children, detail }: { label: string; children: React.ReactNode; detail?: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border bg-card px-3.5 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="truncate text-xl leading-tight font-semibold tracking-tight">{children}</div>
      <div className="min-h-4 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function Indicators({
  monitoring,
  today,
  current,
  baselineEnd,
  deviation,
  total,
  lastAt,
  lastLoading,
  progress,
  items,
  divergence,
  escalated,
  doneLate,
}: {
  monitoring: Monitoring;
  escalated: number;
  doneLate: number;
  today: string;
  current: string | null;
  baselineEnd: string | null;
  deviation: number | null;
  total: number | null;
  lastAt: string | null;
  lastLoading: boolean;
  progress: { done: number; total: number };
  items: PlanningItem[];
  divergence: ReturnType<typeof projectPlanDivergence>;
}) {
  if (monitoring.status === "loading") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="status" aria-label="Carregando os indicadores do planejamento">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-22 rounded-lg motion-reduce:animate-none" />
        ))}
      </div>
    );
  }
  if (monitoring.status === "error") {
    return <p role="alert" className="text-xs text-muted-foreground">Não foi possível consultar os indicadores do planejamento.</p>;
  }

  const remaining = current ? daysBetween(today, current) : null;
  const lastDays = lastAt ? daysBetween(civilDay(lastAt) ?? today, today) : null;
  const next = timelineMilestones(items).find((milestone) => milestone.next);
  const overdueMilestones = timelineMilestones(items).filter((milestone) => milestone.state === "overdue");
  const awaitingCount = items.filter((item) => item.entityType === "MILESTONE" && item.status === "ENTREGUE").length;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        label="Prazo vigente"
        detail={
          current === null
            ? "Sem tarefas ou marcos com data planejada."
            : remaining === null
              ? null
              : remaining >= 0
                ? `Faltam ${plural(remaining, "dia", "dias")}`
                : `Venceu há ${plural(-remaining, "dia", "dias")}`
        }
      >
        {current ? formatCivilDate(current) : <span className="text-muted-foreground">Não definido</span>}
      </Tile>
      <Tile
        label="Desvio da linha de base"
        detail={
          deviation === null ? (
            baselineEnd === null ? "Sem linha de base registrada." : "Sem prazo vigente para comparar."
          ) : (
            <span className={deviation > 0 ? "text-warning-foreground" : undefined}>Linha de base: {formatCivilDate(baselineEnd as string)}</span>
          )
        }
      >
        {deviation === null ? (
          <span className="text-muted-foreground">Indisponível</span>
        ) : deviation === 0 ? (
          "Sem desvio"
        ) : (
          `${deviation > 0 ? "+" : "−"}${plural(Math.abs(deviation), "dia", "dias")}`
        )}
      </Tile>
      <Tile
        label="Reprogramações"
        detail={
          total === 0
            ? "Nenhuma reprogramação efetivada."
            : lastLoading
              ? <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
              : lastDays === null
                ? null
                : lastDays === 0
                  ? "Última hoje"
                  : `Última há ${plural(lastDays, "dia", "dias")}`
        }
      >
        {total ?? "Indisponível"}
      </Tile>
      <Tile
        label="Marcos concluídos"
        detail={
          progress.total === 0
            ? "Nenhum marco cadastrado."
            : [
                overdueMilestones.length > 0 ? `Atrasado: ${overdueMilestones.map((milestone) => milestone.title).join(", ")}` : null,
                next ? `Próximo: ${next.title}, ${formatCivilDate(next.day)}` : null,
                awaitingCount > 0 ? `${awaitingCount} em validação` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Nenhum marco a entregar."
        }
      >
        {progress.total === 0 ? <span className="text-muted-foreground">—</span> : `${progress.done} de ${progress.total}`}
      </Tile>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground sm:col-span-2 xl:col-span-4" aria-label="Indicadores complementares de prazo">
        <div className="flex items-baseline gap-1.5" title="Reprogramações sinalizadas ao PMO (escalonadas) no histórico de auditoria">
          <dd className="text-sm font-semibold text-foreground" data-testid="planning-escalated">{escalated}</dd>
          <dt>{escalated === 1 ? "sinalizada ao PMO" : "sinalizadas ao PMO"}</dt>
        </div>
        <div className="flex items-baseline gap-1.5" title="Atrasos históricos: itens (fases, tarefas e marcos) já concluídos depois do prazo vigente. Não inclui os que ainda estão em atraso.">
          <dd className="text-sm font-semibold text-foreground" data-testid="planning-done-late">{doneLate}</dd>
          <dt>{doneLate === 1 ? "item concluído com atraso" : "itens concluídos com atraso"}</dt>
        </div>
      </dl>
      {divergence ? (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground sm:col-span-2 xl:col-span-4" role="note">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" aria-hidden="true" />
          O planejamento gravado no próprio projeto difere das datas consolidadas das tarefas e marcos. Os indicadores acima usam as datas consolidadas; o planejamento do projeto só muda por reprogramação justificada.
        </p>
      ) : null}
    </div>
  );
}

const STATE_META: Record<MilestoneState | "next", { label: string; icon: typeof Circle; className: string }> = {
  done: { label: "Concluído", icon: CircleCheck, className: "text-primary" },
  awaiting: { label: "Em validação", icon: CircleCheck, className: "text-info-foreground" },
  next: { label: "Próximo", icon: CircleDot, className: "text-primary" },
  pending: { label: "Pendente", icon: Circle, className: "text-muted-foreground" },
  overdue: { label: "Atrasado", icon: OctagonAlert, className: "text-destructive" },
};

function TimelineBlock({
  monitoring,
  consolidated,
  milestones,
  today,
  deviation,
}: {
  monitoring: Monitoring;
  consolidated: ReturnType<typeof consolidateSchedule>;
  milestones: ReturnType<typeof timelineMilestones>;
  today: string;
  deviation: number | null;
}) {
  const timeline = buildTimeline(consolidated, milestones, today);
  return (
    <section id="cronograma" aria-label="Cronograma" className="min-w-0 scroll-mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-semibold">
          Cronograma <span className="ml-1 text-xs font-normal text-muted-foreground">Linha de base × prazo vigente</span>
        </h3>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Legenda dos marcos">
          {(["done", "next", "pending", "overdue"] as const).map((key) => {
            const meta = STATE_META[key];
            return (
              <li key={key} className="flex items-center gap-1">
                <meta.icon className={cn("size-3", meta.className)} aria-hidden="true" />
                {meta.label}
              </li>
            );
          })}
        </ul>
      </div>

      {monitoring.status === "loading" ? (
        <Skeleton className="mt-3 h-36 rounded-lg motion-reduce:animate-none" role="status" aria-label="Carregando o cronograma" />
      ) : monitoring.status === "error" ? (
        <p role="alert" className="mt-3 text-xs text-muted-foreground">Não foi possível consultar o cronograma.</p>
      ) : !timeline ? (
        <p className="mt-3 text-xs text-muted-foreground">Nenhuma tarefa ou marco com data planejada. O cronograma aparece quando houver compromissos datados.</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 text-xs">
            <span />
            <div className="relative h-5 text-[11px] text-muted-foreground">
              <span className="absolute left-0">{monthLabel(timeline.from)}</span>
              <span className="absolute right-0">{monthLabel(timeline.to)}</span>
              {timeline.today !== null ? (
                <span
                  className="absolute -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background"
                  style={{ left: `${timeline.today}%` }}
                >
                  Hoje
                </span>
              ) : null}
            </div>

            <span className="text-muted-foreground">Linha de base</span>
            <Bar timeline={timeline} range={consolidated.baseline} className="bg-muted-foreground/30" label="Linha de base" hint={deviation !== null && deviation !== 0 ? `${deviation > 0 ? "+" : "−"}${plural(Math.abs(deviation), "dia", "dias")} de desvio` : null} />

            <span className="text-muted-foreground">Vigente</span>
            <Bar timeline={timeline} range={consolidated.current} className="bg-primary" label="Prazo vigente" hint={null} />

            <span className="text-muted-foreground">Marcos</span>
            <div className="relative h-6">
              {milestones.map((milestone) => {
                const meta = STATE_META[milestone.state === "pending" && milestone.next ? "next" : milestone.state];
                return (
                  <span
                    key={milestone.id}
                    role="img"
                    aria-label={`${milestone.title}, ${formatCivilDate(milestone.day)}: ${meta.label}${milestone.rescheduled ? ", reprogramado" : ""}`}
                    title={`${milestone.title} · ${formatCivilDate(milestone.day)} · ${meta.label}${milestone.rescheduled ? " · reprogramado" : ""}`}
                    className="absolute top-0.5 -translate-x-1/2"
                    style={{ left: `${timeline.position(milestone.day)}%` }}
                  >
                    <meta.icon className={cn("size-4", meta.className)} aria-hidden="true" />
                    {milestone.rescheduled ? <span className="absolute -top-0.5 -right-1 size-1.5 rounded-full bg-warning" aria-hidden="true" /> : null}
                  </span>
                );
              })}
              {timeline.today !== null ? (
                <span aria-hidden="true" className="absolute inset-y-0 border-l border-dashed border-foreground/60" style={{ left: `${timeline.today}%` }} />
              ) : null}
            </div>
          </div>

          <ul className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            {milestones.map((milestone) => {
              const meta = STATE_META[milestone.state === "pending" && milestone.next ? "next" : milestone.state];
              return (
                <li key={milestone.id} className="flex min-w-0 items-center gap-1.5">
                  <meta.icon className={cn("size-3.5 shrink-0", meta.className)} aria-hidden="true" />
                  <span className="truncate font-medium">{milestone.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {formatCivilDate(milestone.day)} · {meta.label}
                    {milestone.rescheduled ? " · reprogramado" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Consolidado de tarefas e marcos ({plural(consolidated.commitments, "compromisso datado", "compromissos datados")}); fases e datas reais de execução não entram.
          </p>
        </div>
      )}
    </section>
  );
}

function Bar({
  timeline,
  range,
  className,
  label,
  hint,
}: {
  timeline: NonNullable<ReturnType<typeof buildTimeline>>;
  range: { start: string | null; end: string | null };
  className: string;
  label: string;
  hint: string | null;
}) {
  if (!range.start && !range.end) {
    return <span className="text-[11px] text-muted-foreground">Não definida</span>;
  }
  const start = timeline.position((range.start ?? range.end) as string);
  const end = timeline.position((range.end ?? range.start) as string);
  return (
    <div className="relative h-2.5 rounded-full bg-muted/40" title={`${label}: ${formatCivilDate((range.start ?? range.end) as string)} a ${formatCivilDate((range.end ?? range.start) as string)}`}>
      <span className={cn("absolute inset-y-0 rounded-full", className)} style={{ left: `${start}%`, width: `${Math.max(end - start, 1.5)}%` }} />
      {hint ? (
        <span className="absolute top-1/2 ml-2 -translate-y-1/2 text-[11px] font-medium whitespace-nowrap text-warning-foreground" style={{ left: `${end}%` }}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

function ScheduleHistoryBlock({ history, projectId }: { history: History; projectId: string }) {
  const [showAll, setShowAll] = useState(false);
  const [all, setAll] = useState<History | null>(null);
  const total = history.status === "ready" ? historyCount(history.data.counts) : 0;
  const pending = history.status === "ready" ? history.data.counts.requests.pendente : 0;

  function toggle() {
    const next = !showAll;
    setShowAll(next);
    if (next && all?.status !== "ready") {
      setAll({ status: "loading" });
      listScheduleHistory(projectId, { limit: FULL_LIMIT })
        .then((response) => setAll(response.status === 200 ? { status: "ready", data: response.data } : { status: "error" }))
        .catch(() => setAll({ status: "error" }));
    }
  }

  return (
    <section aria-label="Reprogramações e solicitações" className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold">Reprogramações e solicitações</h3>
        {total > PREVIEW ? (
          <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" aria-expanded={showAll} onClick={toggle}>
            {showAll ? "Ver menos" : `Ver todas (${total})`}
          </Button>
        ) : null}
      </div>
      {pending > 0 ? (
        <p
          data-testid="planning-pending-requests"
          title="Solicitações pendentes não alteram o prazo vigente até serem aprovadas."
          className={cn("mt-1.5 w-fit rounded-full px-2 py-0.5 text-[11px] font-medium", DEADLINE_TONE_CLASS.warning)}
        >
          {pending} {pending === 1 ? "solicitação pendente de análise" : "solicitações pendentes de análise"}
        </p>
      ) : null}
      {history.status === "loading" ? (
        <div className="mt-3 flex flex-col gap-2" role="status" aria-label="Carregando as reprogramações">
          <Skeleton className="h-12 rounded-md motion-reduce:animate-none" />
          <Skeleton className="h-12 rounded-md motion-reduce:animate-none" />
        </div>
      ) : history.status === "error" ? (
        <p role="alert" className="mt-3 text-xs text-muted-foreground">Não foi possível consultar as reprogramações.</p>
      ) : total === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">Nenhuma reprogramação ou solicitação registrada. A definição inicial das datas não conta como reprogramação.</p>
      ) : (
        <>
          <Presence open={!showAll}>
            <ScheduleHistoryList items={history.data.data} />
          </Presence>
          <Presence open={showAll}>
            {all?.status === "ready" ? (
              <>
                <ScheduleHistoryList items={all.data.data} />
                {all.data.total > all.data.data.length ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">Mostrando os {all.data.data.length} registros mais recentes de {all.data.total}.</p>
                ) : null}
              </>
            ) : all?.status === "error" ? (
              <p role="alert" className="mt-3 text-xs text-muted-foreground">Não foi possível carregar o histórico completo.</p>
            ) : (
              <Skeleton className="mt-3 h-24 rounded-md motion-reduce:animate-none" role="status" aria-label="Carregando o histórico completo" />
            )}
          </Presence>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Reprogramações efetivadas diretamente (modelo anterior) não têm solicitante nem aprovador registrados. Solicitações pendentes, rejeitadas ou canceladas não alteram o prazo vigente.
          </p>
        </>
      )}
    </section>
  );
}

export function ScheduleHistoryList({ items }: { items: HistoryItem[] }) {
  return (
    <ul className="mt-2 flex flex-col divide-y">
      {items.map((item) => (
        <ScheduleHistoryRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

/** Datas de uma mudança: definição inicial mostra só a data definida; reprogramação mostra anterior → nova. */
function changeText(change: HistoryItem["changes"][number]) {
  return change.kind === "DEFINED" ? `Definida: ${day(change.next)}` : `${day(change.previous)} → ${day(change.next)}`;
}

function ScheduleHistoryRow({ item }: { item: HistoryItem }) {
  const [open, setOpen] = useState(false);
  const status = HISTORY_STATUS[item.status];
  const lead = headlineChange(item);
  const delta = historyDelta(item);
  const type = HISTORY_ENTITY_LABEL[item.entityType] ?? item.entityType;
  const proposed = item.source === "REQUEST" && !isEffective(item);
  const registeredLabel = item.source === "REQUEST" ? "Solicitada por" : item.source === "INITIAL_DEFINITION" ? "Definida por" : "Registrada por";
  const actor =
    item.source === "REQUEST" ? personName(item.requestedBy, "solicitante não registrado") : personName(item.registeredBy, "autor não registrado");
  return (
    <li className="py-2.5" data-source={item.source} data-status={item.status}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {lead ? `${proposed ? "Proposta: " : ""}${changeText(lead)}` : "Datas alteradas"}
              {lead && lead.field === "START" ? <span className="ml-1 text-xs font-normal text-muted-foreground">(início)</span> : null}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {type}
              {item.entityTitle ? ` · ${item.entityTitle}` : ""} · {day(item.occurredAt)} · {registeredLabel} {actor}
            </p>
            <span
              title={status.hint}
              data-testid="history-status"
              className={cn("mt-1 inline-block w-fit rounded-full px-2 py-0.5 text-[10px] font-medium", DEADLINE_TONE_CLASS[status.tone])}
            >
              {status.label}
            </span>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            {delta !== null && delta !== 0 ? (
              <span className={cn("text-xs font-semibold", delta > 0 ? "text-warning-foreground" : "text-success-foreground")}>
                {delta > 0 ? "+" : "−"}{Math.abs(delta)} d
              </span>
            ) : null}
            <CollapsibleTrigger className="group/detail flex items-center gap-1 rounded text-xs text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
              Detalhes
              <ChevronDown className="size-3 transition-transform duration-200 group-data-panel-open/detail:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent>
          <dl className="mt-2 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs">
            {item.changes.map((change) => (
              <Detail key={change.field} label={`${change.field === "END" ? "Término" : "Início"}${proposed ? " (proposto)" : ""}`}>
                {changeText(change)}
              </Detail>
            ))}
            <Detail label="Item">
              {type}
              {item.entityTitle ? ` · ${item.entityTitle}` : ""}
            </Detail>
            <Detail label="Categoria">{item.reasonCategory ?? "Não classificado"}</Detail>
            <Detail label="Justificativa">{item.justification ?? "Justificativa não registrada"}</Detail>
            {item.source === "REQUEST" ? (
              <>
                <Detail label="Solicitante">{personName(item.requestedBy, "Não registrado")}</Detail>
                <Detail label="Solicitado em">{item.requestedAt ? dayTime(item.requestedAt) : "Não registrado"}</Detail>
                <Detail label="Analisado por">{reviewerText(item)}</Detail>
                {item.reviewedAt ? <Detail label="Decisão em">{dayTime(item.reviewedAt)}</Detail> : null}
                {item.decisionNote ? <Detail label="Nota da decisão">{item.decisionNote}</Detail> : null}
              </>
            ) : (
              <>
                <Detail label="Registrado por">{personName(item.registeredBy, "Não registrado")}</Detail>
                <Detail label="Registrado em">{dayTime(item.occurredAt)}</Detail>
                {item.source === "LEGACY_DIRECT" ? (
                  <>
                    <Detail label="Solicitante">Não registrado (modelo anterior)</Detail>
                    <Detail label="Analisado por">{reviewerText(item)}</Detail>
                  </>
                ) : null}
              </>
            )}
            {item.escalatedToPmo ? <Detail label="PMO">Sinalizada ao PMO</Detail> : null}
            <Detail label="Situação">{status.label}</Detail>
            <Detail label="Observação">{status.hint}</Detail>
          </dl>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 wrap-break-word">{children}</dd>
    </>
  );
}

const PARTICIPANT_ROLES = [
  { role: "GESTOR", label: "Gestor" },
  { role: "PATROCINADOR", label: "Patrocinador" },
  { role: "RESPONSAVEL_TECNICO", label: "Responsável técnico" },
  { role: "FORNECEDOR", label: "Fornecedor" },
] as const;

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
}

function Participants({ members }: { members: ProjectDetail["members"] }) {
  return (
    <section aria-label="Participantes" className="min-w-0">
      <h3 className="text-sm font-semibold">Participantes</h3>
      <p className="mb-3 text-xs text-muted-foreground">Responsáveis pelos compromissos do projeto.</p>
      {members === null ? (
        <p role="alert" className="text-xs text-muted-foreground">Não foi possível consultar os participantes.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {PARTICIPANT_ROLES.map(({ role, label }) => {
            const found = members.filter((member) => member.role === role);
            const structural = role === "PATROCINADOR";
            return (
              <li key={role} className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    found.length > 0 ? "bg-[#f4ecfb] text-[#7450bf]" : "border border-dashed text-muted-foreground",
                  )}
                >
                  {found.length > 0 ? initialsOf(found[0].name) : "?"}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {found.length > 0
                      ? [...new Set(found.map((member) => member.name))].join(", ")
                      : structural
                        ? "Não definido · papel ainda não implementado no sistema"
                        : "Não definido"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {members !== null && members.length > 0 ? <AllParticipants members={members} /> : null}
    </section>
  );
}

/** Lista completa de participantes do projeto (todos os papéis), recolhida por padrão. */
function AllParticipants({ members }: { members: NonNullable<ProjectDetail["members"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3 border-t pt-2">
      <CollapsibleTrigger className="group/all flex w-full items-center justify-between gap-2 rounded px-1 py-1.5 text-left text-xs font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        <span>{open ? "Ocultar participantes" : `Ver todos os participantes (${members.length})`}</span>
        <ChevronDown
          className="size-3.5 transition-transform duration-200 group-data-panel-open/all:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul aria-label="Todos os participantes do projeto" className="mt-1 flex flex-col divide-y rounded-md border px-3">
          {members.map((member) => (
            <li key={member.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
              <span className="min-w-0 truncate text-xs font-semibold">{member.name}</span>
              <span className="text-xs text-muted-foreground">
                {member.roleLabel} · {member.email}
              </span>
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
