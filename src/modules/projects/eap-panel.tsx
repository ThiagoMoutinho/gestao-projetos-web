"use client";

import { AlertTriangle, Ban, CalendarIcon, Check, ChevronRight, Clock, FileText, Flag, Folder, List, Lock, Plus, RotateCcw } from "lucide-react";
import { Suspense, use, useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";

import { FieldError, useFieldErrors } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { controlTransitionClassName } from "@/components/ui/control-motion";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { OptionCombobox } from "@/components/option-combobox";
import { ApiError } from "@/lib/api/fetcher";
import { notifySuccess, reportFailure, showAlert } from "@/lib/feedback";
import {
  cancelEapTask,
  createEapEvidence,
  reactivateEapTask,
  registerEapTaskImpediment,
  resolveEapTaskImpediment,
  updateEapMilestone,
  updateEapPhase,
  updateEapTask,
  updateEapTaskImpediment,
  updateEapTaskProgress,
} from "@/lib/api/generated/eap/eap";

import {
  canEditItem,
  canRegisterEvidenceOn,
  canUpdateTaskProgress,
  type EapAccess,
} from "./eap-access";
import { comboboxControlClass, DateField, dateControlClass as editControlClass } from "./eap-date-field";
import { actualDatesProblem, correctsActualDate } from "./eap-deadline";
import { MilestoneDecisionFeedback } from "./eap-decision-feedback";
import { evidenceRequest, forgetEvidences, type EvidenceParent, type EvidenceState } from "./eap-evidence-cache";
import { EapHistory } from "./eap-history";
import { MilestoneFlow } from "./eap-milestone-flow";
import { MilestoneHomologation } from "./eap-milestone-homologation";
import { forgetImpediment, impedimentRequest, type ImpedimentState } from "./eap-impediment-cache";
import { cancelTone, impedimentTone } from "./eap-tones";
import { basisToPercent, formatBasis, phaseProgress, progressLabel } from "./eap-progress";
import { Reveal } from "./eap-reveal";
import { EapStatusBadge, milestoneStatusKind, phaseStatusKind, taskStatusKind, type EapStatusKind } from "./eap-status-badge";
import {
  civilDateInput,
  civilDateToIso,
  presentMilestone,
  presentPhase,
  presentTask,
  type ProjectMilestoneView,
  type ProjectPhaseView,
  type ProjectTaskView,
} from "./eap-present";
import type { EapSelection } from "./eap-selection";
import { deriveTaskStatus } from "./eap-status";
import { taskStatusLabel } from "./project-records";

export type EapPerson = {
  userId: string;
  name: string;
  /** Participa do projeto sem a função de fornecedor; a API confere também o perfil global. */
  homologator: boolean;
};

export type EapSaveController = {
  save: () => void;
  saving: boolean;
  locked: boolean;
};

export function EapPanel({
  projectId,
  phases,
  selection,
  access,
  people,
  names,
  code,
  projectName,
  onController,
  dirtyRef,
  onPhase,
  onTask,
  onMilestone,
}: {
  projectId: string;
  phases: ProjectPhaseView[];
  selection: EapSelection;
  access: EapAccess;
  people: EapPerson[] | null;
  names: Map<string, string> | null;
  code: string;
  projectName: string;
  onController?: (controller: EapSaveController) => void;
  dirtyRef: RefObject<boolean>;
  onPhase: (phase: ProjectPhaseView) => void;
  onTask: (task: ProjectTaskView) => void;
  onMilestone: (milestone: ProjectMilestoneView) => void;
}) {
  const phase = phases.find((item) => item.id === selection.phaseId) ?? null;
  const task =
    selection.kind === "task"
      ? (phase?.tasks?.find((item) => item.id === selection.taskId) ?? null)
      : null;
  const milestone =
    selection.kind === "milestone"
      ? (phase?.milestones?.find((item) => item.id === selection.milestoneId) ?? null)
      : null;

  if (!phase || (selection.kind === "task" && !task) || (selection.kind === "milestone" && !milestone)) {
    return <p className="text-sm text-muted-foreground">Este item não está mais na EAP carregada.</p>;
  }

  return (
    <div className="motion-enter flex flex-col">
      {selection.kind === "phase" ? (
        <PhaseEditor
          projectId={projectId}
          phase={phase}
          access={access}
          code={code}
          projectName={projectName}
          people={people}
          names={names}
          dirtyRef={dirtyRef}
          onController={onController}
          onPhase={onPhase}
        />
      ) : null}
      {task ? (
        <TaskEditor
          projectId={projectId}
          phase={phase}
          task={task}
          access={access}
          people={people}
          names={names}
          code={code}
          dirtyRef={dirtyRef}
          onController={onController}
          onTask={onTask}
        />
      ) : null}
      {milestone ? (
        <MilestoneEditor
          projectId={projectId}
          phase={phase}
          milestone={milestone}
          access={access}
          people={people}
          names={names}
          code={code}
          dirtyRef={dirtyRef}
          onController={onController}
          onMilestone={onMilestone}
        />
      ) : null}
    </div>
  );
}

function PhaseEditor({
  projectId,
  phase,
  access,
  code,
  projectName,
  people,
  names,
  dirtyRef,
  onController,
  onPhase,
}: {
  projectId: string;
  phase: ProjectPhaseView;
  access: EapAccess;
  code: string;
  projectName: string;
  people: EapPerson[] | null;
  names: Map<string, string> | null;
  dirtyRef: RefObject<boolean>;
  onController?: (controller: EapSaveController) => void;
  onPhase: (phase: ProjectPhaseView) => void;
}) {
  // Fase concluída fica somente leitura até algum item voltar para andamento.
  const concluded = phase.calculatedStatus === "CONCLUIDA";
  const canEdit = canEditItem(access, phase.createdBy) && !concluded;
  const [name, setName] = useState(phase.name);
  const [description, setDescription] = useState(phase.description ?? "");
  const [responsibleId, setResponsibleId] = useState(phase.responsibleId ?? "");
  const [suspending, setSuspending] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendText, setSuspendText] = useState("");
  const [criteria, setCriteria] = useState(phase.completionCriteria ?? "");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceRevision, setEvidenceRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const { errors, validate, clear } = useFieldErrors<"name" | "suspend">();
  const [feedback, setFeedback] = useState<string | null>(null);
  const dirty =
    canEdit &&
    (name.trim() !== phase.name ||
      emptyToNull(description) !== phase.description ||
      emptyToNull(responsibleId) !== phase.responsibleId ||
      emptyToNull(criteria) !== phase.completionCriteria);

  function publish(next: {
    name: string;
    description: string;
    responsibleId: string;
    criteria: string;
    evidenceTitle: string;
    evidenceUrl: string;
  }) {
    dirtyRef.current =
      (canEdit &&
        (next.name.trim() !== phase.name ||
          emptyToNull(next.description) !== phase.description ||
          emptyToNull(next.responsibleId) !== phase.responsibleId ||
          emptyToNull(next.criteria) !== phase.completionCriteria)) ||
      next.evidenceTitle.trim() !== "" ||
      next.evidenceUrl.trim() !== "";
  }

  function draft() {
    return { name, description, responsibleId, criteria, evidenceTitle, evidenceUrl };
  }

  async function save() {
    if (!dirty) {
      setFeedback("Nada para salvar.");
      return;
    }

    if (!validate([["name", !name.trim() && "Informe o nome da fase."]])) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      const response = await updateEapPhase(projectId, phase.id, {
        ...(name.trim() !== phase.name ? { name: name.trim() } : {}),
        ...(emptyToNull(description) !== phase.description ? { description: emptyToNull(description) } : {}),
        ...(emptyToNull(responsibleId) !== phase.responsibleId ? { responsibleId: emptyToNull(responsibleId) } : {}),
        ...(emptyToNull(criteria) !== phase.completionCriteria ? { completionCriteria: emptyToNull(criteria) } : {}),
      });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível atualizar a fase.");
      }
      onPhase(presentPhase(response.data, { tasks: phase.tasks, milestones: phase.milestones }, names));
      dirtyRef.current = false;
      notifySuccess("Fase atualizada.");
    } catch (caught) {
      showAlert(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function toggleSuspension() {
    const suspended = phase.status !== "SUSPENSA";
    if (!validate([["suspend", suspended && suspendText.trim().length < 10 && "Informe a justificativa da suspensão com ao menos 10 caracteres."]])) {
      return;
    }
    setSuspending(true);
    setFeedback(null);
    try {
      const response = await updateEapPhase(projectId, phase.id, {
        suspended,
        ...(suspended ? { justification: suspendText.trim() } : {}),
      });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível alterar a suspensão da fase.");
      }
      onPhase(presentPhase(response.data, { tasks: phase.tasks, milestones: phase.milestones }, names));
      setSuspendOpen(false);
      setSuspendText("");
      notifySuccess(suspended ? "Fase suspensa." : "Fase retomada.");
    } catch (caught) {
      showAlert(errorMessage(caught));
    } finally {
      setSuspending(false);
    }
  }

  useSaveController(onController, () => void save(), saving, concluded);
  const progress = phaseProgress(phase);

  return (
    <div className="flex flex-col pb-4">
      <EditContext kind="phase" code={code} status={phase.statusLabel} statusKind={phaseStatusKind(phase.calculatedStatus)} />
      <EditSection title="Informações básicas" subtitle="Identificação e organização do item">
        {canEdit ? (
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
            <EditText label="Nome do item *" value={name} onChange={(value) => { setName(value); clear("name"); publish({ ...draft(), name: value }); }} error={errors.name} full />
            <EditArea label="Descrição" value={description} onChange={(value) => { setDescription(value); publish({ ...draft(), description: value }); }} full />
            <EditLocked label="Situação" hint="automática" value={phase.statusLabel} />
            <EditLocked label="Item superior" value={projectName} />
            <AssigneeField people={people} value={responsibleId} onChange={(value) => { setResponsibleId(value); publish({ ...draft(), responsibleId: value }); }} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
            <EditLocked label="Nome do item" value={phase.name} />
            <EditLocked label="Responsável" value={phase.responsibleName ?? "Não informado"} />
            <div className="sm:col-span-2">
              <EditNotice
                text={
                  concluded
                    ? "Fase concluída: os campos ficam bloqueados e voltam a ser editáveis quando algum item retornar para andamento."
                    : "Os dados da fase podem ser alterados por quem estrutura a EAP ou por quem cadastrou a fase."
                }
              />
            </div>
          </div>
        )}
      </EditSection>
      <EditSection title="Configuração da fase" subtitle="O andamento é calculado pelos itens subordinados" tone="accent" aside={<span className="inline-flex items-center gap-[5px] rounded-full bg-[#edf4ff] px-2 py-[5px] text-[8.5px] font-semibold text-[#2864bb]"><List className="size-3" aria-hidden="true" />Calculado</span>}>
        <div className="mb-3.5 rounded-[7px] bg-[#f8fafc] px-[11px] py-[11px]">
          <div className="mb-2 flex items-center justify-between text-[8.5px] text-[#667085]">
            <span>Andamento consolidado</span>
            <strong className="text-[12px] text-[#175cd3]">{progress.kind === "value" ? `${formatBasis(progress.basisPoints)}%` : progressLabel(progress)}</strong>
          </div>
          {progress.kind === "value" ? (
            <Progress value={basisToPercent(progress.basisPoints)} aria-label="Andamento consolidado da fase" className="[&_[data-slot=progress-indicator]]:bg-[#2873cf] [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-[#e9eef5]" />
          ) : (
            <p className="text-[8.5px] text-[#98a2b3]">{progress.kind === "empty" ? "Esta fase ainda não tem itens subordinados." : "O percentual desta fase não está disponível."}</p>
          )}
          <p className="mt-[9px] text-[8.5px] leading-normal text-[#8a94a6]">
            A situação muda sozinha conforme as tarefas e os marcos. A fase só fica concluída quando todas as tarefas ativas estão em 100% e todos os marcos foram aceitos.
          </p>
        </div>
        {access.canManageStructure && !concluded ? (
          <div className="mb-3.5 rounded-[7px] border border-[#e4e7ec] px-[11px] py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[8.5px] leading-normal text-[#667085]">
                {phase.status === "SUSPENSA"
                  ? "Fase suspensa pela gestão. Ao retomar, a situação volta a ser calculada pelos itens."
                  : "Suspender interrompe a atualização automática da situação até a fase ser retomada."}
              </span>
              {phase.status === "SUSPENSA" ? (
                <Button type="button" variant="outline" className="h-[30px] shrink-0 rounded-[7px] px-[9px] text-[8.5px]" loading={suspending} onClick={() => void toggleSuspension()}>
                  {suspending ? "Salvando…" : "Retomar fase"}
                </Button>
              ) : suspendOpen ? null : (
                <Button type="button" variant="outline" className="h-[30px] shrink-0 rounded-[7px] px-[9px] text-[8.5px]" onClick={() => setSuspendOpen(true)}>
                  Suspender fase
                </Button>
              )}
            </div>
            <Reveal open={suspendOpen && phase.status !== "SUSPENSA"}>
              <div className="mt-2.5 flex flex-col gap-2.5">
                <EditArea
                  label="Justificativa da suspensão"
                  hint="obrigatória"
                  value={suspendText}
                  placeholder="Explique por que a fase será suspensa."
                  onChange={(value) => { setSuspendText(value); clear("suspend"); }}
                  error={errors.suspend}
                  full
                />
                <div className="flex flex-wrap justify-end gap-[7px]">
                  <Button type="button" variant="outline" className="h-[30px] rounded-[7px] px-[9px] text-[8.5px]" disabled={suspending} onClick={() => { setSuspendOpen(false); setSuspendText(""); }}>
                    Cancelar
                  </Button>
                  <Button type="button" className="h-[30px] rounded-[7px] bg-[#c4620f] px-[9px] text-[8.5px] text-white hover:bg-[#b4570f]" loading={suspending} onClick={() => void toggleSuspension()}>
                    {suspending ? "Suspendendo…" : "Confirmar suspensão"}
                  </Button>
                </div>
              </div>
            </Reveal>
          </div>
        ) : null}
        {canEdit ? (
          <EditArea
            label="Critério de conclusão"
            value={criteria}
            placeholder="Descreva o que precisa estar pronto para concluir a fase."
            onChange={(value) => { setCriteria(value); publish({ ...draft(), criteria: value }); }}
            full
          />
        ) : (
          <EditArea label="Critério de conclusão" value={phase.completionCriteria ?? "Nenhum critério registrado."} onChange={() => undefined} disabled full />
        )}
      </EditSection>
      <EvidenceSection
        projectId={projectId}
        parent={{ phaseId: phase.id }}
        canRegister={canRegisterEvidenceOn(access, { assigneeId: phase.responsibleId, createdBy: phase.createdBy })}
        revision={evidenceRevision}
        title={evidenceTitle}
        url={evidenceUrl}
        onTitle={(value) => { setEvidenceTitle(value); publish({ ...draft(), evidenceTitle: value }); }}
        onUrl={(value) => { setEvidenceUrl(value); publish({ ...draft(), evidenceUrl: value }); }}
        onCreated={() => {
          setEvidenceTitle("");
          setEvidenceUrl("");
          publish({ ...draft(), evidenceTitle: "", evidenceUrl: "" });
          setEvidenceRevision((value) => value + 1);
        }}
      />
      <HistoryNote projectId={projectId} entityType="PHASE" entityId={phase.id} refreshKey={historyKey(phase, evidenceRevision)} />
      <EditStatus feedback={feedback} />
    </div>
  );
}

function TaskEditor({
  projectId,
  phase,
  task,
  access,
  people,
  names,
  code,
  dirtyRef,
  onController,
  onTask,
}: {
  projectId: string;
  phase: ProjectPhaseView;
  task: ProjectTaskView;
  access: EapAccess;
  people: EapPerson[] | null;
  names: Map<string, string> | null;
  code: string;
  dirtyRef: RefObject<boolean>;
  onController?: (controller: EapSaveController) => void;
  onTask: (task: ProjectTaskView) => void;
}) {
  const canEdit = canEditItem(access, task.createdBy);
  const canProgress = canUpdateTaskProgress(access, task);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  const [weight, setWeight] = useState(String(task.weight));
  const [percent, setPercent] = useState(String(task.progressPercent));
  const [actualStart, setActualStart] = useState(civilDateInput(task.actualStartAt));
  const [actualEnd, setActualEnd] = useState(civilDateInput(task.actualEndAt));
  const [dateJustification, setDateJustification] = useState("");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const { errors, validate, clear } = useFieldErrors<"title" | "weight" | "percent" | "actualStart" | "actualEnd" | "correction" | "reopen">();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [evidenceRevision, setEvidenceRevision] = useState(0);
  const [impedimentRevision, setImpedimentRevision] = useState(0);
  const cancelled = task.calculatedStatus === "CANCELADA";
  // Concluída: estrutura bloqueada; só o andamento segue disponível para reabrir a tarefa com justificativa.
  const concluded = task.calculatedStatus === "CONCLUIDA";
  const editable = canEdit && !cancelled && !concluded;
  const structureDirty =
    editable &&
    (title.trim() !== task.title ||
      emptyToNull(description) !== task.description ||
      emptyToNull(assigneeId) !== task.assigneeId ||
      weight !== String(task.weight));
  const progressDirty =
    canProgress &&
    !cancelled &&
    (percent !== String(task.progressPercent) ||
      actualStart !== civilDateInput(task.actualStartAt) ||
      actualEnd !== civilDateInput(task.actualEndAt));
  const correctingDates =
    correctsActualDate(civilDateInput(task.actualStartAt), actualStart) ||
    correctsActualDate(civilDateInput(task.actualEndAt), actualEnd);
  const completing = percent === "100" && task.progressPercent < 100;
  const reopeningTask = task.progressPercent === 100 && Number(percent) < 100;

  function publish(next: {
    title: string;
    description: string;
    assigneeId: string;
    weight: string;
    percent: string;
    actualStart: string;
    actualEnd: string;
    evidenceTitle: string;
    evidenceUrl: string;
    dateJustification: string;
  }) {
    const nextStructure =
      editable &&
      (next.title.trim() !== task.title ||
        emptyToNull(next.description) !== task.description ||
        emptyToNull(next.assigneeId) !== task.assigneeId ||
        next.weight !== String(task.weight));
    const nextProgress =
      canProgress &&
      !cancelled &&
      (next.percent !== String(task.progressPercent) ||
        next.actualStart !== civilDateInput(task.actualStartAt) ||
        next.actualEnd !== civilDateInput(task.actualEndAt));
    dirtyRef.current =
      nextStructure ||
      nextProgress ||
      next.evidenceTitle.trim() !== "" ||
      next.evidenceUrl.trim() !== "" ||
      next.dateJustification.trim() !== "";
  }

  function draft() {
    return { title, description, assigneeId, weight, percent, actualStart, actualEnd, evidenceTitle, evidenceUrl, dateJustification };
  }

  function choosePercent(value: string) {
    setPercent(value);
    publish({ ...draft(), percent: value });
  }

  async function save() {
    const progress = Number(percent);
    const parsedWeight = Number(weight);

    if (!structureDirty && !progressDirty) {
      setFeedback("Nada para salvar.");
      return;
    }

    // Concluir pelo andamento usa as mesmas regras de "Concluir tarefa": datas reais confirmadas.
    const today = belemToday();
    const datesProblem = canProgress
      ? actualDatesProblem({ start: actualStart, end: actualEnd, today, requireBoth: progress === 100 })
      : null;
    // O problema de datas aparece no campo que precisa ser corrigido: início ausente ou futuro, senão o fim.
    const dateField = !actualStart || actualStart > today ? "actualStart" : "actualEnd";
    const valid = validate([
      ["title", editable && !title.trim() && "Informe o título da tarefa."],
      ["weight", editable && (!Number.isInteger(parsedWeight) || parsedWeight < 1) && "O peso precisa ser um número inteiro maior que zero."],
      ["percent", canProgress && (!Number.isInteger(progress) || progress < 0 || progress > 100) && "O percentual precisa ser um inteiro de 0 a 100."],
      [dateField, datesProblem],
      ["correction", canProgress && correctingDates && dateJustification.trim().length < 10 && "Informe a justificativa da correção com ao menos 10 caracteres."],
      ["reopen", canProgress && reopeningTask && dateJustification.trim().length < 10 && "Informe a justificativa da reabertura com ao menos 10 caracteres."],
    ]);
    if (!valid) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      let current = task;

      if (structureDirty) {
        const response = await updateEapTask(projectId, phase.id, task.id, {
          ...(title.trim() !== task.title ? { title: title.trim() } : {}),
          ...(emptyToNull(description) !== task.description ? { description: emptyToNull(description) } : {}),
          ...(emptyToNull(assigneeId) !== task.assigneeId ? { assigneeId: emptyToNull(assigneeId) } : {}),
          ...(weight !== String(task.weight) ? { weight: parsedWeight } : {}),
        });
        if (response.status !== 200) {
          throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível atualizar a tarefa.");
        }
        current = presentTask(response.data, names);
      }

      if (progressDirty) {
        const response = await updateEapTaskProgress(projectId, phase.id, task.id, {
          ...(progress !== current.progressPercent ? { progressPercent: progress } : {}),
          ...(actualStart !== civilDateInput(current.actualStartAt)
            ? { actualStartAt: civilDateToIso(actualStart) }
            : {}),
          ...(actualEnd !== civilDateInput(current.actualEndAt)
            ? { actualEndAt: civilDateToIso(actualEnd) }
            : {}),
          ...((correctingDates || reopeningTask) && dateJustification.trim() ? { justification: dateJustification.trim() } : {}),
        });
        if (response.status !== 200) {
          throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível atualizar o andamento.");
        }
        current = presentTask(response.data, names);
      }

      onTask(current);
      setDateJustification("");
      dirtyRef.current = evidenceTitle.trim() !== "" || evidenceUrl.trim() !== "";
      notifySuccess(progressDirty && progress === 100 && task.progressPercent < 100 ? "Tarefa concluída." : "Tarefa atualizada.");
    } catch (caught) {
      showAlert(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  useSaveController(onController, () => void save(), saving, cancelled);
  const progressValue = Number(percent);
  const progressShown = Number.isFinite(progressValue) ? Math.min(100, Math.max(0, progressValue)) : 0;
  const statusPreview = cancelled ? task.calculatedStatus : deriveTaskStatus(progressShown);
  const statusShown = taskStatusLabel(statusPreview);
  const actualFields = (
    <>
      <DateField label="Início realizado" hint={completing ? "obrigatório para concluir" : undefined} value={actualStart} onChange={(value) => { setActualStart(value); clear("actualStart"); publish({ ...draft(), actualStart: value }); }} error={errors.actualStart} />
      <DateField label="Fim realizado" hint={completing ? "obrigatório para concluir" : undefined} value={actualEnd} onChange={(value) => { setActualEnd(value); clear("actualEnd"); publish({ ...draft(), actualEnd: value }); }} error={errors.actualEnd} />
      {correctingDates ? (
        <EditArea
          label="Justificativa da correção"
          hint="obrigatória · o valor anterior fica no histórico"
          value={dateJustification}
          placeholder="Explique por que a data real registrada está sendo corrigida."
          onChange={(value) => { setDateJustification(value); clear("correction"); publish({ ...draft(), dateJustification: value }); }}
          error={errors.correction}
          full
        />
      ) : null}
    </>
  );
  const decision = access.canManageStructure ? (
    <TaskStatusDecision projectId={projectId} phaseId={phase.id} task={task} names={names} onTask={onTask} />
  ) : null;

  return (
    <div className="flex flex-col pb-4">
      <EditContext kind="task" code={code} status={statusShown} statusKind={taskStatusKind(statusPreview)} />
      <EditSection title="Informações básicas" subtitle="Identificação e organização do item">
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
          {editable ? (
            <EditText label="Nome do item *" value={title} onChange={(value) => { setTitle(value); clear("title"); publish({ ...draft(), title: value }); }} error={errors.title} full />
          ) : (
            <EditLocked label="Nome do item" value={task.title} />
          )}
          {editable ? (
            <EditArea label="Descrição" value={description} onChange={(value) => { setDescription(value); publish({ ...draft(), description: value }); }} full />
          ) : (
            <EditLocked label="Descrição" value={task.description?.trim() || "Nenhuma descrição registrada."} />
          )}
          {concluded ? (
            <div className="sm:col-span-2">
              <EditNotice text="Tarefa concluída: os campos ficam bloqueados. Para editar, volte o andamento para menos de 100% informando a justificativa da reabertura." />
            </div>
          ) : null}
          <EditLocked label="Situação" hint={cancelled ? "decisão da gestão" : "pelo andamento"} value={statusShown} />
          <EditLocked label="Item superior" value={phase.name} />
          {editable ? (
            <AssigneeField people={people} value={assigneeId} onChange={(value) => { setAssigneeId(value); publish({ ...draft(), assigneeId: value }); }} />
          ) : (
            <EditLocked label="Responsável" value={task.assigneeName || "Não informado"} />
          )}
        </div>
      </EditSection>
      <EditSection title="Andamento da tarefa" subtitle="Atualização rápida do progresso registrado" tone="accent" aside={<strong className="text-[12px] text-[#175cd3]">{progressShown}%</strong>}>
        {canProgress && !cancelled ? (
          <>
            <Progress value={progressShown} aria-label="Andamento da tarefa" className="mb-3 [&_[data-slot=progress-indicator]]:bg-[#2873cf] [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-[#e9eef5]" />
            <div className="mt-[11px] mb-3.5 grid grid-cols-6 gap-1.5">
              {[0, 25, 50, 75, 90, 100].map((value) => (
                <button key={value} type="button" className={`h-[29px] min-w-0 rounded-[6px] border text-[8.5px] font-semibold ${progressShown === value ? "border-[#8eb4e7] bg-[#edf4ff] text-[#175cd3]" : "border-[#dce1e7] bg-white text-[#667085]"}`} onClick={() => choosePercent(String(value))}>
                  {value}%
                </button>
              ))}
            </div>
            <div className="mb-3.5 grid grid-cols-[140px_auto_1fr] items-end gap-2">
              <EditText label="Percentual exato de andamento" value={percent} onChange={(value) => { choosePercent(value); clear("percent"); }} error={errors.percent} />
              <span className="flex h-9 items-center text-[8px] text-[#98a2b3]">% concluído</span>
              <Button type="button" variant="outline" className="h-9 justify-self-end gap-1.5 rounded-[7px] px-[11px] text-[9px]" disabled={progressShown === 100} onClick={() => choosePercent("100")}>
                <Check className="size-3.5" aria-hidden="true" />
                Concluir
              </Button>
            </div>
            <Reveal open={completing}>
              <div className="mb-3.5 rounded-[9px] border border-[#bfe4d5] bg-[#f6fcf9] p-3">
                <span className="mb-1 block text-[9px] font-semibold tracking-[0.04em] text-[#157454] uppercase">Concluir tarefa</span>
                <p className="mb-2.5 text-[8.5px] leading-[1.45] text-[#475467]">Para concluir, confirme o início e o término reais. A conclusão é gravada ao salvar.</p>
                <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">{completing ? actualFields : null}</div>
              </div>
            </Reveal>
            <Reveal open={reopeningTask}>
              <div className="mb-3.5 rounded-[9px] border border-[#f6d2ad] bg-[#fff8f1] p-3">
                <span className="mb-1 block text-[9px] font-semibold tracking-[0.04em] text-[#b4570f] uppercase">Reabrir tarefa concluída</span>
                <p className="mb-2.5 text-[8.5px] leading-[1.45] text-[#475467]">O término real registrado é retirado e fica preservado no histórico. A reabertura é gravada ao salvar.</p>
                {reopeningTask ? (
                  <EditArea
                    label="Justificativa da reabertura"
                    hint="obrigatória"
                    value={dateJustification}
                    placeholder="Explique por que a tarefa concluída precisa voltar a ser executada."
                    onChange={(value) => { setDateJustification(value); clear("reopen"); publish({ ...draft(), dateJustification: value }); }}
                    error={errors.reopen}
                    full
                  />
                ) : null}
              </div>
            </Reveal>
            <p className="mb-3.5 text-[8px] leading-normal text-[#98a2b3]">
              A situação acompanha o percentual: 0% não iniciada, de 1% a 99% em andamento e 100% concluída. O início real é registrado ao iniciar o andamento; para concluir, confirme as datas reais. Corrigir uma data já registrada exige justificativa.
            </p>
            {editable ? (
              <EditText label="Peso" value={weight} onChange={(value) => { setWeight(value); clear("weight"); publish({ ...draft(), weight: value }); }} error={errors.weight} />
            ) : null}
            <div className="mt-3 grid grid-cols-1 gap-[13px] sm:grid-cols-2">
              <EditLocked label="Prioridade" hint="não gravado" value="Indisponível neste cadastro" />
              <EditLocked label="Dependência" hint="não gravado" value="Indisponível neste cadastro" />
            </div>
            <Suspense fallback={<Skeleton className="mt-3.5 h-[54px] w-full rounded-[7px]" />}>
              <TaskImpediment
                projectId={projectId}
                phaseId={phase.id}
                task={task}
                names={names}
                request={impedimentRequest(projectId, phase.id, task)}
                onChanged={(next) => {
                  forgetImpediment(projectId, task.id);
                  setImpedimentRevision((value) => value + 1);
                  onTask(next);
                }}
              />
            </Suspense>
            {decision}
          </>
        ) : cancelled ? (
          <>
            <EditNotice text="Esta tarefa está cancelada e não entra no andamento da fase. Somente a gestão do projeto pode reativá-la." />
            {decision}
          </>
        ) : (
          <EditNotice text="O andamento desta tarefa pode ser atualizado por quem estrutura a EAP ou pelo responsável, quando ele é fornecedor ou desenvolvedor do projeto." />
        )}
      </EditSection>
      <EvidenceSection
        projectId={projectId}
        parent={{ taskId: task.id }}
        canRegister={!cancelled && canRegisterEvidenceOn(access, task)}
        unavailableText={cancelled ? "Tarefas canceladas não recebem novas evidências." : undefined}
        revision={evidenceRevision}
        title={evidenceTitle}
        url={evidenceUrl}
        onTitle={(value) => { setEvidenceTitle(value); publish({ ...draft(), evidenceTitle: value }); }}
        onUrl={(value) => { setEvidenceUrl(value); publish({ ...draft(), evidenceUrl: value }); }}
        onCreated={() => {
          setEvidenceTitle("");
          setEvidenceUrl("");
          publish({ ...draft(), evidenceTitle: "", evidenceUrl: "" });
          setEvidenceRevision((value) => value + 1);
        }}
        emptyWarning={progressShown === 100 ? "A tarefa está concluída, mas ainda não possui as evidências exigidas." : null}
      />
      <HistoryNote projectId={projectId} entityType="TASK" entityId={task.id} refreshKey={historyKey(task, `${evidenceRevision}:${impedimentRevision}`)} />
      <EditStatus feedback={feedback} />
    </div>
  );
}

function TaskStatusDecision({
  projectId,
  phaseId,
  task,
  names,
  onTask,
}: {
  projectId: string;
  phaseId: string;
  task: ProjectTaskView;
  names: Map<string, string> | null;
  onTask: (task: ProjectTaskView) => void;
}) {
  const cancelled = task.calculatedStatus === "CANCELADA";
  const concluded = task.calculatedStatus === "CONCLUIDA";
  const [opened, setOpened] = useState(false);
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const { errors, validate, clear, reset } = useFieldErrors<"justification">();

  function toggle() {
    if (!opened) {
      setJustification("");
    }
    setOpened(!opened);
    reset();
  }

  async function decide() {
    if (!validate([["justification", justification.trim().length < 10 && "Informe a justificativa com ao menos 10 caracteres."]])) {
      return;
    }
    setSaving(true);
    try {
      const body = { justification: justification.trim() };
      const response = cancelled
        ? await reactivateEapTask(projectId, phaseId, task.id, body)
        : await cancelEapTask(projectId, phaseId, task.id, body);
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível alterar a situação da tarefa.");
      }
      setJustification("");
      setOpened(false);
      onTask(presentTask(response.data, names));
      notifySuccess(cancelled ? "Tarefa reativada." : "Tarefa cancelada.");
    } catch (caught) {
      showAlert(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  if (concluded) {
    return null;
  }

  return (
    <div className="mt-3.5">
      <DecisionCard
        icon={cancelled ? <RotateCcw className="size-4" aria-hidden="true" /> : <Ban className="size-4" aria-hidden="true" />}
        title={cancelled ? "Reativar esta tarefa" : "Cancelar esta tarefa"}
        note={cancelled ? "A situação volta a acompanhar o percentual registrado." : "Decisão da gestão, registrada no histórico."}
        active={opened}
        tone={cancelTone}
        onClick={toggle}
      />
      <Reveal open={opened}>
        <div className="pt-3">
          <EditArea
            label="Justificativa"
            value={justification}
            placeholder={cancelled ? "Explique por que a tarefa volta ao escopo." : "Explique por que a tarefa não será executada."}
            onChange={(value) => { setJustification(value); clear("justification"); }}
            error={errors.justification}
            full
          />
          <div className="mt-3 flex items-center justify-end gap-[7px]">
            <Button type="button" variant="outline" className={compactButtonClass} disabled={saving} onClick={toggle}>
              Voltar
            </Button>
            <Button
              type="button"
              variant={cancelled ? "default" : "destructive"}
              className="h-[30px] rounded-[7px] px-[11px] text-[8.5px]"
              loading={saving}
              onClick={() => void decide()}
            >
              {saving ? "Salvando…" : cancelled ? "Reativar tarefa" : "Cancelar tarefa"}
            </Button>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

/** Cartão no formato do cadastro: ao clicar, revela o campo e as ações logo abaixo. */
function DecisionCard({
  icon,
  title,
  note,
  active,
  tone,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  note: string;
  active: boolean;
  tone: { surface: string; icon: string };
  onClick?: () => void;
}) {
  const className = `grid w-full grid-cols-[34px_minmax(0,1fr)] items-center gap-[9px] rounded-[7px] border px-2.5 py-2.5 text-left ${controlTransitionClassName} ${active ? tone.surface : "border-[#e4e7ec] bg-white"}`;
  const content = (
    <>
      <span className={`grid size-8 place-items-center rounded-[6px] transition-colors duration-200 ease-out motion-reduce:transition-none ${active ? tone.icon : "bg-[#f2f4f7] text-[#8a94a6]"}`}>{icon}</span>
      <span className="min-w-0">
        <strong className="block text-[9.5px] text-[#344054]">{title}</strong>
        <small className="mt-[3px] block text-[8px] text-[#98a2b3]">{note}</small>
      </span>
    </>
  );
  return onClick ? (
    <button type="button" aria-expanded={active} className={className} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  );
}

type ImpedimentAction = "register" | "update" | "resolve";

const IMPEDIMENT_ACTIONS: Record<ImpedimentAction, { label: string; field: string; placeholder: string; done: string }> = {
  register: {
    label: "Registrar impedimento",
    field: "Motivo do impedimento",
    placeholder: "Descreva o impedimento e a ação necessária...",
    done: "Impedimento registrado.",
  },
  update: {
    label: "Atualizar motivo",
    field: "Motivo do impedimento",
    placeholder: "Descreva o impedimento e a ação necessária...",
    done: "Motivo do impedimento atualizado.",
  },
  resolve: {
    label: "Resolver impedimento",
    field: "Como foi resolvido",
    placeholder: "Explique o que foi feito para retirar o impedimento.",
    done: "Impedimento resolvido.",
  },
};

function TaskImpediment({
  projectId,
  phaseId,
  task,
  names,
  request,
  onChanged,
}: {
  projectId: string;
  phaseId: string;
  task: ProjectTaskView;
  names: Map<string, string> | null;
  request: Promise<ImpedimentState>;
  onChanged: (task: ProjectTaskView) => void;
}) {
  const state = use(request);
  const [action, setAction] = useState<ImpedimentAction | null>(null);
  const [form, setForm] = useState<ImpedimentAction>("register");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const { errors, validate, clear, reset } = useFieldErrors<"text">();

  if (state.status === "error") {
    return <p className={`mt-3.5 ${emptyInlineClass}`}>{state.message}</p>;
  }

  const open = state.open;
  const active = open !== null || task.hasImpediment;
  const concluded = task.calculatedStatus === "CONCLUIDA";
  const note = open
    ? `Registrado por ${open.author} em ${open.openedAt}.`
    : active
      ? "Sinalizado antes do registro de motivos; o motivo não foi gravado."
      : concluded
        ? "Tarefas concluídas não recebem novos impedimentos."
        : "Destaque o item na EAP e informe o motivo.";

  function start(next: ImpedimentAction) {
    setAction(next);
    setForm(next);
    setText(next === "update" && open ? open.description : "");
    reset();
  }

  function cancel() {
    setAction(null);
    reset();
  }

  async function submit(current: ImpedimentAction) {
    const value = text.trim();
    if (!validate([["text", value.length < 10 && (current === "resolve" ? "Descreva a resolução com ao menos 10 caracteres." : "Informe o motivo com ao menos 10 caracteres.")]])) {
      return;
    }
    setSaving(true);
    try {
      const response =
        current === "resolve"
          ? await resolveEapTaskImpediment(projectId, phaseId, task.id, { resolutionNote: value })
          : current === "update" && open
            ? await updateEapTaskImpediment(projectId, phaseId, task.id, open.id, { description: value })
            : await registerEapTaskImpediment(projectId, phaseId, task.id, { description: value });
      if (response.status !== 200 && response.status !== 201) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível atualizar o impedimento.");
      }
      setAction(null);
      setText("");
      notifySuccess(IMPEDIMENT_ACTIONS[current].done);
      onChanged(presentTask(response.data.task, names));
    } catch (caught) {
      showAlert(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3.5">
      <DecisionCard
        icon={<AlertTriangle className="size-4" aria-hidden="true" />}
        title={active && !open ? "Impedimento ativo sem motivo registrado" : "Esta tarefa está impedida"}
        note={note}
        active={active || action === "register"}
        tone={impedimentTone}
        onClick={active || concluded ? undefined : () => (action === "register" ? cancel() : start("register"))}
      />
      {open ? (
        <Reveal open={action !== "update"}>
          <div className="pt-3">
            <EditLabel label="Motivo registrado" />
            <p className="mt-1.5 rounded-[7px] border border-[#e4e7ec] bg-[#f8fafc] px-2.5 py-2 text-[9px] leading-[1.5] whitespace-pre-wrap text-[#475467]">{open.description}</p>
          </div>
        </Reveal>
      ) : null}
      <Reveal open={action !== null}>
        <div className="pt-3">
          <EditArea label={IMPEDIMENT_ACTIONS[form].field} value={text} placeholder={IMPEDIMENT_ACTIONS[form].placeholder} onChange={(value) => { setText(value); clear("text"); }} error={errors.text} full />
          <div className="mt-3 flex items-center justify-end gap-[7px]">
            <Button type="button" variant="outline" className={compactButtonClass} disabled={saving} onClick={cancel}>
              Voltar
            </Button>
            <Button
              type="button"
              className="h-[30px] rounded-[7px] px-[11px] text-[8.5px]"
              loading={saving}
              onClick={() => void submit(form)}
            >
              {saving ? "Salvando…" : IMPEDIMENT_ACTIONS[form].label}
            </Button>
          </div>
        </div>
      </Reveal>
      {active ? (
        <Reveal open={action === null}>
          <div className="flex justify-end gap-[7px] pt-2.5">
            {open ? (
              <Button type="button" variant="outline" className={compactButtonClass} onClick={() => start("update")}>
                {IMPEDIMENT_ACTIONS.update.label}
              </Button>
            ) : null}
            <Button type="button" variant="outline" className={compactButtonClass} onClick={() => start("resolve")}>
              {IMPEDIMENT_ACTIONS.resolve.label}
            </Button>
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}

function belemToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function MilestoneEditor({
  projectId,
  phase,
  milestone,
  access,
  people,
  names,
  code,
  dirtyRef,
  onController,
  onMilestone,
}: {
  projectId: string;
  phase: ProjectPhaseView;
  milestone: ProjectMilestoneView;
  access: EapAccess;
  people: EapPerson[] | null;
  names: Map<string, string> | null;
  code: string;
  dirtyRef: RefObject<boolean>;
  onController?: (controller: EapSaveController) => void;
  onMilestone: (milestone: ProjectMilestoneView) => void;
}) {
  // Marco aceito é definitivo: todos os campos ficam bloqueados.
  const accepted = milestone.status === "APROVADO";
  const canEdit = canEditItem(access, milestone.createdBy) && !accepted;
  const canDesignate = access.canManageStructure && !accepted;
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [reviewerId, setReviewerId] = useState(milestone.reviewerId ?? "");
  const [presenterId, setPresenterId] = useState(milestone.presenterId ?? "");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const { errors, validate, clear } = useFieldErrors<"title" | "reviewer">();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [evidenceRevision, setEvidenceRevision] = useState(0);
  const reviewerChanged = canDesignate && (reviewerId || null) !== milestone.reviewerId;
  // O apresentador pode ser trocado, mas não removido.
  const presenterChanged = canDesignate && presenterId !== "" && presenterId !== (milestone.presenterId ?? "");
  const structureDirty =
    reviewerChanged ||
    presenterChanged ||
    (canEdit && (title.trim() !== milestone.title || emptyToNull(description) !== milestone.description));

  function publish(next: {
    title: string;
    description: string;
    reviewerId: string;
    presenterId: string;
    evidenceTitle: string;
    evidenceUrl: string;
  }) {
    const nextStructure =
      (canDesignate && (next.reviewerId || null) !== milestone.reviewerId) ||
      (canDesignate && next.presenterId !== "" && next.presenterId !== (milestone.presenterId ?? "")) ||
      (canEdit && (next.title.trim() !== milestone.title || emptyToNull(next.description) !== milestone.description));
    dirtyRef.current = nextStructure || next.evidenceTitle.trim() !== "" || next.evidenceUrl.trim() !== "";
  }

  function draft() {
    return { title, description, reviewerId, presenterId, evidenceTitle, evidenceUrl };
  }

  async function saveDetails() {
    if (!structureDirty) {
      setFeedback("Nada para salvar.");
      return;
    }

    const valid = validate([
      ["title", canEdit && !title.trim() && "Informe o título do marco."],
      ["reviewer", presenterId !== "" && presenterId === reviewerId && "Quem apresenta o marco não pode ser o gestor que vai validá-lo."],
    ]);
    if (!valid) {
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      if (structureDirty) {
        const response = await updateEapMilestone(projectId, phase.id, milestone.id, {
          ...(canEdit && title.trim() !== milestone.title ? { title: title.trim() } : {}),
          ...(canEdit && emptyToNull(description) !== milestone.description
            ? { description: emptyToNull(description) }
            : {}),
          ...(reviewerChanged ? { reviewerId: reviewerId || null } : {}),
          ...(presenterChanged ? { presenterId } : {}),
        });
        if (response.status !== 200) {
          throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível atualizar o marco.");
        }
        onMilestone(presentMilestone(response.data, names));
      }
      dirtyRef.current = evidenceTitle.trim() !== "" || evidenceUrl.trim() !== "";
      if (structureDirty) {
        notifySuccess("Marco atualizado.");
      }
    } catch (caught) {
      showAlert(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  useSaveController(onController, () => void saveDetails(), saving, accepted);

  return (
    <div className="flex flex-col pb-4">
      <EditContext kind="milestone" code={code} status={milestone.statusLabel} statusKind={milestoneStatusKind(milestone.status)} />
      <MilestoneDecisionFeedback milestone={milestone} className="mt-3 mb-0" />
      <EditSection title="Informações básicas" subtitle="Identificação e organização do item">
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
          {canEdit ? (
            <EditText label="Nome do item *" value={title} onChange={(value) => { setTitle(value); clear("title"); publish({ ...draft(), title: value }); }} error={errors.title} full />
          ) : (
            <EditLocked label="Nome do item" value={milestone.title} />
          )}
          {canEdit ? (
            <EditArea label="Descrição" value={description} onChange={(value) => { setDescription(value); publish({ ...draft(), description: value }); }} full />
          ) : (
            <EditLocked label="Descrição" value={milestone.description?.trim() || "Nenhuma descrição registrada."} />
          )}
          {accepted ? (
            <div className="sm:col-span-2">
              <EditNotice text="Marco aceito: os campos ficam bloqueados. A decisão e o histórico são definitivos." />
            </div>
          ) : null}
          <EditLocked label="Item superior" value={phase.name} />
          {canDesignate ? (
            <AssigneeField
              people={people}
              value={presenterId}
              label="Apresentador do marco"
              emptyLabel="Não designado"
              onChange={(value) => { setPresenterId(value); clear("reviewer"); publish({ ...draft(), presenterId: value }); }}
            />
          ) : (
            <EditLocked label="Apresentador do marco" value={milestone.presenterName ?? "Não designado"} />
          )}
          <EditLocked label="Tipo do marco" value={milestone.typeLabel} />
        </div>
      </EditSection>
      <EditSection title="Fluxo de entrega e aceite" subtitle="Pendente, entregue e aceito pelo gestor" tone="accent">
        <div className="mb-[13px]">
          <MilestoneFlow status={milestone.status} />
        </div>
        <div className="mb-[13px] grid grid-cols-1 gap-[13px] sm:grid-cols-2">
          <EditLocked label="Entrega registrada por" value={milestone.deliveredBy ?? "Ainda não registrada"} />
          {canDesignate ? (
            <AssigneeField
              people={people?.filter((person) => person.homologator) ?? null}
              value={reviewerId}
              label="Gestor validador"
              emptyLabel="Gestão do projeto (padrão)"
              onChange={(value) => { setReviewerId(value); clear("reviewer"); publish({ ...draft(), reviewerId: value }); }}
              error={errors.reviewer}
            />
          ) : (
            <EditLocked label="Gestor validador" value={milestone.reviewerName ?? "Gestão do projeto (padrão)"} />
          )}
        </div>
        <MilestoneHomologation
          projectId={projectId}
          milestone={milestone}
          access={access}
          names={names}
          showEvidence={false}
          onMilestone={onMilestone}
          onChanged={() => setEvidenceRevision((value) => value + 1)}
        />
      </EditSection>
      <EvidenceSection
        projectId={projectId}
        parent={{ milestoneId: milestone.id }}
        canRegister={canRegisterEvidenceOn(access, { assigneeId: null, createdBy: milestone.createdBy })}
        revision={evidenceRevision}
        title={evidenceTitle}
        url={evidenceUrl}
        onTitle={(value) => { setEvidenceTitle(value); publish({ ...draft(), evidenceTitle: value }); }}
        onUrl={(value) => { setEvidenceUrl(value); publish({ ...draft(), evidenceUrl: value }); }}
        onCreated={() => {
          setEvidenceTitle("");
          setEvidenceUrl("");
          publish({ ...draft(), evidenceTitle: "", evidenceUrl: "" });
          setEvidenceRevision((value) => value + 1);
        }}
      />
      <HistoryNote projectId={projectId} entityType="MILESTONE" entityId={milestone.id} refreshKey={historyKey(milestone, evidenceRevision)} />
      <EditStatus feedback={feedback} />
    </div>
  );
}

function EvidenceSection({
  projectId,
  parent,
  canRegister,
  revision,
  title,
  url,
  onTitle,
  onUrl,
  onCreated,
  emptyWarning = null,
  unavailableText = "O registro de evidências não está disponível para este acesso.",
}: {
  projectId: string;
  parent: EvidenceParent;
  canRegister: boolean;
  revision: number;
  title: string;
  url: string;
  onTitle: (value: string) => void;
  onUrl: (value: string) => void;
  onCreated: () => void;
  emptyWarning?: string | null;
  unavailableText?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const { errors, validate, clear, reset } = useFieldErrors<"title" | "url">();
  const request = evidenceRequest(projectId, parent, revision);
  const formOpen = adding || title !== "" || url !== "";

  async function create() {
    const valid = validate([
      ["title", !title.trim() && "Informe o título da evidência."],
      ["url", !isHttpUrl(url) && "Informe um link http ou https."],
    ]);
    if (!valid) {
      return;
    }

    setSaving(true);
    try {
      const response = await createEapEvidence(projectId, {
        title: title.trim(),
        url: url.trim(),
        ...parent,
      });
      if (response.status !== 201) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível registrar a evidência.");
      }
      forgetEvidences(projectId, parent);
      notifySuccess("Evidência registrada.");
      onTitle("");
      onUrl("");
      setAdding(false);
      onCreated();
    } catch (caught) {
      showAlert(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    onTitle("");
    onUrl("");
    reset();
    setAdding(false);
  }

  return (
    <EditSection
      title="Evidências vinculadas"
      subtitle="Documentos e registros associados ao item"
      aside={
        canRegister ? (
          <Button type="button" variant="outline" className={compactButtonClass} disabled={formOpen} onClick={() => setAdding(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            Adicionar
          </Button>
        ) : null
      }
    >
      <Suspense fallback={<Skeleton className="h-[39px] w-full rounded-[7px]" />}>
        <EvidenceList request={request} emptyWarning={emptyWarning} />
      </Suspense>
      {canRegister ? (
        <Reveal open={formOpen}>
        <div className="mt-3 rounded-[7px] border border-[#e4e7ec] bg-[#fafbfc] p-3">
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
            <EditText label="Título da evidência *" value={title} onChange={(value) => { onTitle(value); clear("title"); }} error={errors.title} />
            <EditText label="Link *" value={url} onChange={(value) => { onUrl(value); clear("url"); }} error={errors.url} />
          </div>
          <div className="mt-3 flex justify-end gap-[7px]">
            <Button type="button" variant="outline" className={compactButtonClass} disabled={saving} onClick={cancel}>
              Cancelar
            </Button>
            <Button type="button" className={`${compactButtonClass} border-transparent bg-[#175cd3] text-white hover:bg-[#144ca8]`} loading={saving} onClick={() => void create()}>
              <Check className="size-3.5" aria-hidden="true" />
              {saving ? "Registrando…" : "Vincular evidência"}
            </Button>
          </div>
        </div>
        </Reveal>
      ) : null}
      {!canRegister ? (
        <p className="mt-2.5 text-[8.5px] text-[#98a2b3]">{unavailableText}</p>
      ) : null}
    </EditSection>
  );
}

function EvidenceList({ request, emptyWarning }: { request: Promise<EvidenceState>; emptyWarning: string | null }) {
  const state = use(request);

  if (state.status === "error") {
    return <p className={emptyInlineClass}>{state.message}</p>;
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
        <p className={emptyInlineClass}>Nenhuma evidência vinculada.</p>
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
            <span className="flex items-center gap-1 text-[7.5px] text-[#98a2b3]">
              {item.deliveryId ? <Lock className="size-2.5" aria-hidden="true" /> : null}
              Registrada em {item.createdAt}
              {item.deliveryId ? " · enviada para homologação" : ""}
            </span>
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

const compactButtonClass = "h-[30px] gap-[5px] rounded-[7px] border-[#d7dce3] px-[9px] text-[8.5px] font-semibold text-[#344054]";
const emptyInlineClass = "flex min-h-[39px] items-center rounded-[7px] border border-dashed border-[#d7dce3] bg-[#f8f9fb] px-2.5 text-[8.5px] text-[#98a2b3]";

function FoldBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof CalendarIcon;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  return (
    <section className="mt-3 shrink-0 rounded-[9px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <button
        type="button"
        aria-expanded={open}
        className="flex min-h-12 w-full items-center justify-between px-[15px] text-[9.5px] font-semibold text-[#344054]"
        onClick={() => {
          setSeen(true);
          setOpen(!open);
        }}
      >
        <span className="flex items-center gap-2">
          <Icon className="size-4" aria-hidden="true" />
          {title}
        </span>
        <ChevronRight className={`size-[15px] text-[#98a2b3] transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "-rotate-90" : "rotate-90"}`} aria-hidden="true" />
      </button>
      <Reveal open={open} bleed={false}>
        {seen ? <div className="border-t border-[#edf0f3] px-[15px] pt-[15px] pb-[15px]">{children}</div> : null}
      </Reveal>
    </section>
  );
}

function HistoryNote({
  projectId,
  entityType,
  entityId,
  refreshKey,
}: {
  projectId: string;
  entityType: "PHASE" | "TASK" | "MILESTONE";
  entityId: string;
  refreshKey: string;
}) {
  return (
    <FoldBlock title="Histórico de alterações" icon={Clock}>
      <EapHistory projectId={projectId} entityType={entityType} entityId={entityId} refreshKey={refreshKey} />
    </FoldBlock>
  );
}

function AssigneeField({
  people,
  value,
  onChange,
  label = "Responsável",
  emptyLabel = "Não informado",
  error,
}: {
  people: EapPerson[] | null;
  value: string;
  onChange: (value: string) => void;
  label?: string;
  emptyLabel?: string;
  error?: string | null;
}) {
  const errorId = useId();
  if (!people) {
    return <EditNotice text="A lista de participantes não pôde ser consultada." />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <EditLabel label={label} />
      <OptionCombobox
        label={label}
        value={value}
        onChange={onChange}
        options={[{ value: "", label: emptyLabel }, ...people.map((person) => ({ value: person.userId, label: person.name }))]}
        placeholder={emptyLabel}
        invalid={Boolean(error)}
        describedBy={errorId}
        compact
        className={comboboxControlClass}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function EditStatus({ feedback }: { feedback: string | null }) {
  if (!feedback) {
    return null;
  }
  return (
    <p role="status" className="mt-3 text-[8.5px] text-[#667085]">
      {feedback}
    </p>
  );
}

function EditNotice({ text }: { text: string }) {
  return <p className="text-[8.5px] leading-[1.5] text-[#98a2b3]">{text}</p>;
}

function historyKey(item: object, revision: number | string) {
  return `${revision}:${JSON.stringify({ ...item, tasks: undefined, milestones: undefined })}`;
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function errorMessage(error: unknown) {
  return reportFailure(error, "Não foi possível concluir a atualização.");
}

function useSaveController(
  onController: ((controller: EapSaveController) => void) | undefined,
  save: () => void,
  saving: boolean,
  locked = false,
) {
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    onController?.({ save: () => saveRef.current(), saving, locked });
  }, [onController, saving, locked]);
}

function EditContext({ kind, code, status, statusKind }: { kind: "phase" | "task" | "milestone"; code: string; status: string; statusKind: EapStatusKind }) {
  const label = kind === "phase" ? "Fase" : kind === "task" ? "Tarefa" : "Marco";
  const Icon = kind === "phase" ? Folder : kind === "task" ? Check : Flag;
  const tone = kind === "phase" ? "bg-[#e9f2ff] text-[#2865b9]" : kind === "task" ? "bg-[#eef2f6] text-[#52677e]" : "bg-[#f4ecfb] text-[#8b5bbb]";
  return (
    <div className="-mx-6 mb-4 grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[#e4e7ec] bg-white px-6 py-[13px]">
      <span className={`grid size-8 place-items-center rounded-[7px] ${tone}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span>
        <span className="mb-[3px] block text-[8px] text-[#98a2b3]">Item da EAP</span>
        <strong className="block text-[10px] text-[#344054]">{code} · {label}</strong>
      </span>
      <EapStatusBadge kind={statusKind} label={status} />
    </div>
  );
}

function EditSection({
  title,
  subtitle,
  aside,
  tone = "plain",
  children,
}: {
  title: string;
  subtitle: string;
  aside?: ReactNode;
  tone?: "plain" | "accent";
  children: ReactNode;
}) {
  return (
    <section className={`mt-3 rounded-[9px] border bg-white p-[17px] shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${tone === "accent" ? "border-[#d8e6f8]" : "border-[#e4e7ec]"}`}>
      <div className="mb-[15px] flex items-start justify-between gap-3">
        <div>
          <strong className="block text-[11px] text-[#253248]">{title}</strong>
          <span className="mt-1 block text-[8.5px] text-[#98a2b3]">{subtitle}</span>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function EditLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="flex items-baseline justify-between text-[8.5px] font-semibold text-[#475467]">
      {label}
      {hint ? <small className="text-[7.5px] font-normal text-[#98a2b3]">{hint}</small> : null}
    </span>
  );
}

function EditText({
  label,
  value,
  onChange,
  full = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  full?: boolean;
  error?: string | null;
}) {
  const errorId = useId();
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <EditLabel label={label} />
      <input
        className={editControlClass}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError id={errorId} message={error} />
    </label>
  );
}

function EditArea({
  label,
  value,
  onChange,
  hint,
  placeholder,
  disabled = false,
  full = false,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  full?: boolean;
  error?: string | null;
}) {
  const errorId = useId();
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <EditLabel label={label} hint={hint} />
      <textarea
        className={`${editControlClass} min-h-[66px] py-2`}
        rows={3}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError id={errorId} message={error} />
    </label>
  );
}

function EditLocked({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <EditLabel label={label} hint={hint} />
      <input className={editControlClass} value={value} disabled readOnly />
    </label>
  );
}
