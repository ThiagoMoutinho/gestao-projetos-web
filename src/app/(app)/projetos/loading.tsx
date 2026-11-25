import { Skeleton } from "@/components/ui/skeleton";

/** Mesmo envelope e blocos da tela de Projetos (cabeçalho, quatro indicadores e lista), sem salto de layout ao carregar. */
export default function ProjectsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] min-w-0 flex-col gap-6" role="status" aria-label="Carregando projetos">
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 pt-1 pb-0.5">
        <div className="flex min-w-0 items-center gap-3.5">
          <Skeleton className="size-11 shrink-0 rounded-xl" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-10 w-36 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
      </header>

      <div className="@container">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-[104px] rounded-xl" />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(16,24,40,0.05)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <Skeleton className="h-10 w-72 max-w-full rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg" />
          <Skeleton className="ml-auto h-10 w-28 rounded-lg" />
        </div>
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
