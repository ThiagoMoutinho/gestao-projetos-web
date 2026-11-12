import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canManageTemplates,
  canAssignValidator,
  canSubmitDocuments,
  canSubmitItem,
  canValidateItem,
  canWaiveDocuments,
  canWaiveItem,
  complianceSummary,
  conformityBadge,
  conformityPercent,
  describeHistory,
  draftError,
  draftPayload,
  evidenceDisplay,
  evidenceError,
  noteError,
  validatorCandidates,
  validatorInfo,
  suggestDocumentType,
  toDraftItems,
  versionLabelError,
  type ViewerAccess,
} from "./delivery-compliance.ts";

const access = (overrides: Partial<ViewerAccess> = {}): ViewerAccess => ({
  userId: "u1",
  globalRole: "COLABORADOR",
  memberRoles: [],
  isProjectManager: false,
  ...overrides,
});

describe("Conformidade de Entrega: evidências", () => {
  it("SharePoint exige https; GitLab aceita tag/release ou link; outro link exige http(s)", () => {
    assert.equal(evidenceError("SHAREPOINT", "https://igepps.sharepoint.com/sites/ctin/doc.pdf"), null);
    assert.notEqual(evidenceError("SHAREPOINT", "http://igepps.sharepoint.com/doc"), null);
    assert.notEqual(evidenceError("SHAREPOINT", "arquivo.pdf"), null);
    assert.equal(evidenceError("GITLAB_TAG", "v1.0.0"), null);
    assert.equal(evidenceError("GITLAB_RELEASE", "release/2026.11"), null);
    assert.equal(evidenceError("GITLAB_TAG", "https://gitlab.exemplo/-/tags/v1.0.0"), null);
    assert.notEqual(evidenceError("GITLAB_TAG", "tag com espaços"), null);
    assert.equal(evidenceError("OUTRO", "http://exemplo.com/x"), null);
    assert.notEqual(evidenceError("OUTRO", "sem-protocolo"), null);
    assert.notEqual(evidenceError("SHAREPOINT", "   "), null);
  });

  it("links viram endereço clicável; nome de tag não", () => {
    assert.equal(evidenceDisplay("SHAREPOINT", "https://x.sharepoint.com/a")?.href, "https://x.sharepoint.com/a");
    assert.equal(evidenceDisplay("GITLAB_TAG", "v1.0.0")?.href, null);
    assert.equal(evidenceDisplay("GITLAB_TAG", "v1.0.0")?.kindLabel, "Tag GitLab");
    assert.equal(evidenceDisplay(null, null), null);
    assert.equal(evidenceDisplay("OUTRO", "javascript:alert(1)")?.href, null, "nunca expõe protocolo diferente de http(s)");
  });
});

describe("Conformidade de Entrega: permissões na tela (o servidor repete todas)", () => {
  it("quem envia documentos: gestão, fornecedor, PO, desenvolvedor e responsável técnico; PMO, coordenação e observador não", () => {
    for (const role of ["GESTOR", "FORNECEDOR", "PO", "DESENVOLVEDOR", "RESPONSAVEL_TECNICO", "DONO_PROJETO"]) {
      assert.equal(canSubmitDocuments(access({ memberRoles: [role] })), true, role);
    }
    assert.equal(canSubmitDocuments(access({ isProjectManager: true })), true);
    assert.equal(canSubmitDocuments(access({ globalRole: "PMO" })), false);
    assert.equal(canSubmitDocuments(access({ globalRole: "COORDENADOR" })), false);
    assert.equal(canSubmitDocuments(access({ memberRoles: ["OBSERVADOR"] })), false);
  });

  it("só ADMIN e PMO dispensam; ADMIN e PMO gerenciam modelos", () => {
    assert.equal(canWaiveDocuments({ globalRole: "ADMIN" }), true);
    assert.equal(canWaiveDocuments({ globalRole: "PMO" }), true);
    for (const role of ["COORDENADOR", "GESTOR", "FORNECEDOR", "COLABORADOR"]) assert.equal(canWaiveDocuments({ globalRole: role }), false, role);
    assert.equal(canManageTemplates({ globalRole: "ADMIN" }), true);
    assert.equal(canManageTemplates({ globalRole: "PMO" }), true);
    assert.equal(canManageTemplates({ globalRole: "GESTOR" }), false);
  });

  it("aprovar e rejeitar: só documento enviado, nunca o próprio envio nem o fornecedor; validador designado prevalece", () => {
    const item = { status: "ENVIADO" as const, submittedById: "forn", validatorId: null };
    const tech = access({ memberRoles: ["RESPONSAVEL_TECNICO"] });
    assert.equal(canValidateItem(item, tech), true);
    assert.equal(canValidateItem({ ...item, submittedById: "u1" }, tech), false, "quem enviou não valida");
    assert.equal(canValidateItem(item, access({ globalRole: "FORNECEDOR", memberRoles: ["FORNECEDOR"] })), false);
    assert.equal(canValidateItem({ ...item, validatorId: "outro" }, tech), false);
    assert.equal(canValidateItem({ ...item, validatorId: "u1" }, tech), true);
    for (const status of ["PENDENTE", "APROVADO", "REJEITADO", "DISPENSADO"] as const) {
      assert.equal(canValidateItem({ ...item, status }, tech), false, status);
    }
    assert.equal(canValidateItem(item, access()), false, "quem não é do projeto não vê as ações");
  });

  it("enviar vale para pendente e rejeitado; dispensar para o que ainda não foi decidido", () => {
    assert.deepEqual((["PENDENTE", "ENVIADO", "APROVADO", "REJEITADO", "DISPENSADO"] as const).filter(canSubmitItem), ["PENDENTE", "REJEITADO"]);
    assert.deepEqual((["PENDENTE", "ENVIADO", "APROVADO", "REJEITADO", "DISPENSADO"] as const).filter(canWaiveItem), ["PENDENTE", "ENVIADO", "REJEITADO"]);
  });
});

describe("Conformidade de Entrega: selos e validações", () => {
  const base = { total: 4, required: 3, approved: 0, dispensed: 0, awaitingValidation: 0, pending: 3, rejected: 0, conforming: false, blockingItems: [] as never[] };

  it("selo da conformidade informa o que falta e o tom", () => {
    assert.equal(conformityBadge({ ...base, conforming: true }).label, "Conforme");
    assert.equal(conformityBadge({ ...base, blockingItems: [{ id: "a", title: "A", status: "PENDENTE" }] }).label, "Não conforme · 1 pendência");
    const rejected = conformityBadge({ ...base, rejected: 1, blockingItems: [{ id: "a", title: "A", status: "REJEITADO" }, { id: "b", title: "B", status: "PENDENTE" }] });
    assert.equal(rejected.label, "Não conforme · 2 pendências");
    assert.equal(rejected.tone, "danger");
  });

  it("justificativa de 10 caracteres e formato da versão", () => {
    assert.notEqual(noteError("curta"), null);
    assert.equal(noteError("Justificativa suficiente."), null);
    for (const label of ["1.0", "1.1", "2.0", "1.2.3"]) assert.equal(versionLabelError(label), null, label);
    for (const label of ["v1", "1.", "um", ""]) assert.notEqual(versionLabelError(label), null, label);
  });
});

describe("Conformidade de Entrega: editor de modelo", () => {
  it("propõe o tipo do documento a partir do título", () => {
    assert.equal(suggestDocumentType("Plano de testes"), "PLANO_DE_TESTES");
    assert.equal(suggestDocumentType("Integrações e dependências"), "INTEGRACOES_E_DEPENDENCIAS");
    assert.equal(suggestDocumentType("  Manual (v2)!  "), "MANUAL_V2");
  });

  it("valida o rascunho: vazio, título curto, tipo inválido e tipo repetido", () => {
    const item = (overrides = {}) => ({ key: "k", documentType: "PLANO_TESTES", title: "Plano de testes", description: "", required: true, existing: false, ...overrides });
    assert.notEqual(draftError([]), null);
    assert.notEqual(draftError([item({ title: "ab" })]), null);
    assert.notEqual(draftError([item({ documentType: "minúsculo" })]), null);
    assert.match(draftError([item(), item({ key: "k2" })]) ?? "", /repetido/);
    assert.equal(draftError([item(), item({ key: "k2", documentType: "MANUAL", title: "Manual de uso" })]), null);
  });

  it("monta o corpo da requisição: sem espaços sobrando, descrição vazia vira nulo e a validação da CTIN só vai quando marcada", () => {
    const items = toDraftItems([{ documentType: "ESCOPO", title: " Escopo ", description: null, required: true }]);
    assert.deepEqual(draftPayload(items, "  Revisão 2  ", false), {
      items: [{ documentType: "ESCOPO", title: "Escopo", description: null, required: true }],
      notes: "Revisão 2",
    });
    assert.deepEqual(draftPayload(items, "", true), { items: [{ documentType: "ESCOPO", title: "Escopo", description: null, required: true }], notes: null, ctinValidated: true });
  });
});

describe("Resumo da conformidade (quadro da Visão Geral)", () => {
  const version = (overrides: Partial<Parameters<typeof conformityPercent>[0]> & Record<string, unknown>) => ({
    total: 4,
    required: 3,
    approved: 1,
    dispensed: 0,
    awaitingValidation: 1,
    pending: 1,
    rejected: 1,
    conforming: false,
    blockingItems: [
      { id: "a", title: "Manual", status: "ENVIADO" as const },
      { id: "b", title: "Dicionário", status: "PENDENTE" as const },
    ],
    ...overrides,
  });

  it("percentual considera só os obrigatórios atendidos (aprovados ou dispensados)", () => {
    assert.equal(conformityPercent(version({})), 33);
    assert.equal(conformityPercent(version({ required: 0, blockingItems: [] })), 100);
    assert.equal(conformityPercent(version({ required: 2, blockingItems: [] })), 100);
  });

  it("soma todas as versões: obrigatórios, aprovados, dispensados, em validação, pendentes e rejeitados", () => {
    const summary = complianceSummary([
      version({}),
      version({ required: 2, approved: 1, dispensed: 1, awaitingValidation: 0, pending: 0, rejected: 0, conforming: true, blockingItems: [] }),
    ]);
    assert.deepEqual(summary, {
      versions: 2,
      conformingVersions: 1,
      required: 5,
      satisfied: 3,
      percent: 60,
      approved: 2,
      dispensed: 1,
      awaitingValidation: 1,
      pending: 1,
      rejected: 1,
    });
  });

  it("sem versões registradas não há pendência", () => {
    const summary = complianceSummary([]);
    assert.equal(summary.versions, 0);
    assert.equal(summary.percent, 100);
  });
});

describe("Validador e histórico do documento", () => {
  it("designam o validador: gestão do projeto e PMO; os demais não", () => {
    assert.equal(canAssignValidator({ globalRole: "PMO", isProjectManager: false }), true);
    assert.equal(canAssignValidator({ globalRole: "GESTOR", isProjectManager: true }), true);
    for (const role of ["ADMIN", "COORDENADOR", "FORNECEDOR", "COLABORADOR"]) {
      assert.equal(canAssignValidator({ globalRole: role, isProjectManager: false }), false, role);
    }
  });

  it("candidatos: participantes e dono, sem fornecedor, responsáveis técnicos primeiro e sem repetir pessoa", () => {
    const list = validatorCandidates(
      [
        { userId: "u-ana", name: "Ana", role: "GESTOR" },
        { userId: "u-forn", name: "Fornecedor", role: "FORNECEDOR" },
        { userId: "u-tec", name: "Técnico", role: "RESPONSAVEL_TECNICO" },
        { userId: "u-ana", name: "Ana", role: "PO" },
        { userId: "u-dono", name: "Dono", role: "DONO_PROJETO" },
      ],
      { id: "u-dono", name: "Dono" },
    );
    assert.deepEqual(list.map((entry) => entry.userId), ["u-tec", "u-ana", "u-dono"]);
    assert.deepEqual(list[1].roles, ["GESTOR", "PO"]);
    assert.deepEqual(list[2].roles, ["DONO_PROJETO"]);
  });

  it("quem valida: o designado; sem designação, o responsável técnico do marco; sem nenhum, avisa", () => {
    assert.deepEqual(validatorInfo({ id: "t", name: "Técnica" }, [{ id: "m", name: "Marco" }]), { kind: "designado", names: ["Técnica"] });
    assert.deepEqual(validatorInfo(null, [{ id: "m", name: "Marco" }]), { kind: "marco", names: ["Marco"] });
    assert.deepEqual(validatorInfo(null, []), { kind: "nenhum", names: [] });
  });

  it("histórico: envio, rejeição, reenvio, aprovação, dispensa e trocas de validador", () => {
    const none = { previousValidator: null, newValidator: null };
    const person = { id: "t", name: "Técnica" };
    const labels = describeHistory([
      { action: "DESIGNACAO", previousValidator: null, newValidator: person },
      { action: "ENVIO", ...none },
      { action: "REJEICAO", ...none },
      { action: "ENVIO", ...none },
      { action: "APROVACAO", ...none },
      { action: "DESIGNACAO", previousValidator: person, newValidator: { id: "o", name: "Outro" } },
      { action: "DESIGNACAO", previousValidator: person, newValidator: null },
      { action: "DISPENSA", ...none },
    ]).map((entry) => entry.label);
    assert.deepEqual(labels, [
      "Validador designado",
      "Envio da evidência",
      "Rejeição · devolvido para correção",
      "Reenvio após correção",
      "Aprovação",
      "Validador alterado",
      "Designação de validador removida",
      "Dispensa formal",
    ]);
  });
});
