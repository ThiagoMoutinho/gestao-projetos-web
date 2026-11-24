/**
 * Lógica pura da tela Entregas e Homologações (sem React), testável isoladamente. "Entrega" é a versão de entrega de um projeto
 * (a mesma da Conformidade de Entrega); aqui só se reúnem e se resumem os registros que a API já devolve, sem regras novas.
 */

import { NATURE_LABEL, type Conformity, type Nature } from "../projects/delivery-compliance.ts";

export type DeliveryStatus = "CONFORME" | "EM_HOMOLOGACAO" | "COM_PENDENCIA" | "AGUARDANDO_ENVIO";

export const DELIVERY_STATUS: Record<DeliveryStatus, { label: string; tone: "success" | "info" | "danger" | "warning"; hint: string }> = {
  CONFORME: { label: "Conforme", tone: "success", hint: "Todos os documentos obrigatórios estão aprovados ou dispensados." },
  EM_HOMOLOGACAO: { label: "Em homologação", tone: "info", hint: "Há documento enviado aguardando a validação do responsável." },
  COM_PENDENCIA: { label: "Com pendência", tone: "danger", hint: "Há documento rejeitado: é preciso reenviar a versão corrigida." },
  AGUARDANDO_ENVIO: { label: "Aguardando envio", tone: "warning", hint: "Há documento obrigatório ainda não enviado." },
};

/** Situação da entrega, deduzida só da conformidade que a API calcula (nada é reclassificado aqui). Rejeição pesa mais que validação em curso. */
export function deliveryStatus(conformity: Pick<Conformity, "conforming" | "rejected" | "awaitingValidation">): DeliveryStatus {
  if (conformity.conforming) return "CONFORME";
  if (conformity.rejected > 0) return "COM_PENDENCIA";
  if (conformity.awaitingValidation > 0) return "EM_HOMOLOGACAO";
  return "AGUARDANDO_ENVIO";
}

export type DeliveryLine = {
  id: string;
  projectId: string;
  projectName: string;
  suppliers: string[];
  versionLabel: string;
  nature: Nature;
  createdAt: string;
  documents: number;
  status: DeliveryStatus;
};

export type DeliveryTotals = { total: number; conforming: number; inHomologation: number; withPendency: number };

export function deliveryTotals(lines: ReadonlyArray<Pick<DeliveryLine, "status">>): DeliveryTotals {
  return {
    total: lines.length,
    conforming: lines.filter((line) => line.status === "CONFORME").length,
    inHomologation: lines.filter((line) => line.status === "EM_HOMOLOGACAO").length,
    withPendency: lines.filter((line) => line.status === "COM_PENDENCIA").length,
  };
}

const plain = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Título exibido da entrega: a versão lógica do produto. */
export function deliveryTitle(line: Pick<DeliveryLine, "versionLabel">) {
  return `Versão ${line.versionLabel}`;
}

export type DeliveryFilters = { query: string; projectId: string; status: DeliveryStatus | "" };

/** Busca por título, projeto, fornecedor e natureza (sem acento nem caixa) e filtros por projeto e situação. Mais recentes primeiro. */
export function filterDeliveries<T extends DeliveryLine>(lines: ReadonlyArray<T>, filters: DeliveryFilters): T[] {
  const needle = plain(filters.query.trim());
  return lines
    .filter((line) => (filters.projectId === "" || line.projectId === filters.projectId) && (filters.status === "" || line.status === filters.status))
    .filter(
      (line) =>
        needle === "" || plain([deliveryTitle(line), line.projectName, line.suppliers.join(" "), NATURE_LABEL[line.nature]].join(" ")).includes(needle),
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.projectName.localeCompare(right.projectName, "pt-BR"));
}

type VersionLike = {
  id: string;
  versionLabel: string;
  nature: Nature;
  createdAt: string;
  items: ReadonlyArray<unknown>;
  conformity: Pick<Conformity, "conforming" | "rejected" | "awaitingValidation">;
};
type Reply<T> = { status: number; data: T } | null;

/**
 * Monta as entregas de UM projeto a partir das respostas das consultas (`null` = a chamada falhou). Se as versões não vieram (falha ou
 * status diferente de 200), o projeto fica de fora e `ok` é falso, para a tela avisar que a lista está incompleta. Se só os participantes
 * falharem, as entregas aparecem sem fornecedor (nada é inventado).
 */
export function collectProjectDeliveries<V extends VersionLike>(
  project: { id: string; name: string },
  versions: Reply<ReadonlyArray<V>>,
  members: Reply<ReadonlyArray<{ role: string; name: string }>>,
): { ok: boolean; rows: Array<DeliveryLine & { version: V }> } {
  if (!versions || versions.status !== 200) return { ok: false, rows: [] };
  const suppliers =
    members && members.status === 200
      ? [...new Set(members.data.filter((member) => member.role === "FORNECEDOR").map((member) => member.name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"))
      : [];
  return {
    ok: true,
    rows: versions.data.map((version) => ({
      id: version.id,
      projectId: project.id,
      projectName: project.name,
      suppliers,
      versionLabel: version.versionLabel,
      nature: version.nature,
      createdAt: version.createdAt,
      documents: version.items.length,
      status: deliveryStatus(version.conformity),
      version,
    })),
  };
}

// ---------- Homologações ----------

/**
 * Etapas da homologação, derivadas da MESMA situação da entrega (nenhuma regra nova): documento enviado aguarda validação; documento
 * rejeitado devolve a entrega para correção; tudo aprovado/dispensado é homologada. Não existe estado "em análise" na API.
 */
export type HomologationStage = "AGUARDANDO_VALIDACAO" | "DEVOLVIDA" | "HOMOLOGADA";

export const HOMOLOGATION_STAGES: HomologationStage[] = ["AGUARDANDO_VALIDACAO", "DEVOLVIDA", "HOMOLOGADA"];

export const HOMOLOGATION_STAGE: Record<HomologationStage, { label: string; badge: string; status: DeliveryStatus; hint: string }> = {
  AGUARDANDO_VALIDACAO: { label: "Aguardando validação", badge: "Aguardando validação", status: "EM_HOMOLOGACAO", hint: "Documentos enviados que aguardam a decisão do responsável." },
  DEVOLVIDA: { label: "Devolvidas para correção", badge: "Devolvida para correção", status: "COM_PENDENCIA", hint: "Há documento rejeitado: o fornecedor precisa reenviar a versão corrigida." },
  HOMOLOGADA: { label: "Homologadas", badge: "Homologada", status: "CONFORME", hint: "Todos os documentos obrigatórios estão aprovados ou dispensados." },
};

/** Etapa da entrega; entregas que ainda não enviaram documento algum (aguardando envio) não entram na homologação. */
export function homologationStage(status: DeliveryStatus): HomologationStage | null {
  return HOMOLOGATION_STAGES.find((stage) => HOMOLOGATION_STAGE[stage].status === status) ?? null;
}

export function homologationCounts(lines: ReadonlyArray<Pick<DeliveryLine, "status">>): Record<HomologationStage, number> {
  const counts: Record<HomologationStage, number> = { AGUARDANDO_VALIDACAO: 0, DEVOLVIDA: 0, HOMOLOGADA: 0 };
  for (const line of lines) {
    const stage = homologationStage(line.status);
    if (stage) counts[stage] += 1;
  }
  return counts;
}

/** Entregas em homologação (qualquer etapa), com a mesma busca e filtro de projeto da lista de entregas; `stage` restringe a uma etapa. */
export function filterHomologations<T extends DeliveryLine>(lines: ReadonlyArray<T>, filters: { query: string; projectId: string; stage: HomologationStage | "" }): T[] {
  return filterDeliveries(
    lines.filter((line) => homologationStage(line.status) !== null),
    { query: filters.query, projectId: filters.projectId, status: filters.stage ? HOMOLOGATION_STAGE[filters.stage].status : "" },
  );
}
