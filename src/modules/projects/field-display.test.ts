import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { meaningfulText } from "./field-display.ts";

describe("meaningfulText", () => {
  it("devolve o texto quando há conteúdo útil", () => {
    assert.equal(meaningfulText("  Escopo do projeto  "), "Escopo do projeto");
    assert.equal(meaningfulText("**Fase 1**"), "**Fase 1**");
    assert.equal(meaningfulText("42"), "42");
  });

  it("trata vazio, espaços, símbolos soltos e caractere único como não informado", () => {
    for (const value of [null, undefined, "", "   ", "-", "\\", ".", "l", "I", "- -", "**", "—"]) {
      assert.equal(meaningfulText(value), null, String(value));
    }
  });
});
