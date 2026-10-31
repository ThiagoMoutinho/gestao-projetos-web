/** Lógica pura do layout da Visão Geral (sem React), testável isoladamente. */

export type WidgetId = "sobre" | "resultados" | "evolucoes" | "situacao" | "marcos" | "historico" | "resumo";
export type WidgetState = { id: WidgetId; wide: boolean };

/**
 * Altura MÁXIMA de cada widget (px). O cartão cresce com o conteúdo, naturalmente, e para neste limite: passando dele o
 * excesso fica oculto (sem rolagem) e o cartão oferece a consulta completa no painel lateral. É configuração por widget,
 * sem relação com a linha do grid, e pode evoluir para tamanhos e personalização por usuário.
 */
export const WIDGET_MAX_HEIGHT: Record<WidgetId, number> = {
  sobre: 480,
  resultados: 480,
  situacao: 360,
  evolucoes: 340,
  marcos: 480,
  resumo: 340,
  historico: 400,
};

/**
 * Layout padrão, por linhas: Sobre | Resultados, Situação | Evoluções, Marcos (largura total) e Resumo | Histórico.
 * Médio ocupa 6 das 12 colunas e Grande ocupa as 12.
 */
export const DEFAULT_WIDGETS: WidgetState[] = [
  { id: "sobre", wide: false },
  { id: "resultados", wide: false },
  { id: "situacao", wide: false },
  { id: "evolucoes", wide: false },
  { id: "marcos", wide: true },
  { id: "resumo", wide: false },
  { id: "historico", wide: false },
];

/**
 * Aceita o layout salvo mesmo que widgets tenham sido criados ou removidos depois: ignora desconhecidos e completa
 * os que faltam. Só `id` e `wide` são usados (layouts salvos com outras propriedades continuam válidos).
 */
export function normalizeWidgets(saved: { id: string; wide: boolean }[] | null | undefined): WidgetState[] {
  if (!saved) {
    return DEFAULT_WIDGETS;
  }
  const known = new Set<string>(DEFAULT_WIDGETS.map((item) => item.id));
  const seen = new Set<string>();
  const kept = saved
    .filter((item) => known.has(item.id) && !seen.has(item.id) && seen.add(item.id))
    .map((item) => ({ id: item.id, wide: item.wide })) as WidgetState[];
  return [...kept, ...DEFAULT_WIDGETS.filter((item) => !seen.has(item.id))];
}

/** Move um item para a posição `to` (índice na lista já sem ele). */
export function moveWidget(list: WidgetState[], from: number, to: number): WidgetState[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export type Placed = { item: WidgetState; index: number; span: 6 | 12 };

/**
 * Posiciona os widgets em linhas de um grid de 12 colunas, na ordem escolhida: GRANDE ocupa a linha toda e dois MÉDIOS
 * seguidos dividem a linha (6 + 6, mesma altura externa). A largura é sempre a que o usuário escolheu: um médio que
 * fica sozinho na linha continua com 6 colunas (nenhum widget é alargado sem o usuário pedir).
 */
export function placeWidgets(list: WidgetState[]): Placed[] {
  return list.map((item, index) => ({ item, index, span: item.wide ? 12 : 6 }));
}

/** Linha do grid de cada widget (0, 1, 2...), simulando o preenchimento de 12 colunas na ordem. */
export function rowsOf(placed: Placed[]): Map<WidgetId, number> {
  const rows = new Map<WidgetId, number>();
  let row = 0;
  let used = 0;
  for (const entry of placed) {
    if (used + entry.span > 12) {
      row += 1;
      used = 0;
    }
    rows.set(entry.item.id, row);
    used += entry.span;
  }
  return rows;
}
