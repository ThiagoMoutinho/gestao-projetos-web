import { Skeleton } from "@/components/ui/skeleton";

/** Carregamento do Início no formato do painel: cabeçalho, indicadores e as duas colunas de seções. */
export default function HomeLoading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto flex w-full max-w-[90rem] flex-col gap-5">
      <span className="sr-only">Carregando o painel…</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton key={index} className="h-[6.25rem] rounded-[10px]" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-80 rounded-[10px]" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 rounded-[10px]" />
            <Skeleton className="h-72 rounded-[10px]" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-60 rounded-[10px]" />
          <Skeleton className="h-64 rounded-[10px]" />
          <Skeleton className="h-64 rounded-[10px]" />
        </div>
      </div>
    </div>
  );
}
