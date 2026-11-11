import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Esqueleto da Visão Geral do projeto, com a mesma forma da tela pronta (cabeçalho, quatro indicadores e cartões em
 * duas colunas), para o carregamento não deslocar o layout. Sem "use client": também serve ao loading.tsx da rota.
 * O acabamento do cartão repete OVERVIEW_CARD (overview-panel.tsx), que é um módulo de cliente.
 */
const CARD = "rounded-[10px] border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-0 dark:border-border dark:shadow-none";
const PULSE = "motion-reduce:animate-none";

/** Cartão de seção em carregamento: bloco do ícone, título, subtítulo e linhas de conteúdo. */
/** `nested`: dentro de OverviewSkeleton, que já anuncia o carregamento uma única vez. */
export function CardSkeleton({ label, lines = 4, nested = false, className }: { label: string; lines?: number; nested?: boolean; className?: string }) {
  return (
    <Card {...(nested ? {} : { role: "status", "aria-busy": true })} className={cn(CARD, "min-h-full gap-3 px-4 py-4", className)}>
      {nested ? null : <span className="sr-only">{label}…</span>}
      <div className="flex items-center gap-3" aria-hidden="true">
        <Skeleton className={cn("size-9 shrink-0 rounded-[10px]", PULSE)} />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className={cn("h-4 w-1/2", PULSE)} />
          <Skeleton className={cn("h-3 w-2/3", PULSE)} />
        </div>
      </div>
      <div className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className={cn("h-4", index === lines - 1 ? "w-3/5" : "w-full", PULSE)} />
        ))}
      </div>
    </Card>
  );
}

function IndicatorSkeleton() {
  return (
    <Card className={cn(CARD, "min-h-[104px] flex-row items-center gap-3.5 px-4 py-4")} aria-hidden="true">
      <Skeleton className={cn("size-11 shrink-0 rounded-[10px]", PULSE)} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className={cn("h-3 w-24", PULSE)} />
        <Skeleton className={cn("h-4 w-32", PULSE)} />
      </div>
    </Card>
  );
}

/** Cabeçalho (identificação e ações) mais os quatro indicadores do topo. */
export function OverviewHeaderSkeleton() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className={cn("size-12 shrink-0 rounded-lg", PULSE)} />
          <div className="flex flex-col gap-2">
            <Skeleton className={cn("h-3 w-36", PULSE)} />
            <Skeleton className={cn("h-6 w-64 max-w-full", PULSE)} />
            <Skeleton className={cn("h-3 w-48", PULSE)} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className={cn("h-6 w-24 rounded-full", PULSE)} />
          <Skeleton className={cn("h-8 w-32", PULSE)} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <IndicatorSkeleton key={index} />
        ))}
      </div>
    </>
  );
}

/** Visão Geral inteira em carregamento: mesma ordem e larguras do layout padrão dos widgets. */
export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-[18px]" role="status" aria-busy="true">
      <span className="sr-only">Carregando a visão geral do projeto…</span>
      <OverviewHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <CardSkeleton nested label="Carregando sobre o projeto" lines={5} />
        </div>
        <div className="lg:col-span-6">
          <CardSkeleton nested label="Carregando resultados" lines={5} />
        </div>
        <div className="lg:col-span-6">
          <CardSkeleton nested label="Carregando a situação atual" lines={4} />
        </div>
        <div className="lg:col-span-6">
          <CardSkeleton nested label="Carregando as principais evoluções" lines={4} />
        </div>
        <div className="lg:col-span-12">
          <CardSkeleton nested label="Carregando marcos e homologações" lines={4} />
        </div>
        <div className="lg:col-span-6">
          <CardSkeleton nested label="Carregando o resumo executivo" lines={4} />
        </div>
        <div className="lg:col-span-6">
          <CardSkeleton nested label="Carregando o histórico executivo" lines={4} />
        </div>
      </div>
      <CardSkeleton nested label="Carregando o planejamento" lines={3} />
    </div>
  );
}
