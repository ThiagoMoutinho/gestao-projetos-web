"use client";

import { AlertTriangle, ArrowRight, CalendarClock, Check, History, Lock } from "lucide-react";
import { Suspense, use, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/fetcher";
import { rescheduleEapMilestone, rescheduleEapPhase, rescheduleEapTask, rescheduleProject } from "@/lib/api/generated/cronograma/cronograma";
import type { ListScheduleChanges200DataItemImpactsItem } from "@/lib/api/generated/model/listScheduleChanges200DataItemImpactsItem";
import { notifySuccess, reportFailure } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import { DateField, formatCivilDate } from "./eap-date-field";
import { civilDateInput, civilDateToIso, type ScheduleView } from "./eap-present";
import { Reveal } from "./eap-reveal";
import { scheduleChangesRequest, type ScheduleChange } from "./eap-schedule-cache";
import { recordedDate } from "./project-records";

export type ScheduleTarget =
  | { entityType: "PROJECT" }
  | { entityType: "PHASE"; phaseId: string }
  | { entityType: "TASK"; phaseId: string; taskId: string }
  | { entityType: "MILESTONE"; phaseId: string; milestoneId: string };

type Step = "closed" | "editing" | "confirming";

type SavedChange = {
  sequence: number | null;
  impacts: ListScheduleChanges200DataItemImpactsItem[];
  escalatedToPmo: boolean;
};

/**
 * Datas do item, reprogramação com justificativa e histórico imutável das mudanças.
 * O plano original (linha de base) nunca é alterado; a API valida e grava cada mudança.
 */
export function EapSchedule({
  projectId,
  target,
  schedule,
  closed,
  canReschedule,
  onSaved,
}: {
  projectId: string;
  target: ScheduleTarget;
  schedule: ScheduleView;
  closed: boolean;
  canReschedule: boolean;
  onSaved: () => Promise<void>;
}) {
  const entityId = targetId(projectId, target);
  const current = { start: civilDateInput(schedule.plannedStartAt), end: civilDateInput(schedule.plannedEndAt) };
  const baseline = { start: civilDateInput(schedule.baselineStartAt), end: civilDateInput(schedule.baselineEndAt) };
  const firstDefinition = schedule.single ? !current.end : !current.start && !current.end;
  const baselineDiffers = !firstDefinition && (baseline.end !== current.end || (!schedule.single && baseline.start !== current.start));

  const [step, setStep] = useState<Step>("closed");
  const [start, setStart] = useState(current.start);
  const [end, setEnd] = useState(current.end);
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedChange | null>(null);
  const [revision, setRevision] = useState(0);

  const startChanged = !schedule.single && start !== current.start;
  const endChanged = end !== current.end;
  const changesPlan = (startChanged && current.start !== "") || (endChanged && current.end !== "");
  const hasDefinedDate = current.end !== "" || (!schedule.single && current.start !== "");
  const action = firstDefinition ? "Definir planejamento" : "Reprogramar prazo";
  const pendingChanges: FieldChange[] = [
    ...(schedule.single ? [] : [fieldChange("START", current.start, start)]),
    fieldChange("END", current.end, end),
  ];

  function openForm() {
    setStart(current.start);
    setEnd(current.end);
    setJustification("");
    setError(null);
    setSaved(null);
    setStep("editing");
  }

  function validate() {
    if (!end || (!schedule.single && !start)) {
      return schedule.single ? "Informe a nova data prevista." : "Informe o novo início e o novo término.";
    }
    if (!schedule.single && end < start) {
      return "O novo término não pode ser anterior ao novo início.";
    }
    if (!startChanged && !endChanged) {
      return "As novas datas são iguais ao planejamento vigente.";
    }
    if (changesPlan && justification.trim().length < 10) {
      return "A reprogramação exige justificativa com ao menos 10 caracteres.";
    }
    return null;
  }

  function review() {
    const problem = validate();
    setError(problem);
    if (!problem) {
      setStep("confirming");
    }
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      const text = justification.trim() || null;
      const range = { plannedStartAt: civilDateToIso(start) ?? "", plannedEndAt: civilDateToIso(end) ?? "", justification: text };
      const response =
        target.entityType === "PROJECT"
          ? await rescheduleProject(projectId, range)
          : target.entityType === "PHASE"
            ? await rescheduleEapPhase(projectId, target.phaseId, range)
            : target.entityType === "TASK"
              ? await rescheduleEapTask(projectId, target.phaseId, target.taskId, range)
              : await rescheduleEapMilestone(projectId, target.phaseId, target.milestoneId, { plannedAt: civilDateToIso(end) ?? "", justification: text });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível registrar a mudança de prazo.");
      }
      const change = response.data;
      setSaved({ sequence: change.sequence, impacts: change.impacts, escalatedToPmo: change.escalatedToPmo });
      setStep("closed");
      notifySuccess(change.kind === "RESCHEDULE" ? `Reprogramação nº ${change.sequence} registrada.` : "Planejamento definido.");
      await onSaved();
      setRevision((value) => value + 1);
    } catch (caught) {
      setError(reportFailure(caught, "Não foi possível registrar a mudança de prazo."));
      setStep("editing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("grid gap-[7px]", schedule.single ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        {schedule.single ? (
          <>
            <DateCell label="Data prevista" value={current.end} />
            <DateCell label="Data efetiva de conclusão" value={civilDateInput(schedule.actualEndAt)} />
          </>
        ) : (
          <>
            <DateCell label="Início planejado" value={current.start} />
            <DateCell label="Término planejado" value={current.end} />
            <DateCell label="Início real" value={civilDateInput(schedule.actualStartAt)} />
            <DateCell label="Término real" value={civilDateInput(schedule.actualEndAt)} />
          </>
        )}
      </div>
      {baselineDiffers ? (
        <p className="flex items-start gap-2 rounded-[7px] bg-[#f5f9ff] p-2.5 text-[8.5px] leading-[1.45] text-[#285da8]">
          <History className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Plano original preservado: {schedule.single ? planText("", baseline.end, true) : planText(baseline.start, baseline.end, false)}.
          </span>
        </p>
      ) : null}

      {saved ? <SavedNotice saved={saved} /> : null}

      {closed ? (
        <p className={mutedNote}>
          <Lock className="mt-px size-3 shrink-0" aria-hidden="true" />
          Item encerrado: o prazo não pode mais ser reprogramado.
        </p>
      ) : canReschedule ? (
        <section className={cn("rounded-[9px] border p-3.5 transition-colors duration-300 motion-reduce:transition-none", step === "closed" ? "border-transparent p-0" : "border-[#bad1f0] bg-[#f5f9ff]")}>
          <Reveal open={step !== "closed"}>
            <div className="flex flex-col gap-3">
              <div>
                <span className="mb-1 block text-[9px] font-semibold tracking-[0.04em] text-[#3971ba] uppercase">{action}</span>
                <p className="text-[8.5px] leading-[1.45] text-[#667b98]">
                  Planejamento vigente: {schedule.single ? planText("", current.end, true) : planText(current.start, current.end, false)}
                </p>
              </div>
              <Reveal open={step === "editing"}>
                <div className="flex flex-col gap-2.5">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {schedule.single ? null : <DateField label="Novo início" value={start} onChange={setStart} />}
                    <DateField label={schedule.single ? "Nova data prevista" : "Novo término"} value={end} onChange={setEnd} />
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className="flex items-baseline justify-between text-[8.5px] font-semibold text-[#475467]">
                      Justificativa
                      <small className="text-[7.5px] font-normal text-[#98a2b3]">{changesPlan ? "obrigatória" : hasDefinedDate ? "obrigatória ao alterar data já definida" : "opcional"}</small>
                    </span>
                    <Textarea
                      className={textareaClass}
                      value={justification}
                      onChange={(event) => setJustification(event.target.value)}
                      placeholder="Explique o motivo da mudança de prazo."
                    />
                  </label>
                </div>
              </Reveal>
              <Reveal open={step === "confirming"}>
                <div className="rounded-[7px] border border-[#d8e6f8] bg-white p-2.5 text-[8.5px] leading-[1.5] text-[#475467]">
                  <strong className="mb-1 block text-[9.5px] text-[#253d60]">Confirme a mudança</strong>
                  <ul className="flex flex-col gap-1">
                    {pendingChanges.map((change) => (
                      <FieldChangeRow key={change.field} change={change} single={schedule.single} />
                    ))}
                  </ul>
                  <span className="mt-1.5 block text-[#667085]">
                    O plano original e as reprogramações anteriores ficam preservados. Impactos em outros itens são apenas sinalizados.
                  </span>
                </div>
              </Reveal>
              {error ? <p role="alert" className="text-[8.5px] text-destructive">{error}</p> : null}
              <div className="flex flex-wrap justify-end gap-[7px]">
                <Button
                  type="button"
                  variant="outline"
                  className={secondaryButton}
                  disabled={saving}
                  onClick={() => {
                    setError(null);
                    setStep(step === "confirming" ? "editing" : "closed");
                  }}
                >
                  Voltar
                </Button>
                {step === "confirming" ? (
                  <Button type="button" className={primaryButton} disabled={saving} onClick={() => void confirm()}>
                    <Check aria-hidden="true" /> {saving ? "Registrando…" : changesPlan ? "Confirmar reprogramação" : "Confirmar planejamento"}
                  </Button>
                ) : (
                  <Button type="button" className={primaryButton} onClick={review}>
                    Continuar
                  </Button>
                )}
              </div>
            </div>
          </Reveal>
          {step === "closed" ? (
            <div className="flex justify-end">
              <Button type="button" variant="outline" className={secondaryButton} onClick={openForm}>
                <CalendarClock aria-hidden="true" /> {action}
              </Button>
            </div>
          ) : null}
        </section>
      ) : (
        <p className={mutedNote}>
          <Lock className="mt-px size-3 shrink-0" aria-hidden="true" />
          A reprogramação de prazo cabe ao PMO, ao ADMIN e à gestão do projeto.
        </p>
      )}

      <div>
        <span className={groupLabel}>Histórico de reprogramações</span>
        <Suspense fallback={<Skeleton className="h-[39px] w-full rounded-[7px]" />}>
          <ScheduleHistory
            request={scheduleChangesRequest(
              projectId,
              target.entityType,
              entityId,
              `${revision}:${schedule.plannedStartAt}:${schedule.plannedEndAt}`,
            )}
          />
        </Suspense>
      </div>
    </div>
  );
}

function ScheduleHistory({ request }: { request: ReturnType<typeof scheduleChangesRequest> }) {
  const state = use(request);
  if (state.status === "error") {
    return <p className={emptyInline}>{state.message}</p>;
  }
  if (state.changes.length === 0) {
    return <p className={emptyInline}>Nenhuma reprogramação registrada.</p>;
  }
  return (
    <ol className="flex flex-col gap-2">
      {state.changes.map((change) => (
        <ChangeCard key={change.id} change={change} />
      ))}
    </ol>
  );
}

function ChangeCard({ change }: { change: ScheduleChange }) {
  const single = change.entityType === "MILESTONE";
  const fields: FieldChange[] = change.changes.map((item) => ({
    field: item.field,
    kind: item.kind,
    previous: civilDateInput(item.previous),
    next: civilDateInput(item.next),
  }));
  return (
    <li className="rounded-[8px] border border-[#e4e7ec] bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <strong className="text-[10px] text-[#253248]">
          {change.kind === "RESCHEDULE" ? `Reprogramação nº ${change.sequence}` : "Planejamento definido"}
        </strong>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {change.wasOverdue ? <Tag tone="overdue">Prazo já vencido</Tag> : null}
          {change.escalatedToPmo ? <Tag tone="pmo">Sinalizada ao PMO</Tag> : null}
        </span>
      </div>
      <p className="mt-[3px] text-[8px] text-[#8a94a6]">
        {change.actorName ?? "Não identificado"} · {recordedDate(change.createdAt)}
      </p>
      <dl className="mt-2 flex flex-col gap-1.5 text-[8.5px] leading-[1.45] text-[#475467]">
        <Line label="Datas">
          <ul className="flex flex-col gap-1">
            {fields.map((field) => (
              <FieldChangeRow key={field.field} change={field} single={single} />
            ))}
          </ul>
        </Line>
        {change.justification ? <Line label="Justificativa">{change.justification}</Line> : null}
        {change.impacts.length > 0 ? (
          <Line label="Impactos">
            <ul className="flex flex-col gap-0.5">
              {change.impacts.map((impact) => (
                <li key={`${impact.code}:${impact.message}`}>{impact.message}</li>
              ))}
            </ul>
          </Line>
        ) : null}
      </dl>
    </li>
  );
}

function SavedNotice({ saved }: { saved: SavedChange }) {
  if (saved.impacts.length === 0) {
    return null;
  }
  return (
    <div role="status" className="flex items-start gap-2 rounded-[7px] border border-[#f3dcae] bg-[#fff8e9] p-2.5 text-[8.5px] leading-[1.45] text-[#865516]">
      <AlertTriangle className="mt-px size-[15px] shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <strong className="block text-[9px]">Impactos sinalizados{saved.sequence ? ` na reprogramação nº ${saved.sequence}` : ""}</strong>
        <ul className="mt-1 list-disc pl-3.5">
          {saved.impacts.map((impact) => (
            <li key={`${impact.code}:${impact.message}`}>{impact.message}</li>
          ))}
        </ul>
        <span className="mt-1 block">
          Os demais itens não foram alterados.{saved.escalatedToPmo ? " A mudança ficou sinalizada ao PMO no monitoramento do projeto." : ""}
        </span>
      </div>
    </div>
  );
}

function targetId(projectId: string, target: ScheduleTarget) {
  switch (target.entityType) {
    case "PROJECT":
      return projectId;
    case "PHASE":
      return target.phaseId;
    case "TASK":
      return target.taskId;
    case "MILESTONE":
      return target.milestoneId;
  }
}

type FieldChange = {
  field: "START" | "END";
  kind: "DEFINED" | "RESCHEDULED" | "UNCHANGED";
  previous: string;
  next: string;
};

function fieldChange(field: FieldChange["field"], previous: string, next: string): FieldChange {
  const kind = previous === next ? "UNCHANGED" : previous === "" ? "DEFINED" : "RESCHEDULED";
  return { field, kind, previous, next };
}

function FieldChangeRow({ change, single }: { change: FieldChange; single: boolean }) {
  const label = single ? "Data prevista" : change.field === "START" ? "Início" : "Término";
  const next = change.next ? formatCivilDate(change.next) : "não informada";
  return (
    <li className="flex flex-wrap items-center gap-1.5">
      <span className="min-w-[52px] text-[#667085]">{label}</span>
      {change.kind === "UNCHANGED" ? (
        <>
          <span className="text-[#475467]">{next}</span>
          <span className="rounded-full bg-[#f2f4f7] px-1.5 py-px text-[7.5px] font-semibold text-[#667085]">Sem alteração</span>
        </>
      ) : change.kind === "DEFINED" ? (
        <>
          <strong className="text-[#253248]">{next}</strong>
          <span className="rounded-full bg-[#ecfdf3] px-1.5 py-px text-[7.5px] font-semibold text-[#067647]">Definição inicial</span>
        </>
      ) : (
        <>
          <span className="text-[#475467]">{formatCivilDate(change.previous)}</span>
          <ArrowRight className="size-3 text-[#3871bf]" aria-hidden="true" />
          <strong className="text-[#253248]">{next}</strong>
          <span className="rounded-full bg-[#fff4e5] px-1.5 py-px text-[7.5px] font-semibold text-[#b54708]">Reprogramação</span>
        </>
      )}
    </li>
  );
}

function planText(start: string, end: string, single: boolean) {
  const endText = end ? formatCivilDate(end) : "não informada";
  if (single) {
    return endText;
  }
  if (!start && !end) {
    return "ainda não definido";
  }
  return `${start ? formatCivilDate(start) : "início não informado"} a ${endText}`;
}

function DateCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[7px] bg-[#f7f9fb] p-2.5">
      <span className="mb-1 block text-[7.5px] text-[#8a94a6]">{label}</span>
      <strong className="block text-[8.5px] text-[#344054]">{value ? formatCivilDate(value) : "Não informada"}</strong>
    </div>
  );
}

function Tag({ tone, children }: { tone: "overdue" | "pmo"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-[7.5px] font-semibold",
        tone === "overdue" ? "bg-[#fef0ef] text-[#b42318]" : "bg-[#e9f2ff] text-[#285da8]",
      )}
    >
      {children}
    </span>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-2">
      <dt className="text-[#98a2b3]">{label}</dt>
      <dd className="break-words whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

const textareaClass = "min-h-[66px] rounded-[7px] border-[#d7dce3] bg-white px-2.5 py-2 text-[10px] md:text-[10px]";
const secondaryButton = "h-[30px] gap-[5px] rounded-[7px] border-[#d7dce3] px-[11px] text-[9px] font-semibold";
const primaryButton = "h-[30px] gap-[5px] rounded-[7px] bg-[#175cd3] px-[11px] text-[9px] font-semibold text-white hover:bg-[#144ca8]";
const groupLabel = "mb-1.5 block text-[8.5px] font-semibold tracking-[0.04em] text-[#8a94a6] uppercase";
const mutedNote = "flex items-start gap-1.5 text-[8.5px] leading-[1.45] text-[#667085]";
const emptyInline = "flex min-h-[35px] items-center rounded-[7px] border border-dashed border-[#d7dce3] bg-[#f8f9fb] px-2.5 text-[8.5px] text-[#98a2b3]";
