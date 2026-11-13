import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { draftFromMembers, teamOperations, teamProblems, type TeamMember } from "./team-editing.ts";

const members: TeamMember[] = [
  { id: "m-owner", userId: "u-owner", role: "DONO_PROJETO" },
  { id: "m-gestor", userId: "u-ana", role: "GESTOR" },
  { id: "m-forn", userId: "u-alfa", role: "FORNECEDOR" },
  { id: "m-dev", userId: "u-bia", role: "DESENVOLVEDOR" },
  { id: "m-gestor2", userId: "u-caio", role: "GESTOR" },
];

describe("team-editing", () => {
  it("monta o rascunho: principal de cada papel e o restante (sem o dono do projeto)", () => {
    const draft = draftFromMembers(members);
    assert.deepEqual(draft.key, { GESTOR: "u-ana", RESPONSAVEL_TECNICO: "", FORNECEDOR: "u-alfa" });
    assert.deepEqual(draft.others.map((row) => row.memberId), ["m-dev", "m-gestor2"]);
  });

  it("sem mudanças, nenhuma operação", () => {
    assert.deepEqual(teamOperations(members, draftFromMembers(members)), []);
  });

  it("troca de gestor remove o anterior e inclui o novo; definir responsável técnico inclui", () => {
    const draft = draftFromMembers(members);
    draft.key.GESTOR = "u-davi";
    draft.key.RESPONSAVEL_TECNICO = "u-bia";
    assert.deepEqual(teamOperations(members, draft), [
      { type: "remove", memberId: "m-gestor", userId: "u-ana", role: "GESTOR" },
      { type: "add", userId: "u-davi", role: "GESTOR" },
      { type: "add", userId: "u-bia", role: "RESPONSAVEL_TECNICO" },
    ]);
  });

  it("alterar função, remover e adicionar participantes, nessa ordem segura", () => {
    const draft = draftFromMembers(members);
    draft.others = [
      { ...draft.others[0], role: "PO" },
      { rowId: "novo", memberId: null, userId: "u-eva", role: "OBSERVADOR" },
    ];
    draft.key.FORNECEDOR = "";
    assert.deepEqual(teamOperations(members, draft), [
      { type: "remove", memberId: "m-forn", userId: "u-alfa", role: "FORNECEDOR" },
      { type: "remove", memberId: "m-gestor2", userId: "u-caio", role: "GESTOR" },
      { type: "update", memberId: "m-dev", userId: "u-bia", from: "DESENVOLVEDOR", role: "PO" },
      { type: "add", userId: "u-eva", role: "OBSERVADOR" },
    ]);
  });

  it("aponta pessoa repetida na mesma função e linha sem pessoa", () => {
    const draft = draftFromMembers(members);
    draft.others.push({ rowId: "x", memberId: null, userId: "u-ana", role: "GESTOR" });
    draft.others.push({ rowId: "y", memberId: null, userId: "", role: "PO" });
    const problems = teamProblems(draft, (id) => (id === "u-ana" ? "Ana" : id));
    assert.equal(problems.length, 2);
    assert.match(problems[1], /Ana aparece mais de uma vez como Gestor/);
  });

  it("a mesma pessoa pode ter funções diferentes", () => {
    const draft = draftFromMembers(members);
    draft.key.RESPONSAVEL_TECNICO = "u-ana";
    assert.deepEqual(teamProblems(draft), []);
  });
});
