"use client";

import { OptionCombobox, type ComboOption } from "@/components/option-combobox";

import type { FeedFilters } from "./notification-feed";
import { KIND_LABEL, NOTIFICATION_KINDS, isNotificationKind } from "./notification-state";

const FIELD = "h-9 rounded-lg border-[#d7dce3] bg-white [&_input]:text-[13px]";

/** Filtros por tipo, projeto e pendência. A leitura (Todas / Não lidas / Lidas) fica nas abas da Central. */
export function NotificationFilters({
  filters,
  projects,
  onChange,
}: {
  filters: FeedFilters;
  projects: ReadonlyArray<ComboOption>;
  onChange: (next: FeedFilters) => void;
}) {
  return (
    <div role="search" aria-label="Filtros das notificações" className="grid min-w-0 grid-cols-1 gap-2.5 md:grid-cols-3">
      <div className="min-w-0">
        <OptionCombobox
          label="Filtrar por tipo"
          value={filters.kind}
          onChange={(value) => onChange({ ...filters, kind: isNotificationKind(value) ? value : "" })}
          options={NOTIFICATION_KINDS.map((kind) => ({ value: kind, label: KIND_LABEL[kind] }))}
          placeholder="Tipo: todos"
          clearable
          className={FIELD}
        />
      </div>
      <div className="min-w-0">
        <OptionCombobox
          label="Filtrar por projeto"
          value={filters.projectId}
          onChange={(value) => onChange({ ...filters, projectId: value })}
          options={projects}
          placeholder="Projeto: todos"
          emptyText="Nenhum projeto encontrado."
          clearable
          className={FIELD}
        />
      </div>
      <div className="min-w-0">
        <OptionCombobox
          label="Filtrar por pendência"
          value={filters.pending}
          onChange={(value) => onChange({ ...filters, pending: value === "PENDING" || value === "RESOLVED" ? value : "" })}
          options={[
            { value: "PENDING", label: "Pendentes" },
            { value: "RESOLVED", label: "Resolvidas" },
          ]}
          placeholder="Pendência: todas"
          clearable
          className={FIELD}
        />
      </div>
    </div>
  );
}
