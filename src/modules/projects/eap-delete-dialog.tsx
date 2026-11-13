"use client";

import { Trash2 } from "lucide-react";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { deleteEapMilestone, deleteEapPhase, deleteEapTask } from "@/lib/api/generated/eap/eap";
import { ApiError } from "@/lib/api/fetcher";
import { notifySuccess, reportFailure } from "@/lib/feedback";
import type { EapSelection } from "./eap-selection";

export type EapDeleteRequest = { target: EapSelection; label: string };

const KIND_COPY = {
  phase: { noun: "fase", removed: "removida", done: "Fase excluída." },
  task: { noun: "tarefa", removed: "removida", done: "Tarefa excluída." },
  milestone: { noun: "marco", removed: "removido", done: "Marco excluído." },
} as const;

export function EapDeleteDialog({
  projectId,
  request,
  onClose,
  onDeleted,
}: {
  projectId: string;
  request: EapDeleteRequest | null;
  onClose: () => void;
  onDeleted: (target: EapSelection) => void;
}) {
  const [busy, setBusy] = useState(false);
  const copy = request ? KIND_COPY[request.target.kind] : null;

  async function confirm() {
    if (!request || busy) {
      return;
    }

    setBusy(true);
    try {
      const { target } = request;
      const response =
        target.kind === "phase"
          ? await deleteEapPhase(projectId, target.phaseId)
          : target.kind === "task"
            ? await deleteEapTask(projectId, target.phaseId, target.taskId)
            : await deleteEapMilestone(projectId, target.phaseId, target.milestoneId);
      if (response.status !== 204) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível excluir o item.");
      }
      notifySuccess(KIND_COPY[target.kind].done);
      onDeleted(target);
      onClose();
    } catch (caught) {
      reportFailure(caught, "Não foi possível excluir o item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && !busy) {
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-status-critical-soft text-status-critical-ink">
            <Trash2 />
          </AlertDialogMedia>
          <AlertDialogTitle>
            {`Excluir ${copy?.noun ?? "item"}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <strong className="font-semibold text-foreground">{request?.label}</strong> será {copy?.removed} da EAP.
            Use a exclusão apenas para itens criados por engano e sem movimentação. A exclusão fica registrada no
            histórico do projeto.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>
            Cancelar
          </AlertDialogCancel>
          <Button type="button" variant="destructive" className="h-10" loading={busy} onClick={() => void confirm()}>
            {busy ? "Excluindo…" : "Excluir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
