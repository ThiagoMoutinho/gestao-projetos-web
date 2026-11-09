import { Skeleton } from "@/components/ui/skeleton";

/** Carregamento da Central no formato da tela: cabeçalho, cartão único com abas, filtros e a lista. */
export default function NotificationsLoading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto flex w-full max-w-[90rem] min-w-0 flex-col gap-5">
      <span className="sr-only">Carregando as notificações…</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-40 motion-reduce:animate-none" />
        <Skeleton className="h-8 w-72 motion-reduce:animate-none" />
        <Skeleton className="h-4 w-full max-w-md motion-reduce:animate-none" />
      </div>
      <div className="overflow-hidden rounded-[10px] border border-[#e4e7ec] bg-white">
        <div className="flex gap-5 border-b border-[#edf0f3] px-4 pt-3 pb-2.5">
          <Skeleton className="h-4 w-36 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-36 motion-reduce:animate-none" />
        </div>
        <div className="grid gap-2.5 p-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-9 rounded-lg motion-reduce:animate-none" />
          ))}
        </div>
        <div className="flex flex-col gap-2.5 border-t border-[#edf0f3] bg-[#f9fafb] p-4">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-[112px] w-full rounded-[10px] motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </div>
  );
}
