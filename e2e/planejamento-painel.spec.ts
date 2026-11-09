import { expect, test, type Browser, type BrowserContext, type Route } from "@playwright/test";

/**
 * Painel de Planejamento da Visão Geral (Task 90). Entra pelo login do PMO (E2E_PMO_EMAIL / E2E_PMO_PASSWORD) em um projeto
 * de demonstração (E2E_PROJECT_ID, padrão "demo-proj-05"). Somente leitura: estados de carregamento e falha vêm de
 * `page.route` e nenhuma requisição de escrita pode ser enviada.
 */
const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const WEB = process.env.E2E_BASE_URL ?? "http://localhost:3001";
const PROJECT = process.env.E2E_PROJECT_ID ?? "demo-proj-05";
const CORS = { "access-control-allow-origin": WEB, "access-control-allow-credentials": "true" };
const credentials = { email: process.env.E2E_PMO_EMAIL, password: process.env.E2E_PMO_PASSWORD };
const SHOTS = process.env.E2E_SHOTS_DIR;

test.skip(!credentials.email || !credentials.password, "Defina E2E_PMO_EMAIL e E2E_PMO_PASSWORD.");
test.describe.configure({ mode: "serial" });

let session: Awaited<ReturnType<BrowserContext["storageState"]>>;

async function login(browser: Browser) {
  const context = await browser.newContext({ locale: "pt-BR", baseURL: WEB });
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#email").fill(credentials.email as string);
  await page.locator("#password").fill(credentials.password as string);
  await page.getByRole("button", { name: /acessar sistema/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
  const state = await context.storageState();
  await context.close();
  return state;
}

type Opened = Awaited<ReturnType<typeof open>>;

async function open(
  browser: Browser,
  options: { project?: string; history?: (route: Route) => Promise<void>; monitoring?: (route: Route) => Promise<void>; viewport?: { width: number; height: number } } = {},
) {
  const context = await browser.newContext({ locale: "pt-BR", baseURL: WEB, storageState: session, viewport: options.viewport ?? { width: 1440, height: 900 } });
  const page = await context.newPage();
  const project = options.project ?? PROJECT;
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(API) && request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`);
  });
  const monitoringBodies: unknown[] = [];
  const historyBodies: unknown[] = [];
  await page.route(`${API}/projects/${project}/schedule-monitoring`, async (route) => {
    if (options.monitoring) return options.monitoring(route);
    const response = await route.fetch();
    monitoringBodies.push(await response.json());
    return route.fulfill({ response });
  });
  await page.route(new RegExp(`${API}/projects/${project}/schedule-history.*`), async (route) => {
    if (options.history) return options.history(route);
    const response = await route.fetch();
    historyBodies.push(await response.json());
    return route.fulfill({ response });
  });
  await page.goto(`/projetos/${project}`);
  const panel = page.locator("[data-widget=planejamento]");
  await panel.scrollIntoViewIfNeeded();
  return { context, page, panel, writes, monitoringBodies, historyBodies };
}

const fail = (route: Route) =>
  route.fulfill({ status: 500, headers: CORS, contentType: "application/json", body: JSON.stringify({ message: "falha simulada", code: "X" }) });

test.beforeAll(async ({ browser }) => {
  session = await login(browser);
});

// PENDENTE: estes testes cobrem o antigo painel Planejamento (histórico de reprogramações e participantes dentro do cartão). Na nova Visão Geral
// o cartão virou "Prazo e cronograma"; histórico e solicitações moveram para a página Cronograma e os participantes para o card Equipe.
// Reescrever contra a nova estrutura antes de reativar.
test.describe.skip("Painel de Planejamento (estrutura anterior)", () => {
  test("mostra cabeçalho, indicadores, cronograma, reprogramações, contexto e participantes com dados reais", async ({ browser }) => {
    const { context, page, panel, writes, monitoringBodies, historyBodies } = await open(browser);
    await expect(panel.getByText("Preenchimento")).toBeVisible();
    await expect(panel.getByText(/\d de 8 campos/)).toBeVisible();
    await expect(panel.getByTestId("planning-deadline-situation")).toBeVisible();
    for (const label of ["Prazo vigente", "Desvio da linha de base", "Reprogramações", "Marcos concluídos"]) {
      await expect(panel.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(panel.getByRole("heading", { name: /Cronograma/ })).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Reprogramações e solicitações" })).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Contexto e planejamento" })).toBeVisible();
    // Os participantes e o aviso de cadastro incompleto ficam fora do cartão: card Equipe e faixa no topo da Visão Geral.
    await expect(page.getByRole("heading", { name: "Equipe" })).toBeVisible();

    // Patrocinador: o papel não existe; a limitação aparece e nenhum outro papel o preenche.
    await expect(page.getByText(/papel ainda não implementado/).first()).toBeVisible();
    await expect(page.getByText(/pendente de implementação estrutural/)).toBeVisible();

    // Os números vêm das mesmas consultas da API (sem valores fictícios).
    const monitoring = monitoringBodies.at(-1) as { reschedules: { total: number }; items: { entityType: string; status: string }[] };
    // Histórico unificado x monitoramento: sem registro vinculado a solicitação, as reprogramações efetivadas coincidem.
    const history = historyBodies.at(-1) as { counts: { legacyDirect: number }; lastRescheduleAt: string | null };
    expect(history.counts.legacyDirect).toBe(monitoring.reschedules.total);
    expect(history.lastRescheduleAt !== null).toBe(monitoring.reschedules.total > 0);
    const tile = panel.getByText("Reprogramações", { exact: true }).first().locator("xpath=..");
    await expect(tile).toContainText(String(monitoring.reschedules.total));
    const milestones = monitoring.items.filter((item) => item.entityType === "MILESTONE");
    const done = milestones.filter((item) => item.status === "APROVADO").length;
    if (milestones.length > 0) {
      await expect(panel.getByText(`${done} de ${milestones.length}`, { exact: true })).toBeVisible();
    }
    if (SHOTS) await panel.screenshot({ path: `${SHOTS}/planejamento-desktop.png` });
    expect(writes).toEqual([]);
    await context.close();
    void page;
  });

  test("Ver todas expande o histórico completo; registros antigos aparecem como efetivados diretamente, sem solicitante nem aprovador inventados", async ({ browser }) => {
    const { context, panel, writes, historyBodies } = await open(browser);
    type Counts = { legacyDirect: number; initialDefinitions: number; requests: Record<string, number> };
    await expect.poll(() => historyBodies.length).toBeGreaterThan(0);
    const counts = (historyBodies.at(-1) as { counts: Counts }).counts;
    const total = counts.legacyDirect + Object.values(counts.requests).reduce((sum, value) => sum + value, 0);
    test.skip(total === 0, "Projeto sem reprogramações ou solicitações.");
    await expect(panel.getByRole("button", { name: "Detalhes" }).first()).toBeVisible();
    if (total > 3) {
      await expect(panel.getByRole("button", { name: `Ver todas (${total})` })).toBeVisible();
      await panel.getByRole("button", { name: `Ver todas (${total})` }).click();
      await expect(panel.getByRole("button", { name: "Ver menos" })).toBeVisible();
      // A lista completa inclui também as definições iniciais de datas (que não entram na contagem do botão).
      await expect(panel.getByRole("button", { name: "Detalhes" })).toHaveCount(total + counts.initialDefinitions);
    }
    const legacy = panel.locator("li[data-source=LEGACY_DIRECT]").first();
    if (counts.legacyDirect > 0) {
      await expect(legacy.getByTestId("history-status")).toHaveText("Efetivada diretamente (modelo anterior)");
      await legacy.getByRole("button", { name: "Detalhes" }).click();
      await expect(legacy.getByText("Justificativa", { exact: true })).toBeVisible();
      await expect(legacy.getByText("Registrado por", { exact: true })).toBeVisible();
      await expect(legacy.getByText("Solicitante", { exact: true })).toBeVisible();
      await expect(legacy.getByText("Não registrado (modelo anterior)")).toHaveCount(2);
      await expect(legacy.getByText("Não classificado")).toBeVisible();
    }
    // Nada do modelo anterior é apresentado como solicitação, aprovação ou pendência.
    await expect(panel.locator("li[data-source=LEGACY_DIRECT]").getByText(/pendente de análise|aprovada|rejeitada/i)).toHaveCount(0);
    expect(writes).toEqual([]);
    await context.close();
  });

  test("solicitação pendente (demo-proj-06): aparece como pendente de análise, com datas propostas, e não altera o prazo vigente", async ({ browser }) => {
    const { context, panel, writes } = await open(browser, { project: "demo-proj-06" });
    await expect(panel.getByRole("status", { name: "Carregando as reprogramações" })).toHaveCount(0);
    const row = panel.locator("li[data-status=PENDENTE]").first();
    test.skip((await row.count()) === 0, "Projeto de demonstração sem solicitação pendente.");
    await expect(panel.getByTestId("planning-pending-requests")).toHaveText(/1 solicitação pendente de análise/);
    await expect(row.getByTestId("history-status")).toHaveText("Pendente de análise");
    await expect(row.getByText(/^Proposta:/)).toBeVisible();
    // Proposta pendente não tem variação de prazo (não mudou nada).
    await expect(row.getByText(/^[+−]\d+ d$/)).toHaveCount(0);
    await row.getByRole("button", { name: "Detalhes" }).click();
    await expect(row.getByText("Aguardando análise")).toBeVisible();
    if (SHOTS) await panel.locator("section[aria-label='Reprogramações e solicitações']").screenshot({ path: `${SHOTS}/historico-pendente.png` });
    await expect(row.getByText("Solicitante", { exact: true })).toBeVisible();
    expect(writes).toEqual([]);
    await context.close();
  });

  test("solicitação aprovada (demo-proj-07): mostra analista e a decisão", async ({ browser }) => {
    const { context, panel, writes } = await open(browser, { project: "demo-proj-07" });
    await expect(panel.getByRole("status", { name: "Carregando as reprogramações" })).toHaveCount(0);
    const row = panel.locator("li[data-status=APROVADA]").first();
    test.skip((await row.count()) === 0, "Projeto de demonstração sem solicitação aprovada.");
    await expect(row.getByTestId("history-status")).toHaveText("Aprovada");
    await row.getByRole("button", { name: "Detalhes" }).click();
    await expect(row.getByText("Analisado por", { exact: true })).toBeVisible();
    await expect(row.getByText("Decisão em", { exact: true })).toBeVisible();
    expect(writes).toEqual([]);
    await context.close();
  });

  test("carregando: esqueletos no lugar dos indicadores, sem valores", async ({ browser }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { context, panel } = await open(browser, {
      monitoring: async (route) => {
        await gate;
        const response = await route.fetch();
        return route.fulfill({ response, headers: { ...response.headers(), ...CORS } });
      },
    });
    await expect(panel.getByRole("status", { name: "Carregando os indicadores do planejamento" })).toBeVisible();
    await expect(panel.getByRole("status", { name: "Carregando o cronograma" })).toBeVisible();
    await expect(panel.getByTestId("planning-deadline-situation")).toHaveCount(0);
    release();
    await expect(panel.getByText("Desvio da linha de base")).toBeVisible();
    await context.close();
  });

  test("falha no monitoramento: indisponível, sem inventar prazo, desvio nem situação", async ({ browser }) => {
    const { context, panel } = await open(browser, { monitoring: fail });
    await expect(panel.getByText("Não foi possível consultar os indicadores do planejamento.")).toBeVisible();
    await expect(panel.getByText("Não foi possível consultar o cronograma.")).toBeVisible();
    await expect(panel.getByTestId("planning-deadline-situation")).toHaveCount(0);
    await context.close();
  });

  test("falha nas reprogramações: aviso próprio e o resto do painel continua", async ({ browser }) => {
    const { context, panel } = await open(browser, { history: fail });
    await expect(panel.getByText("Não foi possível consultar as reprogramações.")).toBeVisible();
    await expect(panel.getByText("Prazo vigente", { exact: true })).toBeVisible();
    await context.close();
  });

  test("indicadores complementares: sinalizadas ao PMO e itens concluídos com atraso vêm da API", async ({ browser }) => {
    const { context, panel, monitoringBodies, writes } = await open(browser);
    await expect(panel.getByTestId("planning-escalated")).toBeVisible();
    const monitoring = monitoringBodies.at(-1) as { reschedules: { escalated: number }; items: { deadlinePerformance: string | null }[] };
    await expect(panel.getByTestId("planning-escalated")).toHaveText(String(monitoring.reschedules.escalated));
    const doneLate = monitoring.items.filter((item) => item.deadlinePerformance === "DONE_LATE").length;
    await expect(panel.getByTestId("planning-done-late")).toHaveText(String(doneLate));
    expect(writes).toEqual([]);
    await context.close();
  });

  test("lista completa de participantes: recolhida, abre e mostra todos os vinculados", async ({ browser }) => {
    const { context, page, panel } = await open(browser);
    const response = await page.request.get(`${API}/projects/${PROJECT}/members`);
    expect(response.ok()).toBeTruthy();
    const members = ((await response.json()) as { data: { user: { name: string } }[] }).data;
    const trigger = panel.getByRole("button", { name: `Ver todos os participantes (${members.length})` });
    await expect(trigger).toBeVisible();
    const list = panel.getByRole("list", { name: "Todos os participantes do projeto" });
    await expect(list).toHaveCount(0);
    await trigger.click();
    await expect(list).toBeVisible();
    await expect(list.getByRole("listitem")).toHaveCount(members.length);
    for (const member of members) await expect(list.getByText(member.user.name).first()).toBeVisible();
    await panel.getByRole("button", { name: "Ocultar participantes" }).click();
    await expect(list).toHaveCount(0);
    await context.close();
  });

  test("#cronograma: a URL com âncora leva até a seção do cronograma", async ({ browser }) => {
    const context = await browser.newContext({ locale: "pt-BR", baseURL: WEB, storageState: session, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(`/projetos/${PROJECT}#cronograma`);
    await expect(page.locator("#cronograma")).toBeInViewport({ timeout: 8000 });
    await expect.poll(async () => page.locator("#cronograma").evaluate((el) => Math.round(el.getBoundingClientRect().top)), { timeout: 8000 }).toBeLessThan(200);
    await context.close();
  });

  test("lista de projetos: \"Consultar cronograma\" abre a Visão Geral já no cronograma", async ({ browser }) => {
    const context = await browser.newContext({ locale: "pt-BR", baseURL: WEB, storageState: session, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto("/projetos");
    const trigger = page.getByRole("button", { name: /^Ações de / }).first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    await page.getByRole("menuitem", { name: "Consultar cronograma" }).click();
    await expect(page).toHaveURL(/\/projetos\/[^/]+#cronograma$/);
    await expect(page.locator("#cronograma")).toBeInViewport({ timeout: 10000 });
    await context.close();
  });

  test("celular: sem rolagem horizontal", async ({ browser }) => {
    const { context, page, panel } = await open(browser, { viewport: { width: 390, height: 844 } });
    await expect(panel.getByText("Prazo vigente", { exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    if (SHOTS) await panel.screenshot({ path: `${SHOTS}/planejamento-mobile.png` });
    await context.close();
  });
});

export type { Opened };
