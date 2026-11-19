import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { groupResults, KIND_LABEL, resultHref, resultKey, type WorkspaceResult } from "./workspace-search.ts";

const item = (kind: WorkspaceResult["kind"], id: string, destination: WorkspaceResult["destination"] = "OVERVIEW"): WorkspaceResult => ({
  kind,
  id,
  title: id,
  detail: null,
  projectId: "proj 1",
  projectName: "Projeto 1",
  destination,
});

describe("Busca global na tela", () => {
  it("leva à Visão Geral ou à aba da EAP, com o id do projeto protegido na URL", () => {
    assert.equal(resultHref(item("PROJECT", "a")), "/projetos/proj%201");
    assert.equal(resultHref(item("TASK", "b", "EAP")), "/projetos/proj%201?aba=eap");
  });

  it("agrupa fases, tarefas e marcos em 'Itens da EAP' e mantém a ordem recebida", () => {
    const groups = groupResults([item("GLPI", "g"), item("MINUTES", "m"), item("PHASE", "f"), item("TASK", "t"), item("MILESTONE", "k"), item("PERSON", "p")]);
    assert.deepEqual(
      groups.map((group) => [group.heading, group.items.map((entry) => entry.id)]),
      [
        ["Chamados GLPI", ["g"]],
        ["Atas", ["m"]],
        ["Itens da EAP", ["f", "t", "k"]],
        ["Pessoas", ["p"]],
      ],
    );
  });

  it("pode tirar resultados já mostrados em outro lugar e descarta grupos vazios", () => {
    const groups = groupResults([item("PROJECT", "a"), item("PROJECT", "b"), item("GLPI", "g")], (entry) => entry.kind === "PROJECT" && entry.id === "a");
    assert.deepEqual(groups.map((group) => group.items.map((entry) => entry.id)), [["b"], ["g"]]);
    assert.deepEqual(groupResults([item("PROJECT", "a")], () => true), []);
  });

  it("a chave separa o mesmo id em tipos diferentes e todo tipo tem rótulo", () => {
    assert.notEqual(resultKey(item("TASK", "x")), resultKey(item("PHASE", "x")));
    assert.equal(KIND_LABEL.MINUTES, "Ata");
    assert.equal(KIND_LABEL.GLPI, "Chamado GLPI");
  });
});
