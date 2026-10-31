/**
 * Setores beneficiados ficam no campo institucional BENEFITED_SECTORS (texto), separados por vírgula.
 * O texto é a única fonte: não há cadastro de setores. Maiúsculas e minúsculas não distinguem setores.
 */
const SEPARATOR = ",";

export function sectorKey(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
}

export function normalizeSector(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

/** Texto salvo → lista, sem vazios e sem repetidos (mantém a primeira grafia). */
export function parseSectors(text: string | null | undefined): string[] {
  if (!text) {
    return [];
  }
  return dedupeSectors(text.split(/[,;\n]/));
}

export function dedupeSectors(names: ReadonlyArray<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = normalizeSector(raw);
    const key = sectorKey(name);
    if (name && !seen.has(key)) {
      seen.add(key);
      result.push(name);
    }
  }
  return result;
}

export function formatSectors(names: ReadonlyArray<string>): string {
  return dedupeSectors(names).join(`${SEPARATOR} `);
}

/** Divide a lista em até `limit` itens visíveis e a quantidade restante (`+N setores`). */
export function splitVisible(names: ReadonlyArray<string>, limit = 4) {
  return { visible: names.slice(0, limit), hidden: Math.max(0, names.length - limit) };
}
