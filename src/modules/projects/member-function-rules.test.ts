import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canDelete,
  canReactivate,
  deactivateImpact,
  deleteBlockedReason,
  deleteImpact,
  hasReservedName,
  isInUse,
  reactivateBlockedReason,
  renameConflict,
  usageSummary,
  type CatalogFunction,
} from "./member-function-rules.ts";

const fn = (overrides: Partial<CatalogFunction> = {}): CatalogFunction => ({ id: "f1", name: "Stakeholder", isActive: true, usage: { members: 0, history: 0 }, ...overrides });

describe("uso e exclusão", () => {
  it("só função nunca atribuída pode ser excluída; uso desconhecido bloqueia por segurança", () => {
    assert.equal(canDelete(fn()), true);
    assert.equal(canDelete(fn({ usage: { members: 1, history: 0 } })), false);
    assert.equal(canDelete(fn({ usage: { members: 0, history: 2 } })), false);
    assert.equal(canDelete(fn({ usage: { members: 3, history: 5 } })), false);
    assert.equal(canDelete(fn({ usage: null })), false);
    assert.equal(isInUse(null), true);
    assert.equal(deleteBlockedReason(fn()), null);
    assert.match(deleteBlockedReason(fn({ usage: { members: 1, history: 0 } })) ?? "", /apenas desativada/);
  });

  it("resume o uso em português, no singular e no plural", () => {
    assert.equal(usageSummary({ members: 0, history: 0 }), "Nunca atribuída");
    assert.equal(usageSummary({ members: 1, history: 0 }), "Em uso por 1 participante");
    assert.equal(usageSummary({ members: 3, history: 0 }), "Em uso por 3 participantes");
    assert.equal(usageSummary({ members: 0, history: 1 }), "Consta em 1 registro do histórico");
    assert.equal(usageSummary({ members: 2, history: 4 }), "Em uso por 2 participantes · consta em 4 registros do histórico");
    assert.equal(usageSummary(null), "Uso indisponível");
  });
});

describe("reativar e nomes reservados", () => {
  it("função desativada reativa; a de nome de papel fixo não", () => {
    assert.equal(canReactivate(fn({ isActive: false })), true);
    assert.equal(canReactivate(fn({ isActive: true })), false, "já está ativa");
    assert.equal(canReactivate(fn({ name: "Desenvolvedor", isActive: false })), false);
    assert.equal(canReactivate(fn({ name: "  GESTOR ", isActive: false })), false);
    assert.equal(reactivateBlockedReason(fn({ name: "Desenvolvedor", isActive: false }))?.includes("papel fixo"), true);
    assert.equal(reactivateBlockedReason(fn({ isActive: false })), null);
    assert.equal(hasReservedName("Responsavel tecnico"), true);
    assert.equal(hasReservedName("Desenvolvedor sênior"), false);
  });

  it("renomear: conflito com papel fixo ou com outra função, ignorando caixa e acento", () => {
    const outras = [{ name: "Patrocinador" }];
    assert.match(renameConflict("desenvolvedor", outras) ?? "", /papel na lista/);
    assert.match(renameConflict("PATROCINADOR", outras) ?? "", /outra função/);
    assert.equal(renameConflict("Parte Interessada", outras), null);
    assert.equal(renameConflict("   ", outras), null, "nome vazio é tratado em outra validação");
  });
});

describe("textos de confirmação", () => {
  it("desativar informa quem mantém o rótulo e que o histórico não muda", () => {
    assert.match(deactivateImpact(fn({ usage: { members: 3, history: 3 } })), /3 participantes a têm hoje e mantêm o rótulo/);
    assert.match(deactivateImpact(fn({ usage: { members: 1, history: 1 } })), /1 participante a tem hoje e mantém o rótulo/);
    assert.match(deactivateImpact(fn()), /Nenhum participante a tem hoje/);
    assert.match(deactivateImpact(fn()), /reativá-la depois/);
  });

  it("excluir avisa que é definitivo e que nada é afetado", () => {
    const texto = deleteImpact(fn({ name: "Teste de função" }));
    assert.match(texto, /Teste de função/);
    assert.match(texto, /definitivamente/);
    assert.match(texto, /não pode ser desfeita/);
    assert.match(texto, /nenhum participante nem registro do histórico/);
  });
});
