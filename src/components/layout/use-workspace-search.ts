"use client";

import { useEffect, useState } from "react";

import { searchWorkspace } from "@/lib/api/generated/busca/busca";
import { WORKSPACE_MIN_QUERY, type WorkspaceResult } from "@/modules/search/workspace-search";

/** Espera o usuário parar de digitar antes de consultar (menos chamadas e sem piscar a cada letra). */
const DEBOUNCE_MS = 250;

type Settled = { query: string; items: WorkspaceResult[]; failed: boolean };

/**
 * Consulta a busca global do servidor para o termo digitado. O servidor aplica o escopo do usuário; aqui só se pede,
 * cancela a consulta antiga e mostra a resposta do termo atual. Estados: `idle` (termo curto), `loading`, `ready`, `error`.
 */
export function useWorkspaceSearch(query: string, enabled: boolean) {
  const term = query.trim();
  const active = enabled && term.length >= WORKSPACE_MIN_QUERY;
  const [settled, setSettled] = useState<Settled | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchWorkspace({ q: term }, { signal: controller.signal })
        .then((response) => {
          if (controller.signal.aborted) {
            return;
          }
          setSettled(response.status === 200 ? { query: term, items: response.data.items, failed: false } : { query: term, items: [], failed: true });
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSettled({ query: term, items: [], failed: true });
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [active, term]);

  if (!active) {
    return { status: "idle" as const, items: [] as WorkspaceResult[] };
  }
  if (!settled || settled.query !== term) {
    return { status: "loading" as const, items: [] as WorkspaceResult[] };
  }
  return { status: settled.failed ? ("error" as const) : ("ready" as const), items: settled.items };
}
