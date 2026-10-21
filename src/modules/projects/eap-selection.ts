import type { ProjectMilestoneView, ProjectPhaseView, ProjectTaskView } from "./eap-present";

export type PhaseChild =
  | { kind: "task"; item: ProjectTaskView }
  | { kind: "milestone"; item: ProjectMilestoneView };

export function orderPhaseChildren(tasks: ProjectTaskView[], milestones: ProjectMilestoneView[]): PhaseChild[] {
  const taskOrders = new Set(tasks.map((task) => task.sortOrder));
  const sharesOrder = milestones.some((milestone) => taskOrders.has(milestone.sortOrder));
  const children: PhaseChild[] = [
    ...tasks.map((item) => ({ kind: "task" as const, item })),
    ...milestones.map((item) => ({ kind: "milestone" as const, item })),
  ];

  if (sharesOrder) {
    return children;
  }

  return children.sort((left, right) => left.item.sortOrder - right.item.sortOrder);
}

export type EapSelection =
  | { kind: "phase"; phaseId: string }
  | { kind: "task"; phaseId: string; taskId: string }
  | { kind: "milestone"; phaseId: string; milestoneId: string };

export function selectionKey(selection: EapSelection) {
  if (selection.kind === "phase") {
    return `phase:${selection.phaseId}`;
  }

  if (selection.kind === "task") {
    return `task:${selection.taskId}`;
  }

  return `milestone:${selection.milestoneId}`;
}

export function flattenEap(phases: ProjectPhaseView[]) {
  const items: EapSelection[] = [];

  for (const phase of phases) {
    items.push({ kind: "phase", phaseId: phase.id });

    if (phase.tasks && phase.milestones) {
      for (const child of orderPhaseChildren(phase.tasks, phase.milestones)) {
        items.push(
          child.kind === "task"
            ? { kind: "task", phaseId: phase.id, taskId: child.item.id }
            : { kind: "milestone", phaseId: phase.id, milestoneId: child.item.id },
        );
      }
    } else {
      for (const task of phase.tasks ?? []) {
        items.push({ kind: "task", phaseId: phase.id, taskId: task.id });
      }

      for (const milestone of phase.milestones ?? []) {
        items.push({ kind: "milestone", phaseId: phase.id, milestoneId: milestone.id });
      }
    }
  }

  return items;
}

export function neighbor(items: EapSelection[], current: EapSelection, direction: -1 | 1) {
  const index = items.findIndex((item) => selectionKey(item) === selectionKey(current));
  if (index < 0) {
    return null;
  }

  return items[index + direction] ?? null;
}

export function nextTask(items: EapSelection[], current: EapSelection) {
  const index = items.findIndex((item) => selectionKey(item) === selectionKey(current));
  if (index < 0) {
    return null;
  }

  return items.slice(index + 1).find((item) => item.kind === "task") ?? null;
}
