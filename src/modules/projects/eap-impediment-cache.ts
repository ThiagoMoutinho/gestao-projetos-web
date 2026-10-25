import { ApiError } from "@/lib/api/fetcher";
import { listEapTaskImpediments } from "@/lib/api/generated/eap/eap";

import { recordedDate } from "./project-records";

export type OpenImpediment = {
  id: string;
  description: string;
  author: string;
  openedAt: string;
};

const UNKNOWN_AUTHOR = "Usuário não identificado";

export type ImpedimentState =
  | { status: "ready"; open: OpenImpediment | null }
  | { status: "error"; message: string };

const requests = new Map<string, Promise<ImpedimentState>>();

export function impedimentRequest(projectId: string, phaseId: string, task: { id: string; hasImpediment: boolean }) {
  const key = `${projectId}:${task.id}:${task.hasImpediment}`;
  const existing = requests.get(key);
  if (existing) {
    return existing;
  }
  const request = loadOpenImpediment(projectId, phaseId, task.id);
  requests.set(key, request);
  return request;
}

export function forgetImpediment(projectId: string, taskId: string) {
  const prefix = `${projectId}:${taskId}:`;
  for (const key of requests.keys()) {
    if (key.startsWith(prefix)) {
      requests.delete(key);
    }
  }
}

async function loadOpenImpediment(projectId: string, phaseId: string, taskId: string): Promise<ImpedimentState> {
  try {
    const response = await listEapTaskImpediments(projectId, phaseId, taskId);
    if (response.status !== 200) {
      return { status: "error", message: "Não foi possível consultar o impedimento." };
    }
    const open = response.data.data.find((item) => item.resolvedAt === null);
    return {
      status: "ready",
      open: open
        ? {
            id: open.id,
            description: open.description,
            author: open.openedByName?.trim() || UNKNOWN_AUTHOR,
            openedAt: recordedDate(open.openedAt),
          }
        : null,
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof ApiError ? error.message : "Não foi possível consultar o impedimento.",
    };
  }
}
