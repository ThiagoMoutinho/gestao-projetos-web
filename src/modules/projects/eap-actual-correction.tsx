"use client";

import { ArrowRight, CalendarClock, PencilLine } from "lucide-react";
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
        <AlertDialogContent className="sm:max-w-[460px]!">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-status-attention-soft text-status-attention-ink">
              <CalendarClock />
            </AlertDialogMedia>
            <AlertDialogTitle>Corrigir datas reais da fase</AlertDialogTitle>
            <AlertDialogDescription>
              Registradas hoje: início <strong className="font-semibold text-foreground">{dateText(recorded.start)}</strong>, término{" "}
              <strong className="font-semibold text-foreground">{dateText(recorded.end)}</strong>. A correção fica no histórico com a
              justificativa; o planejamento e a linha de base não mudam.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DateField label="Início real" value={start} onChange={(value) => { setStart(value); clear("start"); }} error={errors.start} />
            {concluded ? (
              <DateField label="Término real" value={end} onChange={(value) => { setEnd(value); clear("end"); }} error={errors.end} />
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground/80">Término real</span>
                <p className="rounded-[7px] border border-border/60 bg-muted/50 px-2.5 py-2 text-xs leading-snug text-muted-foreground">
                  Só pode ser registrado com a fase concluída.
                </p>
              </div>
            )}
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground/80">Justificativa da correção</span>
            <Textarea
              className="min-h-[66px] rounded-[7px] border-input bg-card px-2.5 py-2 text-xs md:text-xs"
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
            <ul className="motion-fade flex flex-col gap-1 rounded-[7px] bg-primary/5 p-2.5 text-xs leading-[1.45] text-foreground/80">
              {changes.map((change) => (
                <li key={change.label} className="flex flex-wrap items-center gap-1.5">
                  <strong className="font-semibold text-foreground">{change.label}:</strong>
                  <span className="text-muted-foreground line-through">{dateText(change.previous)}</span>
                  <ArrowRight className="size-3 text-primary" aria-hidden="true" />
                  <span className="font-semibold text-primary">{dateText(change.next)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              Cancelar
            </AlertDialogCancel>
            <Button type="button" className="h-8" disabled={changes.length === 0} loading={busy} onClick={() => void confirm()}>
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

const secondaryButton = "h-9 gap-1.5 rounded-[9px] px-3.5 text-[13px]";
