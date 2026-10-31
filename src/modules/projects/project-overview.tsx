"use client";

import { CalendarDays, Flag, History, LayoutGrid, ListChecks, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getScheduleMonitoring } from "@/lib/api/generated/cronograma/cronograma";
import { listEapAudit } from "@/lib/api/generated/eap/eap";
import type { GetScheduleMonitoring200 } from "@/lib/api/generated/model/getScheduleMonitoring200";
import { cn } from "@/lib/utils";

import { canCloseProject, type EapAccess } from "./eap-access";
import { formatCivilDate } from "./eap-date-field";
import { presentHistory, type HistoryEntry } from "./eap-history-entries";
import { ExecutiveSummaryCard } from "./executive-summary";
import { ExecutiveHistoryCard, MilestonesCard } from "./overview-cards";
import { OVERVIEW_CARD } from "./overview-panel";
import { projectProgress } from "./eap-progress";
import { civilDateInput, type ProjectDetail } from "./eap-present";
import { EapStatusBadge } from "./eap-status-badge";
import { nextDeliveryFrom } from "./project-portfolio";
import { ProjectClosure } from "./project-closure";
import { ProjectOverviewSections } from "./project-institutional";
import { recordedDate, recordedStatusLabel } from "./project-records";
import { projectStatusKind, projectStatusLabel } from "./project-status";

type Monitoring = { status: "loading" } | { status: "ready"; data: GetScheduleMonitoring200 } | { status: "error" };
type History = { status: "loading" } | { status: "ready"; entries: HistoryEntry[] } | { status: "error" };

function shortDate(value: string | null) {
  const input = civilDateInput(value);
  if (!input) {
    return "Sem data";
  }
  const [year, month, day] = input.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${day} ${months[Number(month) - 1]} ${year}`;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "P";
  }
  return (parts.length === 1 ? parts[0].slice(0, 2) : `${parts[0][0]}${parts[parts.length - 1][0]}`).toUpperCase();
}

/** Visão Geral do projeto: indicadores e painéis montados com os dados reais da API (sem valores de exemplo). */
export function ProjectOverview({
  project,
  access,
  onOpenEap,
}: {
  project: ProjectDetail;
  access: EapAccess;
  onOpenEap: () => void;
}) {
  const [monitoring, setMonitoring] = useState<Monitoring>({ status: "loading" });
  const [history, setHistory] = useState<History>({ status: "loading" });
  const router = useRouter();
  /** Muda depois de uma decisão de homologação para recarregar prazos, entregas e histórico. */
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    getScheduleMonitoring(project.id)
      .then((response) => {
        if (active) {
          setMonitoring(response.status === 200 ? { status: "ready", data: response.data } : { status: "error" });
        }
      })
      .catch(() => active && setMonitoring({ status: "error" }));
    listEapAudit(project.id, { entityType: "PROJECT", entityId: project.id, limit: 50 })
      .then((response) => {
        if (!active) {
          return;
        }
        if (response.status !== 200) {
          setHistory({ status: "error" });
          return;
        }
        setHistory({
          status: "ready",
          entries: presentHistory(response.data.data, {
            statusLabel: recordedStatusLabel,
            date: recordedDate,
            civilDate: (value) => formatCivilDate(civilDateInput(value)),
          }),
        });
      })
      .catch(() => active && setHistory({ status: "error" }));
    return () => {
      active = false;
    };
  }, [project.id, refresh]);

  const data = monitoring.status === "ready" ? monitoring.data : null;
  const closed = project.status === "CONCLUIDO";
  const status = data?.situation.status ?? project.status;
  const progress = project.phases ? projectProgress(project.phases) : ({ kind: "unavailable" } as const);
  const progressPercent = progress.kind === "value" ? Math.round(progress.basisPoints / 100) : null;
  const managers =
    project.managers === null ? "Indisponível" : project.managers.length === 0 ? "Não informado" : project.managers.join(", ");
  const suppliers = project.members
    ? [...new Set(project.members.filter((member) => member.role === "FORNECEDOR").map((member) => member.name))]
    : null;
  const impediments = (project.phases ?? []).reduce((total, phase) => total + (phase.tasks?.filter((task) => task.hasImpediment).length ?? 0), 0);
  const nextDelivery = data ? nextDeliveryFrom(data.items) : null;
  const reference = project.glpiTicketId ? `GLPI ${project.glpiTicketId}` : null;

  return (
    <div className="flex flex-col gap-[18px]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
            aria-hidden="true"
          >
            {initials(project.name)}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">Visão geral do projeto</p>
            <h1 className="truncate text-2xl leading-[1.25] font-semibold tracking-[-0.025em] text-[#172033]">{project.name}</h1>
            <p className="truncate text-[11.5px] text-muted-foreground">
              {[reference, `Responsável: ${project.ownerName}`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EapStatusBadge kind={projectStatusKind(status)} label={projectStatusLabel(status)} />
          <ProjectClosure projectId={project.id} closed={closed} canClose={canCloseProject(access)} />
          <Button type="button" variant="outline" className="gap-2" onClick={onOpenEap}>
            <LayoutGrid className="size-4" aria-hidden="true" />
            Acessar EAP
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicator icon={ListChecks} tone="primary" label="Progresso consolidado">
          <p className="text-[15px] font-bold text-[#344054] dark:text-foreground">{progressPercent === null ? "Indisponível" : `${progressPercent}%`}</p>
          <Progress
            value={progressPercent ?? 0}
            aria-label="Progresso consolidado do projeto"
            className="mt-1 **:data-[slot=progress-track]:h-1.5"
          />
        </Indicator>
        <Indicator icon={UserRound} tone="purple" label="Gestor do projeto">
          <p className="truncate text-[15px] font-bold text-[#344054] dark:text-foreground">{managers}</p>
          <p className="truncate text-xs text-muted-foreground">Responsável principal: {project.ownerName}</p>
        </Indicator>
        <Indicator icon={CalendarDays} tone="amber" label="Prazo vigente">
          {project.schedule.plannedEndAt ? (
            <>
              <p className="text-[15px] font-bold text-[#344054] dark:text-foreground">{shortDate(project.schedule.plannedEndAt)}</p>
              <p className="text-xs text-muted-foreground">
                {data ? (data.project.overdue ? "Prazo vencido" : "Dentro do planejamento") : "Situação do prazo indisponível"}
              </p>
            </>
          ) : (
            <>
              <p className="text-[15px] font-bold text-[#344054] dark:text-foreground text-muted-foreground">Prazo não definido</p>
              <p className="text-xs text-muted-foreground">Sem prazo oficial cadastrado</p>
            </>
          )}
        </Indicator>
        <Indicator icon={Flag} tone="green" label="Próxima entrega">
          {monitoring.status === "loading" ? (
            <Skeleton className="h-4 w-32" />
          ) : nextDelivery ? (
            <>
              <p className="truncate text-[15px] font-bold text-[#344054] dark:text-foreground">{nextDelivery.title}</p>
              <p className="text-xs text-muted-foreground">
                {shortDate(nextDelivery.plannedAt)}
                {nextDelivery.overdue ? " · atrasada" : ""}
              </p>
            </>
          ) : (
            <p className="text-[15px] font-bold text-[#344054] dark:text-foreground text-muted-foreground">
              {monitoring.status === "error" ? "Indisponível" : "Nenhuma pendente"}
            </p>
          )}
        </Indicator>
      </div>

      <ProjectOverviewSections
        projectId={project.id}
        userId={access.userId}
        canRegisterEvidence={access.canRegisterEvidence}
        evidenceOrigins={evidenceOrigins(project)}
        milestones={(project.phases ?? []).flatMap((phase) =>
          (phase.milestones ?? []).map((milestone) => ({ value: milestone.id, label: `${milestone.title} · ${phase.name}` })),
        )}
        status={status}
        monitoring={monitoring}
        impediments={impediments}
        onOpenEap={onOpenEap}
        cards={{
          marcos: (
            <MilestonesCard
              monitoring={monitoring}
              project={project}
              access={access}
              onChanged={() => {
                setRefresh((value) => value + 1);
                router.refresh();
              }}
            />
          ),
          historico: <ExecutiveHistoryCard history={history} />,
          resumo: <ExecutiveSummaryCard projectId={project.id} ownerName={project.ownerName} suppliers={suppliers} updatedAt={project.updatedAt} refreshKey={project.updatedAt} />,
        }}
      />
    </div>
  );
}

const INDICATOR_TONE = {
  primary: "bg-primary/10 text-primary",
  purple: "bg-[#f4ecfb] text-[#7450bf]",
  amber: "bg-warning/20 text-warning-foreground",
  green: "bg-success/15 text-success-foreground",
} as const;

function Indicator({
  icon: Icon,
  tone,
  label,
  children,
}: {
  icon: typeof Flag;
  tone: keyof typeof INDICATOR_TONE;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn(OVERVIEW_CARD, "min-h-[104px] flex-row items-center gap-3.5 px-4 py-4")}>
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-[10px]", INDICATOR_TONE[tone])} aria-hidden="true">
        <Icon className="size-5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {children}
      </div>
    </Card>
  );
}

/** Nome do item da EAP por id (fase, tarefa e marco), para a evidência indicar a que item está vinculada. */
function evidenceOrigins(project: ProjectDetail): Record<string, string> {
  const origins: Record<string, string> = {};
  for (const phase of project.phases ?? []) {
    origins[phase.id] = `Fase: ${phase.name}`;
    for (const task of phase.tasks ?? []) {
      origins[task.id] = `Tarefa: ${task.title} (${phase.name})`;
    }
    for (const milestone of phase.milestones ?? []) {
      origins[milestone.id] = `Marco: ${milestone.title} (${phase.name})`;
    }
  }
  return origins;
}
