"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
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
  const [error, setError] = useState<string | null>(null);
  const copy = request ? KIND_COPY[request.target.kind] : null;

  async function confirm() {
    if (!request || busy) {
      return;
    }

    setBusy(true);
    setError(null);
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
      setError(reportFailure(caught, "Não foi possível excluir o item."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open && !busy) {
          setError(null);
          onClose();
        }
      }}
    >
      <AlertDialogContent className="max-w-[400px]! gap-3 rounded-[10px] p-5">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[14px] font-semibold text-[#101828]">
            {`Excluir ${copy?.noun ?? "item"}?`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[11px] leading-relaxed text-[#475467]">
            <strong className="font-semibold text-[#344054]">{request?.label}</strong> será {copy?.removed} da EAP.
            Use a exclusão apenas para itens criados por engano e sem movimentação. A exclusão fica registrada no
            histórico do projeto.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="rounded-[7px] border border-[#efc3bf] bg-[#fff4f1] px-3 py-2 text-[11px] leading-snug text-[#9f2219]">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter className="-mx-5 -mb-5 px-5 py-3">
          <AlertDialogCancel className="h-8 text-[11px]" disabled={busy}>
            Cancelar
          </AlertDialogCancel>
          <Button type="button" variant="destructive" className="h-8 text-[11px]" disabled={busy} onClick={() => void confirm()}>
            {busy ? "Excluindo…" : "Excluir"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
