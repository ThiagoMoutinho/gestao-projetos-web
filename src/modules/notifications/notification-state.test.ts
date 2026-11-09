import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  civilDay,
  cycleSummary,
  dueSummary,
  formatMoment,
  isNotificationKind,
  KIND_LABEL,
  KIND_TONE,
  NOTIFICATION_KINDS,
  pendingState,
  PENDING_LABEL,
  readState,
  READ_LABEL,
  resolutionLabel,
  shortDay,
  unreadSummary,
  VISIBILITY_LABEL,
} from "./notification-state.ts";

describe("notificações: leitura e pendência são eixos independentes", () => {
  it("a leitura vem só de readAt e a pendência só de resolvedAt", () => {
    assert.equal(readState(null), "UNREAD");
    assert.equal(readState(undefined), "UNREAD");
    assert.equal(readState("2026-11-12T13:00:00.000Z"), "READ");
    assert.equal(pendingState(null), "PENDING");
    assert.equal(pendingState("2026-11-13T13:00:00.000Z"), "RESOLVED");
    // Lida e pendente; não lida e resolvida: cada combinação existe e uma não implica a outra.
    assert.deepEqual([readState("x"), pendingState(null)], ["READ", "PENDING"]);
    assert.deepEqual([readState(null), pendingState("y")], ["UNREAD", "RESOLVED"]);
  });

  it("rótulos distintos para cada estado (nunca o mesmo texto para leitura e pendência)", () => {
    const labels = [READ_LABEL.UNREAD, READ_LABEL.READ, PENDING_LABEL.PENDING, PENDING_LABEL.RESOLVED];
    assert.deepEqual(labels, ["Não lida", "Lida", "Pendente", "Resolvida"]);
    assert.equal(new Set(labels).size, 4);
  });

  it("motivos de resolução conhecidos em português; desconhecido não é inventado", () => {
    assert.equal(resolutionLabel("VALIDATED"), "Validada pelo PMO");
    assert.equal(resolutionLabel("PROJECT_SUSPENDED"), "Projeto suspenso");
    assert.equal(resolutionLabel("PROJECT_CONCLUDED"), "Projeto concluído");
    assert.equal(resolutionLabel("CYCLE_EXPIRED"), "Prazo do ciclo encerrado");
    assert.equal(resolutionLabel("OUTRO_MOTIVO"), "Resolvida");
    assert.equal(resolutionLabel(null), "Resolvida");
  });
});

describe("notificações: tipos, ciclo e datas", () => {
  it("três tipos com rótulo e tom próprios (informativo, atenção, crítico)", () => {
    assert.deepEqual([...NOTIFICATION_KINDS], ["PREVENTIVE", "OVERDUE", "ESCALATION"]);
    assert.equal(KIND_LABEL.PREVENTIVE, "Prazo da validação");
    assert.equal(KIND_LABEL.OVERDUE, "Ciclo sem validação");
    assert.equal(KIND_LABEL.ESCALATION, "Escalonamento");
    assert.deepEqual([KIND_TONE.PREVENTIVE, KIND_TONE.OVERDUE, KIND_TONE.ESCALATION], ["info", "warning", "critical"]);
    assert.equal(isNotificationKind("OVERDUE"), true);
    assert.equal(isNotificationKind("SIMULATED"), false);
    assert.equal(isNotificationKind(null), false);
  });

  it("datas civis não mudam de dia por fuso", () => {
    assert.equal(civilDay("2026-11-05"), "05/11/2026");
    assert.equal(shortDay("2026-11-05"), "05/11");
    assert.equal(civilDay("lixo"), "lixo");
  });

  it("ciclo (preventivo e atraso) e início da sequência (escalonamento)", () => {
    const overdue = { kind: "OVERDUE", cycleStart: "2026-11-05", sequenceStart: null, dueDate: "2026-11-11" } as const;
    assert.deepEqual(cycleSummary(overdue), { label: "Ciclo", value: "05/11 a 11/11" });
    assert.deepEqual(dueSummary(overdue), { label: "Vencimento original", value: "11/11/2026" });
    const escalation = { kind: "ESCALATION", cycleStart: "2026-10-22", sequenceStart: "2026-10-22", dueDate: "2026-11-07" } as const;
    assert.deepEqual(cycleSummary(escalation), { label: "Sem validação desde o ciclo de", value: "22/10/2026" });
    assert.deepEqual(dueSummary(escalation), { label: "Prazo do escalonamento", value: "07/11/2026" });
  });

  it("o horário é exibido em Belém (UTC-3), sem confundir o dia", () => {
    assert.equal(formatMoment("2026-11-12T12:00:00.000Z"), "12/11/2026, 09:00");
    assert.equal(formatMoment("2026-11-13T02:30:00.000Z"), "12/11/2026, 23:30");
    assert.equal(formatMoment("invalido"), "invalido");
  });

  it("papel do destinatário e resumo de leitura da visão administrativa", () => {
    assert.equal(VISIBILITY_LABEL.TO, "Destinatário");
    assert.equal(VISIBILITY_LABEL.CC, "Em cópia");
    assert.equal(unreadSummary(0, 3), "Lida por todos");
    assert.equal(unreadSummary(0, 1), "Lida");
    assert.equal(unreadSummary(3, 3), "Ninguém leu ainda");
    assert.equal(unreadSummary(1, 1), "Não lida");
    assert.equal(unreadSummary(2, 5), "2 de 5 ainda não leram");
    assert.equal(unreadSummary(0, 0), "Sem destinatários");
  });
});
