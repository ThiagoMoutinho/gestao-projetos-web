"use client";

import { Archive, CalendarClock, FileText, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/modules/auth/roles";

import { archiveReasonLabel } from "./archive-reasons";

export type ArchiveJustificationView = {
  name: string;
  archivedAt: string | null;
  /** Nome de `archived_by` via API; null → "Usuário não identificado". */
  archivedByName: string | null;
  /** Perfil global do usuário, quando a API devolver. */
  archivedByRole: string | null;
  archiveReason: string | null;
  archiveJustification: string | null;
  archiveOtherDescription: string | null;
};

function formatWhen(value: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(date)
    .replace(", ", " às ");
}

/**
 * Consulta somente leitura da justificativa de arquivamento.
 * "Arquivado por" vem de `archived_by` → user, nunca da equipe do projeto.
 */
export function ArchiveJustificationDialog({
  project,
  open,
  onOpenChange,
}: {
  project: ArchiveJustificationView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reason = archiveReasonLabel(project.archiveReason);
  const legacy = !project.archiveReason && !project.archiveJustification;
  const when = formatWhen(project.archivedAt);
  const archiverName = project.archivedByName?.trim() || null;
  const archiverRole = project.archivedByRole ? roleLabel(project.archivedByRole) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EditDialogContent className="sm:max-w-[640px]">
        <EditDialogHeader
          icon={Archive}
          title="Justificativa do arquivamento"
          description={project.name}
          tone="attention"
          onClose={() => onOpenChange(false)}
        />
        <EditDialogBody className="gap-4 bg-muted/40 sm:gap-5">
          <section aria-label="Dados do arquivamento" className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-semibold tracking-[0.05em] uppercase">Data e horário</span>
              </div>
              <p className={cn("mt-2 text-[15px] leading-snug", when ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {when ?? "Não registrado"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
              <div className="flex items-center gap-2 text-muted-foreground">
                <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-semibold tracking-[0.05em] uppercase">Arquivado por</span>
              </div>
              {archiverName ? (
                <div className="mt-2 space-y-0.5">
                  <p className="text-[15px] leading-snug font-semibold break-words text-foreground">{archiverName}</p>
                  {archiverRole ? <p className="text-xs text-muted-foreground">{archiverRole}</p> : null}
                </div>
              ) : (
                <p className="mt-2 text-[15px] leading-snug text-muted-foreground">Usuário não identificado</p>
              )}
            </div>
          </section>

          {legacy ? (
            <section className="rounded-2xl border border-dashed border-border bg-card px-4 py-5 sm:px-5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="text-[11px] font-semibold tracking-[0.05em] uppercase">Motivo e justificativa</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Arquivamento anterior à obrigatoriedade de justificativa. Não há motivo nem justificativa
                registrados — nenhum texto foi inventado para este registro.
              </p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
              <div className="border-b border-border/60 bg-muted/25 px-4 py-4 sm:px-5">
                <p className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
                  Motivo do arquivamento
                </p>
                <p className="mt-2.5 inline-flex max-w-full items-center rounded-lg bg-foreground/[0.06] px-3 py-1.5 text-[15px] font-semibold text-foreground ring-1 ring-border/60">
                  {reason ?? "—"}
                </p>
                {project.archiveOtherDescription ? (
                  <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {project.archiveOtherDescription}
                  </p>
                ) : null}
              </div>
              <div className="px-4 py-5 sm:px-5 sm:py-6">
                <p className="text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">
                  Justificativa detalhada
                </p>
                <p className="mt-3 text-[15px] leading-8 whitespace-pre-wrap text-foreground">
                  {project.archiveJustification ?? "—"}
                </p>
              </div>
            </section>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Registro administrativo somente leitura. Esta consulta não altera nem restaura o projeto.
          </p>
        </EditDialogBody>
        <EditDialogFooter>
          <Button type="button" variant="outline" className="h-10 min-w-24" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </EditDialogFooter>
      </EditDialogContent>
    </Dialog>
  );
}
