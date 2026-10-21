"use client";

import { AlertTriangle, CalendarIcon, Check, ChevronRight, Clock, FileText, Flag, Folder, List, Plus, Upload } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { Suspense, use, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { controlFocusClassName, controlTransitionClassName } from "@/components/ui/control-motion";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/api/fetcher";
import {
  createEapEvidence,
  deliverEapMilestone,
  listEapEvidences,
  reviewEapMilestone,
  updateEapMilestone,
  updateEapPhase,
  updateEapTask,
  updateEapTaskProgress,
} from "@/lib/api/generated/eap/eap";
import type { ReviewEapMilestoneBodyDecision } from "@/lib/api/generated/model/reviewEapMilestoneBodyDecision";

import {
  canEditItem,
  canRegisterEvidenceOn,
  canReviewMilestone,
  canUpdateTaskProgress,
  type EapAccess,
} from "./eap-access";
import { basisToPercent, formatBasis, phaseProgress, progressLabel } from "./eap-progress";
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
import {
  PHASE_STATUSES,
  TASK_STATUSES,
  phaseStatusLabel,
  recordedDate,
  taskStatusLabel,
} from "./project-records";

export type EapPerson = {
  userId: string;
  name: string;
};

type EvidenceState =
  | { status: "ready"; items: { id: string; title: string; url: string; createdAt: string }[] }
  | { status: "error"; message: string };

export type EapSaveController = {
  save: () => void;
  saving: boolean;
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
  dirtyRef,
  onController,
  onPhase,
}: {
  projectId: string;
  phase: ProjectPhaseView;
  access: EapAccess;
  code: string;
  projectName: string;
  dirtyRef: RefObject<boolean>;
  onController?: (controller: EapSaveController) => void;
  onPhase: (phase: ProjectPhaseView) => void;
}) {
  const canEdit = canEditItem(access, phase.createdBy);
  const [name, setName] = useState(phase.name);
  const [description, setDescription] = useState(phase.description ?? "");
  const [status, setStatus] = useState(phase.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const dirty =
    canEdit &&
    (name.trim() !== phase.name ||
      emptyToNull(description) !== phase.description ||
      status !== phase.status);

  function publish(next: { name: string; description: string; status: ProjectPhaseView["status"] }) {
    dirtyRef.current =
      canEdit &&
      (next.name.trim() !== phase.name ||
        emptyToNull(next.description) !== phase.description ||
        next.status !== phase.status);
  }

  async function save() {
    if (!dirty) {
      setFeedback("Nada para salvar.");
      setError(null);
      return;
    }

    if (!name.trim()) {
      setError("Informe o nome da fase.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await updateEapPhase(projectId, phase.id, {
        ...(name.trim() !== phase.name ? { name: name.trim() } : {}),
        ...(emptyToNull(description) !== phase.description ? { description: emptyToNull(description) } : {}),
        ...(status !== phase.status ? { status } : {}),
      });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível atualizar a fase.");
      }
      onPhase(presentPhase(response.data, { tasks: phase.tasks, milestones: phase.milestones }));
      dirtyRef.current = false;
      setFeedback("Fase atualizada.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  useSaveController(onController, () => void save(), saving);
  const progress = phaseProgress(phase);
  const due = phase.dates.find((date) => date.label.startsWith("Fim planejado"))?.value || "Não informada";

  return (
    <div className="flex flex-col pb-4">
      <EditContext kind="phase" code={code} status={phaseStatusLabel(status)} />
      <EditSection title="Informações básicas" subtitle="Identificação e organização do item">
        {canEdit ? (
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
            <EditText label="Nome do item" value={name} onChange={(value) => { setName(value); publish({ name: value, description, status }); }} full />
            <EditArea label="Descrição" value={description} onChange={(value) => { setDescription(value); publish({ name, description: value, status }); }} full />
            <EditSelect label="Situação" value={status} onChange={(value) => { setStatus(value); publish({ name, description, status: value }); }}>
              {PHASE_STATUSES.map((item) => (
                <option key={item} value={item}>{phaseStatusLabel(item)}</option>
              ))}
            </EditSelect>
            <EditLocked label="Item superior" value={projectName} />
            <EditLocked label="Responsável" hint="não gravado" value="A fase não possui responsável" />
            <EditLocked label="Prazo vigente" value={due} />
          </div>
        ) : (
          <EditNotice text="A situação e a descrição da fase podem ser alteradas por quem estrutura a EAP." />
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
            <p className="text-[8.5px] text-[#98a2b3]">{progress.kind === "incomplete" ? "Esta fase ainda não tem itens subordinados." : "O percentual desta fase não está disponível."}</p>
          )}
        </div>
        <EditArea label="Critério de conclusão" hint="não gravado" value="" onChange={() => undefined} disabled full />
      </EditSection>
      <PlanningDates dates={phase.dates} startLabel="Início planejado (vigente)" dueLabel="Fim planejado (vigente)" />
      <HistoryNote />
      <EditStatus error={error} feedback={feedback} />
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
  const [status, setStatus] = useState(task.status);
  const [percent, setPercent] = useState(String(task.progressPercent));
  const [impediment, setImpediment] = useState(task.hasImpediment);
  const [blocker, setBlocker] = useState("");
  const [actualStart, setActualStart] = useState(civilDateInput(task.actualStartAt));
  const [actualEnd, setActualEnd] = useState(civilDateInput(task.actualEndAt));
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [evidenceRevision, setEvidenceRevision] = useState(0);
  const structureDirty =
    canEdit &&
    (title.trim() !== task.title ||
      emptyToNull(description) !== task.description ||
      emptyToNull(assigneeId) !== task.assigneeId ||
      weight !== String(task.weight));
  const progressDirty =
    canProgress &&
    (status !== task.status ||
      percent !== String(task.progressPercent) ||
      impediment !== task.hasImpediment ||
      actualStart !== civilDateInput(task.actualStartAt) ||
      actualEnd !== civilDateInput(task.actualEndAt));

  function publish(next: {
    title: string;
    description: string;
    assigneeId: string;
    weight: string;
    status: ProjectTaskView["status"];
    percent: string;
    impediment: boolean;
    actualStart: string;
    actualEnd: string;
    evidenceTitle: string;
    evidenceUrl: string;
  }) {
    const nextStructure =
      canEdit &&
      (next.title.trim() !== task.title ||
        emptyToNull(next.description) !== task.description ||
        emptyToNull(next.assigneeId) !== task.assigneeId ||
        next.weight !== String(task.weight));
    const nextProgress =
      canProgress &&
      (next.status !== task.status ||
        next.percent !== String(task.progressPercent) ||
        next.impediment !== task.hasImpediment ||
        next.actualStart !== civilDateInput(task.actualStartAt) ||
        next.actualEnd !== civilDateInput(task.actualEndAt));
    dirtyRef.current =
      nextStructure || nextProgress || next.evidenceTitle.trim() !== "" || next.evidenceUrl.trim() !== "";
  }

  function draft() {
    return { title, description, assigneeId, weight, status, percent, impediment, actualStart, actualEnd, evidenceTitle, evidenceUrl };
  }

  function chooseStatus(next: ProjectTaskView["status"]) {
    const nextPercent = next === "CONCLUIDA" ? "100" : percent;
    setStatus(next);
    if (next === "CONCLUIDA") {
      setPercent("100");
    }
    publish({ ...draft(), status: next, percent: nextPercent });
  }

  async function save() {
    const progress = Number(percent);
    const parsedWeight = Number(weight);

    if (!structureDirty && !progressDirty) {
      setFeedback("Nada para salvar.");
      setError(null);
      return;
    }

    if (canEdit && !title.trim()) {
      setError("Informe o título da tarefa.");
      return;
    }

    if (canEdit && (!Number.isInteger(parsedWeight) || parsedWeight < 1)) {
      setError("O peso precisa ser um número inteiro maior que zero.");
      return;
    }

    if (canProgress && (!Number.isInteger(progress) || progress < 0 || progress > 100)) {
      setError("O percentual precisa ser um inteiro de 0 a 100.");
      return;
    }

    if (canProgress && status === "CONCLUIDA" && progress !== 100) {
      setError("Tarefa concluída deve ter percentual 100.");
      return;
    }

    if (canProgress && actualEnd && !actualStart) {
      setError("A data real de término exige uma data real de início.");
      return;
    }

    if (canProgress && actualStart && actualEnd && actualEnd < actualStart) {
      setError("A data real de término não pode ser anterior à data de início.");
      return;
    }

    setSaving(true);
    setError(null);
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
          ...(status !== current.status ? { status } : {}),
          ...(progress !== current.progressPercent ? { progressPercent: progress } : {}),
          ...(impediment !== current.hasImpediment ? { hasImpediment: impediment } : {}),
          ...(actualStart !== civilDateInput(current.actualStartAt)
            ? { actualStartAt: civilDateToIso(actualStart) }
            : {}),
          ...(actualEnd !== civilDateInput(current.actualEndAt)
            ? { actualEndAt: civilDateToIso(actualEnd) }
            : {}),
        });
        if (response.status !== 200) {
          throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível atualizar o andamento.");
        }
        current = presentTask(response.data, names);
      }

      onTask(current);
      dirtyRef.current = evidenceTitle.trim() !== "" || evidenceUrl.trim() !== "";
      setFeedback("Tarefa atualizada.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  useSaveController(onController, () => void save(), saving);
  const due = task.dates.find((date) => date.label.startsWith("Fim planejado"))?.value || "Não informada";
  const progressValue = Number(percent);
  const progressShown = Number.isFinite(progressValue) ? Math.min(100, Math.max(0, progressValue)) : 0;

  return (
    <div className="flex flex-col pb-4">
      <EditContext kind="task" code={code} status={taskStatusLabel(status)} />
      <EditSection title="Informações básicas" subtitle="Identificação e organização do item">
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
          {canEdit ? (
            <EditText label="Nome do item" value={title} onChange={(value) => { setTitle(value); publish({ ...draft(), title: value }); }} full />
          ) : (
            <EditLocked label="Nome do item" value={task.title} />
          )}
          {canEdit ? (
            <EditArea label="Descrição" value={description} onChange={(value) => { setDescription(value); publish({ ...draft(), description: value }); }} full />
          ) : (
            <EditLocked label="Descrição" value={task.description?.trim() || "Nenhuma descrição registrada."} />
          )}
          {canProgress ? (
            <EditSelect label="Situação" value={status} onChange={chooseStatus}>
              {TASK_STATUSES.map((item) => (
                <option key={item} value={item}>{taskStatusLabel(item)}</option>
              ))}
            </EditSelect>
          ) : (
            <EditLocked label="Situação" value={task.statusLabel} />
          )}
          <EditLocked label="Item superior" value={phase.name} />
          {canEdit ? (
            <AssigneeField people={people} value={assigneeId} onChange={(value) => { setAssigneeId(value); publish({ ...draft(), assigneeId: value }); }} />
          ) : (
            <EditLocked label="Responsável" value={task.assigneeName || "Não informado"} />
          )}
          <EditLocked label="Prazo vigente" value={due} />
        </div>
      </EditSection>
      <EditSection title="Andamento da tarefa" subtitle="Atualização rápida do progresso registrado" tone="accent" aside={<strong className="text-[12px] text-[#175cd3]">{progressShown}%</strong>}>
        {canProgress ? (
          <>
            <Progress value={progressShown} aria-label="Andamento da tarefa" className="mb-3 [&_[data-slot=progress-indicator]]:bg-[#2873cf] [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-[#e9eef5]" />
            <div className="mt-[11px] mb-3.5 grid grid-cols-6 gap-1.5">
              {[0, 25, 50, 75, 90, 100].map((value) => (
                <button key={value} type="button" className={`h-[29px] min-w-0 rounded-[6px] border text-[8.5px] font-semibold ${progressShown === value ? "border-[#8eb4e7] bg-[#edf4ff] text-[#175cd3]" : "border-[#dce1e7] bg-white text-[#667085]"}`} onClick={() => { setPercent(String(value)); publish({ ...draft(), percent: String(value) }); }}>
                  {value}%
                </button>
              ))}
            </div>
            <div className="mb-3.5 grid grid-cols-[140px_auto] items-end gap-2">
              <EditText label="Percentual exato de andamento" value={percent} onChange={(value) => { setPercent(value); publish({ ...draft(), percent: value }); }} />
              <span className="flex h-9 items-center text-[8px] text-[#98a2b3]">% concluído</span>
            </div>
            {canEdit ? (
              <EditText label="Peso" value={weight} onChange={(value) => { setWeight(value); publish({ ...draft(), weight: value }); }} />
            ) : null}
            <div className="mt-3 grid grid-cols-1 gap-[13px] sm:grid-cols-2">
              <EditLocked label="Prioridade" hint="não gravado" value="Indisponível neste cadastro" />
              <EditLocked label="Dependência" hint="não gravado" value="Indisponível neste cadastro" />
            </div>
            <button type="button" className={`mt-3.5 grid w-full grid-cols-[34px_minmax(0,1fr)] items-center gap-[9px] rounded-[7px] border px-2.5 py-2.5 text-left ${impediment ? "border-[#efc3bf] bg-[#fff9f8]" : "border-[#e4e7ec] bg-white"}`} onClick={() => { const next = !impediment; setImpediment(next); publish({ ...draft(), impediment: next }); }}>
              <span className={`grid size-8 place-items-center rounded-[6px] ${impediment ? "bg-[#fdeceb] text-[#b42318]" : "bg-[#f2f4f7] text-[#8a94a6]"}`}>
                <AlertTriangle className="size-4" aria-hidden="true" />
              </span>
              <span>
                <strong className="block text-[9.5px] text-[#344054]">Esta tarefa está impedida</strong>
                <small className="mt-[3px] block text-[8px] text-[#98a2b3]">Destaque o item na EAP e informe o motivo.</small>
              </span>
            </button>
            {impediment ? (
              <div className="mt-3">
                <EditArea label="Descrição do impedimento" hint="não gravado" value={blocker} placeholder="Descreva o impedimento e a ação necessária..." onChange={setBlocker} full />
              </div>
            ) : null}
          </>
        ) : (
          <EditNotice text="O andamento desta tarefa pode ser atualizado por quem estrutura a EAP ou pelo responsável, quando ele é fornecedor ou desenvolvedor do projeto." />
        )}
      </EditSection>
      <EvidenceSection
        projectId={projectId}
        parent={{ taskId: task.id }}
        canRegister={canRegisterEvidenceOn(access, task)}
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
      <PlanningDates
        dates={task.dates}
        startLabel="Início planejado (vigente)"
        dueLabel="Fim planejado (vigente)"
        extra={
          canProgress ? (
            <>
              <DateField label="Início realizado" value={actualStart} onChange={(value) => { setActualStart(value); publish({ ...draft(), actualStart: value }); }} />
              <DateField label="Fim realizado" value={actualEnd} onChange={(value) => { setActualEnd(value); publish({ ...draft(), actualEnd: value }); }} />
            </>
          ) : null
        }
      />
      <HistoryNote />
      <EditStatus error={error} feedback={feedback} />
    </div>
  );
}

function MilestoneEditor({
  projectId,
  phase,
  milestone,
  access,
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
  names: Map<string, string> | null;
  code: string;
  dirtyRef: RefObject<boolean>;
  onController?: (controller: EapSaveController) => void;
  onMilestone: (milestone: ProjectMilestoneView) => void;
}) {
  const canEdit = canEditItem(access, milestone.createdBy);
  const [title, setTitle] = useState(milestone.title);
  const [description, setDescription] = useState(milestone.description ?? "");
  const [decision, setDecision] = useState<ReviewEapMilestoneBodyDecision>("APROVADO");
  const [note, setNote] = useState("");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [evidenceRevision, setEvidenceRevision] = useState(0);
  const canReview = canReviewMilestone(access, milestone.deliveredById);
  const canDeliver =
    access.canDeliverMilestone &&
    milestone.type === "ENTREGA" &&
    (milestone.status === "PENDENTE" || milestone.status === "REJEITADO");
  const reviewReady =
    canReview &&
    ((milestone.type === "ENTREGA" && milestone.status === "ENTREGUE" && milestone.deliveredById) ||
      (milestone.type === "APROVACAO" &&
        (milestone.status === "PENDENTE" || milestone.status === "REJEITADO")));
  const structureDirty =
    canEdit &&
    (title.trim() !== milestone.title || emptyToNull(description) !== milestone.description);

  function publish(next: {
    title: string;
    description: string;
    note: string;
    evidenceTitle: string;
    evidenceUrl: string;
  }) {
    const nextStructure =
      canEdit &&
      (next.title.trim() !== milestone.title || emptyToNull(next.description) !== milestone.description);
    dirtyRef.current =
      nextStructure || next.note.trim() !== "" || next.evidenceTitle.trim() !== "" || next.evidenceUrl.trim() !== "";
  }

  function draft() {
    return { title, description, note, evidenceTitle, evidenceUrl };
  }

  async function saveDetails() {
    if (!structureDirty) {
      setFeedback("Nada para salvar.");
      setError(null);
      return;
    }

    if (!title.trim()) {
      setError("Informe o título do marco.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);

    try {
      const response = await updateEapMilestone(projectId, phase.id, milestone.id, {
        ...(title.trim() !== milestone.title ? { title: title.trim() } : {}),
        ...(emptyToNull(description) !== milestone.description
          ? { description: emptyToNull(description) }
          : {}),
      });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível atualizar o marco.");
      }
      onMilestone(presentMilestone(response.data, names));
      dirtyRef.current = note.trim() !== "" || evidenceTitle.trim() !== "" || evidenceUrl.trim() !== "";
      setFeedback("Marco atualizado.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function deliver() {
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await deliverEapMilestone(projectId, phase.id, milestone.id, {});
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível registrar a entrega.");
      }
      onMilestone(presentMilestone(response.data, names));
      setFeedback("Entrega registrada. O marco continua pendente de aceite.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function review() {
    if (decision === "REJEITADO" && note.trim().length < 10) {
      setError("A rejeição exige justificativa com ao menos 10 caracteres.");
      return;
    }

    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const response = await reviewEapMilestone(projectId, phase.id, milestone.id, {
        decision,
        note: note.trim() ? note.trim() : null,
      });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível registrar o aceite.");
      }
      onMilestone(presentMilestone(response.data, names));
      setNote("");
      publish({ ...draft(), note: "" });
      setFeedback(decision === "APROVADO" ? "Marco aprovado." : "Marco rejeitado.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  useSaveController(onController, () => void saveDetails(), saving);
  const due = milestone.dates.find((date) => date.label.startsWith("Planejada"))?.value || "Não informada";

  return (
    <div className="flex flex-col pb-4">
      <EditContext kind="milestone" code={code} status={milestone.statusLabel} />
      <EditSection title="Informações básicas" subtitle="Identificação e organização do item">
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
          {canEdit ? (
            <EditText label="Nome do item" value={title} onChange={(value) => { setTitle(value); publish({ ...draft(), title: value }); }} full />
          ) : (
            <EditLocked label="Nome do item" value={milestone.title} />
          )}
          {canEdit ? (
            <EditArea label="Descrição" value={description} onChange={(value) => { setDescription(value); publish({ ...draft(), description: value }); }} full />
          ) : (
            <EditLocked label="Descrição" value={milestone.description?.trim() || "Nenhuma descrição registrada."} />
          )}
          <EditLocked label="Item superior" value={phase.name} />
          <EditLocked label="Responsável" hint="não gravado" value="O marco não possui responsável próprio" />
          <EditLocked label="Prazo vigente" value={due} />
          <EditLocked label="Tipo do marco" value={milestone.typeLabel} />
        </div>
      </EditSection>
      <EditSection title="Registro da entrega" subtitle="A entrega e a aprovação formal são etapas independentes" tone="accent">
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
          <EditLocked label="Situação da entrega" value={milestone.statusLabel} />
          <EditLocked label="Entrega registrada por" value={milestone.deliveredBy ?? "Ainda não registrada"} />
          <EditArea label="Observações da entrega" hint="não gravado" value="" placeholder="A entrega é registrada sem observações." onChange={() => undefined} disabled full />
        </div>
        <div className="mt-[15px] border-t border-[#edf0f3] pt-[15px]">
          <span className="mb-2.5 block text-[8.5px] font-semibold tracking-[0.04em] text-[#8a94a6] uppercase">Aprovação formal</span>
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
            <EditLocked label="Responsável pelo aceite" value={milestone.validatedBy ?? "Definido na validação do marco"} />
            <EditLocked label="Critérios de aceite" hint="não gravado" value="Evidências validadas e sem pendências críticas" />
            {milestone.validationNote ? (
              <EditArea label="Justificativa registrada" value={milestone.validationNote} onChange={() => undefined} disabled full />
            ) : null}
          </div>
          {reviewReady ? (
            <div className="mt-[13px]">
              <EditLabel label="Decisão de aceite" />
              <div className="mt-1.5 mb-[13px] grid grid-cols-2 gap-1.5">
                {([
                  { value: "APROVADO", label: "Aprovar" },
                  { value: "REJEITADO", label: "Rejeitar" },
                ] as const).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={decision === option.value}
                    className={`h-[29px] min-w-0 rounded-[6px] border text-[8.5px] font-semibold ${decision === option.value ? "border-[#8eb4e7] bg-[#edf4ff] text-[#175cd3]" : "border-[#dce1e7] bg-white text-[#667085]"}`}
                    onClick={() => setDecision(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <EditArea
                label="Justificativa"
                hint={decision === "REJEITADO" ? "obrigatória" : undefined}
                value={note}
                placeholder="Registre o motivo da decisão."
                onChange={(value) => { setNote(value); publish({ ...draft(), note: value }); }}
                full
              />
              <div className="mt-3 flex justify-end">
                <Button type="button" className={`${compactButtonClass} border-transparent bg-[#175cd3] text-white hover:bg-[#144ca8]`} disabled={saving} onClick={() => void review()}>
                  <Check className="size-3.5" aria-hidden="true" />
                  Registrar decisão
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="mt-[13px] flex items-start gap-2 rounded-[7px] bg-[#fff8e9] p-2.5 text-[8.5px] leading-[1.5] text-[#8a6116]">
          <AlertTriangle className="mt-0.5 size-[15px] shrink-0" aria-hidden="true" />
          <span>
            {access.canManageStructure && milestone.deliveredById === access.userId
              ? "Quem registrou a entrega não valida o próprio marco. O aceite deve ser realizado por outro responsável autorizado."
              : "O responsável pela entrega pode registrar evidências e enviar para validação, mas o aceite deve ser realizado por outro responsável autorizado."}
          </span>
        </div>
        {canDeliver ? (
          <div className="mt-3 flex items-center justify-end gap-[9px]">
            <Button type="button" variant="outline" className={compactButtonClass} disabled={saving} onClick={() => void deliver()}>
              <Upload className="size-3.5" aria-hidden="true" />
              {saving ? "Enviando…" : "Enviar para validação"}
            </Button>
          </div>
        ) : null}
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
      <PlanningDates dates={milestone.dates} dueLabel="Planejada (vigente)" />
      <HistoryNote />
      <EditStatus error={error} feedback={feedback} />
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
}: {
  projectId: string;
  parent: { taskId: string } | { milestoneId: string };
  canRegister: boolean;
  revision: number;
  title: string;
  url: string;
  onTitle: (value: string) => void;
  onUrl: (value: string) => void;
  onCreated: () => void;
  emptyWarning?: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = evidenceRequest(projectId, parent, revision);
  const formOpen = adding || title !== "" || url !== "";

  async function create() {
    if (!title.trim() || !isHttpUrl(url)) {
      setError("Informe um título e um link http ou https.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const response = await createEapEvidence(projectId, {
        title: title.trim(),
        url: url.trim(),
        ...parent,
      });
      if (response.status !== 201) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível registrar a evidência.");
      }
      onTitle("");
      onUrl("");
      setAdding(false);
      onCreated();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    onTitle("");
    onUrl("");
    setError(null);
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
      {canRegister && formOpen ? (
        <div className="mt-3 rounded-[7px] border border-[#e4e7ec] bg-[#fafbfc] p-3">
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
            <EditText label="Título da evidência" value={title} onChange={onTitle} />
            <EditText label="Link" value={url} onChange={onUrl} />
          </div>
          {error ? <p className="mt-2 text-[8.5px] text-destructive">{error}</p> : null}
          <div className="mt-3 flex justify-end gap-[7px]">
            <Button type="button" variant="outline" className={compactButtonClass} disabled={saving} onClick={cancel}>
              Cancelar
            </Button>
            <Button type="button" className={`${compactButtonClass} border-transparent bg-[#175cd3] text-white hover:bg-[#144ca8]`} disabled={saving} onClick={() => void create()}>
              <Check className="size-3.5" aria-hidden="true" />
              {saving ? "Registrando…" : "Vincular evidência"}
            </Button>
          </div>
        </div>
      ) : null}
      {!canRegister ? (
        <p className="mt-2.5 text-[8.5px] text-[#98a2b3]">O registro de evidências não está disponível para este acesso.</p>
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
  return (
    <section className="mt-3 shrink-0 rounded-[9px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <button type="button" className="flex min-h-12 w-full items-center justify-between px-[15px] text-[9.5px] font-semibold text-[#344054]" onClick={() => setOpen((current) => !current)}>
        <span className="flex items-center gap-2">
          <Icon className="size-4" aria-hidden="true" />
          {title}
        </span>
        <ChevronRight className="size-[15px] rotate-90 text-[#98a2b3]" aria-hidden="true" />
      </button>
      {open ? <div className="border-t border-[#edf0f3] px-[15px] pt-[15px] pb-[15px]">{children}</div> : null}
    </section>
  );
}

function HistoryNote() {
  return (
    <FoldBlock title="Histórico de alterações" icon={Clock}>
      <p className="text-[10px] leading-relaxed text-[#667085]">A consulta do histórico deste item ainda não está disponível.</p>
    </FoldBlock>
  );
}

function PlanningDates({
  dates,
  startLabel,
  dueLabel,
  extra,
}: {
  dates: { label: string; value: string }[];
  startLabel?: string;
  dueLabel: string;
  extra?: ReactNode;
}) {
  const pick = (label: string) => dates.find((date) => date.label === label)?.value ?? "Não informada";
  return (
    <FoldBlock title="Planejamento e datas" icon={CalendarIcon}>
      <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
        {startLabel ? <EditLocked label="Início planejado" value={pick(startLabel)} /> : null}
        <EditLocked label="Prazo planejado" value={pick(dueLabel)} />
        <EditArea
          label="Justificativa de replanejamento"
          hint="não gravado"
          value=""
          onChange={() => undefined}
          placeholder="Obrigatória quando o prazo for alterado."
          disabled
          full
        />
        {extra}
      </div>
    </FoldBlock>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <EditLabel label={label} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className={`${editControlClass} justify-start px-2.5 font-normal shadow-none hover:bg-white ${value ? "text-[#344054]" : "text-[#98a2b3]"}`}
            />
          }
        >
          <CalendarIcon />
          {value ? formatCivilDate(value) : "Não informada"}
        </PopoverTrigger>
        <PopoverContent align="start" className="z-[80] w-auto p-0">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={civilToDate(value)}
            onSelect={(date) => {
              onChange(date ? formatCivilValue(date) : "");
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function civilToDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return undefined;
  }

  return new Date(year, month - 1, day);
}

function formatCivilValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatCivilDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return "Não informada";
  }

  return `${day}/${month}/${year}`;
}

function AssigneeField({
  people,
  value,
  onChange,
}: {
  people: EapPerson[] | null;
  value: string;
  onChange: (value: string) => void;
}) {
  if (!people) {
    return <EditNotice text="A lista de participantes não pôde ser consultada." />;
  }

  const current = people.find((person) => person.userId === value)?.name ?? "Não informado";

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <EditLabel label="Responsável" />
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" variant="outline" className={`${editControlClass} justify-between px-2.5 font-normal shadow-none hover:bg-white`} />}>
          <span className="truncate">{current}</span>
          <ChevronRight className="size-3.5 rotate-90 text-[#667085]" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => onChange("")}>Não informado</DropdownMenuItem>
            {people.map((person) => (
              <DropdownMenuItem key={person.userId} onClick={() => onChange(person.userId)}>
                {person.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function EditStatus({ error, feedback }: { error: string | null; feedback: string | null }) {
  if (!error && !feedback) {
    return null;
  }
  return (
    <p role={error ? "alert" : "status"} className={`mt-3 text-[8.5px] ${error ? "text-destructive" : "text-[#667085]"}`}>
      {error ?? feedback}
    </p>
  );
}

function EditNotice({ text }: { text: string }) {
  return <p className="text-[8.5px] leading-[1.5] text-[#98a2b3]">{text}</p>;
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
  return error instanceof ApiError ? error.message : "Não foi possível concluir a atualização.";
}

const evidenceRequests = new Map<string, Promise<EvidenceState>>();

function evidenceRequest(
  projectId: string,
  parent: { taskId: string } | { milestoneId: string },
  revision: number,
) {
  const key = `${projectId}:${"taskId" in parent ? parent.taskId : parent.milestoneId}:${revision}`;
  const existing = evidenceRequests.get(key);
  if (existing) {
    return existing;
  }

  const request = loadEvidences(projectId, parent);
  evidenceRequests.set(key, request);
  return request;
}

async function loadEvidences(
  projectId: string,
  parent: { taskId: string } | { milestoneId: string },
): Promise<EvidenceState> {
  try {
    const response = await listEapEvidences(projectId, parent);
    if (response.status !== 200) {
      return { status: "error", message: "Não foi possível consultar as evidências." };
    }

    return {
      status: "ready",
      items: response.data.data.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        createdAt: recordedDate(item.createdAt),
      })),
    };
  } catch (error) {
    return { status: "error", message: errorMessage(error) };
  }
}

function useSaveController(
  onController: ((controller: EapSaveController) => void) | undefined,
  save: () => void,
  saving: boolean,
) {
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    onController?.({ save: () => saveRef.current(), saving });
  }, [onController, saving]);
}

const editControlClass = `h-9 w-full rounded-[7px] border border-[#d7dce3] bg-white px-2.5 text-[10px] text-[#344054] outline-none disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#98a2b3] ${controlTransitionClassName} ${controlFocusClassName}`;

function EditContext({ kind, code, status }: { kind: "phase" | "task" | "milestone"; code: string; status: string }) {
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
      <span className="inline-flex items-center gap-[5px] rounded-full bg-[#f0f2f4] px-[7px] py-1 text-[8.5px] font-semibold text-[#667085]">
        <span className="size-[5px] rounded-full bg-current" />
        {status}
      </span>
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

function EditText({ label, value, onChange, full = false }: { label: string; value: string; onChange: (value: string) => void; full?: boolean }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <EditLabel label={label} />
      <input className={editControlClass} value={value} onChange={(event) => onChange(event.target.value)} />
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  full?: boolean;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <EditLabel label={label} hint={hint} />
      <textarea className={`${editControlClass} min-h-[66px] py-2`} rows={3} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EditSelect<T extends string>({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <EditLabel label={label} />
      <select className={editControlClass} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {children}
      </select>
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
