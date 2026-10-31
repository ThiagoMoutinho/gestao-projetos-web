import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { projectProgress } from "./eap-progress.ts";

describe("Andamento consolidado do projeto", () => {
  it("é a média simples das fases com valor, igual ao cálculo da API (eap-status.projectProgress)", () => {
    // Os mesmos valores são verificados na API (executive-summary.test.ts): 100%, 50% e uma fase sem itens.
    const result = projectProgress([
      { progressState: "VALUE", progressBasisPoints: 10000 },
      { progressState: "VALUE", progressBasisPoints: 5000 },
      { progressState: "EMPTY", progressBasisPoints: null },
    ] as never);
    assert.deepEqual(result, { kind: "value", basisPoints: 7500, coverageBasis: 6667 });
  });

  it("sem fases calculáveis não há valor, e sem fases a cobertura é nula", () => {
    assert.deepEqual(projectProgress([{ progressState: "EMPTY", progressBasisPoints: null }] as never), { kind: "none", coverageBasis: 0 });
    assert.deepEqual(projectProgress([]), { kind: "none", coverageBasis: null });
  });
});
