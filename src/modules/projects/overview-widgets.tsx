"use client";

import { ArrowDown, ArrowUp, Check, GripVertical, LayoutDashboard, RotateCcw, Rows2, Columns2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Presence } from "@/components/ui/presence";
import { getMyOverviewLayout, resetMyOverviewLayout, saveMyOverviewLayout } from "@/lib/api/generated/preferências/preferências";
import { reportFailure } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import { DEFAULT_WIDGETS, moveWidget, normalizeWidgets, placeWidgets, WIDGET_MAX_HEIGHT, type WidgetId, type WidgetState } from "./overview-layout";

const TITLES: Record<WidgetId, string> = {
  sobre: "Sobre o Sistema",
  resultados: "Resultados para o IGEPPS",
  evolucoes: "Principais evoluções",
  situacao: "Situação atual",
  marcos: "Marcos e Homologações",
  historico: "Histórico executivo",
  resumo: "Resumo executivo",
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

type Props = {
  /** Conteúdo de cada widget; `null` oculta o widget (ex.: dados ainda indisponíveis). */
  nodes: Record<WidgetId, React.ReactNode>;
};

export function OverviewWidgets({ nodes }: Props) {
  const { widgets, update, reset, saving, savedAt } = useOverviewLayout();
  const [customizing, setCustomizing] = useState(false);
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [over, setOver] = useState<WidgetId | null>(null);
  const board = useRef<HTMLDivElement>(null);
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
          customizing && "rounded-xl transition-shadow duration-200 motion-reduce:transition-none",
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
          </div>
        </Presence>
        {nodes[item.id]}
      </div>
    );
  };

  const placed = placeWidgets(visible);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span role="status" aria-live="polite" className="mr-auto text-xs text-muted-foreground">
          {customizing ? (saving ? "Salvando layout…" : savedAt ? "Layout salvo." : "Arraste os cartões, use as setas ou altere a largura.") : ""}
        </span>
        <Presence open={customizing}>
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={() => void reset()}>
            <RotateCcw aria-hidden="true" /> Restaurar padrão
          </Button>
        </Presence>
        <Button type="button" size="sm" variant={customizing ? "default" : "outline"} className="gap-1.5" aria-pressed={customizing} onClick={() => setCustomizing((current) => !current)}>
          {customizing ? <Check aria-hidden="true" /> : <LayoutDashboard aria-hidden="true" />}
          {customizing ? "Concluir layout" : "Personalizar layout"}
        </Button>
      </div>
      {/* Grid único de 12 colunas, por linhas: sem colunas independentes. */}
      <div ref={board} className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12">
        {placed.map((entry) => renderWidget(entry, entry.index))}
      </div>
    </div>
  );
}
