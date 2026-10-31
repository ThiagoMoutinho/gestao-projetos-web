"use client";

import { BarChart3, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  highlightProjectMilestone,
  removeProjectMilestoneHighlight,
} from "@/lib/api/generated/visão-institucional/visão-institucional";
import { cn } from "@/lib/utils";

import { civilDateInput } from "./eap-present";
import { useAction, type Overview } from "./institutional-shared";
import { SectionCard } from "./overview-panel";
import { recordedStatusLabel } from "./project-records";

/** Item mínimo do monitoramento de prazos usado para completar a lista com os próximos marcos. */
export type PlannedMilestone = {
  entityId: string;
  title: string;
  status: string;
  plannedEndAt: string | null;
};

export type Evolution = {
  id: string;
  title: string;
  statusLabel: string;
  date: string | null;
  done: boolean;
  highlighted: boolean;
};

const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function shortDate(value: string | null) {
  const input = civilDateInput(value);
  if (!input) {
    return "Sem data";
  }
  const [, month, day] = input.split("-");
  return `${day} ${MONTHS[Number(month) - 1]}`;
}

/**
 * Principais evoluções: marcos aprovados (os destacados primeiro) e, depois, os próximos marcos ainda
 * não aprovados, do mais próximo ao mais distante. Só dados reais da EAP; nada é inventado.
 */
export function buildEvolutions(
  approved: Overview["evolutions"] | null,
  planned: ReadonlyArray<PlannedMilestone>,
): Evolution[] {
  const done: Evolution[] = (approved ?? [])
    .map((item) => ({
      id: item.milestoneId,
      title: item.title,
      statusLabel: recordedStatusLabel(item.status),
      date: item.actualAt ?? item.validatedAt ?? item.plannedAt,
      done: true,
      highlighted: item.highlighted,
      order: item.highlightOrder ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort(
      (left, right) =>
        Number(right.highlighted) - Number(left.highlighted) ||
        left.order - right.order ||
        (right.date ?? "").localeCompare(left.date ?? ""),
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      statusLabel: item.statusLabel,
      date: item.date,
      done: item.done,
      highlighted: item.highlighted,
    }));
  const knownIds = new Set(done.map((item) => item.id));
  const next: Evolution[] = planned
    .filter(
      (item) =>
        item.status !== "APROVADO" &&
        item.plannedEndAt &&
        !knownIds.has(item.entityId),
    )
    .sort((left, right) =>
      (left.plannedEndAt as string).localeCompare(right.plannedEndAt as string),
    )
    .map((item) => ({
      id: item.entityId,
      title: item.title,
      statusLabel: recordedStatusLabel(item.status),
      date: item.plannedEndAt,
      done: false,
      highlighted: false,
    }));
  return [...done, ...next];
}

function Timeline({
  items,
  onToggle,
  busy,
}: {
  items: Evolution[];
  onToggle?: (item: Evolution) => void;
  busy?: boolean;
}) {
  return (
    <ol className="relative flex flex-col">
      {items.map((item, index) => (
        <li
          key={item.id}
          className="relative flex items-start gap-3 pb-3 last:pb-0"
        >
          {index < items.length - 1 ? (
            <span
              className="absolute top-3.5 bottom-0 left-[5px] w-px bg-border"
              aria-hidden="true"
            />
          ) : null}
          <span
            className={cn(
              "relative z-10 mt-1 size-[11px] shrink-0 rounded-full border-2",
              item.done
                ? "border-primary bg-primary"
                : "border-muted-foreground/40 bg-background",
            )}
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-1 items-start justify-between gap-3 border-b pb-2 last:border-b-0 last:pb-0">
            <div className="min-w-0">
              <p className="text-xs font-semibold break-words">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {item.statusLabel}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-xs text-muted-foreground">
                {shortDate(item.date)}
              </span>
              {onToggle && item.done ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={busy}
                  aria-pressed={item.highlighted}
                  aria-label={
                    item.highlighted
                      ? `Remover destaque de ${item.title}`
                      : `Destacar ${item.title}`
                  }
                  onClick={() => onToggle(item)}
                >
                  <Star
                    className={
                      item.highlighted ? "fill-warning text-warning" : undefined
                    }
                    aria-hidden="true"
                  />
                </Button>
              ) : item.highlighted ? (
                <Star
                  className="size-3 fill-warning text-warning"
                  aria-label="Em destaque"
                  role="img"
                />
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function EvolutionsCard({
  projectId,
  items,
  canEdit,
  loading,
  failed,
  onChanged,
}: {
  projectId: string;
  items: Evolution[];
  canEdit: boolean;
  loading: boolean;
  failed: boolean;
  onChanged: () => void;
}) {
  const { busy, run } = useAction(onChanged);

  function toggle(item: Evolution) {
    return run(
      () =>
        item.highlighted
          ? removeProjectMilestoneHighlight(projectId, item.id)
          : highlightProjectMilestone(projectId, item.id),
      item.highlighted ? "Destaque removido." : "Marco destacado.",
      "Não foi possível alterar o destaque.",
    );
  }

  return (
    <SectionCard
      title="Principais evoluções"
      subtitle="Marcos e entregas aprovados, com os destacados primeiro."
      icon={BarChart3}
      tone="purple"
      moreLabel={`Ver todas (${items.length})`}
      action={
        !loading && items.length > 0 ? (
          <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            {String(items.length).padStart(2, "0")}
          </span>
        ) : null
      }
    >
      {loading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-9 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : failed && items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Não foi possível consultar os marcos do projeto.
        </p>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nenhum marco aprovado até o momento.
        </p>
      ) : (
        <Timeline
          items={items}
          onToggle={canEdit ? (item) => void toggle(item) : undefined}
          busy={busy}
        />
      )}
    </SectionCard>
  );
}
