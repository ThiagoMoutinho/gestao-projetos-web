import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { auditEvents, deliveryEvents, impedimentEvents, groupByDay, groupByMonth, mergeTimeline, relativeDay, scheduleEvents, timelineSource } from "./project-timeline.ts";
import type { HistoryItem } from "./schedule-history.ts";

const history = (overrides: Partial<HistoryItem>): HistoryItem =>
  ({
    id: "h1",
    source: "LEGACY_DIRECT",
    status: "EFETIVADA_DIRETAMENTE",
    entityType: "PHASE",
    entityId: "p1",
    entityTitle: "Projeto CTIn",
    field: "END",
    previous: null,
    next: null,
    changes: [{ field: "END", kind: "RESCHEDULED", previous: "2026-10-29T12:00:00.000-03:00", next: "2026-11-24T12:00:00.000-03:00" }],
    sequence: null,
    justification: null,
    reasonCategory: null,
    requestedBy: null,
    requestedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    decisionNote: null,
    registeredBy: { id: "u1", name: "Demo PMO" },
    occurredAt: "2026-11-01T15:00:00.000Z",
    escalatedToPmo: false,
    wasOverdue: false,
    impacts: [],
    ...overrides,
  }) as HistoryItem;

describe("Linha do tempo: reprogramações", () => {
  it("reprogramação efetivada mostra a mudança, o responsável e a variação em dias", () => {
    const [event] = scheduleEvents([history({})]);
    assert.equal(event.title, "Reprogramação · Fase Projeto CTIn");
    assert.match(event.detail, /Término 29\/10 → 24\/11\/2026/);
    assert.match(event.detail, /Demo PMO/);
    assert.deepEqual(event.badge, { label: "+26 d", tone: "danger" });
  });

  it("definição inicial não é evento; pendente e rejeitada não têm variação", () => {
    const events = scheduleEvents([
      history({ id: "a", source: "INITIAL_DEFINITION", status: "DEFINIDA" }),
      history({ id: "b", source: "REQUEST", status: "PENDENTE", requestedBy: { id: "u2", name: "Fornecedor" } }),
      history({ id: "c", source: "REQUEST", status: "REJEITADA" }),
    ]);
    assert.deepEqual(events.map((event) => event.id), ["schedule:b", "schedule:c"]);
    assert.equal(events[0].title.startsWith("Solicitação de reprogramação"), true);
    assert.deepEqual(events[0].badge, { label: "Pendente", tone: "warning" });
    assert.deepEqual(events[1].badge, { label: "Rejeitada", tone: "danger" });
  });
});

describe("Linha do tempo: entregas, impedimentos e auditoria", () => {
  it("envio e decisão de cada rodada, com responsáveis e sem inventar a decisão pendente", () => {
    const events = deliveryEvents("Aceite", [
      { id: "r1", status: "ACEITA", submittedByName: "Fornecedor", submittedAt: "2026-10-28T12:00:00.000Z", decidedByName: "Gestor", decidedAt: "2026-10-30T12:00:00.000Z" },
      { id: "r2", status: "EM_ANALISE", submittedByName: null, submittedAt: "2026-11-02T12:00:00.000Z", decidedByName: null, decidedAt: null },
      { id: "r3", status: "ACEITA", submittedByName: null, submittedAt: null, decidedByName: null, decidedAt: null },
    ]);
    assert.deepEqual(events.map((event) => event.id), ["delivery:r1:sent", "delivery:r1:decision", "delivery:r2:sent"]);
    assert.equal(events[1].title, "Marco aprovado · Aceite");
    assert.equal(events[1].detail.startsWith("Decisão de Gestor"), true);
    assert.deepEqual(events[2].badge, { label: "Em validação", tone: "warning" });
  });

  it("impedimento aberto gera um evento; resolvido gera também a resolução", () => {
    const events = impedimentEvents("Integração", [
      { id: "i1", description: "Aguardando acesso", openedByName: "Dev", openedAt: "2026-10-27T12:00:00.000Z", resolvedByName: null, resolvedAt: null },
      { id: "i2", description: "Licença", openedByName: "Dev", openedAt: "2026-10-20T12:00:00.000Z", resolvedByName: "Gestor", resolvedAt: "2026-10-22T12:00:00.000Z" },
    ]);
    assert.deepEqual(events.map((event) => event.id), ["impediment:i1:opened", "impediment:i2:opened", "impediment:i2:resolved"]);
  });

  it("auditoria deixa de fora reprogramação e planejamento, que já vêm do histórico de reprogramações", () => {
    const events = auditEvents([
      { id: "a1", summary: "Projeto atualizado", actorName: "PMO", createdAt: "2026-10-10T12:00:00.000Z", kind: "UPDATE" },
      { id: "a2", summary: "Datas reprogramadas", actorName: "PMO", createdAt: "2026-10-11T12:00:00.000Z", kind: "RESCHEDULE" },
      { id: "a3", summary: "Planejamento definido", actorName: "PMO", createdAt: "2026-10-12T12:00:00.000Z", kind: "PLANNING_DEFINED" },
    ]);
    assert.deepEqual(events.map((event) => event.id), ["audit:a1"]);
  });
});

describe("Linha do tempo: consolidação", () => {
  it("mais recente primeiro, sem repetir o mesmo id e descartando data inválida", () => {
    const one = { id: "x", at: "2026-10-01T00:00:00.000Z", title: "A", detail: "", tone: "neutral" as const, badge: null };
    const two = { ...one, id: "y", at: "2026-10-05T00:00:00.000Z", title: "B" };
    const bad = { ...one, id: "z", at: "sem data", title: "C" };
    const merged = mergeTimeline([one, two], [one, bad]);
    assert.deepEqual(merged.map((event) => event.id), ["y", "x"]);
  });
});

describe("relativeDay e timelineSource", () => {
  const now = new Date("2026-11-21T15:00:00-03:00");
  it("hoje, ontem e há N dias; depois de 30 dias ou data inválida, vazio", () => {
    assert.equal(relativeDay("2026-11-21T09:00:00-03:00", now), "hoje");
    assert.equal(relativeDay("2026-11-20T23:00:00-03:00", now), "ontem");
    assert.equal(relativeDay("2026-11-18T10:00:00-03:00", now), "há 3 dias");
    assert.equal(relativeDay("2026-10-01T10:00:00-03:00", now), "");
    assert.equal(relativeDay("2026-11-25T10:00:00-03:00", now), "");
    assert.equal(relativeDay("sem data", now), "");
  });
  it("origem do evento pelo prefixo do id", () => {
    assert.equal(timelineSource("schedule:1"), "schedule");
    assert.equal(timelineSource("delivery:1:x"), "delivery");
    assert.equal(timelineSource("impediment:1:opened"), "impediment");
    assert.equal(timelineSource("audit:9"), "audit");
    assert.equal(timelineSource("zzz"), "other");
  });
});

describe("groupByMonth", () => {
  const ev = (id: string, at: string) => ({ id, at, title: id, detail: "", tone: "neutral" as const, badge: null });
  it("agrupa por mês mantendo a ordem e dá nome ao mês", () => {
    const groups = groupByMonth([ev("a", "2026-11-20T12:00:00-03:00"), ev("b", "2026-11-02T12:00:00-03:00"), ev("c", "2026-10-30T12:00:00-03:00"), ev("d", "2025-12-01T12:00:00-03:00")]);
    assert.deepEqual(groups.map((g) => [g.key, g.label, g.events.map((e) => e.id)]), [
      ["2026-11", "Novembro de 2026", ["a", "b"]],
      ["2026-10", "Outubro de 2026", ["c"]],
      ["2025-12", "Dezembro de 2025", ["d"]],
    ]);
  });
  it("ignora evento sem data válida e aceita lista vazia", () => {
    assert.deepEqual(groupByMonth([]), []);
    assert.deepEqual(groupByMonth([ev("x", "sem data")]), []);
  });
});

describe("groupByDay", () => {
  const ev = (id: string, at: string) => ({ id, at, title: id, detail: "", tone: "neutral" as const, badge: null });
  it("agrupa por dia mantendo a ordem", () => {
    const groups = groupByDay([ev("a", "2026-11-19T15:00:00-03:00"), ev("b", "2026-11-19T10:00:00-03:00"), ev("c", "2026-11-11T09:00:00-03:00")]);
    assert.deepEqual(groups.map((g) => [g.key, g.events.map((e) => e.id)]), [
      ["2026-11-19", ["a", "b"]],
      ["2026-11-11", ["c"]],
    ]);
  });
  it("ignora evento sem data válida e aceita lista vazia", () => {
    assert.deepEqual(groupByDay([]), []);
    assert.deepEqual(groupByDay([ev("x", "sem data")]), []);
  });
});
