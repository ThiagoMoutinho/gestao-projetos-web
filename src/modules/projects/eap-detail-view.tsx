"use client";

import { Suspense, use, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { AlertTriangle, Calendar, Check, ChevronRight, CircleCheck, Clock, FileText, Flag, Folder, Info, Maximize2, Minimize2, Plus, User, X } from "lucide-react";

import { FieldError, useFieldErrors } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/fetcher";
import { notifySuccess, reportFailure } from "@/lib/feedback";
import { getEapMilestone, getEapPhase, getEapTask, updateEapTaskProgress } from "@/lib/api/generated/eap/eap";
import { cn } from "@/lib/utils";

import { canEditItem, canHomologateMilestone, canReschedule, canUpdateTaskProgress, type EapAccess } from "./eap-access";
import { PhaseActualCorrection } from "./eap-actual-correction";
import { DateField, formatCivilDate } from "./eap-date-field";
import { actualDatesProblem, civilDay, correctsActualDate } from "./eap-deadline";
import { MilestoneDecisionFeedback } from "./eap-decision-feedback";
import { evidenceRequest, type EvidenceParent } from "./eap-evidence-cache";
import { EapHistory } from "./eap-history";
import { impedimentRequest } from "./eap-impediment-cache";
import { impedimentTone, overdueTone } from "./eap-tones";
import { EapPanel, type EapPerson, type EapSaveController } from "./eap-panel";
import { MilestoneFlow } from "./eap-milestone-flow";
import { MilestoneHomologation } from "./eap-milestone-homologation";
import {
  civilDateInput,
  civilDateToIso,
  phaseItemRanges,
  presentMilestone,
  presentPhase,
  presentTask,
  type ProjectMilestoneView,
  type ProjectPhaseView,
  type ProjectTaskView,
} from "./eap-present";
import { EapSchedule } from "./eap-schedule";
import { Reveal } from "./eap-reveal";
import { basisToPercent, formatBasis, milestoneDelayReason, milestoneIsOverdue, phaseIsOverdue, phaseProgress, progressLabel, taskIsOverdue, vigenteText } from "./eap-progress";
import { EapStatusBadge, milestoneStatusKind, phaseStatusKind, taskStatusKind, type EapStatusKind } from "./eap-status-badge";
import type { EapSelection } from "./eap-selection";
const PERCENT_OPTIONS = [25, 50, 75, 90, 100];

export function EapDetail({
  projectId,
  phases,
  selection,
  access,
  people,
  names,
  code,
  projectName,
  initialEditing,
  notice = null,
  pending,
  dirtyRef,
  onClose,
  onKeep,
  onDiscard,
  onSelect,
  onPhase,
  onTask,
  onMilestone,
  onEditingChange,
  onCorrectiveTask,
  wide = false,
  onToggleWide,
}: {
  projectId: string;
  phases: ProjectPhaseView[];
  selection: EapSelection;
  access: EapAccess;
  people: EapPerson[] | null;
  names: Map<string, string> | null;
  code: string;
  projectName: string;
  initialEditing: boolean;
  notice?: string | null;
  pending: boolean;
  dirtyRef: RefObject<boolean>;
  onClose: () => void;
  onKeep: () => void;
  onDiscard: () => void;
  onSelect: (selection: EapSelection) => void;
  onPhase: (phase: ProjectPhaseView) => void;
  onTask: (task: ProjectTaskView) => void;
  onMilestone: (milestone: ProjectMilestoneView) => void;
  onEditingChange?: (editing: boolean) => void;
  onCorrectiveTask?: (milestone: ProjectMilestoneView) => void;
  wide?: boolean;
  onToggleWide?: () => void;
}) {
  const [editing, setEditing] = useState(initialEditing);
  /** Formulários abertos no painel (datas reais, reprogramação, conclusão) protegem dados não salvos. */
  const markDirty = useCallback(
    (dirty: boolean) => {
      dirtyRef.current = dirty;
    },
    [dirtyRef],
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorLocked, setEditorLocked] = useState(false);
  const saveRef = useRef<() => void>(() => undefined);
  const onController = useCallback((controller: EapSaveController) => {
    saveRef.current = controller.save;
    setEditorSaving((current) => (current === controller.saving ? current : controller.saving));
    setEditorLocked((current) => (current === controller.locked ? current : controller.locked));
  }, []);
  const phase = phases.find((item) => item.id === selection.phaseId) ?? null;
  const task = selection.kind === "task" ? (phase?.tasks?.find((item) => item.id === selection.taskId) ?? null) : null;
  const milestone = selection.kind === "milestone" ? (phase?.milestones?.find((item) => item.id === selection.milestoneId) ?? null) : null;
  const kindLabel = selection.kind === "phase" ? "fase" : selection.kind === "task" ? "tarefa" : "marco";
  const eyebrow = editing ? `Editar ${kindLabel}` : selection.kind === "phase" ? "Detalhes da fase" : selection.kind === "task" ? "Detalhes da tarefa" : "Detalhes do marco";
  const title = phase && selection.kind === "phase" ? phase.name : task?.title ?? milestone?.title ?? "Item da EAP";

  useEffect(() => {
    onEditingChange?.(editing);
  }, [editing, onEditingChange]);

  function cancelEdit() {
    if (dirtyRef.current) {
      setConfirmCancel(true);
      return;
    }
    setEditing(false);
  }

  function discardEdit() {
    dirtyRef.current = false;
    setConfirmCancel(false);
    setEditing(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <header className={cn("flex shrink-0 items-start justify-between gap-[15px] border-b border-[#e4e7ec] pt-6", editing ? "min-h-[116px] px-6 pb-4" : "min-h-[93px] px-[22px] pb-[18px]")}>
        <div className="min-w-0">
          <span className="mb-[9px] block text-[9px] leading-none font-bold tracking-[0.12em] text-[#3871bf] uppercase">{eyebrow}</span>
          <h2 className="max-w-[470px] truncate text-[17px] leading-[1.35] font-semibold text-[#172033]">{title}</h2>
          {editing && !editorLocked ? (
            <span className="mt-[7px] flex items-center gap-1.5 text-[8.5px] font-semibold text-[#8a6116]">
              <span className="size-1.5 rounded-full bg-[#e0a130]" />
              Alterações não salvas
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onToggleWide ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="hidden text-[#667085] sm:inline-flex"
              aria-label={wide ? "Reduzir painel" : "Expandir painel"}
              aria-pressed={wide}
              title={wide ? "Reduzir painel" : "Expandir painel"}
              onClick={onToggleWide}
            >
              {wide ? <Minimize2 /> : <Maximize2 />}
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="icon-sm" className="text-[#667085]" aria-label="Fechar painel" onClick={onClose}>
            <X />
          </Button>
        </div>
      </header>
      <div key={editing ? "edit" : "view"} className={`motion-fade min-h-0 flex-1 overflow-y-auto ${editing ? "bg-[#f8fafc] px-6" : "px-[22px] py-5"}`}>
        {confirmCancel || pending ? (
          <div role="alert" className="mt-3 flex items-start gap-2 rounded-[7px] border border-[#f3dcae] bg-[#fff8e9] p-2.5 text-[#865516]">
            <AlertTriangle className="mt-0.5 size-[15px] shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[8.5px] leading-[1.45]">Há alterações não salvas neste item.</p>
              <div className="mt-2 flex flex-wrap justify-end gap-[7px]">
                <Button
                  type="button"
                  variant="outline"
                  className={compactButton}
                  onClick={() => {
                    if (confirmCancel) {
                      setConfirmCancel(false);
                    }
                    if (pending) {
                      onKeep();
                    }
                  }}
                >
                  Continuar editando
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(compactButton, "border-[#f2c7c3] text-[#b42318] hover:bg-[#fff7f6]")}
                  onClick={() => {
                    if (pending) {
                      onDiscard();
                      return;
                    }
                    discardEdit();
                  }}
                >
                  Descartar alterações
                </Button>
              </div>
            </div>
          </div>
        ) : null}
        {editing && notice ? (
          <p role="status" className="mt-3 flex items-start gap-2 rounded-[7px] border border-[#bad1f0] bg-[#f5f9ff] p-2.5 text-[8.5px] leading-[1.45] text-[#285da8]">
            <Check className="mt-px size-[15px] shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </p>
        ) : null}
        {editing ? (
          <EapPanel
            projectId={projectId}
            phases={phases}
            selection={selection}
            access={access}
            people={people}
            names={names}
            code={code}
            projectName={projectName}
            onController={onController}
            dirtyRef={dirtyRef}
            onPhase={onPhase}
            onTask={onTask}
            onMilestone={onMilestone}
          />
        ) : phase && selection.kind === "phase" ? (
          <PhaseDetail projectId={projectId} phase={phase} code={code} access={access} names={names} onSelect={onSelect} onPhase={onPhase} onDirty={markDirty} />
        ) : phase && task ? (
          <TaskDetail projectId={projectId} phase={phase} task={task} code={code} access={access} names={names} onTask={onTask} onDirty={markDirty} />
        ) : phase && milestone ? (
          <MilestoneDetail
            projectId={projectId}
            phase={phase}
            milestone={milestone}
            code={code}
            access={access}
            names={names}
            onMilestone={onMilestone}
            onSelect={onSelect}
            onCorrectiveTask={onCorrectiveTask}
            onDirty={markDirty}
          />
        ) : (
          <p className={paragraph}>Este item não está mais na EAP carregada.</p>
        )}
      </div>
      <footer className={cn("flex shrink-0 items-center justify-end gap-[7px] border-t border-[#e4e7ec] bg-white px-6", editing ? "h-[74px]" : "h-[72px]")}>
        {editing ? (
          <>
            <Button type="button" variant="outline" className={secondaryButton} onClick={cancelEdit}>
              Cancelar
            </Button>
            <Button type="button" className={cn(primaryButton, "gap-1.5")} disabled={editorLocked} loading={editorSaving} onClick={() => saveRef.current()}>
              <Check aria-hidden="true" />
              {editorSaving ? "Salvando…" : "Salvar alterações"}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" className={secondaryButton} onClick={onClose}>
            Fechar
          </Button>
        )}
        {!editing && phase && selection.kind === "phase" && canEditItem(access, phase.createdBy) ? (
          <Button type="button" className={primaryButton} onClick={() => setEditing(true)}>
            Editar fase
          </Button>
        ) : null}
        {!editing && task && task.calculatedStatus !== "CANCELADA" && canUpdateTaskProgress(access, task) ? (
          <Button type="button" className={primaryButton} onClick={() => setEditing(true)}>
            Atualizar andamento
          </Button>
        ) : null}
        {!editing && task && task.calculatedStatus === "CANCELADA" && access.canManageStructure ? (
          <Button type="button" className={primaryButton} onClick={() => setEditing(true)}>
            Reativar tarefa
          </Button>
        ) : null}
        {!editing && milestone && milestone.status === "ENTREGUE" && canHomologateMilestone(access, milestone) ? (
          <Button type="button" className={primaryButton} onClick={() => document.getElementById("eap-milestone-decision")?.scrollIntoView({ block: "nearest" })}>
            Registrar decisão
          </Button>
        ) : null}
        {!editing && milestone && canEditItem(access, milestone.createdBy) && !(milestone.status === "ENTREGUE" && canHomologateMilestone(access, milestone)) ? (
          <Button type="button" className={primaryButton} onClick={() => setEditing(true)}>
            Editar marco
          </Button>
        ) : null}
      </footer>
    </div>
  );
}

function PhaseDetail({
  projectId,
  phase,
  code,
  access,
  names,
  onSelect,
  onPhase,
  onDirty,
}: {
  projectId: string;
  phase: ProjectPhaseView;
  code: string;
  access: EapAccess;
  names: Map<string, string> | null;
  onSelect: (selection: EapSelection) => void;
  onPhase: (phase: ProjectPhaseView) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const progress = phaseProgress(phase);
  async function refresh() {
    const response = await getEapPhase(projectId, phase.id);
    if (response.status === 200) {
      onPhase(presentPhase(response.data, { tasks: phase.tasks, milestones: phase.milestones }, names));
    }
  }
  const tasks = phase.tasks;
  const milestones = phase.milestones;
  const known = tasks !== null && milestones !== null;
  const pending = known
    ? [
        ...tasks
          .filter((task) => task.calculatedStatus !== "CONCLUIDA" && task.calculatedStatus !== "CANCELADA")
          .map((task) => ({ id: task.id, title: task.title, label: task.statusLabel, kind: taskStatusKind(task.calculatedStatus), blocked: task.hasImpediment || task.status === "IMPEDIDA", overdue: taskIsOverdue(task), selection: { kind: "task" as const, phaseId: phase.id, taskId: task.id } })),
        ...milestones
          .filter((milestone) => milestone.status !== "APROVADO")
          .map((milestone) => ({ id: milestone.id, title: milestone.title, label: milestone.statusLabel, kind: milestoneStatusKind(milestone.status), blocked: false, overdue: milestoneIsOverdue(milestone), selection: { kind: "milestone" as const, phaseId: phase.id, milestoneId: milestone.id } })),
      ]
    : null;
  return (
    <div>
      <Topline type="phase" code={code} label={phase.statusLabel} kind={phaseStatusKind(phase.calculatedStatus)} />
      <Section label="Descrição da fase">
        <p className={paragraph}>{phase.description?.trim() || "Nenhuma descrição registrada."}</p>
      </Section>
      {progress.kind === "value" ? (
        <Section label="Andamento consolidado" extra={<strong className="text-[12px] text-[#285da8]">{formatBasis(progress.basisPoints)}%</strong>}>
          <Progress
            value={basisToPercent(progress.basisPoints)}
            aria-label="Andamento consolidado da fase"
            className={progressClass}
          />
          <span className="mt-[9px] block text-[8.5px] leading-normal text-[#8a94a6]">Calculado a partir das tarefas concluídas e marcos formalmente aceitos.</span>
        </Section>
      ) : (
        <div className="my-4 flex items-start gap-2.5 rounded-lg border border-[#e4e7ec] bg-[#f8f9fb] p-[13px] text-[#475467]">
          <Info className="size-4 shrink-0 text-[#667085]" aria-hidden="true" />
          <span>
            <strong className="mb-[3px] block text-[10.5px]">{progressLabel(progress)}</strong>
            <span className="block text-[9px] text-[#667085]">
              {progress.kind === "empty" ? "Inclua tarefas ou marcos para calcular o andamento." : "O percentual desta fase não está disponível."}
            </span>
          </span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 border-t border-[#edf0f3] py-[18px]">
        <Metric value={tasks ? String(tasks.length) : "—"} label="Tarefas" />
        <Metric value={milestones ? String(milestones.length) : "—"} label="Marcos" />
        <Metric value={pending ? String(pending.length) : "—"} label="Pendências" />
      </div>
      <Section label="Pendências da fase">
        {pending === null ? (
          <p className={paragraph}>Não foi possível consultar as pendências desta fase.</p>
        ) : pending.length === 0 ? (
          <p className={cn(emptyInline, "border-[#bfe4d5] bg-[#f0faf6] text-[#157454]")}>
            <Check className="size-3.5" aria-hidden="true" /> Não há pendências nesta fase.
          </p>
        ) : (
          <ul className="flex flex-col gap-[7px]">
            {pending.map((item) => (
              <li key={item.id}>
                <button type="button" className="grid min-h-[35px] w-full grid-cols-[12px_minmax(0,1fr)_auto] items-center gap-2 rounded-[7px] border border-[#edf0f3] px-[9px] text-left text-[9.5px] text-[#475467] hover:bg-[#f8fbff]" onClick={() => onSelect(item.selection)}>
                  <PendingSignal blocked={item.blocked} overdue={item.overdue} />
                  <span className="truncate">{item.title}</span>
                  <EapStatusBadge kind={item.kind} label={item.label} size="sm" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <div className="grid grid-cols-2 gap-2.5 border-t border-[#edf0f3] py-5">
        <Fact icon={<User className="size-[17px]" aria-hidden="true" />} label="Responsável" value={phase.responsibleName ?? "Não informado"} />
        <Fact icon={<Calendar className="size-[17px]" aria-hidden="true" />} label="Término planejado" value={vigenteText(phase.dates) ?? "Não informado"} overdue={phaseIsOverdue(phase)} note={phaseIsOverdue(phase) ? "Em atraso" : null} />
      </div>
      <Section label="Critério de conclusão">
        <p className={paragraph}>{phase.completionCriteria?.trim() || "Nenhum critério registrado."}</p>
      </Section>
      <Section label="Evidências vinculadas">
        <Suspense fallback={<SkeletonList rows={2} label="Consultando evidências" rowClassName="h-[45px]" />}>
          <EvidenceList projectId={projectId} parent={{ phaseId: phase.id }} />
        </Suspense>
      </Section>
      <Section label="Planejamento e prazos">
        <EapSchedule
          projectId={projectId}
          target={{ entityType: "PHASE", phaseId: phase.id }}
          schedule={phase.schedule}
          state={phase.calculatedStatus === "CONCLUIDA" ? "DONE" : "OPEN"}
          closed={phase.status === "CONCLUIDA"}
          canReschedule={canReschedule(access)}
          consolidated={phase.consolidated}
          actualOrigin="Datas reais registradas na fase. Campos vazios são preenchidos pelas tarefas e marcos; o término real só é registrado com a fase concluída."
          onDirtyChange={onDirty}
          onSaved={refresh}
        />
        {canReschedule(access) ? (
          <div className="mt-3 flex justify-end">
            <PhaseActualCorrection projectId={projectId} phase={phase} onSaved={refresh} />
          </div>
        ) : null}
      </Section>
      <Section label="Histórico de alterações">
        <EapHistory projectId={projectId} entityType="PHASE" entityId={phase.id} refreshKey={detailKey(phase)} />
      </Section>
    </div>
  );
}

function detailKey(item: object) {
  return JSON.stringify({ ...item, tasks: undefined, milestones: undefined });
}

function TaskDetail({
  projectId,
  phase,
  task,
  code,
  access,
  names,
  onTask,
  onDirty,
}: {
  projectId: string;
  phase: ProjectPhaseView;
  task: ProjectTaskView;
  code: string;
  access: EapAccess;
  names: Map<string, string> | null;
  onTask: (task: ProjectTaskView) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const canUpdate = canUpdateTaskProgress(access, task);
  const [draft, setDraft] = useState(task.progressPercent);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completionKey, setCompletionKey] = useState(0);
  const [completionDirty, setCompletionDirty] = useState(false);
  const [scheduleDirty, setScheduleDirty] = useState(false);
  const [reopenTarget, setReopenTarget] = useState<number | null>(null);
  const [reopenText, setReopenText] = useState("");
  const [reopening, setReopening] = useState(false);
  const { errors: reopenErrors, validate: validateReopen, clear: clearReopen, reset: resetReopen } = useFieldErrors<"text">();
  const overdue = taskIsOverdue(task);
  const blocked = task.hasImpediment || task.status === "IMPEDIDA";
  const locked = task.calculatedStatus === "CANCELADA";
  const concluded = task.calculatedStatus === "CONCLUIDA";
  const canComplete = canUpdate && !locked && !concluded;

  const reopenDirty = reopenTarget !== null && reopenText.trim() !== "";

  useEffect(() => {
    onDirty(completionDirty || scheduleDirty || reopenDirty);
  }, [completionDirty, scheduleDirty, reopenDirty, onDirty]);

  function openCompletion() {
    setFeedback(null);
    setCompletionKey((value) => value + 1);
    setCompleting(true);
  }

  function closeCompletion() {
    setCompleting(false);
    setCompletionDirty(false);
  }

  async function save(percent: number) {
    if (!canUpdate || percent === task.progressPercent) {
      setFeedback(percent === task.progressPercent ? "O percentual registrado já está neste valor." : null);
      return;
    }
    // 100% é conclusão: segue o mesmo fluxo de "Concluir tarefa", com as datas reais confirmadas.
    if (percent === 100) {
      setDraft(task.progressPercent);
      openCompletion();
      return;
    }
    // Baixar o andamento de uma tarefa concluída é reabertura: exige justificativa.
    if (concluded) {
      setReopenTarget(percent);
      setReopenText("");
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const response = await updateEapTaskProgress(projectId, phase.id, task.id, { progressPercent: percent });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível atualizar o andamento.");
      }
      onTask(presentTask(response.data, names));
      notifySuccess("Andamento salvo.");
    } catch (caught) {
      reportFailure(caught, "Não foi possível atualizar o andamento.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmReopen() {
    if (reopenTarget === null) {
      return;
    }
    if (!validateReopen([["text", reopenText.trim().length < 10 && "Informe a justificativa da reabertura com ao menos 10 caracteres."]])) {
      return;
    }
    setReopening(true);
    try {
      const response = await updateEapTaskProgress(projectId, phase.id, task.id, {
        progressPercent: reopenTarget,
        justification: reopenText.trim(),
      });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível reabrir a tarefa.");
      }
      onTask(presentTask(response.data, names));
      setDraft(reopenTarget);
      setReopenTarget(null);
      setReopenText("");
      notifySuccess("Tarefa reaberta.");
    } catch (caught) {
      reportFailure(caught, "Não foi possível reabrir a tarefa.");
    } finally {
      setReopening(false);
    }
  }

  return (
    <div>
      <Topline type="task" code={code} label={task.statusLabel} kind={taskStatusKind(task.calculatedStatus)} />
      <Section label="Descrição da tarefa">
        <p className={paragraph}>{task.description?.trim() || "Nenhuma descrição registrada."}</p>
      </Section>
      {blocked ? (
        <div className={cn("mt-4 mb-0.5 grid grid-cols-[30px_minmax(0,1fr)] gap-2.5 rounded-lg border p-[13px]", impedimentTone.surface)}>
          <span className={cn("grid size-[30px] place-items-center rounded-[7px]", impedimentTone.icon)}>
            <AlertTriangle className="size-[17px]" aria-hidden="true" />
          </span>
          <span>
            <strong className={cn("mb-[5px] block text-[10px]", impedimentTone.text)}>Impedimento ativo</strong>
            <Suspense fallback={<SkeletonList rows={1} label="Consultando o motivo" rowClassName="h-4 w-3/4 rounded" />}>
              <ImpedimentNote projectId={projectId} phaseId={phase.id} task={task} />
            </Suspense>
          </span>
        </div>
      ) : null}
      <section className="border-t border-[#edf0f3] py-[18px]">
        <div className="mb-2.5 flex items-end justify-between gap-3">
          <span>
            <span className={cn(sectionLabel, "mb-[3px]")}>Andamento registrado</span>
            <small className="block text-[8px] text-[#98a2b3]">Selecione um valor para atualizar rapidamente</small>
          </span>
          <strong className="text-[12px] text-[#285da8]">{task.progressPercent}%</strong>
        </div>
        <Progress
          value={task.progressPercent}
          aria-label={`Andamento registrado de ${task.title}`}
          className={cn(
            "[&_[data-slot=progress-track]]:h-[7px] [&_[data-slot=progress-track]]:bg-[#e9eef5]",
            task.calculatedStatus === "CONCLUIDA" && "[&_[data-slot=progress-indicator]]:bg-[#1c8b65]",
            task.calculatedStatus === "CANCELADA" && "[&_[data-slot=progress-indicator]]:bg-[#98a2b3]",
            task.calculatedStatus !== "CONCLUIDA" && task.calculatedStatus !== "CANCELADA" && "[&_[data-slot=progress-indicator]]:bg-[#2873cf]",
          )}
        />
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {PERCENT_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              disabled={!canUpdate || saving || locked || completing || reopenTarget !== null}
              className={cn(
                "h-[29px] min-w-0 rounded-[6px] border text-[8.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                draft === value
                  ? "border-[#8eb4e7] bg-[#edf4ff] text-[#175cd3]"
                  : "border-[#dce1e7] bg-white text-[#667085] enabled:hover:border-[#8eb4e7] enabled:hover:bg-[#edf4ff] enabled:hover:text-[#175cd3]",
              )}
              onClick={() => {
                if (value !== 100 && !concluded) {
                  setDraft(value);
                }
                void save(value);
              }}
            >
              {value}%
            </button>
          ))}
        </div>
        {canComplete && !completing ? (
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="outline" className={cn(compactButton, "border-[#bfe4d5] text-[#157454] hover:bg-[#f0faf6]")} disabled={saving} onClick={openCompletion}>
              <CircleCheck aria-hidden="true" /> Concluir tarefa
            </Button>
          </div>
        ) : null}
        {canComplete ? (
          <Reveal open={completing}>
            <TaskCompletion
              key={completionKey}
              projectId={projectId}
              phaseId={phase.id}
              task={task}
              names={names}
              onTask={onTask}
              onClose={closeCompletion}
              onDirtyChange={setCompletionDirty}
            />
          </Reveal>
        ) : null}
        {canUpdate && concluded ? (
          <Reveal open={reopenTarget !== null}>
            <div className="mt-3 flex flex-col gap-2.5 rounded-[9px] border border-[#f6d2ad] bg-[#fff8f1] p-3.5">
              <span className="block text-[9px] font-semibold tracking-[0.04em] text-[#b4570f] uppercase">Reabrir tarefa concluída</span>
              <p className="text-[8.5px] leading-[1.45] text-[#475467]">
                O andamento passa de 100% para {reopenTarget ?? 0}%. O término real registrado é retirado e fica preservado no histórico.
              </p>
              <label className="flex flex-col gap-1.5">
                <span className="flex items-baseline justify-between text-[8.5px] font-semibold text-[#475467]">
                  Justificativa da reabertura
                  <small className="text-[7.5px] font-normal text-[#98a2b3]">obrigatória</small>
                </span>
                <Textarea
                  className="min-h-[66px] rounded-[7px] border-[#d7dce3] bg-white px-2.5 py-2 text-[10px] md:text-[10px]"
                  value={reopenText}
                  onChange={(event) => {
                    setReopenText(event.target.value);
                    clearReopen("text");
                  }}
                  aria-invalid={reopenErrors.text ? true : undefined}
                  aria-describedby={reopenErrors.text ? "reopen-justification-error" : undefined}
                  placeholder="Explique por que a tarefa concluída precisa voltar a ser executada."
                />
                <FieldError id="reopen-justification-error" message={reopenErrors.text} />
              </label>
              <div className="flex flex-wrap justify-end gap-[7px]">
                <Button type="button" variant="outline" className={compactButton} disabled={reopening} onClick={() => { setReopenTarget(null); resetReopen(); }}>
                  Cancelar
                </Button>
                <Button type="button" className={cn(compactButton, "border-transparent bg-[#c4620f] text-white hover:bg-[#b4570f]")} loading={reopening} onClick={() => void confirmReopen()}>
                  <Check aria-hidden="true" /> {reopening ? "Reabrindo…" : "Confirmar reabertura"}
                </Button>
              </div>
            </div>
          </Reveal>
        ) : null}
        {!canUpdate ? <p className="mt-2 text-[8.5px] text-[#667085]">Seu acesso não permite atualizar o andamento desta tarefa.</p> : null}
        {canUpdate && locked ? <p className="mt-2 text-[8.5px] text-[#667085]">Tarefa cancelada. Somente a gestão do projeto pode reativá-la.</p> : null}
        {feedback ? <p className="mt-2 text-[8.5px] text-[#667085]" role="status">{feedback}</p> : null}
      </section>
      <div className="grid grid-cols-2 gap-2.5 border-t border-[#edf0f3] py-5">
        <Fact icon={<User className="size-[17px]" aria-hidden="true" />} label="Responsável" value={task.assigneeName || "Não informado"} />
        <Fact icon={<Calendar className="size-[17px]" aria-hidden="true" />} label="Término planejado" value={vigenteText(task.dates) ?? "Não informado"} overdue={overdue} note={overdue ? "Em atraso" : null} />
      </div>
      <Section label="Evidências vinculadas">
        <Suspense fallback={<SkeletonList rows={2} label="Consultando evidências" rowClassName="h-[45px]" />}>
          <EvidenceList
            projectId={projectId}
            parent={{ taskId: task.id }}
            emptyWarning={task.calculatedStatus === "CONCLUIDA" ? "Tarefa concluída sem as evidências exigidas. Vincule os documentos para regularizar o registro." : null}
          />
        </Suspense>
      </Section>
      <Section label="Planejamento e prazos">
        <EapSchedule
          projectId={projectId}
          target={{ entityType: "TASK", phaseId: phase.id, taskId: task.id }}
          schedule={task.schedule}
          state={concluded ? "DONE" : locked ? "CLOSED" : "OPEN"}
          closed={task.calculatedStatus === "CONCLUIDA" || task.calculatedStatus === "CANCELADA"}
          canReschedule={canReschedule(access)}
          onDirtyChange={setScheduleDirty}
          phasePlan={{ startAt: phase.schedule.plannedStartAt, endAt: phase.schedule.plannedEndAt, others: phaseItemRanges(phase, task.id) }}
          onSaved={async () => {
            const response = await getEapTask(projectId, phase.id, task.id);
            if (response.status === 200) {
              onTask(presentTask(response.data, names));
            }
          }}
        />
      </Section>
      <Section label="Histórico de alterações">
        <EapHistory projectId={projectId} entityType="TASK" entityId={task.id} refreshKey={detailKey(task)} />
      </Section>
    </div>
  );
}

/**
 * Conclusão da tarefa no próprio painel: confirma as datas reais, revisa e grava 100% numa única
 * operação. É o mesmo caminho usado ao escolher 100% no andamento, com as mesmas validações da API.
 */
function TaskCompletion({
  projectId,
  phaseId,
  task,
  names,
  onTask,
  onClose,
  onDirtyChange,
}: {
  projectId: string;
  phaseId: string;
  task: ProjectTaskView;
  names: Map<string, string> | null;
  onTask: (task: ProjectTaskView) => void;
  onClose: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const today = civilDay(new Date()) ?? "";
  const recorded = { start: civilDateInput(task.actualStartAt), end: civilDateInput(task.actualEndAt) };
  const initial = { start: recorded.start, end: recorded.end || today };
  const [step, setStep] = useState<"editing" | "review">("editing");
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const { errors, validate, clear, reset } = useFieldErrors<"start" | "end" | "justification">();
  const correction = correctsActualDate(recorded.start, start) || correctsActualDate(recorded.end, end);

  useEffect(() => {
    onDirtyChange(start !== initial.start || end !== initial.end || justification.trim() !== "");
  }, [start, end, justification, initial.start, initial.end, onDirtyChange]);

  function review() {
    // O problema de datas aparece no campo a corrigir: início ausente ou futuro, senão o término.
    const datesProblem = actualDatesProblem({ start, end, today, requireBoth: true });
    const valid = validate([
      [!start || start > today ? "start" : "end", datesProblem],
      ["justification", correction && justification.trim().length < 10 && "Informe a justificativa da correção com ao menos 10 caracteres."],
    ]);
    if (valid) {
      setStep("review");
    }
  }

  async function confirm() {
    setSaving(true);
    try {
      const response = await updateEapTaskProgress(projectId, phaseId, task.id, {
        progressPercent: 100,
        ...(start !== recorded.start ? { actualStartAt: civilDateToIso(start) } : {}),
        ...(end !== recorded.end ? { actualEndAt: civilDateToIso(end) } : {}),
        ...(justification.trim() ? { justification: justification.trim() } : {}),
      });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível concluir a tarefa.");
      }
      onTask(presentTask(response.data, names));
      notifySuccess("Tarefa concluída.");
      onClose();
    } catch (caught) {
      reportFailure(caught, "Não foi possível concluir a tarefa.");
      setStep("editing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-[9px] border border-[#bfe4d5] bg-[#f6fcf9] p-3.5">
      <span className="block text-[9px] font-semibold tracking-[0.04em] text-[#157454] uppercase">Concluir tarefa</span>
      <Reveal open={step === "editing"}>
        <div className="flex flex-col gap-2.5">
          <p className="text-[8.5px] leading-[1.45] text-[#475467]">Confirme as datas reais. A conclusão grava o andamento em 100% e recalcula a fase.</p>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <DateField label="Início real" hint={recorded.start ? undefined : "obrigatório"} value={start} onChange={(value) => { setStart(value); clear("start"); }} error={errors.start} />
            <DateField label="Término real" hint={recorded.end ? undefined : "sugestão: hoje"} value={end} onChange={(value) => { setEnd(value); clear("end"); }} error={errors.end} />
          </div>
          <Reveal open={correction}>
            <label className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between text-[8.5px] font-semibold text-[#475467]">
                Justificativa da correção
                <small className="text-[7.5px] font-normal text-[#98a2b3]">obrigatória · altera data real já registrada</small>
              </span>
              <Textarea
                className="min-h-[66px] rounded-[7px] border-[#d7dce3] bg-white px-2.5 py-2 text-[10px] md:text-[10px]"
                value={justification}
                onChange={(event) => {
                  setJustification(event.target.value);
                  clear("justification");
                }}
                aria-invalid={errors.justification ? true : undefined}
                aria-describedby={errors.justification ? "completion-justification-error" : undefined}
                placeholder="Explique por que a data real registrada está sendo corrigida."
              />
              <FieldError id="completion-justification-error" message={errors.justification} />
            </label>
          </Reveal>
        </div>
      </Reveal>
      <Reveal open={step === "review"}>
        <dl className="flex flex-col gap-1 rounded-[7px] border border-[#d5ece2] bg-white p-2.5 text-[8.5px] leading-[1.5] text-[#475467]">
          <ReviewLine label="Andamento">{task.progressPercent}% → 100%</ReviewLine>
          <ReviewLine label="Início real">{reviewDate(recorded.start, start)}</ReviewLine>
          <ReviewLine label="Término real">{reviewDate(recorded.end, end)}</ReviewLine>
          {justification.trim() ? <ReviewLine label="Justificativa">{justification.trim()}</ReviewLine> : null}
          <ReviewLine label="Evidências">
            <Suspense fallback="Consultando…">
              <EvidenceCount projectId={projectId} taskId={task.id} />
            </Suspense>
          </ReviewLine>
          <span className="mt-1 block text-[#667085]">Marcos da fase continuam dependendo de entrega e homologação formais.</span>
        </dl>
      </Reveal>
      <div className="flex flex-wrap justify-end gap-[7px]">
        <Button
          type="button"
          variant="outline"
          className={compactButton}
          disabled={saving}
          onClick={() => {
            reset();
            if (step === "review") {
              setStep("editing");
              return;
            }
            onClose();
          }}
        >
          {step === "review" ? "Voltar" : "Cancelar"}
        </Button>
        {step === "review" ? (
          <Button type="button" className={cn(compactButton, "border-transparent bg-[#1c8b65] text-white hover:bg-[#157454]")} loading={saving} onClick={() => void confirm()}>
            <Check aria-hidden="true" /> {saving ? "Concluindo…" : "Confirmar conclusão"}
          </Button>
        ) : (
          <Button type="button" className={cn(compactButton, "border-transparent bg-[#175cd3] text-white hover:bg-[#144ca8]")} onClick={review}>
            Revisar conclusão
          </Button>
        )}
      </div>
    </div>
  );
}

function reviewDate(previous: string, next: string) {
  const text = next ? formatCivilDate(next) : "Não informada";
  return previous && previous !== next ? `${formatCivilDate(previous)} → ${text} (correção)` : text;
}

function ReviewLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-2">
      <dt className="text-[#98a2b3]">{label}</dt>
      <dd className="break-words whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

/** Não há regra formal de evidência obrigatória por tarefa: a revisão apenas alerta quando falta. */
function EvidenceCount({ projectId, taskId }: { projectId: string; taskId: string }) {
  const state = use(evidenceRequest(projectId, { taskId }));
  if (state.status === "error") {
    return <>{state.message}</>;
  }
  if (state.items.length === 0) {
    return <span className="text-[#b54708]">Nenhuma evidência vinculada. Vincule os documentos exigidos em “Atualizar andamento”.</span>;
  }
  return <>{state.items.length === 1 ? "1 evidência vinculada" : `${state.items.length} evidências vinculadas`}</>;
}

function MilestoneDetail({
  projectId,
  phase,
  milestone,
  code,
  access,
  names,
  onMilestone,
  onSelect,
  onCorrectiveTask,
  onDirty,
}: {
  projectId: string;
  phase: ProjectPhaseView;
  milestone: ProjectMilestoneView;
  code: string;
  access: EapAccess;
  names: Map<string, string> | null;
  onMilestone: (milestone: ProjectMilestoneView) => void;
  onSelect: (selection: EapSelection) => void;
  onCorrectiveTask?: (milestone: ProjectMilestoneView) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [historyRevision, setHistoryRevision] = useState(0);
  const homologation = milestone.type === "HOMOLOGACAO";
  const overdue = milestoneIsOverdue(milestone);
  const delayReason = milestoneDelayReason(milestone);
  const correctiveTasks = phase.tasks?.filter((item) => item.correctiveMilestoneId === milestone.id) ?? null;
  const needsCorrection = milestone.status === "AJUSTES_SOLICITADOS" || milestone.status === "REJEITADO";
  const showCorrective = (correctiveTasks !== null && correctiveTasks.length > 0) || needsCorrection;

  return (
    <div>
      <Topline type="milestone" code={code} label={milestone.statusLabel} kind={milestoneStatusKind(milestone.status)} />
      <MilestoneDecisionFeedback milestone={milestone} />
      <Section label="Descrição do marco">
        <p className={paragraph}>{milestone.description?.trim() || "Nenhuma descrição registrada."}</p>
      </Section>
      <Section label="Fluxo de entrega e aceite">
        <MilestoneFlow status={milestone.status} />
      </Section>
      <div className="grid grid-cols-2 gap-2.5 border-t border-[#edf0f3] py-5">
        <Fact
          icon={<Calendar className="size-[17px]" aria-hidden="true" />}
          label="Data prevista"
          value={vigenteText(milestone.dates) ?? "Não informado"}
          overdue={overdue}
          note={overdue ? (delayReason ? `Em atraso · ${delayReason.toLowerCase()}` : "Em atraso") : null}
        />
        <Fact icon={<User className="size-[17px]" aria-hidden="true" />} label="Apresentador" value={milestone.presenterName ?? "Não designado"} />
        <Fact icon={<User className="size-[17px]" aria-hidden="true" />} label="Gestor validador" value={milestone.reviewerName ?? "Gestão do projeto"} />
      </div>
      <Section label="Entrega e homologação">
        <MilestoneHomologation
          projectId={projectId}
          milestone={milestone}
          access={access}
          names={names}
          showEvidence
          onMilestone={onMilestone}
          onChanged={() => setHistoryRevision((value) => value + 1)}
        />
      </Section>
      {showCorrective ? (
        <Section label="Tarefas corretivas">
          {correctiveTasks === null ? (
            <p className={emptyInline}>Não foi possível consultar as tarefas desta fase.</p>
          ) : correctiveTasks.length === 0 ? (
            <p className={emptyInline}>Nenhuma tarefa corretiva registrada para este marco.</p>
          ) : (
            <ul className="flex flex-col gap-[7px]">
              {correctiveTasks.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="grid min-h-[35px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[7px] border border-[#edf0f3] px-[9px] text-left text-[9.5px] text-[#475467] hover:bg-[#f8fbff]"
                    onClick={() => onSelect({ kind: "task", phaseId: phase.id, taskId: item.id })}
                  >
                    <span className="truncate">{item.title}</span>
                    <EapStatusBadge kind={taskStatusKind(item.calculatedStatus)} label={item.statusLabel} size="sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {needsCorrection && access.canCreateItems && onCorrectiveTask ? (
            <div className="mt-2.5 flex justify-end">
              <Button type="button" variant="outline" className={compactButton} onClick={() => onCorrectiveTask(milestone)}>
                <Plus aria-hidden="true" /> Registrar tarefa corretiva
              </Button>
            </div>
          ) : null}
        </Section>
      ) : null}
      <Section label="Datas do marco">
        <EapSchedule
          projectId={projectId}
          target={{ entityType: "MILESTONE", phaseId: milestone.phaseId, milestoneId: milestone.id }}
          phasePlan={{ startAt: phase.schedule.plannedStartAt, endAt: phase.schedule.plannedEndAt, others: phaseItemRanges(phase, milestone.id) }}
          schedule={milestone.schedule}
          state={milestone.status === "APROVADO" ? "DONE" : "OPEN"}
          closed={milestone.status === "APROVADO"}
          canReschedule={canReschedule(access)}
          onDirtyChange={onDirty}
          onSaved={async () => {
            const response = await getEapMilestone(projectId, milestone.phaseId, milestone.id);
            if (response.status === 200) {
              onMilestone(presentMilestone(response.data, names));
            }
          }}
        />
      </Section>
      <Section label={homologation ? "Histórico de homologação" : "Histórico de entrega e aceite"}>
        <EapHistory projectId={projectId} entityType="MILESTONE" entityId={milestone.id} refreshKey={`${historyRevision}:${detailKey(milestone)}`} />
      </Section>
    </div>
  );
}

function ImpedimentNote({ projectId, phaseId, task }: { projectId: string; phaseId: string; task: ProjectTaskView }) {
  const state = use(impedimentRequest(projectId, phaseId, task));
  if (state.status === "error") {
    return <p className={impedimentText}>{state.message}</p>;
  }
  if (!state.open) {
    return <p className={impedimentText}>Impedimento sinalizado antes do registro de motivos; o motivo não foi gravado.</p>;
  }
  return (
    <>
      <p className={cn(impedimentText, "whitespace-pre-wrap")}>{state.open.description}</p>
      <small className="mt-1.5 block text-[8px] text-[#667085]">
        Registrado por {state.open.author} em {state.open.openedAt}
      </small>
    </>
  );
}

function EvidenceList({
  projectId,
  parent,
  emptyWarning = null,
}: {
  projectId: string;
  parent: EvidenceParent;
  emptyWarning?: string | null;
}) {
  const state = use(evidenceRequest(projectId, parent));
  if (state.status === "error") {
    return <p className={emptyInline}>{state.message}</p>;
  }
  if (state.items.length === 0) {
    return (
      <>
        {emptyWarning ? (
          <div className="mb-2.5 flex items-start gap-2 rounded-[7px] border border-[#f3dcae] bg-[#fff8e9] p-2.5 text-[8.5px] leading-[1.45] text-[#865516]">
            <AlertTriangle className="size-[15px] shrink-0" aria-hidden="true" />
            <span>{emptyWarning}</span>
          </div>
        ) : null}
        <p className={emptyInline}>Nenhuma evidência vinculada.</p>
      </>
    );
  }
  return (
    <ul className="flex flex-col gap-[7px]">
      {state.items.map((item) => (
        <li key={item.id} className="grid min-h-[45px] grid-cols-[29px_minmax(0,1fr)_26px] items-center gap-[9px] rounded-[7px] border border-[#e4e7ec] px-[7px] py-1.5">
          <span className="grid size-[29px] place-items-center rounded-[6px] bg-[#f0f3f6] text-[#52677e]">
            <FileText className="size-[15px]" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <strong className="mb-[3px] block truncate text-[9px] font-semibold text-[#344054]">{item.title}</strong>
            <span className="block text-[7.5px] text-[#98a2b3]">Registrada em {item.createdAt}</span>
          </span>
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Consultar ${item.title}`}
            className="grid size-[25px] place-items-center rounded-[6px] text-[#667085] hover:bg-[#f2f4f7]"
          >
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  );
}

const paragraph = "text-[11px] leading-[1.65] text-[#475467]";
const sectionLabel = "block text-[9px] font-semibold tracking-[0.04em] text-[#8a94a6] uppercase";
const impedimentText = "text-[9.5px] leading-[1.55] text-[#475467]";
const emptyInline = "flex min-h-[39px] items-center gap-1.5 rounded-[7px] border border-dashed border-[#d7dce3] bg-[#f8f9fb] px-2.5 text-[8.5px] text-[#98a2b3]";
const progressClass = "[&_[data-slot=progress-indicator]]:bg-[#2873cf] [&_[data-slot=progress-track]]:h-[7px] [&_[data-slot=progress-track]]:bg-[#e9eef5]";
const secondaryButton = "h-9 rounded-[7px] border-[#d7dce3] px-[13px] text-[11px] font-semibold text-[#344054] hover:bg-[#f8fafc]";
const primaryButton = "h-9 rounded-[7px] bg-[#175cd3] px-[13px] text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.12)] hover:bg-[#144ca8]";
const compactButton = "h-[30px] gap-[5px] rounded-[7px] border-[#d7dce3] px-[9px] text-[8.5px] font-semibold text-[#344054]";

function Topline({ type, code, label, kind }: { type: "phase" | "task" | "milestone"; code: string; label: string; kind: EapStatusKind }) {
  return (
    <div className="flex items-center gap-[9px] pb-5">
      <span className={cn("grid size-[30px] place-items-center rounded-[7px]", type === "phase" && "bg-[#e9f2ff] text-[#2865b9]", type === "task" && "bg-[#eef2f6] text-[#52677e]", type === "milestone" && "bg-[#f4ecfb] text-[#8b5bbb]")}>
        {type === "phase" ? <Folder className="size-4" aria-hidden="true" /> : null}
        {type === "task" ? <Check className="size-4" aria-hidden="true" /> : null}
        {type === "milestone" ? <Flag className="size-4" aria-hidden="true" /> : null}
      </span>
      <span className="mr-auto text-[10px] text-[#667085]">EAP {code}</span>
      <EapStatusBadge kind={kind} label={label} />
    </div>
  );
}

function Section({ label, extra, children }: { label: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-[#edf0f3] py-[19px]">
      <div className={cn("flex items-center justify-between gap-3", extra ? "mb-2.5" : "mb-2")}>
        <span className={sectionLabel}>{label}</span>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-[#e4e7ec] bg-[#fafbfc] p-3">
      <strong className="mb-[3px] block text-[16px] text-[#253248]">{value}</strong>
      <span className="block text-[8.5px] text-[#8a94a6]">{label}</span>
    </div>
  );
}

function PendingSignal({ blocked, overdue }: { blocked: boolean; overdue: boolean }) {
  if (overdue) {
    return (
      <span className={overdueTone.text}>
        <Clock className="size-3" aria-hidden="true" />
        <span className="sr-only">Atrasado{blocked ? " e impedido" : ""}</span>
      </span>
    );
  }
  if (blocked) {
    return (
      <span className={impedimentTone.text}>
        <AlertTriangle className="size-3" aria-hidden="true" />
        <span className="sr-only">Impedido</span>
      </span>
    );
  }
  return <span className="size-[5px] justify-self-center rounded-full bg-muted-foreground/50" aria-hidden="true" />;
}

function Fact({ icon, label, value, overdue = false, note }: { icon: ReactNode; label: string; value: string; overdue?: boolean; note?: string | null }) {
  return (
    <div className={cn("flex min-h-[67px] items-center gap-[9px] rounded-lg border p-[11px]", overdue ? overdueTone.surface : "border-[#e4e7ec]")}>
      <span className={cn("grid size-[29px] shrink-0 place-items-center rounded-[6px]", overdue ? overdueTone.icon : "bg-[#edf4ff] text-[#2864bb]")}>{icon}</span>
      <span className="min-w-0">
        <span className="mb-1 block text-[7.5px] font-semibold tracking-[0.04em] text-[#8a94a6] uppercase">{label}</span>
        <strong className="block truncate text-[9.5px] text-[#344054]">{value}</strong>
        {note ? <em className={cn("mt-[3px] block text-[8px] font-semibold not-italic", overdueTone.text)}>{note}</em> : null}
      </span>
    </div>
  );
}

export function eapCode(phases: ProjectPhaseView[], selection: EapSelection) {
  const phaseIndex = phases.findIndex((item) => item.id === selection.phaseId);
  if (phaseIndex < 0) {
    return "—";
  }
  if (selection.kind === "phase") {
    return String(phaseIndex + 1);
  }
  const phase = phases[phaseIndex];
  if (!phase) {
    return "—";
  }
  if (selection.kind === "task") {
    const index = phase.tasks?.findIndex((item) => item.id === selection.taskId) ?? -1;
    return index < 0 ? "—" : `${phaseIndex + 1}.${index + 1}`;
  }
  const index = phase.milestones?.findIndex((item) => item.id === selection.milestoneId) ?? -1;
  return index < 0 ? "—" : `${phaseIndex + 1}.${index + 1}`;
}
