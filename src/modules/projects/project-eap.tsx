"use client";

import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, FileSpreadsheet, Flag, Folder, ListTodo, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { EapWorkbench, MilestoneRow, PhaseRow, TaskRow, filterPhases, idleEapFilter, type EapListFilter, type RowActions } from "./eap-board";
import { EapCreateSheet, type EapCreateRequest } from "./eap-create";
import { EapDeleteDialog, type EapDeleteRequest } from "./eap-delete-dialog";
import { EapImportSheet } from "./eap-import-sheet";
import { readPhases } from "./load-project-detail";
import { EapDetail, eapCode } from "./eap-detail-view";
import { Sheet, SheetContent } from "@/components/ui/sheet";

import { getEapPhase, reorderEapPhases } from "@/lib/api/generated/eap/eap";
import { ApiError, apiFetcher } from "@/lib/api/fetcher";
import { notifySuccess, reportFailure } from "@/lib/feedback";

import { canEditItem, canUpdateTaskProgress, type EapAccess } from "./eap-access";
import type { EapPerson } from "./eap-panel";
import { presentPhase, type ProjectMilestoneView, type ProjectPhaseView, type ProjectTaskView } from "./eap-present";
import { orderPhaseChildren, selectionKey, type EapSelection, type PhaseChild } from "./eap-selection";

export function ProjectEap({
  projectId,
  projectName,
  phases,
  access,
  people,
}: {
  projectId: string;
  projectName: string;
  phases: ProjectPhaseView[] | null;
  access: EapAccess;
  people: EapPerson[] | null;
}) {
  const [items, setItems] = useState(phases);
  const [selection, setSelection] = useState<EapSelection | null>(null);
  const [pending, setPending] = useState<EapSelection | "close" | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<EapListFilter>(idleEapFilter);
  const [create, setCreate] = useState<EapCreateRequest | null>(null);
  const [startEditing, setStartEditing] = useState(false);
  const [panelEditing, setPanelEditing] = useState(false);
  const [panelWide, setPanelWide] = useState(false);
  // Só o expandir/reduzir anima a largura; na troca editar ↔ detalhes a largura muda direto e o conteúdo entra com fade.
  const [panelResizing, setPanelResizing] = useState(false);
  const handleEditingChange = useCallback((editing: boolean) => {
    setPanelResizing(false);
    setPanelEditing(editing);
  }, []);
  const [movingPhase, setMovingPhase] = useState(false);
  const [draggingPhaseId, setDraggingPhaseId] = useState<string | null>(null);
  const [dragOverPhaseId, setDragOverPhaseId] = useState<string | null>(null);
  const [createdNotice, setCreatedNotice] = useState<string | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<EapDeleteRequest | null>(null);
  const [importing, setImporting] = useState(false);
  const dirtyRef = useRef(false);
  const movingPhaseRef = useRef(false);

  if (!items) {
    return (
      <Unavailable
        title="Não foi possível consultar a EAP"
        description="A estrutura de fases deste projeto não pôde ser carregada."
      />
    );
  }

  const visible = filterPhases(items, query, filter);
  const names = people ? new Map(people.map((person) => [person.userId, person.name])) : null;
  function requestSelect(next: EapSelection, editing = false) {
    if (selection && selectionKey(selection) === selectionKey(next) && !editing) {
      return;
    }

    if (dirtyRef.current) {
      setPending(next);
      return;
    }

    setStartEditing(editing);
    setPanelEditing(editing);
    setSelection(next);
    setPending(null);
    setCreatedNotice(null);
  }

  function openCreated(next: EapSelection, createdLabel: string) {
    dirtyRef.current = false;
    setStartEditing(true);
    setPanelEditing(true);
    setSelection(next);
    setPending(null);
    notifySuccess(`${createdLabel}.`);
    setCreatedNotice("Agora você pode vincular evidências e acompanhar o histórico de alterações.");
  }

  function requestClose() {
    if (dirtyRef.current) {
      setPending("close");
      return;
    }

    setSelection(null);
    setPanelEditing(false);
    setPending(null);
    setCreatedNotice(null);
  }

  function discard() {
    dirtyRef.current = false;
    setCreatedNotice(null);
    const next = pending && pending !== "close" ? pending : null;
    setSelection(next);
    if (!next) {
      setPanelEditing(false);
    }
    setPending(null);
  }

  const filtering = query.trim().length > 0 || filter.statuses.length > 0 || filter.impediment || filter.overdue;
  const canReorderPhases = access.canManageStructure && !filtering;

  function phaseActions(phaseId: string, index: number): RowActions {
    const phase = items?.find((item) => item.id === phaseId);
    return {
      onEdit: phase && canEditItem(access, phase.createdBy) ? () => requestSelect({ kind: "phase", phaseId }, true) : undefined,
      canAddChild: access.canCreateItems,
      onAddTask: () => setCreate({ kind: "task", phaseId }),
      onAddMilestone: () => setCreate({ kind: "milestone", phaseId }),
      onMoveUp: access.canManageStructure ? () => void movePhase(phaseId, -1) : undefined,
      onMoveDown: access.canManageStructure ? () => void movePhase(phaseId, 1) : undefined,
      moveUpDisabled: movingPhase || filtering || index <= 0,
      moveDownDisabled: movingPhase || filtering || !items || index >= items.length - 1,
      moveTitle: filtering ? "Limpe a busca e os filtros para reordenar as fases." : undefined,
      onDelete: access.canManageStructure && phase ? () => setDeleteRequest({ target: { kind: "phase", phaseId }, label: phase.name }) : undefined,
      deleteBlockedReason:
        (phase?.tasks?.length ?? 0) > 0 || (phase?.milestones?.length ?? 0) > 0
          ? "Não é possível excluir esta fase porque existem tarefas ou marcos vinculados. Mova ou trate os itens subordinados antes de continuar."
          : undefined,
    };
  }

  async function refreshPhase(phaseId: string) {
    try {
      const response = await getEapPhase(projectId, phaseId);
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível atualizar a situação da fase.");
      }
      setItems((currentPhases) =>
        currentPhases?.map((item) =>
          item.id === phaseId ? presentPhase(response.data, { tasks: item.tasks, milestones: item.milestones }, names) : item,
        ) ?? currentPhases,
      );
    } catch (caught) {
      reportFailure(caught, "Não foi possível atualizar a situação da fase. Recarregue a página para ver o valor recalculado.");
    }
  }

  function handleDeleted(target: EapSelection) {
    setItems((currentPhases) => removeItem(currentPhases, target));
    if (target.kind !== "phase") {
      void refreshPhase(target.phaseId);
    }
    const selectedPhase = selection?.phaseId;
    const removesSelection =
      selection &&
      (target.kind === "phase" ? selectedPhase === target.phaseId : selectionKey(selection) === selectionKey(target));
    if (removesSelection) {
      dirtyRef.current = false;
      setSelection(null);
      setPanelEditing(false);
      setPending(null);
      setCreatedNotice(null);
    }
  }

  async function movePhase(phaseId: string, direction: -1 | 1) {
    if (movingPhaseRef.current || !items) {
      return;
    }

    const index = items.findIndex((phase) => phase.id === phaseId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= items.length) {
      return;
    }

    const previous = items;
    const next = items.slice();
    const [phase] = next.splice(index, 1);
    if (!phase) {
      return;
    }
    next.splice(target, 0, phase);
    await savePhaseOrder(next, previous);
  }

  async function placePhase(phaseId: string, targetId: string) {
    if (movingPhaseRef.current || !items || !canReorderPhases || phaseId === targetId) {
      return;
    }

    const from = items.findIndex((item) => item.id === phaseId);
    const to = items.findIndex((item) => item.id === targetId);
    if (from < 0 || to < 0) {
      return;
    }

    await savePhaseOrder(moveItem(items, from, to), items);
  }

  async function placeChild(phaseId: string, sourceKey: string, targetKey: string) {
    if (movingPhaseRef.current || !items || !canReorderPhases || sourceKey === targetKey) {
      return;
    }

    const phase = items.find((item) => item.id === phaseId);
    if (!phase?.tasks || !phase.milestones) {
      return;
    }

    const children = orderPhaseChildren(phase.tasks, phase.milestones);
    const from = children.findIndex((child) => childKey(child) === sourceKey);
    const to = children.findIndex((child) => childKey(child) === targetKey);
    if (from < 0 || to < 0) {
      return;
    }

    const nextChildren = moveItem(children, from, to);
    const nextTasks = nextChildren.flatMap((child, sortOrder) =>
      child.kind === "task" ? [{ ...child.item, sortOrder }] : [],
    );
    const nextMilestones = nextChildren.flatMap((child, sortOrder) =>
      child.kind === "milestone" ? [{ ...child.item, sortOrder }] : [],
    );
    const previous = items;
    const next = items.map((item) =>
      item.id === phaseId ? { ...item, tasks: nextTasks, milestones: nextMilestones } : item,
    );
    movingPhaseRef.current = true;
    setItems(next);
    setMovingPhase(true);
    setDraggingPhaseId(null);
    setDragOverPhaseId(null);

    try {
      if (nextTasks.length > 0) {
        const response = await apiFetcher<{ status: number }>(`/projects/${projectId}/phases/${phaseId}/tasks/order`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: nextTasks.map((item: ProjectTaskView) => ({ taskId: item.id, sortOrder: item.sortOrder })),
          }),
        });
        if (response.status !== 200) {
          throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível reordenar as tarefas.");
        }
      }

      if (nextMilestones.length > 0) {
        const response = await apiFetcher<{ status: number }>(`/projects/${projectId}/phases/${phaseId}/milestones/order`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: nextMilestones.map((item) => ({ milestoneId: item.id, sortOrder: item.sortOrder })),
          }),
        });
        if (response.status !== 200) {
          throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível reordenar os marcos.");
        }
      }
    } catch (caught) {
      setItems(previous);
      reportFailure(caught, "Não foi possível reordenar os itens da fase.");
    } finally {
      movingPhaseRef.current = false;
      setMovingPhase(false);
    }
  }

  async function savePhaseOrder(next: ProjectPhaseView[], previous: ProjectPhaseView[]) {
    movingPhaseRef.current = true;
    setItems(next);
    setMovingPhase(true);
    setDraggingPhaseId(null);
    setDragOverPhaseId(null);

    try {
      const response = await reorderEapPhases(projectId, {
        items: next.map((item, sortOrder) => ({ phaseId: item.id, sortOrder })),
      });
      if (response.status !== 200) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível reordenar as fases.");
      }
    } catch (caught) {
      setItems(previous);
      reportFailure(caught, "Não foi possível reordenar as fases.");
    } finally {
      movingPhaseRef.current = false;
      setMovingPhase(false);
    }
  }

  function itemActions(next: EapSelection, canEdit: boolean, label: string, deleteBlockedReason?: string): RowActions {
    return {
      onEdit: canEdit ? () => requestSelect(next, true) : undefined,
      onDelete: access.canManageStructure ? () => setDeleteRequest({ target: next, label }) : undefined,
      deleteBlockedReason,
    };
  }

  function renderChild(child: PhaseChild, index: number, phaseId: string, phaseIndex: number) {
    if (child.kind === "task") {
      const task = child.item;
      const taskSelection = { kind: "task" as const, phaseId, taskId: task.id };
      return (
        <TaskRow
          key={task.id}
          index={index}
          phaseIndex={phaseIndex}
          task={task}
          showDivergence={access.canManageStructure}
          selected={selection?.kind === "task" && selection.taskId === task.id}
          onOpen={() => requestSelect(taskSelection)}
          actions={itemActions(
            taskSelection,
            canUpdateTaskProgress(access, task),
            task.title,
            task.calculatedStatus === "CONCLUIDA"
              ? "Não é possível excluir uma tarefa concluída. A conclusão faz parte do histórico de execução do projeto."
              : undefined,
          )}
          reorderable={canReorderPhases}
          dragging={draggingPhaseId === `task:${task.id}`}
          dragOver={dragOverPhaseId === `task:${task.id}` && draggingPhaseId !== `task:${task.id}`}
          onDragStartTask={() => setDraggingPhaseId(`task:${task.id}`)}
          onDragEndTask={() => {
            setDraggingPhaseId(null);
            setDragOverPhaseId(null);
          }}
          onDragOverTask={() => setDragOverPhaseId(`task:${task.id}`)}
          onDropTask={(sourceId) => {
            if (sourceId.startsWith("task:") || sourceId.startsWith("milestone:")) {
              void placeChild(phaseId, sourceId, `task:${task.id}`);
            }
          }}
        />
      );
    }

    const milestone = child.item;
    return (
      <MilestoneRow
        key={milestone.id}
        index={index}
        phaseIndex={phaseIndex}
        milestone={milestone}
        selected={selection?.kind === "milestone" && selection.milestoneId === milestone.id}
        onOpen={() => requestSelect({ kind: "milestone", phaseId, milestoneId: milestone.id })}
        actions={itemActions(
          { kind: "milestone", phaseId, milestoneId: milestone.id },
          canEditItem(access, milestone.createdBy),
          milestone.title,
          milestone.status !== "PENDENTE"
            ? "Não é possível excluir um marco já entregue ou homologado. A entrega e a decisão formal fazem parte do histórico do projeto."
            : undefined,
        )}
        reorderable={canReorderPhases}
        dragging={draggingPhaseId === `milestone:${milestone.id}`}
        dragOver={dragOverPhaseId === `milestone:${milestone.id}` && draggingPhaseId !== `milestone:${milestone.id}`}
        onDragStartMilestone={() => setDraggingPhaseId(`milestone:${milestone.id}`)}
        onDragEndMilestone={() => {
          setDraggingPhaseId(null);
          setDragOverPhaseId(null);
        }}
        onDragOverMilestone={() => setDragOverPhaseId(`milestone:${milestone.id}`)}
        onDropMilestone={(sourceId) => {
          if (sourceId.startsWith("task:") || sourceId.startsWith("milestone:")) {
            void placeChild(phaseId, sourceId, `milestone:${milestone.id}`);
          }
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {pending && !selection ? (
        <UnsavedNotice onDiscard={discard} onKeep={() => setPending(null)} />
      ) : null}
      <EapWorkbench
        phases={items}
        query={query}
        onQueryChange={setQuery}
        filter={filter}
        onFilterChange={setFilter}
        empty={visible.length === 0}
        headingAction={<CreateMenu phases={items} enabled={access.canCreateItems} onCreate={setCreate} onImport={() => setImporting(true)} importBlocked={items.length > 0} />}
      >
        {visible.map(({ phase, tasks, milestones }) => {
            const phaseIndex = items.findIndex((item) => item.id === phase.id);
            return (
              <PhaseRow
                key={phase.id}
                index={phaseIndex}
                phase={phase}
                showDivergence={access.canManageStructure}
                selected={selection?.kind === "phase" && selection.phaseId === phase.id}
                onOpen={() => requestSelect({ kind: "phase", phaseId: phase.id })}
                actions={phaseActions(phase.id, phaseIndex)}
                reorderable={canReorderPhases}
                dragging={draggingPhaseId === phase.id}
                dragOver={dragOverPhaseId === phase.id && draggingPhaseId !== phase.id}
                onDragStartPhase={() => setDraggingPhaseId(phase.id)}
                onDragEndPhase={() => {
                  setDraggingPhaseId(null);
                  setDragOverPhaseId(null);
                }}
                onDragOverPhase={() => setDragOverPhaseId(phase.id)}
                onDropPhase={(sourceId) => {
                  if (sourceId && !sourceId.startsWith("milestone:") && !sourceId.startsWith("task:")) {
                    void placePhase(sourceId, phase.id);
                  }
                }}
                renderTasks={tasks === null || tasks.length > 0 || (milestones !== null && milestones.length > 0 && tasks !== null)}
                renderMilestones={milestones === null || tasks === null}
                tasks={
                  tasks === null ? (
                    <p className="px-4 py-2 text-sm text-muted-foreground">Não foi possível consultar as tarefas desta fase.</p>
                  ) : (
                    (milestones === null ? tasks.map((task) => ({ kind: "task" as const, item: task })) : orderPhaseChildren(tasks, milestones)).map((child, index) =>
                      renderChild(child, index, phase.id, phaseIndex),
                    )
                  )
                }
                milestones={
                  milestones === null ? (
                    <p className="px-4 py-2 text-sm text-muted-foreground">Não foi possível consultar os marcos desta fase.</p>
                  ) : tasks === null ? (
                    milestones.map((milestone, index) =>
                      renderChild({ kind: "milestone", item: milestone }, index, phase.id, phaseIndex),
                    )
                  ) : null
                }
              />
            );
          })}
      </EapWorkbench>
      <Sheet open={selection !== null} onOpenChange={(open) => { if (!open) requestClose(); }}>
        <SheetContent
          showCloseButton={false}
          overlayClassName="bg-[rgba(13,25,42,0.2)] supports-backdrop-filter:backdrop-blur-[1px]"
          className={`w-full gap-0 overflow-hidden bg-white p-0 ease-out motion-reduce:transition-none data-[side=right]:w-full ${panelResizing ? "transition-[translate,opacity,max-width] duration-300" : "transition-[translate,opacity] duration-200"} ${panelWide ? "data-[side=right]:sm:max-w-[min(860px,92vw)]" : panelEditing ? "data-[side=right]:sm:max-w-[620px]" : "data-[side=right]:sm:max-w-[430px]"}`}
        >
          {selection ? (
            <EapDetail
              key={`${selectionKey(selection)}:${startEditing ? "edit" : "view"}`}
              projectId={projectId}
              phases={items}
              selection={selection}
              access={access}
              people={people}
              names={names}
              code={eapCode(items, selection)}
              projectName={projectName}
              initialEditing={startEditing}
              notice={createdNotice}
              onEditingChange={handleEditingChange}
              wide={panelWide}
              onToggleWide={() => {
                setPanelResizing(true);
                setPanelWide((value) => !value);
              }}
              pending={pending !== null}
              dirtyRef={dirtyRef}
              onClose={requestClose}
              onKeep={() => setPending(null)}
              onDiscard={discard}
              onSelect={requestSelect}
              onPhase={(phase) => setItems((currentPhases) => patchPhase(currentPhases, phase))}
              onTask={(task) => {
                setItems((currentPhases) => patchTask(currentPhases, task));
                void refreshPhase(task.phaseId);
              }}
              onMilestone={(milestone) => {
                setItems((currentPhases) => patchMilestone(currentPhases, milestone));
                void refreshPhase(milestone.phaseId);
              }}
              onCorrectiveTask={(milestone) => {
                requestClose();
                setCreate({ kind: "task", phaseId: milestone.phaseId, correctiveFor: { milestoneId: milestone.id, title: milestone.title } });
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>
      {create ? (
        <EapCreateSheet
          projectId={projectId}
          projectName={projectName}
          request={create}
          phases={items}
          people={people}
          names={names}
          access={access}
          onClose={() => setCreate(null)}
          onPhase={(phase) => {
            setItems((currentPhases) => appendPhase(currentPhases, phase));
            openCreated({ kind: "phase", phaseId: phase.id }, "Fase criada");
          }}
          onTask={(task) => {
            setItems((currentPhases) => appendTask(currentPhases, task));
            void refreshPhase(task.phaseId);
            openCreated({ kind: "task", phaseId: task.phaseId, taskId: task.id }, "Tarefa criada");
          }}
          onMilestone={(milestone) => {
            setItems((currentPhases) => appendMilestone(currentPhases, milestone));
            void refreshPhase(milestone.phaseId);
            openCreated({ kind: "milestone", phaseId: milestone.phaseId, milestoneId: milestone.id }, "Marco criado");
          }}
        />
      ) : null}
      <EapImportSheet
        projectId={projectId}
        open={importing}
        onClose={() => setImporting(false)}
        onImported={async () => {
          const next = await readPhases(projectId, names);
          if (next) {
            setItems(next);
          } else {
            reportFailure(null, "EAP importada, mas não foi possível atualizar a lista. Recarregue a página.");
          }
        }}
      />
      <EapDeleteDialog
        projectId={projectId}
        request={deleteRequest}
        onClose={() => setDeleteRequest(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}


function CreateMenu({
  phases,
  enabled,
  onCreate,
  onImport,
  importBlocked,
}: {
  phases: ProjectPhaseView[];
  enabled: boolean;
  onCreate: (request: EapCreateRequest) => void;
  onImport: () => void;
  /** A importação é só a carga inicial: fica indisponível quando a EAP já tem itens. */
  importBlocked: boolean;
}) {
  const firstPhase = phases[0]?.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" className="h-9 gap-[7px] rounded-[7px] bg-[#175cd3] px-[13px] text-[11px] font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.12)] hover:bg-[#1248a8]" />}>
        <Plus className="size-[17px]" aria-hidden="true" />
        Novo item
        <ChevronDown className="size-3.5 opacity-80" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[286px] p-2">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-[9px] text-[8px] font-bold tracking-[0.1em] text-[#98a2b3]">
            {enabled ? "Adicionar à EAP" : "Seu acesso não permite cadastrar itens"}
          </DropdownMenuLabel>
          <DropdownMenuItem className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-2.5 rounded-[7px] px-[9px] py-[9px]" disabled={!enabled} onClick={() => onCreate({ kind: "phase" })}>
            <span className="flex size-[34px] items-center justify-center rounded-[7px] bg-[#e9f2ff] text-[#2865b9]"><Folder className="size-4" aria-hidden="true" /></span>
            <span>
              <strong className="block text-[10px]">Nova fase</strong>
              <small className="mt-1 block text-[8px] leading-snug text-[#98a2b3]">Organize uma grande etapa do projeto</small>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-2.5 rounded-[7px] px-[9px] py-[9px]" disabled={!enabled || !firstPhase} onClick={() => firstPhase && onCreate({ kind: "task", phaseId: "" })}>
            <span className="flex size-[34px] items-center justify-center rounded-[7px] bg-[#eef2f6] text-[#52677e]"><Check className="size-4" aria-hidden="true" /></span>
            <span>
              <strong className="block text-[10px]">Nova tarefa</strong>
              <small className="mt-1 block text-[8px] leading-snug text-[#98a2b3]">Crie uma atividade com responsável e prazo</small>
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-2.5 rounded-[7px] px-[9px] py-[9px]" disabled={!enabled || !firstPhase} onClick={() => firstPhase && onCreate({ kind: "milestone", phaseId: "" })}>
            <span className="flex size-[34px] items-center justify-center rounded-[7px] bg-[#f4ecfb] text-[#8b5bbb]"><Flag className="size-4" aria-hidden="true" /></span>
            <span>
              <strong className="block text-[10px]">Novo marco</strong>
              <small className="mt-1 block text-[8px] leading-snug text-[#98a2b3]">Registre uma entrega ou decisão importante</small>
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-1.5" />
          <DropdownMenuItem className="grid grid-cols-[34px_minmax(0,1fr)] items-center gap-2.5 rounded-[7px] px-[9px] py-[9px]" disabled={!enabled || importBlocked} onClick={onImport}>
            <span className="flex size-[34px] items-center justify-center rounded-[7px] bg-[#e8f6ef] text-[#157454]"><FileSpreadsheet className="size-4" aria-hidden="true" /></span>
            <span>
              <strong className="block text-[10px]">Importar EAP</strong>
              <small className="mt-1 block text-[8px] leading-snug text-[#98a2b3]">
                {importBlocked ? "Disponível apenas com a EAP vazia (carga inicial)" : "Carga inicial de fases, tarefas e marcos por .xlsx ou .csv"}
              </small>
            </span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UnsavedNotice({ onDiscard, onKeep }: { onDiscard: () => void; onKeep: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <p className="text-sm">Há alterações não salvas neste item.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="destructive" onClick={onDiscard}>
          Descartar e continuar
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onKeep}>
          Continuar editando
        </Button>
      </div>
    </div>
  );
}


function Unavailable({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ListTodo />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function patchPhase(phases: ProjectPhaseView[] | null, phase: ProjectPhaseView) {
  if (!phases) {
    return phases;
  }

  return phases.map((item) => (item.id === phase.id ? { ...phase, tasks: item.tasks, milestones: item.milestones } : item));
}

function patchTask(phases: ProjectPhaseView[] | null, task: ProjectTaskView) {
  if (!phases) {
    return phases;
  }

  return phases.map((phase) =>
    phase.id === task.phaseId && phase.tasks
      ? { ...phase, tasks: phase.tasks.map((item) => (item.id === task.id ? { ...task, sortOrder: item.sortOrder } : item)) }
      : phase,
  );
}

function patchMilestone(phases: ProjectPhaseView[] | null, milestone: ProjectMilestoneView) {
  if (!phases) {
    return phases;
  }

  return phases.map((phase) =>
    phase.id === milestone.phaseId && phase.milestones
      ? {
          ...phase,
          milestones: phase.milestones.map((item) => (item.id === milestone.id ? { ...milestone, sortOrder: item.sortOrder } : item)),
        }
      : phase,
  );
}

function moveItem<T>(list: readonly T[], from: number, to: number) {
  const next = list.slice();
  const [item] = next.splice(from, 1);
  if (item === undefined) {
    return list.slice();
  }
  next.splice(to, 0, item);
  return next;
}

function childKey(child: PhaseChild) {
  return child.kind === "task" ? `task:${child.item.id}` : `milestone:${child.item.id}`;
}

function nextChildSortOrder(phase: ProjectPhaseView) {
  const orders = [...(phase.tasks ?? []), ...(phase.milestones ?? [])].map((item) => item.sortOrder);
  return orders.reduce((maxValue, order) => Math.max(maxValue, order), -1) + 1;
}

function removeItem(phases: ProjectPhaseView[] | null, target: EapSelection) {
  if (!phases) {
    return phases;
  }
  if (target.kind === "phase") {
    return phases.filter((phase) => phase.id !== target.phaseId);
  }

  return phases.map((phase) => {
    if (phase.id !== target.phaseId) {
      return phase;
    }
    return target.kind === "task"
      ? { ...phase, tasks: phase.tasks?.filter((item) => item.id !== target.taskId) ?? null }
      : { ...phase, milestones: phase.milestones?.filter((item) => item.id !== target.milestoneId) ?? null };
  });
}

function appendPhase(phases: ProjectPhaseView[] | null, phase: ProjectPhaseView) {
  return phases ? [...phases, phase] : [phase];
}

function appendTask(phases: ProjectPhaseView[] | null, task: ProjectTaskView) {
  if (!phases) {
    return phases;
  }

  return phases.map((phase) =>
    phase.id === task.phaseId && phase.tasks
      ? { ...phase, tasks: [...phase.tasks, { ...task, sortOrder: nextChildSortOrder(phase) }] }
      : phase,
  );
}

function appendMilestone(phases: ProjectPhaseView[] | null, milestone: ProjectMilestoneView) {
  if (!phases) {
    return phases;
  }

  return phases.map((phase) =>
    phase.id === milestone.phaseId && phase.milestones
      ? { ...phase, milestones: [...phase.milestones, { ...milestone, sortOrder: nextChildSortOrder(phase) }] }
      : phase,
  );
}
