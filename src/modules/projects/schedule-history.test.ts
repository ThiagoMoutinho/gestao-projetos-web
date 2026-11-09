import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  HISTORY_STATUS,
  headlineChange,
  historyCount,
  historyDelta,
  isEffective,
  personName,
  reviewerText,
  type HistoryItem,
} from "./schedule-history.ts";

const at = (day: string) => `${day}T15:00:00.000Z`;

function item(overrides: Partial<HistoryItem> = {}): HistoryItem {
  return {
    id: "audit:1",
    source: "LEGACY_DIRECT",
    status: "EFETIVADA_DIRETAMENTE",
    entityType: "TASK",
    entityId: "t1",
    entityTitle: "API",
    field: null,
    previous: { startAt: null, endAt: at("2030-03-10") },
    next: { startAt: null, endAt: at("2030-03-20") },
    changes: [{ field: "END", kind: "RESCHEDULED", previous: at("2030-03-10"), next: at("2030-03-20") }],
    sequence: 1,
    justification: null,
    reasonCategory: null,
    requestedBy: null,
    requestedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    decisionNote: null,
    registeredBy: { id: "u1", name: "Gil" },
    occurredAt: at("2030-01-05"),
    escalatedToPmo: false,
    wasOverdue: false,
    impacts: [],
    ...overrides,
  };
}

describe("histórico de cronograma: apresentação", () => {
  it("o modelo anterior é identificado como tal e nunca como aprovado ou solicitado", () => {
    const status = HISTORY_STATUS.EFETIVADA_DIRETAMENTE;
    assert.match(status.label, /Efetivada diretamente \(modelo anterior\)/);
    assert.doesNotMatch(status.label, /aprovad|solicitad|pendente/i);
    assert.equal(status.tone, "neutral");
  });

  it("só efetivada diretamente e aprovada contam como data efetivamente alterada", () => {
    for (const [status, effective] of [
      ["EFETIVADA_DIRETAMENTE", true],
      ["APROVADA", true],
      ["PENDENTE", false],
      ["REJEITADA", false],
      ["CANCELADA", false],
      ["CANCELADA_CONFLITO", false],
      ["DEFINIDA", false],
    ] as const) {
      assert.equal(isEffective({ status }), effective, status);
    }
  });

  it("variação em dias só para registros efetivados; proposta pendente ou rejeitada não tem variação", () => {
    assert.equal(historyDelta(item()), 10);
    assert.equal(historyDelta(item({ status: "APROVADA", source: "REQUEST" })), 10);
    assert.equal(historyDelta(item({ status: "PENDENTE", source: "REQUEST" })), null);
    assert.equal(historyDelta(item({ status: "REJEITADA", source: "REQUEST" })), null);
    assert.equal(historyDelta(item({ changes: [{ field: "END", kind: "RESCHEDULED", previous: at("2030-03-20"), next: at("2030-03-15") }] })), -5);
    assert.equal(historyDelta(item({ changes: [] })), null);
  });

  it("a manchete prefere o término e cai no início quando só ele mudou", () => {
    const both = item({
      changes: [
        { field: "START", kind: "RESCHEDULED", previous: at("2030-02-01"), next: at("2030-02-05") },
        { field: "END", kind: "RESCHEDULED", previous: at("2030-03-10"), next: at("2030-03-20") },
      ],
    });
    assert.equal(headlineChange(both)?.field, "END");
    const startOnly = item({ changes: [{ field: "START", kind: "RESCHEDULED", previous: at("2030-02-01"), next: at("2030-02-05") }] });
    assert.equal(headlineChange(startOnly)?.field, "START");
    assert.equal(headlineChange(item({ changes: [] })), null);
  });

  it("conta reprogramações efetivadas e solicitações de qualquer situação, sem as definições iniciais", () => {
    assert.equal(
      historyCount({
        legacyDirect: 27,
        initialDefinitions: 9,
        requests: { pendente: 1, aprovada: 2, rejeitada: 3, cancelada: 4, canceladaConflito: 5 },
      }),
      42,
    );
  });

  it("nomes e analista: ausência é dita como ausência, sem inventar pessoa", () => {
    assert.equal(personName(null, "Não registrado"), "Não registrado");
    assert.equal(personName({ id: "u1", name: null }, "x"), "Nome não disponível");
    assert.equal(personName({ id: "u1", name: "Ana" }, "x"), "Ana");
    assert.equal(reviewerText(item()), "Não registrado (modelo anterior)");
    assert.equal(reviewerText(item({ source: "REQUEST", status: "PENDENTE" })), "Aguardando análise");
    assert.equal(reviewerText(item({ source: "REQUEST", status: "CANCELADA" })), "Sem análise registrada");
    assert.equal(reviewerText(item({ source: "REQUEST", status: "APROVADA", reviewedBy: { id: "p1", name: "Ana PMO" } })), "Ana PMO");
  });
});
