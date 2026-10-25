import type { ProjectMilestoneView, ProjectPhaseView, ProjectTaskView } from "./eap-present";

export const MILESTONE_DUE_LABEL = "Data prevista";
export const MILESTONE_DONE_LABEL = "Data efetiva de conclusão";

export type PhaseProgress =
  | { kind: "value"; basisPoints: number }
  | { kind: "empty" }
  | { kind: "unavailable" }
  | { kind: "no-eligible" };

export type ProjectProgress =
  | { kind: "value"; basisPoints: number; coverageBasis: number }
  | { kind: "none"; coverageBasis: number | null }
  | { kind: "unavailable" };

/** O andamento da fase é calculado pela API; aqui só se traduz o estado para a apresentação. */
export function phaseProgress(phase: ProjectPhaseView): PhaseProgress {
  if (phase.progressState === "VALUE" && phase.progressBasisPoints !== null) {
    return { kind: "value", basisPoints: phase.progressBasisPoints };
  }

  return phase.progressState === "NO_ELIGIBLE" ? { kind: "no-eligible" } : { kind: "empty" };
}

/** Mesma média do resumo da API, refeita sobre as fases já atualizadas na tela. */
export function projectProgress(phases: ProjectPhaseView[]): ProjectProgress {
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

  if (progress.kind === "empty") {
    return "Sem itens subordinados";
  }

  if (progress.kind === "no-eligible") {
    return "Sem itens elegíveis";
  }

  return "Cálculo indisponível";
}

export function vigenteText(dates: { label: string; value: string }[]) {
  const value = dates.find((date) => date.label === "Fim planejado (vigente)" || date.label === MILESTONE_DUE_LABEL)?.value;
  if (!value || value === "Não informada") {
    return null;
  }

  return value.split(",")[0]?.trim() ?? null;
}

export function isPastDue(dates: { label: string; value: string }[], today = belemToday()) {
  const due = isoDay(vigenteText(dates));
  return due !== null && due < today;
}

/** Atraso histórico: o item já foi finalizado, mas a data realizada passou do prazo vigente. */
export function finishedLate(item: ProjectPhaseView | ProjectTaskView | ProjectMilestoneView) {
  const finished = "type" in item ? item.status === "APROVADO" : item.calculatedStatus === "CONCLUIDA";
  if (!finished) {
    return false;
  }
  const due = isoDay(vigenteText(item.dates));
  const done = isoDay(dateValue(item.dates, "type" in item ? MILESTONE_DONE_LABEL : "Fim realizado"));
  return due !== null && done !== null && done > due;
}

function dateValue(dates: { label: string; value: string }[], label: string) {
  const value = dates.find((date) => date.label === label)?.value;
  return !value || value === "Não informada" ? null : (value.split(",")[0]?.trim() ?? null);
}

function isoDay(text: string | null) {
  const match = text ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text) : null;
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

export function taskIsOverdue(task: ProjectTaskView, today = belemToday()) {
  return task.calculatedStatus !== "CONCLUIDA" && task.calculatedStatus !== "CANCELADA" && isPastDue(task.dates, today);
}

export function milestoneIsOverdue(milestone: ProjectMilestoneView, today = belemToday()) {
  return milestone.status !== "APROVADO" && isPastDue(milestone.dates, today);
}

/** De quem depende o marco atrasado: da análise do homologador ou da correção pela entrega. */
export function milestoneDelayReason(milestone: ProjectMilestoneView, today = belemToday()) {
  if (!milestoneIsOverdue(milestone, today)) {
    return null;
  }
  if (milestone.status === "ENTREGUE") {
    return "Aguardando análise";
  }
  if (milestone.status === "AJUSTES_SOLICITADOS" || milestone.status === "REJEITADO") {
    return "Correção pendente";
  }
  return null;
}

export function phaseIsOverdue(phase: ProjectPhaseView, today = belemToday()) {
  return phase.calculatedStatus !== "CONCLUIDA" && isPastDue(phase.dates, today);
}

function belemToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
