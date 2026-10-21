"use client";

import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api/fetcher";
import { listEapAudit } from "@/lib/api/generated/eap/eap";
import type { ListEapAuditEntityType } from "@/lib/api/generated/model/listEapAuditEntityType";
import { cn } from "@/lib/utils";

import { recordedDate } from "./project-records";

type HistoryEntry = {
  id: string;
  summary: string;
  actor: string;
  createdAt: string;
  evidence: boolean;
};

type HistoryState =
  | { status: "loading" }
  | { status: "ready"; entries: HistoryEntry[] }
  | { status: "error"; message: string };

export function EapHistory({
  projectId,
  entityType,
  entityId,
  refreshKey,
}: {
  projectId: string;
  entityType: ListEapAuditEntityType;
  entityId: string;
  refreshKey?: string;
}) {
  const [state, setState] = useState<HistoryState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    listEapAudit(projectId, { entityType, entityId })
      .then((response) => {
        if (!active) return;
        if (response.status !== 200) {
          setState({ status: "error", message: "Não foi possível consultar o histórico." });
          return;
        }
        setState({
          status: "ready",
          entries: response.data.data.map((item) => ({
            id: item.id,
            summary: item.summary,
            actor: item.actorName?.trim() || "Usuário não identificado",
            createdAt: recordedDate(item.createdAt),
            evidence: item.entityType === "EVIDENCE",
          })),
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: error instanceof ApiError ? error.message : "Não foi possível consultar o histórico.",
        });
      });
    return () => {
      active = false;
    };
  }, [projectId, entityType, entityId, refreshKey]);

  if (state.status === "loading") {
    return <p className={emptyInline}>Consultando histórico…</p>;
  }
  if (state.status === "error") {
    return <p className={emptyInline}>{state.message}</p>;
  }
  if (state.entries.length === 0) {
    return <p className={emptyInline}>Nenhuma alteração registrada para este item.</p>;
  }

  return (
    <ul className="flex flex-col gap-3.5">
      {state.entries.map((entry) => (
        <li key={entry.id} className="grid grid-cols-[10px_minmax(0,1fr)] gap-[9px]">
          <span
            className={cn(
              "mt-1 size-[7px] rounded-full",
              entry.evidence ? "bg-[#8b5bbb] shadow-[0_0_0_4px_#f4ecfb]" : "bg-[#2873cf] shadow-[0_0_0_4px_#eaf2ff]",
            )}
          />
          <span className="min-w-0">
            <strong className="mb-1 block text-[10px] text-[#344054]">{entry.summary}</strong>
            <p className="text-[9.5px] text-[#8a94a6]">
              {entry.actor} · {entry.createdAt}
            </p>
          </span>
        </li>
      ))}
    </ul>
  );
}

const emptyInline =
  "flex min-h-[39px] items-center gap-1.5 rounded-[7px] border border-dashed border-[#d7dce3] bg-[#f8f9fb] px-2.5 text-[8.5px] text-[#98a2b3]";
