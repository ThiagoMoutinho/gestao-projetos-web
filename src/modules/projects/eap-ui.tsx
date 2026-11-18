import type { ReactNode } from "react";
import { Check, Flag, Folder } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Peças visuais compartilhadas pelos painéis de criação, edição e detalhes de fase, tarefa e marco da EAP. Elas definem
 * o padrão visual desses painéis: mudou aqui, muda nos três. Os campos e as regras de negócio ficam em cada painel.
 */

export type EapItemKind = "phase" | "task" | "milestone";

const KIND_LABEL: Record<EapItemKind, string> = { phase: "Fase", task: "Tarefa", milestone: "Marco" };
const KIND_ICON = { phase: Folder, task: Check, milestone: Flag } as const;

/** Cor de cada tipo (mesmos tons do menu "Novo item"): fase na cor primária, tarefa em azul de execução, marco em violeta. */
const KIND_TONE: Record<EapItemKind, string> = {
  phase: "bg-primary/12 text-primary ring-primary/25",
  task: "bg-status-running-soft text-status-running-ink ring-status-running/30",
  milestone: "bg-status-validation-soft text-status-validation-ink ring-status-validation/30",
};

/** Estilo do quadradinho de ícone de cada tipo (usado também nas linhas e cartões da EAP). */
export function eapKindTile(kind: EapItemKind) {
  return KIND_TONE[kind];
}

export function eapKindLabel(kind: EapItemKind) {
  return KIND_LABEL[kind];
}

/** Cabeçalho fixo do painel: ícone do tipo, chamada (eyebrow), título e uma linha de aviso opcional. */
export function EapPanelHeader({
  kind,
  eyebrow,
  title,
  hint,
  actions,
}: {
  kind: EapItemKind;
  eyebrow: string;
  /** Elemento do título (o `SheetTitle` do painel de criação ou um `h2`), com as classes de tamanho já aplicadas. */
  title: ReactNode;
  hint?: ReactNode;
  actions: ReactNode;
}) {
  const Icon = KIND_ICON[kind];
  return (
    <header className="flex min-h-[112px] shrink-0 items-start justify-between gap-4 border-b border-border px-6 pt-5 pb-4">
      <div className="flex min-w-0 items-start gap-3.5">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl ring-1 ring-inset", KIND_TONE[kind])} aria-hidden="true">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <span className="mb-2 block text-xs leading-none font-bold tracking-[0.12em] text-primary uppercase">{eyebrow}</span>
          {title}
          {hint}
        </div>
      </div>
      {actions}
    </header>
  );
}

/** Faixa logo abaixo do cabeçalho: de que item se trata (código e tipo) e a situação dele. */
export function EapContextStrip({ kind, code, badge, className }: { kind: EapItemKind; code: string; badge: ReactNode; className?: string }) {
  return (
    <div className={cn("-mx-6 mb-4 flex items-center justify-between gap-3 border-b border-border bg-card px-6 py-3", className)}>
      <span className="min-w-0 truncate text-xs text-muted-foreground">
        Item da EAP · <strong className="font-semibold text-foreground">{code} · {KIND_LABEL[kind]}</strong>
      </span>
      {badge}
    </div>
  );
}

/** Cartão de seção do formulário: faixa de título com fundo suave e o conteúdo abaixo. */
export function EapSection({
  title,
  subtitle,
  aside,
  tone = "plain",
  children,
}: {
  title: string;
  subtitle: string;
  aside?: ReactNode;
  tone?: "plain" | "accent";
  children: ReactNode;
}) {
  const accent = tone === "accent";
  return (
    <section
      className={cn(
        "mt-3 overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
        accent ? "border-primary/30" : "border-border",
      )}
    >
      <div className={cn("flex items-start justify-between gap-3 border-b px-5 py-3.5", accent ? "border-primary/15 bg-primary/5" : "border-border/70 bg-muted/40")}>
        <div className="min-w-0">
          <strong className="block text-[13.5px] text-foreground">{title}</strong>
          <span className="mt-0.5 block text-xs text-muted-foreground">{subtitle}</span>
        </div>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
