import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ProjectListRow, ProjectMonitoringSignals } from "../projects/project-portfolio.ts";
import {
  attentionProjects,
  daysBetween,
  dashboardIndicators,
  portfolioPending,
  recentlyUpdated,
  relativeDayLabel,
  statusDistribution,
  supplierLoad,
  upcomingMilestones,
} from "./portfolio-dashboard.ts";

type Row = Pick<ProjectListRow, "id" | "name" | "status" | "situation" | "suppliers" | "updatedAt">;

function row(overrides: Partial<Row> & Pick<Row, "id">): Row {
  return {
    name: overrides.id,
    status: "EM_EXECUCAO",
    situation: { status: "EM_EXECUCAO", delayDays: 0, pendingValidation: 0, closureRequirementsMissing: false, readyForClosure: false },
    suppliers: [],
    updatedAt: "2026-11-01T12:00:00.000Z",
    ...overrides,
  };
}

function signal(overrides: Partial<ProjectMonitoringSignals> = {}): ProjectMonitoringSignals {
  return { openMilestones: [], overdueTasks: 0, overdueMilestones: 0, awaitingHomologation: 0, inCorrections: 0, ...overrides };
}

function milestone(id: string, plannedOn: string, overdue = false) {
  return { id, title: `Marco ${id}`, status: "PENDENTE", plannedOn, overdue, responsibleName: null };
}

describe("indicadores do Início", () => {
  it("conta total e situações calculadas, com a fração do portfólio", () => {
    const rows = [row({ id: "a" }), row({ id: "b", status: "CRITICO" }), row({ id: "c", status: null }), row({ id: "d", status: "CONCLUIDO" })];
    const byKey = Object.fromEntries(dashboardIndicators(rows).map((item) => [item.key, item]));
    assert.equal(byKey.total.value, 4);
    assert.equal(byKey.EM_EXECUCAO.value, 1);
    assert.equal(byKey.CRITICO.value, 1);
    assert.equal(byKey.EM_ATENCAO.value, 0);
    assert.equal(byKey.CONCLUIDO.share, 0.25);
  });

  it("portfólio vazio não divide por zero", () => {
    assert.ok(dashboardIndicators([]).every((item) => item.value === 0 && item.share === 0));
  });
});

describe("distribuição por situação", () => {
  it("ordena do crítico ao concluído e separa situações indisponíveis", () => {
    const result = statusDistribution([
      row({ id: "a", status: "CONCLUIDO" }),
      row({ id: "b", status: "CRITICO" }),
      row({ id: "c", status: "CRITICO" }),
      row({ id: "d", status: null }),
    ]);
    assert.deepEqual(result.segments.map((segment) => segment.status), ["CRITICO", "CONCLUIDO"]);
    assert.equal(result.known, 3);
    assert.equal(result.unavailable, 1);
    assert.equal(result.segments[0].share, 2 / 3);
  });
});

describe("projetos que exigem atenção", () => {
  it("lista críticos antes e, entre eles, o maior atraso primeiro", () => {
    const delayed = (id: string, status: "CRITICO" | "EM_ATENCAO", delayDays: number) =>
      row({ id, status, situation: { status, delayDays, pendingValidation: 0, closureRequirementsMissing: false, readyForClosure: false } });
    const result = attentionProjects([delayed("x", "EM_ATENCAO", 40), delayed("y", "CRITICO", 2), delayed("z", "CRITICO", 9), row({ id: "ok" })], 2);
    assert.equal(result.total, 3);
    assert.deepEqual(result.items.map((item) => item.id), ["z", "y"]);
  });
});

describe("projetos por fornecedor", () => {
  it("conta só projetos em curso e separa sem fornecedor e indisponíveis", () => {
    const result = supplierLoad([
      row({ id: "a", suppliers: ["Alfa"], status: "CRITICO" }),
      row({ id: "b", suppliers: ["Alfa", "Beta"] }),
      row({ id: "c", suppliers: ["Beta"], status: "CONCLUIDO" }),
      row({ id: "d", suppliers: [] }),
      row({ id: "e", suppliers: null }),
    ]);
    assert.deepEqual(result.items, [
      { name: "Alfa", total: 2, critical: 1, attention: 0 },
      { name: "Beta", total: 1, critical: 0, attention: 0 },
    ]);
    assert.equal(result.max, 2);
    assert.equal(result.withoutSupplier, 1);
    assert.equal(result.unavailable, 1);
  });
});

describe("próximos marcos", () => {
  it("ordena por data, ignora vencidos (contados à parte), concluídos e suspensos", () => {
    const rows = [row({ id: "a", name: "Projeto A" }), row({ id: "b", name: "Projeto B" }), row({ id: "s", status: "SUSPENSO" }), row({ id: "c", status: "CONCLUIDO" })];
    const signals = {
      a: signal({ openMilestones: [milestone("a1", "2026-11-20"), milestone("a0", "2026-10-01", true)] }),
      b: signal({ openMilestones: [milestone("b1", "2026-11-10")] }),
      s: signal({ openMilestones: [milestone("s1", "2026-11-11")] }),
      c: signal({ openMilestones: [milestone("c1", "2026-11-12")] }),
    };
    const result = upcomingMilestones(rows, signals, "2026-11-09");
    assert.deepEqual(result.items.map((item) => item.id), ["b1", "a1"]);
    assert.equal(result.items[0].daysUntil, 1);
    assert.equal(result.items[0].projectName, "Projeto B");
    assert.equal(result.overdue, 1);
  });
});

describe("pendências do portfólio", () => {
  it("soma os sinais dos projetos em curso e conta monitoramentos indisponíveis", () => {
    const ready = row({ id: "r", situation: { status: "EM_EXECUCAO", delayDays: 0, pendingValidation: 0, closureRequirementsMissing: false, readyForClosure: true } });
    const result = portfolioPending([row({ id: "a" }), row({ id: "b" }), ready, row({ id: "n" }), row({ id: "c", status: "CONCLUIDO" })], {
      a: signal({ overdueTasks: 2, awaitingHomologation: 1 }),
      b: signal({ overdueMilestones: 3, inCorrections: 1 }),
      r: signal(),
      n: null,
      c: signal({ overdueTasks: 99 }),
    });
    assert.deepEqual(result, { overdueTasks: 2, overdueMilestones: 3, awaitingHomologation: 1, inCorrections: 1, readyForClosure: 1, unavailable: 1 });
  });
});

describe("datas relativas", () => {
  it("calcula dias entre dias civis, inclusive na virada do mês", () => {
    assert.equal(daysBetween("2026-10-31", "2026-11-01"), 1);
    assert.equal(daysBetween("2026-11-09", "2026-11-02"), -7);
  });

  it("escreve rótulos curtos", () => {
    assert.deepEqual([0, 1, -1, 5, -3].map(relativeDayLabel), ["Hoje", "Amanhã", "Ontem", "Em 5 dias", "Há 3 dias"]);
  });

  it("atualizações recentes vêm da mais nova para a mais antiga", () => {
    const result = recentlyUpdated([row({ id: "old", updatedAt: "2026-01-01T00:00:00Z" }), row({ id: "new", updatedAt: "2026-11-08T00:00:00Z" })], 1);
    assert.deepEqual(result.map((item) => item.id), ["new"]);
  });
});
