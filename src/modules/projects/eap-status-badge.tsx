import { Ban, Pause } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import type { EapStatusKind } from "./eap-status";

export { milestoneStatusKind, phaseStatusKind, taskStatusKind, type EapStatusKind } from "./eap-status";

const KIND_CLASS: Record<EapStatusKind, string> = {
  "not-started": "bg-muted text-muted-foreground",
  "in-progress": "bg-primary/10 text-primary",
  done: "bg-success/15 text-success-foreground",
  delivered: "bg-[#f4ecfb] text-[#7450bf]",
  adjustments: "bg-[#fdeedd] text-[#b4570f]",
  rejected: "bg-destructive/10 text-destructive",
  suspended: "bg-warning/20 text-warning-foreground",
  cancelled: "border-muted-foreground/30 bg-muted text-muted-foreground",
  attention: "bg-warning/20 text-warning-foreground",
};

/** Selo da situação principal. O texto sempre acompanha a cor; cancelada e suspensa também mudam o ícone. */
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
        size === "sm" ? "px-1.5 py-[3px] text-[7.5px]" : "px-[7px] py-1 text-[8.5px]",
        KIND_CLASS[kind],
        className,
      )}
    >
      {kind === "cancelled" ? (
        <Ban className="size-2.5!" aria-hidden="true" />
      ) : kind === "suspended" ? (
        <Pause className="size-2.5!" aria-hidden="true" />
      ) : (
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      )}
      {label}
    </Badge>
  );
}
