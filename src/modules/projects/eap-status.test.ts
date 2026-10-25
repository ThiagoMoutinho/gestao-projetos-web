import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ProjectMilestoneView, ProjectPhaseView, ProjectTaskView } from "./eap-present.ts";
import { finishedLate, milestoneDelayReason, milestoneIsOverdue, milestonePercent, phaseProgress, progressLabel, taskIsOverdue } from "./eap-progress.ts";
import { milestoneStatusKind, phaseStatusKind, taskStatusKind } from "./eap-status.ts";

const none = "Não informada";

function dates(start: string, end: string) {
  return [
    { label: "Início planejado (vigente)", value: start },
    { label: "Fim planejado (vigente)", value: end },
  ];
}

function phase(overrides: Partial<ProjectPhaseView> = {}): ProjectPhaseView {
  return {
    progressState: "VALUE",
    progressBasisPoints: 5000,
    calculatedStatus: "EM_ANDAMENTO",
    dates: dates("01/10/2026, 12:00", "30/10/2026, 12:00"),
    tasks: [],
    milestones: [],
    ...overrides,
  } as ProjectPhaseView;
}

function task(overrides: Partial<ProjectTaskView> = {}): ProjectTaskView {
  return { calculatedStatus: "EM_ANDAMENTO", dates: dates(none, "20/10/2026, 12:00"), ...overrides } as ProjectTaskView;
}

function milestone(overrides: Partial<ProjectMilestoneView> = {}): ProjectMilestoneView {
  return { type: "ENTREGA", status: "PENDENTE", dates: [{ label: "Data prevista", value: "25/10/2026, 12:00" }], ...overrides } as ProjectMilestoneView;
}

describe("cores semânticas das situações", () => {
  it("separa as famílias visuais", () => {
    assert.equal(phaseStatusKind("NAO_INICIADA"), "not-started");
    assert.equal(phaseStatusKind("EM_ANDAMENTO"), "in-progress");
    assert.equal(phaseStatusKind("CONCLUIDA"), "done");
    assert.equal(phaseStatusKind("SUSPENSA"), "suspended");
    assert.equal(taskStatusKind("CANCELADA"), "cancelled");
    assert.equal(taskStatusKind("EM_ANDAMENTO"), "in-progress");
    assert.equal(milestoneStatusKind("PENDENTE"), "not-started");
    assert.equal(milestoneStatusKind("ENTREGUE"), "delivered");
    assert.equal(milestoneStatusKind("APROVADO"), "done");
    assert.equal(milestoneStatusKind("AJUSTES_SOLICITADOS"), "adjustments");
    assert.equal(milestoneStatusKind("REJEITADO"), "rejected");
  });

  it("marco entregue continua em 0% até o aceite", () => {
    assert.equal(milestonePercent(milestone({ status: "ENTREGUE" })), 0);
    assert.equal(milestonePercent(milestone({ status: "APROVADO" })), 100);
  });
});

describe("andamento da fase", () => {
  it("usa o percentual da API mesmo sem datas planejadas", () => {
    const item = phase({ progressBasisPoints: 6333, dates: dates(none, none), tasks: [task({ dates: dates(none, none) })] });
    assert.deepEqual(phaseProgress(item), { kind: "value", basisPoints: 6333 });
  });

  it("fase sem itens informa a ausência de itens", () => {
    const empty = phase({ progressState: "EMPTY", progressBasisPoints: null });
    assert.deepEqual(phaseProgress(empty), { kind: "empty" });
    assert.equal(progressLabel(phaseProgress(empty)), "Sem itens subordinados");
  });

  it("fase só com canceladas não tem itens elegíveis", () => {
    const item = phase({ progressState: "NO_ELIGIBLE", progressBasisPoints: null });
    assert.equal(progressLabel(phaseProgress(item)), "Sem itens elegíveis");
  });
});

describe("atraso em aberto e atraso histórico", () => {
  const today = "2026-10-21";
  const finishedOn = (value: string) => [...dates(none, "16/10/2026, 12:00"), { label: "Fim realizado", value }];

  it("item em aberto com prazo vencido está atrasado", () => {
    assert.equal(taskIsOverdue(task({ dates: dates(none, "16/10/2026, 12:00") }), today), true);
    assert.equal(milestoneIsOverdue(milestone({ status: "ENTREGUE", dates: [{ label: "Data prevista", value: "16/10/2026, 12:00" }] }), today), true);
  });

  it("item concluído não é atrasado agora, mas registra conclusão após o prazo", () => {
    const late = task({ calculatedStatus: "CONCLUIDA", dates: finishedOn("18/10/2026, 12:00") });
    assert.equal(taskIsOverdue(late, today), false);
    assert.equal(finishedLate(late), true);
    assert.equal(finishedLate(task({ calculatedStatus: "CONCLUIDA", dates: finishedOn("15/10/2026, 12:00") })), false);
    assert.equal(finishedLate(task({ calculatedStatus: "CONCLUIDA", dates: finishedOn(none) })), false);
  });

  it("marco aceito usa a data realizada", () => {
    const accepted = milestone({
      status: "APROVADO",
      dates: [
        { label: "Data prevista", value: "16/10/2026, 12:00" },
        { label: "Data efetiva de conclusão", value: "20/10/2026, 12:00" },
      ],
    });
    assert.equal(milestoneIsOverdue(accepted, today), false);
    assert.equal(finishedLate(accepted), true);
  });

  it("separa o atraso aguardando análise do atraso com correção pendente", () => {
    const due = [{ label: "Data prevista", value: "16/10/2026, 12:00" }];
    assert.equal(milestoneDelayReason(milestone({ status: "ENTREGUE", dates: due }), today), "Aguardando análise");
    assert.equal(milestoneDelayReason(milestone({ status: "AJUSTES_SOLICITADOS", dates: due }), today), "Correção pendente");
    assert.equal(milestoneDelayReason(milestone({ status: "REJEITADO", dates: due }), today), "Correção pendente");
    assert.equal(milestoneDelayReason(milestone({ status: "PENDENTE", dates: due }), today), null);
    assert.equal(milestoneDelayReason(milestone({ status: "ENTREGUE" }), today), null);
  });

  it("ajustes e rejeição mantêm o marco em 0%", () => {
    assert.equal(milestonePercent(milestone({ status: "AJUSTES_SOLICITADOS" })), 0);
    assert.equal(milestonePercent(milestone({ status: "REJEITADO" })), 0);
  });
});
