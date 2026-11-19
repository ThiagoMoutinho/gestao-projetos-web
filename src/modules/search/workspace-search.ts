/**
 * Regras puras da busca global na tela: rótulos, destino de cada resultado e agrupamento. Sem React e sem rede, para
 * testar à parte. Só usa rotas que existem: a Visão Geral do projeto (`/projetos/[id]`) e a EAP (`?aba=eap`).
 */
import type { SearchWorkspace200ItemsItem } from "../../lib/api/generated/model/searchWorkspace200ItemsItem";

export type WorkspaceResult = SearchWorkspace200ItemsItem;
export type WorkspaceKind = WorkspaceResult["kind"];

/** Mínimo de caracteres para consultar o servidor (o mesmo da API). */
export const WORKSPACE_MIN_QUERY = 2;

/** Rótulo curto de cada tipo (mostrado ao lado do resultado e lido por leitores de tela). */
export const KIND_LABEL: Record<WorkspaceKind, string> = {
  PROJECT: "Projeto",
  GLPI: "Chamado GLPI",
  MINUTES: "Ata",
  PHASE: "Fase",
  TASK: "Tarefa",
  MILESTONE: "Marco",
  EVIDENCE: "Evidência",
  DELIVERY: "Entrega",
  PROFILE: "Sobre o projeto",
  RESULT: "Resultado",
  IMPEDIMENT: "Impedimento",
  PERSON: "Pessoa",
};

/** Título do grupo; fases, tarefas e marcos ficam juntos em "Itens da EAP". */
const GROUP_HEADING: Record<WorkspaceKind, string> = {
  PROJECT: "Projetos",
  GLPI: "Chamados GLPI",
  MINUTES: "Atas",
  PHASE: "Itens da EAP",
  TASK: "Itens da EAP",
  MILESTONE: "Itens da EAP",
  EVIDENCE: "Outras evidências",
  DELIVERY: "Entregas e checklists",
  PROFILE: "Textos do projeto",
  RESULT: "Textos do projeto",
  IMPEDIMENT: "Impedimentos",
  PERSON: "Pessoas",
};

export function resultHref(item: Pick<WorkspaceResult, "projectId" | "destination">): string {
  const base = `/projetos/${encodeURIComponent(item.projectId)}`;
  return item.destination === "EAP" ? `${base}?aba=eap` : base;
}

/** Chave única do resultado (o mesmo id pode existir em tipos diferentes). */
export function resultKey(item: Pick<WorkspaceResult, "kind" | "id">): string {
  return `${item.kind}:${item.id}`;
}

export type WorkspaceGroup = { heading: string; items: WorkspaceResult[] };

/**
 * Agrupa por título mantendo a ordem em que o servidor mandou. `skip` tira resultados já mostrados em outro lugar
 * (os projetos da lista local, que respondem na hora) para não repetir.
 */
export function groupResults(items: readonly WorkspaceResult[], skip?: (item: WorkspaceResult) => boolean): WorkspaceGroup[] {
  const groups: WorkspaceGroup[] = [];
  for (const item of items) {
    if (skip?.(item)) {
      continue;
    }
    const heading = GROUP_HEADING[item.kind];
    const group = groups.find((entry) => entry.heading === heading);
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ heading, items: [item] });
    }
  }
  return groups;
}
