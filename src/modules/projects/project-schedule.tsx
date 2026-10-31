"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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

  // Atraso ativo: item ainda aberto após o prazo vigente. Atraso histórico: item já concluído depois do prazo vigente.
  const activeDelays = data ? data.overdue.phases + data.overdue.tasks + data.overdue.milestones : 0;
  const historicalDelays = data ? data.items.filter((item) => item.deadlinePerformance === "DONE_LATE").length : 0;

  return (
    <Card>
      <Collapsible>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium">Planejamento do projeto</h2>
              {data?.project.overdue ? (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Prazo vencido</span>
              ) : null}
            </div>
            <CollapsibleTrigger
              render={
                <Button type="button" variant="outline" size="sm" className="group/details gap-1.5">
                  Datas e reprogramações
                  <ChevronDown className="size-3.5 transition-transform group-data-panel-open/details:rotate-180" aria-hidden="true" />
                </Button>
              }
            />
          </div>
          {monitoring.status === "error" ? (
            <p className="text-xs text-muted-foreground">Não foi possível consultar as datas realizadas e os indicadores de prazo.</p>
          ) : null}
          {data ? (
            <dl className="flex flex-wrap gap-x-6 gap-y-1.5">
              <Indicator label="Reprogramações" value={data.reschedules.total} />
              <Indicator label="Sinalizadas ao PMO" value={data.reschedules.escalated} />
              <Indicator label="Em atraso agora" value={activeDelays} tone={activeDelays > 0 ? "alert" : undefined} />
              <Indicator label="Concluídos com atraso" value={historicalDelays} title="Atrasos históricos: itens já concluídos depois do prazo vigente" />
              <Indicator label="Aguardando homologação" value={data.homologation.awaiting} />
            </dl>
          ) : null}
          <CollapsibleContent>
            <div className="border-t pt-4">
              <p className="mb-3 text-xs text-muted-foreground">
                As datas realizadas são derivadas das fases: início pela primeira fase iniciada e término quando todas estiverem concluídas.
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
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
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
