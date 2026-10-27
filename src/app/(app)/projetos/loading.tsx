import { Skeleton } from "@/components/ui/skeleton";

/** Mesmo formato da tela de projetos (título, indicadores, abas, filtros e tabela), sem salto de layout ao carregar. */
export default function ProjectsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5" role="status" aria-label="Carregando projetos">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-[62px] rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-[#e4e7ec] bg-white p-4">
        <Skeleton className="h-6 w-72 max-w-full" />
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
