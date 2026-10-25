import { cn } from "cn"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * Carregamento de listas no formato do conteúdo (evidências, histórico, pendências).
 * O texto fica disponível para leitores de tela; a animação some com prefers-reduced-motion.
 */
function SkeletonList({
  rows = 3,
  label = "Carregando",
  className,
  rowClassName,
}: {
  rows?: number
  label?: string
  className?: string
  rowClassName?: string
}) {
  return (
    <div role="status" aria-busy="true" className={cn("flex flex-col gap-[7px]", className)}>
      <span className="sr-only">{label}…</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-[39px] w-full rounded-[7px] motion-reduce:animate-none", rowClassName)}
        />
      ))}
    </div>
  )
}

export { SkeletonList }
