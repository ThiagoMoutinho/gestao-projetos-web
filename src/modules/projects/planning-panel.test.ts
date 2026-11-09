import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  baselineDeviation,
  buildTimeline,
  completeness,
  consolidateSchedule,
  daysBetween,
  doneLateCount,
  milestoneProgress,
  projectPlanDivergence,
  requiredFields,
  timelineMilestones,
  type PlanningItem,
} from "./planning-panel.ts";

const at = (day: string) => `${day}T15:00:00.000Z`;

function item(overrides: Partial<PlanningItem> & Pick<PlanningItem, "entityType" | "entityId">): PlanningItem {
  return {
    title: overrides.entityId,
    status: "PENDENTE",
    baselineStartAt: null,
    baselineEndAt: null,
    plannedStartAt: null,
    plannedEndAt: null,
    overdue: false,
    rescheduleCount: 0,
    ...overrides,
  };
}

describe("consolidação de datas do projeto", () => {
  it("usa tarefas e marcos, separando a linha de base do prazo vigente", () => {
    const schedule = consolidateSchedule([
      item({
        entityType: "TASK",
        entityId: "t1",
        baselineStartAt: at("2030-02-01"),
        baselineEndAt: at("2030-03-01"),
        plannedStartAt: at("2030-02-01"),
        plannedEndAt: at("2030-03-20"),
      }),
      item({ entityType: "MILESTONE", entityId: "m1", baselineEndAt: at("2030-04-01"), plannedEndAt: at("2030-04-15") }),
    ]);
    assert.deepEqual(schedule.baseline, { start: "2030-02-01", end: "2030-04-01" });
    assert.deepEqual(schedule.current, { start: "2030-02-01", end: "2030-04-15" });
    assert.equal(schedule.commitments, 2);
    assert.equal(baselineDeviation(schedule), 14);
  });

  it("ignora fases (contêineres) e tarefas canceladas", () => {
    const schedule = consolidateSchedule([
      item({ entityType: "PHASE", entityId: "f1", baselineEndAt: at("2031-12-31"), plannedStartAt: at("2029-01-01"), plannedEndAt: at("2031-12-31") }),
      item({ entityType: "TASK", entityId: "t1", status: "CANCELADA", plannedStartAt: at("2035-01-01"), plannedEndAt: at("2035-02-01") }),
      item({ entityType: "TASK", entityId: "t2", plannedStartAt: at("2030-05-01"), plannedEndAt: at("2030-05-10") }),
    ]);
    assert.deepEqual(schedule.current, { start: "2030-05-01", end: "2030-05-10" });
    assert.equal(schedule.commitments, 1);
  });

  it("não inventa datas: sem datas, vazio e sem desvio; sem linha de base, sem desvio", () => {
    const empty = consolidateSchedule([item({ entityType: "TASK", entityId: "t1" })]);
    assert.deepEqual(empty.current, { start: null, end: null });
    assert.deepEqual(empty.baseline, { start: null, end: null });
    assert.equal(empty.commitments, 0);
    assert.equal(baselineDeviation(empty), null);

    const noBaseline = consolidateSchedule([item({ entityType: "TASK", entityId: "t1", plannedStartAt: at("2030-01-01"), plannedEndAt: at("2030-01-10") })]);
    assert.equal(baselineDeviation(noBaseline), null);
  });

  it("não usa datas reais: o item não carrega datas reais e o desvio negativo indica antecipação", () => {
    const schedule = consolidateSchedule([
      item({ entityType: "TASK", entityId: "t1", baselineEndAt: at("2030-03-10"), plannedEndAt: at("2030-03-05") }),
    ]);
    assert.equal(baselineDeviation(schedule), -5);
    assert.equal(daysBetween("2030-03-10", "2030-03-10"), 0);
  });

  it("só sinaliza divergência quando o projeto tem planejamento gravado diferente do consolidado", () => {
    const schedule = consolidateSchedule([
      item({ entityType: "TASK", entityId: "t1", plannedStartAt: at("2030-02-01"), plannedEndAt: at("2030-03-20") }),
    ]);
    assert.equal(projectPlanDivergence({ plannedStartAt: null, plannedEndAt: null }, schedule), null);
    assert.equal(projectPlanDivergence({ plannedStartAt: at("2030-02-01"), plannedEndAt: at("2030-03-20") }, schedule), null);
    const divergence = projectPlanDivergence({ plannedStartAt: at("2030-02-01"), plannedEndAt: at("2030-02-28") }, schedule);
    assert.equal(divergence?.end, true);
    assert.equal(divergence?.itemsEndLater, true);
  });
});

describe("marcos e linha do tempo", () => {
  const milestones = [
    item({ entityType: "MILESTONE", entityId: "m1", status: "APROVADO", plannedEndAt: at("2030-03-01") }),
    item({ entityType: "MILESTONE", entityId: "m2", status: "ENTREGUE", plannedEndAt: at("2030-04-01") }),
    item({ entityType: "MILESTONE", entityId: "m3", status: "PENDENTE", overdue: true, plannedEndAt: at("2030-02-01"), rescheduleCount: 2 }),
    item({ entityType: "MILESTONE", entityId: "m4", status: "PENDENTE", plannedEndAt: at("2030-05-01") }),
    item({ entityType: "MILESTONE", entityId: "m5", status: "PENDENTE", plannedEndAt: at("2030-06-01") }),
    item({ entityType: "MILESTONE", entityId: "m6", status: "PENDENTE" }),
  ];

  it("classifica concluído, em validação, atrasado e pendente; a próxima entrega segue o critério único; sem data não aparece", () => {
    const result = timelineMilestones(milestones);
    assert.deepEqual(
      result.map((entry) => [entry.id, entry.state, entry.next]),
      [
        ["m3", "overdue", true],
        ["m1", "done", false],
        ["m2", "awaiting", false],
        ["m4", "pending", false],
        ["m5", "pending", false],
      ],
    );
    assert.equal(result[0].rescheduled, true);
  });

  it("conta marcos concluídos sobre o total (inclui os sem data)", () => {
    assert.deepEqual(milestoneProgress(milestones), { done: 1, total: 6 });
  });

  it("monta o eixo comum e posiciona Hoje apenas dentro dele", () => {
    const schedule = {
      baseline: { start: "2030-01-01", end: "2030-01-31" },
      current: { start: "2030-01-01", end: "2030-03-02" },
    };
    const timeline = buildTimeline(schedule, [], "2030-01-31");
    assert.ok(timeline);
    assert.equal(timeline.from, "2030-01-01");
    assert.equal(timeline.to, "2030-03-02");
    assert.equal(Math.round(timeline.position("2030-01-31")), 50);
    assert.equal(Math.round(timeline.today ?? -1), 50);
    assert.equal(buildTimeline(schedule, [], "2031-01-01")?.today, null);
    assert.equal(buildTimeline({ baseline: { start: null, end: null }, current: { start: null, end: null } }, [], "2030-01-01"), null);
  });
});

describe("atrasos históricos", () => {
  it("conta só os itens concluídos depois do prazo vigente, sem contar os abertos nem os concluídos no prazo", () => {
    const items = [
      { deadlinePerformance: "DONE_LATE" },
      { deadlinePerformance: "DONE_LATE" },
      { deadlinePerformance: "DONE_ON_ORIGINAL" },
      { deadlinePerformance: "DONE_ON_RESCHEDULED" },
      { deadlinePerformance: "OPEN_OVERDUE" },
      { deadlinePerformance: null },
      {},
    ];
    assert.equal(doneLateCount(items), 2);
    assert.equal(doneLateCount([]), 0);
  });
});

describe("campos obrigatórios e preenchimento", () => {
  const filledContext = { PROBLEM: "Atendimento lento nas filas.", PURPOSE: "Reduzir o tempo de espera.", SCOPE: "Módulo de triagem." };
  const allMembers = [{ role: "GESTOR" }, { role: "RESPONSAVEL_TECNICO" }, { role: "FORNECEDOR" }];

  it("são oito campos e o patrocinador permanece pendente de implementação estrutural", () => {
    const fields = requiredFields({ context: filledContext, schedule: { milestonesWithDate: 2, hasCurrentEnd: true }, members: allMembers });
    assert.equal(fields.length, 8);
    assert.equal(fields.find((field) => field.id === "SPONSOR")?.state, "structural");
    const result = completeness(fields);
    assert.equal(result.filled, 7);
    assert.equal(result.percent, 88);
    assert.deepEqual(result.pending.map((field) => field.id), ["SPONSOR"]);
  });

  it("nenhum outro papel substitui o patrocinador", () => {
    const fields = requiredFields({
      context: filledContext,
      schedule: { milestonesWithDate: 1, hasCurrentEnd: true },
      members: [...allMembers, { role: "DONO_PROJETO" }, { role: "PO" }, { role: "OBSERVADOR" }],
    });
    assert.equal(fields.find((field) => field.id === "SPONSOR")?.state, "structural");
  });

  it("critérios objetivos: texto sem conteúdo, prazo sem marco datado e papéis ausentes ficam pendentes", () => {
    const fields = requiredFields({
      context: { PROBLEM: "  ", PURPOSE: "-", SCOPE: null },
      schedule: { milestonesWithDate: 0, hasCurrentEnd: true },
      members: [{ role: "GESTOR" }],
    });
    const states = Object.fromEntries(fields.map((field) => [field.id, field.state]));
    assert.deepEqual(states, {
      PROBLEM: "pending",
      PURPOSE: "pending",
      SCOPE: "pending",
      SCHEDULE: "pending",
      MANAGER: "filled",
      SPONSOR: "structural",
      TECHNICAL_LEAD: "pending",
      SUPPLIER: "pending",
    });
    assert.equal(completeness(fields).percent, 13);
  });

  it("dados indisponíveis não geram percentual parcial", () => {
    const fields = requiredFields({ context: null, schedule: null, members: null });
    assert.equal(fields.filter((field) => field.state === "unknown").length, 7);
    assert.equal(completeness(fields).percent, null);
  });
});
