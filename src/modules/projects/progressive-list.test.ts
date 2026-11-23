import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextVisibleCount, TIMELINE_PAGE, visibleCount } from "./progressive-list.ts";

describe("lista progressiva da linha do tempo", () => {
  it("o primeiro lote é de 15 e nunca passa do total", () => {
    assert.equal(TIMELINE_PAGE, 15);
    assert.equal(visibleCount(0, 46), 15);
    assert.equal(visibleCount(0, 7), 7);
    assert.equal(visibleCount(0, 0), 0);
  });
  it("cada carga soma 15 até o total", () => {
    assert.equal(nextVisibleCount(15, 46), 30);
    assert.equal(nextVisibleCount(30, 46), 45);
    assert.equal(nextVisibleCount(45, 46), 46);
    assert.equal(nextVisibleCount(46, 46), 46);
  });
  it("se o total encolhe (recarga), a lista se ajusta", () => {
    assert.equal(visibleCount(45, 20), 20);
  });
  it("valores inválidos não quebram", () => {
    assert.equal(nextVisibleCount(Number.NaN, 46), 15);
    assert.equal(nextVisibleCount(-5, 46), 15);
    assert.equal(visibleCount(Number.NaN, 46), 15);
    assert.equal(nextVisibleCount(10, Number.NaN), 0);
  });
});

describe("carregamento progressivo não duplica nem reordena", () => {
  const events = Array.from({ length: 46 }, (_, index) => ({ id: `e${index}` }));
  it("cada passo mostra um prefixo da lista original, na mesma ordem e sem repetição", () => {
    let loaded = 0;
    let previous: string[] = [];
    for (let step = 0; step < 6; step += 1) {
      const shown = visibleCount(loaded, events.length);
      const ids = events.slice(0, shown).map((event) => event.id);
      assert.deepEqual(ids, events.slice(0, ids.length).map((event) => event.id));
      assert.equal(new Set(ids).size, ids.length);
      assert.deepEqual(ids.slice(0, previous.length), previous);
      previous = ids;
      loaded = nextVisibleCount(shown, events.length);
    }
    assert.equal(previous.length, 46);
  });
});
