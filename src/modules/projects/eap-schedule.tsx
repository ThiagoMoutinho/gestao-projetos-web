"use client";

import { AlertTriangle, ArrowRight, CalendarClock, Check, Info, Lock } from "lucide-react";
import { startTransition, Suspense, use, useDeferredValue, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/fetcher";
import { rescheduleEapMilestone, rescheduleEapPhase, rescheduleEapTask, rescheduleProject } from "@/lib/api/generated/cronograma/cronograma";
import type { ListScheduleChanges200DataItemImpactsItem } from "@/lib/api/generated/model/listScheduleChanges200DataItemImpactsItem";
import { notifySuccess, reportFailure } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import { DateField, formatCivilDate } from "./eap-date-field";
import { actualDivergence, phaseCoverage, planDivergence, spanOf, type DeadlineState } from "./eap-deadline";
import { civilDateInput, civilDateToIso, type ConsolidatedView, type ScheduleView } from "./eap-present";
import { scheduleChangesRequest, type ScheduleChange } from "./eap-schedule-cache";
import { Reveal } from "./eap-reveal";
import { recordedDate } from "./project-records";

/** Planejamento gravado da fase e os períodos (AAAA-MM-DD) dos demais itens dela, sem o item em edição. */
export type PhasePlan = { startAt: string | null; endAt: string | null; others: { start: string; end: string }[] };

export type ScheduleTarget =
  | { entityType: "PROJECT" }
  | { entityType: "PHASE"; phaseId: string }
  | { entityType: "TASK"; phaseId: string; taskId: string }
  | { entityType: "MILESTONE"; phaseId: string; milestoneId: string };

type SavedChange = {
  sequence: number | null;
  impacts: ListScheduleChanges200DataItemImpactsItem[];
  escalatedToPmo: boolean;
};

/**
 * Rascunho do planejamento (início e prazo) com a justificativa de replanejamento. A primeira
 * definição dispensa justificativa; alterar uma data já definida é reprogramação e a exige.
 * O mesmo rascunho é usado nos detalhes do item e no modo de edição.
 */
export function usePlanDraft({
  projectId,
  target,
  schedule,
  enabled,
  phasePlan,
  onDirty,
}: {
  projectId: string;
  target: ScheduleTarget;
  schedule: ScheduleView;
  enabled: boolean;
  /** Tarefa e marco: planejamento gravado da fase, para propor o ajuste em cascata. */
  phasePlan?: PhasePlan;
  onDirty?: (dirty: boolean) => void;
}) {
  const single = schedule.single;
  const current = { start: civilDateInput(schedule.plannedStartAt), end: civilDateInput(schedule.plannedEndAt) };
  const [start, setStart] = useState(current.start);
  const [end, setEnd] = useState(current.end);
  const [justification, setJustification] = useState("");
  const startChanged = !single && start !== current.start;
  const endChanged = end !== current.end;
  const changed = startChanged || endChanged;
  const reschedule = (startChanged && current.start !== "") || (endChanged && current.end !== "");
  const dirty = enabled && (changed || justification.trim() !== "");
  // O ajuste da fase só ocorre com confirmação explícita: a proposta começa desmarcada.
  const [extendPhase, setExtendPhase] = useState(false);
  const phaseCurrent = phasePlan ? { start: civilDateInput(phasePlan.startAt), end: civilDateInput(phasePlan.endAt) } : null;
  const coverage = phaseCurrent && changed ? phaseCoverage(phaseCurrent, spanOf([{ start: single ? "" : start, end }, ...(phasePlan?.others ?? [])])) : null;
  const cascade = coverage && phaseCurrent ? { current: phaseCurrent, next: coverage, apply: extendPhase } : null;
  const phaseReschedule = cascade !== null && cascade.apply && (cascade.current.start !== "" || cascade.current.end !== "");

  useEffect(() => {
    onDirty?.(dirty);
  }, [dirty, onDirty]);

  function problem() {
    if (!changed) {
      return null;
    }
    if (!end || (!single && !start)) {
      return single ? "Informe a data prevista." : "Informe o início e o término planejados.";
    }
    if (!single && end < start) {
      return "O término planejado não pode ser anterior ao início.";
    }
    if (reschedule && justification.trim().length < 10) {
      return "A alteração do prazo exige justificativa de replanejamento com ao menos 10 caracteres.";
    }
    if (phaseReschedule && justification.trim().length < 10) {
      return "Estender o prazo da fase também é replanejamento: informe a justificativa com ao menos 10 caracteres.";
    }
    return null;
  }

  async function save(): Promise<SavedChange> {
    const text = justification.trim() || null;
    const range = { plannedStartAt: civilDateToIso(start) ?? "", plannedEndAt: civilDateToIso(end) ?? "", justification: text };
    const extend = cascade?.apply ? { extendPhase: true } : {};
    const response =
      target.entityType === "PROJECT"
        ? await rescheduleProject(projectId, range)
        : target.entityType === "PHASE"
          ? await rescheduleEapPhase(projectId, target.phaseId, range)
          : target.entityType === "TASK"
            ? await rescheduleEapTask(projectId, target.phaseId, target.taskId, { ...range, ...extend })
            : await rescheduleEapMilestone(projectId, target.phaseId, target.milestoneId, { plannedAt: civilDateToIso(end) ?? "", justification: text, ...extend });
    if (response.status !== 200) {
      throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível salvar o planejamento.");
    }
    const change = response.data;
    setJustification("");
    notifySuccess(
      (change.kind === "RESCHEDULE" ? `Replanejamento nº ${change.sequence} registrado` : "Planejamento definido") +
        (cascade?.apply ? " e fase ajustada." : "."),
    );
    return { sequence: change.sequence, impacts: change.impacts, escalatedToPmo: change.escalatedToPmo };
  }

  return {
    single,
    current,
    start,
    end,
    justification,
    setStart,
    setEnd,
    setJustification,
    changed,
    reschedule,
    cascade,
    setExtendPhase,
    dirty,
    problem,
    save,
  };
}

export type PlanDraft = ReturnType<typeof usePlanDraft>;

/** Campos de planejamento com justificativa e a prévia das datas anteriores e novas. */
export function PlanFields({ plan }: { plan: PlanDraft }) {
  return (
    <div className="flex flex-col gap-[13px]">
      <div className={cn("grid grid-cols-1 gap-[13px]", plan.single ? "" : "sm:grid-cols-2")}>
        {plan.single ? null : <DateField label="Início planejado" value={plan.start} onChange={plan.setStart} />}
        <DateField label={plan.single ? "Data prevista" : "Término planejado"} value={plan.end} onChange={plan.setEnd} />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[8.5px] font-semibold text-[#475467]">Justificativa de replanejamento</span>
        <Textarea
          className={textareaClass}
          value={plan.justification}
          onChange={(event) => plan.setJustification(event.target.value)}
          placeholder="Obrigatória quando o prazo for alterado."
        />
      </label>
      {plan.cascade ? <CascadeProposal cascade={plan.cascade} onApplyChange={plan.setExtendPhase} /> : null}
      {plan.changed ? (
        <ul className="flex flex-col gap-1 rounded-[7px] bg-[#f5f9ff] p-2.5 text-[8.5px] leading-[1.45] text-[#475467]">
          {plan.single ? null : <FieldChangeRow change={fieldChange("START", plan.current.start, plan.start)} single={false} />}
          <FieldChangeRow change={fieldChange("END", plan.current.end, plan.end)} single={plan.single} />
        </ul>
      ) : null}
    </div>
  );
}

/** O item sai do período da fase: propõe estender a fase na mesma operação, com a mesma justificativa. */
export function CascadeProposal({
  cascade,
  onApplyChange,
}: {
  cascade: { current: { start: string; end: string }; next: { start: string; end: string }; apply: boolean };
  onApplyChange: (apply: boolean) => void;
}) {
  const changes = [
    cascade.current.start !== cascade.next.start ? { label: "Início da fase", previous: cascade.current.start, next: cascade.next.start } : null,
    cascade.current.end !== cascade.next.end ? { label: "Término da fase", previous: cascade.current.end, next: cascade.next.end } : null,
  ].filter((change) => change !== null);
  return (
    <div role="status" className="motion-fade flex flex-col gap-2 rounded-[7px] border border-[#f3dcae] bg-[#fff8e9] p-2.5 text-[8.5px] leading-[1.45] text-[#865516]">
      <span className="flex items-start gap-2">
        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <strong className="text-[9px]">Os itens da fase passam a ficar fora do período planejado dela.</strong>
      </span>
      <label className="flex items-start gap-2 text-[#475467]">
        <Checkbox className="mt-px" checked={cascade.apply} onCheckedChange={(checked) => onApplyChange(checked === true)} />
        <span>
          Estender também o planejamento da fase, com a mesma justificativa (fica no histórico da fase).
          <span className="mt-1 flex flex-col gap-0.5">
            {changes.map((change) => (
              <span key={change.label} className="flex flex-wrap items-center gap-1.5">
                <strong className="font-semibold text-[#344054]">{change.label}:</strong>
                <span className="text-[#8a94a6] line-through">{change.previous ? formatCivilDate(change.previous) : "sem data"}</span>
                <ArrowRight className="size-3 text-[#3971ba]" aria-hidden="true" />
                <span className="font-semibold text-[#175cd3]">{formatCivilDate(change.next)}</span>
              </span>
            ))}
          </span>
        </span>
      </label>
      {cascade.apply ? null : <span>Sem o ajuste, o planejamento da fase é preservado e a divergência fica sinalizada.</span>}
    </div>
  );
}

export function ScheduleHistoryBlock({
  projectId,
  target,
  schedule,
  revision = 0,
}: {
  projectId: string;
  target: ScheduleTarget;
  schedule: ScheduleView;
  revision?: number;
}) {
  const request = scheduleChangesRequest(
    projectId,
    target.entityType,
    targetId(projectId, target),
    `${revision}:${schedule.plannedStartAt}:${schedule.plannedEndAt}`,
  );
  // Ao recarregar, mantém o histórico atual visível até a nova consulta chegar, sem voltar ao esqueleto.
  const deferredRequest = useDeferredValue(request);
  return (
    <div>
      <span className={groupLabel}>Histórico de replanejamentos</span>
      <Suspense fallback={<Skeleton className="h-[39px] w-full rounded-[7px]" />}>
        <ScheduleHistory request={deferredRequest} />
      </Suspense>
    </div>
  );
}

export function EapSchedule({
  projectId,
  target,
  schedule,
  closed,
  canReschedule,
  consolidated,
  actualOrigin,
  phasePlan,
  onSaved,
  onDirtyChange,
}: {
  projectId: string;
  target: ScheduleTarget;
  schedule: ScheduleView;
  state: DeadlineState;
  closed: boolean;
  canReschedule: boolean;
  /** Fase: datas indicadas pelos itens, exibidas à parte do planejamento gravado. */
  consolidated?: ConsolidatedView;
  /** Explica de onde vêm as datas reais (ex.: calculadas pelas tarefas e marcos). */
  actualOrigin?: string;
  /** Tarefa e marco: planejamento da fase, para propor o ajuste em cascata. */
  phasePlan?: PhasePlan;
  onSaved: () => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [saved, setSaved] = useState<SavedChange | null>(null);
  const [revision, setRevision] = useState(0);
  const firstDefinition = schedule.single ? !schedule.plannedEndAt : !schedule.plannedStartAt && !schedule.plannedEndAt;
  const action = firstDefinition ? "Definir planejamento" : "Replanejar prazo";

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("grid gap-[7px]", schedule.single ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
        {schedule.single ? (
          <>
            <DateCell label="Data prevista" value={civilDateInput(schedule.plannedEndAt)} />
            <DateCell label="Data efetiva" value={civilDateInput(schedule.actualEndAt)} />
          </>
        ) : (
          <>
            <DateCell label="Início planejado" value={civilDateInput(schedule.plannedStartAt)} />
            <DateCell label="Término planejado" value={civilDateInput(schedule.plannedEndAt)} />
            <DateCell label="Início real" value={civilDateInput(schedule.actualStartAt)} />
            <DateCell label="Término real" value={civilDateInput(schedule.actualEndAt)} />
          </>
        )}
      </div>
      {actualOrigin ? (
        <p className={mutedNote}>
          <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
          {actualOrigin}
        </p>
      ) : null}
      {consolidated ? <ConsolidatedDates schedule={schedule} consolidated={consolidated} /> : null}
      {saved ? <SavedNotice saved={saved} /> : null}
      {closed ? (
        <p className={mutedNote}>
          <Lock className="mt-px size-3 shrink-0" aria-hidden="true" />
          Item encerrado: o planejamento não pode mais ser alterado.
        </p>
      ) : !canReschedule ? (
        <p className={mutedNote}>
          <Lock className="mt-px size-3 shrink-0" aria-hidden="true" />
          O planejamento e o replanejamento cabem ao PMO, ao ADMIN e à gestão do projeto.
        </p>
      ) : (
        <section className={cn("rounded-[9px] border transition-colors duration-300 motion-reduce:transition-none", open ? "border-[#bad1f0] bg-[#f5f9ff] p-3.5" : "border-transparent")}>
          <Reveal open={open}>
            <PlanForm
              key={formKey}
              projectId={projectId}
              target={target}
              schedule={schedule}
              title={action}
              active={open}
              phasePlan={phasePlan}
              onDirtyChange={onDirtyChange}
              onCancel={() => setOpen(false)}
              onSaved={async (change) => {
                // Atualiza os dados com o formulário ainda aberto (botão em carregamento) e só então fecha:
                // a animação de fechamento roda sobre a tela já estável, sem trocas de conteúdo no meio.
                try {
                  await onSaved();
                } catch (caught) {
                  reportFailure(caught, "Planejamento salvo, mas não foi possível atualizar a tela. Recarregue a página.");
                }
                startTransition(() => {
                  setSaved(change);
                  setOpen(false);
                  setRevision((value) => value + 1);
                });
              }}
            />
          </Reveal>
          {open ? null : (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                className={secondaryButton}
                onClick={() => {
                  setSaved(null);
                  setFormKey((value) => value + 1);
                  setOpen(true);
                }}
              >
                <CalendarClock aria-hidden="true" /> {action}
              </Button>
            </div>
          )}
        </section>
      )}
      <ScheduleHistoryBlock projectId={projectId} target={target} schedule={schedule} revision={revision} />
    </div>
  );
}

/** Formulário de planejamento aberto pelo botão nos detalhes; o histórico guarda cada mudança. */
function PlanForm({
  projectId,
  target,
  schedule,
  title,
  active,
  phasePlan,
  onDirtyChange,
  onCancel,
  onSaved,
}: {
  projectId: string;
  target: ScheduleTarget;
  schedule: ScheduleView;
  title: string;
  active: boolean;
  phasePlan?: PhasePlan;
  onDirtyChange?: (dirty: boolean) => void;
  onCancel: () => void;
  onSaved: (change: SavedChange) => Promise<void>;
}) {
  const plan = usePlanDraft({ projectId, target, schedule, enabled: active, phasePlan, onDirty: onDirtyChange });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const problem = plan.changed ? plan.problem() : "Altere o início ou o término para salvar.";
    setError(problem);
    if (problem) {
      return;
    }
    setSaving(true);
    try {
      await onSaved(await plan.save());
    } catch (caught) {
      setError(reportFailure(caught, "Não foi possível salvar o planejamento."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="block text-[9px] font-semibold tracking-[0.04em] text-[#3971ba] uppercase">{title}</span>
      <PlanFields plan={plan} />
      {error ? <p role="alert" className="text-[8.5px] text-destructive">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-[7px]">
        <Button type="button" variant="outline" className={secondaryButton} disabled={saving} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" className={primaryButton} disabled={!plan.changed} loading={saving} onClick={() => void save()}>
          <Check aria-hidden="true" /> {saving ? "Salvando…" : plan.reschedule ? "Salvar replanejamento" : "Salvar planejamento"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Datas consolidadas das tarefas e marcos, ao lado do planejamento gravado da fase. A divergência é
 * apenas sinalizada: o planejamento só muda por reprogramação justificada.
 */
function ConsolidatedDates({
  schedule,
  consolidated,
}: {
  schedule: ScheduleView;
  consolidated: ConsolidatedView;
}) {
  const divergence = planDivergence({ startAt: schedule.plannedStartAt, endAt: schedule.plannedEndAt }, consolidated);
  const actual = { startAt: consolidated.actualStartAt, endAt: consolidated.actualEndAt };
  const actualDiverges = actualDivergence({ startAt: schedule.actualStartAt, endAt: schedule.actualEndAt }, actual);
  const range = (dates: { startAt: string | null; endAt: string | null }) =>
    `${dateText(civilDateInput(dates.startAt))} a ${dateText(civilDateInput(dates.endAt))}`;
  return (
    <>
      {consolidated.startAt || consolidated.endAt ? (
        <ConsolidatedNotice alert={divergence !== null} title={`Datas consolidadas das tarefas e marcos: ${range(consolidated)}`}>
          {divergence === null
            ? "Coincidem com o planejamento da fase."
            : divergence.noPlan
              ? "A fase ainda não tem planejamento gravado. Defina o planejamento para registrar o prazo da fase."
              : divergence.itemsEndLater
                ? "Os itens terminam depois do término planejado da fase. O planejamento gravado não é alterado; replaneje a fase com justificativa, se necessário."
                : "Diferem do planejamento gravado da fase, que continua valendo até uma reprogramação justificada."}
        </ConsolidatedNotice>
      ) : null}
      {actual.startAt || actual.endAt ? (
        <ConsolidatedNotice alert={actualDiverges !== null} title={`Datas reais indicadas pelas tarefas e marcos: ${range(actual)}`}>
          {actualDiverges
            ? "Diferem das datas reais registradas na fase. O registro é preservado; corrija-o com justificativa, se necessário."
            : "As datas reais registradas na fase são preservadas; campos vazios são preenchidos com estas datas."}
        </ConsolidatedNotice>
      ) : null}
    </>
  );
}

function ConsolidatedNotice({ alert, title, children }: { alert: boolean; title: string; children: ReactNode }) {
  return (
    <div
      role={alert ? "status" : undefined}
      className={cn(
        "flex items-start gap-2 rounded-[7px] border p-2.5 text-[8.5px] leading-[1.45]",
        alert ? "border-[#f3dcae] bg-[#fff8e9] text-[#865516]" : "border-[#edf0f3] bg-[#f8f9fb] text-[#667085]",
      )}
    >
      {alert ? <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" /> : <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />}
      <span>
        <strong className="block text-[9px]">{title}</strong>
        {children}
      </span>
    </div>
  );
}

function dateText(value: string) {
  return value ? formatCivilDate(value) : "não informada";
}

export function SavedNotice({ saved }: { saved: SavedChange }) {
  if (saved.impacts.length === 0) {
    return null;
  }
  return (
    <div role="status" className="flex items-start gap-2 rounded-[7px] border border-[#f3dcae] bg-[#fff8e9] p-2.5 text-[8.5px] leading-[1.45] text-[#865516]">
      <AlertTriangle className="mt-px size-[15px] shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <strong className="block text-[9px]">Impactos sinalizados{saved.sequence ? ` no replanejamento nº ${saved.sequence}` : ""}</strong>
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

function ScheduleHistory({ request }: { request: ReturnType<typeof scheduleChangesRequest> }) {
  const state = use(request);
  if (state.status === "error") {
    return <p className={emptyInline}>{state.message}</p>;
  }
  if (state.changes.length === 0) {
    return <p className={emptyInline}>Nenhum replanejamento registrado.</p>;
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
          {change.kind === "RESCHEDULE" ? `Replanejamento nº ${change.sequence}` : "Planejamento definido"}
        </strong>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {change.wasOverdue ? <Tag tone="overdue">Prazo já vencido</Tag> : null}
          {change.escalatedToPmo ? <Tag tone="pmo">Sinalizado ao PMO</Tag> : null}
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
          <span className={cn(chip, "bg-[#f2f4f7] text-[#667085]")}>Sem alteração</span>
        </>
      ) : change.kind === "DEFINED" ? (
        <>
          <strong className="text-[#253248]">{next}</strong>
          <span className={cn(chip, "bg-[#ecfdf3] text-[#067647]")}>Definição inicial</span>
        </>
      ) : (
        <>
          <span className="text-[#475467]">{formatCivilDate(change.previous)}</span>
          <ArrowRight className="size-3 text-[#3871bf]" aria-hidden="true" />
          <strong className="text-[#253248]">{next}</strong>
          <span className={cn(chip, "bg-[#fff4e5] text-[#b54708]")}>Replanejamento</span>
        </>
      )}
    </li>
  );
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
    <span className={cn(chip, tone === "overdue" ? "bg-[#fef0ef] text-[#b42318]" : "bg-[#e9f2ff] text-[#285da8]")}>
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

const chip = "rounded-full px-1.5 py-px text-[7.5px] font-semibold";
const textareaClass = "min-h-[66px] rounded-[7px] border-[#d7dce3] bg-white px-2.5 py-2 text-[10px] md:text-[10px]";
const secondaryButton = "h-[30px] gap-[5px] rounded-[7px] border-[#d7dce3] px-[11px] text-[9px] font-semibold";
const primaryButton = "h-[30px] gap-[5px] rounded-[7px] bg-[#175cd3] px-[11px] text-[9px] font-semibold text-white hover:bg-[#144ca8]";
const groupLabel = "mb-1.5 block text-[8.5px] font-semibold tracking-[0.04em] text-[#8a94a6] uppercase";
const mutedNote = "flex items-start gap-1.5 text-[8.5px] leading-[1.45] text-[#667085]";
const emptyInline = "flex min-h-[35px] items-center rounded-[7px] border border-dashed border-[#d7dce3] bg-[#f8f9fb] px-2.5 text-[8.5px] text-[#98a2b3]";
