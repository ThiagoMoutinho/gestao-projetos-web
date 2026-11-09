import { expect, test, type Browser, type BrowserContext, type Page, type Route } from "@playwright/test";

/**
 * Central de Notificações (Etapa 3.5A). Cada perfil entra pela tela de login (credenciais só em variáveis de ambiente):
 *   E2E_PMO_EMAIL / E2E_PMO_PASSWORD        perfil PMO (vê "Todas")
 *   E2E_COLAB_EMAIL / E2E_COLAB_PASSWORD    perfil sem acesso administrativo (só "Minhas")
 *
 * Nada altera dados reais: as chamadas de notificações que mudariam estado (marcar como lida) são SIMULADAS na rede
 * (`page.route`), e as listas usam respostas simuladas, inclusive a Central vazia: nenhum teste depende de existirem ou não
 * notificações (reais ou de demonstração) no ambiente em que roda.
 */
const API = process.env.E2E_API_URL ?? "http://localhost:3000";
const WEB = process.env.E2E_BASE_URL ?? "http://localhost:3001";
const CORS = { "access-control-allow-origin": WEB, "access-control-allow-credentials": "true" };

const pmo = { email: process.env.E2E_PMO_EMAIL, password: process.env.E2E_PMO_PASSWORD };
const colab = { email: process.env.E2E_COLAB_EMAIL, password: process.env.E2E_COLAB_PASSWORD };

async function login(browser: Browser, credentials: { email?: string; password?: string }): Promise<BrowserContext> {
  const context = await browser.newContext({ locale: "pt-BR" });
  const page = await context.newPage();
  await page.goto("/login");
  await page.locator("#email").fill(credentials.email as string);
  await page.locator("#password").fill(credentials.password as string);
  await page.getByRole("button", { name: /acessar sistema/i }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await page.close();
  return context;
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: "application/json", headers: CORS, body: JSON.stringify(body) });

type Seed = { id: string; kind?: string; project?: string; projectId?: string; readAt?: string | null; resolved?: boolean; reason?: string };

function inboxItem(seed: Seed) {
  return {
    deliveryId: `d-${seed.id}`,
    visibility: "TO",
    deliveredAt: "2026-11-12T12:00:00.000Z",
    readAt: seed.readAt ?? null,
    notification: {
      id: seed.id,
      projectId: seed.projectId ?? "proj-1",
      projectName: seed.project ?? "Projeto Alfa",
      kind: seed.kind ?? "OVERDUE",
      cycleStart: "2026-11-05",
      sequenceStart: seed.kind === "ESCALATION" ? "2026-10-22" : null,
      dueDate: "2026-11-11",
      scheduledFor: "2026-11-12T12:00:00.000Z",
      title: `Título ${seed.id}`,
      body: `Corpo congelado ${seed.id}\nSegunda linha.`,
      createdAt: "2026-11-12T12:00:00.000Z",
      resolvedAt: seed.resolved ? "2026-11-13T12:00:00.000Z" : null,
      resolutionReason: seed.resolved ? (seed.reason ?? "VALIDATED") : null,
    },
  };
}

function allItem(seed: Seed & { recipients?: number; unread?: number }) {
  const n = inboxItem(seed).notification;
  return { ...n, recipients: seed.recipients ?? 2, unread: seed.unread ?? 1 };
}

const PROJECTS = { data: [{ id: "proj-1", name: "Projeto Alfa", description: null, glpiTicketId: null, pmoGlpiTicketId: null, ownerId: "o", status: "EM_EXECUCAO", roles: [] }] };

/** Simula as listas (e a de projetos) sem tocar na API real. */
async function mockLists(page: Page, handlers: { inbox?: (url: URL) => unknown; all?: (url: URL) => unknown }) {
  await page.route(`${API}/projects`, (route) => json(route, PROJECTS));
  await page.route(`${API}/notifications/inbox**`, (route) => {
    const url = new URL(route.request().url());
    return json(route, handlers.inbox ? handlers.inbox(url) : { data: [], unread: 0, nextCursor: null });
  });
  await page.route(/\/notifications(\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    return json(route, handlers.all ? handlers.all(url) : { data: [], nextCursor: null });
  });
}

test.describe("sem login", () => {
  test("redireciona a Central de Notificações para o login", async ({ page }) => {
    await page.goto("/notificacoes");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("perfil PMO", () => {
  test.skip(!pmo.email || !pmo.password, "Defina E2E_PMO_EMAIL e E2E_PMO_PASSWORD.");
  let context: BrowserContext;
  test.beforeAll(async ({ browser }) => {
    context = await login(browser, pmo);
  });
  test.afterAll(async () => context?.close());

  test("ambiente controlado (listas vazias simuladas): a Central abre com as duas abas e o estado vazio", async () => {
    const page = await context.newPage();
    // Sem handlers, mockLists devolve as listas vazias: o resultado não depende dos dados do ambiente (real ou prévia).
    await mockLists(page, {});
    await page.goto("/notificacoes");
    await expect(page.getByRole("heading", { name: "Central de Notificações" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Minhas notificações/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Todas as notificações" })).toBeVisible();
    await expect(page.getByText("Nenhuma notificação por aqui")).toBeVisible();
    await expect(page.getByText(/nenhuma não lida/).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Internal Server Error|Application error/i);
    // O menu lateral não tem mais o item (a rota continua existindo); o acesso é pelo sino do cabeçalho.
    await expect(page.locator('a[href="/notificacoes"]')).toHaveCount(0); // nenhum link para a Central no menu lateral
    await expect(page.getByRole("button", { name: /Notificações: nenhuma não lida/ })).toBeVisible();
    await page.close();
  });

  test("separa leitura de pendência e mostra conteúdo congelado, sem botão de exclusão", async () => {
    const page = await context.newPage();
    await mockLists(page, {
      inbox: () => ({
        data: [
          inboxItem({ id: "a1", kind: "ESCALATION" }),
          inboxItem({ id: "a2", kind: "OVERDUE", readAt: "2026-11-12T13:00:00.000Z" }),
          inboxItem({ id: "a3", kind: "PREVENTIVE", resolved: true, reason: "CYCLE_EXPIRED" }),
        ],
        unread: 2,
        nextCursor: null,
      }),
    });
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith(API)) requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    });
    await page.goto("/notificacoes");
    const list = page.getByRole("list", { name: "Minhas notificações" });
    const first = list.getByRole("listitem").filter({ hasText: "Título a1" });
    const second = list.getByRole("listitem").filter({ hasText: "Título a2" });
    const third = list.getByRole("listitem").filter({ hasText: "Título a3" });
    await expect(first.getByText("Escalonamento", { exact: true })).toBeVisible();
    // Eixos independentes, sempre lado a lado.
    await expect(first.getByText("Não lida", { exact: true })).toBeVisible();
    await expect(first.getByText("Pendente", { exact: true })).toBeVisible();
    await expect(second.getByText("Lida", { exact: true })).toBeVisible();
    await expect(second.getByText("Pendente", { exact: true })).toBeVisible(); // lida e ainda pendente
    await expect(third.getByText("Não lida", { exact: true })).toBeVisible();
    await expect(third.getByText(/Resolvida/)).toContainText("Prazo do ciclo encerrado"); // não lida e já resolvida
    await expect(page.getByText(/2 não lidas/).first()).toBeVisible();
    // Conteúdo congelado exibido como veio, direto no cartão (não há mais "Ver detalhes").
    await expect(first.getByText("Corpo congelado a1", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ver detalhes|Ocultar detalhes/ })).toHaveCount(0);
    // Nenhum controle de exclusão e nenhuma chamada que altere dados.
    await expect(page.getByRole("button", { name: /excluir|apagar|remover|deletar/i })).toHaveCount(0);
    expect(requests.filter((request) => !request.startsWith("GET"))).toEqual([]);
    await page.close();
  });

  test("marcar como lida só muda a leitura depois da confirmação da API e não resolve a pendência", async () => {
    const page = await context.newPage();
    let unread = 1;
    let attempt = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await mockLists(page, {
      inbox: () => ({ data: [inboxItem({ id: "b1", readAt: unread === 0 ? "2026-11-14T10:00:00.000Z" : null })], unread, nextCursor: null }),
    });
    await page.route(`${API}/notifications/deliveries/*/read`, async (route) => {
      attempt += 1;
      if (attempt === 1) return json(route, { message: "Falha simulada.", code: "X" }, 500);
      await gate;
      unread = 0;
      return json(route, { deliveryId: "d-b1", readAt: "2026-11-14T10:00:00.000Z" });
    });
    await page.goto("/notificacoes");
    const card = page.getByRole("listitem").filter({ hasText: "Título b1" });
    const mark = card.getByRole("button", { name: "Marcar como lida" });

    await mark.click(); // 1ª tentativa: a API falha
    await expect(page.getByText("Não foi possível marcar a notificação como lida.")).toBeVisible();
    await expect(card.getByText("Não lida", { exact: true })).toBeVisible();

    await mark.click(); // 2ª tentativa: a resposta fica retida
    await expect(mark).toBeDisabled();
    await expect(card.getByText("Não lida", { exact: true })).toBeVisible(); // ainda não confirmou: nada muda
    release();
    await expect(card.getByText("Lida", { exact: true })).toBeVisible();
    await expect(mark).toHaveCount(0); // lida: a ação some
    await expect(card.locator('[data-slot="badge"]').filter({ hasText: "Pendente" })).toBeVisible(); // ler não resolveu
    await expect(page.getByText(/nenhuma não lida/).first()).toBeVisible();
    expect(attempt).toBe(2);
    await page.close();
  });

  test("filtros viram parâmetros e a paginação por cursor acrescenta sem repetir", async () => {
    const page = await context.newPage();
    const seen: URL[] = [];
    await mockLists(page, {
      inbox: (url) => {
        seen.push(url);
        const cursor = url.searchParams.get("cursor");
        if (url.searchParams.get("limit") === "1") return { data: [], unread: 3, nextCursor: null };
        if (!cursor) return { data: [inboxItem({ id: "p1" }), inboxItem({ id: "p2" })], unread: 3, nextCursor: "CURSOR-1" };
        // A 2ª página repete p2 (como se um registro tivesse sido devolvido duas vezes): a lista não pode duplicar.
        return { data: [inboxItem({ id: "p2" }), inboxItem({ id: "p3" })], unread: 3, nextCursor: null };
      },
    });
    await page.goto("/notificacoes");
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(2);
    await page.getByRole("button", { name: "Carregar mais" }).click();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(3); // p1, p2, p3 — sem repetição
    expect(seen.some((url) => url.searchParams.get("cursor") === "CURSOR-1")).toBe(true);
    await expect(page.getByText(/Fim do histórico/)).toBeVisible();

    await expect(page.getByRole("tab", { name: "Todas", exact: true })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("tab", { name: "Não lidas", exact: true }).click();
    await expect.poll(() => seen.some((url) => url.searchParams.get("read") === "false")).toBe(true);
    await page.getByRole("combobox", { name: "Filtrar por tipo" }).click();
    await page.getByRole("option", { name: "Escalonamento" }).click();
    await expect.poll(() => seen.some((url) => url.searchParams.get("kind") === "ESCALATION" && url.searchParams.get("read") === "false")).toBe(true);
    await page.getByRole("combobox", { name: "Filtrar por pendência" }).click();
    await page.getByRole("option", { name: "Resolvidas" }).click();
    await expect.poll(() => seen.some((url) => url.searchParams.get("resolved") === "true")).toBe(true);
    await page.getByRole("tab", { name: "Lidas", exact: true }).click();
    await expect.poll(() => seen.some((url) => url.searchParams.get("read") === "true" && url.searchParams.get("resolved") === "true")).toBe(true);
    // Limpar filtros mantém a aba de leitura e preserva o histórico das lidas.
    await page.getByRole("button", { name: "Limpar filtros" }).first().click();
    await expect(page.getByRole("tab", { name: "Lidas", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => seen.at(-1)?.searchParams.get("read") === "true" && seen.at(-1)?.searchParams.get("resolved") === null).toBe(true);
    await page.getByRole("tab", { name: "Todas", exact: true }).click();
    await expect.poll(() => seen.at(-1)?.searchParams.get("read") === null).toBe(true);
    await page.close();
  });

  test("aba Todas: filtros administrativos, detalhe com destinatários e leitura de cada um", async () => {
    const page = await context.newPage();
    const seen: URL[] = [];
    await mockLists(page, {
      all: (url) => {
        seen.push(url);
        return { data: [allItem({ id: "t1", kind: "ESCALATION", recipients: 3, unread: 2 }), allItem({ id: "t2", recipients: 1, unread: 0, resolved: true })], nextCursor: null };
      },
    });
    await page.route(`${API}/notifications/t1`, (route) =>
      json(route, {
        ...allItem({ id: "t1", kind: "ESCALATION", recipients: 3, unread: 2 }),
        resolvedValidationId: null,
        runId: "r",
        deliveries: [
          { deliveryId: "d1", userId: "u1", recipientName: "Coordenadora CTIN", recipientEmail: "c@x.test", recipientRole: "COORDENADOR", visibility: "TO", deliveredAt: "2026-11-09T12:00:00.000Z", readAt: "2026-11-09T14:00:00.000Z" },
          { deliveryId: "d2", userId: "u2", recipientName: "PMO Um", recipientEmail: "p@x.test", recipientRole: "PMO", visibility: "CC", deliveredAt: "2026-11-09T12:00:00.000Z", readAt: null },
        ],
      }),
    );
    await page.goto("/notificacoes?aba=todas");
    await expect(page.getByRole("tab", { name: "Todas as notificações" })).toHaveAttribute("aria-selected", "true");
    const first = page.getByRole("listitem").filter({ hasText: "Título t1" });
    await expect(first.getByText("2 de 3 ainda não leram")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: "Título t2" }).getByText("Lida", { exact: true })).toBeVisible();
    await expect(first.getByRole("button", { name: "Marcar como lida" })).toHaveCount(0); // a leitura é individual de cada destinatário
    // "Leitura" em Todas significa o conjunto de destinatários.
    await page.getByRole("tab", { name: "Lidas", exact: true }).click();
    await expect.poll(() => seen.some((url) => url.searchParams.get("unread") === "false")).toBe(true);
    await page.close();
  });

  test("estados de erro (com nova tentativa), vazio com filtros e sem permissão", async () => {
    const page = await context.newPage();
    let fail = true;
    await mockLists(page, {
      inbox: (url) => (url.searchParams.get("limit") === "1" ? { data: [], unread: 0, nextCursor: null } : { data: [], unread: 0, nextCursor: null }),
    });
    await page.route(`${API}/notifications/inbox**`, (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("limit") !== "1" && fail) return json(route, { message: "Falha simulada.", code: "X" }, 500);
      return json(route, { data: [], unread: 0, nextCursor: null });
    });
    await page.goto("/notificacoes");
    await expect(page.getByText("Não foi possível carregar as notificações")).toBeVisible();
    fail = false;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(page.getByText("Nenhuma notificação por aqui")).toBeVisible();
    // Vazio com filtro ativo.
    await page.getByRole("combobox", { name: "Filtrar por tipo" }).click();
    await page.getByRole("option", { name: "Prazo da validação" }).click();
    await expect(page.getByText("Nenhuma notificação encontrada")).toBeVisible();
    await page.getByRole("button", { name: "Limpar filtros" }).first().click();
    await expect(page.getByText("Nenhuma notificação por aqui")).toBeVisible();
    // Sem permissão (a API recusa "Todas").
    await page.route(/\/notifications(\?.*)?$/, (route) => json(route, { message: "Sem permissão.", code: "NOTIFICATIONS_FORBIDDEN" }, 403));
    await page.getByRole("tab", { name: "Todas as notificações" }).click();
    await expect(page.getByText("Sem permissão", { exact: true })).toBeVisible();
    await page.close();
  });

  test("sino: contador em tempo real ao recuperar o foco e a cada 60 segundos", async () => {
    const page = await context.newPage();
    let unread = 2;
    let bellCalls = 0;
    await page.clock.install();
    await page.route(`${API}/notifications/inbox**`, (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("limit") === "1") bellCalls += 1;
      return json(route, { data: [], unread, nextCursor: null });
    });
    await page.route(`${API}/projects`, (route) => json(route, PROJECTS));
    await page.goto("/notificacoes");
    await expect(page.getByRole("button", { name: "Notificações: 2 não lidas" })).toBeVisible();
    await expect(page.getByTestId("notification-bell-count")).toHaveText("2");
    const afterLoad = bellCalls;
    unread = 5;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("button", { name: "Notificações: 5 não lidas" })).toBeVisible(); // ao recuperar o foco
    unread = 7;
    await page.clock.fastForward(61_000);
    await expect(page.getByRole("button", { name: "Notificações: 7 não lidas" })).toBeVisible(); // a cada 60 s
    expect(bellCalls).toBeGreaterThan(afterLoad + 1);
    await page.close();
  });

  test("teclado, movimento reduzido e tela estreita", async () => {
    const page = await context.newPage();
    await mockLists(page, { inbox: () => ({ data: [inboxItem({ id: "k1" })], unread: 1, nextCursor: null }) });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/notificacoes");
    const link = page.getByRole("link", { name: /Abrir o projeto/ });
    await link.focus();
    await expect(link).toBeFocused();
    expect(await link.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("none"); // prefers-reduced-motion: sem transição
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Marcar como lida" })).toBeFocused();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1); // sem rolagem horizontal em 390 px
    await page.close();
  });
});

test.describe("perfil sem acesso administrativo", () => {
  test.skip(!colab.email || !colab.password, "Defina E2E_COLAB_EMAIL e E2E_COLAB_PASSWORD.");
  let context: BrowserContext;
  test.beforeAll(async ({ browser }) => {
    context = await login(browser, colab);
  });
  test.afterAll(async () => context?.close());

  test("vê somente 'Minhas notificações'; ?aba=todas não abre a visão geral", async () => {
    const page = await context.newPage();
    await page.goto("/notificacoes?aba=todas");
    await expect(page.getByRole("tab", { name: /Minhas notificações/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Todas as notificações" })).toHaveCount(0);
    await expect(page.getByText("Nenhuma notificação por aqui")).toBeVisible();
    await page.close();
  });

  test("o backend recusa o que a interface esconde (403) e aceita só a própria caixa", async () => {
    const page = await context.newPage();
    await page.goto("/notificacoes");
    const status = await page.evaluate(async (api) => {
      const get = async (path: string) => (await fetch(`${api}${path}`, { credentials: "include" })).status;
      return { all: await get("/notifications?limit=1"), detail: await get("/notifications/qualquer"), settings: await get("/notifications/settings"), inbox: await get("/notifications/inbox?limit=1") };
    }, API);
    expect(status).toEqual({ all: 403, detail: 403, settings: 403, inbox: 200 });
    await page.close();
  });
});

test.describe("painel do sino (Etapa de ajuste da experiência)", () => {
  test.skip(!pmo.email || !pmo.password, "Defina E2E_PMO_EMAIL e E2E_PMO_PASSWORD.");
  let context: BrowserContext;
  test.beforeAll(async ({ browser }) => {
    context = await login(browser, pmo);
  });
  test.afterAll(async () => context?.close());

  /** Simula a caixa de entrada: o sino pede limit=1 (contador) e o painel pede as mais recentes. */
  async function mockPanel(page: Page, state: { unread: number; items: ReturnType<typeof inboxItem>[]; failPanel?: boolean }, log?: string[]) {
    await page.route(`${API}/projects`, (route) => json(route, PROJECTS));
    await page.route(`${API}/notifications/inbox**`, (route) => {
      const url = new URL(route.request().url());
      log?.push(`${route.request().method()} ${url.pathname}?${url.searchParams.toString()}`);
      if (url.searchParams.get("limit") === "1") return json(route, { data: [], unread: state.unread, nextCursor: null });
      if (state.failPanel) return json(route, { message: "Falha simulada.", code: "X" }, 500);
      const read = url.searchParams.get("read");
      const data = read === null ? state.items : state.items.filter((item) => (read === "true" ? item.readAt !== null : item.readAt === null));
      return json(route, { data, unread: state.unread, nextCursor: null });
    });
  }

  const bell = (page: Page) => page.getByRole("button", { name: /^Notificações/ });

  test("abre o painel ancorado ao sino, com título, itens e 'Ver todas'; diferencia lidas e não lidas; o contador é o real", async () => {
    const page = await context.newPage();
    const calls: string[] = [];
    // 7 não lidas no servidor, mas o painel mostra só os mais recentes: o contador NÃO é o número de itens listados.
    await mockPanel(page, { unread: 7, items: [inboxItem({ id: "n1", kind: "ESCALATION" }), inboxItem({ id: "n2", readAt: "2026-11-12T13:00:00.000Z" }), inboxItem({ id: "n3", kind: "PREVENTIVE", resolved: true })] }, calls);
    await page.goto("/");
    await expect(bell(page)).toHaveAccessibleName("Notificações: 7 não lidas");
    await expect(page.getByTestId("notification-bell-count")).toHaveText("7");
    await bell(page).click();
    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Notificações", { exact: true }).first()).toBeVisible();
    await expect(panel.getByText("7 não lidas")).toBeVisible();
    await expect(panel.getByRole("tab", { name: "Não lidas", exact: true })).toHaveAttribute("aria-selected", "true"); // abre em "Não lidas"
    const items = panel.getByRole("list", { name: "Notificações mais recentes" }).getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toHaveAttribute("data-state", "unread");
    await expect(items.nth(1)).toHaveAttribute("data-state", "unread");
    await expect(items.nth(0).getByText("Título n1")).toBeVisible(); // conteúdo congelado, sem reescrita
    await expect(items.nth(1).getByText("Resolvida")).toBeVisible(); // pendência é outro eixo
    await panel.getByRole("tab", { name: "Lidas", exact: true }).click();
    await expect(items).toHaveCount(1);
    await expect(items.nth(0)).toHaveAttribute("data-state", "read"); // lida: aparência discreta
    await expect(items.nth(0).getByRole("button", { name: "Marcar como lida" })).toHaveCount(0); // lida: sem ação
    await expect(panel.getByRole("link", { name: "Ver todas" })).toBeVisible();
    // O painel pede só as 3 mais recentes de cada aba e nada além de leituras (GET).
    expect(calls.some((call) => call.startsWith("GET /notifications/inbox?read=false&limit=3"))).toBe(true);
    expect(calls.every((call) => call.startsWith("GET"))).toBe(true);
    await page.close();
  });

  test("abrir o painel não marca nada como lido; só a ação explícita, depois da confirmação da API", async () => {
    const page = await context.newPage();
    let unread = 2;
    let attempt = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const reads: string[] = [];
    await page.route(`${API}/projects`, (route) => json(route, PROJECTS));
    await page.route(`${API}/notifications/inbox**`, (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get("limit") === "1") return json(route, { data: [], unread, nextCursor: null });
      return json(route, { data: [inboxItem({ id: "m1", readAt: unread < 2 ? "2026-11-14T10:00:00.000Z" : null }), inboxItem({ id: "m2" })].filter((item) => url.searchParams.get("read") !== "false" || item.readAt === null), unread, nextCursor: null });
    });
    await page.route(`${API}/notifications/deliveries/*/read`, async (route) => {
      reads.push(route.request().url());
      attempt += 1;
      if (attempt === 1) return json(route, { message: "Falha simulada.", code: "X" }, 500);
      await gate;
      unread = 1;
      return json(route, { deliveryId: "d-m1", readAt: "2026-11-14T10:00:00.000Z" });
    });
    await page.goto("/");
    await bell(page).click();
    const panel = page.getByRole("dialog");
    await expect(panel.getByRole("listitem")).toHaveCount(2);
    expect(reads).toEqual([]); // abrir não leu nada
    await expect(panel.getByRole("button", { name: "Marcar como lida" })).toHaveCount(0); // painel enxuto: ler = abrir o item
    await panel.getByRole("link", { name: /Título m1/ }).click(); // 1ª: a API falha
    await expect(page.getByText("Não foi possível marcar a notificação como lida.")).toBeVisible();
    await expect(page.getByTestId("notification-bell-count")).toHaveText("2"); // sem confirmação, nada muda
    await page.goto("/");
    await bell(page).click();
    await panel.getByRole("link", { name: /Título m1/ }).click(); // 2ª: resposta retida
    await expect(page).toHaveURL(/\/$/); // aguardando a confirmação da API
    await expect(page.getByTestId("notification-bell-count")).toHaveText("2");
    release();
    await expect(page).toHaveURL(/\/projetos\/proj-1$/);
    await expect(page.getByTestId("notification-bell-count")).toHaveText("1"); // contador desce junto
    expect(reads.length).toBe(2); // só o que o usuário pediu: a segunda notificação nunca foi marcada
    await page.close();
  });

  test("'Ver todas' leva à Central existente (mesma fonte de dados) e fecha o painel", async () => {
    const page = await context.newPage();
    await mockPanel(page, { unread: 1, items: [inboxItem({ id: "v1" })] });
    await page.goto("/projetos");
    await bell(page).click();
    await page.getByRole("dialog").getByRole("link", { name: "Ver todas" }).click();
    await expect(page).toHaveURL(/\/notificacoes$/);
    await expect(page.getByRole("heading", { name: "Central de Notificações" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /Minhas notificações/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Todas as notificações" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: /Título v1/ })).toBeVisible(); // a mesma notificação do painel
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // A rota continua acessível diretamente, sem item no menu lateral.
    await page.goto("/notificacoes");
    await expect(page.getByRole("heading", { name: "Central de Notificações" })).toBeVisible();
    await expect(page.locator('a[href="/notificacoes"]')).toHaveCount(0); // nenhum link para a Central no menu lateral
    await page.close();
  });

  test("ESC e clique fora fecham o painel; o foco volta ao sino; teclado abre e percorre", async () => {
    const page = await context.newPage();
    await mockPanel(page, { unread: 1, items: [inboxItem({ id: "k1" })] });
    await page.goto("/");
    await bell(page).focus();
    await page.keyboard.press("Enter"); // abre pelo teclado
    const panel = page.getByRole("dialog");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("listitem")).toHaveCount(1); // lista carregada
    await page.keyboard.press("Tab");
    await expect(panel.getByRole("tab", { name: "Não lidas", exact: true })).toBeFocused(); // o foco começou no cabeçalho do painel
    await page.keyboard.press("Tab");
    await expect(panel.getByRole("link", { name: /Abrir o projeto/ })).toBeFocused(); // área de abertura da notificação
    await page.keyboard.press("Tab");
    await expect(panel.getByRole("link", { name: "Ver todas" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(bell(page)).toBeFocused();
    await bell(page).click();
    await expect(panel).toBeVisible();
    await page.mouse.click(5, 400); // fora do painel
    await expect(panel).toHaveCount(0);
    await page.close();
  });

  test("estados do painel: vazio e erro com nova tentativa", async () => {
    const page = await context.newPage();
    const state = { unread: 0, items: [] as ReturnType<typeof inboxItem>[], failPanel: true };
    await mockPanel(page, state);
    await page.goto("/");
    await bell(page).click();
    const panel = page.getByRole("dialog");
    await expect(panel.getByText("Não foi possível carregar")).toBeVisible();
    state.failPanel = false;
    await panel.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(panel.getByText("Nenhuma notificação")).toBeVisible();
    await expect(panel.getByRole("link", { name: "Ver todas" })).toBeVisible();
    await page.close();
  });

  test("transição de 180 a 250 ms, movimento reduzido e largura responsiva", async () => {
    const page = await context.newPage();
    await mockPanel(page, { unread: 1, items: [inboxItem({ id: "t1" })] });
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/");
    await bell(page).click();
    const popup = page.locator('[data-slot="popover-content"]');
    await expect(popup).toBeVisible();
    const animation = await popup.evaluate((element) => {
      const style = getComputedStyle(element);
      return { name: style.animationName, duration: style.animationDuration };
    });
    expect(animation.name).not.toBe("none");
    const seconds = Number.parseFloat(animation.duration);
    expect(seconds).toBeGreaterThanOrEqual(0.18);
    expect(seconds).toBeLessThanOrEqual(0.25);
    const box = await popup.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390); // cabe na tela de 390 px
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.keyboard.press("Escape");
    // Movimento reduzido: sem animação.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await bell(page).click();
    await expect(popup).toBeVisible();
    expect(await popup.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    await page.close();
  });
});

test.describe("painel do sino: perfil sem acesso administrativo", () => {
  test.skip(!colab.email || !colab.password, "Defina E2E_COLAB_EMAIL e E2E_COLAB_PASSWORD.");
  let context: BrowserContext;
  test.beforeAll(async ({ browser }) => {
    context = await login(browser, colab);
  });
  test.afterAll(async () => context?.close());

  test("ambiente real (somente leitura): o painel mostra só as próprias notificações, sem dados fictícios", async () => {
    const page = await context.newPage();
    const requests: string[] = [];
    page.on("request", (request) => {
      if (request.url().startsWith(API)) requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    });
    await page.goto("/");
    await page.getByRole("button", { name: /^Notificações/ }).click();
    const panel = page.getByRole("dialog");
    await expect(panel.getByText("Nenhuma notificação")).toBeVisible();
    await expect(panel.getByRole("listitem")).toHaveCount(0); // nada inventado para preencher
    await expect(panel.getByRole("link", { name: "Ver todas" })).toBeVisible();
    expect(requests.filter((request) => request.startsWith("POST") || request.startsWith("PATCH") || request.startsWith("DELETE"))).toEqual([]);
    expect(requests.every((request) => request.includes("/notifications/inbox") || request.startsWith("GET"))).toBe(true);
    await page.close();
  });
});

test.describe("abrir a notificação (Etapa de interação e navegação)", () => {
  test.skip(!pmo.email || !pmo.password, "Defina E2E_PMO_EMAIL e E2E_PMO_PASSWORD.");
  let context: BrowserContext;
  test.beforeAll(async ({ browser }) => {
    context = await login(browser, pmo);
  });
  test.afterAll(async () => context?.close());

  const READ_AT = "2026-11-14T10:00:00.000Z";
  const bell = (page: Page) => page.getByRole("button", { name: /^Notificações/ });

  /** Caixa de entrada simulada com estado: a leitura só muda quando a "API" confirma (rota de leitura abaixo). */
  async function mockInbox(page: Page, seeds: Seed[], options: { failReads?: boolean; hold?: Promise<void> } = {}) {
    const read = new Set(seeds.filter((seed) => seed.readAt).map((seed) => seed.id));
    const reads: string[] = [];
    const items = () => seeds.map((seed) => inboxItem({ ...seed, readAt: read.has(seed.id) ? READ_AT : null }));
    await page.route(`${API}/projects`, (route) => json(route, PROJECTS));
    await page.route(`${API}/notifications/inbox**`, (route) => {
      const url = new URL(route.request().url());
      const unread = seeds.length - read.size;
      if (url.searchParams.get("limit") === "1") return json(route, { data: [], unread, nextCursor: null });
      const filter = url.searchParams.get("read");
      const data = items().filter((item) => filter === null || (filter === "true" ? item.readAt !== null : item.readAt === null));
      return json(route, { data, unread, nextCursor: null });
    });
    await page.route(`${API}/notifications/deliveries/*/read`, async (route) => {
      const id = route.request().url().split("/").at(-2)!.replace(/^d-/, "");
      reads.push(id);
      if (options.failReads) return json(route, { message: "Falha simulada.", code: "X" }, 500);
      if (options.hold) await options.hold;
      read.add(id);
      return json(route, { deliveryId: `d-${id}`, readAt: READ_AT });
    });
    return { reads, isRead: (id: string) => read.has(id) };
  }

  test("Central: clicar em uma não lida marca como lida só depois da confirmação e então abre o projeto", async () => {
    const page = await context.newPage();
    let release: () => void = () => undefined;
    const hold = new Promise<void>((resolve) => (release = resolve));
    const api = await mockInbox(page, [{ id: "c1", projectId: "proj-ctx" }], { hold });
    await page.goto("/notificacoes");
    const open = page.getByRole("link", { name: /Abrir o projeto Projeto Alfa/ });
    await expect(open).toHaveAttribute("href", "/projetos/proj-ctx"); // destino real, sem parâmetros inventados
    await open.click();
    await expect.poll(() => api.reads).toEqual(["c1"]);
    await expect(page).toHaveURL(/\/notificacoes$/); // a API ainda não confirmou: não navega
    expect(api.isRead("c1")).toBe(false);
    release();
    await expect(page).toHaveURL(/\/projetos\/proj-ctx$/);
    expect(api.isRead("c1")).toBe(true);
    expect(api.reads).toEqual(["c1"]); // uma única operação de leitura
    await page.close();
  });

  test("clicar em uma já lida não dispara nova leitura e abre o projeto", async () => {
    const page = await context.newPage();
    const api = await mockInbox(page, [{ id: "c2", readAt: READ_AT, projectId: "proj-lida" }]);
    await page.goto("/notificacoes");
    await page.getByRole("link", { name: /Abrir o projeto/ }).click();
    await expect(page).toHaveURL(/\/projetos\/proj-lida$/);
    expect(api.reads).toEqual([]);
    await page.close();
  });

  test("cada tipo usa seu destino (hoje: a Visão Geral do projeto, onde fica o Resumo Executivo)", async () => {
    const page = await context.newPage();
    await mockInbox(page, [
      { id: "k-p", kind: "PREVENTIVE", readAt: READ_AT, projectId: "proj-prev" },
      { id: "k-o", kind: "OVERDUE", readAt: READ_AT, projectId: "proj-over" },
      { id: "k-e", kind: "ESCALATION", readAt: READ_AT, projectId: "proj-esc" },
    ]);
    await page.goto("/notificacoes");
    await expect(page.getByRole("link", { name: /Abrir o projeto/ })).toHaveCount(3);
    const hrefs = await page.getByRole("link", { name: /Abrir o projeto/ }).evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs).toEqual(["/projetos/proj-prev", "/projetos/proj-over", "/projetos/proj-esc"]);
    for (const [title, project] of [["Título k-e", "proj-esc"], ["Título k-o", "proj-over"], ["Título k-p", "proj-prev"]] as const) {
      await page.goto("/notificacoes");
      await page.getByRole("link", { name: new RegExp(title) }).click();
      await expect(page).toHaveURL(new RegExp(`/projetos/${project}$`));
    }
    await page.close();
  });

  test("falha ao marcar como lida: avisa, não confirma a leitura e o contador não muda", async () => {
    const page = await context.newPage();
    const api = await mockInbox(page, [{ id: "f1", projectId: "proj-falha" }], { failReads: true });
    await page.goto("/notificacoes");
    await expect(page.getByTestId("notification-bell-count")).toHaveText("1");
    await page.getByRole("link", { name: /Abrir o projeto/ }).click();
    await expect(page.getByText("Não foi possível marcar a notificação como lida.")).toBeVisible();
    expect(api.isRead("f1")).toBe(false); // nada foi confirmado
    await expect(page.getByTestId("notification-bell-count")).toHaveText("1");
    await expect(page).toHaveURL(/\/projetos\/proj-falha$/); // o destino não depende da leitura
    // De volta à Central, continua não lida (sem falsa confirmação).
    await page.goto("/notificacoes");
    await expect(page.locator("article").filter({ hasText: "Título f1" })).toHaveAttribute("data-state", "unread");
    await page.close();
  });

  test("abas Todas / Não lidas / Lidas e a mesma leitura no sino e na Central", async () => {
    const page = await context.newPage();
    const api = await mockInbox(page, [
      { id: "s1", projectId: "proj-s1" },
      { id: "s2", readAt: READ_AT },
    ]);
    await page.goto("/notificacoes");
    const cards = page.locator("article"); // data-state fica no cartão
    await expect(cards).toHaveCount(2); // Todas
    await page.getByRole("tab", { name: "Não lidas", exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAttribute("data-state", "unread");
    await page.getByRole("tab", { name: "Lidas", exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAttribute("data-state", "read");

    // Sino: as mesmas notificações, nas mesmas abas.
    await bell(page).click();
    const panel = page.getByRole("dialog");
    await expect(panel.getByRole("tab", { name: "Não lidas", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(panel.getByRole("listitem")).toHaveCount(1);
    await expect(panel.getByRole("listitem").first()).toContainText("Título s1");
    await panel.getByRole("tab", { name: "Lidas", exact: true }).click();
    await expect(panel.getByRole("listitem")).toHaveCount(1);
    await expect(panel.getByRole("listitem").first()).toContainText("Título s2");
    await panel.getByRole("tab", { name: "Não lidas", exact: true }).click();

    // Clicar no item do sino lê, fecha o painel e navega; a Central passa a mostrar a mesma leitura.
    await panel.getByRole("link", { name: /Abrir o projeto/ }).click();
    await expect(page).toHaveURL(/\/projetos\/proj-s1$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(api.isRead("s1")).toBe(true);
    await expect(page.getByTestId("notification-bell-count")).toHaveCount(0); // não há mais não lidas
    await page.goto("/notificacoes");
    await page.getByRole("tab", { name: "Não lidas", exact: true }).click();
    await expect(page.getByText("Nenhuma notificação não lida")).toBeVisible();
    await page.getByRole("tab", { name: "Lidas", exact: true }).click();
    await expect(cards).toHaveCount(2); // o histórico das lidas é mantido
    await expect(cards.filter({ hasText: "Título s1" })).toHaveAttribute("data-state", "read");
    await page.close();
  });

  test("teclado: o link do cartão abre com Enter; os botões continuam independentes; foco visível e hover", async () => {
    const page = await context.newPage();
    const api = await mockInbox(page, [{ id: "q1", projectId: "proj-teclado" }]);
    await page.goto("/notificacoes");
    const link = page.getByRole("link", { name: /Abrir o projeto/ });
    expect(await link.evaluate((element) => getComputedStyle(element).cursor)).toBe("pointer");
    const duration = await link.evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
    expect(duration).toBeGreaterThanOrEqual(0.18);
    expect(duration).toBeLessThanOrEqual(0.25);
    await link.focus();
    await expect(link).toBeFocused();
    expect(await link.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none"); // anel de foco visível
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Marcar como lida" })).toBeFocused(); // o botão é outro alvo, fora do link
    await page.keyboard.press("Enter"); // marcar como lida: sem navegar
    await expect.poll(() => api.isRead("q1")).toBe(true);
    await expect(page).toHaveURL(/\/notificacoes$/);
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/projetos\/proj-teclado$/);
    expect(api.reads).toEqual(["q1"]); // abrir uma já lida não leu de novo
    await page.close();
  });

  test("aba Todas (sem entrega própria): abre o projeto sem tentar marcar leitura", async () => {
    const page = await context.newPage();
    const reads: string[] = [];
    await mockLists(page, { all: () => ({ data: [allItem({ id: "x1", projectId: "proj-todas" })], nextCursor: null }) });
    await page.route(`${API}/notifications/deliveries/*/read`, (route) => {
      reads.push(route.request().url());
      return json(route, {});
    });
    await page.goto("/notificacoes?aba=todas");
    await page.getByRole("link", { name: /Abrir o projeto/ }).click();
    await expect(page).toHaveURL(/\/projetos\/proj-todas$/);
    expect(reads).toEqual([]);
    await page.close();
  });

  test("tela estreita: cartão e painel sem rolagem horizontal; movimento reduzido sem transição", async () => {
    const page = await context.newPage();
    await mockInbox(page, [{ id: "m1", kind: "ESCALATION" }]);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/notificacoes");
    const link = page.getByRole("link", { name: /Abrir o projeto/ });
    await expect(link).toBeVisible();
    expect(await link.evaluate((element) => getComputedStyle(element).transitionProperty)).toBe("none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await bell(page).click();
    const box = await page.locator('[data-slot="popover-content"]').boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await page.close();
  });
});
