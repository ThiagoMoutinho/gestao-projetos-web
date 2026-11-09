import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPlainClick, needsRead, NOTIFICATION_DESTINATION, notificationHref } from "./notification-destination.ts";
import { hasListFilters, EMPTY_FILTERS } from "./notification-feed.ts";
import { NOTIFICATION_KINDS } from "./notification-state.ts";

describe("destino da notificação", () => {
  it("todo tipo tem destino e ele é uma rota existente: a Visão Geral do projeto", () => {
    for (const kind of NOTIFICATION_KINDS) {
      assert.equal(typeof NOTIFICATION_DESTINATION[kind], "function", kind);
      assert.equal(notificationHref({ kind, projectId: "proj-1" }), "/projetos/proj-1");
    }
  });

  it("usa o projeto da própria notificação e protege o identificador na URL", () => {
    assert.equal(notificationHref({ kind: "ESCALATION", projectId: "demo-proj-04" }), "/projetos/demo-proj-04");
    assert.equal(notificationHref({ kind: "OVERDUE", projectId: "a/b?c" }), "/projetos/a%2Fb%3Fc");
  });
});

describe("quando a abertura precisa marcar leitura", () => {
  it("só a entrega própria ainda não lida", () => {
    assert.equal(needsRead({ deliveryId: "d1", readAt: null }), true);
    assert.equal(needsRead({ deliveryId: "d1", readAt: "2026-11-14T10:00:00.000Z" }), false); // já lida: nada a fazer
    assert.equal(needsRead({ deliveryId: null, readAt: null }), false); // aba "Todas": não há entrega própria
  });
});

describe("clique simples x clique com modificador", () => {
  const base = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  it("só o clique simples é tratado pela aplicação", () => {
    assert.equal(isPlainClick(base), true);
    assert.equal(isPlainClick({ ...base, ctrlKey: true }), false);
    assert.equal(isPlainClick({ ...base, metaKey: true }), false);
    assert.equal(isPlainClick({ ...base, shiftKey: true }), false);
    assert.equal(isPlainClick({ ...base, button: 1 }), false);
  });
});

describe("filtros de lista x aba de leitura", () => {
  it("a leitura é escolhida nas abas e não conta como filtro de lista", () => {
    assert.equal(hasListFilters({ ...EMPTY_FILTERS, read: "UNREAD" }), false);
    assert.equal(hasListFilters({ ...EMPTY_FILTERS, kind: "OVERDUE" }), true);
    assert.equal(hasListFilters({ ...EMPTY_FILTERS, projectId: "p" }), true);
    assert.equal(hasListFilters({ ...EMPTY_FILTERS, pending: "RESOLVED" }), true);
  });
});
