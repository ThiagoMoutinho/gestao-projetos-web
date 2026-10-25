import { ApiError } from "@/lib/api/fetcher";
import { listEapEvidences } from "@/lib/api/generated/eap/eap";

import { recordedDate } from "./project-records";

export type EvidenceParent = { phaseId: string } | { taskId: string } | { milestoneId: string };

export type EvidenceState =
  | { status: "ready"; items: { id: string; title: string; url: string; createdAt: string; deliveryId: string | null }[] }
  | { status: "error"; message: string };

const requests = new Map<string, Promise<EvidenceState>>();

function parentKey(projectId: string, parent: EvidenceParent) {
  const id = "phaseId" in parent ? parent.phaseId : "taskId" in parent ? parent.taskId : parent.milestoneId;
  return `${projectId}:${id}:`;
}

export function evidenceRequest(projectId: string, parent: EvidenceParent, revision = 0) {
  const key = `${parentKey(projectId, parent)}${revision}`;
  const existing = requests.get(key);
  if (existing) {
    return existing;
  }
  const request = loadEvidences(projectId, parent);
  requests.set(key, request);
  return request;
}

export function forgetEvidences(projectId: string, parent: EvidenceParent) {
  const prefix = parentKey(projectId, parent);
  for (const key of requests.keys()) {
    if (key.startsWith(prefix)) {
      requests.delete(key);
    }
  }
}

async function loadEvidences(projectId: string, parent: EvidenceParent): Promise<EvidenceState> {
  try {
    const response = await listEapEvidences(projectId, parent);
    if (response.status !== 200) {
      return { status: "error", message: "Não foi possível consultar as evidências." };
    }
    return {
      status: "ready",
      items: response.data.data.map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        createdAt: recordedDate(item.createdAt),
        deliveryId: item.deliveryId,
      })),
    };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof ApiError ? error.message : "Não foi possível consultar as evidências.",
    };
  }
}
