"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, CalendarIcon, Check, ChevronRight, Clock, Flag, Folder, List, Plus, X } from "lucide-react";
import { ptBR } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { controlFocusClassName, controlTransitionClassName } from "@/components/ui/control-motion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/fetcher";
import { createEapMilestone, createEapPhase, createEapTask, updateEapTaskProgress } from "@/lib/api/generated/eap/eap";
import type { CreateEapPhaseBodyStatus } from "@/lib/api/generated/model/createEapPhaseBodyStatus";
import type { CreateEapTaskBodyStatus } from "@/lib/api/generated/model/createEapTaskBodyStatus";

import type { EapAccess } from "./eap-access";
import { presentMilestone, presentPhase, presentTask, type ProjectMilestoneView, type ProjectPhaseView, type ProjectTaskView } from "./eap-present";
import type { EapPerson } from "./eap-panel";
import { PHASE_STATUSES, TASK_STATUSES, phaseStatusLabel, taskStatusLabel } from "./project-records";

export type EapCreateRequest =
  | { kind: "phase" }
  | { kind: "task"; phaseId: string }
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
  const title = request.kind === "phase" ? "Nova fase" : request.kind === "task" ? "Nova tarefa" : "Novo marco";
  const guidance = "Preencha os campos obrigatórios";

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        showCloseButton={false}
        overlayClassName="bg-[rgba(13,25,42,0.2)] supports-backdrop-filter:backdrop-blur-[1px]"
        className="w-full gap-0 overflow-hidden bg-white p-0 shadow-[0_18px_48px_rgba(16,24,40,0.16)] data-[side=right]:w-full data-[side=right]:sm:max-w-[620px]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex min-h-[116px] items-start justify-between gap-[15px] border-b border-[#e4e7ec] px-[22px] pt-6 pb-[18px]">
            <div className="min-w-0">
              <span className="mb-[9px] block text-[9px] leading-none font-bold tracking-[0.12em] text-[#3871bf] uppercase">Novo item da EAP</span>
              <SheetTitle className="max-w-[470px] truncate text-[17px] leading-[1.35] font-semibold text-[#172033]">{title}</SheetTitle>
              <span className="mt-[7px] flex items-center gap-1.5 text-[8.5px] font-semibold text-[#8a6116]">
                <span className="size-1.5 rounded-full bg-[#e0a130]" />
                {guidance}
              </span>
            </div>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Fechar painel" onClick={onClose}>
              <X />
            </Button>
          </header>
          {access.canCreateItems ? (
            request.kind === "phase" ? (
              <PhaseForm projectId={projectId} projectName={projectName} phases={phases} onClose={onClose} onPhase={onPhase} />
            ) : request.kind === "task" ? (
              <TaskForm projectId={projectId} phases={phases} people={people} names={names} phaseId={request.phaseId} onClose={onClose} onTask={onTask} />
            ) : (
              <MilestoneForm projectId={projectId} phases={phases} names={names} phaseId={request.phaseId} onClose={onClose} onMilestone={onMilestone} />
            )
          ) : (
            <p className="px-5 py-5 text-sm text-[#667085]">Seu acesso não permite cadastrar itens da EAP.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PhaseForm({
  projectId,
  projectName,
  onClose,
  onPhase,
}: {
  projectId: string;
  projectName: string;
  phases: ProjectPhaseView[];
  onClose: () => void;
  onPhase: (phase: ProjectPhaseView) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CreateEapPhaseBodyStatus>("NAO_INICIADA");
  const startDate = usePlannedDate();
  const endDate = usePlannedDate();
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (!name.trim()) {
      setError("Informe o nome da fase.");
      return;
    }
    if (startDate.value && endDate.value && endDate.value < startDate.value) {
      setError("A data de término planejada não pode ser anterior à data de início.");
      return;
    }
    if ((startDate.changed || endDate.changed) && justification.trim().length < 10) {
      setError("Alterar o prazo exige justificativa com ao menos 10 caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await createEapPhase(projectId, {
        name: name.trim(),
        status,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(startDate.value ? { plannedStartAt: civilToIso(startDate.value) } : {}),
        ...(endDate.value ? { plannedEndAt: civilToIso(endDate.value) } : {}),
      });
      if (response.status !== 201) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível criar a fase.");
      }
      onPhase(presentPhase(response.data, { tasks: [], milestones: [] }));
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não foi possível criar a fase.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormBody saving={saving} error={error} onClose={onClose} onSubmit={() => void save()}>
      <ItemContext kind="phase" />
      <PanelSection title="Informações básicas" subtitle="Identificação e organização do item">
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
          <TextControl label="Nome do item" value={name} placeholder="Informe o nome da fase" onChange={setName} full />
          <AreaControl label="Descrição" value={description} placeholder="Descreva o objetivo e o resultado esperado." onChange={setDescription} full />
          <SelectControl label="Situação" value={status} onChange={setStatus}>
            {PHASE_STATUSES.map((value) => (
              <option key={value} value={value}>{phaseStatusLabel(value)}</option>
            ))}
          </SelectControl>
          <LockedControl label="Item superior" value={projectName} />
          <LockedControl label="Responsável" hint="não gravado" value="A fase não possui responsável" />
          <CivilDateField label="Prazo vigente" value={endDate.value} onChange={endDate.change} />
        </div>
      </PanelSection>
      <PanelSection
        title="Configuração da fase"
        subtitle="O andamento é calculado pelos itens subordinados"
        aside={<span className="inline-flex items-center gap-[5px] rounded-full bg-[#edf4ff] px-2 py-[5px] text-[8.5px] font-semibold text-[#2864bb]"><List className="size-3" aria-hidden="true" />Calculado</span>}
        tone="accent"
      >
        <div className="mb-3.5 rounded-[7px] bg-[#f8fafc] px-[11px] py-[11px]">
          <div className="mb-2 flex items-center justify-between text-[8.5px] text-[#667085]">
            <span>Andamento consolidado</span>
            <strong className="text-[12px] text-[#175cd3]">0%</strong>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[#e9eef5]">
            <div className="h-full w-0 rounded-full bg-[#2873cf]" />
          </div>
          <p className="mt-[9px] text-[8.5px] leading-normal text-[#8a94a6]">Calculado a partir das tarefas concluídas e marcos formalmente aceitos.</p>
        </div>
        <AreaControl label="Critério de conclusão" hint="não gravado" value="" placeholder="A conclusão segue a situação da fase e os itens subordinados." onChange={() => undefined} disabled rows={2} full />
      </PanelSection>
      <EvidenceSection />
      <PlanningSection
        start={startDate.value}
        end={endDate.value}
        onStart={startDate.change}
        onEnd={endDate.change}
        justification={justification}
        onJustification={setJustification}
        scheduleChanged={startDate.changed || endDate.changed}
      />
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
  onClose,
  onTask,
}: {
  projectId: string;
  phases: ProjectPhaseView[];
  people: EapPerson[] | null;
  names: Map<string, string> | null;
  phaseId: string;
  onClose: () => void;
  onTask: (task: ProjectTaskView) => void;
}) {
  const [selectedPhase, setSelectedPhase] = useState(phaseId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<CreateEapTaskBodyStatus>("NAO_INICIADA");
  const [assigneeId, setAssigneeId] = useState("");
  const startDate = usePlannedDate();
  const endDate = usePlannedDate();
  const [justification, setJustification] = useState("");
  const [progress, setProgress] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const [blocker, setBlocker] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError("Informe o nome da tarefa.");
      return;
    }
    if (!selectedPhase) {
      setError("Escolha a fase da tarefa.");
      return;
    }
    if (startDate.value && endDate.value && endDate.value < startDate.value) {
      setError("A data de término planejada não pode ser anterior à data de início.");
      return;
    }
    if ((startDate.changed || endDate.changed) && justification.trim().length < 10) {
      setError("Alterar o prazo exige justificativa com ao menos 10 caracteres.");
      return;
    }
    const nextStatus = blocked ? "IMPEDIDA" : status;
    if (nextStatus === "CONCLUIDA" && progress !== 100) {
      setError("Uma tarefa concluída precisa estar com 100% de andamento.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await createEapTask(projectId, selectedPhase, {
        title: title.trim(),
        status: nextStatus,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(startDate.value ? { plannedStartAt: civilToIso(startDate.value) } : {}),
        ...(endDate.value ? { plannedEndAt: civilToIso(endDate.value) } : {}),
      });
      if (response.status !== 201) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível criar a tarefa.");
      }
      let created = response.data;
      if (progress > 0 || blocked) {
        const patched = await updateEapTaskProgress(projectId, selectedPhase, created.id, {
          ...(progress > 0 ? { progressPercent: progress } : {}),
          ...(blocked ? { hasImpediment: true, status: "IMPEDIDA" } : {}),
        });
        if (patched.status === 200) {
          created = patched.data;
        }
      }
      onTask(presentTask(created, names));
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não foi possível criar a tarefa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormBody saving={saving} error={error} onClose={onClose} onSubmit={() => void save()}>
      <ItemContext kind="task" />
      <PanelSection title="Informações básicas" subtitle="Identificação e organização do item">
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
          <TextControl label="Nome do item" value={title} placeholder="Informe o nome da tarefa" onChange={setTitle} full />
          <AreaControl label="Descrição" value={description} placeholder="Descreva o objetivo e o resultado esperado." onChange={setDescription} full />
          <SelectControl
            label="Situação"
            value={blocked ? "IMPEDIDA" : status}
            onChange={(value) => {
              setBlocked(value === "IMPEDIDA");
              setStatus(value);
            }}
          >
            {TASK_STATUSES.map((value) => (
              <option key={value} value={value}>{taskStatusLabel(value)}</option>
            ))}
          </SelectControl>
          <SelectControl label="Item superior" value={selectedPhase} onChange={setSelectedPhase}>
            {phases.map((phase, index) => (
              <option key={phase.id} value={phase.id}>{index + 1} · {phase.name}</option>
            ))}
          </SelectControl>
          {people ? (
            <SelectControl label="Responsável" value={assigneeId} onChange={setAssigneeId}>
              <option value="">Selecione...</option>
              {people.map((person) => (
                <option key={person.userId} value={person.userId}>{person.name}</option>
              ))}
            </SelectControl>
          ) : (
            <LockedControl label="Responsável" value="Não foi possível consultar os participantes." />
          )}
          <CivilDateField label="Prazo vigente" value={endDate.value} onChange={endDate.change} />
        </div>
      </PanelSection>
      <PanelSection title="Andamento da tarefa" subtitle="Atualização rápida do progresso registrado" aside={<strong className="text-[12px] text-[#175cd3]">{progress}%</strong>} tone="accent">
        <div className="h-1.5 overflow-hidden rounded-full bg-[#e9eef5]">
          <div className="h-full rounded-full bg-[#2873cf]" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-[11px] mb-3.5 grid grid-cols-6 gap-1.5">
          {[0, 25, 50, 75, 90, 100].map((value) => (
            <button
              key={value}
              type="button"
              className={`h-[29px] min-w-0 rounded-[6px] border text-[8.5px] font-semibold ${progress === value ? "border-[#8eb4e7] bg-[#edf4ff] text-[#175cd3]" : "border-[#dce1e7] bg-white text-[#667085]"}`}
              onClick={() => setProgress(value)}
            >
              {value}%
            </button>
          ))}
        </div>
        <div className="mb-3.5 grid grid-cols-[140px_auto] items-end gap-2">
          <TextControl label="Percentual exato de andamento" value={String(progress)} onChange={(value) => setProgress(clampPercent(value))} />
          <span className="flex h-9 items-center text-[8px] text-[#98a2b3]">% concluído</span>
        </div>
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
          <LockedControl label="Prioridade" hint="não gravado" value="Indisponível neste cadastro" />
          <LockedControl label="Dependência" hint="não gravado" value="Indisponível neste cadastro" />
        </div>
        <button
          type="button"
          className={`mt-3.5 grid w-full grid-cols-[34px_minmax(0,1fr)] items-center gap-[9px] rounded-[7px] border px-2.5 py-2.5 text-left ${blocked ? "border-[#efc3bf] bg-[#fff9f8]" : "border-[#e4e7ec] bg-white"}`}
          onClick={() => setBlocked((current) => !current)}
        >
          <span className={`grid size-8 place-items-center rounded-[6px] ${blocked ? "bg-[#fdeceb] text-[#b42318]" : "bg-[#f2f4f7] text-[#8a94a6]"}`}>
            <AlertTriangle className="size-4" aria-hidden="true" />
          </span>
          <span>
            <strong className="block text-[9.5px] text-[#344054]">Esta tarefa está impedida</strong>
            <small className="mt-[3px] block text-[8px] text-[#98a2b3]">Destaque o item na EAP e informe o motivo.</small>
          </span>
        </button>
        {blocked ? (
          <div className="mt-3">
            <AreaControl label="Descrição do impedimento" hint="não gravado" value={blocker} placeholder="Descreva o impedimento e a ação necessária..." onChange={setBlocker} rows={3} full />
          </div>
        ) : null}
      </PanelSection>
      <EvidenceSection warning={progress === 100 ? "A tarefa ficará concluída em percentual, e a evidência é vinculada depois da criação." : undefined} />
      <PlanningSection
        start={startDate.value}
        end={endDate.value}
        onStart={startDate.change}
        onEnd={endDate.change}
        justification={justification}
        onJustification={setJustification}
        scheduleChanged={startDate.changed || endDate.changed}
      />
      <HistorySection />
    </FormBody>
  );
}

function MilestoneForm({
  projectId,
  phases,
  names,
  phaseId,
  onClose,
  onMilestone,
}: {
  projectId: string;
  phases: ProjectPhaseView[];
  names: Map<string, string> | null;
  phaseId: string;
  onClose: () => void;
  onMilestone: (milestone: ProjectMilestoneView) => void;
}) {
  const [selectedPhase, setSelectedPhase] = useState(phaseId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"ENTREGA" | "APROVACAO">("ENTREGA");
  const dueDate = usePlannedDate();
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError("Informe o nome do marco.");
      return;
    }
    if (!selectedPhase) {
      setError("Escolha a fase do marco.");
      return;
    }
    if (dueDate.changed && justification.trim().length < 10) {
      setError("Alterar o prazo exige justificativa com ao menos 10 caracteres.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await createEapMilestone(projectId, selectedPhase, {
        title: title.trim(),
        type,
        ...(description.trim() ? { description: description.trim() } : {}),
        ...(dueDate.value ? { plannedAt: civilToIso(dueDate.value) } : {}),
      });
      if (response.status !== 201) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível criar o marco.");
      }
      onMilestone(presentMilestone(response.data, names));
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Não foi possível criar o marco.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormBody saving={saving} error={error} onClose={onClose} onSubmit={() => void save()}>
      <ItemContext kind="milestone" />
      <PanelSection title="Informações básicas" subtitle="Identificação e organização do item">
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
          <TextControl label="Nome do item" value={title} placeholder="Informe o nome do marco" onChange={setTitle} full />
          <AreaControl label="Descrição" value={description} placeholder="Descreva o objetivo e o resultado esperado." onChange={setDescription} full />
          <SelectControl label="Item superior" value={selectedPhase} onChange={setSelectedPhase}>
            {phases.map((phase, index) => (
              <option key={phase.id} value={phase.id}>{index + 1} · {phase.name}</option>
            ))}
          </SelectControl>
          <LockedControl label="Responsável" hint="não gravado" value="O marco não possui responsável próprio" />
          <CivilDateField label="Prazo vigente" value={dueDate.value} onChange={dueDate.change} />
          <SelectControl label="Tipo do marco" value={type} onChange={setType}>
            <option value="ENTREGA">Entrega</option>
            <option value="APROVACAO">Aprovação</option>
          </SelectControl>
        </div>
      </PanelSection>
      <PanelSection title="Registro da entrega" subtitle="A entrega e a aprovação formal são etapas independentes" tone="accent">
        <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
          <LockedControl label="Situação da entrega" value="Pendente" />
          <LockedControl label="Responsável pela entrega" hint="não gravado" value="O marco não possui responsável próprio" />
          <AreaControl label="Observações da entrega" hint="não gravado" value="" placeholder="As observações formais entram na entrega, depois que o marco existe." onChange={() => undefined} disabled rows={3} full />
        </div>
        <div className="mt-[15px] border-t border-[#edf0f3] pt-[15px]">
          <span className="mb-2.5 block text-[8.5px] font-semibold tracking-[0.04em] text-[#8a94a6] uppercase">Aprovação formal</span>
          <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
            <LockedControl label="Responsável pelo aceite" hint="não gravado" value="Definido na validação do marco" />
            <LockedControl label="Critérios de aceite" hint="não gravado" value="Evidências validadas e sem pendências críticas" as="text" />
          </div>
        </div>
        <div className="mt-[13px] flex items-start gap-2 rounded-[7px] bg-[#fff8e9] p-2.5 text-[8.5px] leading-[1.5] text-[#8a6116]">
          <AlertTriangle className="mt-0.5 size-[15px] shrink-0" aria-hidden="true" />
          <span>O responsável pela entrega pode registrar evidências e enviar para validação, mas o aceite deve ser realizado por outro responsável autorizado.</span>
        </div>
        <div className="mt-3 flex items-center justify-end gap-[9px]">
          <small className="mr-auto text-[7.5px] text-[#98a2b3]">Adicione ao menos uma evidência antes de enviar.</small>
          <Button type="button" variant="outline" className="h-[30px] gap-1.5 rounded-[7px] px-[9px] text-[8.5px]" disabled>
            Enviar para validação
          </Button>
        </div>
      </PanelSection>
      <EvidenceSection />
      <PlanningSection
        start=""
        end={dueDate.value}
        onStart={() => undefined}
        onEnd={dueDate.change}
        startLocked
        justification={justification}
        onJustification={setJustification}
        scheduleChanged={dueDate.changed}
      />
      <HistorySection />
    </FormBody>
  );
}

function FormBody({
  children,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  children: ReactNode;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f8fafc] px-6 pb-6">{children}</div>
      {error ? <p className="bg-white px-6 pb-2 text-[10px] text-destructive">{error}</p> : null}
      <footer className="grid shrink-0 grid-cols-2 gap-[7px] border-t border-[#e4e7ec] bg-white px-6 py-3 sm:flex sm:min-h-[74px] sm:items-center sm:justify-end">
        <Button type="button" variant="outline" className="h-9 rounded-[7px] border-[#d7dce3] px-[13px] text-[11px] font-semibold text-[#344054]" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" variant="outline" className="h-9 rounded-[7px] border-[#d7dce3] px-[13px] text-[11px] font-semibold text-[#344054]" disabled title="O rascunho ainda não está disponível.">
          Salvar rascunho
        </Button>
        <Button type="button" className="col-span-2 h-9 gap-1.5 rounded-[7px] bg-[#175cd3] px-[13px] text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.12)] hover:bg-[#144ca8] sm:col-span-1" disabled={saving} onClick={onSubmit}>
          <Check className="size-[15px]" aria-hidden="true" />
          {saving ? "Salvando…" : "Criar item"}
        </Button>
      </footer>
    </>
  );
}

function ItemContext({ kind }: { kind: "phase" | "task" | "milestone" }) {
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
        <strong className="block text-[10px] text-[#344054]">Código gerado ao salvar · {label}</strong>
      </span>
      <span className="inline-flex items-center gap-[5px] rounded-full bg-[#f0f2f4] px-[7px] py-1 text-[8.5px] font-semibold text-[#667085]">
        <span className="size-[5px] rounded-full bg-current" />
        A iniciar
      </span>
    </div>
  );
}

function PanelSection({
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

function EvidenceSection({ warning }: { warning?: string }) {
  return (
    <PanelSection
      title="Evidências vinculadas"
      subtitle="Documentos e registros associados ao item"
      aside={
        <Button type="button" variant="outline" className="h-[30px] gap-[5px] rounded-[7px] px-[9px] text-[8.5px]" disabled title="A evidência é vinculada a uma tarefa ou marco já cadastrado.">
          <Plus className="size-3.5" aria-hidden="true" />
          Adicionar
        </Button>
      }
    >
      {warning ? (
        <div className="mb-2.5 flex items-start gap-2 text-[8.5px] text-[#8a6116]">
          <AlertTriangle className="size-[15px] shrink-0" aria-hidden="true" />
          <span>{warning}</span>
        </div>
      ) : null}
      <div className="flex min-h-[39px] items-center rounded-[7px] border border-dashed border-[#d7dce3] bg-[#f8f9fb] px-2.5 text-[8.5px] text-[#98a2b3]">
        Nenhuma evidência vinculada.
      </div>
    </PanelSection>
  );
}

function FoldBlock({
  title,
  icon: Icon,
  forceOpen = false,
  children,
}: {
  title: string;
  icon: typeof CalendarIcon;
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(forceOpen);
  const shown = open || forceOpen;
  return (
    <section className="mt-3 shrink-0 rounded-[9px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between px-[15px] text-[9.5px] font-semibold text-[#344054]"
        onClick={() => { if (!forceOpen) setOpen((current) => !current); }}
      >
        <span className="flex items-center gap-2">
          <Icon className="size-4" aria-hidden="true" />
          {title}
        </span>
        <ChevronRight className={`size-[15px] text-[#98a2b3] transition-transform ${shown ? "rotate-90" : ""}`} aria-hidden="true" />
      </button>
      {shown ? <div className="border-t border-[#edf0f3] px-[15px] pt-[15px] pb-[15px]">{children}</div> : null}
    </section>
  );
}

function PlanningSection({
  start,
  end,
  onStart,
  onEnd,
  justification,
  onJustification,
  scheduleChanged,
  startLocked = false,
}: {
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
  justification: string;
  onJustification: (value: string) => void;
  scheduleChanged: boolean;
  startLocked?: boolean;
}) {
  return (
    <FoldBlock title="Planejamento e datas" icon={CalendarIcon} forceOpen={scheduleChanged}>
      <div className="grid grid-cols-1 gap-[13px] sm:grid-cols-2">
        {startLocked ? (
          <LockedControl label="Início planejado" value="O marco usa o prazo vigente" />
        ) : (
          <CivilDateField label="Início planejado" value={start} onChange={onStart} />
        )}
        <CivilDateField label="Prazo planejado" value={end} onChange={onEnd} />
        <AreaControl
          label="Justificativa de replanejamento"
          hint={scheduleChanged ? "obrigatória" : undefined}
          value={justification}
          placeholder="Obrigatória quando o prazo for alterado."
          onChange={onJustification}
          rows={2}
          full
        />
      </div>
      {scheduleChanged && justification.trim().length < 10 ? (
        <p className="mt-2 text-[8.5px] text-[#8a6116]">A alteração do prazo exige justificativa com ao menos 10 caracteres.</p>
      ) : null}
    </FoldBlock>
  );
}

function HistorySection() {
  return (
    <FoldBlock title="Histórico de alterações" icon={Clock}>
      <p className="text-[10px] leading-relaxed text-[#667085]">O histórico passa a ser registrado depois que o item é criado. A consulta do histórico ainda não está disponível.</p>
    </FoldBlock>
  );
}

const fieldClass = cn(
  "h-9 w-full rounded-[7px] border border-[#d7dce3] bg-white px-2.5 text-[10px] text-[#344054] shadow-none outline-none disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#98a2b3]",
  controlTransitionClassName,
  controlFocusClassName,
);

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <span className="flex items-baseline justify-between text-[8.5px] font-semibold text-[#475467]">
      {label}
      {hint ? <small className="text-[7.5px] font-normal text-[#98a2b3]">{hint}</small> : null}
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
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  full?: boolean;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <FieldLabel label={label} hint={hint} />
      <input className={fieldClass} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
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
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  full?: boolean;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <FieldLabel label={label} hint={hint} />
      <textarea className={`${fieldClass} h-auto min-h-[66px] py-[9px] leading-normal`} rows={rows} value={value} placeholder={placeholder} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectControl<T extends string>({
  label,
  hint,
  value,
  onChange,
  children,
}: {
  label: string;
  hint?: string;
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel label={label} hint={hint} />
      <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {children}
      </select>
    </label>
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
    <label className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel label={label} hint={hint} />
      {as === "text" ? (
        <input className={fieldClass} disabled readOnly value={value} />
      ) : (
        <select className={fieldClass} disabled value={value}>
          <option>{value}</option>
        </select>
      )}
    </label>
  );
}

function CivilDateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <FieldLabel label={label} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" className={`${fieldClass} justify-start px-2.5 font-normal shadow-none hover:bg-white ${value ? "text-[#344054]" : "text-[#98a2b3]"}`} />
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
    </div>
  );
}

function usePlannedDate() {
  const [value, setValue] = useState("");
  const [baseline, setBaseline] = useState("");

  function change(next: string) {
    setValue(next);
    setBaseline((current) => (current === "" && next !== "" ? next : current));
  }

  return { value, change, changed: baseline !== "" && value !== baseline };
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
