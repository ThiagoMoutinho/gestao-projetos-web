import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { markdownLength, safeUrl } from "./rich-text.ts";

describe("safeUrl", () => {
  it("aceita http, https e mailto", () => {
    assert.equal(safeUrl("https://igepps.pa.gov.br/a?b=1"), "https://igepps.pa.gov.br/a?b=1");
    assert.equal(safeUrl("http://exemplo.com"), "http://exemplo.com/");
    assert.equal(safeUrl("mailto:equipe@exemplo.com"), "mailto:equipe@exemplo.com");
  });

  it("completa endereços sem protocolo com https", () => {
    assert.equal(safeUrl("www.exemplo.com/pagina"), "https://www.exemplo.com/pagina");
  });

  it("recusa protocolos perigosos, espaços e vazio", () => {
    assert.equal(safeUrl("javascript:alert(1)"), null);
    assert.equal(safeUrl("JaVaScRiPt:alert(1)"), null);
    assert.equal(safeUrl("data:text/html;base64,AAAA"), null);
    assert.equal(safeUrl("vbscript:x"), null);
    assert.equal(safeUrl("  "), null);
    assert.equal(safeUrl("ht tp://x"), null);
  });
});

describe("markdownLength", () => {
  it("conta o Markdown persistido, sem espaços nas pontas", () => {
    assert.equal(markdownLength("  **ab**  "), 6);
    assert.equal(markdownLength("- a\n- b"), 7);
  });
});
