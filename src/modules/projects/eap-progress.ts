import type { ProjectMilestoneView, ProjectPhaseView, ProjectTaskView } from "./eap-present";

export type PhaseProgress =
  | { kind: "value"; basisPoints: number }
  | { kind: "incomplete" }
  | { kind: "unavailable" }
  | { kind: "no-eligible" };

export type ProjectProgress =
  | { kind: "value"; basisPoints: number; coverageBasis: number }
  | { kind: "none"; coverageBasis: number | null }
  | { kind: "unavailable" };

const MILESTONE_WEIGHT = 1;

export function phaseProgress(phase: ProjectPhaseView): PhaseProgress {
  if (phase.tasks === null || phase.milestones === null) {
    return { kind: "unavailable" };
  }

  if (phase.tasks.length === 0 && phase.milestones.length === 0) {
    return { kind: "incomplete" };
  }

  const tasks = phase.tasks.filter((task) => task.status !== "CANCELADA");
  if (tasks.length === 0 && phase.milestones.length === 0) {
    return { kind: "no-eligible" };
  }

  let weighted = 0;
  let weights = 0;

  for (const task of tasks) {
    const weight = task.weight >= 1 ? task.weight : 1;
    weighted += task.progressPercent * weight;
    weights += weight;
  }

  for (const milestone of phase.milestones) {
    weighted += milestonePercent(milestone) * MILESTONE_WEIGHT;
    weights += MILESTONE_WEIGHT;
  }

  if (weights === 0) {
    return { kind: "no-eligible" };
  }

  return { kind: "value", basisPoints: Math.round((weighted * 100) / weights) };
}

export function projectProgress(phases: ProjectPhaseView[]): ProjectProgress {
  if (phases.some((phase) => phase.tasks === null || phase.milestones === null)) {
    return { kind: "unavailable" };
  }

  const rolls = phases.map((phase) => phaseProgress(phase));
  const calculable = rolls.filter((item): item is Extract<PhaseProgress, { kind: "value" }> => item.kind === "value");

  if (calculable.length === 0) {
    return { kind: "none", coverageBasis: phases.length === 0 ? null : 0 };
  }

  return {
    kind: "value",
    basisPoints: Math.round(calculable.reduce((total, item) => total + item.basisPoints, 0) / calculable.length),
    coverageBasis: Math.round((calculable.length * 10000) / phases.length),
  };
}

export function milestonePercent(milestone: ProjectMilestoneView) {
  return milestone.status === "APROVADO" ? 100 : 0;
}

export function formatBasis(basisPoints: number) {
  const tenths = Math.round(basisPoints / 10);
  return (tenths / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function basisToPercent(basisPoints: number) {
  return Math.min(100, Math.max(0, Math.round(basisPoints / 100)));
}

export function progressLabel(progress: PhaseProgress) {
  if (progress.kind === "value") {
    return `${formatBasis(progress.basisPoints)}%`;
  }

  if (progress.kind === "incomplete") {
    return "Planejamento incompleto";
  }

  if (progress.kind === "no-eligible") {
    return "Sem itens elegíveis";
  }

  return "Cálculo indisponível";
}

export function vigenteText(dates: { label: string; value: string }[]) {
  const value = dates.find((date) => date.label === "Fim planejado (vigente)" || date.label === "Planejada (vigente)")?.value;
  if (!value || value === "Não informada") {
    return null;
  }

  return value.split(",")[0]?.trim() ?? null;
}

export function isPastDue(dates: { label: string; value: string }[], today = belemToday()) {
  const text = vigenteText(dates);
  if (!text) {
    return false;
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) {
    return false;
  }

  return `${match[3]}-${match[2]}-${match[1]}` < today;
}

export function taskIsOverdue(task: ProjectTaskView, today = belemToday()) {
  return task.status !== "CONCLUIDA" && task.status !== "CANCELADA" && isPastDue(task.dates, today);
}

export function milestoneIsOverdue(milestone: ProjectMilestoneView, today = belemToday()) {
  return milestone.status !== "APROVADO" && isPastDue(milestone.dates, today);
}

export function phaseIsOverdue(phase: ProjectPhaseView, today = belemToday()) {
  return phase.status !== "CONCLUIDA" && isPastDue(phase.dates, today);
}

function belemToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
