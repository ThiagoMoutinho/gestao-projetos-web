/**
 * Regras puras da gestão do catálogo de funções de participante: texto de uso, o que pode ser feito com cada função e o texto
 * de impacto das confirmações. Sem React e sem rede, para testar à parte. A API valida tudo de novo (a tela só orienta).
 */
import { functionNameConflict } from "./team-editing.ts";

export type FunctionUsage = { members: number; history: number } | null;
export type CatalogFunction = { id: string; name: string; isActive: boolean; usage: FunctionUsage };

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/** Função em uso: algum participante a tem hoje ou algum registro do histórico a cita. Uso desconhecido conta como em uso (lado seguro). */
export function isInUse(usage: FunctionUsage): boolean {
  return usage === null || usage.members > 0 || usage.history > 0;
}

/** Resumo do uso para a lista: "Nunca atribuída", "Em uso por 3 participantes", "Consta em 2 registros do histórico"... */
export function usageSummary(usage: FunctionUsage): string {
  if (usage === null) return "Uso indisponível";
  if (!isInUse(usage)) return "Nunca atribuída";
  const parts: string[] = [];
  if (usage.members > 0) parts.push(`Em uso por ${plural(usage.members, "participante", "participantes")}`);
  if (usage.history > 0) parts.push(`${parts.length === 0 ? "Consta" : "consta"} em ${plural(usage.history, "registro", "registros")} do histórico`);
  return parts.join(" · ");
}

/** Só pode excluir definitivamente uma função nunca atribuída. */
export function canDelete(fn: CatalogFunction): boolean {
  return !isInUse(fn.usage);
}

export function deleteBlockedReason(fn: CatalogFunction): string | null {
  return canDelete(fn) ? null : "Esta função está em uso ou consta no histórico: não pode ser excluída, apenas desativada.";
}

/** Nome de papel fixo (ex.: Desenvolvedor): função assim não pode ser reativada nem receber esse nome. */
export function hasReservedName(name: string): boolean {
  return functionNameConflict(name, []) === "role";
}

export function canReactivate(fn: CatalogFunction): boolean {
  return !fn.isActive && !hasReservedName(fn.name);
}

export function reactivateBlockedReason(fn: CatalogFunction): string | null {
  if (fn.isActive || !hasReservedName(fn.name)) return null;
  return "O nome desta função é o de um papel fixo da lista, então ela não pode ser reativada. Renomeie ou exclua.";
}

/** Texto de impacto da confirmação de desativar. */
export function deactivateImpact(fn: CatalogFunction): string {
  const holders =
    fn.usage && fn.usage.members > 0
      ? ` ${plural(fn.usage.members, "participante a tem", "participantes a têm")} hoje e ${fn.usage.members === 1 ? "mantém" : "mantêm"} o rótulo; o histórico não muda.`
      : " Nenhum participante a tem hoje; o histórico não muda.";
  return `A função “${fn.name}” deixará de aparecer ao incluir ou alterar participantes.${holders} Você pode reativá-la depois.`;
}

/** Texto de impacto da confirmação de excluir (só chega aqui para função nunca atribuída). */
export function deleteImpact(fn: CatalogFunction): string {
  return `A função “${fn.name}” será excluída definitivamente do catálogo. Ela nunca foi atribuída, então nenhum participante nem registro do histórico é afetado. Esta ação não pode ser desfeita.`;
}

/** Problema do novo nome numa edição (ou null): o nome é validado no cliente e de novo na API. */
export function renameConflict(name: string, others: ReadonlyArray<{ name: string }>): string | null {
  const conflict = functionNameConflict(name, others);
  if (conflict === "role") return "Esse nome já existe como papel na lista (ex.: Desenvolvedor).";
  if (conflict === "function") return "Já existe outra função com esse nome.";
  return null;
}
