import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mergeAllMilestones } from "./milestone-order.ts";

const m = (id: string, status: string, date: string | null = null) => ({ id, status, date });

describe("Aba Todos dos marcos", () => {
  it("lista cada marco uma única vez, mesmo que apareça em mais de uma lista ou tenha várias tentativas", () => {
    const entregue = m("a", "ENTREGUE", "2026-10-20");
    const result = mergeAllMilestones([entregue], [m("a", "PENDENTE", "2026-11-01")], [m("b", "APROVADO", "2026-10-10")]);
    assert.deepEqual(result.map((item) => item.id), ["a", "b"]);
    assert.equal(result[0].status, "ENTREGUE");
  });

  it("o total é o número de marcos distintos (pendentes, próximos, aprovados e com correção)", () => {
    const result = mergeAllMilestones(
      [m("a", "ENTREGUE", "2026-10-20"), m("b", "AJUSTES_SOLICITADOS", "2026-10-21")],
      [m("c", "APROVADO", "2026-10-01"), m("d", "REJEITADO", "2026-10-05")],
      [m("e", "PENDENTE", "2026-12-01")],
      [m("f", "PENDENTE", null)],
    );
    assert.equal(result.length, 6);
  });

  it("ordena: em análise, correções, rejeitados, planejados por data (sem data por último) e aprovados mais recentes primeiro", () => {
    const result = mergeAllMilestones([
      m("aprovado-antigo", "APROVADO", "2026-09-01"),
      m("sem-data", "PENDENTE", null),
      m("planejado-tarde", "PENDENTE", "2026-12-20"),
      m("aprovado-recente", "APROVADO", "2026-10-15"),
      m("planejado-cedo", "PENDENTE", "2026-11-05"),
      m("rejeitado", "REJEITADO", "2026-10-02"),
      m("correcao", "AJUSTES_SOLICITADOS", "2026-10-10"),
      m("analise", "ENTREGUE", "2026-10-12"),
    ]);
    assert.deepEqual(result.map((item) => item.id), [
      "analise",
      "correcao",
      "rejeitado",
      "planejado-cedo",
      "planejado-tarde",
      "sem-data",
      "aprovado-recente",
      "aprovado-antigo",
    ]);
  });

  it("sem marcos devolve lista vazia", () => {
    assert.deepEqual(mergeAllMilestones([], []), []);
  });
});
