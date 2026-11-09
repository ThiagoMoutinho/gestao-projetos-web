import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEADLINE_TONE_CLASS, deadlineBadge, deadlineIndicator } from "./deadline-situation.ts";

type Situation = Parameters<typeof deadlineBadge>[0];

function situation(overrides: Partial<Situation> = {}): Situation {
  return {
    status: "NO_PRAZO",
    hasDatedCommitments: true,
    overdueCommitments: 0,
    attentionItems: [],
    unevaluatedIndicators: ["DEPENDENCIES", "FORMAL_RISKS"],
    ...overrides,
  };
}

describe("Selo da situação do prazo", () => {
  it("apresenta os quatro estados", () => {
    const labels = (["CONCLUIDO", "ATRASADO", "EM_ATENCAO", "NO_PRAZO"] as const).map((status) => {
      const badge = deadlineBadge(situation({ status }));
      return [badge?.label, badge?.tone];
    });
    assert.deepEqual(labels, [
      ["Concluído", "success"],
      ["Atrasado", "danger"],
      ["Em atenção", "warning"],
      ["No prazo", "success"],
    ]);
  });

  it("sem compromissos datados, não apresenta o prazo como validado", () => {
    const badge = deadlineBadge(situation({ hasDatedCommitments: false }));
    assert.deepEqual([badge?.label, badge?.tone], ["Sem compromissos datados", "neutral"]);
  });

  it("projeto encerrado sem datas continua Concluído", () => {
    assert.equal(deadlineBadge(situation({ status: "CONCLUIDO", hasDatedCommitments: false }))?.label, "Concluído");
  });

  it("projeto suspenso não tem selo de prazo", () => {
    assert.equal(deadlineBadge(situation({ status: null })), null);
  });

  it("explica que dependências e riscos formais não foram avaliados", () => {
    assert.match(deadlineBadge(situation())?.hint ?? "", /não foram avaliados/);
  });
});

describe("Indicador de prazo da Visão Geral (mesma classificação do selo do Planejamento)", () => {
  const ready = (overrides: Partial<Situation> = {}) => ({ status: "ready" as const, data: { deadlineSituation: situation(overrides) } });
  const shown = (indicator: ReturnType<typeof deadlineIndicator>) => (indicator.kind === "badge" ? [indicator.badge.label, indicator.badge.tone] : indicator.kind);

  it("1. usa o mesmo selo (rótulo, cor e explicação) que o Planejamento, para cada situação", () => {
    for (const status of ["CONCLUIDO", "ATRASADO", "EM_ATENCAO", "NO_PRAZO"] as const) {
      const indicator = deadlineIndicator(ready({ status }));
      assert.equal(indicator.kind, "badge");
      assert.deepEqual(indicator.kind === "badge" ? indicator.badge : null, deadlineBadge(situation({ status })));
    }
  });

  it("2 a 5. projeto atrasado, em atenção, no prazo e concluído", () => {
    assert.deepEqual(shown(deadlineIndicator(ready({ status: "ATRASADO", overdueCommitments: 2 }))), ["Atrasado", "danger"]);
    assert.deepEqual(shown(deadlineIndicator(ready({ status: "EM_ATENCAO" }))), ["Em atenção", "warning"]);
    assert.deepEqual(shown(deadlineIndicator(ready({ status: "NO_PRAZO" }))), ["No prazo", "success"]);
    assert.deepEqual(shown(deadlineIndicator(ready({ status: "CONCLUIDO" }))), ["Concluído", "success"]);
  });

  it("6. sem compromissos datados, não diz que o prazo foi validado", () => {
    assert.deepEqual(shown(deadlineIndicator(ready({ status: "NO_PRAZO", hasDatedCommitments: false }))), ["Sem compromissos datados", "neutral"]);
  });

  it("7. projeto suspenso (status nulo) não mostra o indicador", () => {
    assert.equal(deadlineIndicator(ready({ status: null })).kind, "hidden");
  });

  it("8 e 9. carregando é estado neutro e falha é indisponível, sem classificação alguma", () => {
    assert.equal(deadlineIndicator({ status: "loading" }).kind, "loading");
    assert.equal(deadlineIndicator({ status: "error" }).kind, "unavailable");
  });

  it("toda cor de selo tem classe definida", () => {
    for (const tone of ["success", "warning", "danger", "neutral"] as const) {
      assert.ok(DEADLINE_TONE_CLASS[tone].length > 0);
    }
  });
});
