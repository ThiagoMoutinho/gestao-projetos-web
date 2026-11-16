import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appearanceKey,
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  THEME_IDS,
  DEVICE_PALETTE_KEY,
  effectivePalette,
  PALETTE_IDS,
  paletteLockedFor,
  paletteBootstrapScript,
  parsePalette,
  parseTheme,
  readAppearance,
  writeAppearance,
  type KeyValueStore,
} from "./appearance.ts";

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

describe("preferências de aparência", () => {
  it("valida tema e paleta", () => {
    assert.equal(parseTheme("dark"), "dark");
    assert.equal(parseTheme("igepps"), "igepps");
    assert.equal(parseTheme("system"), null);
    assert.equal(parseTheme("roxo"), null);
    assert.equal(parseTheme(undefined), null);
    assert.equal(parsePalette("violeta"), "violeta");
    assert.equal(parsePalette("azul"), null);
    assert.equal(DEFAULT_PALETTE, "institucional");
    assert.equal(DEFAULT_THEME, "igepps");
    assert.deepEqual([...THEME_IDS], ["igepps", "light", "dark"]);
    assert.deepEqual([...PALETTE_IDS], ["institucional", "petroleo", "violeta", "esmeralda", "rosa"]);
  });

  it("grava e lê a preferência de cada usuário separadamente", () => {
    const store = memoryStore();
    writeAppearance(store, "u1", { theme: "dark", palette: "violeta" });
    writeAppearance(store, "u2", { theme: "igepps", palette: "esmeralda" });
    assert.deepEqual(readAppearance(store, "u1"), { theme: "dark", palette: "violeta" });
    assert.deepEqual(readAppearance(store, "u2"), { theme: "igepps", palette: "esmeralda" });
    assert.deepEqual(readAppearance(store, "u3"), {});
    assert.equal(store.data[DEVICE_PALETTE_KEY], "esmeralda");
    assert.notEqual(appearanceKey("u1"), appearanceKey("u2"));
  });

  it("ignora dados corrompidos ou inválidos", () => {
    assert.deepEqual(readAppearance(memoryStore({ [appearanceKey("u1")]: "{não é json" }), "u1"), {});
    assert.deepEqual(readAppearance(memoryStore({ [appearanceKey("u1")]: JSON.stringify({ theme: "neon", palette: 3 }) }), "u1"), {});
    assert.deepEqual(readAppearance(memoryStore({ [appearanceKey("u1")]: JSON.stringify({ theme: "dark", palette: "lixo" }) }), "u1"), { theme: "dark" });
  });

  it("não quebra quando o armazenamento falha", () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("indisponível");
      },
      setItem: () => {
        throw new Error("cota");
      },
    };
    assert.deepEqual(readAppearance(broken, "u1"), {});
    assert.doesNotThrow(() => writeAppearance(broken, "u1", { theme: "light", palette: "institucional" }));
  });

  it("gera o script de pré-hidratação só com paletas válidas", () => {
    const script = paletteBootstrapScript();
    for (const id of PALETTE_IDS) {
      assert.ok(script.includes(`"${id}"`));
    }
    assert.ok(script.includes("data-palette"));
    assert.ok(script.includes(DEVICE_PALETTE_KEY));
  });

  it("no Padrão IGEPPS a paleta é sempre a institucional e a troca fica bloqueada", () => {
    assert.equal(paletteLockedFor("igepps"), true);
    assert.equal(paletteLockedFor("light"), false);
    assert.equal(paletteLockedFor("dark"), false);
    for (const id of PALETTE_IDS) {
      assert.equal(effectivePalette("igepps", id), "institucional");
      assert.equal(effectivePalette("light", id), id);
      assert.equal(effectivePalette("dark", id), id);
    }
  });

  it("o script de pré-hidratação usa a institucional quando o tema salvo é o Padrão IGEPPS", () => {
    const script = paletteBootstrapScript();
    assert.ok(script.includes("igepps"));
    assert.ok(script.includes(`localStorage.getItem("theme")`));
  });
});
