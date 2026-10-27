import type { ImportEapBodyRowsItem } from "@/lib/api/generated/model/importEapBodyRowsItem";

export type ImportRow = ImportEapBodyRowsItem;

type Field = Exclude<keyof ImportRow, "line">;

/**
 * Colunas do modelo padrão, na ordem da planilha. Os rótulos são os cabeçalhos aceitos na leitura
 * (sem diferença de maiúsculas e acentos) e cada um corresponde a um campo enviado à API.
 */
export const IMPORT_COLUMNS: ReadonlyArray<{ field: Field; label: string; hint: string; width: number }> = [
  { field: "code", label: "Código EAP", width: 12, hint: "Obrigatório. Fase: 1, 2, 3…; tarefa ou marco da fase 1: 1.1, 1.2… Cada código aparece uma vez." },
  { field: "kind", label: "Tipo", width: 10, hint: "Obrigatório. Fase, Tarefa ou Marco." },
  { field: "name", label: "Nome", width: 34, hint: "Obrigatório." },
  { field: "description", label: "Descrição", width: 36, hint: "Opcional." },
  {
    field: "responsible",
    label: "Responsável",
    width: 28,
    hint: "E-mail (ou nome, se não houver outro igual) de um participante do projeto. Fase: responsável (obrigatório). Tarefa: executor (opcional). Marco: quem apresenta a entrega ao gestor (obrigatório).",
  },
  {
    field: "reviewer",
    label: "Gestor validador",
    width: 28,
    hint: "Somente marco (obrigatório): participante do projeto que não seja fornecedor e diferente de quem apresenta. Deixe em branco em fases e tarefas.",
  },
  { field: "milestoneType", label: "Tipo do marco", width: 16, hint: "Somente marco: Entrega, Aprovação ou Homologação (em branco = Entrega). Deixe em branco em fases e tarefas." },
  {
    field: "plannedStart",
    label: "Início planejado",
    width: 16,
    hint: "dd/mm/aaaa. Fase: obrigatório. Tarefa: opcional, sempre junto com o término. Marco: deixe em branco.",
  },
  {
    field: "plannedEnd",
    label: "Término planejado",
    width: 17,
    hint: "dd/mm/aaaa, igual ou posterior ao início. Fase: obrigatório. Tarefa: opcional, junto com o início. Marco: data prevista (obrigatória).",
  },
  { field: "completionCriteria", label: "Critério de conclusão", width: 30, hint: "Somente fase, opcional. Deixe em branco em tarefas e marcos." },
];

/** Exemplo do modelo: duas fases com tarefas e marcos dentro do período planejado de cada uma. */
export const IMPORT_EXAMPLE: ReadonlyArray<ReadonlyArray<string>> = [
  ["1", "Fase", "Planejamento", "Definição do escopo e do plano do projeto", "gestora@exemplo.com", "", "", "01/06/2026", "30/06/2026", "Plano do projeto aprovado"],
  ["1.1", "Tarefa", "Levantamento de requisitos", "Entrevistas com as áreas envolvidas", "fornecedor@exemplo.com", "", "", "01/06/2026", "12/06/2026", ""],
  ["1.2", "Tarefa", "Elaboração do plano do projeto", "", "fornecedor@exemplo.com", "", "", "15/06/2026", "26/06/2026", ""],
  ["1.3", "Marco", "Aprovação do plano do projeto", "Apresentação do plano à gestão", "fornecedor@exemplo.com", "gestora@exemplo.com", "Aprovação", "", "30/06/2026", ""],
  ["2", "Fase", "Execução", "Desenvolvimento e homologação da solução", "gestora@exemplo.com", "", "", "01/07/2026", "31/08/2026", "Entrega homologada pela gestão"],
  ["2.1", "Tarefa", "Desenvolvimento da solução", "", "fornecedor@exemplo.com", "", "", "01/07/2026", "14/08/2026", ""],
  ["2.2", "Marco", "Homologação da entrega", "", "fornecedor@exemplo.com", "gestora@exemplo.com", "Homologação", "", "28/08/2026", ""],
];

/** Regras exibidas na aba Instruções do modelo e no painel de importação. */
export const IMPORT_RULES: ReadonlyArray<string> = [
  "A importação é a carga inicial da EAP: só é permitida em projeto sem fases, tarefas ou marcos. Não há importação incremental, substituição nem mesclagem.",
  "Cada fase tem as próprias datas planejadas, informadas nesta planilha; elas se tornam o planejamento e a linha de base da fase e não são recalculadas pelos itens.",
  "O período consolidado das tarefas e marcos é calculado à parte. Itens fora do período da fase geram aviso, sem alterar o planejamento informado.",
  "Responsável, quem apresenta e gestor validador precisam participar do projeto; o gestor validador não pode ser fornecedor nem a mesma pessoa que apresenta.",
  "Use o e-mail do participante sempre que houver nomes iguais. Datas no formato dd/mm/aaaa.",
  "Os erros aparecem por linha antes da confirmação. Com qualquer erro, nada é gravado; com a confirmação, tudo é gravado de uma vez e registrado no histórico.",
  "Depois da importação, mudanças de prazo seguem a reprogramação com justificativa, e os marcos seguem o fluxo de entrega e validação.",
];

function plain(value: string) {
  return value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const FIELD_BY_HEADER = new Map(IMPORT_COLUMNS.map((column) => [plain(column.label), column.field]));

/** Texto de uma célula do Excel: datas viram dd/mm/aaaa; fórmulas, links e texto rico viram o texto exibido. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    // O Excel guarda a data civil como meia-noite UTC.
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`;
  }
  if (typeof value === "object") {
    const cell = value as { result?: unknown; text?: unknown; richText?: Array<{ text: string }> };
    if (cell.richText) {
      return cell.richText.map((part) => part.text).join("").trim();
    }
    if ("result" in cell) {
      return cellText(cell.result);
    }
    if ("text" in cell) {
      return cellText(cell.text);
    }
    return "";
  }
  return String(value).trim();
}

/** CSV com vírgula ou ponto e vírgula (padrão do Excel em português), aspas e quebras de linha nas células. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/**
 * Converte a tabela lida (cabeçalho na primeira linha) nas linhas da importação. As colunas são
 * reconhecidas pelo nome, em qualquer ordem; linhas totalmente vazias são ignoradas.
 */
export function rowsFromTable(table: ReadonlyArray<ReadonlyArray<string>>): { rows: ImportRow[]; problem: string | null } {
  const [header, ...body] = table;
  if (!header) {
    return { rows: [], problem: "A planilha está vazia." };
  }
  const fields = header.map((label) => FIELD_BY_HEADER.get(plain(label)) ?? null);
  const missing = (["code", "kind", "name"] as const).filter((field) => !fields.includes(field));
  if (missing.length > 0) {
    const labels = IMPORT_COLUMNS.filter((column) => missing.includes(column.field as (typeof missing)[number])).map((column) => column.label);
    return { rows: [], problem: `Colunas obrigatórias ausentes: ${labels.join(", ")}. Use o modelo padrão.` };
  }
  const rows: ImportRow[] = [];
  body.forEach((cells, index) => {
    if (cells.every((value) => value.trim() === "")) {
      return;
    }
    const row: ImportRow = { line: index + 2, code: "", kind: "", name: "" };
    fields.forEach((field, column) => {
      if (field) {
        const value = (cells[column] ?? "").trim();
        if (field === "code" || field === "kind" || field === "name") {
          row[field] = value;
        } else {
          row[field] = value || null;
        }
      }
    });
    rows.push(row);
  });
  if (rows.length === 0) {
    return { rows, problem: "A planilha não tem linhas para importar." };
  }
  return { rows, problem: null };
}
