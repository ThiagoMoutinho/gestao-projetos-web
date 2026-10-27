import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cellText, IMPORT_COLUMNS, IMPORT_EXAMPLE, parseCsv, rowsFromTable } from "./eap-import.ts";

describe("Leitura da planilha de importação da EAP", () => {
  it("lê CSV com ponto e vírgula, aspas, BOM e quebra de linha dentro da célula", () => {
    const table = parseCsv('\uFEFFCódigo EAP;Tipo;Nome\r\n1;Fase;"Fase; com ""aspas""\ne linha"\r\n1.1;Tarefa;Simples\r\n');
    assert.deepEqual(table, [
      ["Código EAP", "Tipo", "Nome"],
      ["1", "Fase", 'Fase; com "aspas"\ne linha'],
      ["1.1", "Tarefa", "Simples"],
    ]);
    assert.deepEqual(parseCsv("Código EAP,Tipo,Nome\n1,Fase,A"), [["Código EAP", "Tipo", "Nome"], ["1", "Fase", "A"]]);
  });

  it("reconhece as colunas pelo nome em qualquer ordem, ignora linhas vazias e numera pela planilha", () => {
    const { rows, problem } = rowsFromTable([
      ["nome", "TIPO", "codigo eap", "Término planejado"],
      ["Levantamento", "Fase", "1", ""],
      ["", "", "", ""],
      ["Aceite", "Marco", "1.1", "19/06/2026"],
    ]);
    assert.equal(problem, null);
    assert.deepEqual(rows, [
      { line: 2, code: "1", kind: "Fase", name: "Levantamento", plannedEnd: null },
      { line: 4, code: "1.1", kind: "Marco", name: "Aceite", plannedEnd: "19/06/2026" },
    ]);
  });

  it("aponta colunas obrigatórias ausentes e planilha sem linhas", () => {
    assert.match(rowsFromTable([["Nome", "Descrição"]]).problem ?? "", /Código EAP, Tipo/);
    assert.match(rowsFromTable([IMPORT_COLUMNS.map((column) => column.label)]).problem ?? "", /não tem linhas/);
    assert.equal(rowsFromTable([]).problem, "A planilha está vazia.");
  });

  it("o modelo padrão é lido sem erros de estrutura e tem exemplos coerentes", () => {
    const { rows, problem } = rowsFromTable([IMPORT_COLUMNS.map((column) => column.label), ...IMPORT_EXAMPLE.map((cells) => [...cells])]);
    assert.equal(problem, null);
    assert.equal(rows.length, IMPORT_EXAMPLE.length);
    assert.ok(IMPORT_EXAMPLE.every((cells) => cells.length === IMPORT_COLUMNS.length));

    const iso = (value: string | null | undefined) => (value ? value.split("/").reverse().join("-") : "");
    const phases = rows.filter((row) => row.kind === "Fase");
    assert.ok(phases.length > 0 && phases.every((phase) => phase.plannedStart && phase.plannedEnd && !phase.reviewer));
    assert.ok(rows.some((row) => row.kind === "Tarefa") && rows.some((row) => row.kind === "Marco"));
    for (const row of rows.filter((item) => item.kind !== "Fase")) {
      const phase = phases.find((item) => item.code === row.code.split(".")[0]);
      assert.ok(phase, `item ${row.code} sem fase`);
      const start = iso(row.plannedStart) || iso(row.plannedEnd);
      assert.ok(start >= iso(phase.plannedStart) && iso(row.plannedEnd) <= iso(phase.plannedEnd), `item ${row.code} fora da fase`);
      if (row.kind === "Marco") {
        assert.ok(row.responsible && row.reviewer && row.responsible !== row.reviewer && !row.plannedStart);
      }
    }
  });

  it("converte células do Excel: datas, fórmulas, texto rico e números", () => {
    assert.equal(cellText(new Date(Date.UTC(2026, 5, 5))), "05/06/2026");
    assert.equal(cellText({ formula: "A1", result: 12 }), "12");
    assert.equal(cellText({ richText: [{ text: "Fa" }, { text: "se" }] }), "Fase");
    assert.equal(cellText(1.1), "1.1");
    assert.equal(cellText(null), "");
  });
});
