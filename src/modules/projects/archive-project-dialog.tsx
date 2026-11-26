"use client";

import { Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FieldError } from "@/components/field-error";
import { OptionCombobox } from "@/components/option-combobox";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";
import { Input } from "@/components/ui/input";
import { Presence } from "@/components/ui/presence";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/fetcher";
import { notifySuccess, reportFailure } from "@/lib/feedback";

import { archiveProject } from "./archive-project-api";
import { ARCHIVE_REASON_OPTIONS, type ArchiveReason } from "./archive-reasons";

type ArchiveTarget = { id: string; name: string };

/**
 * Diálogo de arquivamento com motivo padronizado e justificativa detalhada obrigatórios.
 * Usa o padrão EditDialog (Institucional Premium).
 */
export function ArchiveProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ArchiveTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState<ArchiveReason | "">("");
  const [otherDescription, setOtherDescription] = useState("");
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [otherError, setOtherError] = useState<string | null>(null);
  const [justificationError, setJustificationError] = useState<string | null>(null);

  function reset(next: boolean) {
    if (busy) {
      return;
    }
    if (!next) {
      setReason("");
      setOtherDescription("");
      setJustification("");
      setReasonError(null);
      setOtherError(null);
      setJustificationError(null);
    }
    onOpenChange(next);
  }

  async function confirm() {
    if (busy) {
      return;
    }
    let invalid = false;
    if (!reason) {
      setReasonError("Selecione o motivo do arquivamento.");
      invalid = true;
    }
    if (reason === "OUTRO" && otherDescription.trim().length < 3) {
      setOtherError("Descreva o motivo específico (mínimo 3 caracteres).");
      invalid = true;
    }
    if (justification.trim().length < 10) {
      setJustificationError("Informe a justificativa detalhada (mínimo 10 caracteres).");
      invalid = true;
    }
    if (invalid || !reason) {
      return;
    }

    setBusy(true);
    try {
      const response = await archiveProject(project.id, {
        reason,
        justification: justification.trim(),
        ...(reason === "OUTRO" ? { otherDescription: otherDescription.trim() } : {}),
      });
      if (response.status !== 200) {
        throw new ApiError(response.status, response.data.code ?? "HTTP_ERROR", response.data.message);
      }
      notifySuccess("Projeto arquivado.");
      reset(false);
      router.refresh();
    } catch (caught) {
      reportFailure(caught, "Não foi possível arquivar o projeto.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      <EditDialogContent className="sm:max-w-[600px]">
        <EditDialogHeader
          icon={Archive}
          title="Arquivar projeto"
          description={project.name}
          details="O projeto sai das abas Ativos e Concluídos e passa a aparecer em Arquivados. EAP, datas, evidências e a situação são preservadas — não há exclusão. Motivo e justificativa ficam registrados para auditoria."
          onClose={() => reset(false)}
          closeDisabled={busy}
          tone="attention"
        />
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
        >
          <EditDialogBody>
            <p className="rounded-xl border border-border/70 bg-muted/40 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
              Os dados do projeto, da EAP e das evidências permanecem intactos. O arquivamento apenas retira o
              projeto da lista ativa e exige justificativa administrativa para rastreabilidade.
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground/80">Motivo do arquivamento *</span>
              <OptionCombobox
                label="Motivo do arquivamento"
                value={reason}
                options={ARCHIVE_REASON_OPTIONS}
                placeholder="Selecione o motivo…"
                invalid={Boolean(reasonError)}
                describedBy={reasonError ? "archive-reason-error" : undefined}
                onChange={(value) => {
                  setReason(value as ArchiveReason | "");
                  setReasonError(null);
                  if (value !== "OUTRO") {
                    setOtherDescription("");
                    setOtherError(null);
                  }
                }}
              />
              <FieldError id="archive-reason-error" message={reasonError} />
            </label>
            <Presence open={reason === "OUTRO"}>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground/80">Descrição do outro motivo *</span>
                <Input
                  value={otherDescription}
                  maxLength={500}
                  onChange={(event) => {
                    setOtherDescription(event.target.value);
                    setOtherError(null);
                  }}
                  aria-invalid={otherError ? true : undefined}
                  aria-describedby={otherError ? "archive-other-error" : undefined}
                  placeholder="Descreva o motivo específico"
                  className="h-10 text-xs"
                />
                <FieldError id="archive-other-error" message={otherError} />
              </label>
            </Presence>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground/80">Justificativa detalhada *</span>
              <Textarea
                value={justification}
                maxLength={2000}
                onChange={(event) => {
                  setJustification(event.target.value);
                  setJustificationError(null);
                }}
                aria-invalid={justificationError ? true : undefined}
                aria-describedby={justificationError ? "archive-justification-error" : undefined}
                placeholder="Explique a decisão administrativa com o detalhe necessário para auditoria."
                className="min-h-28 text-xs"
              />
              <FieldError id="archive-justification-error" message={justificationError} />
            </label>
          </EditDialogBody>
          <EditDialogFooter>
            <Button type="button" variant="outline" className="h-10" disabled={busy} onClick={() => reset(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="h-10" loading={busy}>
              {busy ? "Arquivando…" : "Confirmar arquivamento"}
            </Button>
          </EditDialogFooter>
        </form>
      </EditDialogContent>
    </Dialog>
  );
}
