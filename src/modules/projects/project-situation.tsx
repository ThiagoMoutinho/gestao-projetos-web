"use client";

import { ChevronRight, Clock, Flag, Layers, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GetScheduleMonitoring200 } from "@/lib/api/generated/model/getScheduleMonitoring200";
import { cn } from "@/lib/utils";

import { civilDateInput } from "./eap-present";
import { SectionCard } from "./overview-panel";
import { nextDeliveryItem } from "./project-portfolio";
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

/** Indicador em quadro: número em destaque, ícone no canto e rótulo; só ganha cor quando há ocorrência real. */
function Stat({
  label,
  value,
  tone,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | null;
  tone: "danger" | "warning" | "neutral";
  icon: typeof Flag;
  hint?: string;
}) {
  const active = value !== null && value > 0;
  const color = !active ? "text-muted-foreground" : tone === "danger" ? "text-destructive" : tone === "warning" ? "text-warning-foreground" : "text-foreground";
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-[#E4E7EC] px-3 py-2.5 dark:border-border" title={hint}>
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-xl leading-none font-semibold", active ? color : "text-foreground")}>
          {value === null ? "—" : String(value).padStart(2, "0")}
        </p>
        <Icon className={cn("size-4 shrink-0", color)} aria-hidden="true" />
      </div>
      <p className="text-[11px] leading-tight text-muted-foreground">{label}</p>
    </div>
  );
}

/** Faixa de cor da situação geral (a referência visual destaca o estado crítico). */
const BANNER: Record<Status, string> = {
  NAO_INICIADO: "bg-muted/60",
  EM_EXECUCAO: "bg-primary/5",
  EM_ATENCAO: "bg-warning/15",
  CRITICO: "bg-destructive/10",
  EM_VALIDACAO: "bg-primary/5",
  CONCLUIDO: "bg-success/10",
  SUSPENSO: "bg-muted/60",
};
const BANNER_TEXT: Record<Status, string> = {
  NAO_INICIADO: "text-foreground",
  EM_EXECUCAO: "text-primary",
  EM_ATENCAO: "text-warning-foreground",
  CRITICO: "text-destructive",
  EM_VALIDACAO: "text-primary",
  CONCLUIDO: "text-success-foreground",
  SUSPENSO: "text-foreground",
};

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
  /** Classificação de saúde calculada pela API; `null` enquanto os dados carregam ou se a consulta falhar. */
  status: Status | null;
  monitoring: { status: "loading" } | { status: "ready"; data: GetScheduleMonitoring200 } | { status: "error" };
  impediments: number;
  onOpenEap: () => void;
}) {
  const data = monitoring.status === "ready" ? monitoring.data : null;
  // Mesmo critério do indicador "Próxima entrega" do topo da página (pendente ou devolvido para correção).
  const next = data ? nextDeliveryItem(data.items) : undefined;
  const notes = data
    ? [
        data.situation.readyForClosure ? "Todas as fases concluídas: apto para encerramento formal." : null,
        data.situation.closureRequirementsMissing ? "Encerramento registrado sem todas as fases concluídas." : null,
      ].filter(Boolean)
    : [];

  return (
    <SectionCard title="Situação atual e próxima entrega" subtitle="Como está o projeto neste momento e o que precisa de atenção." icon={Clock} tone="amber">
      {status ? (
        <div className={cn("flex items-center gap-3 rounded-lg px-3.5 py-3", BANNER[status])}>
          <span className={cn("size-3.5 shrink-0 rounded-full", DOT[status])} aria-hidden="true" />
          <div className="min-w-0">
            <p className={cn("text-sm font-semibold", BANNER_TEXT[status])}>{projectStatusLabel(status)}</p>
            <p className="text-xs text-muted-foreground">
              {data && data.situation.delayDays > 0
                ? `Maior atraso em ${data.situation.delayDays} ${data.situation.delayDays === 1 ? "dia" : "dias"}.`
                : DESCRIPTION[status]}
            </p>
          </div>
        </div>
      ) : monitoring.status === "loading" ? (
        <div role="status" aria-busy="true" className="flex items-center gap-3 rounded-lg bg-muted/60 px-3.5 py-3">
          <span className="sr-only">Carregando a situação do projeto…</span>
          <Skeleton className="size-3.5 shrink-0 rounded-full motion-reduce:animate-none" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-24 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-40 motion-reduce:animate-none" />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-lg bg-muted/60 px-3.5 py-3">
          <span className="size-3.5 shrink-0 rounded-full border border-muted-foreground/50" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Situação indisponível</p>
            <p className="text-xs text-muted-foreground">Não foi possível calcular a situação do projeto agora.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat
          icon={TriangleAlert}
          label={data?.situation.delayedItems === 1 ? "Item em atraso" : "Itens em atraso"}
          value={data ? data.situation.delayedItems : null}
          tone="danger"
          hint="Tarefas e marcos em atraso de execução: abertos com o prazo vigente vencido ou entregues depois do prazo. Entrega no prazo aguardando homologação não é atraso. Fases não entram. Mesma contagem do Resumo executivo."
        />
        <Stat icon={Layers} label={data?.situation.pendingValidation === 1 ? "Homologação pendente" : "Homologações pendentes"} value={data ? data.situation.pendingValidation : null} tone="warning" hint="Marcos entregues que aguardam a decisão do homologador." />
        <Stat icon={Flag} label={impediments === 1 ? "Impedimento ativo" : "Impedimentos ativos"} value={impediments} tone="warning" />
      </div>
      {monitoring.status === "error" ? <p className="text-xs text-muted-foreground">Não foi possível consultar os prazos do projeto.</p> : null}
      <Button type="button" variant="ghost" size="xs" onClick={onOpenEap} className="-mt-1 w-fit gap-1 text-primary">
        Ver itens na EAP
        <ChevronRight data-icon="inline-end" aria-hidden="true" />
      </Button>
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
                {next.status === "REJEITADO" || next.status === "AJUSTES_SOLICITADOS" ? " · em correção" : ""}
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
