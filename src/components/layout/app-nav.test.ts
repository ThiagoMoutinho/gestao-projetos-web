import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { APP_NAV_GROUPS, appPageLabel } from "./app-nav.ts";

describe("navegação lateral", () => {
  it("não tem item de notificações: o acesso é pelo sino do cabeçalho", () => {
    const all = APP_NAV_GROUPS.flatMap((group) => group.items);
    assert.equal(all.some((item) => item.href === "/notificacoes"), false);
    assert.equal(all.some((item) => item.label === "Notificações"), false);
  });

  it("a rota da Central continua com título 'Notificações' no cabeçalho", () => {
    assert.equal(appPageLabel("/notificacoes"), "Notificações");
    assert.equal(appPageLabel("/notificacoes/qualquer"), "Notificações");
  });

  it("os demais itens operacionais seguem como estavam", () => {
    assert.equal(appPageLabel("/"), "Início");
    assert.equal(appPageLabel("/projetos"), "Projetos");
    assert.equal(appPageLabel("/projetos/abc"), "Projetos");
    const labels = APP_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.label));
    assert.deepEqual(labels, ["Início", "Projetos", "Minhas Tarefas", "Entregas e Homologações", "Relatórios", "Administração"]);
  });
});
