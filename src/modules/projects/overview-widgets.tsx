"use client";

import { ArrowDown, ArrowUp, Check, ChevronDown, Columns2, GripVertical, LayoutDashboard, Plus, RotateCcw, Rows2, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { Presence } from "@/components/ui/presence";
import { getMyOverviewLayout, resetMyOverviewLayout, saveMyOverviewLayout } from "@/lib/api/generated/preferências/preferências";
import { reportFailure } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import { BOARD_WIDGETS, DEFAULT_WIDGETS, moveWidget, normalizeWidgets, placeWidgets, WIDGET_MAX_HEIGHT, type WidgetId, type WidgetState } from "./overview-layout";

const TITLES: Record<WidgetId, string> = {
  sobre: "Sobre o Sistema",
  resultados: "Resultados para o IGEPPS",
  evolucoes: "Principais evoluções",
  situacao: "Situação atual",
  marcos: "Marcos e Homologações",
  historico: "Linha do tempo do projeto",
  resumo: "Resumo executivo",
  planejamento: "Planejamento",
  evidencias: "Evidências e Chamados",
  equipe: "Equipe",
};

/** Layout pessoal salvo no servidor. Se a consulta falhar, usa o padrão e a Visão Geral continua funcionando. */
function useOverviewLayout() {
  const [widgets, setWidgets] = useState<WidgetState[]>(DEFAULT_WIDGETS);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Último layout que o servidor já tem: evita gravar de novo o mesmo conteúdo. */
  const synced = useRef<string>(JSON.stringify(DEFAULT_WIDGETS));

  useEffect(() => {
    let active = true;
    getMyOverviewLayout()
      .then((response) => {
        if (active && response.status === 200) {
          const loaded = normalizeWidgets(response.data.widgets);
          synced.current = JSON.stringify(loaded);
          setWidgets(loaded);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
      clearTimeout(timer.current);
    };
  }, []);

  const update = useCallback((next: WidgetState[]) => {
    setWidgets(next);
    setSavedAt(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const payload = JSON.stringify(next);
      if (payload === synced.current) {
        return;
      }
      setSaving(true);
      try {
        await saveMyOverviewLayout({ widgets: next });
        synced.current = payload;
        setSavedAt(true);
      } catch (caught) {
        reportFailure(caught, "Não foi possível salvar o layout.");
      } finally {
        setSaving(false);
      }
    }, 500);
  }, []);

  const reset = useCallback(async () => {
    clearTimeout(timer.current);
    setWidgets(DEFAULT_WIDGETS);
    setSavedAt(false);
    try {
      await resetMyOverviewLayout();
      synced.current = JSON.stringify(DEFAULT_WIDGETS);
      setSavedAt(true);
    } catch (caught) {
      reportFailure(caught, "Não foi possível restaurar o layout padrão.");
    }
  }, []);

  return { widgets, update, reset, saving, savedAt };
}

/** Anima a troca de posição dos widgets (FLIP): cada um desliza do lugar antigo para o novo. */
function useFlip(container: React.RefObject<HTMLElement | null>, signature: string) {
  const previous = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const root = container.current;
    if (!root) {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const next = new Map<string, DOMRect>();
    root.querySelectorAll<HTMLElement>("[data-widget]").forEach((element) => {
      const id = element.dataset.widget as string;
      const rect = element.getBoundingClientRect();
      next.set(id, rect);
      const before = previous.current.get(id);
      if (!reduce && before && (Math.abs(before.top - rect.top) > 1 || Math.abs(before.left - rect.left) > 1)) {
        element.animate(
          [{ transform: `translate(${before.left - rect.left}px, ${before.top - rect.top}px)` }, { transform: "none" }],
          { duration: 300, easing: "ease-out" },
        );
      }
    });
    previous.current = next;
  }, [container, signature]);
}

/** Ponto do cabeçalho da Visão Geral onde o botão Personalizar layout é exibido (null: botão fica na própria barra). */
export const OverviewActionsSlotContext = createContext<HTMLElement | null>(null);

type Props = {
  /** Conteúdo de cada widget; `null` oculta o widget (ex.: dados ainda indisponíveis). */
  nodes: Record<WidgetId, React.ReactNode>;
};

export function OverviewWidgets({ nodes }: Props) {
  const { widgets, update, reset, saving, savedAt } = useOverviewLayout();
  const [customizing, setCustomizing] = useState(false);
  const actionsSlot = useContext(OverviewActionsSlotContext);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [over, setOver] = useState<WidgetId | null>(null);
  const board = useRef<HTMLDivElement>(null);
  const toolbar = useRef<HTMLDivElement>(null);
  // Clique fora dos cartões (laterais, vãos entre eles ou fundo da página) conclui o layout, sem voltar ao botão.
  useEffect(() => {
    if (!customizing) {
      return;
    }
    const conclude = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const inside = target?.closest("[data-widget], [role=dialog], [role=menu], [role=listbox], [data-base-ui-portal]");
      if (!target || inside || toolbar.current?.contains(target) || target.closest("[data-layout-toggle]")) {
        return;
      }
      setCustomizing(false);
    };
    document.addEventListener("pointerdown", conclude);
    return () => document.removeEventListener("pointerdown", conclude);
  }, [customizing]);
  const visible = widgets.filter((item) => nodes[item.id] !== null && nodes[item.id] !== undefined);
  useFlip(board, widgets.map((item) => `${item.id}:${item.wide ? 1 : 0}`).join("|"));

  const indexOf = (id: WidgetId) => widgets.findIndex((item) => item.id === id);
  const move = (id: WidgetId, delta: -1 | 1) => {
    // Move entre os widgets visíveis, para o botão sempre ter efeito na tela.
    const position = visible.findIndex((item) => item.id === id);
    const target = visible[position + delta];
    if (target) {
      update(moveWidget(widgets, indexOf(id), indexOf(target.id)));
    }
  };
  // Remover tira o widget do quadro (nada é apagado): ele passa para "Informações complementares", de onde pode voltar. O quadro nunca fica vazio.
  const remove = (id: WidgetId) => {
    if (widgets.length <= 1) {
      return;
    }
    update(widgets.filter((item) => item.id !== id));
    setExtrasOpen(true);
  };
  const toggleWide = (id: WidgetId) => update(widgets.map((item) => (item.id === id ? { ...item, wide: !item.wide } : item)));
  const drop = (target: WidgetId) => {
    if (dragging && dragging !== target) {
      update(moveWidget(widgets, indexOf(dragging), indexOf(target)));
    }
    setDragging(null);
    setOver(null);
  };

  const renderWidget = ({ item, span }: { item: WidgetState; span: 6 | 12 }, order: number) => {
    const position = visible.findIndex((entry) => entry.id === item.id);
    return (
      <div 
        key={item.id}
        data-widget={item.id}
        data-span={span}
        style={{ "--o": order, "--widget-max": `${WIDGET_MAX_HEIGHT[item.id]}px` } as React.CSSProperties}
        className={cn(
          // Linha do grid: a altura externa acompanha o maior cartão da linha; o cartão preenche e o conteúdo fica no topo.
          "flex min-w-0 flex-col",
          span === 12 ? "lg:col-span-12" : "lg:col-span-6",
          customizing && "mb-9 rounded-xl transition-shadow duration-200 motion-reduce:transition-none",
          customizing && over === item.id && dragging !== item.id && "ring-2 ring-primary/50",
          dragging === item.id && "opacity-60",
        )}
        onDragOver={(event) => {
          if (dragging) {
            event.preventDefault();
            setOver(item.id);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          drop(item.id);
        }}
      >
        <Presence open={customizing}>
          <div className="mb-1.5 flex items-center gap-1 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-1.5 py-1">
            <span
              draggable
              role="button"
              tabIndex={-1}
              aria-label={`Arrastar ${TITLES[item.id]}`}
              title="Arraste para mover"
              className="flex size-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", item.id);
                setDragging(item.id);
              }}
              onDragEnd={() => {
                setDragging(null);
                setOver(null);
              }}
            >
              <GripVertical className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-primary">{TITLES[item.id]}</span>
            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Mover ${TITLES[item.id]} para cima`} title="Mover para cima" disabled={position <= 0} onClick={() => move(item.id, -1)}>
              <ArrowUp />
            </Button>
            <Button type="button" size="icon-xs" variant="ghost" aria-label={`Mover ${TITLES[item.id]} para baixo`} title="Mover para baixo" disabled={position >= visible.length - 1} onClick={() => move(item.id, 1)}>
              <ArrowDown />
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant={item.wide ? "secondary" : "ghost"}
              aria-label={`Largura total: ${TITLES[item.id]}`}
              aria-pressed={item.wide}
              title={item.wide ? "Voltar para meia largura" : "Ocupar a largura toda"}
              className="max-lg:hidden"
              onClick={() => toggleWide(item.id)}
            >
              {item.wide ? <Columns2 /> : <Rows2 />}
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              aria-label={`Remover ${TITLES[item.id]} do quadro`}
              title={widgets.length <= 1 ? "O quadro precisa ter ao menos um cartão" : "Remover do quadro"}
              disabled={widgets.length <= 1}
              className="text-muted-foreground hover:text-destructive"
              onClick={() => remove(item.id)}
            >
              <X />
            </Button>
          </div>
        </Presence>
        {nodes[item.id]}
      </div>
    );
  };

  const placed = placeWidgets(visible);
  // Widgets que não estão no quadro (padrão da referência): continuam disponíveis aqui, sem perder recurso.
  const extras = BOARD_WIDGETS.filter((id) => !widgets.some((item) => item.id === id) && nodes[id] !== null && nodes[id] !== undefined);

  const layoutToggle = (
    <Button type="button" data-layout-toggle="" size="sm" variant={customizing ? "default" : "outline"} className={cn("gap-1.5", !customizing && "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary dark:bg-primary/15 dark:hover:bg-primary/20")} aria-pressed={customizing} onClick={() => setCustomizing((current) => !current)}>
      {customizing ? <Check aria-hidden="true" /> : <LayoutDashboard aria-hidden="true" />}
      {customizing ? "Concluir layout" : "Personalizar layout"}
    </Button>
  );

  const toolbarRow = (
    <div ref={toolbar} className="flex flex-wrap items-center justify-end gap-2">
      <span role="status" aria-live="polite" className="mr-auto text-xs text-muted-foreground">
        {customizing ? (saving ? "Salvando layout…" : savedAt ? "Layout salvo." : "Arraste os cartões, use as setas ou altere a largura. Clique fora dos cartões para concluir.") : ""}
      </span>
      <Presence open={customizing}>
        <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => void reset()}>
          <RotateCcw aria-hidden="true" /> Restaurar padrão
        </Button>
      </Presence>
      {actionsSlot ? null : layoutToggle}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {actionsSlot ? createPortal(layoutToggle, actionsSlot) : null}
      {actionsSlot ? <Presence open={customizing}>{toolbarRow}</Presence> : toolbarRow}
      {/* Grid único de 12 colunas, por linhas: sem colunas independentes. */}
      <div ref={board} className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        {placed.map((entry) => renderWidget(entry, entry.index))}
      </div>
      {extras.length > 0 ? (
        <section aria-label="Cartões fora do quadro" className="flex flex-col gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto min-h-8 w-fit max-w-full justify-start gap-1.5 px-2 py-1.5 text-left whitespace-normal text-primary [&>svg]:shrink-0"
            aria-expanded={extrasOpen}
            onClick={() => setExtrasOpen((value) => !value)}
          >
            <ChevronDown aria-hidden="true" className={cn("transition-transform duration-200 motion-reduce:transition-none", extrasOpen && "rotate-180")} />
            {extrasOpen ? "Ocultar cartões fora do quadro" : `Cartões fora do quadro (${extras.map((id) => TITLES[id]).join(", ")})`}
          </Button>
          <Presence open={extrasOpen}>
            <div className="grid grid-cols-1 items-stretch gap-4 pt-1 lg:grid-cols-12">
              {extras.map((id) => (
                <div key={id} data-extra={id} style={{ "--widget-max": `${WIDGET_MAX_HEIGHT[id]}px` } as React.CSSProperties} className="flex min-w-0 flex-col gap-2 lg:col-span-6">
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-1.5">
                    <span className="min-w-0 truncate text-xs font-semibold text-primary">{TITLES[id]}</span>
                    <Button type="button" size="xs" variant="outline" className="shrink-0 gap-1.5" aria-label={`Adicionar ${TITLES[id]} ao quadro`} onClick={() => update([...widgets, { id, wide: false }])}>
                      <Plus aria-hidden="true" /> Adicionar ao quadro
                    </Button>
                  </div>
                  {/* O cartão preenche o espaço que sobra depois da barra (sem min-h-full, que o fazia passar do contêiner). */}
                  <div className="flex flex-1 flex-col [&>*]:min-h-0 [&>*]:flex-1">{nodes[id]}</div>
                </div>
              ))}
            </div>
          </Presence>
        </section>
      ) : null}
    </div>
  );
}
