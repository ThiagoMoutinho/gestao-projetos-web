import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dedupeSectors, formatSectors, parseSectors, splitVisible } from "./institutional-sectors.ts";

describe("Setores beneficiados", () => {
  it("lê o texto salvo ignorando vazios e espaços", () => {
    assert.deepEqual(parseSectors("CTIN,  Jurídico ,, RH\nFinanceiro"), ["CTIN", "Jurídico", "RH", "Financeiro"]);
    assert.deepEqual(parseSectors(null), []);
    assert.deepEqual(parseSectors(""), []);
  });

  it("impede repetidos sem diferenciar maiúsculas e minúsculas, mantendo a primeira grafia", () => {
    assert.deepEqual(dedupeSectors(["CTIN", "ctin", " Ctin ", "RH"]), ["CTIN", "RH"]);
    assert.deepEqual(dedupeSectors(["Gestão  de Pessoas", "gestão de pessoas"]), ["Gestão de Pessoas"]);
  });

  it("grava e lê o mesmo conjunto", () => {
    const text = formatSectors(["CTIN", "RH", "ctin"]);
    assert.equal(text, "CTIN, RH");
    assert.deepEqual(parseSectors(text), ["CTIN", "RH"]);
  });

  it("mostra até quatro setores e conta os demais", () => {
    assert.deepEqual(splitVisible(["a", "b", "c", "d", "e", "f"]), { visible: ["a", "b", "c", "d"], hidden: 2 });
    assert.deepEqual(splitVisible(["a", "b"]), { visible: ["a", "b"], hidden: 0 });
  });
});
