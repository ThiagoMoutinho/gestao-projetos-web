import { apiFetcher } from "@/lib/api/fetcher";

import type { ArchiveReason } from "./archive-reasons";

export type ArchiveProjectBody = {
  reason: ArchiveReason;
  justification: string;
  otherDescription?: string;
};

export type ArchiveProjectResponse = {
  data: {
    projectId: string;
    archivedAt: string;
    archivedBy: string;
    archiveReason: ArchiveReason;
    archiveJustification: string;
    archiveOtherDescription: string | null;
  };
  status: 200;
};

type ErrorBody = { message: string; code: string };

export type ArchiveProjectError = {
  data: ErrorBody;
  status: 400 | 401 | 403 | 404 | 409;
};

/** POST /projects/:id/archive — arquivamento soft com motivo e justificativa. */
export async function archiveProject(
  id: string,
  body: ArchiveProjectBody,
  options?: Parameters<typeof apiFetcher>[1],
): Promise<ArchiveProjectResponse | ArchiveProjectError> {
  return apiFetcher(`/projects/${id}/archive`, {
    ...options,
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
}

export type UnarchiveProjectResponse = { data: undefined; status: 204 };

/** POST /projects/:id/unarchive — remove o arquivamento soft; preserva a justificativa. */
export async function unarchiveProject(
  id: string,
  options?: Parameters<typeof apiFetcher>[1],
): Promise<UnarchiveProjectResponse | ArchiveProjectError> {
  return apiFetcher(`/projects/${id}/unarchive`, { ...options, method: "POST" });
}
