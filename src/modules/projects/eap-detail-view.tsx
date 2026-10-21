"use client";

import { Suspense, use, useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { AlertTriangle, Calendar, Check, ChevronRight, FileText, Flag, Folder, User, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/fetcher";
import { deliverEapMilestone, reviewEapMilestone, updateEapTaskProgress } from "@/lib/api/generated/eap/eap";
import { cn } from "@/lib/utils";

import { canEditItem, canReviewMilestone, canUpdateTaskProgress, type EapAccess } from "./eap-access";
import { evidenceRequest, type EvidenceParent } from "./eap-evidence-cache";
import { EapHistory } from "./eap-history";
import { EapPanel, type EapPerson, type EapSaveController } from "./eap-panel";
import { presentMilestone, presentTask, type ProjectMilestoneView, type ProjectPhaseView, type ProjectTaskView } from "./eap-present";
import { basisToPercent, formatBasis, milestoneIsOverdue, phaseProgress, progressLabel, taskIsOverdue, vigenteText } from "./eap-progress";
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
}) {
  const [editing, setEditing] = useState(initialEditing);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const saveRef = useRef<() => void>(() => undefined);
  const onController = useCallback((controller: EapSaveController) => {
    saveRef.current = controller.save;
    setEditorSaving((current) => (current === controller.saving ? current : controller.saving));
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
          {editing ? (
            <span className="mt-[7px] flex items-center gap-1.5 text-[8.5px] font-semibold text-[#8a6116]">
              <span className="size-1.5 rounded-full bg-[#e0a130]" />
              Alterações não salvas
            </span>
          ) : null}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" className="text-[#667085]" aria-label="Fechar painel" onClick={onClose}>
          <X />
        </Button>
      </header>
      <div className={`min-h-0 flex-1 overflow-y-auto ${editing ? "bg-[#f8fafc] px-6" : "px-[22px] py-5"}`}>
        {confirmCancel || (editing && pending) ? (
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
          <PhaseDetail projectId={projectId} phase={phase} code={code} onSelect={onSelect} />
        ) : phase && task ? (
          <TaskDetail projectId={projectId} phase={phase} task={task} code={code} access={access} names={names} onTask={onTask} />
        ) : phase && milestone ? (
          <MilestoneDetail projectId={projectId} milestone={milestone} code={code} access={access} names={names} onMilestone={onMilestone} />
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
            <Button type="button" className={cn(primaryButton, "gap-1.5")} disabled={editorSaving} onClick={() => saveRef.current()}>
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
        {!editing && task && canUpdateTaskProgress(access, task) ? (
          <Button type="button" className={primaryButton} onClick={() => setEditing(true)}>
            Atualizar andamento
          </Button>
        ) : null}
        {!editing && milestone && milestone.status === "ENTREGUE" && canReviewMilestone(access, milestone.deliveredById) ? (
          <Button type="button" className={primaryButton} onClick={() => document.getElementById("eap-milestone-decision")?.scrollIntoView({ block: "nearest" })}>
            Registrar decisão
          </Button>
        ) : null}
        {!editing && milestone && canEditItem(access, milestone.createdBy) && !(milestone.status === "ENTREGUE" && canReviewMilestone(access, milestone.deliveredById)) ? (
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
  onSelect,
}: {
  projectId: string;
  phase: ProjectPhaseView;
  code: string;
  onSelect: (selection: EapSelection) => void;
}) {
  const progress = phaseProgress(phase);
  const tasks = phase.tasks;
  const milestones = phase.milestones;
  const known = tasks !== null && milestones !== null;
  const pending = known
    ? [
        ...tasks
          .filter((task) => task.status !== "CONCLUIDA" && task.status !== "CANCELADA")
          .map((task) => ({ id: task.id, title: task.title, label: task.statusLabel, blocked: task.hasImpediment || task.status === "IMPEDIDA", selection: { kind: "task" as const, phaseId: phase.id, taskId: task.id } })),
        ...milestones
          .filter((milestone) => milestone.status !== "APROVADO")
          .map((milestone) => ({ id: milestone.id, title: milestone.title, label: milestone.statusLabel, blocked: false, selection: { kind: "milestone" as const, phaseId: phase.id, milestoneId: milestone.id } })),
      ]
    : null;

  return (
    <div>
      <Topline type="phase" code={code} label={phase.statusLabel} kind={phaseKind(phase.status)} />
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
        <div className="my-4 flex items-start gap-2.5 rounded-lg border border-[#f3dcae] bg-[#fff8e9] p-[13px] text-[#9c5c0a]">
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong className="mb-[3px] block text-[10.5px]">{progressLabel(progress)}</strong>
            <span className="block text-[9px] text-[#9b6c2d]">
              {progress.kind === "incomplete" ? "Inclua tarefas ou marcos para calcular o andamento." : "O percentual desta fase não está disponível."}
            </span>
          </span>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 border-t border-[#edf0f3] py-[18px]">
        <Metric value={tasks ? String(tasks.length) : "—"} label="Tarefas" />
        <Metric value={milestones ? String(milestones.length) : "—"} label="Marcos" />
        <Metric value={pending ? String(pending.length) : "—"} label="Pendências" warning={Boolean(pending && pending.length > 0)} />
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
                <button type="button" className="grid min-h-[35px] w-full grid-cols-[7px_minmax(0,1fr)_auto] items-center gap-2 rounded-[7px] border border-[#edf0f3] px-[9px] text-left text-[9.5px] text-[#475467] hover:bg-[#f8fbff]" onClick={() => onSelect(item.selection)}>
                  <span className={cn("size-[5px] rounded-full", item.blocked ? "bg-[#d23b31]" : "bg-[#e0a130]")} />
                  <span className="truncate">{item.title}</span>
                  <StatusPill label={item.label} kind={item.blocked ? "attention" : "pending"} small />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <div className="grid grid-cols-2 gap-2.5 border-t border-[#edf0f3] py-5">
        <Fact icon={<User className="size-[17px]" aria-hidden="true" />} label="Responsável" value={phase.responsibleName ?? "Não informado"} />
        <Fact icon={<Calendar className="size-[17px]" aria-hidden="true" />} label="Prazo vigente" value={vigenteText(phase.dates) ?? "Não informado"} />
      </div>
      <Section label="Critério de conclusão">
        <p className={paragraph}>{phase.completionCriteria?.trim() || "Nenhum critério registrado."}</p>
      </Section>
      <Section label="Evidências vinculadas">
        <Suspense fallback={<p className={emptyInline}>Consultando evidências…</p>}>
          <EvidenceList projectId={projectId} parent={{ phaseId: phase.id }} />
        </Suspense>
      </Section>
      <PlanningDates dates={phase.dates} />
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
}: {
  projectId: string;
  phase: ProjectPhaseView;
  task: ProjectTaskView;
  code: string;
  access: EapAccess;
  names: Map<string, string> | null;
  onTask: (task: ProjectTaskView) => void;
}) {
  const canUpdate = canUpdateTaskProgress(access, task);
  const [draft, setDraft] = useState(task.progressPercent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const overdue = taskIsOverdue(task);
  const blocked = task.hasImpediment || task.status === "IMPEDIDA";
  const locked = task.status === "CONCLUIDA" || task.status === "CANCELADA";

  async function save(percent: number) {
    if (!canUpdate || percent === task.progressPercent) {
      setFeedback(percent === task.progressPercent ? "O percentual registrado já está neste valor." : null);
      return;
    }
    if (task.status === "CONCLUIDA" && percent !== 100) {
      setError("Tarefa concluída deve permanecer em 100%.");
      return;
    }
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await updateEapTaskProgress(projectId, phase.id, task.id, { progressPercent: percent });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível atualizar o andamento.");
      }
      onTask(presentTask(response.data, names));
      setFeedback("Andamento salvo.");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não foi possível atualizar o andamento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Topline type="task" code={code} label={task.statusLabel} kind={taskKind(task.status)} />
      <Section label="Descrição da tarefa">
        <p className={paragraph}>{task.description?.trim() || "Nenhuma descrição registrada."}</p>
      </Section>
      {blocked ? (
        <div className="mt-4 mb-0.5 grid grid-cols-[30px_minmax(0,1fr)] gap-2.5 rounded-lg border border-[#f2c7c3] bg-[#fff7f6] p-[13px]">
          <span className="grid size-[30px] place-items-center rounded-[7px] bg-[#fde7e5] text-[#b42318]">
            <AlertTriangle className="size-[17px]" aria-hidden="true" />
          </span>
          <span>
            <strong className="mb-[5px] block text-[10px] text-[#9f2219]">Impedimento ativo</strong>
            <p className="text-[9.5px] leading-[1.55] text-[#74534f]">Esta tarefa está marcada com impedimento.</p>
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
            task.status === "CONCLUIDA" && "[&_[data-slot=progress-indicator]]:bg-[#1c8b65]",
            task.status === "CANCELADA" && "[&_[data-slot=progress-indicator]]:bg-[#98a2b3]",
            task.status !== "CONCLUIDA" && task.status !== "CANCELADA" && "[&_[data-slot=progress-indicator]]:bg-[#2873cf]",
          )}
        />
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {PERCENT_OPTIONS.map((value) => (
            <button
              key={value}
              type="button"
              disabled={!canUpdate || saving || locked}
              className={cn(
                "h-[29px] min-w-0 rounded-[6px] border text-[8.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                draft === value
                  ? "border-[#8eb4e7] bg-[#edf4ff] text-[#175cd3]"
                  : "border-[#dce1e7] bg-white text-[#667085] enabled:hover:border-[#8eb4e7] enabled:hover:bg-[#edf4ff] enabled:hover:text-[#175cd3]",
              )}
              onClick={() => {
                setDraft(value);
                void save(value);
              }}
            >
              {value}%
            </button>
          ))}
        </div>
        {!canUpdate ? <p className="mt-2 text-[8.5px] text-[#667085]">Seu acesso não permite atualizar o andamento desta tarefa.</p> : null}
        {error ? <p className="mt-2 text-[8.5px] text-destructive">{error}</p> : null}
        {feedback ? <p className="mt-2 text-[8.5px] text-[#667085]" role="status">{feedback}</p> : null}
      </section>
      <div className="grid grid-cols-2 gap-2.5 border-t border-[#edf0f3] py-5">
        <Fact icon={<User className="size-[17px]" aria-hidden="true" />} label="Responsável" value={task.assigneeName || "Não informado"} />
        <Fact icon={<Calendar className="size-[17px]" aria-hidden="true" />} label="Prazo vigente" value={vigenteText(task.dates) ?? "Não informado"} overdue={overdue} note={overdue ? "Em atraso" : null} />
      </div>
      <Section label="Evidências vinculadas">
        <Suspense fallback={<p className={emptyInline}>Consultando evidências…</p>}>
          <EvidenceList
            projectId={projectId}
            parent={{ taskId: task.id }}
            emptyWarning={task.status === "CONCLUIDA" ? "Tarefa concluída sem as evidências exigidas. Vincule os documentos para regularizar o registro." : null}
          />
        </Suspense>
      </Section>
      <Section label="Histórico de alterações">
        <EapHistory projectId={projectId} entityType="TASK" entityId={task.id} refreshKey={detailKey(task)} />
      </Section>
    </div>
  );
}

function MilestoneDetail({
  projectId,
  milestone,
  code,
  access,
  names,
  onMilestone,
}: {
  projectId: string;
  milestone: ProjectMilestoneView;
  code: string;
  access: EapAccess;
  names: Map<string, string> | null;
  onMilestone: (milestone: ProjectMilestoneView) => void;
}) {
  const flow = milestone.status === "APROVADO" ? "accepted" : milestone.status === "ENTREGUE" ? "delivered" : "pending";
  const canReview = canReviewMilestone(access, milestone.deliveredById);
  const selfDelivery = milestone.deliveredById === access.userId;
  const [note, setNote] = useState("");
  const [returning, setReturning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overdue = milestoneIsOverdue(milestone);

  async function deliver() {
    setSaving(true);
    setError(null);
    try {
      const response = await deliverEapMilestone(projectId, milestone.phaseId, milestone.id, {});
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível registrar a entrega.");
      }
      onMilestone(presentMilestone(response.data, names));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não foi possível registrar a entrega.");
    } finally {
      setSaving(false);
    }
  }

  async function review(decision: "APROVADO" | "REJEITADO") {
    if (decision === "REJEITADO" && note.trim().length < 10) {
      setError("A rejeição exige justificativa com ao menos 10 caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await reviewEapMilestone(projectId, milestone.phaseId, milestone.id, {
        decision,
        ...(decision === "REJEITADO" ? { note: note.trim() } : {}),
      });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível registrar a decisão.");
      }
      onMilestone(presentMilestone(response.data, names));
      setReturning(false);
      setNote("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não foi possível registrar a decisão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Topline type="milestone" code={code} label={milestone.statusLabel} kind={milestoneKind(milestone.status)} />
      <Section label="Descrição do marco">
        <p className={paragraph}>{milestone.description?.trim() || "Nenhuma descrição registrada."}</p>
      </Section>
      <Section label="Fluxo de entrega e aceite">
        <ol className="relative mt-3.5 mb-[7px] grid grid-cols-3">
          <span className="absolute top-3 right-[16.6%] left-[16.6%] h-0.5 bg-[#e2e7ed]" aria-hidden="true" />
          <FlowStep index={1} label="Pendente" active={flow !== "pending"} done={flow === "accepted"} />
          <FlowStep index={2} label="Entregue" active={flow === "delivered" || flow === "accepted"} done={flow === "accepted"} />
          <FlowStep index={3} label="Aceito" active={flow === "accepted"} done={flow === "accepted"} />
        </ol>
        {flow === "delivered" ? (
          <p className="mt-3.5 flex items-start gap-2 rounded-[7px] bg-[#fff8e9] p-2.5 text-[8.5px] leading-[1.45] text-[#865516]">
            <AlertTriangle className="size-[15px] shrink-0" aria-hidden="true" />
            <span>Entrega registrada. O progresso permanece em 0% até o aceite formal.</span>
          </p>
        ) : null}
        {milestone.status === "REJEITADO" ? (
          <p className="mt-3.5 flex items-start gap-2 rounded-[7px] bg-[#fff4f1] p-2.5 text-[8.5px] leading-[1.45] text-[#9f3a22]">
            <AlertTriangle className="size-[15px] shrink-0" aria-hidden="true" />
            <span>Este marco foi devolvido para ajustes e não conta como aceito.</span>
          </p>
        ) : null}
        {milestone.status === "PENDENTE" && access.canDeliverMilestone ? (
          <div className="mt-3 flex justify-end">
            <Button type="button" variant="outline" className={compactButton} disabled={saving} onClick={() => void deliver()}>
              {saving ? "Registrando…" : "Registrar entrega"}
            </Button>
          </div>
        ) : null}
      </Section>
      <div className="grid grid-cols-2 gap-2.5 border-t border-[#edf0f3] py-5">
        <Fact icon={<Calendar className="size-[17px]" aria-hidden="true" />} label="Prazo vigente" value={vigenteText(milestone.dates) ?? "Não informado"} overdue={overdue} note={overdue ? "Em atraso" : null} />
        <Fact icon={<Check className="size-[17px]" aria-hidden="true" />} label="Entrega registrada por" value={milestone.deliveredBy ?? "Ainda não registrada"} />
      </div>
      <Section label="Evidências da entrega">
        <Suspense fallback={<p className={emptyInline}>Consultando evidências…</p>}>
          <EvidenceList projectId={projectId} parent={{ milestoneId: milestone.id }} />
        </Suspense>
      </Section>
      {milestone.status === "ENTREGUE" && canReview ? (
        <section id="eap-milestone-decision" className="mt-[17px] mb-0.5 rounded-[9px] border border-[#bad1f0] bg-[#f5f9ff] p-3.5">
          <span className={cn(sectionLabel, "mb-[5px] text-[#3971ba]")}>Decisão de aceite</span>
          <strong className="block text-[10px] text-[#253d60]">Esta entrega está aguardando análise</strong>
          <p className="mt-[5px] text-[8.5px] text-[#667b98]">Confira as evidências antes de aceitar ou devolver para ajustes.</p>
          {returning ? (
            <Textarea className="mt-3 min-h-[66px] rounded-[7px] border-[#d7dce3] bg-white px-2.5 py-2 text-[10px] md:text-[10px]" aria-label="Justificativa da devolução" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Justificativa da devolução" />
          ) : null}
          <div className="mt-[13px] flex justify-end gap-[7px]">
            <Button type="button" variant="outline" className={cn(secondaryButton, "text-[#9f2219]")} disabled={saving} onClick={() => (returning ? void review("REJEITADO") : setReturning(true))}>
              Devolver
            </Button>
            <Button type="button" className={cn(primaryButton, "gap-1.5")} disabled={saving} onClick={() => void review("APROVADO")}>
              <Check aria-hidden="true" /> Aceitar entrega
            </Button>
          </div>
        </section>
      ) : null}
      {milestone.status === "ENTREGUE" && !canReview ? (
        <p className="mt-3.5 flex items-start gap-2 rounded-[7px] bg-[#fff8e9] p-2.5 text-[8.5px] leading-[1.45] text-[#865516]">
          <AlertTriangle className="size-[15px] shrink-0" aria-hidden="true" />
          <span>
            {selfDelivery
              ? "Quem registrou a entrega não aprova o próprio marco."
              : "O aceite depende de quem estrutura a EAP."}
          </span>
        </p>
      ) : null}
      {error ? <p className="mt-2 text-[8.5px] text-destructive">{error}</p> : null}
      <Section label="Histórico de entrega e aceite">
        <EapHistory projectId={projectId} entityType="MILESTONE" entityId={milestone.id} refreshKey={detailKey(milestone)} />
      </Section>
    </div>
  );
}

function PlanningDates({ dates }: { dates: ProjectPhaseView["dates"] }) {
  const [open, setOpen] = useState(true);
  const start = dateText(dates, "Início planejado (vigente)");
  const due = dateText(dates, "Fim planejado (vigente)");
  const baseline = dateText(dates, "Fim da linha de base");

  return (
    <section className="border-t border-[#edf0f3] pt-2.5 pb-0.5">
      <button
        type="button"
        aria-expanded={open}
        className="flex h-[38px] w-full items-center justify-between px-[3px] text-[10px] font-semibold text-[#344054] hover:text-[#175cd3]"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex items-center gap-2">
          <Calendar className="size-4" aria-hidden="true" /> Planejamento e datas
        </span>
        <ChevronRight className={cn("size-[15px] transition-transform", open && "rotate-90")} aria-hidden="true" />
      </button>
      {open ? (
        <div className="grid grid-cols-3 gap-[7px] pt-[7px] pb-3">
          <DateCell label="Início planejado" value={start} />
          <DateCell label="Prazo vigente" value={due} />
          <DateCell label="Linha de base" value={baseline} />
        </div>
      ) : null}
    </section>
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
const emptyInline = "flex min-h-[39px] items-center gap-1.5 rounded-[7px] border border-dashed border-[#d7dce3] bg-[#f8f9fb] px-2.5 text-[8.5px] text-[#98a2b3]";
const progressClass = "[&_[data-slot=progress-indicator]]:bg-[#2873cf] [&_[data-slot=progress-track]]:h-[7px] [&_[data-slot=progress-track]]:bg-[#e9eef5]";
const secondaryButton = "h-9 rounded-[7px] border-[#d7dce3] px-[13px] text-[11px] font-semibold text-[#344054] hover:bg-[#f8fafc]";
const primaryButton = "h-9 rounded-[7px] bg-[#175cd3] px-[13px] text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.12)] hover:bg-[#144ca8]";
const compactButton = "h-[30px] gap-[5px] rounded-[7px] border-[#d7dce3] px-[9px] text-[8.5px] font-semibold text-[#344054]";

function Topline({ type, code, label, kind }: { type: "phase" | "task" | "milestone"; code: string; label: string; kind: "done" | "progress" | "pending" | "attention" | "muted" }) {
  return (
    <div className="flex items-center gap-[9px] pb-5">
      <span className={cn("grid size-[30px] place-items-center rounded-[7px]", type === "phase" && "bg-[#e9f2ff] text-[#2865b9]", type === "task" && "bg-[#eef2f6] text-[#52677e]", type === "milestone" && "bg-[#f4ecfb] text-[#8b5bbb]")}>
        {type === "phase" ? <Folder className="size-4" aria-hidden="true" /> : null}
        {type === "task" ? <Check className="size-4" aria-hidden="true" /> : null}
        {type === "milestone" ? <Flag className="size-4" aria-hidden="true" /> : null}
      </span>
      <span className="mr-auto text-[10px] text-[#667085]">EAP {code}</span>
      <StatusPill label={label} kind={kind} />
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

function Metric({ value, label, warning = false }: { value: string; label: string; warning?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", warning ? "border-[#f4dfb5] bg-[#fffaf0]" : "border-[#e4e7ec] bg-[#fafbfc]")}>
      <strong className={cn("mb-[3px] block text-[16px]", warning ? "text-[#a15c08]" : "text-[#253248]")}>{value}</strong>
      <span className="block text-[8.5px] text-[#8a94a6]">{label}</span>
    </div>
  );
}

function Fact({ icon, label, value, overdue = false, note }: { icon: ReactNode; label: string; value: string; overdue?: boolean; note?: string | null }) {
  return (
    <div className={cn("flex min-h-[67px] items-center gap-[9px] rounded-lg border p-[11px]", overdue ? "border-[#f4c8c5] bg-[#fffafa]" : "border-[#e4e7ec]")}>
      <span className={cn("grid size-[29px] shrink-0 place-items-center rounded-[6px]", overdue ? "bg-[#fdeceb] text-[#b42318]" : "bg-[#edf4ff] text-[#2864bb]")}>{icon}</span>
      <span className="min-w-0">
        <span className="mb-1 block text-[7.5px] font-semibold tracking-[0.04em] text-[#8a94a6] uppercase">{label}</span>
        <strong className="block truncate text-[9.5px] text-[#344054]">{value}</strong>
        {note ? <em className="mt-[3px] block text-[8px] font-semibold text-[#b42318] not-italic">{note}</em> : null}
      </span>
    </div>
  );
}

function DateCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[7px] bg-[#f7f9fb] p-2.5">
      <span className="mb-1 block text-[7.5px] text-[#8a94a6]">{label}</span>
      <strong className="block text-[8.5px] text-[#344054]">{value}</strong>
    </div>
  );
}

function FlowStep({ index, label, active, done }: { index: number; label: string; active: boolean; done: boolean }) {
  return (
    <li className="z-1 text-center">
      <span className={cn("mx-auto mb-[7px] grid size-[25px] place-items-center rounded-full border-2 border-white text-[8px] font-bold shadow-[0_0_0_1px_#dce1e7]", done ? "bg-[#258363] text-white shadow-[0_0_0_1px_#258363]" : active ? "bg-[#286cc4] text-white shadow-[0_0_0_1px_#286cc4]" : "bg-[#f0f2f4] text-[#98a2b3]")}>
        {index}
      </span>
      <strong className={cn("text-[8px]", done || active ? "text-[#285da8]" : "text-[#8a94a6]")}>{label}</strong>
    </li>
  );
}

function StatusPill({ label, kind, small = false }: { label: string; kind: "done" | "progress" | "pending" | "attention" | "muted"; small?: boolean }) {
  return (
    <span className={cn("inline-flex w-max items-center gap-[5px] rounded-full font-semibold whitespace-nowrap", small ? "px-1.5 py-[3px] text-[7.5px]" : "px-[7px] py-1 text-[8.5px]", kind === "done" && "bg-[#e7f7f0] text-[#157454]", kind === "progress" && "bg-[#e8f1ff] text-[#205eb2]", kind === "pending" && "bg-[#f0f2f4] text-[#667085]", kind === "attention" && "bg-[#fff3dc] text-[#a05c0b]", kind === "muted" && "bg-[#f0f2f4] text-[#667085]")}>
      <span className="size-[5px] rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

function dateText(dates: { label: string; value: string }[], label: string) {
  const value = dates.find((date) => date.label === label)?.value;
  if (!value || value === "Não informada") {
    return "Não informada";
  }
  return value.split(",")[0] ?? value;
}

function phaseKind(status: ProjectPhaseView["status"]) {
  if (status === "CONCLUIDA") return "done" as const;
  if (status === "SUSPENSA") return "attention" as const;
  if (status === "NAO_INICIADA") return "pending" as const;
  return "progress" as const;
}

function taskKind(status: ProjectTaskView["status"]) {
  if (status === "CONCLUIDA") return "done" as const;
  if (status === "CANCELADA") return "muted" as const;
  if (status === "IMPEDIDA") return "attention" as const;
  if (status === "NAO_INICIADA") return "pending" as const;
  return "progress" as const;
}

function milestoneKind(status: ProjectMilestoneView["status"]) {
  if (status === "APROVADO") return "done" as const;
  if (status === "REJEITADO") return "attention" as const;
  if (status === "PENDENTE") return "pending" as const;
  return "progress" as const;
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
