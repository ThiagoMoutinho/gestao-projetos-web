"use client";

import { CalendarClock, CalendarDays, CircleDot, Clock, ClipboardList, History, PackageCheck, TriangleAlert, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listScheduleHistory } from "@/lib/api/generated/cronograma/cronograma";
import { listEapAudit, listEapMilestoneDeliveries, listEapTaskImpediments } from "@/lib/api/generated/eap/eap";
import { cn } from "@/lib/utils";

import type { ProjectDetail } from "./eap-present";
import { DrawerCard, DrawerCount, DrawerNav } from "./overview-detail-drawer";
import { SectionCard } from "./overview-panel";
import { nextVisibleCount, TIMELINE_PAGE as TIMELINE_FIRST_PAGE, visibleCount } from "./progressive-list";
import {
  auditEvents,
  deliveryEvents,
  impedimentEvents,
  groupByDay,
  mergeTimeline,
  relativeDay,
  scheduleEvents,
  timelineSource,
  type TimelineEvent,
  type TimelineSource,
  type TimelineTone,
} from "./project-timeline";

type State = { status: "loading" } | { status: "ready"; events: TimelineEvent[]; partial: boolean } | { status: "error" };

/** Marcador do evento: círculo na cor do tom com o ícone da origem. */
const MARK: Record<TimelineTone, string> = {
  danger: "bg-status-critical-soft text-status-critical-ink ring-destructive/25",
  success: "bg-success/15 text-success-foreground ring-success/30",
  warning: "bg-warning/20 text-warning-foreground ring-warning/35",
  info: "bg-primary/10 text-primary ring-primary/25",
  neutral: "bg-muted text-muted-foreground ring-border",
};

const SOURCE_ICON: Record<TimelineSource, LucideIcon> = {
  schedule: CalendarClock,
  delivery: PackageCheck,
  impediment: TriangleAlert,
  audit: ClipboardList,
  other: CircleDot,
};

const PILL: Record<TimelineTone, string> = {
  danger: "bg-status-critical-soft text-status-critical-ink",
  success: "bg-success/15 text-success-foreground",
  warning: "bg-warning/20 text-warning-foreground",
  info: "bg-primary/10 text-primary",
  neutral: "bg-muted text-muted-foreground",
};

/** Busca as fontes reais do projeto em paralelo; uma fonte que falha não derruba as outras (a tela avisa que está incompleta). */
async function loadTimeline(project: ProjectDetail): Promise<Exclude<State, { status: "loading" }>> {
  const phases = project.phases ?? [];
  const milestones = phases.flatMap((phase) => phase.milestones ?? []);
  const tasks = phases.flatMap((phase) => (phase.tasks ?? []).filter((task) => task.hasImpediment));

  const sources = await Promise.allSettled([
    listScheduleHistory(project.id, { limit: 200, includeInitial: "false" }).then((response) =>
      response.status === 200 ? scheduleEvents(response.data.data) : Promise.reject(new Error("schedule")),
    ),
    listEapAudit(project.id, { entityType: "PROJECT", entityId: project.id, limit: 50 }).then((response) =>
      response.status === 200
        ? auditEvents(
            response.data.data.map((item) => ({ id: item.id, summary: item.summary, actorName: item.actorName, createdAt: item.createdAt, kind: item.details.kind })),
          )
        : Promise.reject(new Error("audit")),
    ),
    ...milestones.map((milestone) =>
      listEapMilestoneDeliveries(project.id, milestone.phaseId, milestone.id).then((response) =>
        response.status === 200 ? deliveryEvents(milestone.title, response.data.data) : Promise.reject(new Error("delivery")),
      ),
    ),
    ...tasks.map((task) =>
      listEapTaskImpediments(project.id, task.phaseId, task.id).then((response) =>
        response.status === 200 ? impedimentEvents(task.title, response.data.data) : Promise.reject(new Error("impediment")),
      ),
    ),
  ]);

  const fulfilled = sources.flatMap((source) => (source.status === "fulfilled" ? [source.value] : []));
  if (fulfilled.length === 0) return { status: "error" };
  return { status: "ready", events: mergeTimeline(...fulfilled), partial: fulfilled.length < sources.length };
}

/**
 * Linha do tempo do projeto: reprogramações, entregas e decisões de marcos, impedimentos e auditoria do projeto, do mais
 * recente para o mais antigo. Cada evento vem de um registro real da API, com responsável e data; nada é estimado.
 */
export function ProjectTimelineCard({ project, refreshKey }: { project: ProjectDetail; refreshKey: number }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    loadTimeline(project).then((next) => active && setState(next));
    return () => {
      active = false;
    };
    // O projeto muda de versão (updatedAt) depois de cada decisão; refreshKey cobre as recargas da Visão Geral.
  }, [project.id, project.updatedAt, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const events = state.status === "ready" ? state.events : [];
  const remaining = Math.max(0, events.length - CARD_PREVIEW);
  return (
    <SectionCard
      title="Linha do tempo do projeto"
      subtitle="Reprogramações, decisões de marcos, entregas e impedimentos"
      icon={History}
      tone="purple"
      moreLabel={remaining > 0 ? `Mostrar mais ${remaining}` : `Ver histórico completo (${events.length})`}
      expandable={events.length > CARD_PREVIEW}
      drawer={
        state.status === "ready" && events.length > 0
          ? {
              title: "Linha do tempo do projeto",
              description: "Todos os eventos, do mais recente para o mais antigo; 15 por vez.",
              content: <TimelineDrawerContent events={events} partial={state.partial} />,
            }
          : undefined
      }
      action={state.status === "ready" ? <Badge variant="secondary">{events.length} {events.length === 1 ? "evento" : "eventos"}</Badge> : undefined}
    >
      {state.status === "loading" ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Carregando a linha do tempo">
          <Skeleton className="h-10 rounded-md motion-reduce:animate-none" />
          <Skeleton className="h-10 rounded-md motion-reduce:animate-none" />
          <Skeleton className="h-10 rounded-md motion-reduce:animate-none" />
        </div>
      ) : state.status === "error" ? (
        <p role="alert" className="text-xs text-muted-foreground">Não foi possível consultar a linha do tempo.</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum evento registrado neste projeto.</p>
      ) : (
        <TimelineList events={events.slice(0, CARD_PREVIEW)} partial={state.partial} />
      )}
    </SectionCard>
  );
}

/**
 * Quantos eventos o cartão pode listar na prévia (teto de 15). O limite de altura do widget (480 px) corta o que não couber
 * sem rolagem; o restante e o histórico completo abrem no painel lateral, com carregamento de 15 em 15.
 */
const CARD_PREVIEW = 15;

/**
 * Eventos recentes do card: linha cronológica vertical que termina no último evento (sem trecho solto), ícone por tipo na cor do
 * tom, título em destaque, descrição em texto secundário e, à direita, a situação e há quanto tempo foi.
 */
function TimelineList({ events, partial }: { events: TimelineEvent[]; partial: boolean }) {
  return (
    <>
      <ol className="flex flex-col gap-5" aria-label="Eventos recentes do projeto, do mais recente para o mais antigo">
        {events.map((event, index) => {
          const Icon = SOURCE_ICON[timelineSource(event.id)];
          const when = relativeDay(event.at);
          const last = index === events.length - 1;
          return (
            <li key={event.id} data-cut-unit className="relative flex items-start gap-3.5">
              {last ? null : <span className="absolute top-9 -bottom-5 left-[17px] w-px bg-border" aria-hidden="true" />}
              <span className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", MARK[event.tone])} aria-hidden="true">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm leading-snug font-semibold break-words text-foreground">{event.title}</p>
                {event.detail ? <p className="mt-0.5 text-xs leading-relaxed break-words text-muted-foreground">{event.detail}</p> : null}
              </div>
              {event.badge || when ? (
                <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                  {event.badge ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", PILL[event.badge.tone])}>{event.badge.label}</span> : null}
                  {when ? <span className="text-[11px] text-muted-foreground">{when}</span> : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
      {partial ? <p className="text-[11px] text-muted-foreground">Algumas fontes não puderam ser consultadas: a linha do tempo pode estar incompleta.</p> : null}
    </>
  );
}

/** Rótulos curtos da barra de filtro do painel (cabem numa linha). */
const NAV_LABEL: Record<TimelineSource, string> = {
  schedule: "Reprogramações",
  delivery: "Entregas",
  impediment: "Impedimentos",
  audit: "Registros",
  other: "Outros",
};

const SOURCE_LABEL: Record<TimelineSource, string> = {
  schedule: "Reprogramações",
  delivery: "Entregas e decisões",
  impediment: "Impedimentos",
  audit: "Registros do projeto",
  other: "Outros",
};

/** Origens presentes nos eventos, na ordem fixa dos rótulos, com a quantidade de cada uma. */
function sourceCounts(events: TimelineEvent[]) {
  const counts = new Map<TimelineSource, number>();
  for (const event of events) counts.set(timelineSource(event.id), (counts.get(timelineSource(event.id)) ?? 0) + 1);
  return (Object.keys(SOURCE_LABEL) as TimelineSource[]).filter((key) => counts.has(key)).map((key) => ({ key, count: counts.get(key) ?? 0 }));
}

/**
 * Histórico completo, no mesmo estilo do painel do Sobre o projeto: barra fixa no topo com o filtro por tipo (pílulas com a
 * quantidade) e, abaixo, a linha do tempo agrupada por data. Carregamento progressivo: 15 eventos por vez, que recomeça a
 * cada filtro.
 */
function TimelineDrawerContent({ events, partial }: { events: TimelineEvent[]; partial: boolean }) {
  const [kind, setKind] = useState<TimelineSource | "all">("all");
  const counts = sourceCounts(events);
  const filtered = kind === "all" ? events : events.filter((event) => timelineSource(event.id) === kind);
  return (
    <div className="flex flex-col gap-5">
      {counts.length > 1 ? (
        <DrawerNav
          label="Filtrar eventos por tipo"
          active={kind}
          onSelect={(id) => setKind(id as TimelineSource | "all")}
          items={[{ id: "all", label: "Todos", icon: History, count: events.length }, ...counts.map(({ key, count }) => ({ id: key, label: NAV_LABEL[key], icon: SOURCE_ICON[key], count }))]}
        />
      ) : null}
      <TimelineMonths key={kind} events={filtered} partial={partial} />
    </div>
  );
}

const DAY_LABEL = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", day: "numeric", month: "long", year: "numeric" });
const HOUR = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", hour: "2-digit", minute: "2-digit" });

/**
 * Histórico do painel: um cartão com os eventos agrupados por data (etiqueta com calendário e separador discreto entre os dias),
 * linha cronológica vertical, ícone por tipo, título em destaque e descrição em texto secundário. Mostra 15 por vez.
 * Espaçamento amplo entre dias e entre eventos para leitura rápida no sheet.
 */
function TimelineMonths({ events, partial }: { events: TimelineEvent[]; partial: boolean }) {
  const [loaded, setLoaded] = useState(0);
  const total = events.length;
  const shown = visibleCount(loaded, total);
  const days = groupByDay(events.slice(0, shown));
  return (
    <>
      <DrawerCard icon={History} title="Eventos do projeto" aside={<DrawerCount value={total} />} className="p-6">
        {days.map((day, dayIndex) => (
          <section
            key={day.key}
            aria-label={DAY_LABEL.format(new Date(day.events[0].at))}
            className={cn(dayIndex > 0 && "mt-8 border-t border-border/50 pt-7 dark:border-border")}
          >
            <h4 className="mb-5 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-label font-semibold tracking-[0.04em] text-foreground/80 uppercase dark:bg-muted/60">
              <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
              {DAY_LABEL.format(new Date(day.events[0].at))}
            </h4>
            <ol className="flex flex-col">
              {day.events.map((event, index) => {
                const Icon = SOURCE_ICON[timelineSource(event.id)];
                const last = index === day.events.length - 1;
                return (
                  <li key={event.id} className="relative flex items-start gap-4 pb-7 last:pb-0">
                    {last ? null : <span className="absolute top-10 bottom-0 left-[17px] w-px bg-border/80" aria-hidden="true" />}
                    <span className={cn("relative z-[1] flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", MARK[event.tone])} aria-hidden="true">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                      <p className="text-sm leading-snug font-semibold text-foreground">{event.title}</p>
                      {event.detail ? <p className="text-[13px] leading-relaxed break-words text-muted-foreground">{event.detail}</p> : null}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 pt-0.5 pl-2">
                      {event.badge ? <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", PILL[event.badge.tone])}>{event.badge.label}</span> : null}
                      <time dateTime={event.at} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" aria-hidden="true" />
                        {HOUR.format(new Date(event.at))}
                      </time>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </DrawerCard>
      {shown < total ? (
        <div className="flex flex-col items-start gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => setLoaded(nextVisibleCount(shown, total))}>
            Mostrar mais {total - shown}
          </Button>
          <p role="status" aria-live="polite" className="text-[11px] text-muted-foreground">
            Mostrando {shown} de {total} eventos
            {total - shown > TIMELINE_FIRST_PAGE ? ` · próximos ${TIMELINE_FIRST_PAGE}` : ""}.
          </p>
        </div>
      ) : null}
      {partial ? <p className="text-[11px] text-muted-foreground">Algumas fontes não puderam ser consultadas: a linha do tempo pode estar incompleta.</p> : null}
    </>
  );
}
