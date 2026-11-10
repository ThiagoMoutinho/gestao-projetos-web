"use client";

import { useEffect, useState } from "react";

import { getScheduleMonitoring } from "@/lib/api/generated/cronograma/cronograma";
import type { GetScheduleMonitoring200 } from "@/lib/api/generated/model/getScheduleMonitoring200";
import { cn } from "@/lib/utils";

import { DEADLINE_TONE_CLASS, deadlineBadge } from "./deadline-situation";
import { canReschedule, type EapAccess } from "./eap-access";
import { civilDateInput, type ScheduleView } from "./eap-present";
import { formatCivilDate } from "./eap-date-field";
import { EapSchedule } from "./eap-schedule";
import { PlanningSection } from "./project-planning";

type Monitoring = { status: "loading" } | { status: "ready"; data: GetScheduleMonitoring200 } | { status: "error" };

/** Seção Cronograma e reprogramações do cartão Planejamento: datas planejadas e originais gravadas, realizadas derivadas das fases. */
export function ProjectSchedule({
  projectId,
  schedule,
  closed,
  access,
}: {
  projectId: string;
  schedule: ScheduleView;
  closed: boolean;
  access: EapAccess;
}) {
  const [revision, setRevision] = useState(0);
  const [monitoring, setMonitoring] = useState<Monitoring>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getScheduleMonitoring(projectId)
      .then((response) => {
        if (active) {
          setMonitoring(response.status === 200 ? { status: "ready", data: response.data } : { status: "error" });
        }
      })
      .catch(() => {
        if (active) {
          setMonitoring({ status: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [projectId, revision]);

  const data = monitoring.status === "ready" ? monitoring.data : null;
  const current: ScheduleView = data
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

  // Atraso ativo: item ainda aberto após o prazo vigente. Atraso histórico: item já concluído depois do prazo vigente.
  const activeDelays = data ? data.overdue.tasks + data.overdue.milestones : 0;
  const historicalDelays = data ? data.items.filter((item) => item.deadlinePerformance === "DONE_LATE").length : 0;

  const start = current.plannedStartAt ? formatCivilDate(civilDateInput(current.plannedStartAt)) : null;
  const end = current.plannedEndAt ? formatCivilDate(civilDateInput(current.plannedEndAt)) : null;
  const period = start || end ? `Início ${start ?? "Não informado"} · Término ${end ?? "Não informado"}` : "Prazo vigente: Não informado";
  const summary = data ? `${period} · ${data.reschedules.total} ${data.reschedules.total === 1 ? "reprogramação" : "reprogramações"}` : period;
  const badge = data ? deadlineBadge(data.deadlineSituation) : null;

  return (
    <PlanningSection
      id="cronograma"
      title="Cronograma e reprogramações"
      summary={summary}
      badge={
        badge ? (
          <span title={badge.hint} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", DEADLINE_TONE_CLASS[badge.tone])}>
            {badge.label}
          </span>
        ) : null
      }
    >
      {monitoring.status === "error" ? (
        <p className="text-xs text-muted-foreground">Não foi possível consultar as datas realizadas e os indicadores de prazo.</p>
      ) : null}
      {data ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-1.5">
          <Indicator label="Reprogramações" value={data.reschedules.total} />
          <Indicator label="Sinalizadas ao PMO" value={data.reschedules.escalated} />
          <Indicator label="Em atraso agora" value={activeDelays} tone={activeDelays > 0 ? "alert" : undefined} title="Tarefas e marcos em atraso de execução (fases não entram): mesma contagem da Situação atual e do Resumo executivo" />
          <Indicator label="Concluídos com atraso" value={historicalDelays} title="Atrasos históricos: itens já concluídos depois do prazo vigente" />
        </dl>
      ) : null}
      <div className="border-t pt-3">
        <p className="mb-3 text-xs text-muted-foreground">
          As datas planejadas vigentes, as originais (linha de base) e as realizadas ficam separadas. As realizadas são derivadas das fases: início pela primeira fase iniciada e término quando todas estiverem concluídas.
        </p>
        <EapSchedule
          projectId={projectId}
          target={{ entityType: "PROJECT" }}
          schedule={current}
          state={closed ? "DONE" : "OPEN"}
          closed={closed}
          canReschedule={canReschedule(access)}
          onSaved={async () => {
            setRevision((value) => value + 1);
          }}
        />
      </div>
    </PlanningSection>
  );
}

function Indicator({ label, value, tone, title }: { label: string; value: number; tone?: "alert"; title?: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5" title={title}>
      <dd className={tone === "alert" ? "text-sm font-semibold text-destructive" : "text-sm font-semibold"}>{value}</dd>
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
    </div>
  );
}
