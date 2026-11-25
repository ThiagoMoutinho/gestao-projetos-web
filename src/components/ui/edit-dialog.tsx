"use client";

import { Info, X, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Padrão visual único dos diálogos de edição (Sobre o projeto, Equipe, Modelos de entrega...):
 * cabeçalho compacto com ícone, título, descrição curta e botão de fechar fixo; orientações longas
 * vão no ícone de informação (`details`). Uma única área central rolável (barra fina do globals.css)
 * e rodapé fixo com as ações. Use estas peças em todo diálogo novo ou alterado.
 */
export function EditDialogContent({ className, children, ...props }: ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      showCloseButton={false}
      className={cn(
        "flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-[24px] border border-border/70 bg-popover/95 p-0 shadow-[0_32px_64px_-24px_rgba(16,24,40,0.45)] backdrop-blur-xl sm:max-w-[720px]",
        className,
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export function EditDialogHeader({
  icon: Icon,
  title,
  description,
  details,
  onClose,
  closeDisabled = false,
  tone = "primary",
}: {
  icon: LucideIcon;
  title: ReactNode;
  /** Frase curta do objetivo do diálogo (preferir uma linha). */
  description?: ReactNode;
  /**
   * Só quando houver regra não óbvia (efeito colateral, restrição, fluxo especial).
   * Aparece no ícone de informação ao lado de Fechar; não use para repetir título/descrição.
   */
  details?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  /** Cor do ícone: padrão da paleta, aviso (attention) ou exclusão/rejeição (destructive). */
  tone?: "primary" | "destructive" | "attention" | "success";
}) {
  return (
    <DialogHeader className="flex-row shrink-0 items-center gap-3 border-b bg-muted/30 px-5 py-3.5 text-left sm:gap-4 sm:px-6">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
          tone === "primary" && "bg-primary/12 text-primary ring-primary/25 dark:bg-primary/20",
          tone === "destructive" && "bg-status-critical-soft text-status-critical-ink ring-status-critical/30",
          tone === "attention" && "bg-status-attention-soft text-status-attention-ink ring-status-attention/30",
          tone === "success" && "bg-status-done-soft text-status-done-ink ring-status-done/30",
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <DialogTitle className="truncate text-lg leading-tight font-semibold tracking-tight text-foreground">{title}</DialogTitle>
        {description ? (
          <DialogDescription className="truncate text-sm leading-snug text-muted-foreground">{description}</DialogDescription>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {details ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label="Mais informações sobre este diálogo"
                  className="text-muted-foreground hover:text-foreground"
                />
              }
            >
              <Info aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" className="max-w-80 whitespace-normal text-left text-xs leading-relaxed">
              {details}
            </TooltipContent>
          </Tooltip>
        ) : null}
        <Button type="button" variant="outline" size="icon-sm" onClick={onClose} disabled={closeDisabled} aria-label="Fechar" className="shrink-0 text-muted-foreground hover:text-foreground">
          <X aria-hidden="true" />
        </Button>
      </div>
    </DialogHeader>
  );
}

/** Única área de rolagem do diálogo. */
export function EditDialogBody({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-6 py-5 sm:px-7", className)} {...props}>
      {children}
    </div>
  );
}

export function EditDialogFooter({ status, statusClassName, children }: { status?: ReactNode; statusClassName?: string; children: ReactNode }) {
  return (
    <DialogFooter className="mx-0 mb-0 shrink-0 flex-col-reverse items-stretch gap-3 border-t bg-muted/30 px-6 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-7">
      {status ? <span role="status" aria-live="polite" className={cn("flex items-center gap-2 text-body text-muted-foreground", statusClassName)}>{status}</span> : null}
      <span className="ml-auto flex flex-wrap justify-end gap-2">{children}</span>
    </DialogFooter>
  );
}
