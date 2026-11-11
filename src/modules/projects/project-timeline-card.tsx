"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listScheduleHistory } from "@/lib/api/generated/cronograma/cronograma";
import { listEapAudit, listEapMilestoneDeliveries, listEapTaskImpediments } from "@/lib/api/generated/eap/eap";
import { cn } from "@/lib/utils";

import type { ProjectDetail } from "./eap-present";
import { SectionCard } from "./overview-panel";
import {
  auditEvents,
  deliveryEvents,
  impedimentEvents,
  mergeTimeline,
  scheduleEvents,
  type TimelineEvent,
  type TimelineTone,
} from "./project-timeline";

type State = { status: "loading" } | { status: "ready"; events: TimelineEvent[]; partial: boolean } | { status: "error" };

const PREVIEW = 5;

const RING: Record<TimelineTone, string> = {
  danger: "border-destructive",
  success: "border-success",
  warning: "border-warning",
  info: "border-primary",
  neutral: "border-muted-foreground/50",
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
  return (
    <SectionCard
      title="Linha do tempo do projeto"
      subtitle="Reprogramações, decisões de marcos, entregas e impedimentos"
      icon={History}
      tone="purple"
      moreLabel={`Ver histórico completo (${events.length}) →`}
      expandable={events.length > PREVIEW}
      expansion={events.length > PREVIEW ? <TimelineList events={events} partial={state.status === "ready" && state.partial} /> : undefined}
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
        <TimelineList events={events.slice(0, PREVIEW)} partial={state.partial} />
      )}
    </SectionCard>
  );
}

function TimelineList({ events, partial }: { events: TimelineEvent[]; partial: boolean }) {
  return (
    <>
      <ul className="flex flex-col gap-3.5">
        {events.map((event) => (
          <li key={event.id} className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className={cn("mt-1 size-3 shrink-0 rounded-full border-2 bg-card", RING[event.tone])} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug break-words">{event.title}</p>
                {event.detail ? <p className="text-xs text-muted-foreground break-words">{event.detail}</p> : null}
              </div>
            </div>
            {event.badge ? (
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium", PILL[event.badge.tone])}>{event.badge.label}</span>
            ) : null}
          </li>
        ))}
      </ul>
      {partial ? <p className="text-[11px] text-muted-foreground">Algumas fontes não puderam ser consultadas: a linha do tempo pode estar incompleta.</p> : null}
    </>
  );
}
