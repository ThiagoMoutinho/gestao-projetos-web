/** Ordem e união dos marcos da aba "Todos" do cartão Marcos e Homologações (lógica pura, sem React). */

type Orderable = { id: string; status: string; date: string | null };

/** O que pede ação vem primeiro; os planejados seguem por data e os aprovados, os mais recentes primeiro, ficam por último. */
const PRIORITY: Record<string, number> = { ENTREGUE: 0, AJUSTES_SOLICITADOS: 1, REJEITADO: 2, PENDENTE: 3, APROVADO: 4 };

/**
 * Junta as listas de marcos numa só, com cada marco uma única vez (a primeira ocorrência vale, então a lista de
 * entregas em análise tem precedência sobre as demais; tentativas diferentes do mesmo marco nunca duplicam).
 */
export function mergeAllMilestones<T extends Orderable>(...lists: T[][]): T[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((entry) => !seen.has(entry.id) && seen.add(entry.id))
    .sort(
      (left, right) =>
        (PRIORITY[left.status] ?? 9) - (PRIORITY[right.status] ?? 9) ||
        (left.status === "APROVADO"
          ? (right.date ?? "").localeCompare(left.date ?? "")
          : (left.date ?? "9999").localeCompare(right.date ?? "9999")),
    );
}
