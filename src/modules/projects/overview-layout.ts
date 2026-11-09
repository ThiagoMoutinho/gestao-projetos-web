/** Lógica pura do layout da Visão Geral (sem React), testável isoladamente. */

export type WidgetId = "sobre" | "resultados" | "evolucoes" | "situacao" | "marcos" | "historico" | "resumo" | "planejamento" | "evidencias" | "equipe";
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
  marcos: 430,
  resumo: 580,
  historico: 400,
  // Planejamento cresce com as seções que o usuário abre; Evidências guarda o próprio limite.
  planejamento: 100000,
  evidencias: 430,
  equipe: 480,
};

/**
 * Layout padrão (referência visual), por linhas: Resumo executivo | Linha do tempo, Marcos | Evidências, Planejamento (largura
 * total) e Sobre | Equipe. Médio ocupa 6 das 12 colunas e Grande ocupa as 12.
 */
export const DEFAULT_WIDGETS: WidgetState[] = [
  { id: "resumo", wide: false },
  { id: "historico", wide: false },
  { id: "marcos", wide: false },
  { id: "evidencias", wide: false },
  { id: "planejamento", wide: true },
  { id: "sobre", wide: false },
  { id: "equipe", wide: false },
];

/**
 * Widgets que existem, mas não fazem parte do quadro padrão da referência. Ficam disponíveis na área "Informações
 * complementares" e podem ser adicionados ao quadro por cada usuário. Layouts já salvos que os incluem continuam iguais.
 */
export const SECONDARY_WIDGETS: WidgetId[] = ["situacao", "evolucoes"];

/** Todos os widgets que podem estar no quadro (os que a pessoa remove ou ainda não adicionou ficam em "Informações complementares"). */
export const BOARD_WIDGETS: WidgetId[] = [...DEFAULT_WIDGETS.map((item) => item.id), ...SECONDARY_WIDGETS];

/** "resultados" virou a aba Resultados de "Sobre o projeto"; o id segue aceito para não invalidar layouts já salvos. */
const KNOWN_WIDGETS = new Set<string>([...DEFAULT_WIDGETS.map((item) => item.id), ...SECONDARY_WIDGETS, "resultados"]);

/**
 * Aceita o layout salvo mesmo que widgets tenham sido criados ou removidos depois: ignora desconhecidos e repetidos. Um
 * widget que a pessoa tirou do quadro continua fora (ele fica em "Informações complementares" para ser adicionado de novo).
 * Sem layout salvo, ou com um layout sem nenhum widget conhecido, usa o padrão. Só `id` e `wide` são usados.
 */
export function normalizeWidgets(saved: { id: string; wide: boolean }[] | null | undefined): WidgetState[] {
  if (!saved) {
    return DEFAULT_WIDGETS;
  }
  const seen = new Set<string>();
  const kept = saved
    .filter((item) => KNOWN_WIDGETS.has(item.id) && !seen.has(item.id) && seen.add(item.id))
    .map((item) => ({ id: item.id, wide: item.wide })) as WidgetState[];
  return kept.length > 0 ? kept : DEFAULT_WIDGETS;
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
