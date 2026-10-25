import { ApiError } from "@/lib/api/fetcher";
import { listScheduleChanges } from "@/lib/api/generated/cronograma/cronograma";
import type { ListScheduleChanges200DataItem } from "@/lib/api/generated/model/listScheduleChanges200DataItem";
import type { ListScheduleChangesEntityType } from "@/lib/api/generated/model/listScheduleChangesEntityType";

export type ScheduleChange = ListScheduleChanges200DataItem;

export type ScheduleChangesState = { status: "ready"; changes: ScheduleChange[] } | { status: "error"; message: string };

const requests = new Map<string, Promise<ScheduleChangesState>>();

/** Reprogramações do item em ordem cronológica; a chave inclui a versão das datas para recarregar após cada mudança. */
export function scheduleChangesRequest(projectId: string, entityType: ListScheduleChangesEntityType, entityId: string, revision: string) {
  const prefix = `${projectId}:${entityType}:${entityId}:`;
  const key = `${prefix}${revision}`;
  const existing = requests.get(key);
  if (existing) {
    return existing;
  }
  for (const stale of requests.keys()) {
    if (stale.startsWith(prefix)) {
      requests.delete(stale);
    }
  }
  const request = loadChanges(projectId, entityType, entityId);
  requests.set(key, request);
  return request;
}

async function loadChanges(projectId: string, entityType: ListScheduleChangesEntityType, entityId: string): Promise<ScheduleChangesState> {
  try {
    const response = await listScheduleChanges(projectId, { entityType, entityId });
    if (response.status !== 200) {
      return { status: "error", message: "Não foi possível consultar as reprogramações." };
    }
    return { status: "ready", changes: response.data.data };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof ApiError ? error.message : "Não foi possível consultar as reprogramações.",
    };
  }
}
