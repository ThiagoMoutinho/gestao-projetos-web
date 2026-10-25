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
      <ol className="relative mt-3.5 mb-[7px] grid grid-cols-3" aria-label="Fluxo do marco">
        <span className="absolute top-3 right-[16.6%] left-[16.6%] h-0.5 bg-[#e2e7ed]" aria-hidden="true" />
        <FlowStep index={1} label="Pendente" active done={stage !== "pending"} current={stage === "pending"} />
        <FlowStep index={2} label="Entregue" active={stage !== "pending"} done={stage === "accepted"} current={stage === "delivered"} />
        <FlowStep index={3} label="Aceito" active={stage === "accepted"} done={stage === "accepted"} current={stage === "accepted"} />
      </ol>
      {stage === "delivered" ? (
        <p className="mt-3.5 flex items-start gap-2 rounded-[7px] bg-[#f7f2fd] p-2.5 text-[8.5px] leading-[1.45] text-[#6343a8]">
          <Clock className="size-[15px] shrink-0" aria-hidden="true" />
          <span>Entregue, aguardando o aceite do gestor. O marco conta 50% no andamento; o aceite completa os 100%.</span>
        </p>
      ) : null}
      {returned ? (
        <p className="mt-3.5 flex items-start gap-2 rounded-[7px] border border-[#f6d2ad] bg-[#fff6ec] p-2.5 text-[8.5px] leading-[1.45] text-[#b4570f]">
          <RotateCcw className="size-[15px] shrink-0" aria-hidden="true" />
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
          "mx-auto mb-[7px] grid size-[25px] place-items-center rounded-full border-2 border-white text-[8px] font-bold shadow-[0_0_0_1px_#dce1e7] transition-colors duration-300 motion-reduce:transition-none",
          done ? "bg-[#258363] text-white shadow-[0_0_0_1px_#258363]" : active ? "bg-[#286cc4] text-white shadow-[0_0_0_1px_#286cc4]" : "bg-[#f0f2f4] text-[#98a2b3]",
        )}
      >
        {index}
      </span>
      <strong className={cn("text-[8px]", done || active ? "text-[#285da8]" : "text-[#8a94a6]")}>{label}</strong>
    </li>
  );
}
