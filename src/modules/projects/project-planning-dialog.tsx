"use client";

import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";

import type { ScheduleView } from "./eap-present";
import { EapSchedule } from "./eap-schedule";

/**
 * Diálogo de planejamento do projeto (Visão Geral e Cronograma): mesmas datas, justificativa e histórico da EAP.
 * O salvamento continua campo a campo no EapSchedule; o rodapé só fecha.
 */
export function ProjectPlanningDialog({
  open,
  onClose,
  projectId,
  schedule,
  closed,
  onSaved,
  title = "Editar datas do projeto",
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  schedule: ScheduleView;
  closed: boolean;
  onSaved: () => void;
  title?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={(value) => (!value ? onClose() : undefined)}>
      <EditDialogContent className="sm:max-w-[640px]">
        <EditDialogHeader
          icon={CalendarRange}
          title={title}
          description="Datas planejadas do projeto."
          details="A linha de base original é preservada. Toda alteração de data exige justificativa e fica no histórico."
          onClose={onClose}
        />
        <EditDialogBody>
          <EapSchedule
            projectId={projectId}
            target={{ entityType: "PROJECT" }}
            schedule={schedule}
            state={closed ? "DONE" : "OPEN"}
            closed={closed}
            canReschedule
            onSaved={async () => onSaved()}
          />
        </EditDialogBody>
        <EditDialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </EditDialogFooter>
      </EditDialogContent>
    </Dialog>
  );
}
