import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  EMPTY_EVIDENCE_DRAFT,
  evidenceActionLabel,
  evidenceDisplayTitle,
  evidenceDraftChecks,
  evidenceKindLabel,
  evidencePayload,
  matchesEvidenceFilter,
} from "./evidence-kinds.ts";

describe("Classificação das evidências", () => {
  it("registros antigos aparecem como Sem classificação e não entram em Outros", () => {
    assert.equal(evidenceKindLabel(null), "Sem classificação");
    assert.equal(matchesEvidenceFilter({ kind: null }, "OTHER"), false);
    assert.equal(matchesEvidenceFilter({ kind: null }, "UNCLASSIFIED"), true);
    assert.equal(matchesEvidenceFilter({ kind: null }, "ALL"), true);
    assert.equal(matchesEvidenceFilter({ kind: "MINUTES" }, "MINUTES"), true);
    assert.equal(matchesEvidenceFilter({ kind: "MINUTES" }, "REPORT"), false);
  });

  it("Chamado GLPI sem título aparece como GLPI #número e leva ao chamado", () => {
    assert.equal(evidenceDisplayTitle({ kind: "GLPI_TICKET", title: "GLPI #352587", ticketNumber: "352587" }), "GLPI #352587");
    assert.equal(
      evidenceDisplayTitle({ kind: "GLPI_TICKET", title: "Acesso ao AD", ticketNumber: "352587" }),
      "GLPI #352587 — Acesso ao AD",
    );
    assert.equal(evidenceDisplayTitle({ kind: "DOCUMENT", title: "Ata", ticketNumber: null }), "Ata");
    assert.equal(evidenceActionLabel("GLPI_TICKET"), "Abrir chamado");
    assert.equal(evidenceActionLabel(null), "Abrir documento");
  });

  it("valida o formulário por tipo e monta o corpo da API", () => {
    const failing = (draft: Parameters<typeof evidenceDraftChecks>[0]) =>
      evidenceDraftChecks(draft).filter(([, message]) => message).map(([field]) => field);

    assert.deepEqual(failing(EMPTY_EVIDENCE_DRAFT), ["title", "url"]);
    assert.deepEqual(failing({ kind: "GLPI_TICKET", title: "", url: "https://glpi.example/t/1", ticketNumber: "" }), ["ticketNumber"]);
    assert.deepEqual(failing({ kind: "GLPI_TICKET", title: "", url: "https://glpi.example/t/1", ticketNumber: "#352587" }), []);
    assert.deepEqual(failing({ kind: "GLPI_TICKET", title: "", url: "ftp://x", ticketNumber: "12" }), ["url"]);

    assert.deepEqual(evidencePayload({ kind: "GLPI_TICKET", title: "", url: " https://glpi.example/t/1 ", ticketNumber: "#352587" }), {
      kind: "GLPI_TICKET",
      url: "https://glpi.example/t/1",
      ticketNumber: "352587",
    });
    assert.deepEqual(evidencePayload({ kind: "MINUTES", title: " Ata ", url: "https://x.example", ticketNumber: "99" }), {
      kind: "MINUTES",
      url: "https://x.example",
      title: "Ata",
    });
  });
});
