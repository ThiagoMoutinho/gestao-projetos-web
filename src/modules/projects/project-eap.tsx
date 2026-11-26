"use client";

import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, FileSpreadsheet, Flag, Folder, Plus, type LucideIcon } from "lucide-react";

import { PageLoadError } from "@/components/page-load-error";
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
import { EapWorkbench, MilestoneRow, PhaseRow, TaskRow, filterPhases, idleEapFilter, type EapListFilter, type RowActions } from "./eap-board";
import { EapCreateSheet, type EapCreateRequest } from "./eap-create";
import { EapDeleteDialog, type EapDeleteRequest } from "./eap-delete-dialog";
import { EapImportSheet } from "./eap-import-sheet";
import { readPhases } from "./load-project-detail";
import { EapDetail, eapCode } from "./eap-detail-view";
import { Sheet, SheetContent } from "@/components/ui/sheet";

import { duplicateEapMilestone, duplicateEapPhase, duplicateEapTask, getEapPhase, reorderEapPhases } from "@/lib/api/generated/eap/eap";
import { ApiError, apiFetcher } from "@/lib/api/fetcher";
import { notifySuccess, reportFailure } from "@/lib/feedback";

import { canEditItem, canUpdateTaskProgress, type EapAccess } from "./eap-access";
import type { EapPerson } from "./eap-panel";
import { presentPhase, type ProjectMilestoneView, type ProjectPhaseView, type ProjectTaskView } from "./eap-present";
import { orderPhaseChildren, selectionKey, subtasksOf, type EapSelection, type PhaseChild } from "./eap-selection";

export function ProjectEap({
  projectId,
  projectName,
  phases,
  initialMilestoneId,
  access,
  people,
}: {
  projectId: string;
  projectName: string;
  phases: ProjectPhaseView[] | null;
  /** Marco já selecionado ao abrir a EAP (o painel de detalhes dele abre sozinho). Ignorado se o marco não existir neste projeto. */
  initialMilestoneId?: string;
  access: EapAccess;
  people: EapPerson[] | null;
}) {
  const [items, setItems] = useState(phases);
  const [selection, setSelection] = useState<EapSelection | null>(() => {
    const phase = initialMilestoneId ? phases?.find((entry) => entry.milestones?.some((milestone) => milestone.id === initialMilestoneId)) : undefined;
    return phase && initialMilestoneId ? { kind: "milestone", phaseId: phase.id, milestoneId: initialMilestoneId } : null;
  });
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
      <PageLoadError
        title="Não foi possível carregar a EAP"
        description="A estrutura de fases deste projeto não pôde ser carregada. Sua sessão permanece ativa — tente de novo em instantes."
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
      onDuplicate: access.canCreateItems && phase ? () => void duplicateItem({ kind: "phase", phaseId }, `Fase "${phase.name}"`) : undefined,
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

  /** Relê as fases, tarefas e marcos (os cálculos da superior e da fase vêm do servidor). A expansão das fases é preservada. */
  async function reloadItems() {
    const next = await readPhases(projectId, names);
    if (next) {
      setItems(next);
    } else {
      reportFailure(null, "Não foi possível atualizar a EAP. Recarregue a página.");
    }
  }

  /** Cria uma cópia limpa (sem andamento, datas reais, evidências nem histórico) e atualiza a lista. */
  async function duplicateItem(target: EapSelection, label: string) {
    try {
      const response =
        target.kind === "phase"
          ? await duplicateEapPhase(projectId, target.phaseId)
          : target.kind === "task"
            ? await duplicateEapTask(projectId, target.phaseId, target.taskId)
            : await duplicateEapMilestone(projectId, target.phaseId, target.milestoneId);
      if (response.status !== 201) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível duplicar o item.");
      }
      await reloadItems();
      notifySuccess(`${label} duplicad${target.kind === "milestone" ? "o" : target.kind === "phase" ? "a" : "a"}.`);
    } catch (caught) {
      reportFailure(caught, "Não foi possível duplicar o item.");
    }
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
    // Excluir uma subtarefa muda o andamento calculado da tarefa superior: a lista é relida.
    const wasSubtask =
      target.kind === "task" &&
      Boolean(items?.find((phase) => phase.id === target.phaseId)?.tasks?.find((task) => task.id === target.taskId)?.parentTaskId);
    setItems((currentPhases) => removeItem(currentPhases, target));
    if (wasSubtask) {
      void reloadItems();
    } else if (target.kind !== "phase") {
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
    const nextTopTasks = nextChildren.flatMap((child, sortOrder) =>
      child.kind === "task" ? [{ ...child.item, sortOrder }] : [],
    );
    // A API renumera as subtarefas depois das tarefas de nível principal; o estado local acompanha.
    const subtaskBase = nextChildren.length;
    const nextSubtasks = phase.tasks.filter((item) => item.parentTaskId).map((item, offset) => ({ ...item, sortOrder: subtaskBase + offset }));
    const nextTasks = [...nextTopTasks, ...nextSubtasks];
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
      if (nextTopTasks.length > 0) {
        const response = await apiFetcher<{ status: number }>(`/projects/${projectId}/phases/${phaseId}/tasks/order`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: nextTopTasks.map((item: ProjectTaskView) => ({ taskId: item.id, sortOrder: item.sortOrder })),
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

  function itemActions(next: EapSelection, canEdit: boolean, label: string, deleteBlockedReason?: string, canAddSubtask = false): RowActions {
    return {
      onEdit: canEdit ? () => requestSelect(next, true) : undefined,
      onDuplicate: access.canCreateItems ? () => void duplicateItem(next, label.length > 40 ? `${next.kind === "task" ? "Tarefa" : "Marco"}` : `"${label}"`) : undefined,
      onAddSubtask:
        canAddSubtask && access.canCreateItems && next.kind === "task"
          ? () => setCreate({ kind: "task", phaseId: next.phaseId, parentTaskId: next.taskId })
          : undefined,
      onDelete: access.canManageStructure ? () => setDeleteRequest({ target: next, label }) : undefined,
      deleteBlockedReason,
    };
  }

  function renderChild(child: PhaseChild, index: number, phaseId: string, phaseIndex: number, visibleTasks: ProjectTaskView[] | null) {
    if (child.kind === "task") {
      const task = child.item;
      const taskSelection = { kind: "task" as const, phaseId, taskId: task.id };
      const subtasks = visibleTasks ? subtasksOf(visibleTasks, task.id) : [];
      const allSubtasks = items?.find((phase) => phase.id === phaseId)?.tasks?.filter((item) => item.parentTaskId === task.id) ?? [];
      return (
        <div key={task.id}>
        <TaskRow
          index={index}
          phaseIndex={phaseIndex}
          subtaskCount={allSubtasks.length}
          task={task}
          showDivergence={access.canManageStructure}
          selected={selection?.kind === "task" && selection.taskId === task.id}
          onOpen={() => requestSelect(taskSelection)}
          actions={itemActions(
            taskSelection,
            canUpdateTaskProgress(access, task),
            task.title,
            allSubtasks.length > 0
              ? "Não é possível excluir esta tarefa porque ela possui subtarefas. Trate as subtarefas antes de continuar."
              : task.calculatedStatus === "CONCLUIDA"
                ? "Não é possível excluir uma tarefa concluída. A conclusão faz parte do histórico de execução do projeto."
                : undefined,
            true,
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
        {subtasks.map((subtask, subIndex) => {
          const subSelection = { kind: "task" as const, phaseId, taskId: subtask.id };
          return (
            <TaskRow
              key={subtask.id}
              index={index}
              phaseIndex={phaseIndex}
              subtaskNumber={subIndex + 1}
              task={subtask}
              showDivergence={access.canManageStructure}
              selected={selection?.kind === "task" && selection.taskId === subtask.id}
              onOpen={() => requestSelect(subSelection)}
              actions={itemActions(
                subSelection,
                canUpdateTaskProgress(access, subtask),
                subtask.title,
                subtask.calculatedStatus === "CONCLUIDA"
                  ? "Não é possível excluir uma tarefa concluída. A conclusão faz parte do histórico de execução do projeto."
                  : undefined,
              )}
            />
          );
        })}
        </div>
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
                onAddItem={access.canCreateItems && tasks !== null && !filtering ? (kind) => setCreate(kind === "phase" ? { kind } : { kind, phaseId: phase.id }) : undefined}
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
                    (milestones === null ? tasks.filter((task) => !task.parentTaskId).map((task) => ({ kind: "task" as const, item: task })) : orderPhaseChildren(tasks, milestones)).map((child, index) =>
                      renderChild(child, index, phase.id, phaseIndex, tasks),
                    )
                  )
                }
                milestones={
                  milestones === null ? (
                    <p className="px-4 py-2 text-sm text-muted-foreground">Não foi possível consultar os marcos desta fase.</p>
                  ) : tasks === null ? (
                    milestones.map((milestone, index) =>
                      renderChild({ kind: "milestone", item: milestone }, index, phase.id, phaseIndex, tasks),
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
          className={`w-full gap-0 overflow-hidden bg-card p-0 ease-out motion-reduce:transition-none data-[side=right]:w-full ${panelResizing ? "transition-[translate,opacity,max-width] duration-300" : "transition-[translate,opacity] duration-200"} ${panelWide ? "data-[side=right]:sm:max-w-[min(860px,92vw)]" : panelEditing ? "data-[side=right]:sm:max-w-[620px]" : "data-[side=right]:sm:max-w-[620px]"}`}
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
                // Subtarefa: a tarefa superior também muda (andamento e situação calculados), então a lista é relida.
                void (task.parentTaskId ? reloadItems() : refreshPhase(task.phaseId));
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
            void (task.parentTaskId ? reloadItems() : refreshPhase(task.phaseId));
            openCreated({ kind: "task", phaseId: task.phaseId, taskId: task.id }, task.parentTaskId ? "Subtarefa criada" : "Tarefa criada");
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


/** Cor própria de cada tipo no menu "Novo item" (mesmos tons de status usados na EAP). `!` vence a cor uniforme do foco do item. */
const CREATE_TONES = {
  phase: "bg-primary/12 text-primary! ring-primary/25",
  task: "bg-status-running-soft text-status-running-ink! ring-status-running/30",
  milestone: "bg-status-validation-soft text-status-validation-ink! ring-status-validation/30",
  import: "bg-status-done-soft text-status-done-ink! ring-status-done/30",
} as const;

function CreateMenuItem({
  icon: Icon,
  tone,
  title,
  description,
  badge,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  tone: keyof typeof CREATE_TONES;
  title: string;
  description: string;
  badge?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem
      className="grid grid-cols-[38px_minmax(0,1fr)_16px] items-center gap-3 rounded-[9px] px-2.5 py-2.5 transition-colors duration-150 motion-reduce:transition-none"
      disabled={disabled}
      onClick={onClick}
    >
      <span
        className={`flex size-[38px] items-center justify-center rounded-[10px] ring-1 ring-inset transition-transform duration-200 group-focus/dropdown-menu-item:scale-105 motion-reduce:transition-none [&>svg]:text-inherit! ${CREATE_TONES[tone]}`}
      >
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <strong className="flex items-center gap-2 text-[13px] leading-tight font-semibold">
          {title}
          {badge ? <span className="rounded-full border border-border px-1.5 py-px text-[10px] leading-none font-medium text-muted-foreground">{badge}</span> : null}
        </strong>
        <small className="mt-1 block text-[11.5px] leading-snug text-muted-foreground">{description}</small>
      </span>
      <ChevronRight
        className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-[opacity,transform] duration-200 group-focus/dropdown-menu-item:translate-x-0 group-focus/dropdown-menu-item:opacity-100 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </DropdownMenuItem>
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
      <DropdownMenuTrigger render={<Button type="button" className="group/trigger h-10 gap-2 px-4" />}>
        <Plus className="size-[17px]" aria-hidden="true" />
        Novo item
        <ChevronDown
          className="size-3.5 opacity-80 transition-transform duration-200 group-aria-expanded/trigger:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[328px] rounded-xl p-2 shadow-xl">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2.5 pt-1.5 pb-2 text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
            {enabled ? "Adicionar à EAP" : "Seu acesso não permite cadastrar itens"}
          </DropdownMenuLabel>
          <CreateMenuItem
            icon={Folder}
            tone="phase"
            title="Nova fase"
            description="Organize uma grande etapa do projeto"
            disabled={!enabled}
            onClick={() => onCreate({ kind: "phase" })}
          />
          <CreateMenuItem
            icon={Check}
            tone="task"
            title="Nova tarefa"
            description="Crie uma atividade com responsável e prazo"
            disabled={!enabled || !firstPhase}
            onClick={() => firstPhase && onCreate({ kind: "task", phaseId: "" })}
          />
          <CreateMenuItem
            icon={Flag}
            tone="milestone"
            title="Novo marco"
            description="Registre uma entrega ou decisão importante"
            disabled={!enabled || !firstPhase}
            onClick={() => firstPhase && onCreate({ kind: "milestone", phaseId: "" })}
          />
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2.5 pt-0.5 pb-2 text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">Carga inicial</DropdownMenuLabel>
          <CreateMenuItem
            icon={FileSpreadsheet}
            tone="import"
            title="Importar EAP"
            badge={importBlocked ? "Indisponível" : undefined}
            description={importBlocked ? "Só com a EAP vazia (carga inicial)" : "Fases, tarefas e marcos por .xlsx ou .csv"}
            disabled={!enabled || importBlocked}
            onClick={onImport}
          />
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
