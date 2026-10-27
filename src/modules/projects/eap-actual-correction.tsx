"use client";

import { ArrowRight, PencilLine } from "lucide-react";
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
import { FieldError, useFieldErrors } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/fetcher";
import { updateEapPhase } from "@/lib/api/generated/eap/eap";
import { notifySuccess, reportFailure } from "@/lib/feedback";

import { DateField, formatCivilDate } from "./eap-date-field";
import { actualDatesProblem, civilDay } from "./eap-deadline";
import { civilDateInput, civilDateToIso, type ProjectPhaseView } from "./eap-present";

/**
 * Correção explícita das datas reais registradas na fase (PATCH da fase, com justificativa e auditoria).
 * O formulário abre com os valores registrados e nada é gravado sem confirmação.
 */
export function PhaseActualCorrection({
  projectId,
  phase,
  onSaved,
}: {
  projectId: string;
  phase: ProjectPhaseView;
  onSaved: () => Promise<void>;
}) {
  const recorded = { start: civilDateInput(phase.schedule.actualStartAt), end: civilDateInput(phase.schedule.actualEndAt) };
  const concluded = phase.status === "CONCLUIDA";
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(recorded.start);
  const [end, setEnd] = useState(recorded.end);
  const [justification, setJustification] = useState("");
  const [busy, setBusy] = useState(false);
  const { errors, validate, clear, reset } = useFieldErrors<"start" | "end" | "justification">();
  const changes = [
    { label: "Início real", previous: recorded.start, next: start },
    { label: "Término real", previous: recorded.end, next: end },
  ].filter((change) => change.previous !== change.next);

  function openForm() {
    setStart(recorded.start);
    setEnd(recorded.end);
    setJustification("");
    reset();
    setOpen(true);
  }

  /** Marca os campos inválidos (mensagem abaixo de cada um); retorna true quando dá para confirmar. */
  function check() {
    if (changes.length === 0) {
      return false;
    }
    const today = civilDay(new Date()) ?? "";
    const datesProblem = actualDatesProblem({ start, end, today });
    return validate([
      ["end", end !== "" && !concluded && "O término real só pode ser registrado em fase concluída."],
      // O problema de datas aparece no campo a corrigir: início ausente ou futuro, senão o término.
      [!start || start > today ? "start" : "end", datesProblem],
      ["justification", justification.trim().length < 10 && "Informe a justificativa da correção com ao menos 10 caracteres."],
    ]);
  }

  async function confirm() {
    if (busy) {
      return;
    }
    if (!check()) {
      return;
    }
    setBusy(true);
    try {
      const response = await updateEapPhase(projectId, phase.id, {
        ...(start !== recorded.start ? { actualStartAt: civilDateToIso(start) } : {}),
        ...(end !== recorded.end ? { actualEndAt: civilDateToIso(end) } : {}),
        justification: justification.trim(),
      });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível corrigir as datas reais.");
      }
      notifySuccess("Datas reais da fase corrigidas.");
      setOpen(false);
      await onSaved();
    } catch (caught) {
      reportFailure(caught, "Não foi possível corrigir as datas reais.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" className={secondaryButton} onClick={openForm}>
        <PencilLine aria-hidden="true" /> Corrigir datas reais
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !busy) {
            setOpen(false);
          }
        }}
      >
        <AlertDialogContent className="max-w-[440px]! gap-3 rounded-[10px] p-5">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[14px] font-semibold text-[#101828]">Corrigir datas reais da fase</AlertDialogTitle>
            <AlertDialogDescription className="text-[11px] leading-relaxed text-[#475467]">
              Registradas hoje: início <strong className="font-semibold text-[#344054]">{dateText(recorded.start)}</strong>, término{" "}
              <strong className="font-semibold text-[#344054]">{dateText(recorded.end)}</strong>. A correção fica no histórico com a
              justificativa; o planejamento e a linha de base não mudam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DateField label="Início real" value={start} onChange={(value) => { setStart(value); clear("start"); }} error={errors.start} />
            {concluded ? (
              <DateField label="Término real" value={end} onChange={(value) => { setEnd(value); clear("end"); }} error={errors.end} />
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-[8.5px] font-semibold text-[#475467]">Término real</span>
                <p className="rounded-[7px] border border-[#edf0f3] bg-[#f8f9fb] px-2.5 py-2 text-[9px] leading-snug text-[#667085]">
                  Só pode ser registrado com a fase concluída.
                </p>
              </div>
            )}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-[8.5px] font-semibold text-[#475467]">Justificativa da correção</span>
            <Textarea
              className="min-h-[66px] rounded-[7px] border-[#d7dce3] bg-white px-2.5 py-2 text-[10px] md:text-[10px]"
              value={justification}
              onChange={(event) => {
                setJustification(event.target.value);
                clear("justification");
              }}
              aria-invalid={errors.justification ? true : undefined}
              aria-describedby={errors.justification ? "actual-correction-justification-error" : undefined}
              placeholder="Obrigatória, com ao menos 10 caracteres (ex.: data registrada em ata)."
            />
            <FieldError id="actual-correction-justification-error" message={errors.justification} />
          </label>
          {changes.length > 0 ? (
            <ul className="motion-fade flex flex-col gap-1 rounded-[7px] bg-[#f5f9ff] p-2.5 text-[9px] leading-[1.45] text-[#475467]">
              {changes.map((change) => (
                <li key={change.label} className="flex flex-wrap items-center gap-1.5">
                  <strong className="font-semibold text-[#344054]">{change.label}:</strong>
                  <span className="text-[#8a94a6] line-through">{dateText(change.previous)}</span>
                  <ArrowRight className="size-3 text-[#3971ba]" aria-hidden="true" />
                  <span className="font-semibold text-[#175cd3]">{dateText(change.next)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <AlertDialogFooter className="-mx-5 -mb-5 px-5 py-3">
            <AlertDialogCancel className="h-8 text-[11px]" disabled={busy}>
              Cancelar
            </AlertDialogCancel>
            <Button type="button" className="h-8 text-[11px]" disabled={changes.length === 0} loading={busy} onClick={() => void confirm()}>
              {busy ? "Salvando…" : "Confirmar correção"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function dateText(value: string) {
  return value ? formatCivilDate(value) : "não informada";
}

const secondaryButton = "h-[30px] gap-[5px] rounded-[7px] border-[#d7dce3] px-[11px] text-[9px] font-semibold";
