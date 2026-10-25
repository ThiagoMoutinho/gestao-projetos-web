import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ListEapAudit200DataItem } from "@/lib/api/generated/model/listEapAudit200DataItem";

import { presentHistory } from "./eap-history-entries.ts";

const format = { statusLabel: (status: string) => `<${status}>`, date: (value: string) => value };

function item(id: string, createdAt: string, details: Partial<ListEapAudit200DataItem["details"]>, summary = "Evento."): ListEapAudit200DataItem {
  return {
    id,
    entityType: "TASK",
    entityId: "task-1",
    action: "STATUS_CHANGE",
    summary,
    actorId: "pmo-1",
    actorName: "PMO Um",
    createdAt,
    details: {
      kind: "OTHER",
      automatic: false,
      fromStatus: null,
      toStatus: null,
      justification: null,
      note: null,
      nonconformities: null,
      adjustments: null,
      round: null,
      cause: null,
      fromPercent: null,
      toPercent: null,
      reason: null,
      previousReason: null,
      resolutionNote: null,
      openMinutes: null,
      ...details,
    },
  };
}

describe("Histórico de alterações", () => {
  it("apresenta cancelamento e reativação com a própria justificativa e situação", () => {
    const entries = presentHistory(
      [
        item("r", "2026-10-21T22:00:00.000Z", {
          kind: "REACTIVATION",
          fromStatus: "CANCELADA",
          toStatus: "EM_ANDAMENTO",
          justification: "Escopo devolvido.",
        }),
        item("c", "2026-10-21T21:01:00.000Z", {
          kind: "CANCELLATION",
          fromStatus: "EM_ANDAMENTO",
          toStatus: "CANCELADA",
          justification: "Será reestruturado.",
        }, 'Tarefa "teste" cancelada.'),
      ],
      format,
    );

    assert.deepEqual(
      entries.map((entry) => [entry.kindLabel, entry.notes]),
      [
        ["Reativação", [{ label: "Justificativa da reativação", text: "Escopo devolvido." }]],
        ["Cancelamento", [{ label: "Justificativa do cancelamento", text: "Será reestruturado." }]],
      ],
    );
    assert.equal(entries[1].title, 'Tarefa "teste" cancelada.');
    assert.deepEqual(entries[1].transition, { from: "<EM_ANDAMENTO>", to: "<CANCELADA>" });
    assert.equal(entries[1].actor, "PMO Um");
  });

  it("descreve o andamento quando os percentuais existem, sem inventar o anterior", () => {
    const [changed, legacy] = presentHistory(
      [
        item("a", "2026-10-21T10:00:00.000Z", { kind: "PROGRESS", fromPercent: 25, toPercent: 50 }),
        item("b", "2026-10-20T10:00:00.000Z", { kind: "PROGRESS", fromPercent: null, toPercent: 40 }),
      ],
      format,
    );
    assert.equal(changed.title, "Andamento alterado de 25% para 50%.");
    assert.equal(legacy.title, "Andamento registrado em 40%.");
    assert.deepEqual(legacy.notes, []);
  });

  it("separa registro, atualização e resolução do impedimento com motivo, resolução e tempo em aberto", () => {
    const [resolved, updated, opened] = presentHistory(
      [
        item("res", "2026-10-23T12:00:00.000Z", {
          kind: "IMPEDIMENT_RESOLVED",
          reason: "Ambiente liberado tarde.",
          resolutionNote: "Infraestrutura liberou.",
          openMinutes: 1500,
        }, 'Impedimento da tarefa "teste" resolvido.'),
        item("upd", "2026-10-22T12:00:00.000Z", {
          kind: "IMPEDIMENT_UPDATED",
          previousReason: "Ambiente fora do ar.",
          reason: "Ambiente liberado tarde.",
        }),
        item("open", "2026-10-22T11:00:00.000Z", { kind: "IMPEDIMENT_OPENED", reason: "Ambiente fora do ar." }),
      ],
      format,
    );

    assert.equal(resolved.title, 'Impedimento da tarefa "teste" resolvido.');
    assert.deepEqual(resolved.notes, [
      { label: "Motivo do impedimento", text: "Ambiente liberado tarde." },
      { label: "Resolução", text: "Infraestrutura liberou." },
      { label: "Tempo em aberto", text: "1 dia e 1 hora" },
    ]);
    assert.deepEqual(updated.notes.map((note) => note.label), ["Motivo anterior", "Novo motivo"]);
    assert.deepEqual(opened.notes, [{ label: "Motivo do impedimento", text: "Ambiente fora do ar." }]);
    assert.deepEqual([resolved.kindLabel, updated.kindLabel, opened.kindLabel], ["Resolução", "Impedimento", "Impedimento"]);
  });

  it("mostra marcações antigas sem inventar o motivo", () => {
    const [flagged, unflagged] = presentHistory(
      [
        item("f", "2026-10-21T10:00:00.000Z", { kind: "IMPEDIMENT_FLAGGED" }, 'Progresso da tarefa "teste" atualizado.'),
        item("u", "2026-10-20T10:00:00.000Z", { kind: "IMPEDIMENT_UNFLAGGED" }, 'Progresso da tarefa "teste" atualizado.'),
      ],
      format,
    );
    assert.equal(flagged.title, "Impedimento sinalizado (motivo não registrado).");
    assert.equal(unflagged.title, "Impedimento retirado.");
    assert.deepEqual([flagged.notes, unflagged.notes], [[], []]);
  });

  it("agrupa o ajuste automático da mesma ação sem descartá-lo", () => {
    const entries = presentHistory(
      [
        item("auto", "2026-10-21T10:00:00.400Z", {
          kind: "AUTOMATIC_STATUS",
          automatic: true,
          fromStatus: "NAO_INICIADA",
          toStatus: "EM_ANDAMENTO",
        }),
        item("progress", "2026-10-21T10:00:00.300Z", { kind: "PROGRESS", fromPercent: 0, toPercent: 25 }),
        item("old-auto", "2026-10-01T10:00:00.000Z", { kind: "AUTOMATIC_STATUS", automatic: true }),
      ],
      format,
    );
    assert.deepEqual(
      entries.map((entry) => [entry.id, entry.related.map((related) => related.id)]),
      [
        ["progress", ["auto"]],
        ["old-auto", []],
      ],
    );
  });

  it("mostra rodada, justificativa, inconformidades e correções da homologação", () => {
    const [adjustments, authorized] = presentHistory(
      [
        item("a", "2026-10-21T10:00:00.000Z", {
          kind: "ADJUSTMENTS_REQUESTED",
          round: 2,
          note: "Faltam os testes de carga.",
          nonconformities: "Relatório sem cenário de pico.",
          adjustments: "Incluir testes de carga.",
        }),
        item("r", "2026-10-20T10:00:00.000Z", { kind: "RESUBMISSION_AUTHORIZED", round: 1, justification: "Comitê aprovou o reenvio." }),
      ],
      format,
    );
    assert.equal(adjustments.tone, "adjustments");
    assert.deepEqual(adjustments.notes, [
      { label: "Rodada", text: "Entrega 2" },
      { label: "Justificativa", text: "Faltam os testes de carga." },
      { label: "Inconformidades", text: "Relatório sem cenário de pico." },
      { label: "Correções necessárias", text: "Incluir testes de carga." },
    ]);
    assert.equal(authorized.kindLabel, "Reenvio autorizado");
    assert.deepEqual(authorized.notes, [
      { label: "Rodada", text: "Entrega 1" },
      { label: "Justificativa da autorização", text: "Comitê aprovou o reenvio." },
    ]);
  });

  it("classifica reprogramação com a justificativa e a primeira definição como planejamento", () => {
    const [rescheduled, defined] = presentHistory(
      [
        item("s", "2026-10-21T10:00:00.000Z", {
          kind: "RESCHEDULE",
          justification: "Fornecedor atrasou o ambiente.",
        }, "Prazo da tarefa reprogramado (reprogramação nº 1)."),
        item("d", "2026-10-20T10:00:00.000Z", { kind: "PLANNING_DEFINED" }, "Planejamento da tarefa definido."),
      ],
      format,
    );
    assert.equal(rescheduled.kindLabel, "Reprogramação");
    assert.equal(rescheduled.tone, "reschedule");
    assert.deepEqual(rescheduled.notes, [{ label: "Justificativa da reprogramação", text: "Fornecedor atrasou o ambiente." }]);
    assert.equal(defined.kindLabel, "Planejamento");
  });
});
