import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyChoice,
  canManageMemberFunctions,
  choiceOf,
  draftFromMembers,
  duplicateFunctionName,
  functionNameConflict,
  functionNameKey,
  memberFunctionNameProblem,
  teamOperations,
  teamProblems,
  type TeamMember,
} from "./team-editing.ts";

const members: TeamMember[] = [
  { id: "m-owner", userId: "u-owner", role: "DONO_PROJETO" },
  { id: "m-gestor", userId: "u-ana", role: "GESTOR", functionId: null },
  { id: "m-forn", userId: "u-alfa", role: "FORNECEDOR", functionId: null },
  { id: "m-dev", userId: "u-bia", role: "DESENVOLVEDOR", functionId: null },
  { id: "m-gestor2", userId: "u-caio", role: "GESTOR", functionId: null },
];

describe("team-editing", () => {
  it("monta o rascunho: principal de cada papel e o restante (sem o dono do projeto)", () => {
    const draft = draftFromMembers(members);
    assert.deepEqual(draft.key, { GESTOR: "u-ana", PATROCINADOR: "", RESPONSAVEL_TECNICO: "", FORNECEDOR: "u-alfa" });
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
      { type: "add", userId: "u-davi", role: "GESTOR", functionId: null },
      { type: "add", userId: "u-bia", role: "RESPONSAVEL_TECNICO", functionId: null },
    ]);
  });

  it("alterar função, remover e adicionar participantes, nessa ordem segura", () => {
    const draft = draftFromMembers(members);
    draft.others = [
      { ...draft.others[0], role: "PO", functionId: null },
      { rowId: "novo", memberId: null, userId: "u-eva", role: "OBSERVADOR", functionId: null },
    ];
    draft.key.FORNECEDOR = "";
    assert.deepEqual(teamOperations(members, draft), [
      { type: "remove", memberId: "m-forn", userId: "u-alfa", role: "FORNECEDOR" },
      { type: "remove", memberId: "m-gestor2", userId: "u-caio", role: "GESTOR" },
      { type: "update", memberId: "m-dev", userId: "u-bia", from: "DESENVOLVEDOR", role: "PO", functionId: null },
      { type: "add", userId: "u-eva", role: "OBSERVADOR", functionId: null },
    ]);
  });

  it("aponta pessoa repetida na mesma função e linha sem pessoa", () => {
    const draft = draftFromMembers(members);
    draft.others.push({ rowId: "x", memberId: null, userId: "u-ana", role: "GESTOR", functionId: null });
    draft.others.push({ rowId: "y", memberId: null, userId: "", role: "PO", functionId: null });
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

describe("funções do catálogo na equipe", () => {
  const withFunction: TeamMember[] = [...members, { id: "m-stake", userId: "u-eva", role: "OBSERVADOR", functionId: "fn-stake" }];

  it("o rascunho guarda a função e a escolha do seletor a reflete", () => {
    const row = draftFromMembers(withFunction).others.find((entry) => entry.memberId === "m-stake");
    assert.equal(row?.functionId, "fn-stake");
    assert.equal(choiceOf(row!), "FN:fn-stake");
    assert.equal(choiceOf({ role: "PO", functionId: null }), "PO");
  });

  it("escolher uma função do catálogo vira acesso Observador + a função; papel comum limpa a função", () => {
    assert.deepEqual(applyChoice("FN:fn-stake"), { role: "OBSERVADOR", functionId: "fn-stake" });
    assert.deepEqual(applyChoice("GESTOR"), { role: "GESTOR", functionId: null });
    assert.equal(applyChoice("FN:"), null);
    assert.equal(applyChoice("INEXISTENTE"), null);
  });

  it("trocar só a função (mesmo acesso Observador) gera uma alteração; sem mudança, nada", () => {
    assert.deepEqual(teamOperations(withFunction, draftFromMembers(withFunction)), []);
    const draft = draftFromMembers(withFunction);
    draft.others.find((row) => row.memberId === "m-stake")!.functionId = "fn-outra";
    assert.deepEqual(teamOperations(withFunction, draft), [
      { type: "update", memberId: "m-stake", userId: "u-eva", from: "OBSERVADOR", role: "OBSERVADOR", functionId: "fn-outra" },
    ]);
  });

  it("incluir participante com função envia a função; mudar para papel comum envia functionId nulo", () => {
    const draft = draftFromMembers(withFunction);
    draft.others.push({ rowId: "novo", memberId: null, userId: "u-zeca", role: "OBSERVADOR", functionId: "fn-stake" });
    const toDev = draft.others.find((row) => row.memberId === "m-stake")!;
    toDev.role = "DESENVOLVEDOR";
    toDev.functionId = null;
    assert.deepEqual(teamOperations(withFunction, draft), [
      { type: "update", memberId: "m-stake", userId: "u-eva", from: "OBSERVADOR", role: "DESENVOLVEDOR", functionId: null },
      { type: "add", userId: "u-zeca", role: "OBSERVADOR", functionId: "fn-stake" },
    ]);
  });

  it("valida o nome da função e detecta duplicata ignorando caixa, acento e espaços", () => {
    assert.equal(memberFunctionNameProblem("Stakeholder"), null);
    assert.match(memberFunctionNameProblem(" a ") ?? "", /mínimo/);
    assert.match(memberFunctionNameProblem("x".repeat(61)) ?? "", /no máximo/);
    assert.match(memberFunctionNameProblem("!!") ?? "", /letras ou números/);
    assert.equal(functionNameKey("Gestão  de Contrato"), functionNameKey("gestao de contrato"));
    assert.equal(duplicateFunctionName("  stakeholder ", [{ name: "Stakeholder" }]), true);
    assert.equal(duplicateFunctionName("Patrocinador", [{ name: "Stakeholder" }]), true);
    assert.equal(duplicateFunctionName("Apoiador", [{ name: "Stakeholder" }]), false);
  });

  it("nome igual ao de um papel fixo da lista é recusado (Desenvolvedor, Gestor, PO...), ignorando caixa e acento", () => {
    for (const nome of ["Desenvolvedor", "  desenvolvedor ", "GESTOR", "Patrocinador", "Responsavel tecnico", "po", "Observador", "Fornecedor", "Dono do Projeto"]) {
      assert.equal(functionNameConflict(nome, []), "role", nome);
      assert.equal(duplicateFunctionName(nome, []), true, nome);
    }
    assert.equal(functionNameConflict("Stakeholder", [{ name: "Stakeholder" }]), "function");
    assert.equal(functionNameConflict("Stakeholder", []), null);
    assert.equal(functionNameConflict("Desenvolvedor sênior", []), null);
  });

  it("só ADMIN e PMO veem o botão de criar função", () => {
    assert.equal(canManageMemberFunctions("ADMIN"), true);
    assert.equal(canManageMemberFunctions("PMO"), true);
    for (const role of ["COORDENADOR", "GESTOR", "FORNECEDOR", "COLABORADOR", ""]) assert.equal(canManageMemberFunctions(role), false, role);
  });
});
