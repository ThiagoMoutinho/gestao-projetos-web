import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DEFAULT_WIDGETS, moveWidget, normalizeWidgets, placeWidgets, rowsOf, SECONDARY_WIDGETS } from "./overview-layout.ts";

const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe("Layout da Visão Geral (grid de 12 colunas, por linhas)", () => {
  it("o padrão segue a referência: Resumo | Linha do tempo, Marcos | Evidências, Planejamento (total), Sobre | Equipe e os demais ao final", () => {
    assert.deepEqual(ids(DEFAULT_WIDGETS), ["resumo", "historico", "marcos", "evidencias", "planejamento", "sobre", "equipe"]);
    const placed = placeWidgets(DEFAULT_WIDGETS);
    assert.deepEqual(placed.map((item) => item.span), [6, 6, 6, 6, 12, 6, 6]);
      });

  it("Resultados, Situação e Evoluções ficam fora do padrão, mas continuam em layouts salvos que os incluem", () => {
    assert.deepEqual(SECONDARY_WIDGETS, ["situacao", "evolucoes"]);
    assert.equal(DEFAULT_WIDGETS.some((item) => SECONDARY_WIDGETS.includes(item.id)), false);
    const saved = normalizeWidgets([{ id: "resultados", wide: true }, { id: "sobre", wide: false }]);
    assert.deepEqual(saved.slice(0, 2), [{ id: "resultados", wide: true }, { id: "sobre", wide: false }]);
  });

  it("sem layout salvo usa o padrão; layouts antigos continuam válidos (altura salva é ignorada)", () => {
    assert.deepEqual(normalizeWidgets(null), DEFAULT_WIDGETS);
    const old = normalizeWidgets([{ id: "marcos", wide: true, height: "alta" } as { id: string; wide: boolean }, { id: "sobre", wide: false }]);
    assert.deepEqual(old.slice(0, 2), [{ id: "marcos", wide: true }, { id: "sobre", wide: false }]);
    assert.equal(old.length, DEFAULT_WIDGETS.length);
  });

  it("ignora ids desconhecidos ou repetidos e completa os que faltam, mantendo a ordem salva", () => {
    const result = normalizeWidgets([
      { id: "marcos", wide: true },
      { id: "inexistente", wide: false },
      { id: "marcos", wide: false },
      { id: "sobre", wide: false },
    ]);
    assert.deepEqual(ids(result).slice(0, 2), ["marcos", "sobre"]);
    assert.equal(result[0].wide, true);
    assert.equal(new Set(ids(result)).size, DEFAULT_WIDGETS.length);
  });

  it("move um widget sem perder nenhum e ignora índices inválidos", () => {
    const moved = moveWidget(DEFAULT_WIDGETS, 0, 2);
    assert.deepEqual(ids(moved).slice(0, 3), ["historico", "marcos", "resumo"]);
    assert.equal(moved.length, DEFAULT_WIDGETS.length);
    assert.equal(moveWidget(DEFAULT_WIDGETS, 1, 1), DEFAULT_WIDGETS);
    assert.equal(moveWidget(DEFAULT_WIDGETS, -1, 2), DEFAULT_WIDGETS);
    assert.equal(moveWidget(DEFAULT_WIDGETS, 0, 99), DEFAULT_WIDGETS);
  });

  it("dois médios seguidos dividem a linha; grande ocupa a linha toda", () => {
    const placed = placeWidgets([
      { id: "sobre", wide: false },
      { id: "resultados", wide: false },
      { id: "marcos", wide: true },
      { id: "situacao", wide: false },
      { id: "evolucoes", wide: false },
    ]);
    assert.deepEqual(placed.map((item) => item.span), [6, 6, 12, 6, 6]);
  });

  it("um médio sozinho na linha continua com 6 colunas: nenhuma largura é alterada sem o usuário pedir", () => {
    const placed = placeWidgets([
      { id: "sobre", wide: false },
      { id: "marcos", wide: true },
      { id: "situacao", wide: false },
    ]);
    assert.deepEqual(placed.map((item) => item.span), [6, 12, 6]);
    assert.deepEqual(placed.map((item) => item.item.wide), [false, true, false]);
  });

  it("calcula a linha de cada widget no grid de 12 colunas", () => {
    const rows = rowsOf(placeWidgets(DEFAULT_WIDGETS));
    assert.deepEqual([...rows.entries()], [["resumo", 0], ["historico", 0], ["marcos", 1], ["evidencias", 1], ["planejamento", 2], ["sobre", 3], ["equipe", 3]]);
    const shifted = rowsOf(placeWidgets([{ id: "situacao", wide: false }, { id: "sobre", wide: false }, { id: "resultados", wide: false }]));
    assert.notEqual(shifted.get("sobre"), shifted.get("resultados"));
  });
});
