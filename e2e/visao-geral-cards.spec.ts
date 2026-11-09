import { expect, test, type Browser, type BrowserContext, type Route } from "@playwright/test";

/**
 * Cards "Situação atual e próxima entrega" e "Resumo executivo" da Visão Geral do projeto (Etapa 87).
 * Entra pelo login do PMO (credenciais só em variáveis de ambiente: E2E_PMO_EMAIL / E2E_PMO_PASSWORD) e usa um projeto
 * de demonstração (E2E_PROJECT_ID, padrão "demo-proj-05"). Nada é gravado: os estados (Crítico, Em atenção, Em dia, com e
 * sem próxima entrega) são obtidos ALTERANDO NA REDE a resposta real das consultas de leitura (`page.route`), e o diálogo
 * de validação é aberto e cancelado, sem confirmar.
 */
const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const WEB = process.env.E2E_BASE_URL ?? "http://localhost:3001";
const PROJECT = process.env.E2E_PROJECT_ID ?? "demo-proj-05";
const CORS = { "access-control-allow-origin": WEB, "access-control-allow-credentials": "true" };
const credentials = { email: process.env.E2E_PMO_EMAIL, password: process.env.E2E_PMO_PASSWORD };

// Corpo das respostas da API é alterado de forma pontual; tipar cada campo geraria ruído sem ganho no teste.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;
type Patch = {
  monitoring?: (data: Json) => void;
  summary?: (data: Json) => void;
  /** Substitui a consulta de monitoramento inteira (para simular demora ou falha). */
  monitoringRoute?: (route: Route) => Promise<void>;
  /** Não espera os dados chegarem (estado de carregamento). */
  skipWait?: boolean;
};

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

/** Repassa a consulta real e, se pedido, altera o JSON da resposta (só leitura; nada é gravado). */
async function patched(route: Route, change?: (data: Json) => void) {
  const response = await route.fetch();
  const body = (await response.json()) as Json;
  change?.(body);
  await route.fulfill({ response, headers: { ...response.headers(), ...CORS }, body: JSON.stringify(body) });
}

async function open(browser: Browser, patch: Patch = {}, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ locale: "pt-BR", baseURL: WEB, storageState: session, viewport });
  const page = await context.newPage();
  await page.route(`${API}/projects/${PROJECT}/schedule-monitoring`, (route) => (patch.monitoringRoute ? patch.monitoringRoute(route) : patched(route, patch.monitoring)));
  await page.route(`${API}/projects/${PROJECT}/executive-summary`, (route) => patched(route, patch.summary));
  await page.goto(`/projetos/${PROJECT}`);
  const situation = page.locator("[data-widget=situacao]");
  const summary = page.locator("[data-widget=resumo]");
  await expect(situation.getByText("Próxima entrega prevista")).toBeVisible();
  if (!patch.skipWait) {
    await expect(summary.getByText("Validação do PMO (registro oficial)")).toBeVisible();
  }
  // Cabeçalho da Visão Geral (selo da situação do projeto).
  const header = page.locator("h1").locator("xpath=ancestor::header[1]");
  return { context, page, situation, summary, header };
}


test.beforeAll(async ({ browser }) => {
  session = await login(browser);
});

test.describe("Visão Geral: Situação atual e Resumo executivo", () => {
  test("renderiza os dois cards com a estrutura da referência", async ({ browser }) => {
    const { context, situation, summary } = await open(browser);
    await expect(situation.getByRole("heading", { name: "Situação atual e próxima entrega" }).or(situation.getByText("Situação atual e próxima entrega"))).toBeVisible();
    await expect(situation.getByText("Como está o projeto neste momento e o que precisa de atenção.")).toBeVisible();
    await expect(situation.getByText(/^(Item|Itens) em atraso$/)).toBeVisible();
    await expect(situation.getByText(/Homologações? pendentes?/)).toBeVisible();
    await expect(situation.getByText(/Impedimentos? ativos?/)).toBeVisible();
    await expect(situation.getByRole("button", { name: /Ver itens na EAP/ })).toBeVisible();
    // Não duplica o que é do Resumo.
    await expect(situation.getByText(/Progresso consolidado|Reprogramações|Histórico de validações/)).toHaveCount(0);

    await expect(summary.getByText("Panorama consolidado do projeto e validação do PMO.")).toBeVisible();
    await expect(summary.getByText(/^Situação atual:/)).toBeVisible();
    await expect(summary.getByRole("progressbar", { name: "Progresso consolidado do projeto" })).toBeVisible();
    await expect(summary.getByText("Reprogramações", { exact: true })).toBeVisible();
    await expect(summary.getByText("Aguardando homologação", { exact: true })).toBeVisible();
    await expect(summary.getByText("Em correção", { exact: true })).toBeVisible();
    await context.close();
  });

  test("indicadores dos dois cards concordam entre si e com o texto executivo", async ({ browser }) => {
    const seen: { monitoring?: Json; summary?: Json } = {};
    const { context, situation, summary } = await open(browser, {
      monitoring: (data) => (seen.monitoring = structuredClone(data)),
      summary: (data) => (seen.summary = structuredClone(data)),
    });
    const delayed = seen.monitoring!.situation.delayedItems as number;
    expect(delayed).toBe(seen.summary!.overdue.total);
    expect(seen.monitoring!.situation.delayDays).toBe(seen.summary!.situation.delayDays);
    expect(seen.monitoring!.situation.status).toBe(seen.summary!.situation.status);
    await expect(situation.getByText(String(delayed).padStart(2, "0"), { exact: true }).first()).toBeVisible();
    const narrative = (await summary.getByText(/^Situação atual:/).textContent()) ?? "";
    expect(narrative).toContain(delayed === 1 ? "1 item em atraso" : `${delayed} itens em atraso`);
    const pending = seen.monitoring!.situation.pendingValidation as number;
    await expect(summary.getByText(String(seen.summary!.homologation.awaiting), { exact: true }).first()).toBeVisible();
    expect(seen.summary!.homologation.awaiting).toBe(pending);
    await context.close();
  });

  for (const [status, label, days, tint] of [
    ["CRITICO", "Crítico", 9, /destructive/],
    ["EM_ATENCAO", "Em atenção", 3, /warning/],
    ["EM_EXECUCAO", "Em execução", 0, /primary/],
    ["EM_VALIDACAO", "Em validação", 0, /primary/],
  ] as const) {
    test(`situação ${label}: faixa, maior atraso e selo do resumo`, async ({ browser }) => {
      const change = (data: Json) => {
        data.situation.status = status;
        data.situation.delayDays = days;
      };
      const { context, situation, summary } = await open(browser, { monitoring: change, summary: change });
      const text = situation.getByText(label, { exact: true });
      await expect(text).toBeVisible();
      const banner = text.locator("xpath=ancestor::div[contains(@class,'rounded-lg')][1]");
      await expect(banner).toHaveClass(tint);
      if (days > 0) {
        await expect(banner.getByText(`Maior atraso em ${days} dias.`)).toBeVisible();
      } else {
        await expect(situation.getByText("Maior atraso em")).toHaveCount(0);
      }
      await expect(summary.getByText(label, { exact: true }).first()).toBeVisible();
      await context.close();
    });
  }

  test("próxima entrega: mostra a prevista e, sem ela, a mensagem de ausência", async ({ browser }) => {
    const milestone = (extra: Json) => ({
      entityType: "MILESTONE",
      entityId: "m-e2e",
      title: "Homologação simulada",
      phaseName: "Fase simulada",
      status: "PENDENTE",
      plannedStartAt: "2027-03-10T15:00:00.000Z",
      plannedEndAt: "2027-03-10T15:00:00.000Z",
      overdue: false,
      ...extra,
    });
    const withNext = await open(browser, {
      monitoring: (data) => {
        data.items = [...data.items.filter((item: Json) => item.entityType !== "MILESTONE"), milestone({})];
      },
    });
    await expect(withNext.situation.getByText("Homologação simulada")).toBeVisible();
    await expect(withNext.situation.getByText(/Prazo: 10 Mar 2027/)).toBeVisible();
    await withNext.context.close();

    const none = await open(browser, {
      monitoring: (data) => {
        data.items = data.items.filter((item: Json) => item.entityType !== "MILESTONE");
      },
    });
    await expect(none.situation.getByText("Nenhuma entrega futura prevista")).toBeVisible();
    await none.context.close();
  });

  test("Validar resumo abre o diálogo e o histórico de validações expande, sem gravar nada", async ({ browser }) => {
    const writes: string[] = [];
    const { context, page, summary } = await open(browser);
    page.on("request", (request) => request.method() !== "GET" && request.url().includes("executive-summary") && writes.push(request.method()));
    const validate = summary.getByRole("button", { name: /Validar resumo|Validação extraordinária/ });
    await expect(validate).toBeVisible();
    await validate.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Cancelar|Fechar/ }).first().click();
    await expect(dialog).toBeHidden();

    const history = summary.getByRole("button", { name: "Histórico de validações" });
    await history.click();
    await expect(history).toHaveAttribute("aria-expanded", "true");
    await history.click();
    await expect(history).toHaveAttribute("aria-expanded", "false");
    expect(writes).toEqual([]);
    await context.close();
  });

  test("navegação: Ver itens na EAP leva à EAP e o teclado alcança os controles dos cards", async ({ browser }) => {
    const { context, page, situation, summary } = await open(browser);
    await situation.getByRole("button", { name: /Ver itens na EAP/ }).focus();
    await expect(situation.getByRole("button", { name: /Ver itens na EAP/ })).toBeFocused();
    await summary.getByRole("button", { name: "Histórico de validações" }).focus();
    await expect(summary.getByRole("button", { name: "Histórico de validações" })).toBeFocused();
    await situation.getByRole("button", { name: /Ver itens na EAP/ }).press("Enter");
    // Destino efetivo: a aba da EAP do mesmo projeto, e a Visão Geral (com os dois cards) sai da tela.
    await expect(page).toHaveURL(`${WEB}/projetos/${PROJECT}?aba=eap`);
    await expect(situation).toHaveCount(0);
    await expect(page.getByText("Visão geral do projeto")).toHaveCount(0);
    await context.close();
  });

  test("responsividade: no celular os cards cabem na tela, sem rolagem horizontal", async ({ browser }) => {
    const { context, page, situation, summary } = await open(browser, {}, { width: 390, height: 844 });
    for (const card of [situation, summary]) {
      await card.scrollIntoViewIfNeeded();
      const box = await card.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(391);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await context.close();
  });
});

const HEALTH = /^(Crítico|Em atenção|Em execução|Em validação|Não iniciado|Concluído|Suspenso)$/;

test.describe("Visão Geral: situação sem dados do monitoramento", () => {
  test("carregamento: skeleton neutro, sem nenhum status até a API responder", async ({ browser }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { context, situation, header } = await open(browser, {
      skipWait: true,
      monitoringRoute: async (route) => {
        await gate;
        await patched(route);
      },
    });
    await expect(situation.getByRole("status").filter({ hasText: "Carregando a situação do projeto" })).toBeVisible();
    await expect(header.getByRole("status", { name: "Carregando a situação do projeto" })).toBeVisible();
    await expect(situation.getByText(HEALTH)).toHaveCount(0);
    await expect(header.getByText(HEALTH)).toHaveCount(0);

    release();
    await expect(situation.getByRole("status").filter({ hasText: "Carregando a situação do projeto" })).toHaveCount(0);
    await expect(situation.getByText(HEALTH)).toHaveCount(1);
    await expect(header.getByText(HEALTH)).toHaveCount(1);
    await context.close();
  });

  test("falha no monitoramento: indica indisponibilidade e não mostra status de ciclo de vida como saúde", async ({ browser }) => {
    const { context, situation, header } = await open(browser, {
      monitoringRoute: (route) => route.fulfill({ status: 500, contentType: "application/json", headers: CORS, body: JSON.stringify({ message: "falha simulada" }) }),
    });
    await expect(situation.getByText("Situação indisponível")).toBeVisible();
    await expect(header.getByText("Situação indisponível")).toBeVisible();
    await expect(situation.getByText("Não foi possível consultar os prazos do projeto.")).toBeVisible();
    await expect(situation.getByText(HEALTH)).toHaveCount(0);
    await expect(header.getByText(HEALTH)).toHaveCount(0);
    await expect(situation.getByText(/Maior atraso em/)).toHaveCount(0);
    await context.close();
  });
});

const DEADLINE_LABELS = /^(Concluído|Atrasado|Em atenção|No prazo|Sem compromissos datados)$/;

test.describe("Visão Geral: indicador de prazo igual ao selo do Planejamento", () => {
  /** Linha de situação do indicador "Prazo vigente" (topo) e o selo do Planejamento, ambos lidos da mesma consulta. */
  function scopes(page: Awaited<ReturnType<typeof open>>["page"]) {
    return {
      indicator: page.getByText("Prazo vigente", { exact: true }).locator("xpath=.."),
      planning: page.getByTestId("planning-deadline-situation"),
    };
  }

  for (const [nome, change, label] of [
    ["atrasado", { status: "ATRASADO", overdueCommitments: 2 }, "Atrasado"],
    ["em atenção", { status: "EM_ATENCAO", overdueCommitments: 0 }, "Em atenção"],
    ["no prazo", { status: "NO_PRAZO", hasDatedCommitments: true, overdueCommitments: 0 }, "No prazo"],
    ["concluído", { status: "CONCLUIDO" }, "Concluído"],
    ["sem compromissos datados", { status: "NO_PRAZO", hasDatedCommitments: false, overdueCommitments: 0 }, "Sem compromissos datados"],
  ] as const) {
    test(`${nome}: os dois indicadores mostram "${label}" com a mesma explicação`, async ({ browser }) => {
      const { context, page } = await open(browser, { monitoring: (data) => Object.assign(data.deadlineSituation, change) });
      const { indicator, planning } = scopes(page);
      const top = indicator.getByText(label, { exact: true });
      const badge = planning.getByText(label, { exact: true });
      await expect(top).toBeVisible();
      await expect(badge).toBeVisible();
      await expect(top).toHaveAttribute("title", (await badge.getAttribute("title")) ?? "");
      // Mesmas cores: as classes de fundo e de texto do selo (a cor tem significado) são idênticas nos dois.
      const colors = async (element: typeof top) => ((await element.getAttribute("class")) ?? "").split(/\s+/).filter((name) => /^(bg|text)-[a-z]/.test(name)).sort();
      expect(await colors(top)).toEqual(await colors(badge));
      expect((await colors(top)).length).toBeGreaterThan(0);
      // A classificação antiga (prazo final vencido ou não) não aparece mais no indicador.
      await expect(indicator.getByText(/Prazo vencido|Dentro do planejamento/)).toHaveCount(0);
      await context.close();
    });
  }

  test("suspenso (status nulo): nenhum dos dois mostra situação de prazo", async ({ browser }) => {
    const { context, page } = await open(browser, { monitoring: (data) => Object.assign(data.deadlineSituation, { status: null }) });
    const { indicator, planning } = scopes(page);
    await expect(indicator.getByText(DEADLINE_LABELS)).toHaveCount(0);
    await expect(planning.getByText(DEADLINE_LABELS)).toHaveCount(0);
    await expect(indicator.getByText(/Situação do prazo indisponível/)).toHaveCount(0);
    await context.close();
  });

  test("carregamento: estado neutro, sem classificação, até a API responder", async ({ browser }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { context, page } = await open(browser, {
      skipWait: true,
      monitoringRoute: async (route) => {
        await gate;
        await patched(route, (data) => Object.assign(data.deadlineSituation, { status: "ATRASADO" }));
      },
    });
    const { indicator } = scopes(page);
    await expect(indicator.getByRole("status", { name: "Carregando a situação do prazo" })).toBeVisible();
    await expect(indicator.getByText(DEADLINE_LABELS)).toHaveCount(0);
    release();
    await expect(indicator.getByText("Atrasado", { exact: true })).toBeVisible();
    await expect(indicator.getByRole("status", { name: "Carregando a situação do prazo" })).toHaveCount(0);
    await context.close();
  });

  test("falha na consulta: indisponível, sem recorrer à classificação antiga", async ({ browser }) => {
    const { context, page } = await open(browser, {
      monitoringRoute: (route) => route.fulfill({ status: 500, contentType: "application/json", headers: CORS, body: JSON.stringify({ message: "falha simulada" }) }),
    });
    const { indicator } = scopes(page);
    await expect(indicator.getByText("Situação do prazo indisponível")).toBeVisible();
    await expect(indicator.getByText(DEADLINE_LABELS)).toHaveCount(0);
    await expect(indicator.getByText(/Prazo vencido|Dentro do planejamento/)).toHaveCount(0);
    await context.close();
  });
});
