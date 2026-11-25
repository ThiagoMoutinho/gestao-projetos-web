import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  filterOptions,
  filterPortfolio,
  idlePortfolioFilters,
  isFiltering,
  nextDeliveryFrom,
  nextDeliveryItem,
  paginate,
  portfolioIndicators,
  sortPortfolio,
  unavailableSituations,
  awaitingValidationFrom,
  avatarColorIndex,
  buildTeam,
  teamPreview,
  canEditProject,
  delayCell,
  ownerInitials,
  updatedLabel,
  statusChips,
  statusShare,
  matchesView,
  PORTFOLIO_VIEWS,
  portfolioCsv,
  portfolioHealth,
  portfolioDelayedReasons,
  portfolioNeedsActionReasons,
  isPortfolioDelayed,
  isPortfolioNeedsAction,
  PORTFOLIO_FOLLOW_UP_DAYS,
  resolveCompanies,
  viewCounts,
  currentPlanDate,
  lastMovementFrom,
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
    lastMovementAt: null,
    movementAvailable: true,
    ownerId: "owner",
    ownerName: "Ana",
    managers: [],
    team: [],
    suppliers: [],
    companies: [],
    companySource: null,
    progressBasisPoints: null,
    progressAvailable: true,
    eapEmpty: false,
    nextDelivery: null,
    awaitingValidation: null,
    nextDeliveryAvailable: true,
    viewerIsOwner: false,
    viewerRoles: [],
    activeImpediments: 0,
    overduePhases: 0,
    overdueTasks: 0,
    overdueMilestones: 0,
    ...overrides,
  };
}

const rows = [
  project({ id: "a1", name: "Intranet", glpiTicketId: "4521", status: "EM_ATENCAO", managers: ["Ana"], suppliers: ["Fornecedora X"], companies: ["Fornecedora X"], companySource: "supplier", plannedEndAt: "2026-12-01T15:00:00.000Z", updatedAt: "2026-10-20T12:00:00.000Z", lastMovementAt: "2026-10-20T12:00:00.000Z" }),
  project({ id: "b2", name: "Portal de Serviços", status: "CONCLUIDO", ownerName: "Bruno", managers: ["Bruno"], plannedEndAt: "2026-08-01T15:00:00.000Z" }),
  project({ id: "c3", name: "Área de Benefícios", status: "CRITICO", suppliers: null, companies: null, ownerName: null, updatedAt: "2026-10-25T12:00:00.000Z", lastMovementAt: "2026-10-25T12:00:00.000Z" }),
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
    assert.deepEqual(names({ company: "Fornecedora X", status: "EM_ATENCAO" }), ["Intranet"]);
    assert.deepEqual(names({ company: "Fornecedora X", status: "CONCLUIDO" }), []);
    assert.deepEqual(names({ owner: "Bruno" }), ["Portal de Serviços"]);
    assert.equal(isFiltering(idlePortfolioFilters), false);
    assert.equal(isFiltering({ ...idlePortfolioFilters, query: "  " }), false);
    assert.equal(isFiltering({ ...idlePortfolioFilters, owner: "Ana" }), true);
  });

  it("opções dos filtros usam só valores reais, sem inventar fornecedores ou responsáveis", () => {
    const options = filterOptions(rows);
    assert.deepEqual(options.companies, ["Fornecedora X"]);
    assert.deepEqual(options.owners, ["Ana", "Bruno"]);
    assert.deepEqual(filterOptions([project({ id: "z", name: "Z", suppliers: null, companies: null, ownerName: null })]).companies, []);
  });

  it("ordena por nome, prazo vigente (sem prazo por último) e atualização", () => {
    const order = (sort: Parameters<typeof sortPortfolio>[1]) => sortPortfolio(rows, sort).map((row) => row.id);
    assert.deepEqual(order({ key: "name", direction: "asc" }), ["c3", "a1", "b2"]);
    assert.deepEqual(order({ key: "deadline", direction: "asc" }), ["b2", "a1", "c3"]);
    assert.deepEqual(order({ key: "deadline", direction: "desc" }), ["a1", "b2", "c3"]);
    // Pela última movimentação real; o b2 não tem movimentação e fica por último nas duas direções.
    assert.deepEqual(order({ key: "updated", direction: "desc" }), ["c3", "a1", "b2"]);
    assert.deepEqual(order({ key: "updated", direction: "asc" }), ["a1", "c3", "b2"]);
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
    // Situação atual e indicador do topo usam o mesmo critério: o marco devolvido para correção ainda é entrega a fazer.
    assert.equal(nextDeliveryItem([{ entityType: "MILESTONE", title: "Ajustar", status: "AJUSTES_SOLICITADOS", plannedEndAt: "2026-01-10T15:00:00.000Z", overdue: true }])?.title, "Ajustar");
    assert.equal(nextDeliveryItem([{ entityType: "MILESTONE", title: "Entregue", status: "ENTREGUE", plannedEndAt: "2026-01-10T15:00:00.000Z", overdue: true }]), undefined);
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

  it("monta os chips de situação com Todos e a contagem de cada situação", () => {
    const rows = [{ status: "CRITICO" as const }, { status: "CRITICO" as const }, { status: "CONCLUIDO" as const }, { status: null }];
    const chips = statusChips(rows);
    assert.deepEqual(chips.map((chip) => chip.label), ["Todos", "Crítico", "Em atenção", "Em execução", "Em validação", "Não iniciado", "Concluído"]);
    assert.deepEqual(chips.map((chip) => chip.value), [4, 2, 0, 0, 0, 0, 1]);
  });

  it("gera iniciais do gestor", () => {
    assert.equal(ownerInitials("Juliana Souza"), "JS");
    assert.equal(ownerInitials("Ana Carolina de Lima"), "AL");
    assert.equal(ownerInitials("paulo"), "PA");
    assert.equal(ownerInitials(null), "?");
  });

  it("classifica a coluna Atraso", () => {
    const situation = (delayDays: number) => ({ status: "EM_EXECUCAO" as const, delayDays, delayedItems: delayDays > 0 ? 1 : 0, pendingValidation: 0, closureRequirementsMissing: false, readyForClosure: false });
    assert.deepEqual(delayCell({ status: "CRITICO", situation: { ...situation(12), status: "CRITICO" } }), { kind: "delay", text: "12 dias" });
    assert.deepEqual(delayCell({ status: "CRITICO", situation: { ...situation(1), status: "CRITICO" } }), { kind: "delay", text: "1 dia" });
    assert.deepEqual(delayCell({ status: "EM_ATENCAO", situation: { ...situation(0), status: "EM_ATENCAO" } }), { kind: "risk", text: "Risco" });
    assert.deepEqual(delayCell({ status: "EM_EXECUCAO", situation: situation(0) }), { kind: "ontime", text: "No prazo" });
    assert.deepEqual(delayCell({ status: null, situation: null }), { kind: "unavailable", text: "Indisponível" });
  });

  it("agrupa a equipe por pessoa, ordena por papel e limita a prévia", () => {
    const team = buildTeam([
      { userId: "u2", role: "FORNECEDOR", name: "Bia Lima" },
      { userId: "u1", role: "FORNECEDOR", name: "Ana Souza" },
      { userId: "u1", role: "GESTOR", name: "Ana Souza" },
      { userId: "u3", role: "OBSERVADOR", name: "Caio Reis" },
      { userId: "u4", role: "DESENVOLVEDOR", name: "  " },
    ]);
    assert.deepEqual(team.map((person) => [person.name, person.roles]), [
      ["Ana Souza", ["GESTOR", "FORNECEDOR"]],
      ["Bia Lima", ["FORNECEDOR"]],
      ["Caio Reis", ["OBSERVADOR"]],
    ]);
    assert.deepEqual([teamPreview(team, 2).visible.length, teamPreview(team, 2).extra, teamPreview(team).extra], [2, 1, 0]);
  });

  it("define a cor do avatar de forma determinística a partir do ID", () => {
    const ids = Array.from({ length: 200 }, (_, index) => `user-${index}-${index * 7919}`);
    for (const id of ids) {
      const index = avatarColorIndex(id);
      assert.equal(index, avatarColorIndex(id));
      assert.ok(Number.isInteger(index) && index >= 0 && index < 8);
    }
    assert.equal(new Set(ids.map((id) => avatarColorIndex(id))).size, 8);
  });
});

describe("participação da situação no portfólio", () => {
  it("calcula a porcentagem dos próprios projetos, sem valores fixos", () => {
    assert.equal(statusShare(7, 12), 58);
    assert.equal(statusShare(1, 3), 33);
    assert.equal(statusShare(12, 12), 100);
    assert.equal(statusShare(0, 12), 0);
  });

  it("portfólio vazio ou valores inválidos não geram NaN nem passam de 100", () => {
    assert.equal(statusShare(0, 0), 0);
    assert.equal(statusShare(5, 0), 0);
    assert.equal(statusShare(-1, 10), 0);
    assert.equal(statusShare(15, 10), 100);
  });
});

describe("painel da lista de projetos", () => {
  const late = (days: number) => ({
    status: "CRITICO" as const,
    delayDays: days,
    delayedItems: days > 0 ? 1 : 0,
    pendingValidation: 0,
    closureRequirementsMissing: false,
    readyForClosure: false,
  });
  const rows = [
    project({ id: "a", name: "Alfa", status: "CRITICO", situation: late(4), overdueTasks: 1 }),
    project({ id: "b", name: "Beta", status: "CRITICO", situation: late(10), overdueTasks: 2 }),
    project({ id: "c", name: "Gama", status: "EM_ATENCAO", situation: { ...late(0), status: "EM_ATENCAO" }, plannedEndAt: "2026-12-01" }),
    project({ id: "d", name: "Delta", status: "EM_EXECUCAO", situation: { ...late(0), status: "EM_EXECUCAO" } }),
    project({ id: "e", name: "Épsilon", status: "CONCLUIDO", situation: { ...late(3), status: "CONCLUIDO" } }),
  ];

  it("conta os projetos de cada aba sem filtros", () => {
    assert.deepEqual(viewCounts(rows), { active: 4, concluded: 1, archived: 0, all: 5 });
  });

  it("calcula a saúde do portfólio só com os ativos", () => {
    // Gama está em atenção sem atraso efetivo → entra em needsAction, não em delayed.
    assert.deepEqual(portfolioHealth(rows), { total: 5, active: 4, critical: 2, needsAction: 3, delayed: 2, concluded: 1, averageDelay: 7 });
    assert.equal(portfolioHealth([]).averageDelay, null);
  });

  it("projeto crítico com atraso efetivo entra nos dois indicadores, sem duplicar dentro de cada um", () => {
    const criticalOnTime = project({
      id: "crit-prazo",
      name: "Crítico no prazo",
      status: "CRITICO",
      situation: { status: "CRITICO", delayDays: 0, delayedItems: 0, pendingValidation: 0, closureRequirementsMissing: false, readyForClosure: false },
      plannedEndAt: "2099-12-01",
    });
    assert.equal(isPortfolioNeedsAction(criticalOnTime), true);
    assert.equal(isPortfolioDelayed(criticalOnTime), false);
    assert.deepEqual(portfolioNeedsActionReasons(criticalOnTime), ["Situação crítica"]);
  });

  it("projeto em atenção sem atraso efetivo precisa de ação, mas não conta como em atraso", () => {
    const attention = project({
      id: "aten",
      name: "Atenção sem atraso",
      status: "EM_ATENCAO",
      situation: { status: "EM_ATENCAO", delayDays: 0, delayedItems: 0, pendingValidation: 0, closureRequirementsMissing: false, readyForClosure: false },
      plannedEndAt: "2099-12-01",
    });
    assert.equal(isPortfolioNeedsAction(attention), true);
    assert.equal(isPortfolioDelayed(attention), false);
  });

  it("impedimento ativo exige ação sem gerar atraso automático", () => {
    const impeded = project({
      id: "imp",
      name: "Com impedimento",
      status: "EM_EXECUCAO",
      situation: { status: "EM_EXECUCAO", delayDays: 0, delayedItems: 0, pendingValidation: 0, closureRequirementsMissing: false, readyForClosure: false },
      activeImpediments: 2,
      plannedEndAt: "2099-12-01",
    });
    assert.equal(isPortfolioNeedsAction(impeded), true);
    assert.equal(isPortfolioDelayed(impeded), false);
    assert.ok(portfolioNeedsActionReasons(impeded).includes("2 impedimentos ativos"));
  });

  it("falta de atualização no período configurado exige ação", () => {
    const now = new Date("2026-11-25T12:00:00.000Z");
    const stale = project({
      id: "stale",
      name: "Sem atualização",
      status: "EM_EXECUCAO",
      situation: { status: "EM_EXECUCAO", delayDays: 0, delayedItems: 0, pendingValidation: 0, closureRequirementsMissing: false, readyForClosure: false },
      lastMovementAt: "2026-09-01T12:00:00.000Z",
      plannedEndAt: "2099-12-01",
    });
    assert.ok(updatedLabel(stale.lastMovementAt as string, now).days! > PORTFOLIO_FOLLOW_UP_DAYS);
    assert.equal(isPortfolioNeedsAction(stale, now), true);
    assert.equal(isPortfolioDelayed(stale), false);
  });

  it("atraso efetivo por prazo final ou itens vencidos, sem contar concluídos", () => {
    const byDeadline = project({
      id: "fim",
      name: "Prazo final vencido",
      status: "EM_EXECUCAO",
      situation: { status: "EM_EXECUCAO", delayDays: 0, delayedItems: 0, pendingValidation: 0, closureRequirementsMissing: false, readyForClosure: false },
      plannedEndAt: "2020-01-01",
    });
    const byItems = project({
      id: "itens",
      name: "Itens vencidos",
      status: "EM_EXECUCAO",
      situation: { status: "EM_EXECUCAO", delayDays: 0, delayedItems: 0, pendingValidation: 0, closureRequirementsMissing: false, readyForClosure: false },
      overdueTasks: 1,
      overdueMilestones: 1,
      plannedEndAt: "2099-12-01",
    });
    const doneLate = project({
      id: "done",
      name: "Concluído com atraso histórico",
      status: "CONCLUIDO",
      situation: { status: "CONCLUIDO", delayDays: 9, delayedItems: 1, pendingValidation: 0, closureRequirementsMissing: false, readyForClosure: false },
      plannedEndAt: "2020-01-01",
      overdueTasks: 3,
    });
    assert.equal(isPortfolioDelayed(byDeadline, "2026-11-25"), true);
    assert.equal(isPortfolioDelayed(byItems), true);
    assert.equal(isPortfolioDelayed(doneLate), false);
    assert.ok(portfolioDelayedReasons(byDeadline, "2026-11-25").includes("Prazo final do projeto ultrapassado"));
  });

  it("ordena por urgência: maior atraso, depois a situação mais grave, depois o nome", () => {
    const order = (direction: "asc" | "desc") => sortPortfolio(rows, { key: "urgency", direction }).map((row) => row.id);
    assert.deepEqual(order("desc"), ["b", "a", "e", "c", "d"]);
    assert.deepEqual(order("asc"), ["d", "c", "e", "a", "b"]);
  });

  it("gera o CSV com separador ponto e vírgula, BOM e campos protegidos", () => {
    const csv = portfolioCsv([project({ id: "x", name: 'Portal "novo"; fase 1', glpiTicketId: "123", suppliers: ["Norte"], companies: ["Norte"], status: "CRITICO", situation: late(2) })], {
      status: () => "Crítico",
      progress: () => "50,0",
    });
    const [head, line] = csv.slice(1).split("\r\n");
    assert.equal(csv[0], "\uFEFF");
    assert.ok(head.startsWith("Projeto;GLPI;Situação"));
    assert.ok(line.startsWith('"Portal ""novo""; fase 1";123;Crítico;'));
  });
});

describe("empresa e ordenações da lista", () => {
  it("prioriza a empresa responsável da ficha e usa os fornecedores só na falta dela", () => {
    assert.deepEqual(resolveCompanies("  IGEPPS Tecnologia ", ["Norte"]), { companies: ["IGEPPS Tecnologia"], companySource: "profile" });
    assert.deepEqual(resolveCompanies("-", ["Norte", "Rio"]), { companies: ["Norte", "Rio"], companySource: "supplier" });
    assert.deepEqual(resolveCompanies(null, []), { companies: [], companySource: null });
    assert.deepEqual(resolveCompanies(undefined, []), { companies: [], companySource: null });
    assert.deepEqual(resolveCompanies(undefined, null), { companies: null, companySource: null });
    assert.deepEqual(resolveCompanies(null, null), { companies: [], companySource: null });
  });

  it("ordena por maior atraso e por menor progresso (sem dado por último)", () => {
    const late = (days: number) => ({ status: "CRITICO" as const, delayDays: days, delayedItems: days > 0 ? 1 : 0, pendingValidation: 0, closureRequirementsMissing: false, readyForClosure: false });
    const rows = [
      project({ id: "a", name: "A", situation: late(2), progressBasisPoints: 5000 }),
      project({ id: "b", name: "B", situation: late(9), progressBasisPoints: 1200 }),
      project({ id: "c", name: "C", situation: null, progressBasisPoints: null }),
      project({ id: "d", name: "D", situation: late(0), progressBasisPoints: 9000, progressAvailable: false }),
    ];
    assert.deepEqual(sortPortfolio(rows, { key: "delay", direction: "desc" }).map((row) => row.id), ["b", "a", "d", "c"]);
    assert.deepEqual(sortPortfolio(rows, { key: "progress", direction: "asc" }).map((row) => row.id), ["b", "a", "c", "d"]);
  });

  it("última atualização em rótulo relativo pelo dia civil", () => {
    const now = new Date(2026, 10, 24, 10, 0);
    const at = (y: number, m: number, d: number) => new Date(y, m, d, 23, 30).toISOString();
    assert.equal(updatedLabel(at(2026, 10, 24), now).text, "Hoje");
    assert.equal(updatedLabel(at(2026, 10, 23), now).text, "Ontem");
    assert.equal(updatedLabel(at(2026, 10, 19), now).text, "Há 5 dias");
    assert.equal(updatedLabel(at(2026, 9, 27), now).text, "Há 4 semanas");
    assert.equal(updatedLabel(at(2026, 6, 1), now).text, "Há 4 meses");
    assert.equal(updatedLabel(at(2025, 9, 1), now).text, "Há 1 ano");
    assert.equal(updatedLabel(at(2026, 11, 1), now).text, "Hoje");
    assert.deepEqual(updatedLabel("x", now), { text: "Indisponível", days: null });
  });

  it("última movimentação: a mais recente, ignorando governança e datas inválidas", () => {
    assert.equal(lastMovementFrom([]), null);
    assert.equal(
      lastMovementFrom([
        { at: "2026-11-20T10:00:00.000Z", governance: false },
        { at: "2026-11-23T10:00:00.000Z", governance: true },
        { at: "2026-11-22T09:00:00.000Z", governance: false },
        { at: "invalida", governance: false },
      ]),
      "2026-11-22T09:00:00.000Z",
    );
    assert.equal(lastMovementFrom([{ at: "2026-11-23T10:00:00.000Z", governance: true }]), null);
  });

  it("prazo vigente: o consolidado da EAP vale; sem ele, a data gravada no projeto", () => {
    assert.equal(currentPlanDate("2026-10-26", null), "2026-10-26T12:00:00.000-03:00");
    assert.equal(currentPlanDate("2026-10-26", "2026-12-01T15:00:00.000Z"), "2026-10-26T12:00:00.000-03:00");
    assert.equal(currentPlanDate(null, "2026-12-01T15:00:00.000Z"), "2026-12-01T15:00:00.000Z");
    assert.equal(currentPlanDate(null, null), null);
  });
});
