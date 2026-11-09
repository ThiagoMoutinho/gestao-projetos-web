import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ListMyNotifications200DataItem } from "@/lib/api/generated/model/listMyNotifications200DataItem";
import type { ListNotifications200DataItem } from "@/lib/api/generated/model/listNotifications200DataItem";

import {
  allParams,
  EMPTY_FILTERS,
  feedReducer,
  fromAll,
  fromInbox,
  hasActiveFilters,
  INITIAL_FEED,
  inboxParams,
  PAGE_SIZE,
  type FeedItem,
  type FeedState,
} from "./notification-feed.ts";

const inboxItem = (id: string, extra: Partial<ListMyNotifications200DataItem> = {}): ListMyNotifications200DataItem => ({
  deliveryId: `d-${id}`,
  visibility: "TO",
  deliveredAt: "2026-11-12T12:00:00.000Z",
  readAt: null,
  notification: {
    id,
    projectId: "p1",
    projectName: "Projeto Um",
    kind: "OVERDUE",
    cycleStart: "2026-11-05",
    sequenceStart: null,
    dueDate: "2026-11-11",
    scheduledFor: "2026-11-12T12:00:00.000Z",
    title: `Título ${id}`,
    body: `Corpo ${id}\nsegunda linha`,
    createdAt: "2026-11-12T12:00:00.000Z",
    resolvedAt: null,
    resolutionReason: null,
  },
  ...extra,
});

const feedItem = (id: string, extra: Partial<FeedItem> = {}): FeedItem => ({ ...fromInbox(inboxItem(id)), ...extra });
const ready = (items: FeedItem[], extra: Partial<FeedState> = {}): FeedState => ({ ...INITIAL_FEED, status: "ready", items, unread: items.length, ...extra });

describe("notificações: filtros viram parâmetros da API", () => {
  it("sem filtros só pede o tamanho da página", () => {
    assert.deepEqual(inboxParams(EMPTY_FILTERS), { limit: PAGE_SIZE });
    assert.deepEqual(allParams(EMPTY_FILTERS), { limit: PAGE_SIZE });
    assert.equal(hasActiveFilters(EMPTY_FILTERS), false);
  });

  it("Minhas: leitura individual (read) e pendência (resolved)", () => {
    const filters = { kind: "ESCALATION", projectId: "p9", read: "UNREAD", pending: "RESOLVED" } as const;
    assert.deepEqual(inboxParams(filters, "cur"), { kind: "ESCALATION", projectId: "p9", read: "false", resolved: "true", cursor: "cur", limit: PAGE_SIZE });
    assert.deepEqual(inboxParams({ ...EMPTY_FILTERS, read: "READ", pending: "PENDING" }), { read: "true", resolved: "false", limit: PAGE_SIZE });
    assert.equal(hasActiveFilters(filters), true);
  });

  it("Todas: 'não lida' = ainda há quem não leu; 'lida' = todos leram", () => {
    assert.deepEqual(allParams({ ...EMPTY_FILTERS, read: "UNREAD" }), { unread: "true", limit: PAGE_SIZE });
    assert.deepEqual(allParams({ ...EMPTY_FILTERS, read: "READ", pending: "PENDING" }, "c2"), { unread: "false", resolved: "false", cursor: "c2", limit: PAGE_SIZE });
  });
});

describe("notificações: conversão dos dados da API (conteúdo congelado sem reescrita)", () => {
  it("Minhas: preserva título e corpo exatamente e traz a entrega e a leitura", () => {
    const item = fromInbox(inboxItem("n1", { visibility: "CC", readAt: "2026-11-12T13:00:00.000Z" }));
    assert.equal(item.title, "Título n1");
    assert.equal(item.body, "Corpo n1\nsegunda linha");
    assert.equal(item.key, "mine:d-n1");
    assert.equal(item.deliveryId, "d-n1");
    assert.equal(item.visibility, "CC");
    assert.equal(item.readAt, "2026-11-12T13:00:00.000Z");
    assert.equal(item.recipients, null);
  });

  it("Todas: resumo dos destinatários, sem leitura individual", () => {
    const api: ListNotifications200DataItem = {
      id: "n2",
      projectId: "p1",
      projectName: "Projeto Um",
      kind: "ESCALATION",
      cycleStart: "2026-10-22",
      sequenceStart: "2026-10-22",
      dueDate: "2026-11-07",
      scheduledFor: "2026-11-09T12:00:00.000Z",
      title: "T",
      body: "B",
      createdAt: "2026-11-09T12:00:01.000Z",
      resolvedAt: "2026-11-13T12:00:00.000Z",
      resolutionReason: "VALIDATED",
      recipients: 3,
      unread: 2,
    };
    const item = fromAll(api);
    assert.equal(item.key, "all:n2");
    assert.equal(item.deliveryId, null);
    assert.equal(item.readAt, null);
    assert.equal(item.recipients, 3);
    assert.equal(item.unread, 2);
    assert.equal(item.resolutionReason, "VALIDATED");
  });

  it("um tipo desconhecido (por exemplo, uma simulação) nunca é exibido como notificação", () => {
    const bogus = inboxItem("x");
    (bogus.notification as { kind: string }).kind = "SIMULATED";
    assert.throws(() => fromInbox(bogus), /Tipo de notificação desconhecido/);
  });
});

describe("notificações: estado da lista", () => {
  it("páginas seguintes não repetem itens já mostrados", () => {
    const first = feedReducer(INITIAL_FEED, { type: "loaded", items: [feedItem("a"), feedItem("b")], nextCursor: "c1", unread: 5, append: false });
    const second = feedReducer(first, { type: "loaded", items: [feedItem("b"), feedItem("c")], nextCursor: null, unread: 5, append: true });
    assert.deepEqual(second.items.map((item) => item.notificationId), ["a", "b", "c"]);
    assert.equal(second.nextCursor, null);
    assert.equal(second.status, "ready");
  });

  it("marcar como lida só altera a leitura: a pendência continua exatamente como estava", () => {
    const pending = feedItem("a");
    const resolved = feedItem("b", { resolvedAt: "2026-11-13T12:00:00.000Z", resolutionReason: "VALIDATED" });
    const state = ready([pending, resolved], { unread: 2 });
    const next = feedReducer(feedReducer(state, { type: "markedRead", deliveryId: pending.deliveryId!, readAt: "2026-11-14T10:00:00.000Z" }), {
      type: "markedRead",
      deliveryId: resolved.deliveryId!,
      readAt: "2026-11-14T10:01:00.000Z",
    });
    assert.equal(next.items[0].readAt, "2026-11-14T10:00:00.000Z");
    assert.equal(next.items[0].resolvedAt, null); // continua pendente
    assert.equal(next.items[1].resolvedAt, "2026-11-13T12:00:00.000Z"); // continua resolvida, com o mesmo motivo
    assert.equal(next.items[1].resolutionReason, "VALIDATED");
    assert.equal(next.unread, 0);
  });

  it("marcar de novo não muda nada nem reduz o contador abaixo de zero", () => {
    const read = feedItem("a", { readAt: "2026-11-12T13:00:00.000Z" });
    const state = ready([read], { unread: 0 });
    assert.equal(feedReducer(state, { type: "markedRead", deliveryId: read.deliveryId!, readAt: "2026-11-14T10:00:00.000Z" }), state);
    const unknown = feedReducer(ready([feedItem("b")], { unread: 1 }), { type: "markedRead", deliveryId: "nao-existe", readAt: "x" });
    assert.equal(unknown.unread, 1);
  });

  it("erro, sem permissão e recomeço", () => {
    const loaded = ready([feedItem("a")], { unread: 3 });
    assert.equal(feedReducer(loaded, { type: "failed", forbidden: false }).status, "error");
    assert.equal(feedReducer(loaded, { type: "failed", forbidden: true }).status, "forbidden");
    const reset = feedReducer(loaded, { type: "reset" });
    assert.equal(reset.status, "loading");
    assert.deepEqual(reset.items, []);
    assert.equal(reset.unread, 3); // o contador não pisca ao trocar de filtro
    const more = feedReducer(loaded, { type: "loadingMore" });
    assert.equal(more.loadingMore, true);
    const failedMore = feedReducer(more, { type: "loadMoreFailed" });
    assert.deepEqual([failedMore.loadingMore, failedMore.loadMoreFailed, failedMore.items.length], [false, true, 1]);
  });
});
