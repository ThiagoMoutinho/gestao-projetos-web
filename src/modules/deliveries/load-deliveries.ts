import { ApiError } from "@/lib/api/fetcher";
import { listDeliveryVersions } from "@/lib/api/generated/conformidade-de-entrega/conformidade-de-entrega";
import type { ListDeliveryVersions200DataItem } from "@/lib/api/generated/model/listDeliveryVersions200DataItem";
import { listProjectMembers } from "@/lib/api/generated/participantes/participantes";
import { listProjects } from "@/lib/api/generated/projetos/projetos";

import { collectProjectDeliveries, type DeliveryLine } from "./deliveries-portfolio";

/** Entrega com o registro completo da versão (documentos, validadores e conformidade) para o painel de detalhes. */
export type DeliveryRecord = DeliveryLine & { version: ListDeliveryVersions200DataItem };

export type DeliveriesSnapshot = {
  rows: DeliveryRecord[];
  /** Projetos visíveis ao usuário (base do filtro e do "Nova entrega"). */
  projects: Array<{ id: string; name: string }>;
  /** Projetos cuja consulta de entregas falhou: a tela avisa que a lista pode estar incompleta. */
  unavailable: number;
};

/** Consultas em paralelo, no máximo `limit` por vez, para não sobrecarregar a API com muitos projetos. */
async function inBatches<T, R>(items: ReadonlyArray<T>, limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += limit) {
    results.push(...(await Promise.all(items.slice(start, start + limit).map(task))));
  }
  return results;
}

/**
 * Entregas (versões de entrega) de todos os projetos que o usuário enxerga. Não há endpoint institucional: a lista de projetos e as
 * entregas de cada um vêm dos endpoints existentes, que já aplicam as permissões. Se a consulta de um projeto falhar, só ele fica
 * de fora (contado em `unavailable`); nada é inventado.
 */
export async function loadDeliveries(): Promise<DeliveriesSnapshot> {
  const listed = await listProjects();
  if (listed.status !== 200) {
    throw new ApiError(listed.status, "HTTP_ERROR", "Não foi possível consultar os projetos.");
  }

  const projects = listed.data.data.map((project) => ({ id: project.id, name: project.name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const perProject = await inBatches(listed.data.data, 6, async (project) => {
    const [versions, members] = await Promise.allSettled([listDeliveryVersions(project.id), listProjectMembers(project.id)]);
    return collectProjectDeliveries(
      { id: project.id, name: project.name },
      versions.status === "fulfilled" && versions.value.status === 200 ? { status: 200, data: versions.value.data.data } : null,
      members.status === "fulfilled" && members.value.status === 200
        ? { status: 200, data: members.value.data.data.map((member) => ({ role: member.role, name: member.user.name })) }
        : null,
    );
  });

  return {
    rows: perProject.flatMap((entry) => entry.rows),
    projects,
    unavailable: perProject.filter((entry) => !entry.ok).length,
  };
}
