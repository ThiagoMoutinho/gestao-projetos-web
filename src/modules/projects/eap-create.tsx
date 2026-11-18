"use client";

import { useId, useState, type ReactNode } from "react";
import { AlertTriangle, CalendarIcon, Check, ChevronRight, Clock, Flag, List, Plus, X } from "lucide-react";
import { ptBR } from "react-day-picker/locale";

import { FieldError, useFieldErrors } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { controlFocusClassName, controlTransitionClassName } from "@/components/ui/control-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { OptionCombobox, OptionMultiCombobox } from "@/components/option-combobox";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/fetcher";
import { notifyWarning, reportFailure } from "@/lib/feedback";
import { createEapMilestone, createEapPhase, createEapTask, registerEapTaskImpediment, updateEapTaskProgress } from "@/lib/api/generated/eap/eap";
import type { ListEapMilestones200DataItemType } from "@/lib/api/generated/model/listEapMilestones200DataItemType";

import { canReschedule, type EapAccess } from "./eap-access";
import { phaseCoverage, spanOf } from "./eap-deadline";
import { MilestoneFlow } from "./eap-milestone-flow";
import { civilDateInput, phaseItemRanges, presentMilestone, presentPhase, presentTask, type ProjectMilestoneView, type ProjectPhaseView, type ProjectTaskView } from "./eap-present";
import { DEFAULT_PRIORITY, PRIORITY_OPTIONS, type TaskPriority } from "./eap-priority";
import type { EapPerson } from "./eap-panel";
import { Reveal } from "./eap-reveal";
import { deriveTaskStatus } from "./eap-status";
import { impedimentTone } from "./eap-tones";
import { EapContextStrip, EapPanelHeader, EapSection } from "./eap-ui";
import { MILESTONE_TYPE_OPTIONS, phaseStatusLabel, taskStatusLabel } from "./project-records";

export type EapCreateRequest =
  | { kind: "phase" }
  | { kind: "task"; phaseId: string; correctiveFor?: { milestoneId: string; title: string }; parentTaskId?: string }
  | { kind: "milestone"; phaseId: string };

export function EapCreateSheet({
  projectId,
  projectName,
  request,
  phases,
  people,
  names,
  access,
  onClose,
  onPhase,
  onTask,
  onMilestone,
}: {
  projectId: string;
  projectName: string;
  request: EapCreateRequest;
  phases: ProjectPhaseView[];
  people: EapPerson[] | null;
  names: Map<string, string> | null;
  access: EapAccess;
  onClose: () => void;
  onPhase: (phase: ProjectPhaseView) => void;
  onTask: (task: ProjectTaskView) => void;
  onMilestone: (milestone: ProjectMilestoneView) => void;
}) {
  const title =
    request.kind === "phase"
      ? "Nova fase"
      : request.kind === "task"
        ? request.correctiveFor
          ? "Nova tarefa corretiva"
          : request.parentTaskId
            ? "Nova subtarefa"
            : "Nova tarefa"
        : "Novo marco";
  const guidance = "Preencha os campos obrigatórios";

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        showCloseButton={false}
        overlayClassName="bg-[rgba(13,25,42,0.2)] supports-backdrop-filter:backdrop-blur-[1px]"
        className="w-full gap-0 overflow-hidden bg-card p-0 shadow-[0_18px_48px_rgba(16,24,40,0.16)] data-[side=right]:w-full data-[side=right]:sm:max-w-[680px]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <EapPanelHeader
            kind={request.kind}
            eyebrow="Novo item da EAP"
            title={<SheetTitle className="max-w-[520px] truncate text-[19px] leading-[1.35] font-semibold text-foreground">{title}</SheetTitle>}
            hint={
              <span className="mt-[7px] flex items-center gap-1.5 text-xs font-semibold text-status-attention-ink">
                <span className="size-1.5 rounded-full bg-status-attention" />
                {guidance}
              </span>
            }
            actions={
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Fechar painel" onClick={onClose}>
                <X />
              </Button>
            }
          />
          {access.canCreateItems ? (
            request.kind === "phase" ? (
              <PhaseForm projectId={projectId} projectName={projectName} phases={phases} people={people} names={names} onClose={onClose} onPhase={onPhase} />
            ) : request.kind === "task" ? (
              <TaskForm
                projectId={projectId}
                phases={phases}
                people={people}
                names={names}
                phaseId={request.phaseId}
                correctiveFor={request.correctiveFor ?? null}
                parentTask={
                  request.parentTaskId
                    ? (phases.flatMap((phase) => phase.tasks ?? []).find((task) => task.id === request.parentTaskId) ?? null)
                    : null
                }
                canExtendPhase={canReschedule(access)}
                onClose={onClose}
                onTask={onTask}
              />
            ) : (
              <MilestoneForm
                projectId={projectId}
                phases={phases}
                reviewers={access.canManageStructure ? (people?.filter((person) => person.homologator) ?? null) : undefined}
                presenters={access.canManageStructure ? people : undefined}
                names={names}
                phaseId={request.phaseId}
                canExtendPhase={canReschedule(access)}
                onClose={onClose}
                onMilestone={onMilestone}
              />
            )
          ) : (
            <p className="px-5 py-5 text-sm text-muted-foreground">Seu acesso não permite cadastrar itens da EAP.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PhaseForm({
  projectId,
  projectName,
  people,
  names,
  onClose,
  onPhase,
}: {
  projectId: string;
  projectName: string;
  phases: ProjectPhaseView[];
  people: EapPerson[] | null;
  names: Map<string, string> | null;
  onClose: () => void;
  onPhase: (phase: ProjectPhaseView) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [criteria, setCriteria] = useState("");
  const [saving, setSaving] = useState(false);
  const { errors, validate, clear } = useFieldErrors<"name" | "responsible">();
  async function save() {
    const valid = validate([
      ["name", !name.trim() && "Informe o nome da fase."],
      ["responsible", !responsibleId && "Designe o responsável pela fase."],
    ]);
    if (!valid) {
      return;
    }
    setSaving(true);
    try {
      const response = await createEapPhase(projectId, {
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        responsibleId,
        ...(criteria.trim() ? { completionCriteria: criteria.trim() } : {}),
      });
      if (response.status !== 201) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível criar a fase.");
      }
      onPhase(presentPhase(response.data, { tasks: [], milestones: [] }, names));
      onClose();
    } catch (caught) {
      reportFailure(caught, "Não foi possível criar a fase.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormBody saving={saving} onClose={onClose} onSubmit={() => void save()}>
      <ItemContext kind="phase" />
      <PanelSection title="Informações básicas" subtitle="Identificação e organização do item">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextControl label="Nome do item *" value={name} placeholder="Informe o nome da fase" onChange={(value) => { setName(value); clear("name"); }} error={errors.name} full />
          <AreaControl label="Descrição" value={description} placeholder="Descreva o objetivo e o resultado esperado." onChange={setDescription} full />
          <LockedControl label="Situação" hint="automática" value={phaseStatusLabel("NAO_INICIADA")} />
          <LockedControl label="Item superior" value={projectName} />
          {people ? (
            <SelectControl
              label="Responsável *"
              value={responsibleId}
              onChange={(value) => { setResponsibleId(value); clear("responsible"); }}
              error={errors.responsible}
              placeholder="Selecione o responsável..."
              options={people.map((person) => ({ value: person.userId, label: person.name }))}
            />
          ) : (
            <LockedControl label="Responsável *" value="Não foi possível consultar os participantes." />
          )}
          <LockedControl label="Planejamento" hint="nos detalhes da fase" value="Início e término definidos após a criação" />
        </div>
      </PanelSection>
      <PanelSection
        title="Configuração da fase"
        subtitle="O andamento é calculado pelos itens subordinados"
        aside={<span className="inline-flex items-center gap-[5px] rounded-full bg-primary/10 px-2 py-[5px] text-xs font-semibold text-primary"><List className="size-3" aria-hidden="true" />Calculado</span>}
        tone="accent"
      >
        <div className="mb-3.5 rounded-[7px] bg-muted/50 px-[11px] py-[11px]">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Andamento consolidado</span>
            <strong className="text-xs text-primary">0%</strong>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-track">
            <div className="h-full w-0 rounded-full bg-primary" />
          </div>
          <p className="mt-[9px] text-xs leading-normal text-muted-foreground">Calculado a partir das tarefas concluídas e marcos formalmente aceitos.</p>
        </div>
        <AreaControl label="Critério de conclusão" value={criteria} placeholder="Descreva o que precisa estar pronto para concluir a fase." onChange={setCriteria} rows={2} full />
      </PanelSection>
      <EvidenceSection />
      <HistorySection />
    </FormBody>
  );
}

function TaskForm({
  projectId,
  phases,
  people,
  names,
  phaseId,
  correctiveFor,
  parentTask,
  canExtendPhase,
  onClose,
  onTask,
}: {
  projectId: string;
  phases: ProjectPhaseView[];
  people: EapPerson[] | null;
  names: Map<string, string> | null;
  phaseId: string;
  /** Tarefa aberta para atender às correções solicitadas na homologação deste marco. */
  correctiveFor: { milestoneId: string; title: string } | null;
  /** Tarefa superior, quando o item novo é uma subtarefa (a fase fica a da superior). */
  parentTask: { id: string; title: string } | null;
  /** Quem pode reprogramar pode estender a fase na criação (ajuste em cascata). */
  canExtendPhase: boolean;
  onClose: () => void;
  onTask: (task: ProjectTaskView) => void;
}) {
  const [selectedPhase, setSelectedPhase] = useState(phaseId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Até duas pessoas: a primeira escolhida é o responsável principal e a segunda, o segundo responsável (apoio).
  const [assignees, setAssignees] = useState<string[]>([]);
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [progress, setProgress] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [blocker, setBlocker] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);
  const { errors, validate, clear } = useFieldErrors<"title" | "phase" | "assignee" | "priority" | "blocker" | "startDate" | "endDate">();
  const phase = phases.find((item) => item.id === selectedPhase);
  const phaseCurrent = phase ? { start: civilDateInput(phase.schedule.plannedStartAt), end: civilDateInput(phase.schedule.plannedEndAt) } : null;
  const coverage = phaseCurrent && startDate && endDate && endDate >= startDate ? phaseCoverage(phaseCurrent, spanOf([{ start: startDate, end: endDate }])) : null;
  // Criar o item fora do período da fase é o caso normal: quem pode reprogramar estende a fase junto, sem pergunta.
  // O ajuste não é silencioso: a API o registra no histórico da fase com a justificativa automática abaixo.
  const extending = coverage !== null && canExtendPhase;

  async function save() {
    const valid = validate([
      ["title", !title.trim() && "Informe o nome da tarefa."],
      ["phase", !selectedPhase && "Escolha a fase da tarefa."],
      // Sem a lista de participantes não há o que escolher: nesse caso a obrigatoriedade não bloqueia a criação.
      ["assignee", Boolean(people) && assignees.length === 0 && "Informe ao menos um responsável (até dois)."],
      ["priority", !priority && "Informe a prioridade."],
      ["blocker", blocked && blocker.trim().length < 10 && "Informe o motivo do impedimento com ao menos 10 caracteres."],
      ["startDate", !startDate && "Informe o início planejado."],
      ["endDate", !endDate && "Informe o término planejado."],
      ["endDate", Boolean(startDate && endDate) && endDate < startDate && "O término planejado não pode ser anterior ao início."],
    ]);
    if (!valid) {
      return;
    }
    setSaving(true);
    try {
      const response = await createEapTask(projectId, selectedPhase, {
        title: title.trim(),
        ...(parentTask ? { parentTaskId: parentTask.id } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(assignees[0] ? { assigneeId: assignees[0] } : {}),
        ...(assignees[1] ? { secondaryAssigneeId: assignees[1] } : {}),
        priority: priority || DEFAULT_PRIORITY,
        plannedStartAt: civilToIso(startDate),
        plannedEndAt: civilToIso(endDate),
        ...(extending ? { extendPhase: true, justification: `Período da fase ajustado automaticamente na criação da tarefa "${title.trim()}".` } : {}),
        ...(correctiveFor ? { correctiveMilestoneId: correctiveFor.milestoneId } : {}),
      });
      if (response.status !== 201) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível criar a tarefa.");
      }
      let created = response.data;
      if (progress > 0) {
        const patched = await updateEapTaskProgress(projectId, selectedPhase, created.id, { progressPercent: progress });
        if (patched.status === 200) {
          created = patched.data;
        }
      }
      if (blocked) {
        try {
          const registered = await registerEapTaskImpediment(projectId, selectedPhase, created.id, { description: blocker.trim() });
          if (registered.status !== 201) {
            throw new ApiError(registered.status, "HTTP_ERROR", "O impedimento não foi registrado.");
          }
          created = registered.data.task;
        } catch (caught) {
          notifyWarning(
            "Tarefa criada sem o impedimento.",
            `${caught instanceof ApiError ? caught.message : "O impedimento não foi registrado."} Registre-o na edição da tarefa.`,
          );
        }
      }
      onTask(presentTask(created, names));
      onClose();
    } catch (caught) {
      reportFailure(caught, "Não foi possível criar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormBody saving={saving} onClose={onClose} onSubmit={() => void save()}>
      <ItemContext kind="task" />
      {correctiveFor ? (
        <p className="mt-4 flex items-start gap-2 rounded-[7px] border border-status-adjust/40 bg-status-adjust-soft p-2.5 text-xs leading-[1.45] text-status-adjust-ink">
          <Flag className="mt-px size-[15px] shrink-0" aria-hidden="true" />
          <span>
            Tarefa corretiva do marco <strong>{correctiveFor.title}</strong>. Ela fica vinculada às correções da homologação e
            segue o andamento normal das tarefas.
          </span>
        </p>
      ) : null}
      <PanelSection title="Informações básicas" subtitle="Identificação e organização do item">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextControl label="Nome do item *" value={title} placeholder="Informe o nome da tarefa" onChange={(value) => { setTitle(value); clear("title"); }} error={errors.title} full />
          <AreaControl label="Descrição" value={description} placeholder="Descreva o objetivo e o resultado esperado." onChange={setDescription} full />
          <LockedControl label="Situação" hint="pelo andamento" value={taskStatusLabel(deriveTaskStatus(progress))} />
          {parentTask ? (
            <LockedControl
              label="Tarefa superior"
              hint={phases.find((phase) => phase.id === selectedPhase)?.name}
              value={parentTask.title}
            />
          ) : correctiveFor ? (
            <LockedControl
              label="Item superior"
              hint="fase do marco"
              value={phases.find((phase) => phase.id === selectedPhase)?.name ?? "Fase do marco"}
            />
          ) : (
            <SelectControl
              label="Item superior *"
              value={selectedPhase}
              onChange={(value) => { setSelectedPhase(value); clear("phase"); }}
              error={errors.phase}
              placeholder="Selecione a fase..."
              options={phases.map((phase, index) => ({ value: phase.id, label: `${index + 1} · ${phase.name}` }))}
            />
          )}
          {people ? (
            <MultiSelectControl
              label="Responsável *"
              hint="até 2 pessoas"
              values={assignees}
              onChange={(values) => { setAssignees(values); clear("assignee"); }}
              options={people.map((person) => ({ value: person.userId, label: person.name }))}
              max={2}
              error={errors.assignee}
              placeholder="Selecione os responsáveis..."
            />
          ) : (
            <LockedControl label="Responsável *" value="Não foi possível consultar os participantes." />
          )}
          <SelectControl
            label="Prioridade *"
            value={priority}
            onChange={(value) => { setPriority(value); clear("priority"); }}
            error={errors.priority}
            placeholder="Selecione a prioridade..."
            options={PRIORITY_OPTIONS.map((option) => ({ ...option }))}
          />
          <CivilDateField label="Início planejado *" value={startDate} onChange={(value) => { setStartDate(value); clear("startDate"); clear("endDate"); }} error={errors.startDate} />
          <CivilDateField label="Término planejado *" value={endDate} onChange={(value) => { setEndDate(value); clear("endDate"); }} error={errors.endDate} />
        </div>
      </PanelSection>
      <PanelSection title="Andamento da tarefa" subtitle="Atualização rápida do progresso registrado" aside={<strong className="text-xs text-primary">{progress}%</strong>} tone="accent">
        <div className="h-1.5 overflow-hidden rounded-full bg-track">
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-[11px] mb-3.5 grid grid-cols-5 gap-1.5">
          {[0, 25, 50, 75, 90].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={progress === value}
              className={`h-8 min-w-0 rounded-[6px] border text-xs font-semibold ${progress === value ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground"}`}
              onClick={() => setProgress(value)}
            >
              {value}%
            </button>
          ))}
        </div>
        <div className="mb-3.5 grid grid-cols-[140px_auto] items-end gap-2">
          <TextControl label="Percentual exato de andamento" value={String(progress)} onChange={(value) => setProgress(Math.min(90, clampPercent(value)))} />
          <span className="flex h-9 items-center text-xs text-muted-foreground">% concluído</span>
        </div>
        <p className="mb-3.5 text-xs leading-normal text-muted-foreground">A conclusão é registrada depois, em “Concluir tarefa”, com as datas reais confirmadas.</p>
        <button
          type="button"
          aria-expanded={blocked}
          className={`mt-3.5 grid w-full grid-cols-[34px_minmax(0,1fr)] items-center gap-[9px] rounded-[7px] border px-2.5 py-2.5 text-left ${controlTransitionClassName} ${blocked ? impedimentTone.surface : "border-border bg-card"}`}
          onClick={() => setBlocked((current) => !current)}
        >
          <span className={`grid size-8 place-items-center rounded-[6px] transition-colors duration-200 ease-out motion-reduce:transition-none ${blocked ? impedimentTone.icon : "bg-muted text-muted-foreground"}`}>
            <AlertTriangle className="size-4" aria-hidden="true" />
          </span>
          <span>
            <strong className="block text-xs text-foreground">Esta tarefa está impedida</strong>
            <small className="mt-[3px] block text-xs text-muted-foreground">Destaque o item na EAP e informe o motivo.</small>
          </span>
        </button>
        <Reveal open={blocked}>
          <div className="pt-3">
            <AreaControl label="Motivo do impedimento *" value={blocker} placeholder="Descreva o impedimento e a ação necessária..." onChange={(value) => { setBlocker(value); clear("blocker"); }} error={errors.blocker} rows={3} full />
          </div>
        </Reveal>
      </PanelSection>
      <EvidenceSection />
      <HistorySection />
    </FormBody>
  );
}

function MilestoneForm({
  projectId,
  phases,
  reviewers,
  presenters,
  names,
  phaseId,
  canExtendPhase,
  onClose,
  onMilestone,
}: {
  projectId: string;
  phases: ProjectPhaseView[];
  /** Quem pode reprogramar pode estender a fase na criação (ajuste em cascata). */
  canExtendPhase: boolean;
  /** Ausente quando o acesso não designa o gestor validador; nulo quando os participantes não foram consultados. */
  reviewers?: EapPerson[] | null;
  /** Participantes que podem apresentar o marco; mesma regra de ausência de `reviewers`. */
  presenters?: EapPerson[] | null;
  names: Map<string, string> | null;
  phaseId: string;
  onClose: () => void;
  onMilestone: (milestone: ProjectMilestoneView) => void;
}) {
  const [selectedPhase, setSelectedPhase] = useState(phaseId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ListEapMilestones200DataItemType>("ENTREGA");
  const [dueDate, setDueDate] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [presenterId, setPresenterId] = useState("");
  const [saving, setSaving] = useState(false);
  const { errors, validate, clear } = useFieldErrors<"title" | "description" | "phase" | "dueDate" | "presenter" | "reviewer">();
  const phase = phases.find((item) => item.id === selectedPhase);
  const phaseCurrent = phase ? { start: civilDateInput(phase.schedule.plannedStartAt), end: civilDateInput(phase.schedule.plannedEndAt) } : null;
  const coverage = phaseCurrent && dueDate ? phaseCoverage(phaseCurrent, spanOf([{ start: "", end: dueDate }, ...(phase ? phaseItemRanges(phase) : [])])) : null;
  // Criar o item fora do período da fase é o caso normal: quem pode reprogramar estende a fase junto, sem pergunta.
  // O ajuste não é silencioso: a API o registra no histórico da fase com a justificativa automática abaixo.
  const extending = coverage !== null && canExtendPhase;

  async function save() {
    const valid = validate([
      ["title", !title.trim() && "Informe o nome do marco."],
      ["description", !description.trim() && "Informe a descrição do marco."],
      ["phase", !selectedPhase && "Escolha o item superior (fase) do marco."],
      ["dueDate", !dueDate && (type === "HOMOLOGACAO" ? "Informe a data prevista da homologação." : "Informe a data prevista do marco.")],
      ["presenter", !presenterId && "Designe quem vai apresentar o marco ao gestor."],
      ["reviewer", !reviewerId && "Designe o gestor que vai validar o marco."],
      ["reviewer", presenterId !== "" && presenterId === reviewerId && "Quem apresenta o marco não pode ser o gestor que vai validá-lo."],
    ]);
    if (!valid) {
      return;
    }
    setSaving(true);
    try {
      const response = await createEapMilestone(projectId, selectedPhase, {
        title: title.trim(),
        type,
        plannedAt: civilToIso(dueDate),
        description: description.trim(),
        reviewerId,
        presenterId,
        ...(extending ? { extendPhase: true, justification: `Período da fase ajustado automaticamente na criação do marco "${title.trim()}".` } : {}),
      });
      if (response.status !== 201) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível criar o marco.");
      }
      onMilestone(presentMilestone(response.data, names));
      onClose();
    } catch (caught) {
      reportFailure(caught, "Não foi possível criar o marco.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormBody saving={saving} onClose={onClose} onSubmit={() => void save()}>
      <ItemContext kind="milestone" />
      <PanelSection title="Informações básicas" subtitle="Identificação e organização do item">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextControl label="Nome do item *" value={title} placeholder="Informe o nome do marco" onChange={(value) => { setTitle(value); clear("title"); }} error={errors.title} full />
          <AreaControl label="Descrição *" value={description} placeholder="Descreva o objetivo e o resultado esperado." onChange={(value) => { setDescription(value); clear("description"); }} error={errors.description} full />
          <SelectControl
            label="Item superior *"
            value={selectedPhase}
            onChange={(value) => { setSelectedPhase(value); clear("phase"); }}
            error={errors.phase}
            placeholder="Selecione a fase..."
            options={phases.map((phase, index) => ({ value: phase.id, label: `${index + 1} · ${phase.name}` }))}
          />
          {presenters ? (
            <SelectControl
              label="Apresentador do marco *"
              value={presenterId}
              onChange={(value) => { setPresenterId(value); clear("presenter"); clear("reviewer"); }}
              error={errors.presenter}
              placeholder="Quem apresenta ao gestor..."
              options={presenters.map((person) => ({ value: person.userId, label: person.name }))}
            />
          ) : (
            <LockedControl
              label="Apresentador do marco *"
              value={presenters === null ? "Não foi possível consultar os participantes." : "A designação cabe à gestão do projeto."}
            />
          )}
          <CivilDateField label={type === "HOMOLOGACAO" ? "Data prevista da homologação *" : "Data prevista *"} value={dueDate} onChange={(value) => { setDueDate(value); clear("dueDate"); }} error={errors.dueDate} />
          <SelectControl
            label="Tipo do marco"
            value={type}
            onChange={setType}
            options={MILESTONE_TYPE_OPTIONS.map(([value, label]) => ({ value, label }))}
          />
        </div>
      </PanelSection>
      <PanelSection title="Fluxo de entrega e aceite" subtitle="Pendente, entregue e aceito pelo gestor" tone="accent">
        <div className="mb-4">
          <MilestoneFlow status="PENDENTE" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <LockedControl label="Situação da entrega" value="Pendente" />
          <LockedControl label="Entrega registrada por" value="Apresentador designado ou gestão do projeto" />
          <AreaControl label="Observações da entrega" hint="não gravado" value="" placeholder="As observações formais entram na entrega, depois que o marco existe." onChange={() => undefined} disabled rows={3} full />
        </div>
        <div className="mt-5 border-t border-border/60 pt-5">
          <span className="mb-3 block text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">Aprovação formal</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {reviewers ? (
              <SelectControl
                label="Gestor validador *"
                value={reviewerId}
                onChange={(value) => { setReviewerId(value); clear("reviewer"); }}
                error={errors.reviewer}
                placeholder="Quem valida o marco..."
                options={reviewers.map((person) => ({ value: person.userId, label: person.name }))}
              />
            ) : (
              <LockedControl
                label="Gestor validador *"
                value={reviewers === null ? "Não foi possível consultar os participantes." : "Nenhum participante pode validar: inclua um gestor no projeto."}
              />
            )}
            <LockedControl label="Critérios de aceite" hint="não gravado" value="Evidências validadas e sem pendências críticas" as="text" />
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-[7px] bg-status-attention-soft p-3.5 text-xs leading-[1.5] text-status-attention-ink">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>O responsável pela entrega pode registrar evidências e enviar para validação, mas o aceite deve ser realizado por outro responsável autorizado.</span>
        </div>
        <div className="mt-4 flex items-center justify-end gap-3">
          <small className="mr-auto text-xs text-muted-foreground">Adicione ao menos uma evidência antes de enviar.</small>
          <Button type="button" variant="outline" className="h-10 gap-1.5 px-4" disabled>
            Enviar para validação
          </Button>
        </div>
      </PanelSection>
      <EvidenceSection />
      <HistorySection />
    </FormBody>
  );
}

function FormBody({
  children,
  saving,
  onClose,
  onSubmit,
}: {
  children: ReactNode;
  saving: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/50 px-6 pb-6">{children}</div>
      <footer className="grid shrink-0 grid-cols-2 gap-[7px] border-t border-border bg-card px-6 py-3 sm:flex sm:min-h-[80px] sm:items-center sm:justify-end">
        <Button type="button" variant="outline" className="h-10 border-input px-4 text-foreground" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" className="h-10 gap-1.5 px-4" loading={saving} onClick={onSubmit}>
          <Check className="size-[15px]" aria-hidden="true" />
          {saving ? "Salvando…" : "Criar item"}
        </Button>
      </footer>
    </>
  );
}

function ItemContext({ kind }: { kind: "phase" | "task" | "milestone" }) {
  return (
    <EapContextStrip
      kind={kind}
      code="Código gerado ao salvar"
      badge={
        <span className="inline-flex items-center gap-[5px] rounded-full bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
          <span className="size-[5px] rounded-full bg-current" />
          A iniciar
        </span>
      }
    />
  );
}

const PanelSection = EapSection;

function EvidenceSection({ warning }: { warning?: string }) {
  return (
    <PanelSection
      title="Evidências vinculadas"
      subtitle="Documentos e registros associados ao item"
      aside={
        <Button type="button" variant="secondary" disabled title="Disponível depois que o item for criado.">
          <Plus className="size-3.5" aria-hidden="true" />
          Adicionar
        </Button>
      }
    >
      {warning ? (
        <div className="mb-3 flex items-start gap-2 text-xs text-status-attention-ink">
          <AlertTriangle className="size-[15px] shrink-0" aria-hidden="true" />
          <span>{warning}</span>
        </div>
      ) : null}
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        As evidências são vinculadas depois que o item é criado. Ao clicar em Criar item, a edição abre em seguida para você adicionar os documentos.
      </p>
      <div className="flex min-h-[48px] items-center rounded-[7px] border border-dashed border-input bg-muted/50 px-3 text-xs text-muted-foreground">
        Nenhuma evidência vinculada.
      </div>
    </PanelSection>
  );
}

function FoldBlock({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof CalendarIcon;
  children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  return (
    <section className="mt-3 shrink-0 rounded-[10px] border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <button
        type="button"
        className="flex min-h-14 w-full items-center justify-between px-5 text-[13px] font-semibold text-foreground"
        onClick={() => setShown((current) => !current)}
      >
        <span className="flex items-center gap-2">
          <Icon className="size-4" aria-hidden="true" />
          {title}
        </span>
        <ChevronRight className={`size-[15px] text-muted-foreground transition-transform duration-300 ease-out motion-reduce:transition-none ${shown ? "rotate-90" : ""}`} aria-hidden="true" />
      </button>
      <Reveal open={shown} bleed={false}>
        <div className="border-t border-border/60 px-5 py-5">{children}</div>
      </Reveal>
    </section>
  );
}

function HistorySection() {
  return (
    <FoldBlock title="Histórico de alterações" icon={Clock}>
      <p className="text-xs leading-relaxed text-muted-foreground">O histórico começa quando o item é criado. Depois disso, cada alteração fica registrada com autor e data.</p>
    </FoldBlock>
  );
}

const fieldClass = cn(
  "h-10 w-full rounded-[7px] border border-input bg-card px-3 text-xs text-foreground shadow-none outline-none disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground",
  controlTransitionClassName,
  controlFocusClassName,
);

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="flex items-baseline justify-between text-xs font-semibold text-foreground/80">
      {label}
      {hint ? <small className="text-xs font-normal text-muted-foreground">{hint}</small> : null}
    </span>
  );
}

function TextControl({
  label,
  hint,
  value,
  placeholder,
  onChange,
  full = false,
  error,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  full?: boolean;
  error?: string | null;
}) {
  const errorId = useId();
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <FieldLabel label={label} hint={hint} />
      <input
        className={fieldClass}
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError id={errorId} message={error} />
    </label>
  );
}

function AreaControl({
  label,
  hint,
  value,
  placeholder,
  onChange,
  disabled = false,
  rows = 3,
  full = false,
  error,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  full?: boolean;
  error?: string | null;
}) {
  const errorId = useId();
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <FieldLabel label={label} hint={hint} />
      <textarea
        className={`${fieldClass} h-auto min-h-[72px] py-2.5 leading-normal`}
        rows={rows}
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

/** Seleção com o Combobox do shadcn/ui. `""` representa "nada selecionado" e mostra o placeholder. */
function SelectControl<T extends string>({
  label,
  hint,
  value,
  onChange,
  options,
  placeholder = "Selecione...",
  error,
}: {
  label: string;
  hint?: string;
  value: T | "";
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T | ""; label: string }>;
  placeholder?: string;
  error?: string | null;
}) {
  const errorId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel label={label} hint={hint} />
      <OptionCombobox
        label={label}
        value={value}
        onChange={(next) => onChange(next as T)}
        options={options}
        placeholder={placeholder}
        invalid={Boolean(error)}
        describedBy={errorId}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

/** Seleção múltipla com checkboxes (até `max` pessoas), com o mesmo rótulo e erro dos demais campos. */
function MultiSelectControl({
  label,
  hint,
  values,
  onChange,
  options,
  max,
  placeholder,
  error,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  max: number;
  placeholder?: string;
  error?: string | null;
}) {
  const errorId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel label={label} hint={hint} />
      <OptionMultiCombobox label={label} values={values} onChange={onChange} options={options} max={max} placeholder={placeholder} invalid={Boolean(error)} describedBy={errorId} />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function LockedControl({
  label,
  hint,
  value,
  as = "select",
}: {
  label: string;
  hint?: string;
  value: string;
  as?: "select" | "text";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel label={label} hint={hint} />
      {as === "text" ? (
        <input className={fieldClass} aria-label={label} disabled readOnly value={value} />
      ) : (
        <OptionCombobox label={label} value={value} onChange={() => undefined} options={[{ value, label: value }]} disabled />
      )}
    </div>
  );
}

function CivilDateField({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const errorId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel label={label} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={`${fieldClass} justify-start px-3 font-normal shadow-none hover:bg-card ${value ? "text-foreground" : "text-muted-foreground"}`}
            />
          }
        >
          <CalendarIcon className="size-3.5" aria-hidden="true" />
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
      <FieldError id={errorId} message={error} />
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

function clampPercent(value: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

function civilToIso(value: string) {
  const [year, month, day] = value.split("-");
  return `${year}-${month}-${day}T15:00:00.000Z`;
}
