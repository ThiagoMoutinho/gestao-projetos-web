import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { collectProjectDeliveries, deliveryStatus, deliveryTotals, filterDeliveries, filterHomologations, homologationCounts, homologationStage, type DeliveryLine, type DeliveryStatus } from "./deliveries-portfolio.ts";

const line = (overrides: Partial<DeliveryLine>): DeliveryLine => ({
  id: "v1",
  projectId: "p1",
  projectName: "Intranet Institucional",
  suppliers: ["ARGO"],
  versionLabel: "1.0",
  nature: "SISTEMAS",
  createdAt: "2026-11-10T12:00:00.000Z",
  documents: 3,
  status: "AGUARDANDO_ENVIO",
  ...overrides,
});

describe("situação da entrega", () => {
  it("conforme vence qualquer contagem", () => {
    assert.equal(deliveryStatus({ conforming: true, rejected: 0, awaitingValidation: 0 }), "CONFORME");
  });
  it("rejeição pesa mais que validação em curso", () => {
    assert.equal(deliveryStatus({ conforming: false, rejected: 1, awaitingValidation: 2 }), "COM_PENDENCIA");
  });
  it("documento enviado sem rejeição: em homologação", () => {
    assert.equal(deliveryStatus({ conforming: false, rejected: 0, awaitingValidation: 1 }), "EM_HOMOLOGACAO");
  });
  it("só pendente: aguardando envio", () => {
    assert.equal(deliveryStatus({ conforming: false, rejected: 0, awaitingValidation: 0 }), "AGUARDANDO_ENVIO");
  });
});

describe("indicadores", () => {
  it("conta cada situação e o total", () => {
    const totals = deliveryTotals([
      line({ status: "CONFORME" }),
      line({ status: "CONFORME" }),
      line({ status: "EM_HOMOLOGACAO" }),
      line({ status: "COM_PENDENCIA" }),
      line({ status: "AGUARDANDO_ENVIO" }),
    ]);
    assert.deepEqual(totals, { total: 5, conforming: 2, inHomologation: 1, withPendency: 1 });
  });
  it("lista vazia zera tudo", () => {
    assert.deepEqual(deliveryTotals([]), { total: 0, conforming: 0, inHomologation: 0, withPendency: 0 });
  });
});

describe("busca e filtros", () => {
  const lines = [
    line({ id: "a", versionLabel: "1.0", createdAt: "2026-11-01T00:00:00.000Z" }),
    line({
      id: "b",
      versionLabel: "2.0",
      projectId: "p2",
      projectName: "Integração GLPI",
      suppliers: ["VIBE Tecnologia"],
      nature: "INFRAESTRUTURA",
      status: "CONFORME",
      createdAt: "2026-11-15T00:00:00.000Z",
    }),
    line({ id: "c", versionLabel: "1.1", projectId: "p2", projectName: "Integração GLPI", suppliers: [], nature: "PROCESSOS", status: "COM_PENDENCIA", createdAt: "2026-11-05T00:00:00.000Z" }),
  ];
  const none = { query: "", projectId: "", status: "" as const };
  const ids = (list: DeliveryLine[]) => list.map((entry) => entry.id);

  it("sem filtro: todas, da mais recente para a mais antiga", () => {
    assert.deepEqual(ids(filterDeliveries(lines, none)), ["b", "c", "a"]);
  });
  it("busca por projeto, fornecedor, título e natureza, sem acento nem caixa", () => {
    assert.deepEqual(ids(filterDeliveries(lines, { ...none, query: "integracao" })), ["b", "c"]);
    assert.deepEqual(ids(filterDeliveries(lines, { ...none, query: "vibe" })), ["b"]);
    assert.deepEqual(ids(filterDeliveries(lines, { ...none, query: "versão 1.1" })), ["c"]);
    assert.deepEqual(ids(filterDeliveries(lines, { ...none, query: "INFRAESTRUTURA" })), ["b"]);
  });
  it("filtra por projeto e por situação, e combina com a busca", () => {
    assert.deepEqual(ids(filterDeliveries(lines, { ...none, projectId: "p1" })), ["a"]);
    assert.deepEqual(ids(filterDeliveries(lines, { ...none, status: "COM_PENDENCIA" })), ["c"]);
    assert.deepEqual(ids(filterDeliveries(lines, { query: "integracao", projectId: "p2", status: "CONFORME" })), ["b"]);
  });
  it("sem resultado devolve lista vazia", () => {
    assert.deepEqual(filterDeliveries(lines, { ...none, query: "zzz" }), []);
  });
});

describe("Homologações e consulta por projeto", () => {
  const line = (id: string, status: DeliveryStatus, projectId = "p1") => ({ id, projectId, projectName: "P", suppliers: [], versionLabel: "1.0", nature: "SISTEMAS" as const, createdAt: "2026-01-01T00:00:00Z", documents: 1, status });

  it("mapeia a situação da entrega para a etapa e deixa 'aguardando envio' de fora", () => {
    assert.equal(homologationStage("EM_HOMOLOGACAO"), "AGUARDANDO_VALIDACAO");
    assert.equal(homologationStage("COM_PENDENCIA"), "DEVOLVIDA");
    assert.equal(homologationStage("CONFORME"), "HOMOLOGADA");
    assert.equal(homologationStage("AGUARDANDO_ENVIO"), null);
  });

  it("conta por etapa e filtra só entregas em homologação", () => {
    const lines = [line("a", "EM_HOMOLOGACAO"), line("b", "EM_HOMOLOGACAO"), line("c", "COM_PENDENCIA"), line("d", "CONFORME"), line("e", "AGUARDANDO_ENVIO")];
    assert.deepEqual(homologationCounts(lines), { AGUARDANDO_VALIDACAO: 2, DEVOLVIDA: 1, HOMOLOGADA: 1 });
    assert.equal(filterHomologations(lines, { query: "", projectId: "", stage: "" }).length, 4);
    assert.deepEqual(filterHomologations(lines, { query: "", projectId: "", stage: "DEVOLVIDA" }).map((l) => l.id), ["c"]);
    assert.equal(filterHomologations(lines, { query: "", projectId: "outro", stage: "" }).length, 0);
  });

  const version = { id: "v1", versionLabel: "1.0", nature: "SISTEMAS" as const, createdAt: "2026-01-01T00:00:00Z", items: [{}, {}], conformity: { conforming: false, rejected: 0, awaitingValidation: 1 } };

  it("projeto cuja consulta falhou fica de fora e é sinalizado", () => {
    for (const reply of [null, { status: 500, data: [version] }, { status: 403, data: [] }]) {
      assert.deepEqual(collectProjectDeliveries({ id: "p", name: "P" }, reply, null), { ok: false, rows: [] });
    }
  });

  it("falha só nos participantes mantém as entregas, sem fornecedor", () => {
    const result = collectProjectDeliveries({ id: "p", name: "P" }, { status: 200, data: [version] }, null);
    assert.equal(result.ok, true);
    assert.equal(result.rows.length, 1);
    assert.deepEqual(result.rows[0].suppliers, []);
    assert.equal(result.rows[0].status, "EM_HOMOLOGACAO");
    assert.equal(result.rows[0].documents, 2);
  });

  it("lista fornecedores sem repetir e sem nomes vazios", () => {
    const members = { status: 200, data: [{ role: "FORNECEDOR", name: " Beta " }, { role: "GESTOR", name: "Ana" }, { role: "FORNECEDOR", name: "Beta" }, { role: "FORNECEDOR", name: " " }] };
    assert.deepEqual(collectProjectDeliveries({ id: "p", name: "P" }, { status: 200, data: [version] }, members).rows[0].suppliers, ["Beta"]);
  });
});
