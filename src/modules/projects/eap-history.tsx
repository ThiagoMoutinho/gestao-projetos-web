"use client";

import { AlertTriangle, Ban, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { SkeletonList } from "@/components/ui/skeleton-list";
import { ApiError } from "@/lib/api/fetcher";
import { listEapAudit } from "@/lib/api/generated/eap/eap";
import type { ListEapAuditEntityType } from "@/lib/api/generated/model/listEapAuditEntityType";
import { cn } from "@/lib/utils";

import { formatCivilDate } from "./eap-date-field";
import { HISTORY_GROUP_LABELS, presentHistory, type HistoryEntry, type HistoryGroup, type HistoryTone } from "./eap-history-entries";
import { civilDateInput } from "./eap-present";
import { recordedDate, recordedStatusLabel } from "./project-records";

type HistoryState =
  | { status: "loading" }
  | { status: "ready"; entries: HistoryEntry[] }
  | { status: "error"; message: string };

const TONE: Record<HistoryTone, { dot: string; badge: string }> = {
  cancel: { dot: "bg-muted-foreground ring-4 ring-muted", badge: "bg-muted text-muted-foreground" },
  reactivate: { dot: "bg-primary ring-4 ring-primary/10", badge: "bg-primary/10 text-primary" },
  progress: { dot: "bg-primary ring-4 ring-primary/10", badge: "bg-primary/10 text-primary" },
  delivery: { dot: "bg-status-validation ring-4 ring-status-validation/30", badge: "bg-status-validation-soft text-status-validation-ink" },
  accept: { dot: "bg-success ring-4 ring-success/15", badge: "bg-success/15 text-success-foreground" },
  adjustments: { dot: "bg-status-adjust ring-4 ring-status-adjust/30", badge: "bg-status-adjust-soft text-status-adjust-ink" },
  reject: { dot: "bg-destructive ring-4 ring-destructive/10", badge: "bg-status-critical-soft text-status-critical-ink" },
  automatic: { dot: "bg-muted-foreground/60 ring-4 ring-muted", badge: "bg-muted text-muted-foreground" },
  evidence: { dot: "bg-status-validation ring-4 ring-status-validation/30", badge: "bg-status-validation-soft text-status-validation-ink" },
  impediment: { dot: "bg-warning ring-4 ring-warning/20", badge: "bg-warning/20 text-warning-foreground" },
  reschedule: { dot: "bg-primary ring-4 ring-primary/25", badge: "bg-primary/10 text-primary" },
  dates: { dot: "bg-primary ring-4 ring-primary/25", badge: "bg-primary/10 text-primary" },
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
  const [filter, setFilter] = useState<HistoryGroup | "all">("all");

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
          entries: presentHistory(response.data.data, {
            statusLabel: recordedStatusLabel,
            date: recordedDate,
            civilDate: (value) => formatCivilDate(civilDateInput(value)),
          }),
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
    return <SkeletonList rows={3} label="Consultando histórico" rowClassName="h-[34px]" />;
  }
  if (state.status === "error") {
    return <p className={emptyInline}>{state.message}</p>;
  }
  if (state.entries.length === 0) {
    return <p className={emptyInline}>Nenhuma alteração registrada para este item.</p>;
  }

  const groups = [...new Set(state.entries.map((entry) => entry.group))];
  const active = filter !== "all" && groups.includes(filter) ? filter : "all";
  const visible = active === "all" ? state.entries : state.entries.filter((entry) => entry.group === active);

  return (
    <div className="motion-fade flex flex-col gap-3">
      {groups.length > 1 ? (
        <div role="group" aria-label="Filtrar histórico por tipo de evento" className="flex flex-wrap gap-1.5">
          {(["all", ...groups] as const).map((group) => (
            <button
              key={group}
              type="button"
              aria-pressed={active === group}
              className={cn(
                "h-7 rounded-full border px-2.5 text-[11px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none",
                active === group
                  ? "border-primary/50 bg-primary/10 text-primary underline underline-offset-4"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary",
              )}
              onClick={() => setFilter(group)}
            >
              {group === "all" ? "Todos" : HISTORY_GROUP_LABELS[group]}
            </button>
          ))}
        </div>
      ) : null}
      <ul className="flex flex-col gap-3.5">
      {visible.map((entry) => (
        <li key={entry.id} className="grid grid-cols-[10px_minmax(0,1fr)] gap-[9px]">
          <span className={cn("mt-1 size-[7px] rounded-full", TONE[entry.tone].dot)} />
          <HistoryItem entry={entry} />
        </li>
      ))}
      </ul>
    </div>
  );
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const expandable = Boolean(entry.notes.length > 0 || entry.cause || entry.related.length > 0);
  const onlyNote = entry.notes.length === 1 && !entry.cause && entry.related.length === 0 ? entry.notes[0] : null;

  return (
    <Collapsible className="min-w-0">
      <div className="flex items-start gap-2">
        <strong className="min-w-0 flex-1 text-xs leading-snug text-foreground">{entry.title}</strong>
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[11px] font-semibold", TONE[entry.tone].badge)}>
          {entry.tone === "cancel" ? <Ban className="size-2.5" aria-hidden="true" /> : null}
          {entry.tone === "impediment" ? <AlertTriangle className="size-2.5" aria-hidden="true" /> : null}
          {entry.kindLabel}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {entry.actor} · {entry.createdAt}
      </p>
      {entry.transition ? (
        <p className="mt-0.5 text-xs text-muted-foreground">
          Situação: {entry.transition.from} → {entry.transition.to}
        </p>
      ) : null}
      {expandable ? (
        <>
          <CollapsibleTrigger className="group mt-1 inline-flex items-center gap-0.5 rounded-[4px] text-xs font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none">
            {onlyNote ? `Ver ${onlyNote.label.toLowerCase()}` : "Ver detalhes"}
            <ChevronDown className="size-3 transition-transform group-data-[panel-open]:rotate-180" aria-hidden="true" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1.5 flex flex-col gap-1.5 border-l-2 border-border pl-2">
              {entry.notes.map((note) => (
                <div key={note.label}>
                  <p className="text-xs font-semibold text-foreground/80">{note.label}</p>
                  <p className="text-xs leading-snug break-words whitespace-pre-wrap text-foreground">{note.text}</p>
                </div>
              ))}
              {entry.cause ? <p className="text-xs text-muted-foreground">Motivo: {entry.cause}</p> : null}
              {entry.related.map((related) => (
                <div key={related.id} className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground/80">{related.kindLabel}:</span> {related.title}
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
  "flex min-h-11 items-center gap-1.5 rounded-[7px] border border-dashed border-input bg-muted/50 px-2.5 text-xs text-muted-foreground";
