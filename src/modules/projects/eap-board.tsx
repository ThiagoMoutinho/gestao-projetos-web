import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Flag,
  Folder,
  GripVertical,
  List,
  ListFilter,
  ListPlus,
  MoreHorizontal,
  PanelRightOpen,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

import type { ProjectMilestoneView, ProjectPhaseView, ProjectTaskView } from "./eap-present";
import {
  basisToPercent,
  finishedLate,
  formatBasis,
  milestoneDelayReason,
  milestoneIsOverdue,
  milestonePercent,
  phaseIsOverdue,
  phaseProgress,
  progressLabel,
  projectProgress,
  taskIsOverdue,
  inicioText,
  vigenteText,
} from "./eap-progress";
import { EapStatusBadge, milestoneStatusKind, phaseStatusKind, taskStatusKind } from "./eap-status-badge";
import { impedimentTone, overdueTone } from "./eap-tones";
import { phaseStatusLabel, taskStatusLabel } from "./project-records";

const columns =
  "grid grid-cols-1 gap-2 md:min-h-[46px] md:grid-cols-[minmax(280px,2.1fr)_minmax(108px,0.85fr)_minmax(110px,0.9fr)_minmax(130px,1fr)_minmax(96px,0.75fr)_minmax(105px,0.8fr)_40px] md:items-center md:gap-x-3.5";

const childRow = "py-1 md:min-h-[44px]";
const rowMenuItem = "h-[30px] gap-2 rounded-[5px] px-[9px] text-[10px] text-[#344054] [&_svg:not([class*='size-'])]:size-3.5";
const treeGuide =
  "relative mr-[7px] -my-1 hidden h-[44px] w-[25px] shrink-0 md:block before:absolute before:top-[-4px] before:bottom-[21px] before:left-[11px] before:w-px before:bg-[#dbe1e8] after:absolute after:top-[22px] after:left-[11px] after:h-px after:w-3 after:bg-[#dbe1e8]";

export type EapListFilter = {
  statuses: string[];
  impediment: boolean;
  overdue: boolean;
};

export const idleEapFilter: EapListFilter = { statuses: [], impediment: false, overdue: false };

const STATUS_FILTERS = [
  { value: "NAO_INICIADA", label: "Não iniciada" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "CONCLUIDA", label: "Concluída" },
  { value: "SUSPENSA", label: "Suspensa" },
  { value: "CANCELADA", label: "Cancelada" },
  { value: "PENDENTE", label: "Pendente" },
  { value: "ENTREGUE", label: "Entregue" },
  { value: "AJUSTES_SOLICITADOS", label: "Correções necessárias" },
  { value: "APROVADO", label: "Aceito" },
  { value: "REJEITADO", label: "Rejeitado" },
];

export type RowActions = {
  onEdit?: () => void;
  canAddChild?: boolean;
  onAddTask?: () => void;
  onAddMilestone?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  moveUpDisabled?: boolean;
  moveDownDisabled?: boolean;
  moveTitle?: string;
  onDelete?: () => void;
  deleteBlockedReason?: string;
};

export function EapWorkbench({
  phases,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  headingAction,
  empty,
  children,
}: {
  phases: ProjectPhaseView[];
  query: string;
  onQueryChange: (value: string) => void;
  filter: EapListFilter;
  onFilterChange: (filter: EapListFilter) => void;
  headingAction?: ReactNode;
  empty: boolean;
  children: ReactNode;
}) {
  const tasks = count(phases, (phase) => phase.tasks);
  const milestones = count(phases, (phase) => phase.milestones);
  const progress = projectProgress(phases);
  const signals = countSignals(phases);
  const concluded = phases.filter((phase) => phase.calculatedStatus === "CONCLUIDA").length;
  const active = phases.filter((phase) => phase.calculatedStatus === "EM_ANDAMENTO").length;
  const itemCount = tasks.known && milestones.known ? tasks.value + milestones.value : null;
  const filterCount = filter.statuses.length + Number(filter.impediment) + Number(filter.overdue);
  const untouched = phases.length === 0 && query.trim() === "" && filterCount === 0;

  return (
    <div className="@container flex flex-col gap-[18px]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="mb-[9px] block text-[9px] leading-none font-bold tracking-[0.12em] text-[#3871bf] uppercase">Estrutura do projeto</span>
          <h1 className="text-2xl leading-[1.25] font-semibold tracking-[-0.025em] text-[#172033]">Estrutura Analítica do Projeto</h1>
          <p className="mt-1.5 text-[11.5px] text-[#667085]">Organize e acompanhe todas as entregas, tarefas e marcos do projeto.</p>
        </div>
        {headingAction}
      </div>

      <div className="grid grid-cols-1 gap-3 @min-[640px]:grid-cols-2 @min-[980px]:grid-cols-[0.92fr_1.05fr_1.25fr_1.1fr]">
        <Stat
          icon={<Folder className="size-4" aria-hidden="true" />}
          tone="blue"
          label="Fases do projeto"
          value={String(phases.length).padStart(2, "0")}
          note={`${concluded} concluída${concluded === 1 ? "" : "s"} · ${active} em andamento`}
        />
        <Stat
          icon={<List className="size-4" aria-hidden="true" />}
          tone="violet"
          label="Tarefas e marcos"
          value={itemCount === null ? "—" : String(itemCount).padStart(2, "0")}
          note={
            itemCount === null
              ? "Consulta incompleta"
              : `${tasks.value} ${tasks.value === 1 ? "tarefa" : "tarefas"} · ${milestones.value} ${milestones.value === 1 ? "marco" : "marcos"}`
          }
        />
        <article className="relative h-[84px] rounded-[10px] border border-[#e4e7ec] bg-white px-[17px] py-[15px] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[9.5px] text-[#667085]">Progresso calculado</span>
            <strong className="text-[16px] leading-none text-[#285da8]">
              {progress.kind === "value" ? `${formatBasis(progress.basisPoints)}%` : "—"}
            </strong>
          </div>
          {progress.kind === "value" ? (
            <Progress
              value={basisToPercent(progress.basisPoints)}
              aria-label="Progresso calculado do projeto"
              className="mt-[13px] [&_[data-slot=progress-indicator]]:bg-[#2873cf] [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-[#e9eef5]"
            />
          ) : (
            <p className="mt-[13px] text-[11px] font-medium text-[#667085]">Cálculo indisponível</p>
          )}
          <small className="absolute right-[15px] bottom-[17px] text-[8.5px] text-[#98a2b3]">
            {progress.kind === "unavailable" || progress.coverageBasis === null
              ? "Fases com andamento calculado: —"
              : `Fases com andamento calculado: ${formatBasis(progress.coverageBasis)}%`}
          </small>
        </article>
        <Stat
          icon={<Clock className="size-4" aria-hidden="true" />}
          tone="amber"
          label="Prazos e pendências"
          value={signals.known ? `${String(signals.critical).padStart(2, "0")} críticas` : "—"}
          note={
            signals.known
              ? [
                  `${signals.blocked} impedimento${signals.blocked === 1 ? "" : "s"}`,
                  `${signals.overdue} atrasado${signals.overdue === 1 ? "" : "s"}`,
                  ...(signals.rejected > 0 ? [`${signals.rejected} rejeitado${signals.rejected === 1 ? "" : "s"}`] : []),
                ].join(" · ")
              : "Consulta incompleta"
          }
          compact
        />
      </div>

      <section className="overflow-x-auto rounded-[10px] border border-[#e4e7ec] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex min-h-[73px] flex-col justify-center gap-3 border-b border-[#e4e7ec] px-[17px] py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
          <div>
            <h3 className="text-[13px] leading-[1.4] font-semibold text-[#172033]">Entregas do projeto</h3>
            <p className="mt-[3px] text-[9.5px] text-[#98a2b3]">
              {itemCount === null
                ? "A consulta de alguns itens ainda não está disponível."
                : `${itemCount} ${itemCount === 1 ? "item organizado" : "itens organizados"} em ${phases.length} ${phases.length === 1 ? "fase" : "fases"}`}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex h-[34px] w-full items-center gap-[7px] rounded-[7px] border border-[#d7dce3] bg-white px-2.5 text-[#98a2b3] focus-within:border-[#8ab4eb] focus-within:shadow-[0_0_0_3px_#edf4ff] sm:w-[210px]">
              <Search className="size-4 shrink-0" aria-hidden="true" />
              <Input
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Buscar na EAP..."
                aria-label="Buscar na EAP"
                className="h-7 border-0 bg-transparent px-0 text-[10px] text-[#172033] shadow-none focus-visible:ring-0"
              />
            </label>
            <FilterMenu filter={filter} count={filterCount} onChange={onFilterChange} />
            <Button type="button" variant="outline" size="icon" className="size-[34px] rounded-[7px] border-[#d7dce3] text-[#667085] hover:bg-[#f2f4f7] hover:text-[#344054]" aria-label="Mais opções">
              <MoreHorizontal />
            </Button>
          </div>
        </div>
        <div className={cn(columns, "hidden h-[37px] min-h-0 border-b border-[#e4e7ec] bg-[#f8f9fb] px-[17px] text-[8px] font-bold tracking-[0.08em] text-[#8a94a6] uppercase md:grid")}>
          <span>Item da EAP</span>
          <span>Situação</span>
          <span>Andamento</span>
          <span>Responsável</span>
          <span>Início planejado</span>
          <span>Término planejado</span>
          <span className="sr-only">Ações</span>
        </div>
        {empty ? (
          <div className="flex h-44 flex-col items-center justify-center gap-1 text-[#98a2b3]">
            <Search className="size-5" aria-hidden="true" />
            <strong className="text-sm text-[#475467]">{untouched ? "Nenhuma fase registrada" : "Nenhum item encontrado"}</strong>
            <span className="text-xs">{untouched ? "Cadastre a primeira fase para montar a EAP." : "Tente buscar ou filtrar por outro critério."}</span>
          </div>
        ) : (
          <div>{children}</div>
        )}
      </section>
    </div>
  );
}

export function PhaseRow({
  index,
  phase,
  selected,
  tasks,
  milestones,
  onOpen,
  actions,
  renderTasks,
  renderMilestones,
  reorderable = false,
  dragging = false,
  dragOver = false,
  onDragStartPhase,
  onDragEndPhase,
  onDragOverPhase,
  onDropPhase,
  showDivergence = false,
}: {
  showDivergence?: boolean;
  index: number;
  phase: ProjectPhaseView;
  selected: boolean;
  tasks: ReactNode;
  milestones: ReactNode;
  onOpen: () => void;
  actions?: RowActions;
  renderTasks: boolean;
  renderMilestones: boolean;
  reorderable?: boolean;
  dragging?: boolean;
  dragOver?: boolean;
  onDragStartPhase?: () => void;
  onDragEndPhase?: () => void;
  onDragOverPhase?: () => void;
  onDropPhase?: (sourceId: string) => void;
}) {
  const progress = phaseProgress(phase);
  const childCount = (phase.tasks?.length ?? 0) + (phase.milestones?.length ?? 0);
  const knownChildren = phase.tasks !== null && phase.milestones !== null;
  const overdue = phaseIsOverdue(phase);
  return (
    <Collapsible
      defaultOpen
      className={cn("group/collapsible border-b border-[#edf0f3] last:border-b-0", dragging && "opacity-60", dragOver && "shadow-[inset_0_2px_0_#175cd3]")}
      onDragOver={(event) => {
        if (!reorderable) {
          return;
        }
        event.preventDefault();
        onDragOverPhase?.();
      }}
      onDrop={(event) => {
        if (!reorderable) {
          return;
        }
        event.preventDefault();
        onDropPhase?.(event.dataTransfer.getData("text/plain"));
      }}
    >
      <div
        className={cn(
          columns,
          "group/eap relative bg-[#fbfcfd] px-3 py-1.5 transition-colors duration-200 ease-out hover:bg-[#f8fbff] motion-reduce:transition-none",
          selected && "bg-[#f8fbff]",
        )}
      >
        <StateRail overdue={overdue} />
        {/* {reorderable ? (
            <button
              type="button"
              draggable
              aria-label={`Arrastar ${phase.name}`}
              title="Arraste para mudar a ordem da fase"
              className="pointer-events-none absolute top-1/2 left-[42px] z-20 flex size-7 -translate-y-1/2 cursor-grab items-center justify-center rounded-md text-[#98a2b3] opacity-0 group-hover/eap:pointer-events-auto group-hover/eap:opacity-100 hover:bg-[#eef2f6] hover:text-[#52677e] focus-visible:pointer-events-auto focus-visible:opacity-100 active:cursor-grabbing"
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", phase.id);
                onDragStartPhase?.();
              }}
              onDragEnd={() => onDragEndPhase?.()}
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </button>
        ) : null} */}
        <div className="flex min-w-0 items-center">
          <CollapsibleTrigger
            render={<Button type="button" variant="ghost" size="icon-sm" className="relative z-30 mr-0.5 text-[#667085]" aria-label={`Expandir ${phase.name}`} />}
          >
            <ChevronRight className="transition-transform duration-200 ease-out group-data-open/collapsible:rotate-90 motion-reduce:transition-none" />
          </CollapsibleTrigger>
          <ItemIcon type="phase">
            <Folder className="size-3.5" aria-hidden="true" />
          </ItemIcon>
          <button type="button" className="min-w-0 rounded-md text-left focus-visible:ring-2 focus-visible:ring-[#8ab4eb] focus-visible:outline-none" onClick={onOpen}>
            <span className="block truncate text-[10.5px] font-semibold text-[#253248]">{phase.name}</span>
            <span className="mt-[3px] block text-[8.5px] text-[#98a2b3]">
              {index + 1} · {knownChildren ? `${childCount} ${childCount === 1 ? "entrega" : "entregas"}` : "Consulta incompleta"}
              {showDivergence && phase.statusDiverges ? <DivergenceSignal recorded={phaseStatusLabel(phase.status)} /> : null}
            </span>
          </button>
        </div>
        <StatusCell>
          <EapStatusBadge kind={phaseStatusKind(phase.calculatedStatus)} label={phase.statusLabel} />
        </StatusCell>
        <ProgressCell
          label={progressLabel(progress)}
          value={progress.kind === "value" ? basisToPercent(progress.basisPoints) : null}
          done={phase.calculatedStatus === "CONCLUIDA"}
        />
        <Owner name={phase.responsibleName ?? ""} />
        <PlannedStart value={inicioText(phase.dates)} />
        <Due value={vigenteText(phase.dates)} overdue={overdue} late={finishedLate(phase) ? "Concluída após o prazo" : null} />
        <RowMenu label={phase.name} onOpen={onOpen} actions={actions} />
      </div>
      <CollapsibleContent>
        {renderTasks ? tasks : null}
        {renderMilestones ? milestones : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Atraso prevalece sobre impedimento na faixa lateral; o impedimento continua identificado pelo sinal textual. */
function StateRail({ overdue, blocked = false }: { overdue: boolean; blocked?: boolean }) {
  if (!overdue && !blocked) {
    return null;
  }
  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute top-0 -bottom-px left-0 z-10 w-[3px]", overdue ? overdueTone.rail : impedimentTone.rail)}
    />
  );
}

export function TaskRow({
  index,
  phaseIndex,
  task,
  selected,
  onOpen,
  actions,
  quickEdit,
  reorderable = false,
  dragging = false,
  dragOver = false,
  onDragStartTask,
  onDragEndTask,
  onDragOverTask,
  onDropTask,
  showDivergence = false,
}: {
  showDivergence?: boolean;
  index: number;
  phaseIndex: number;
  task: ProjectTaskView;
  selected: boolean;
  onOpen: () => void;
  actions?: RowActions;
  quickEdit?: ReactNode;
  reorderable?: boolean;
  dragging?: boolean;
  dragOver?: boolean;
  onDragStartTask?: () => void;
  onDragEndTask?: () => void;
  onDragOverTask?: () => void;
  onDropTask?: (sourceId: string) => void;
}) {
  const overdue = taskIsOverdue(task);
  const blocked = task.hasImpediment || task.status === "IMPEDIDA";

  return (
    <div
      className={cn(
        "group/eap relative border-t border-[#edf0f3] px-3",
        selected && "bg-[#f8fbff]",
        dragging && "opacity-60",
        dragOver && "shadow-[inset_0_2px_0_#175cd3]",
      )}
      onDragOver={(event) => {
        if (!reorderable) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onDragOverTask?.();
      }}
      onDrop={(event) => {
        if (!reorderable) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onDropTask?.(event.dataTransfer.getData("text/plain"));
      }}
    >
      <StateRail overdue={overdue} blocked={blocked} />
      {reorderable ? (
        <button
          type="button"
          draggable
          aria-label={`Arrastar ${task.title}`}
          title="Arraste para mudar a ordem da tarefa"
          className="pointer-events-none absolute top-1/2 left-0.5 z-20 flex size-7 -translate-y-1/2 cursor-grab items-center justify-center rounded-md text-[#98a2b3] opacity-0 group-hover/eap:pointer-events-auto group-hover/eap:opacity-100 hover:bg-[#eef2f6] hover:text-[#52677e] focus-visible:pointer-events-auto focus-visible:opacity-100 active:cursor-grabbing"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", `task:${task.id}`);
            onDragStartTask?.();
          }}
          onDragEnd={() => onDragEndTask?.()}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      ) : null}
      <div className={cn(columns, childRow, "transition-colors duration-200 ease-out hover:bg-[#f8fbff] motion-reduce:transition-none")}>
        <button type="button" className="flex min-w-0 items-center text-left focus-visible:ring-2 focus-visible:ring-[#8ab4eb] focus-visible:outline-none" onClick={onOpen}>
          <span className={treeGuide} aria-hidden="true" />
          <ItemIcon type="task">
            <Check className="size-3.5" aria-hidden="true" />
          </ItemIcon>
          <span className="min-w-0">
            <span className="block truncate text-[10.5px] font-medium text-[#253248]">{task.title}</span>
            <span className="mt-[3px] block text-[8.5px] text-[#98a2b3]">
              {phaseIndex + 1}.{index + 1} · Tarefa
              {blocked ? <Signal tone="impediment"><AlertTriangle className="size-2.5" aria-hidden="true" /> Impedido</Signal> : null}
              {showDivergence && task.statusDiverges ? <DivergenceSignal recorded={taskStatusLabel(task.status)} /> : null}
            </span>
          </span>
        </button>
        <StatusCell>
          <EapStatusBadge kind={taskStatusKind(task.calculatedStatus)} label={task.statusLabel} />
        </StatusCell>
        <ProgressCell label={`${task.progressPercent}%`} value={task.progressPercent} done={task.calculatedStatus === "CONCLUIDA"} muted={task.calculatedStatus === "CANCELADA"} />
        <Owner name={task.assigneeName} />
        <PlannedStart value={inicioText(task.dates)} />
        <Due value={vigenteText(task.dates)} overdue={overdue} late={finishedLate(task) ? "Concluída após o prazo" : null} />
        <RowMenu label={task.title} onOpen={onOpen} actions={actions} />
      </div>
      {quickEdit ? <div className="mt-2 md:pl-10">{quickEdit}</div> : null}
    </div>
  );
}

export function MilestoneRow({
  index,
  phaseIndex,
  milestone,
  selected,
  onOpen,
  actions,
  reorderable = false,
  dragging = false,
  dragOver = false,
  onDragStartMilestone,
  onDragEndMilestone,
  onDragOverMilestone,
  onDropMilestone,
}: {
  index: number;
  phaseIndex: number;
  milestone: ProjectMilestoneView;
  selected: boolean;
  onOpen: () => void;
  actions?: RowActions;
  reorderable?: boolean;
  dragging?: boolean;
  dragOver?: boolean;
  onDragStartMilestone?: () => void;
  onDragEndMilestone?: () => void;
  onDragOverMilestone?: () => void;
  onDropMilestone?: (sourceId: string) => void;
}) {
  const overdue = milestoneIsOverdue(milestone);
  const percent = milestonePercent(milestone);

  return (
    <div
      className={cn(
        columns,
        childRow,
        "group/eap relative border-t border-[#edf0f3] px-3 transition-colors duration-200 ease-out hover:bg-[#f8fbff] motion-reduce:transition-none",
        selected && "bg-[#f8fbff]",
        dragging && "opacity-60",
        dragOver && "shadow-[inset_0_2px_0_#175cd3]",
      )}
      onDragOver={(event) => {
        if (!reorderable) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onDragOverMilestone?.();
      }}
      onDrop={(event) => {
        if (!reorderable) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        onDropMilestone?.(event.dataTransfer.getData("text/plain"));
      }}
    >
      <StateRail overdue={overdue} />
      {reorderable ? (
        <button
          type="button"
          draggable
          aria-label={`Arrastar ${milestone.title}`}
          title="Arraste para mudar a ordem do marco"
          className="pointer-events-none absolute top-1/2 left-0.5 z-20 flex size-7 -translate-y-1/2 cursor-grab items-center justify-center rounded-md text-[#98a2b3] opacity-0 group-hover/eap:pointer-events-auto group-hover/eap:opacity-100 hover:bg-[#eef2f6] hover:text-[#52677e] focus-visible:pointer-events-auto focus-visible:opacity-100 active:cursor-grabbing"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", `milestone:${milestone.id}`);
            onDragStartMilestone?.();
          }}
          onDragEnd={() => onDragEndMilestone?.()}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
      ) : null}
      <button type="button" className="flex min-w-0 items-center text-left focus-visible:ring-2 focus-visible:ring-[#8ab4eb] focus-visible:outline-none" onClick={onOpen}>
        <span className={treeGuide} aria-hidden="true" />
        <ItemIcon type="milestone">
          <Flag className="size-3.5" aria-hidden="true" />
        </ItemIcon>
        <span className="min-w-0">
          <span className="block truncate text-[10.5px] font-medium text-[#253248]">{milestone.title}</span>
          <span className="mt-[3px] block text-[8.5px] text-[#98a2b3]">
            {phaseIndex + 1}.{index + 1} · Marco
          </span>
        </span>
      </button>
      <StatusCell>
        <EapStatusBadge kind={milestoneStatusKind(milestone.status)} label={milestone.statusLabel} />
      </StatusCell>
      <ProgressCell
        label={`${percent}%`}
        value={percent}
        done={milestone.status === "APROVADO"}
      />
      <Owner name={milestone.presenterName ?? ""} />
      <PlannedStart value={null} title="Marco tem data única" />
      <Due value={vigenteText(milestone.dates)} overdue={overdue} reason={milestoneDelayReason(milestone)} late={finishedLate(milestone) ? (milestone.type === "HOMOLOGACAO" ? "Homologado após o prazo" : "Aceito após o prazo") : null} />
      <RowMenu label={milestone.title} onOpen={onOpen} actions={actions} />
    </div>
  );
}

export function filterPhases(phases: ProjectPhaseView[], query: string, filter: EapListFilter = idleEapFilter) {
  const term = query.trim().toLocaleLowerCase("pt-BR");
  const filtering = term.length > 0 || filter.statuses.length > 0 || filter.impediment || filter.overdue;
  if (!filtering) {
    return phases.map((phase) => ({ phase, tasks: phase.tasks, milestones: phase.milestones }));
  }

  return phases.flatMap((phase) => {
    const phaseQuery = term.length === 0 || includes(phase.name, term) || includes(phase.description, term);
    const tasks = phase.tasks?.filter((task) => (phaseQuery || includes(task.title, term) || includes(task.assigneeName, term)) && matchesFilter(task, "task", filter)) ?? null;
    const milestones = phase.milestones?.filter((milestone) => (phaseQuery || includes(milestone.title, term)) && matchesFilter(milestone, "milestone", filter)) ?? null;
    const phaseVisible = phaseQuery && matchesFilter(phase, "phase", filter);
    const childrenVisible = (tasks?.length ?? 0) > 0 || (milestones?.length ?? 0) > 0 || phase.tasks === null || phase.milestones === null;
    if (!phaseVisible && !childrenVisible) {
      return [];
    }
    if (!phaseVisible && phase.tasks === null && phase.milestones === null) {
      return [];
    }

    return [{
      phase,
      tasks: phase.tasks === null ? null : tasks,
      milestones: phase.milestones === null ? null : milestones,
    }];
  });
}

function matchesFilter(item: ProjectPhaseView | ProjectTaskView | ProjectMilestoneView, kind: "phase" | "task" | "milestone", filter: EapListFilter) {
  const status = "calculatedStatus" in item ? item.calculatedStatus : item.status;
  if (filter.statuses.length > 0 && !filter.statuses.includes(status)) {
    return false;
  }
  if (filter.impediment && !(kind === "task" && ("hasImpediment" in item) && (item.hasImpediment || item.status === "IMPEDIDA"))) {
    return false;
  }
  if (filter.overdue) {
    const overdue = kind === "phase" ? phaseIsOverdue(item as ProjectPhaseView) : kind === "task" ? taskIsOverdue(item as ProjectTaskView) : milestoneIsOverdue(item as ProjectMilestoneView);
    if (!overdue) {
      return false;
    }
  }
  return true;
}

function Stat({
  icon,
  tone,
  label,
  value,
  note,
  compact = false,
}: {
  icon: ReactNode;
  tone: "blue" | "violet" | "amber";
  label: string;
  value: string;
  note: string;
  compact?: boolean;
}) {
  return (
    <article className="relative flex h-[84px] items-center gap-3 rounded-[10px] border border-[#e4e7ec] bg-white px-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <span
        className={cn(
          "flex size-[37px] shrink-0 items-center justify-center rounded-lg",
          tone === "blue" && "bg-[#eaf2ff] text-[#2864bb]",
          tone === "violet" && "bg-[#f0eafd] text-[#7450bf]",
          tone === "amber" && "bg-[#fff3dc] text-[#b26b15]",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="mb-[5px] block text-[9.5px] text-[#667085]">{label}</span>
        <strong className={cn("block leading-none text-[#172033]", compact ? "text-[15px]" : "text-[19px]")}>{value}</strong>
      </span>
      <small className="absolute right-[15px] bottom-[17px] max-w-[58%] truncate text-right text-[8.5px] text-[#98a2b3]">{note}</small>
    </article>
  );
}

function ProgressCell({ label, value, done, muted }: { label: string; value: number | null; done?: boolean; muted?: boolean }) {
  if (value === null) {
    return <span className="text-xs text-[#667085]">{label}</span>;
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Progress
        value={value}
        aria-label={label}
        className={cn(
          "min-w-16 flex-1 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-[#e9eef5]",
          done && "[&_[data-slot=progress-indicator]]:bg-[#1c8b65]",
          !done && !muted && "[&_[data-slot=progress-indicator]]:bg-[#2873cf]",
          muted && "[&_[data-slot=progress-indicator]]:bg-[#98a2b3]",
        )}
      />
      <span className="w-10 shrink-0 text-xs font-semibold text-[#475467] tabular-nums">{label}</span>
    </div>
  );
}

function StatusCell({ children }: { children: ReactNode }) {
  return <span className="flex min-w-0 items-center">{children}</span>;
}

function Owner({ name }: { name: string }) {
  if (!name || name === "Não informado") {
    return <span className="text-xs text-[#98a2b3]">—</span>;
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-[#475467]">
      <Avatar size="sm">
        <AvatarFallback className="bg-[#e8effb] text-[0.65rem] font-bold text-[#285da8]">{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Atraso em aberto em vermelho; atraso histórico só como nota neutra, sem classificar o item como atrasado. */
function PlannedStart({ value, title }: { value: string | null; title?: string }) {
  return (
    <span className="flex items-start gap-1.5 text-xs whitespace-nowrap text-[#667085]" title={title}>
      <Calendar className="mt-px size-3.5 shrink-0 text-[#98a2b3]" aria-hidden="true" />
      {value ?? "—"}
    </span>
  );
}

function Due({ value, overdue, late = null, reason = null }: { value: string | null; overdue: boolean; late?: string | null; reason?: string | null }) {
  return (
    <span className={cn("flex items-start gap-1.5 text-xs whitespace-nowrap", overdue ? cn("font-semibold", overdueTone.text) : "text-[#667085]")}>
      <Calendar className={cn("mt-px size-3.5 shrink-0", overdue ? overdueTone.text : "text-[#98a2b3]")} aria-hidden="true" />
      <span className="flex flex-col">
        {value ?? "—"}
        {overdue ? <span className="sr-only">Atrasado</span> : null}
        {overdue && reason ? <span className="text-[8px] leading-tight font-normal">{reason}</span> : null}
        {!overdue && late ? <span className="text-[8px] leading-tight text-[#98a2b3]">{late}</span> : null}
      </span>
    </span>
  );
}

function ItemIcon({ type, children }: { type: "phase" | "task" | "milestone"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "mr-2 flex size-7 shrink-0 items-center justify-center rounded-md",
        type === "phase" && "bg-[#e9f2ff] text-[#2865b9]",
        type === "task" && "bg-[#eef2f6] text-[#52677e]",
        type === "milestone" && "bg-[#f4ecfb] text-[#8b5bbb]",
      )}
    >
      {children}
    </span>
  );
}

function Signal({ tone, title, children }: { tone: "impediment" | "notice"; title?: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className={cn(
        "ml-1.5 inline-flex items-center gap-1 border-l border-[#dce1e7] pl-1.5 font-semibold",
        tone === "impediment" ? impedimentTone.text : "text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

const DIVERGENCE_HINT = "A situação gravada não corresponde ao andamento registrado. A correção é feita pela reconciliação autorizada.";

function DivergenceSignal({ recorded }: { recorded: string }) {
  return (
    <Signal tone="notice" title={`${DIVERGENCE_HINT} Situação gravada: ${recorded}.`}>
      Situação divergente do andamento
    </Signal>
  );
}

function RowMenu({ label, onOpen, actions }: { label: string; onOpen: () => void; actions?: RowActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon-sm" className="text-[#667085]" aria-label={`Ações de ${label}`} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[196px] rounded-[8px] p-[5px] shadow-[0_10px_24px_rgba(16,24,40,0.15)]">
        <DropdownMenuGroup>
          <DropdownMenuItem className={rowMenuItem} disabled={!actions?.onEdit} onClick={actions?.onEdit}>
            <Pencil aria-hidden="true" /> Editar item
          </DropdownMenuItem>
          <DropdownMenuItem className={rowMenuItem} disabled title="A duplicação ainda não está disponível. A cópia precisa de um endpoint próprio.">
            <Copy aria-hidden="true" /> Duplicar
          </DropdownMenuItem>
          {actions?.canAddChild ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className={rowMenuItem}>
                <ListPlus aria-hidden="true" /> Adicionar subordinada
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem className={rowMenuItem} onClick={actions.onAddTask}>
                  <Check aria-hidden="true" /> Nova tarefa
                </DropdownMenuItem>
                <DropdownMenuItem className={rowMenuItem} onClick={actions.onAddMilestone}>
                  <Flag aria-hidden="true" /> Novo marco
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : (
            <DropdownMenuItem className={rowMenuItem} disabled title="Este item não recebe subordinados.">
              <ListPlus aria-hidden="true" /> Adicionar subordinada
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className={rowMenuItem} onClick={onOpen}>
            <PanelRightOpen aria-hidden="true" /> Abrir detalhes
          </DropdownMenuItem>
          {actions?.onMoveUp ? (
            <DropdownMenuItem className={rowMenuItem} disabled={actions.moveUpDisabled} title={actions.moveUpDisabled ? actions.moveTitle : undefined} onClick={actions.onMoveUp}>
              <ArrowUp aria-hidden="true" /> Subir fase
            </DropdownMenuItem>
          ) : null}
          {actions?.onMoveDown ? (
            <DropdownMenuItem className={rowMenuItem} disabled={actions.moveDownDisabled} title={actions.moveDownDisabled ? actions.moveTitle : undefined} onClick={actions.onMoveDown}>
              <ArrowDown aria-hidden="true" /> Descer fase
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className={cn(rowMenuItem, "text-[#b42318] focus:text-[#b42318]")}
            variant="destructive"
            disabled={!actions?.onDelete || Boolean(actions.deleteBlockedReason)}
            title={!actions?.onDelete ? "Somente a gestão do projeto pode excluir itens da EAP." : actions.deleteBlockedReason}
            onClick={actions?.onDelete}
          >
            <Trash2 aria-hidden="true" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterMenu({ filter, count, onChange }: { filter: EapListFilter; count: number; onChange: (filter: EapListFilter) => void }) {
  function toggleStatus(value: string) {
    onChange({
      ...filter,
      statuses: filter.statuses.includes(value) ? filter.statuses.filter((item) => item !== value) : [...filter.statuses, value],
    });
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button type="button" variant="outline" className="h-[34px] rounded-[7px] border-[#d7dce3] px-[13px] text-[11px] font-semibold text-[#344054]" />}>
        <ListFilter aria-hidden="true" />
        Filtrar
        {count > 0 ? <span className="rounded-full bg-[#e8f1ff] px-1.5 text-[11px] text-[#205eb2]">{count}</span> : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="px-1 text-xs font-semibold tracking-[0.04em] text-[#8a94a6] uppercase">Situação</p>
        <div className="flex max-h-52 flex-col gap-2 overflow-y-auto">
          {STATUS_FILTERS.map((option) => (
            <label key={option.value} className="flex items-center gap-2 text-sm text-[#344054]">
              <Checkbox checked={filter.statuses.includes(option.value)} onCheckedChange={() => toggleStatus(option.value)} />
              {option.label}
            </label>
          ))}
        </div>
        <p className="px-1 text-xs font-semibold tracking-[0.04em] text-[#8a94a6] uppercase">Sinais</p>
        <label className="flex items-center gap-2 text-sm text-[#344054]">
          <Checkbox checked={filter.impediment} onCheckedChange={(checked) => onChange({ ...filter, impediment: checked === true })} />
          Impedido
        </label>
        <label className="flex items-center gap-2 text-sm text-[#344054]">
          <Checkbox checked={filter.overdue} onCheckedChange={(checked) => onChange({ ...filter, overdue: checked === true })} />
          Atrasado
        </label>
        {count > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(idleEapFilter)}>
            Limpar filtros
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function count(phases: ProjectPhaseView[], read: (phase: ProjectPhaseView) => { length: number } | null) {
  if (phases.some((phase) => read(phase) === null)) {
    return { known: false, value: 0 };
  }

  return { known: true, value: phases.reduce((total, phase) => total + (read(phase)?.length ?? 0), 0) };
}

function countSignals(phases: ProjectPhaseView[]) {
  if (phases.some((phase) => phase.tasks === null || phase.milestones === null)) {
    return { known: false, blocked: 0, overdue: 0, rejected: 0, critical: 0 };
  }

  let blocked = 0;
  let overdue = 0;
  let rejected = 0;
  for (const phase of phases) {
    if (phaseIsOverdue(phase)) {
      overdue += 1;
    }
    for (const task of phase.tasks ?? []) {
      if (task.hasImpediment || task.status === "IMPEDIDA") {
        blocked += 1;
      } else if (taskIsOverdue(task)) {
        overdue += 1;
      }
    }
    for (const milestone of phase.milestones ?? []) {
      if (milestone.status === "REJEITADO") {
        rejected += 1;
      } else if (milestoneIsOverdue(milestone)) {
        overdue += 1;
      }
    }
  }

  return { known: true, blocked, overdue, rejected, critical: blocked + overdue + rejected };
}

function includes(value: string | null | undefined, term: string) {
  return value?.toLocaleLowerCase("pt-BR").includes(term) ?? false;
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter((part) => part !== "·" && part !== "Demo" && part !== "-");
  const source = parts.length > 0 ? parts : name.split(/\s+/);
  return source.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}
