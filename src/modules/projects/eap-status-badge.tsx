import { Ban, Pause } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { EapStatusKind } from "./eap-status";

export { milestoneStatusKind, phaseStatusKind, taskStatusKind, type EapStatusKind } from "./eap-status";

const KIND_CLASS: Record<EapStatusKind, string> = {
  "not-started": "border-status-idle/50 bg-status-idle-soft text-status-idle-ink",
  "in-progress": "bg-status-running-soft text-status-running-ink",
  done: "bg-status-done-soft text-status-done-ink",
  delivered: "bg-status-validation-soft text-status-validation-ink",
  adjustments: "bg-status-adjust-soft text-status-adjust-ink",
  rejected: "bg-status-critical-soft text-status-critical-ink",
  suspended: "bg-status-attention-soft text-status-attention-ink",
  cancelled: "border-border bg-muted text-muted-foreground line-through decoration-muted-foreground",
  attention: "bg-status-attention-soft text-status-attention-ink",
};

/**
 * Selo da situação principal. O texto sempre acompanha a cor: não iniciado usa azul-acinzentado com
 * ponto vazado; cancelada usa cinza esmaecido, texto riscado e ícone próprio; suspensa também muda o ícone.
 */
export function EapStatusBadge({
  kind,
  label,
  title,
  size = "md",
  className,
}: {
  kind: EapStatusKind;
  label: string;
  title?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Badge
      title={title}
      className={cn(
        "h-auto gap-[5px] rounded-full font-semibold",
        size === "sm" ? "px-1.5 py-[3px] text-[11px]" : "px-[7px] py-1 text-[11px]",
        KIND_CLASS[kind],
        className,
      )}
    >
      {kind === "cancelled" ? (
        <Ban className="size-2.5!" aria-hidden="true" />
      ) : kind === "suspended" ? (
        <Pause className="size-2.5!" aria-hidden="true" />
      ) : kind === "not-started" ? (
        <span className="size-1.5 rounded-full border border-current" aria-hidden="true" />
      ) : (
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      )}
      {label}
    </Badge>
  );
}
