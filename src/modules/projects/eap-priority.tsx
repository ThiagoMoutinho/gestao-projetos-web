import { cn } from "@/lib/utils";

export type TaskPriority = "CRITICA" | "ALTA" | "NORMAL" | "BAIXA";

/** Ordem de exibição: da mais urgente para a menos urgente; Normal é o padrão. */
export const PRIORITY_OPTIONS: ReadonlyArray<{ value: TaskPriority; label: string }> = [
  { value: "CRITICA", label: "Crítica" },
  { value: "ALTA", label: "Alta" },
  { value: "NORMAL", label: "Normal" },
  { value: "BAIXA", label: "Baixa" },
];

export const DEFAULT_PRIORITY: TaskPriority = "NORMAL";

export function priorityLabel(priority: TaskPriority) {
  return PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? "Normal";
}

const DOT: Record<TaskPriority, string> = {
  CRITICA: "bg-destructive",
  ALTA: "bg-warning",
  NORMAL: "bg-primary/60",
  BAIXA: "bg-muted-foreground/50",
};

/** Indicador discreto: ponto colorido sempre acompanhado do texto (a cor nunca é o único sinal). */
export function PriorityIndicator({ priority, className }: { priority: TaskPriority; className?: string }) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-xs",
        priority === "CRITICA" ? "font-semibold text-destructive" : priority === "ALTA" ? "font-medium text-warning-foreground" : "text-[#667085]",
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", DOT[priority])} aria-hidden="true" />
      <span className="truncate">{priorityLabel(priority)}</span>
    </span>
  );
}
