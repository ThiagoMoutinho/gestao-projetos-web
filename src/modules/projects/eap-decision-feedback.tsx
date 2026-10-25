import { AlertTriangle, Check, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";

import type { ProjectMilestoneView } from "./eap-present";
import { recordedDate } from "./project-records";

const DECISIONS = {
  APROVADO: { title: "Entrega aceita formalmente", icon: Check, tone: "border-[#bfe4d5] bg-[#f0faf6] text-[#157454]" },
  AJUSTES_SOLICITADOS: { title: "Correções necessárias", icon: RotateCcw, tone: "border-[#f6d2ad] bg-[#fff6ec] text-[#b4570f]" },
  REJEITADO: { title: "Entrega rejeitada", icon: AlertTriangle, tone: "border-[#efc3bf] bg-[#fff4f1] text-[#9f2219]" },
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
    <div role="status" className={cn("mb-[14px] flex items-start gap-[9px] rounded-[7px] border p-[11px]", decision.tone, className)}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <div>
        <strong className="block text-[9.5px]">{decision.title}</strong>
        <span className="mt-[3px] block text-[8px]">{detail}</span>
      </div>
    </div>
  );
}
