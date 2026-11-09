import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { actualProjectRange, buildAxis, daysAgo, matchesFilter, phaseRows, type ScheduleItem } from "./cronograma.ts";

const item = (overrides: Partial<ScheduleItem>): ScheduleItem => ({
  entityType: "TASK",
  entityId: "t1",
  phaseId: "p1",
  title: "Item",
  status: "EM_ANDAMENTO",
  baselineStartAt: null,
  baselineEndAt: null,
  plannedStartAt: null,
  plannedEndAt: null,
  actualStartAt: null,
  actualEndAt: null,
  overdue: false,
  rescheduleCount: 0,
  ...overrides,
});

const phase = { id: "p1", name: "Levantamento", progressBasisPoints: 7850, tasks: 3, impediments: 1 };

describe("Cronograma: linhas por fase", () => {
  it("usa as datas da própria fase e arredonda o progresso", () => {
    const rows = phaseRows(
      [phase],
      [
        item({
          entityType: "PHASE",
          entityId: "p1",
          status: "CONCLUIDA",
          baselineStartAt: "2026-10-16T12:00:00.000-03:00",
          baselineEndAt: "2026-10-20T12:00:00.000-03:00",
          plannedStartAt: "2026-10-16T12:00:00.000-03:00",
          plannedEndAt: "2026-10-25T12:00:00.000-03:00",
          actualStartAt: "2026-10-16T12:00:00.000-03:00",
        }),
      ],

    );
    assert.equal(rows[0].baseline.end, "2026-10-20");
    assert.equal(rows[0].current.end, "2026-10-25");
    assert.equal(rows[0].actual.start, "2026-10-16");
    assert.equal(rows[0].tone, "done");
    assert.equal(rows[0].progressPercent, 79);
    assert.equal(rows[0].tasks, 3);
  });

  it("sem datas na fase, usa o intervalo das tarefas e marcos; cancelados não entram", () => {
    const rows = phaseRows(
      [phase],
      [
        item({ entityId: "a", plannedStartAt: "2026-10-10T12:00:00.000-03:00", plannedEndAt: "2026-10-12T12:00:00.000-03:00" }),
        item({ entityId: "b", plannedEndAt: "2026-10-30T12:00:00.000-03:00" }),
        item({ entityId: "c", status: "CANCELADA", plannedEndAt: "2027-01-01T12:00:00.000-03:00" }),
      ],

    );
    assert.deepEqual(rows[0].current, { start: "2026-10-10", end: "2026-10-30" });
  });

  it("marcos: estados e contagem aguardando validação; fase atrasada vem da API", () => {
    const rows = phaseRows(
      [phase],
      [
        item({ entityType: "PHASE", entityId: "p1", overdue: true }),
        item({ entityType: "MILESTONE", entityId: "m1", title: "Aceite", status: "APROVADO", plannedEndAt: "2026-10-25T12:00:00.000-03:00" }),
        item({ entityType: "MILESTONE", entityId: "m2", title: "Teste", status: "ENTREGUE", plannedEndAt: "2026-10-22T12:00:00.000-03:00", rescheduleCount: 1 }),
        item({ entityType: "MILESTONE", entityId: "m3", title: "Sem data", status: "PENDENTE" }),
      ],

    );
    assert.equal(rows[0].tone, "overdue");
    assert.deepEqual(rows[0].milestones.map((mark) => [mark.id, mark.state, mark.rescheduled]), [["m2", "awaiting", true], ["m1", "done", false]]);
    assert.equal(rows[0].awaitingMilestones, 1);
  });
});

describe("Cronograma: eixo e totais", () => {
  const rows = phaseRows(
    [phase],
    [item({ entityType: "PHASE", entityId: "p1", baselineStartAt: "2026-10-16T12:00:00.000-03:00", plannedEndAt: "2026-10-31T12:00:00.000-03:00" })],

  );

  it("cobre todas as datas e posiciona hoje só dentro do eixo", () => {
    const axis = buildAxis(rows, "2026-10-24");
    assert.ok(axis);
    assert.equal(axis.from, "2026-10-16");
    assert.equal(axis.to, "2026-10-31");
    assert.equal(axis.position("2026-10-16"), 0);
    assert.equal(axis.position("2026-10-31"), 100);
    assert.ok(axis.today !== null && axis.today > 0 && axis.today < 100);
    assert.equal(buildAxis(rows, "2026-12-01")?.today, null);
    assert.equal(axis.ticks.length, 5);
  });

  it("sem datas não há eixo", () => {
    assert.equal(buildAxis(phaseRows([phase], []), "2026-10-24"), null);
  });

  it("início e término reais do projeto vêm dos itens (não das fases)", () => {
    const range = actualProjectRange([
      item({ actualStartAt: "2026-10-17T12:00:00.000-03:00", actualEndAt: "2026-10-20T12:00:00.000-03:00" }),
      item({ entityId: "z", actualStartAt: "2026-10-16T12:00:00.000-03:00" }),
      item({ entityType: "PHASE", entityId: "p1", actualStartAt: "2020-01-01T12:00:00.000-03:00" }),
    ]);
    assert.deepEqual(range, { start: "2026-10-16", end: "2026-10-20" });
  });

  it("há quantos dias e filtros do histórico", () => {
    assert.equal(daysAgo("2026-11-01T12:00:00.000-03:00", "2026-11-07"), 6);
    assert.equal(daysAgo(null, "2026-11-07"), null);
    const legacy = { source: "LEGACY_DIRECT", status: "EFETIVADA_DIRETAMENTE" };
    const pending = { source: "REQUEST", status: "PENDENTE" };
    const initial = { source: "INITIAL_DEFINITION", status: "DEFINIDA" };
    assert.deepEqual([legacy, pending, initial].map((entry) => matchesFilter(entry, "EFFECTIVE")), [true, false, false]);
    assert.deepEqual([legacy, pending, initial].map((entry) => matchesFilter(entry, "PENDING")), [false, true, false]);
    assert.deepEqual([legacy, pending, initial].map((entry) => matchesFilter(entry, "INITIAL")), [false, false, true]);
    assert.equal(matchesFilter({ source: "REQUEST", status: "REJEITADA" }, "REJECTED"), true);
  });
});
