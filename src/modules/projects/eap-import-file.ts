import { cellText, IMPORT_COLUMNS, IMPORT_EXAMPLE, IMPORT_RULES, parseCsv } from "./eap-import";

const MAX_BYTES = 5 * 1024 * 1024;
/** Marca de ordem de bytes (BOM): faz o Excel abrir o CSV como UTF-8. */
const BOM = String.fromCharCode(0xfeff);
/** Caractere de substituição: aparece quando o CSV não está em UTF-8. */
const REPLACEMENT = String.fromCharCode(0xfffd);

/** O exceljs é CommonJS: conforme o empacotador, as classes vêm no export padrão ou nos nomeados. */
async function loadExcel() {
  const loaded = await import("exceljs");
  return (loaded as unknown as { default?: typeof loaded }).default ?? loaded;
}

/** Lê o arquivo escolhido (.xlsx ou .csv) como tabela de textos; o exceljs só é carregado quando necessário. */
export async function readImportTable(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  if (file.size > MAX_BYTES) {
    throw new Error("O arquivo passa de 5 MB. Divida a importação em partes menores.");
  }
  if (name.endsWith(".csv")) {
    const buffer = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buffer);
    // CSV salvo pelo Excel em português costuma vir em Windows-1252.
    if (text.includes(REPLACEMENT)) {
      text = new TextDecoder("windows-1252").decode(buffer);
    }
    return parseCsv(text);
  }
  if (!name.endsWith(".xlsx")) {
    throw new Error("Formato não suportado. Envie um arquivo .xlsx ou .csv.");
  }
  const { Workbook } = await loadExcel();
  const workbook = new Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet("EAP") ?? workbook.worksheets[0];
  if (!sheet) {
    return [];
  }
  const table: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    for (let column = 1; column <= Math.max(row.cellCount, IMPORT_COLUMNS.length); column += 1) {
      cells.push(cellText(row.getCell(column).value));
    }
    table[rowNumber - 1] = cells;
  });
  return Array.from(table, (cells) => cells ?? []);
}

/** Baixa o modelo padrão: aba EAP com exemplo e aba de instruções (xlsx) ou CSV com ponto e vírgula. */
export async function downloadImportTemplate(format: "xlsx" | "csv") {
  if (format === "csv") {
    save(new Blob([buildTemplateCsv()], { type: "text/csv;charset=utf-8" }), "modelo-importacao-eap.csv");
    return;
  }
  const buffer = await buildTemplateXlsx();
  save(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "modelo-importacao-eap.xlsx");
}

/** CSV do modelo: mesmos cabeçalhos e exemplos do xlsx, com BOM e ponto e vírgula como separador. */
export function buildTemplateCsv() {
  const escape = (value: string) => (/[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [IMPORT_COLUMNS.map((column) => column.label), ...IMPORT_EXAMPLE].map((cells) => cells.map(escape).join(";"));
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

/** Modelo xlsx: aba EAP (cabeçalho e exemplos, todas as células como texto) e aba Instruções. */
export async function buildTemplateXlsx() {
  const { Workbook } = await loadExcel();
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet("EAP", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.addRow(IMPORT_COLUMNS.map((column) => column.label));
  // Célula vazia fica realmente vazia: gravar "" cria um texto compartilhado vazio que alguns
  // leitores exibem como o índice (ex.: "15").
  IMPORT_EXAMPLE.forEach((cells) => sheet.addRow(cells.map((value) => value || null)));
  IMPORT_COLUMNS.forEach((column, index) => {
    const target = sheet.getColumn(index + 1);
    target.width = column.width;
  });
  // Formato texto em cada célula usada e nas próximas linhas: o Excel não converte 1.10 em 1,1
  // nem datas dd/mm/aaaa para outro formato.
  const lastRow = IMPORT_EXAMPLE.length + 200;
  for (let rowNumber = 1; rowNumber <= lastRow; rowNumber += 1) {
    for (let column = 1; column <= IMPORT_COLUMNS.length; column += 1) {
      sheet.getCell(rowNumber, column).numFmt = "@";
    }
  }
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF175CD3" } };

  const help = workbook.addWorksheet("Instruções");
  help.getColumn(1).width = 26;
  help.getColumn(2).width = 110;
  help.addRow(["Coluna", "Como preencher"]).font = { bold: true };
  IMPORT_COLUMNS.forEach((column) => help.addRow([column.label, column.hint]));
  help.addRow([]);
  help.addRow(["Regras", null]).font = { bold: true };
  IMPORT_RULES.forEach((rule) => help.addRow([null, rule]));
  help.getColumn(2).alignment = { wrapText: true, vertical: "top" };
  return workbook.xlsx.writeBuffer();
}

function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
