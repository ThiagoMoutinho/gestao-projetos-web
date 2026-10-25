"use client";

import { useEffect, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { getScheduleMonitoring } from "@/lib/api/generated/cronograma/cronograma";
import type { GetScheduleMonitoring200 } from "@/lib/api/generated/model/getScheduleMonitoring200";

import { canReschedule, type EapAccess } from "./eap-access";
import type { ScheduleView } from "./eap-present";
import { EapSchedule } from "./eap-schedule";

type Monitoring = { status: "loading" } | { status: "ready"; data: GetScheduleMonitoring200 } | { status: "error" };

/** Planejamento do projeto: datas planejadas e originais gravadas, realizadas derivadas das fases. */
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

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <h2 className="text-sm font-medium">Planejamento do projeto</h2>
            <p className="text-xs text-muted-foreground">
              As datas realizadas são derivadas das fases: início pela primeira fase iniciada e término quando todas estiverem concluídas.
            </p>
          </div>
          {data?.project.overdue ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">Prazo vencido</span>
          ) : null}
        </div>
        {monitoring.status === "error" ? (
          <p className="text-xs text-muted-foreground">Não foi possível consultar as datas realizadas e os indicadores de prazo.</p>
        ) : null}
        {data ? (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Indicator label="Reprogramações" value={data.reschedules.total} />
            <Indicator label="Sinalizadas ao PMO" value={data.reschedules.escalated} />
            <Indicator label="Itens em atraso" value={data.overdue.phases + data.overdue.tasks + data.overdue.milestones} />
            <Indicator label="Aguardando homologação" value={data.homologation.awaiting} />
          </dl>
        ) : null}
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
      </CardContent>
    </Card>
  );
}

function Indicator({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/30 p-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}
