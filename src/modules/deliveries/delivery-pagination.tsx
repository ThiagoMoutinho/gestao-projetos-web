"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { OptionCombobox } from "@/components/option-combobox";
import { Button } from "@/components/ui/button";

export const PAGE_SIZES = ["5", "10", "20", "50"];

/** Paginação compartilhada das listas de Entregas e de Homologações (mesmo visual e comportamento). */
export function DeliveryPagination({
  label,
  noun,
  total,
  shown,
  current,
  pages,
  pageSize,
  onPage,
  onPageSize,
}: {
  label: string;
  noun: [singular: string, plural: string];
  total: number;
  shown: number;
  current: number;
  pages: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const first = total === 0 ? 0 : (current - 1) * pageSize + 1;
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3.5 text-label text-muted-foreground">
      <span aria-live="polite">
        Exibindo {first}–{first + shown - 1} de {total} {total === 1 ? noun[0] : noun[1]}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" variant="outline" size="icon-sm" aria-label="Página anterior" disabled={current === 1} onClick={() => onPage(current - 1)}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        {Array.from({ length: pages }, (_, index) => index + 1)
          .filter((number) => number === 1 || number === pages || Math.abs(number - current) <= 1)
          .map((number, index, list) => (
            <span key={number} className="flex items-center gap-1.5">
              {index > 0 && number - list[index - 1] > 1 ? <span aria-hidden="true">…</span> : null}
              <Button
                type="button"
                variant={number === current ? "secondary" : "ghost"}
                size="icon-sm"
                aria-label={`Página ${number}`}
                aria-current={number === current ? "page" : undefined}
                onClick={() => onPage(number)}
                className={number === current ? "text-primary" : "text-muted-foreground"}
              >
                {number}
              </Button>
            </span>
          ))}
        <Button type="button" variant="outline" size="icon-sm" aria-label="Próxima página" disabled={current === pages} onClick={() => onPage(current + 1)}>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <span>Itens por página</span>
        <div className="w-24">
          <OptionCombobox
            label="Itens por página"
            value={String(pageSize)}
            onChange={(value) => onPageSize(Number(value) || 5)}
            options={PAGE_SIZES.map((size) => ({ value: size, label: size }))}
          />
        </div>
      </div>
    </nav>
  );
}
