import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  actualDatesProblem,
  actualDivergence,
  correctsActualDate,
  deadlineIndicator,
  deadlinePerformance,
  phaseCoverage,
  planDivergence,
  spanOf,
  wasRescheduled,
} from "./eap-deadline.ts";

describe("Planejamento gravado × datas consolidadas dos itens", () => {
  const plan = { startAt: "2026-06-01T12:00:00.000-03:00", endAt: "2026-06-30T12:00:00.000-03:00" };

  it("não sinaliza quando os itens cabem exatamente no planejamento ou não têm datas", () => {
    assert.equal(planDivergence(plan, plan), null);
    assert.equal(planDivergence(plan, { startAt: null, endAt: null }), null);
  });

  it("identifica itens que terminam depois do término planejado sem alterar o planejamento", () => {
    const result = planDivergence(plan, { startAt: plan.startAt, endAt: "2026-07-15T12:00:00.000-03:00" });
    assert.deepEqual(result, { noPlan: false, start: false, end: true, itemsEndLater: true });
    assert.equal(plan.endAt, "2026-06-30T12:00:00.000-03:00");
  });

  it("identifica fase sem planejamento gravado com itens datados", () => {
    assert.deepEqual(planDivergence({ startAt: null, endAt: null }, plan), { noPlan: true, start: false, end: false, itemsEndLater: false });
  });
});

describe("Ajuste em cascata da fase", () => {
  it("estende só o lado que o item ultrapassa e ignora item dentro da fase", () => {
    const phase = { start: "2026-10-05", end: "2026-10-21" };
    assert.deepEqual(phaseCoverage(phase, { start: "", end: "2026-10-26" }), { start: "2026-10-05", end: "2026-10-26" });
    assert.deepEqual(phaseCoverage(phase, { start: "2026-10-01", end: "2026-10-10" }), { start: "2026-10-01", end: "2026-10-21" });
    assert.equal(phaseCoverage(phase, { start: "2026-10-06", end: "2026-10-20" }), null);
  });

  it("o período consolidado considera todos os itens, independentemente da ordem", () => {
    const items = [
      { start: "2026-10-10", end: "2026-10-18" },
      { start: "", end: "2026-10-26" },
      { start: "2026-10-03", end: "2026-10-12" },
    ];
    assert.deepEqual(spanOf(items), { start: "2026-10-03", end: "2026-10-26" });
    assert.deepEqual(spanOf([...items].reverse()), { start: "2026-10-03", end: "2026-10-26" });
    assert.deepEqual(spanOf([]), { start: "", end: "" });
  });

  it("fase sem início mantém o início vazio; fase sem datas recebe o período do item", () => {
    assert.deepEqual(phaseCoverage({ start: "", end: "2026-10-21" }, { start: "", end: "2026-10-26" }), { start: "", end: "2026-10-26" });
    assert.deepEqual(phaseCoverage({ start: "", end: "" }, { start: "2026-10-01", end: "2026-10-09" }), { start: "2026-10-01", end: "2026-10-09" });
  });
});

describe("Datas reais registradas × consolidadas dos itens", () => {
  const recorded = { startAt: "2026-06-05T12:00:00.000-03:00", endAt: null };

  it("sinaliza divergência só quando as duas datas existem e diferem", () => {
    assert.deepEqual(actualDivergence(recorded, { startAt: "2026-06-02T12:00:00.000-03:00", endAt: null }), { start: true, end: false });
    assert.equal(actualDivergence(recorded, { startAt: recorded.startAt, endAt: null }), null);
    assert.equal(actualDivergence({ startAt: null, endAt: null }, { startAt: recorded.startAt, endAt: null }), null);
  });
});

const day = (value: string) => `${value}T12:00:00.000-03:00`;
const original = day("2026-06-30");
const rescheduled = day("2026-07-20");

describe("Cumprimento de prazo", () => {
  it("diferencia conclusão no prazo original, no reprogramado e com atraso", () => {
    const done = (actual: string) =>
      deadlinePerformance("DONE", { baselineEndAt: original, plannedEndAt: rescheduled, actualEndAt: day(actual) });

    assert.equal(done("2026-06-30"), "DONE_ON_ORIGINAL");
    assert.equal(done("2026-07-10"), "DONE_ON_RESCHEDULED");
    assert.equal(done("2026-07-21"), "DONE_LATE");
  });

  it("não apresenta a conclusão no prazo reprogramado como se não houvesse atraso", () => {
    const indicator = deadlineIndicator(
      deadlinePerformance("DONE", { baselineEndAt: original, plannedEndAt: rescheduled, actualEndAt: day("2026-07-10") }),
    );

    assert.equal(indicator?.label, "Conclusão no prazo reprogramado");
    assert.notEqual(indicator?.tone, "good");
  });

  it("diferencia execução no prazo, no prazo reprogramado e vencida", () => {
    const open = (today: string) =>
      deadlinePerformance("OPEN", { baselineEndAt: original, plannedEndAt: rescheduled, actualEndAt: null }, today);

    assert.equal(open("2026-06-15"), "OPEN_ON_TIME");
    assert.equal(open("2026-07-05"), "OPEN_ON_RESCHEDULED");
    assert.equal(open("2026-07-21"), "OPEN_OVERDUE");
  });

  it("não classifica itens cancelados, sem prazo ou concluídos sem data real", () => {
    assert.equal(deadlinePerformance("CLOSED", { baselineEndAt: original, plannedEndAt: original, actualEndAt: null }), null);
    assert.equal(deadlinePerformance("OPEN", { baselineEndAt: null, plannedEndAt: null, actualEndAt: null }), null);
    assert.equal(deadlinePerformance("DONE", { baselineEndAt: original, plannedEndAt: original, actualEndAt: null }), null);
  });

  it("identifica reprogramação pela diferença entre vigente e original", () => {
    assert.equal(wasRescheduled({ baselineEndAt: original, plannedEndAt: rescheduled }), true);
    assert.equal(wasRescheduled({ baselineEndAt: original, plannedEndAt: original }), false);
    assert.equal(wasRescheduled({ baselineEndAt: null, plannedEndAt: original }), false);
  });
});

describe("Validação de datas reais", () => {
  const today = "2026-07-01";

  it("exige início e término apenas na conclusão", () => {
    assert.equal(actualDatesProblem({ start: "2026-06-02", end: "", today }), null);
    assert.match(actualDatesProblem({ start: "2026-06-02", end: "", today, requireBoth: true }) ?? "", /Para concluir/);
  });

  it("aceita datas antes ou depois do planejado, mas não futuras nem invertidas", () => {
    assert.equal(actualDatesProblem({ start: "2026-01-02", end: "2026-06-30", today }), null);
    assert.match(actualDatesProblem({ start: "2026-06-02", end: "2026-07-02", today }) ?? "", /futuro/);
    assert.match(actualDatesProblem({ start: "2026-06-10", end: "2026-06-05", today }) ?? "", /anterior/);
    assert.match(actualDatesProblem({ start: "", end: "2026-06-05", today }) ?? "", /exige uma data real de início/);
  });

  it("considera correção apenas a alteração de data já registrada", () => {
    assert.equal(correctsActualDate("", "2026-06-02"), false);
    assert.equal(correctsActualDate("2026-06-02", "2026-06-02"), false);
    assert.equal(correctsActualDate("2026-06-02", "2026-06-04"), true);
    assert.equal(correctsActualDate("2026-06-02", ""), true);
  });
});
