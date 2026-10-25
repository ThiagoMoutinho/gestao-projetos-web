import type { GetProject200RolesItem } from "@/lib/api/generated/model/getProject200RolesItem";
import type { ListEapMilestones200DataItemStatus } from "@/lib/api/generated/model/listEapMilestones200DataItemStatus";
import type { ListEapMilestones200DataItemType } from "@/lib/api/generated/model/listEapMilestones200DataItemType";
import type { ListEapPhases200DataItemStatus } from "@/lib/api/generated/model/listEapPhases200DataItemStatus";
import type { ListEapTasks200DataItemStatus } from "@/lib/api/generated/model/listEapTasks200DataItemStatus";
import type { ListProjects200DataItemStatus } from "@/lib/api/generated/model/listProjects200DataItemStatus";

import {
  milestoneStatusLabel,
  milestoneStatusTone,
  milestoneTypeLabel,
  personName,
  phaseStatusLabel,
  phaseStatusTone,
  recordedDate,
  taskStatusLabel,
  taskStatusTone,
  type RecordTone,
} from "./project-records";
import { MILESTONE_DONE_LABEL, MILESTONE_DUE_LABEL } from "./eap-progress";

export type ProjectDateField = {
  label: string;
  value: string;
};

/** Datas cruas (ISO) do item. Marco usa só o término: data prevista, original e efetiva. */
export type ScheduleView = {
  single: boolean;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  baselineStartAt: string | null;
  baselineEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
};

export type ProjectMemberView = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: GetProject200RolesItem;
  roleLabel: string;
};

export type ProjectTaskView = {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  status: ListEapTasks200DataItemStatus;
  calculatedStatus: ListEapTasks200DataItemStatus;
  statusDiverges: boolean;
  statusLabel: string;
  statusTone: RecordTone;
  progressPercent: number;
  weight: number;
  sortOrder: number;
  hasImpediment: boolean;
  assigneeId: string | null;
  assigneeName: string;
  createdBy: string;
  actualStartAt: string | null;
  actualEndAt: string | null;
  correctiveMilestoneId: string | null;
  dates: ProjectDateField[];
  schedule: ScheduleView;
};

export type ProjectMilestoneView = {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  type: ListEapMilestones200DataItemType;
  typeLabel: string;
  sortOrder: number;
  status: ListEapMilestones200DataItemStatus;
  statusLabel: string;
  statusTone: RecordTone;
  dates: ProjectDateField[];
  schedule: ScheduleView;
  deliveredById: string | null;
  deliveredBy: string | null;
  validatedById: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  validationNote: string | null;
  reviewerId: string | null;
  reviewerName: string | null;
  createdBy: string;
};

export type PhaseProgressState = "VALUE" | "EMPTY" | "NO_ELIGIBLE";

export type ProjectPhaseView = {
  id: string;
  name: string;
  description: string | null;
  createdBy: string;
  responsibleId: string | null;
  responsibleName: string | null;
  completionCriteria: string | null;
  status: ListEapPhases200DataItemStatus;
  calculatedStatus: ListEapPhases200DataItemStatus;
  statusDiverges: boolean;
  statusLabel: string;
  statusTone: RecordTone;
  progressState: PhaseProgressState;
  progressBasisPoints: number | null;
  dates: ProjectDateField[];
  schedule: ScheduleView;
  tasks: ProjectTaskView[] | null;
  milestones: ProjectMilestoneView[] | null;
};

export type ProjectDetail = {
  id: string;
  name: string;
  description: string | null;
  status: ListProjects200DataItemStatus;
  ownerId: string;
  ownerName: string;
  managers: string[] | null;
  glpiTicketId: string | null;
  createdAt: string;
  updatedAt: string;
  viewerRoles: string[];
  memberRoles: GetProject200RolesItem[];
  members: ProjectMemberView[] | null;
  phases: ProjectPhaseView[] | null;
  /** Datas realizadas ficam nulas aqui: são derivadas das fases pelo monitoramento da API. */
  schedule: ScheduleView;
};

type DatedSpan = {
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  baselineStartAt: string | null;
  baselineEndAt: string | null;
  actualStartAt: string | null;
  actualEndAt: string | null;
};

export function presentPhase<T extends DatedSpan & {
  id: string;
  name: string;
  description: string | null;
  status: ListEapPhases200DataItemStatus;
  calculatedStatus: ListEapPhases200DataItemStatus;
  progressState: PhaseProgressState;
  progressBasisPoints: number | null;
  createdBy: string;
  responsibleId: string | null;
  completionCriteria: string | null;
}>(
  phase: T,
  children: Pick<ProjectPhaseView, "tasks" | "milestones">,
  names: Map<string, string> | null,
): ProjectPhaseView {
  return {
    id: phase.id,
    name: phase.name,
    description: phase.description,
    createdBy: phase.createdBy,
    responsibleId: phase.responsibleId,
    responsibleName: phase.responsibleId ? personName(phase.responsibleId, names) : null,
    completionCriteria: phase.completionCriteria,
    status: phase.status,
    calculatedStatus: phase.calculatedStatus,
    statusDiverges: phase.status !== phase.calculatedStatus,
    statusLabel: phaseStatusLabel(phase.calculatedStatus),
    statusTone: phaseStatusTone(phase.calculatedStatus),
    progressState: phase.progressState,
    progressBasisPoints: phase.progressBasisPoints,
    dates: spanDates(phase),
    schedule: spanSchedule(phase),
    tasks: children.tasks,
    milestones: children.milestones,
  };
}

export function presentTask<T extends DatedSpan & {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  assigneeId: string | null;
  status: ListEapTasks200DataItemStatus;
  calculatedStatus: ListEapTasks200DataItemStatus;
  progressPercent: number;
  weight: number;
  hasImpediment: boolean;
  correctiveMilestoneId?: string | null;
  createdBy: string;
}>(task: T, names: Map<string, string> | null): ProjectTaskView {
  return {
    id: task.id,
    phaseId: task.phaseId,
    title: task.title,
    description: task.description,
    status: task.status,
    calculatedStatus: task.calculatedStatus,
    statusDiverges: task.status !== task.calculatedStatus,
    statusLabel: taskStatusLabel(task.calculatedStatus),
    statusTone: taskStatusTone(task.calculatedStatus),
    progressPercent: task.progressPercent,
    weight: task.weight,
    sortOrder: 0,
    hasImpediment: task.hasImpediment,
    assigneeId: task.assigneeId,
    assigneeName: personName(task.assigneeId, names),
    createdBy: task.createdBy,
    actualStartAt: task.actualStartAt,
    actualEndAt: task.actualEndAt,
    correctiveMilestoneId: task.correctiveMilestoneId ?? null,
    dates: spanDates(task),
    schedule: spanSchedule(task),
  };
}

export function presentMilestone<T extends {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  type: ListEapMilestones200DataItemType;
  status: ListEapMilestones200DataItemStatus;
  baselineAt: string | null;
  plannedAt: string | null;
  actualAt: string | null;
  deliveredBy: string | null;
  validatedBy: string | null;
  validatedAt: string | null;
  validationNote: string | null;
  reviewerId: string | null;
  createdBy: string;
}>(milestone: T, names: Map<string, string> | null): ProjectMilestoneView {
  // Marcos de entrega legados gravam actualAt no envio; a conclusão efetiva só existe após o aceite.
  const concludedAt = milestone.status === "APROVADO" ? milestone.actualAt : null;
  return {
    id: milestone.id,
    phaseId: milestone.phaseId,
    title: milestone.title,
    description: milestone.description,
    type: milestone.type,
    typeLabel: milestoneTypeLabel(milestone.type),
    sortOrder: 0,
    status: milestone.status,
    statusLabel: milestoneStatusLabel(milestone.status, milestone.type),
    statusTone: milestoneStatusTone(milestone.status),
    dates: [
      { label: MILESTONE_DUE_LABEL, value: recordedDate(milestone.plannedAt) },
      { label: MILESTONE_DONE_LABEL, value: recordedDate(concludedAt) },
    ],
    schedule: {
      single: true,
      plannedStartAt: null,
      plannedEndAt: milestone.plannedAt,
      baselineStartAt: null,
      baselineEndAt: milestone.baselineAt,
      actualStartAt: null,
      actualEndAt: concludedAt,
    },
    deliveredById: milestone.deliveredBy,
    deliveredBy: milestone.deliveredBy ? personName(milestone.deliveredBy, names) : null,
    validatedById: milestone.validatedBy,
    validatedBy: milestone.validatedBy ? personName(milestone.validatedBy, names) : null,
    validatedAt: milestone.validatedAt,
    validationNote: milestone.validationNote,
    reviewerId: milestone.reviewerId,
    reviewerName: milestone.reviewerId ? personName(milestone.reviewerId, names) : null,
    createdBy: milestone.createdBy,
  };
}

export function civilDateInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function civilDateToIso(value: string) {
  if (!value) {
    return null;
  }

  return `${value}T12:00:00.000-03:00`;
}

function spanSchedule(item: DatedSpan): ScheduleView {
  return {
    single: false,
    plannedStartAt: item.plannedStartAt,
    plannedEndAt: item.plannedEndAt,
    baselineStartAt: item.baselineStartAt,
    baselineEndAt: item.baselineEndAt,
    actualStartAt: item.actualStartAt,
    actualEndAt: item.actualEndAt,
  };
}

function spanDates(item: DatedSpan): ProjectDateField[] {
  return [
    { label: "Início planejado (vigente)", value: recordedDate(item.plannedStartAt) },
    { label: "Fim planejado (vigente)", value: recordedDate(item.plannedEndAt) },
    { label: "Início da linha de base", value: recordedDate(item.baselineStartAt) },
    { label: "Fim da linha de base", value: recordedDate(item.baselineEndAt) },
    { label: "Início realizado", value: recordedDate(item.actualStartAt) },
    { label: "Fim realizado", value: recordedDate(item.actualEndAt) },
  ];
}
