"use client";

import { PackageCheck } from "lucide-react";

import { PageLoadError } from "@/components/page-load-error";

/** Falha ao carregar Entregas e Homologações: mesmo cabeçalho da página + padrão de erro de carga. */
export function DeliveriesPageError({ message }: { message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <PackageCheck className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl leading-[1.25] font-semibold tracking-[-0.025em] text-foreground">
              Entregas e Homologações
            </h1>
            <p className="mt-1 truncate text-[11.5px] text-muted-foreground">
              Acompanhe as entregas dos projetos, as homologações e os modelos de checklist.
            </p>
          </div>
        </div>
      </header>
      <PageLoadError title="Não foi possível carregar as entregas" message={message} />
    </div>
  );
}
