"use client";

import { CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
import { ApiError } from "@/lib/api/fetcher";
import { getScheduleMonitoring } from "@/lib/api/generated/cronograma/cronograma";
import { closeProject } from "@/lib/api/generated/projetos/projetos";
import { notifySuccess, reportFailure } from "@/lib/feedback";

/**
 * Encerramento formal na Visão Geral: mostra "Apto para encerramento" quando a API indica e, para quem
 * pode encerrar, o botão com confirmação. A API confere de novo a permissão e a elegibilidade.
 */
export function ProjectClosure({ projectId, closed, canClose }: { projectId: string; closed: boolean; canClose: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (closed) {
      return;
    }
    let active = true;
    getScheduleMonitoring(projectId)
      .then((response) => {
        if (active && response.status === 200) {
          setReady(response.data.situation.readyForClosure);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [projectId, closed]);

  async function confirm() {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      const response = await closeProject(projectId);
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível encerrar o projeto.");
      }
      notifySuccess("Projeto encerrado formalmente.");
      setOpen(false);
      setReady(false);
      router.refresh();
    } catch (caught) {
      reportFailure(caught, "Não foi possível encerrar o projeto.");
    } finally {
      setBusy(false);
    }
  }

  if (closed || !ready) {
    return null;
  }

  return (
    <div className="motion-fade flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-[#157454]" title="Todas as fases concluídas; o encerramento depende de decisão formal">
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
        Apto para encerramento
      </span>
      {canClose ? (
        <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
          <CircleCheck className="size-3.5" aria-hidden="true" /> Encerrar projeto
        </Button>
      ) : null}
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !busy) {
            setOpen(false);
          }
        }}
      >
        <AlertDialogContent className="max-w-[420px]! gap-3 rounded-[10px] p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px] font-semibold text-[#101828]">Encerrar o projeto?</AlertDialogTitle>
            <AlertDialogDescription className="text-[12px] leading-relaxed text-[#475467]">
              O projeto será formalmente concluído e sairá da lista de ativos, sem ser arquivado. A EAP, as datas, as evidências e as
              homologações são preservadas, e o encerramento fica registrado no histórico com o seu usuário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="-mx-5 -mb-5 px-5 py-3">
            <AlertDialogCancel className="h-8 text-[11px]" disabled={busy}>
              Cancelar
            </AlertDialogCancel>
            <Button type="button" className="h-8 text-[11px]" loading={busy} onClick={() => void confirm()}>
              {busy ? "Encerrando…" : "Encerrar projeto"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
