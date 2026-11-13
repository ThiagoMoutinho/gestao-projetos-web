"use client";

import { X, type LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Padrão visual único dos diálogos de edição (Sobre o projeto, Equipe, Modelos de entrega...):
 * cabeçalho com ícone e botão de fechar fixo, uma única área central rolável (barra fina e discreta, vinda do
 * globals.css) e rodapé fixo com as ações. Use estas peças em todo diálogo novo ou alterado, em vez de montar
 * DialogContent/DialogHeader/DialogFooter à mão.
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
  onClose,
  closeDisabled = false,
  tone = "primary",
}: {
  icon: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  /** Cor do ícone: padrão da paleta, aviso (attention) ou exclusão/rejeição (destructive). */
  tone?: "primary" | "destructive" | "attention" | "success";
}) {
  return (
    <DialogHeader className="flex-row shrink-0 items-start gap-4 border-b px-6 pt-6 pb-5 text-left sm:px-7">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-2xl",
          tone === "primary" && "bg-primary/12 text-primary dark:bg-primary/20",
          tone === "destructive" && "bg-status-critical-soft text-status-critical-ink",
          tone === "attention" && "bg-status-attention-soft text-status-attention-ink",
          tone === "success" && "bg-status-done-soft text-status-done-ink",
        )}
      >
        <Icon className="size-6" />
      </span>
      <div className="min-w-0 flex-1">
        <DialogTitle className="text-page-title font-semibold tracking-tight text-foreground">{title}</DialogTitle>
        {description ? <DialogDescription className="mt-1 text-body text-muted-foreground">{description}</DialogDescription> : null}
      </div>
      <Button type="button" variant="outline" size="icon-sm" onClick={onClose} disabled={closeDisabled} aria-label="Fechar" className="shrink-0">
        <X aria-hidden="true" />
      </Button>
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
    <DialogFooter className="mx-0 mb-0 shrink-0 flex-col-reverse items-stretch gap-3 border-t bg-popover/95 px-6 py-4 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-7">
      {status ? <span role="status" aria-live="polite" className={cn("flex items-center gap-2 text-body text-muted-foreground", statusClassName)}>{status}</span> : null}
      <span className="ml-auto flex flex-wrap justify-end gap-2">{children}</span>
    </DialogFooter>
  );
}
