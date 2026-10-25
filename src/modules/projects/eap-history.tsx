"use client";

import { AlertTriangle, Ban, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ApiError } from "@/lib/api/fetcher";
import { listEapAudit } from "@/lib/api/generated/eap/eap";
import type { ListEapAuditEntityType } from "@/lib/api/generated/model/listEapAuditEntityType";
import { cn } from "@/lib/utils";

import { presentHistory, type HistoryEntry, type HistoryTone } from "./eap-history-entries";
import { recordedDate, recordedStatusLabel } from "./project-records";

type HistoryState =
  | { status: "loading" }
  | { status: "ready"; entries: HistoryEntry[] }
  | { status: "error"; message: string };

const TONE: Record<HistoryTone, { dot: string; badge: string }> = {
  cancel: { dot: "bg-muted-foreground ring-4 ring-muted", badge: "bg-muted text-muted-foreground" },
  reactivate: { dot: "bg-primary ring-4 ring-primary/10", badge: "bg-primary/10 text-primary" },
  progress: { dot: "bg-primary ring-4 ring-primary/10", badge: "bg-primary/10 text-primary" },
  delivery: { dot: "bg-[#8b5bbb] ring-4 ring-[#f4ecfb]", badge: "bg-[#f4ecfb] text-[#7450bf]" },
  accept: { dot: "bg-success ring-4 ring-success/15", badge: "bg-success/15 text-success-foreground" },
  adjustments: { dot: "bg-[#c4620f] ring-4 ring-[#fdeedd]", badge: "bg-[#fdeedd] text-[#b4570f]" },
  reject: { dot: "bg-destructive ring-4 ring-destructive/10", badge: "bg-destructive/10 text-destructive" },
  automatic: { dot: "bg-muted-foreground/60 ring-4 ring-muted", badge: "bg-muted text-muted-foreground" },
  evidence: { dot: "bg-[#8b5bbb] ring-4 ring-[#f4ecfb]", badge: "bg-[#f4ecfb] text-[#7450bf]" },
  impediment: { dot: "bg-warning ring-4 ring-warning/20", badge: "bg-warning/20 text-warning-foreground" },
  reschedule: { dot: "bg-[#3871bf] ring-4 ring-[#e9f2ff]", badge: "bg-[#e9f2ff] text-[#285da8]" },
  neutral: { dot: "bg-primary ring-4 ring-primary/10", badge: "bg-muted text-muted-foreground" },
};

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
          entries: presentHistory(response.data.data, { statusLabel: recordedStatusLabel, date: recordedDate }),
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
          <span className={cn("mt-1 size-[7px] rounded-full", TONE[entry.tone].dot)} />
          <HistoryItem entry={entry} />
        </li>
      ))}
    </ul>
  );
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const expandable = Boolean(entry.notes.length > 0 || entry.cause || entry.related.length > 0);
  const onlyNote = entry.notes.length === 1 && !entry.cause && entry.related.length === 0 ? entry.notes[0] : null;

  return (
    <Collapsible className="min-w-0">
      <div className="flex items-start gap-2">
        <strong className="min-w-0 flex-1 text-[10px] leading-snug text-[#344054]">{entry.title}</strong>
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[8px] font-semibold", TONE[entry.tone].badge)}>
          {entry.tone === "cancel" ? <Ban className="size-2.5" aria-hidden="true" /> : null}
          {entry.tone === "impediment" ? <AlertTriangle className="size-2.5" aria-hidden="true" /> : null}
          {entry.kindLabel}
        </span>
      </div>
      <p className="mt-0.5 text-[9.5px] text-[#8a94a6]">
        {entry.actor} · {entry.createdAt}
      </p>
      {entry.transition ? (
        <p className="mt-0.5 text-[9px] text-[#667085]">
          Situação: {entry.transition.from} → {entry.transition.to}
        </p>
      ) : null}
      {expandable ? (
        <>
          <CollapsibleTrigger className="group mt-1 inline-flex items-center gap-0.5 rounded-[4px] text-[9px] font-semibold text-[#205eb2] hover:underline focus-visible:ring-2 focus-visible:ring-[#8ab4eb] focus-visible:outline-none">
            {onlyNote ? `Ver ${onlyNote.label.toLowerCase()}` : "Ver detalhes"}
            <ChevronDown className="size-3 transition-transform group-data-[panel-open]:rotate-180" aria-hidden="true" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1.5 flex flex-col gap-1.5 border-l-2 border-[#e4e7ec] pl-2">
              {entry.notes.map((note) => (
                <div key={note.label}>
                  <p className="text-[8.5px] font-semibold text-[#475467]">{note.label}</p>
                  <p className="text-[9.5px] leading-snug break-words whitespace-pre-wrap text-[#344054]">{note.text}</p>
                </div>
              ))}
              {entry.cause ? <p className="text-[9px] text-[#667085]">Motivo: {entry.cause}</p> : null}
              {entry.related.map((related) => (
                <div key={related.id} className="text-[9px] text-[#667085]">
                  <span className="font-semibold text-[#475467]">{related.kindLabel}:</span> {related.title}
                  {related.transition ? ` (${related.transition.from} → ${related.transition.to})` : null}
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </>
      ) : null}
    </Collapsible>
  );
}

const emptyInline =
  "flex min-h-[39px] items-center gap-1.5 rounded-[7px] border border-dashed border-[#d7dce3] bg-[#f8f9fb] px-2.5 text-[8.5px] text-[#98a2b3]";
