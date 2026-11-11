import { Clock, RotateCcw } from "lucide-react";

import type { ListEapMilestones200DataItemStatus } from "@/lib/api/generated/model/listEapMilestones200DataItemStatus";
import { cn } from "@/lib/utils";

type FlowStage = "pending" | "delivered" | "accepted";

function stageOf(status: ListEapMilestones200DataItemStatus): FlowStage {
  if (status === "APROVADO") return "accepted";
  if (status === "ENTREGUE") return "delivered";
  return "pending";
}

/**
 * Fluxo do marco: Pendente → Entregue → Aceito. Rejeição ou pedido de correções devolve o marco a
 * Pendente; o histórico de decisões é preservado e a nova data segue pelo replanejamento.
 */
export function MilestoneFlow({ status }: { status: ListEapMilestones200DataItemStatus }) {
  const stage = stageOf(status);
  const returned = status === "REJEITADO" || status === "AJUSTES_SOLICITADOS";

  return (
    <div>
      <ol className="relative mt-4 mb-2 grid grid-cols-3" aria-label="Fluxo do marco">
        <span className="absolute top-4 right-[16.6%] left-[16.6%] h-0.5 bg-muted" aria-hidden="true" />
        <FlowStep index={1} label="Pendente" active done={stage !== "pending"} current={stage === "pending"} />
        <FlowStep index={2} label="Entregue" active={stage !== "pending"} done={stage === "accepted"} current={stage === "delivered"} />
        <FlowStep index={3} label="Aceito" active={stage === "accepted"} done={stage === "accepted"} current={stage === "accepted"} />
      </ol>
      {stage === "delivered" ? (
        <p className="mt-3.5 flex items-start gap-2 rounded-[7px] bg-status-validation-soft p-3 text-xs leading-[1.5] text-status-validation-ink">
          <Clock className="size-4 shrink-0" aria-hidden="true" />
          <span>Entregue, aguardando o aceite do gestor. O marco conta 50% no andamento; o aceite completa os 100%.</span>
        </p>
      ) : null}
      {returned ? (
        <p className="mt-3.5 flex items-start gap-2 rounded-[7px] border border-status-adjust/40 bg-status-adjust-soft p-3 text-xs leading-[1.5] text-status-adjust-ink">
          <RotateCcw className="size-4 shrink-0" aria-hidden="true" />
          <span>
            {status === "REJEITADO" ? "Rejeitado pelo gestor" : "Correções solicitadas pelo gestor"}: o marco volta a Pendente. Replaneje a data e
            registre uma nova entrega; as decisões anteriores ficam no histórico.
          </span>
        </p>
      ) : null}
    </div>
  );
}

function FlowStep({ index, label, active, done, current }: { index: number; label: string; active: boolean; done: boolean; current: boolean }) {
  return (
    <li className="z-1 text-center" aria-current={current ? "step" : undefined}>
      <span
        className={cn(
          "mx-auto mb-2 grid size-8 place-items-center rounded-full border-2 border-card text-xs font-bold shadow-[0_0_0_1px_var(--muted)] transition-colors duration-300 motion-reduce:transition-none",
          done ? "bg-status-done text-primary-foreground shadow-[0_0_0_1px_var(--status-done)]" : active ? "bg-primary text-primary-foreground shadow-[0_0_0_1px_var(--primary)]" : "bg-muted text-muted-foreground",
        )}
      >
        {index}
      </span>
      <strong className={cn("text-xs", done || active ? "text-primary" : "text-muted-foreground")}>{label}</strong>
    </li>
  );
}
