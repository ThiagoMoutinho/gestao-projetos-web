"use client";

import { useEffect, useRef } from "react";

/** Item ativo do menu lateral (o SidebarMenuButton marca `data-active` quando `isActive`). */
const ACTIVE_ITEM = '[data-sidebar="menu-button"][data-active]:not([data-active="false"])';
/** Duração do deslizamento, dentro da faixa de movimento do projeto (180–250 ms). */
const DURATION = 240;

type Box = { top: number; left: number; width: number; height: number };

function px(box: Box) {
  return { top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px` };
}

/**
 * Fundo do item ativo do menu lateral, compartilhado entre todos os grupos: ao trocar de item ele desliza até o novo,
 * esticando no caminho (a ponta da frente chega primeiro e a de trás alcança depois) e encolhendo no destino. Funciona
 * com o menu aberto e recolhido, acompanha a rolagem do menu e, com `prefers-reduced-motion`, só troca de lugar.
 *
 * Deve ser o primeiro filho do `SidebarContent` (que precisa de `position: relative`). Enquanto não mede o item ativo
 * (renderização no servidor, item ativo dentro de um submenu fechado) o indicador fica oculto e vale o estilo padrão
 * do item ativo; o atributo `data-active-indicator` no contêiner liga o estilo de texto sobre o indicador (globals.css).
 */
export function SidebarActiveIndicator() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const indicator = ref.current;
    const container = indicator?.parentElement;
    if (!indicator || !container) {
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let current: HTMLElement | null = null;
    let last: Box | null = null;
    let frame = 0;
    // Mede de novo só quando algo muda de tamanho: o próprio menu (recolher/expandir) e cada lista de itens (submenus).
    const sizes = new ResizeObserver(() => schedule());
    const lists = new Set<Element>();
    const watchLists = () => {
      container.querySelectorAll('[data-sidebar="menu"]').forEach((list) => {
        if (!lists.has(list)) {
          lists.add(list);
          sizes.observe(list);
        }
      });
    };

    const measure = (element: HTMLElement): Box => {
      const outer = container.getBoundingClientRect();
      const inner = element.getBoundingClientRect();
      return {
        top: inner.top - outer.top + container.scrollTop,
        left: inner.left - outer.left + container.scrollLeft,
        width: inner.width,
        height: inner.height,
      };
    };

    const hide = () => {
      if (indicator.dataset.state === "hidden") return;
      indicator.dataset.state = "hidden";
      container.removeAttribute("data-active-indicator");
      current = null;
      last = null;
    };

    const update = () => {
      const next = container.querySelector<HTMLElement>(ACTIVE_ITEM);
      if (!next || next.getClientRects().length === 0) {
        hide();
        return;
      }
      const box = measure(next);
      if (box.width === 0 || box.height === 0) {
        hide();
        return;
      }
      if (last && current && next !== current && indicator.dataset.state === "visible" && !reduce.matches) {
        const top = Math.min(last.top, box.top);
        const bottom = Math.max(last.top + last.height, box.top + box.height);
        indicator.getAnimations().forEach((animation) => animation.cancel());
        indicator.animate(
          [
            px(last),
            { ...px(box), top: `${top}px`, height: `${bottom - top}px`, offset: 0.5 },
            px(box),
          ],
          { duration: DURATION, easing: "cubic-bezier(0.3, 0.7, 0.2, 1)" },
        );
      }
      // Nada mudou (mesmo item, mesma posição e tamanho): não escreve no DOM, para não provocar novo cálculo de layout.
      const same = next === current && last !== null && last.top === box.top && last.left === box.left && last.width === box.width && last.height === box.height;
      if (!same) {
        Object.assign(indicator.style, px(box));
      }
      if (indicator.dataset.state !== "visible") {
        indicator.dataset.state = "visible";
        container.setAttribute("data-active-indicator", "");
      }
      current = next;
      last = box;
    };

    function schedule() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    }

    update();
    sizes.observe(container);
    watchLists();
    // Só a troca do item ativo (rota, aba do projeto) e a entrada ou saída de grupos do menu (projeto selecionado).
    const changes = new MutationObserver(() => {
      watchLists();
      schedule();
    });
    changes.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-active"] });

    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      changes.disconnect();
      container.removeAttribute("data-active-indicator");
    };
  }, []);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-state="hidden"
      data-slot="sidebar-active-indicator"
      className="pointer-events-none absolute top-0 left-0 z-0 rounded-[10px] bg-(--sidebar-indicator) opacity-0 shadow-[0_6px_16px_-8px_rgb(0_0_0/0.45)] transition-opacity duration-200 data-[state=visible]:opacity-100 motion-reduce:transition-none"
    />
  );
}
