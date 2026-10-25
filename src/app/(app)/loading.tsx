import { Skeleton } from "@/components/ui/skeleton";

/** Carregamento do Início no formato do painel: saudação, indicadores e gráficos. */
export default function HomeLoading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto flex w-full max-w-[90rem] flex-col gap-5">
      <span className="sr-only">Carregando o início…</span>
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
