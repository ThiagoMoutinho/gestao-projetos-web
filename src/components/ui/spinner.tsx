import { Loader2Icon } from "lucide-react"
import { cn } from "cn"

/** Indicador de operação em andamento (salvar, concluir, reprogramar, homologar). */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label="Carregando"
      className={cn("size-4 animate-spin motion-reduce:animate-[spin_1.6s_linear_infinite]", className)}
      {...props}
    />
  )
}

export { Spinner }
