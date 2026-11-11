import { AlertTriangle, Check, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ProjectMilestoneView } from "./eap-present";
import { recordedDate } from "./project-records";

const DECISIONS = {
  APROVADO: { title: "Entrega aceita formalmente", icon: Check, tone: "border-status-done/40 bg-status-done-soft text-status-done-ink" },
  AJUSTES_SOLICITADOS: { title: "Correções necessárias", icon: RotateCcw, tone: "border-status-adjust/40 bg-status-adjust-soft text-status-adjust-ink" },
  REJEITADO: { title: "Entrega rejeitada", icon: AlertTriangle, tone: "border-status-critical/40 bg-status-critical-soft text-status-critical-ink" },
} as const;

export function MilestoneDecisionFeedback({ milestone, className }: { milestone: ProjectMilestoneView; className?: string }) {
  if (milestone.status !== "APROVADO" && milestone.status !== "AJUSTES_SOLICITADOS" && milestone.status !== "REJEITADO") {
    return null;
  }

  const decision = DECISIONS[milestone.status];
  const Icon = decision.icon;
  const decidedAt = milestone.validatedAt ? recordedDate(milestone.validatedAt) : null;
  const detail = [milestone.validatedBy, decidedAt, milestone.validationNote?.trim() || "Decisão formal registrada."].filter(Boolean).join(" · ");

  return (
    <div role="status" className={cn("mt-3 mb-[14px] flex items-start gap-[9px] rounded-[7px] border p-[11px]", decision.tone, className)}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <div>
        <strong className="block text-xs">{decision.title}</strong>
        <span className="mt-[3px] block text-xs">{detail}</span>
      </div>
    </div>
  );
}
