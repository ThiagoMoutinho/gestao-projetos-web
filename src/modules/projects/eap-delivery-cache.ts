import { ApiError } from "@/lib/api/fetcher";
import { listEapMilestoneDeliveries } from "@/lib/api/generated/eap/eap";
import type { ListEapMilestoneDeliveries200DataItem } from "@/lib/api/generated/model/listEapMilestoneDeliveries200DataItem";

export type DeliveryRound = ListEapMilestoneDeliveries200DataItem;

export type DeliveryState = { status: "ready"; rounds: DeliveryRound[] } | { status: "error"; message: string };

const requests = new Map<string, Promise<DeliveryState>>();

/** Rodadas do marco; a chave inclui a versão do marco para recarregar após cada entrega ou decisão. */
export function deliveryRequest(projectId: string, phaseId: string, milestoneId: string, revision: string) {
  const key = `${projectId}:${milestoneId}:${revision}`;
  const existing = requests.get(key);
  if (existing) {
    return existing;
  }
  for (const stale of requests.keys()) {
    if (stale.startsWith(`${projectId}:${milestoneId}:`)) {
      requests.delete(stale);
    }
  }
  const request = loadDeliveries(projectId, phaseId, milestoneId);
  requests.set(key, request);
  return request;
}

async function loadDeliveries(projectId: string, phaseId: string, milestoneId: string): Promise<DeliveryState> {
  try {
    const response = await listEapMilestoneDeliveries(projectId, phaseId, milestoneId);
    if (response.status !== 200) {
      return { status: "error", message: "Não foi possível consultar as rodadas de entrega." };
    }
    return { status: "ready", rounds: response.data.data };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof ApiError ? error.message : "Não foi possível consultar as rodadas de entrega.",
    };
  }
}
