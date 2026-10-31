"use client";

import { ChevronRight, Clock, Flag } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GetScheduleMonitoring200 } from "@/lib/api/generated/model/getScheduleMonitoring200";
import { cn } from "@/lib/utils";

import { civilDateInput } from "./eap-present";
import { SectionCard } from "./overview-panel";
import { projectStatusLabel } from "./project-status";

type Status = Parameters<typeof projectStatusLabel>[0];

const DESCRIPTION: Record<Status, string> = {
  NAO_INICIADO: "O projeto ainda não foi iniciado.",
  EM_EXECUCAO: "O projeto está em execução, dentro do planejamento.",
  EM_ATENCAO: "Há itens que pedem atenção da gestão.",
  CRITICO: "Há itens críticos ou muito atrasados.",
  EM_VALIDACAO: "Há entregas aguardando validação.",
  CONCLUIDO: "O projeto foi concluído.",
  SUSPENSO: "O projeto está suspenso.",
};

const DOT: Record<Status, string> = {
  NAO_INICIADO: "bg-muted-foreground",
  EM_EXECUCAO: "bg-primary",
  EM_ATENCAO: "bg-warning",
  CRITICO: "bg-destructive",
  EM_VALIDACAO: "bg-primary",
  CONCLUIDO: "bg-success",
  SUSPENSO: "bg-muted-foreground",
};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function longDate(value: string | null) {
  const input = civilDateInput(value);
  if (!input) {
    return "Sem data";
  }
  const [year, month, day] = input.split("-");
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
}

/** Número em destaque com rótulo; só ganha cor quando há ocorrência real. */
function Stat({ label, value, tone }: { label: string; value: number | null; tone: "danger" | "warning" | "neutral" }) {
  const active = value !== null && value > 0;
  return (
    <div className="min-w-0 flex-1 px-3 first:pl-0 last:pr-0">
      <p
        className={cn(
          "text-lg leading-none font-semibold",
          !active ? "text-foreground" : tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning-foreground" : "text-foreground",
        )}
      >
        {value === null ? "—" : String(value).padStart(2, "0")}
      </p>
      <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

/**
 * Situação atual e próxima entrega: situação gerencial calculada pela API, três contadores reais (em atraso,
 * homologações pendentes e impedimentos) e a próxima entrega futura prevista. Entregas já realizadas que aguardam
 * homologação ficam no cartão Marcos e Homologações, não aqui.
 */
export function SituationCard({
  status,
  monitoring,
  impediments,
  onOpenEap,
}: {
  status: Status;
  monitoring: { status: "loading" } | { status: "ready"; data: GetScheduleMonitoring200 } | { status: "error" };
  impediments: number;
  onOpenEap: () => void;
}) {
  const data = monitoring.status === "ready" ? monitoring.data : null;
  const next = data
    ? data.items
        .filter((item) => item.entityType === "MILESTONE" && item.status === "PENDENTE" && item.plannedEndAt)
        .sort((left, right) => (left.plannedEndAt as string).localeCompare(right.plannedEndAt as string))[0]
    : undefined;
  const notes = data
    ? [
        data.situation.readyForClosure ? "Todas as fases concluídas: apto para encerramento formal." : null,
        data.situation.closureRequirementsMissing ? "Encerramento registrado sem todas as fases concluídas." : null,
      ].filter(Boolean)
    : [];

  return (
    <SectionCard title="Situação atual e próxima entrega" subtitle="Status do projeto e próximos passos." icon={Clock} tone="amber">
      <div className="flex items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">
          <span className={cn("size-3 rounded-full", DOT[status])} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{projectStatusLabel(status)}</p>
          <p className="text-xs text-muted-foreground">{DESCRIPTION[status]}</p>
        </div>
      </div>

      <div className="flex divide-x rounded-md border py-2.5 pl-3">
        <Stat label="Itens em atraso" value={data ? data.situation.delayedItems : null} tone="danger" />
        <Stat label="Homologações pendentes" value={data ? data.situation.pendingValidation : null} tone="warning" />
        <Stat label="Impedimentos" value={impediments} tone="warning" />
      </div>
      {monitoring.status === "error" ? <p className="text-xs text-muted-foreground">Não foi possível consultar os prazos do projeto.</p> : null}
      {notes.map((note) => (
        <p key={note as string} className="text-xs text-muted-foreground">
          {note}
        </p>
      ))}

      <div className="flex items-start gap-3 border-t pt-3">
        <Flag className="mt-0.5 size-4 shrink-0 text-success-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Próxima entrega prevista</p>
          {monitoring.status === "loading" ? (
            <Skeleton className="mt-1 h-4 w-32" />
          ) : next ? (
            <>
              <p className="text-sm font-semibold break-words">{next.title}</p>
              <p className="text-xs text-muted-foreground">
                Prazo: {longDate(next.plannedEndAt)}
                {next.overdue ? <span className="font-semibold text-destructive"> · atrasada</span> : null}
                {next.responsibleName ? ` · Responsável: ${next.responsibleName}` : ""}
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold text-muted-foreground">Nenhuma entrega futura prevista</p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
