/** Regras puras do carregamento progressivo da Linha do tempo (sem React), testáveis isoladamente. */

/** Eventos mostrados por vez na Linha do tempo: os primeiros e cada lote pedido em "Mostrar mais". */
export const TIMELINE_PAGE = 15;

/** Quantos itens ficam visíveis depois de carregar mais um lote (nunca passa do total; valores inválidos viram o primeiro lote). */
export function nextVisibleCount(current: number, total: number, page: number = TIMELINE_PAGE): number {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const safeCurrent = Number.isFinite(current) && current > 0 ? Math.floor(current) : 0;
  return Math.min(safeTotal, Math.max(safeCurrent, 0) + page);
}

/** Itens a desenhar agora: o primeiro lote no início e, depois, o que já foi carregado (limitado ao total atual). */
export function visibleCount(loaded: number, total: number, page: number = TIMELINE_PAGE): number {
  const safeTotal = Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
  const safeLoaded = Number.isFinite(loaded) && loaded > 0 ? Math.floor(loaded) : 0;
  return Math.min(safeTotal, Math.max(safeLoaded, page));
}

