import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterOptions,
  filterPortfolio,
  idlePortfolioFilters,
  isFiltering,
  nextDeliveryFrom,
  paginate,
  portfolioIndicators,
  sortPortfolio,
  unavailableSituations,
  awaitingValidationFrom,
  canEditProject,
  matchesView,
  PORTFOLIO_VIEWS,
  type ProjectListRow,
} from "./project-portfolio.ts";

function project(overrides: Partial<ProjectListRow> & Pick<ProjectListRow, "id" | "name">): ProjectListRow {
  return {
    description: null,
    glpiTicketId: null,
    status: "EM_EXECUCAO",
    situation: null,
    registeredStatus: "EM_EXECUCAO",
    plannedStartAt: null,
    plannedEndAt: null,
    updatedAt: "2026-10-01T12:00:00.000Z",
    ownerId: "owner",
    ownerName: "Ana",
    managers: [],
    suppliers: [],
    progressBasisPoints: null,
    progressAvailable: true,
    eapEmpty: false,
    nextDelivery: null,
    awaitingValidation: null,
    nextDeliveryAvailable: true,
    viewerIsOwner: false,
    viewerRoles: [],
    ...overrides,
  };
}

const rows = [
  project({ id: "a1", name: "Intranet", glpiTicketId: "4521", status: "EM_ATENCAO", suppliers: ["Fornecedora X"], plannedEndAt: "2026-12-01T15:00:00.000Z", updatedAt: "2026-10-20T12:00:00.000Z" }),
  project({ id: "b2", name: "Portal de Serviços", status: "CONCLUIDO", ownerName: "Bruno", plannedEndAt: "2026-08-01T15:00:00.000Z" }),
  project({ id: "c3", name: "Área de Benefícios", status: "CRITICO", suppliers: null, ownerName: null, updatedAt: "2026-10-25T12:00:00.000Z" }),
];

describe("Portfólio de projetos", () => {
  it("indicadores contam a situação calculada; projeto sem situação não entra nos indicadores por situação", () => {
    const values = Object.fromEntries(portfolioIndicators(rows).map((indicator) => [indicator.key, indicator.value]));
    assert.deepEqual(values, { total: 3, EM_EXECUCAO: 0, EM_ATENCAO: 1, CRITICO: 1, EM_VALIDACAO: 0, CONCLUIDO: 1 });
    assert.equal(portfolioIndicators([])[0].value, 0);

    // A situação gravada no cadastro (SUSPENSO) não é usada: vale a calculada.
    const withUnavailable = [...rows, project({ id: "d4", name: "Sem monitoramento", status: null, registeredStatus: "SUSPENSO" })];
    const counted = Object.fromEntries(portfolioIndicators(withUnavailable).map((indicator) => [indicator.key, indicator.value]));
    assert.deepEqual([counted.total, counted.EM_ATENCAO, unavailableSituations(withUnavailable)], [4, 1, 1]);
    assert.ok(!filterOptions(withUnavailable).statuses.includes(null as never));
  });

  it("pesquisa por nome sem acentos, por GLPI e por identificador, combinando com os filtros", () => {
    const names = (filters: Partial<typeof idlePortfolioFilters>) => filterPortfolio(rows, { ...idlePortfolioFilters, ...filters }).map((row) => row.name);
    assert.deepEqual(names({ query: "area" }), ["Área de Benefícios"]);
    assert.deepEqual(names({ query: "#4521" }), ["Intranet"]);
    assert.deepEqual(names({ query: "b2" }), ["Portal de Serviços"]);
    assert.deepEqual(names({ status: "CONCLUIDO" }), ["Portal de Serviços"]);
    assert.deepEqual(names({ supplier: "Fornecedora X", status: "EM_ATENCAO" }), ["Intranet"]);
    assert.deepEqual(names({ supplier: "Fornecedora X", status: "CONCLUIDO" }), []);
    assert.deepEqual(names({ owner: "Bruno" }), ["Portal de Serviços"]);
    assert.equal(isFiltering(idlePortfolioFilters), false);
    assert.equal(isFiltering({ ...idlePortfolioFilters, query: "  " }), false);
    assert.equal(isFiltering({ ...idlePortfolioFilters, owner: "Ana" }), true);
  });

  it("opções dos filtros usam só valores reais, sem inventar fornecedores ou responsáveis", () => {
    const options = filterOptions(rows);
    assert.deepEqual(options.suppliers, ["Fornecedora X"]);
    assert.deepEqual(options.owners, ["Ana", "Bruno"]);
    assert.deepEqual(filterOptions([project({ id: "z", name: "Z", suppliers: null, ownerName: null })]).suppliers, []);
  });

  it("ordena por nome, prazo vigente (sem prazo por último) e atualização", () => {
    const order = (sort: Parameters<typeof sortPortfolio>[1]) => sortPortfolio(rows, sort).map((row) => row.id);
    assert.deepEqual(order({ key: "name", direction: "asc" }), ["c3", "a1", "b2"]);
    assert.deepEqual(order({ key: "deadline", direction: "asc" }), ["b2", "a1", "c3"]);
    assert.deepEqual(order({ key: "deadline", direction: "desc" }), ["a1", "b2", "c3"]);
    assert.deepEqual(order({ key: "updated", direction: "desc" }), ["c3", "a1", "b2"]);
  });

  it("próxima entrega é o marco ainda a entregar mais próximo; marco entregue aguarda validação e não entra", () => {
    const items = [
      { entityType: "TASK", title: "Tarefa", status: "EM_ANDAMENTO", plannedEndAt: "2026-01-01T15:00:00.000Z", overdue: false },
      { entityType: "MILESTONE", title: "Aceito", status: "APROVADO", plannedEndAt: "2026-02-01T15:00:00.000Z", overdue: false },
      { entityType: "MILESTONE", title: "Homologação", status: "PENDENTE", plannedEndAt: "2026-04-01T15:00:00.000Z", overdue: false },
      { entityType: "MILESTONE", title: "Entrega", status: "ENTREGUE", plannedEndAt: "2026-03-01T15:00:00.000Z", overdue: true },
    ];
    const next = nextDeliveryFrom(items);
    assert.deepEqual(next, { title: "Homologação", plannedAt: "2026-04-01T15:00:00.000Z", overdue: false, corrections: false });
    assert.deepEqual(awaitingValidationFrom(items), { title: "Entrega", plannedAt: "2026-03-01T15:00:00.000Z" });
    const returned = nextDeliveryFrom([{ entityType: "MILESTONE", title: "Ajustar", status: "AJUSTES_SOLICITADOS", plannedEndAt: "2026-01-10T15:00:00.000Z", overdue: true }]);
    assert.equal(returned?.corrections, true);
    assert.equal(awaitingValidationFrom([]), null);
    assert.equal(nextDeliveryFrom([]), null);
  });

  it("visualizações: ativos excluem concluídos; concluídos só os formais; todos mostra tudo; arquivados indisponível", () => {
    const ids = (view: Parameters<typeof matchesView>[1]) => filterPortfolio(rows, idlePortfolioFilters, view).map((row) => row.id);
    assert.deepEqual(ids("active"), ["a1", "c3"]);
    assert.deepEqual(ids("concluded"), ["b2"]);
    assert.deepEqual(ids("all"), ["a1", "b2", "c3"]);
    assert.deepEqual(ids("archived"), []);
    assert.equal(PORTFOLIO_VIEWS.find((view) => view.key === "archived")?.available, false);
    // Suspenso e sem situação calculada continuam entre os ativos; filtros combinam com a visualização.
    assert.equal(matchesView({ status: "SUSPENSO" }, "active"), true);
    assert.equal(matchesView({ status: null }, "active"), true);
    assert.deepEqual(filterPortfolio(rows, { ...idlePortfolioFilters, status: "CRITICO" }, "active").map((row) => row.id), ["c3"]);
    assert.deepEqual(filterPortfolio(rows, { ...idlePortfolioFilters, status: "CRITICO" }, "concluded"), []);
  });

  it("edição do cadastro só para PMO, coordenação, ADMIN, dono ou gestão do projeto", () => {
    const row = { viewerIsOwner: false, viewerRoles: [] as string[] };
    assert.equal(canEditProject("PMO", row), true);
    assert.equal(canEditProject("COORDENADOR", row), true);
    assert.equal(canEditProject("GESTOR", { ...row, viewerIsOwner: true }), true);
    assert.equal(canEditProject("GESTOR", { ...row, viewerRoles: ["GESTOR"] }), true);
    assert.equal(canEditProject("FORNECEDOR", { ...row, viewerRoles: ["FORNECEDOR"] }), false);
    assert.equal(canEditProject("COLABORADOR", { ...row, viewerRoles: ["PO"] }), false);
  });

  it("pagina a lista e mantém a página dentro dos limites", () => {
    const many = Array.from({ length: 32 }, (_, index) => index);
    assert.deepEqual([paginate(many, 1, 15).pages, paginate(many, 3, 15).items.length], [3, 2]);
    assert.equal(paginate(many, 9, 15).current, 3);
    assert.deepEqual(paginate([], 1, 15), { pages: 1, current: 1, items: [] });
  });
});
