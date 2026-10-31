"use client";

import { useLayoutEffect, useState } from "react";

const CONTROLS = "button, a[href], input, textarea, select, [role=tab]";

/**
 * Diz se o conteúdo de um elemento passa da altura que ele pode ter (o cartão chegou ao limite máximo e o resto está
 * oculto) e desativa (`inert`) os controles que ficam cortados. Acompanha mudanças de tamanho do elemento e do conteúdo, então vale também quando os dados chegam depois.
 */
export function useOverflow(element: HTMLElement | null) {
  const [state, setState] = useState({ overflowing: false, cut: 0 });

  useLayoutEffect(() => {
    if (!element) {
      return;
    }
    const measure = () => {
      const over = element.scrollHeight > element.clientHeight + 1;
      const limit = element.getBoundingClientRect().bottom;
      // O corte acontece no fim da última linha de texto inteira (nunca no meio de uma linha): `cut` é o que se esconde embaixo.
      let cut = 0;
      if (over) {
        let last = element.getBoundingClientRect().top;
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const range = document.createRange();
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) {
            continue;
          }
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (rect.height > 0 && rect.bottom <= limit + 0.5) {
              last = Math.max(last, rect.bottom);
            }
          }
        }
        cut = Math.max(0, Math.round(limit - last - 2));
      }
      setState((previous) => (previous.overflowing === over && previous.cut === cut ? previous : { overflowing: over, cut }));
      // O que fica cortado pelo limite não pode ser clicado nem focado (inclusive por teclado): a consulta completa é o painel.
      const clip = limit - cut;
      element.querySelectorAll<HTMLElement>(CONTROLS).forEach((control) => {
        control.toggleAttribute("inert", over && control.getBoundingClientRect().bottom > clip + 0.5);
      });
    };
    const observer = new ResizeObserver(measure);
    const observeAll = () => {
      observer.disconnect();
      observer.observe(element);
      element.querySelectorAll("*").forEach((child) => observer.observe(child));
    };
    const mutations = new MutationObserver(() => {
      observeAll();
      measure();
    });
    mutations.observe(element, { childList: true, subtree: true, characterData: true });
    observeAll();
    measure();
    return () => {
      observer.disconnect();
      mutations.disconnect();
      // Sem o limite (cartão expandido), nada fica cortado: os controles voltam a responder.
      element.querySelectorAll<HTMLElement>(CONTROLS).forEach((control) => control.removeAttribute("inert"));
    };
  }, [element]);

  return state;
}
