import { Skeleton } from "@/components/ui/skeleton";

/** Mesmo formato da tela (título, abas, indicadores e tabela), sem salto de layout ao carregar. */
export default function DeliveriesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5" role="status" aria-label="Carregando entregas">
      <div className="space-y-2">
        <Skeleton className="h-3 w-44" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[76px] rounded-2xl" />
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
