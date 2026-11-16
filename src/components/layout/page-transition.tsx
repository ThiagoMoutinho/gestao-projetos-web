"use client";

import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";

/** Saída da tela atual (só opacidade). A entrada é a classe .page-enter (globals.css): 200 ms, ease-out, 8 px. */
const EXIT_MS = 140;
/** Se a próxima página demora a renderizar, a tela volta a ficar visível (esmaecida) em vez de ficar transparente. */
const SLOW_MS = 120;
const SLOW_OPACITY = "0.6";
/** Segurança: se a navegação não concluir, a página volta ao normal. */
const RECOVER_MS = 4000;

/** Contêiner da página atual (registrado pelo PageTransition do template) e estado da saída em andamento. */
let pageNode: HTMLElement | null = null;
let leaving = false;
let timers: number[] = [];
let settle: (() => void) | null = null;

function clearTimers() {
  timers.forEach((id) => window.clearTimeout(id));
  timers = [];
}

function finishLeaving() {
  clearTimers();
  leaving = false;
  settle?.();
  settle = null;
}

function restore(node: HTMLElement | null) {
  if (node) {
    node.style.transition = "";
    node.style.opacity = "";
  }
}

/**
 * Ponto único da saída animada das páginas (usado em components/layout/app-shell.tsx).
 *
 * Só conta como troca de página a navegação para OUTRO caminho (pathname) da mesma origem. Ficam de fora: mudanças só de
 * query/hash (abas e seções da mesma página), links externos, nova aba, atalhos com Ctrl/Shift/Alt/Meta, downloads, voltar/
 * avançar do navegador, replace/refresh e movimento reduzido. Nesses casos a navegação segue sem nenhum atraso.
 *
 * Dois caminhos, uma só lógica (`leaveThen`):
 * - cliques em links internos (`<a>`), interceptados no documento;
 * - `router.push(...)` de qualquer módulo, porque este provedor entrega aos filhos uma versão do router do Next cujo `push`
 *   passa pela mesma saída. Nenhum módulo precisa mudar. (Usa o contexto do router do Next, que não é API pública:
 *   se uma atualização do Next mudar isso, o código cai no router original e as páginas apenas deixam de ter a saída.)
 */
export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Nova página concluída: libera o estado de saída (o contêiner novo já nasce visível, com a entrada .page-enter).
  useEffect(() => {
    finishLeaving();
  }, [pathname]);

  const leaveThen = useCallback((href: string, navigate: () => void): Promise<void> | undefined => {
    const node = pageNode;
    let url: URL;
    try {
      url = new URL(href, window.location.href);
    } catch {
      navigate();
      return undefined;
    }
    const pageChange = url.origin === window.location.origin && url.pathname !== window.location.pathname;
    if (!pageChange || leaving || !node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      navigate();
      return undefined;
    }

    leaving = true;
    node.style.transition = `opacity ${EXIT_MS}ms ease-out`;
    node.style.opacity = "0";
    const done = new Promise<void>((resolve) => {
      settle = resolve;
    });
    timers.push(
      window.setTimeout(navigate, EXIT_MS),
      window.setTimeout(() => {
        // A página nova ainda não chegou: mostra a atual esmaecida em vez de uma tela vazia.
        node.style.transition = "opacity 200ms ease-out";
        node.style.opacity = SLOW_OPACITY;
      }, EXIT_MS + SLOW_MS),
      window.setTimeout(() => {
        restore(node);
        finishLeaving();
      }, RECOVER_MS),
    );
    return done;
  }, []);

  // Cliques em links internos.
  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || (anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download") || anchor.hasAttribute("data-no-page-transition")) {
        return;
      }
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname || leaving || !pageNode) {
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }
      // O link continua válido: só seguramos o clique para a tela atual sair antes da navegação.
      event.preventDefault();
      void leaveThen(anchor.href, () => router.push(`${url.pathname}${url.search}${url.hash}`));
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router, leaveThen]);

  // router.push de qualquer módulo passa pela mesma saída (replace, back, forward, refresh e prefetch seguem diretos).
  const wrapped = useMemo<AppRouterInstance>(
    () => ({
      ...router,
      push: (href, options) => {
        // Devolve uma promessa para o `startTransition` de quem chama continuar marcando "navegando" até a página trocar.
        return leaveThen(href, () => router.push(href, options)) as unknown as void;
      },
    }),
    [router, leaveThen],
  );

  return <AppRouterContext.Provider value={wrapped}>{children}</AppRouterContext.Provider>;
}

/** Contêiner da página no template: entra de novo a cada troca de caminho (não em abas/seções da mesma página). */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    pageNode = node;
    return () => {
      if (pageNode === node) {
        pageNode = null;
      }
    };
  }, [pathname]);

  return (
    <div key={pathname} ref={ref} className="page-enter flex min-w-0 flex-1 flex-col">
      {children}
    </div>
  );
}
