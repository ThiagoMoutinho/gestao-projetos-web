"use client";

import { FileText } from "lucide-react";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { getExecutiveSummary } from "@/lib/api/generated/cronograma/cronograma";
import type { GetExecutiveSummary200 } from "@/lib/api/generated/model/getExecutiveSummary200";
import { cn } from "@/lib/utils";

import { Fact, SectionCard } from "./overview-panel";
import { projectStatusLabel } from "./project-status";

type Summary = GetExecutiveSummary200;
type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: Summary };

const DOT: Record<Summary["situation"]["status"], string> = {
  NAO_INICIADO: "bg-muted-foreground",
  EM_EXECUCAO: "bg-primary",
  EM_ATENCAO: "bg-warning",
  CRITICO: "bg-destructive",
  EM_VALIDACAO: "bg-primary",
  CONCLUIDO: "bg-success",
  SUSPENSO: "bg-muted-foreground",
};

const REFERENCE = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const CIVIL_DAY = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", year: "numeric" });
const MOMENT = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function percent(basisPoints: number | null) {
  return basisPoints === null ? "Indisponível" : `${(Math.round(basisPoints / 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold text-[#475467]">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Resumo executivo automático: situação, síntese (frases predefinidas), indicadores, próximas entregas e movimentações
 * relevantes, todos calculados pela API a partir dos dados reais do projeto, sem IA e sem validação humana (que virá em
 * etapa posterior). Os valores são do momento indicado no rodapé.
 */
export function ExecutiveSummaryCard({
  projectId,
  ownerName,
  suppliers,
  updatedAt,
  refreshKey,
}: {
  projectId: string;
  ownerName: string;
  suppliers: string[] | null;
  updatedAt: string;
  /** Muda quando o projeto é atualizado: o resumo é consultado de novo. */
  refreshKey: string;
}) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    getExecutiveSummary(projectId)
      .then((response) => {
        if (active) {
          setState(response.status === 200 ? { status: "ready", data: response.data } : { status: "error" });
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [projectId, refreshKey]);

  const data = state.status === "ready" ? state.data : null;
  const facts = (
    <div className="flex flex-col gap-2">
      {data ? (
        <p className="text-[11px] text-muted-foreground">
          Dados de referência: {REFERENCE.format(new Date(data.generatedAt))} · atualização automática, ainda sem validação do PMO.
        </p>
      ) : null}
      <dl className="grid gap-2 sm:grid-cols-3">
        <Fact label="Responsável principal" value={ownerName} />
        <Fact label="Fornecedor" value={suppliers === null ? "Indisponível" : suppliers.length === 0 ? "Não informado" : suppliers.join(", ")} />
        <Fact label="Última atualização" value={updatedAt} />
      </dl>
    </div>
  );

  return (
    <SectionCard
      title="Resumo executivo"
      subtitle="Síntese automática do projeto"
      icon={FileText}
      tone="blue"
      action={
        data ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E4E7EC] px-2.5 py-1 text-[11px] font-medium dark:border-border">
            <span className={cn("size-2 rounded-full", DOT[data.situation.status])} aria-hidden="true" />
            {projectStatusLabel(data.situation.status)}
          </span>
        ) : null
      }
      footer={facts}
    >
      {state.status === "loading" ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : state.status === "error" ? (
        <p className="text-xs text-muted-foreground">Não foi possível gerar o resumo do projeto agora.</p>
      ) : !state.data.hasData ? (
        <p className="text-xs text-muted-foreground">{state.data.narrative[0]?.text}</p>
      ) : (
        <>
          <p className="text-xs leading-relaxed text-foreground/85">{state.data.narrative.map((line) => line.text).join(" ")}</p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Fact label="Progresso consolidado" value={percent(state.data.progress.basisPoints)} />
            <Fact label="Itens em atraso" value={String(state.data.overdue.total)} />
            <Fact label="Impedimentos" value={String(state.data.impediments)} />
            <Fact label="Reprogramações" value={String(state.data.reschedules.total)} />
            <Fact label="Aguardando homologação" value={String(state.data.homologation.awaiting)} />
            <Fact label="Em correção" value={String(state.data.homologation.inCorrections)} />
          </dl>
          <Block title="Próximas entregas">
            {state.data.nextDeliveries.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma entrega futura prevista.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {state.data.nextDeliveries.map((delivery) => (
                  <li key={delivery.id} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate" title={delivery.title}>
                      {delivery.title}
                      {delivery.phaseName ? <span className="text-muted-foreground"> · {delivery.phaseName}</span> : null}
                    </span>
                    <span className={cn("shrink-0 font-medium", delivery.overdue ? "text-destructive" : "text-muted-foreground")}>
                      {CIVIL_DAY.format(new Date(delivery.plannedAt))}
                      {delivery.overdue ? " · vencido" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block title="Movimentações relevantes">
            {state.data.movements.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma movimentação relevante registrada.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {state.data.movements.map((movement) => (
                  <li key={movement.id} className="text-xs">
                    <span className="break-words">{movement.summary}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {movement.automatic ? "Automático" : (movement.actorName ?? "Usuário não identificado")} · {MOMENT.format(new Date(movement.at))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>
        </>
      )}
    </SectionCard>
  );
}
