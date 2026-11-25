"use client";

import { X } from "lucide-react";
import type { ComponentType } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { EapPanelHeader, EapSection } from "./eap-ui";

/**
 * Peças visuais compartilhadas pelos painéis de detalhes (mesma linguagem nos quatro): "chip" de contexto e seção em cartão.
 * O painel segue o padrão da EAP (eap-ui.tsx): cabeçalho `EapPanelHeader`, seções `EapSection`, corpo em fundo suave.
 */
export function DrawerChip({
  icon: Icon,
  children,
  className,
  strong = false,
}: {
  icon?: ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
  /** Destaque do chip principal (ex.: total). */
  strong?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-label font-medium whitespace-nowrap",
        strong ? "border-primary/25 bg-primary/10 text-primary" : "border-border/70 bg-card/70 text-muted-foreground dark:border-border",
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Cartão de conteúdo do painel (modelo do Sobre o projeto): cabeçalho com ícone em superfície suave, título e, à direita, um detalhe opcional. */
export function DrawerCard({
  icon: Icon,
  title,
  aside,
  children,
  className,
  divided = true,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Linha separadora entre o cabeçalho (ícone e título) e o conteúdo; padrão em todos os cartões (`false` a remove). */
  divided?: boolean;
}) {
  return (
    <section className={cn("rounded-2xl border border-border/70 bg-card p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-border", className)}>
      <header className={cn("flex items-center gap-3", divided ? "mb-4 border-b border-border/60 pb-4 dark:border-border" : "mb-3.5")}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 ring-inset" aria-hidden="true">
          <Icon className="size-4.5" />
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-semibold text-foreground">{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

/**
 * Cabeçalho padrão de seção dos painéis da Visão Geral: ícone em superfície suave, título, legenda curta e um detalhe à direita
 * (contador, status), com a linha separadora entre ele e o conteúdo. Usado dentro de uma superfície única (Sobre o projeto e
 * Resumo executivo); o `DrawerCard` traz o mesmo cabeçalho para os cartões.
 */
export function DrawerSectionHead({
  icon: Icon,
  title,
  caption,
  aside,
  id,
  divided = true,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  caption?: string;
  aside?: React.ReactNode;
  id?: string;
  /** Linha sob o cabeçalho; desligar quando a superfície já separa as seções por espaço. */
  divided?: boolean;
}) {
  return (
    <header className={cn("mb-4 flex items-center gap-3", divided && "border-b border-border/60 pb-4 dark:border-border")}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 ring-inset" aria-hidden="true">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 id={id} className="text-[15px] leading-tight font-semibold text-foreground">
          {title}
        </h3>
        {caption ? <p className="mt-0.5 text-xs text-muted-foreground">{caption}</p> : null}
      </div>
      {aside}
    </header>
  );
}

/** Contador discreto do cabeçalho de um `DrawerCard`. */
export function DrawerCount({ value }: { value: number }) {
  return <span className="rounded-full bg-muted px-2 py-0.5 text-label font-semibold text-foreground">{value}</span>;
}

/** Estado vazio discreto ("Não informado", "Não definido"…). */
export function DrawerEmpty({ children = "Não informado" }: { children?: React.ReactNode }) {
  return <p className="w-fit rounded-full border border-dashed px-3 py-1 text-xs text-muted-foreground">{children}</p>;
}

export type DrawerNavItem = { id: string; label: string; icon: ComponentType<{ className?: string }>; count?: number };

/**
 * Barra de navegação fixa no topo da área rolável do painel: pílulas com ícone, rótulo e, se houver, a quantidade.
 * Fundo opaco e z-index acima do conteúdo (ícones da timeline, cartões) para o scroll não atravessar o filtro.
 * No Sobre o projeto leva a cada seção; na Linha do tempo filtra os eventos por tipo.
 */
export function DrawerNav({
  items,
  active,
  onSelect,
  label,
  wrapperRef,
}: {
  items: DrawerNavItem[];
  active: string;
  onSelect: (id: string) => void;
  label: string;
  wrapperRef?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div ref={wrapperRef} className="sticky -top-5 z-20 -mx-6 -mt-5 border-b border-border bg-card px-6 py-2.5">
      <nav aria-label={label} className="flex flex-wrap gap-1">
        {items.map(({ id, label: text, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            aria-current={active === id ? "true" : undefined}
            onClick={() => onSelect(id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-1.5 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none",
              active === id ? "border-primary/30 bg-primary/10 text-primary" : "border-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {text}
            {count !== undefined ? <span className={cn("rounded-full px-1.5 py-px text-label font-semibold", active === id ? "bg-primary/15" : "bg-muted text-foreground/80")}>{count}</span> : null}
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Seção em cartão do painel: a mesma do formulário e dos detalhes da EAP (faixa de título suave e conteúdo abaixo). */
export function DrawerSection({ title, subtitle, id, className, children }: { title: string; subtitle: string; id?: string; className?: string; children: React.ReactNode }) {
  return (
    <div id={id} className={cn("scroll-mt-2 [&>section]:mt-0", className)}>
      <EapSection title={title} subtitle={subtitle}>
        {children}
      </EapSection>
    </div>
  );
}

/**
 * Painel lateral de detalhes dos cartões da Visão Geral (Sobre o projeto, Equipe, Resumo executivo e Linha do tempo).
 * Abre pela direita (704 px no desktop, quase a tela toda no celular), com cabeçalho fixo (ícone em superfície suave, título,
 * descrição, fechar e uma faixa de contexto opcional), uma única área central com rolagem independente e rodapé fixo apenas
 * quando `footer` é informado. Usa o `Sheet` existente: a animação de entrada e saída é a dele (desligada com movimento
 * reduzido) e o foco volta ao botão que abriu o painel. O conteúdo só é montado enquanto o painel está aberto.
 */
export function OverviewDetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  icon,
  iconClassName,
  eyebrow = "Visão geral do projeto",
  meta,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  /** Cores do quadradinho do ícone (as mesmas do cabeçalho do cartão). */
  iconClassName: string;
  /** Chamada acima do título (padrão: "Visão geral do projeto"). */
  eyebrow?: string;
  /** Faixa de contexto fixa sob o cabeçalho (contadores, indicadores): use `DrawerChip`. */
  meta?: React.ReactNode;
  /** Rodapé fixo: só para ações relevantes. */
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showCloseButton={false}
        // Esc num campo de seleção (combobox) com a lista fechada não fecha o painel por padrão: aqui ele fecha, como nos demais campos.
        onKeyDownCapture={(event) => {
          const target = event.target as HTMLElement;
          if (event.key === "Escape" && target.getAttribute("role") === "combobox" && target.getAttribute("aria-expanded") !== "true") {
            event.preventDefault();
            onOpenChange(false);
          }
        }}
        overlayClassName="bg-[rgba(13,25,42,0.2)] supports-backdrop-filter:backdrop-blur-[1px]"
        className="w-full gap-0 overflow-hidden bg-card p-0 shadow-[0_18px_48px_rgba(16,24,40,0.16)] ease-out motion-reduce:transition-none data-[side=right]:w-full data-[side=right]:sm:max-w-[min(620px,94vw)]"
      >
        <div className="flex h-full min-h-0 flex-col">
          <EapPanelHeader
            icon={icon}
            tone={iconClassName}
            eyebrow={eyebrow}
            title={<SheetTitle className="max-w-[460px] truncate text-[19px] leading-[1.35] font-semibold text-foreground">{title}</SheetTitle>}
            hint={<SheetDescription className="mt-[7px] block text-xs text-muted-foreground">{description}</SheetDescription>}
            actions={
              <SheetClose render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`Fechar: ${title}`} />}>
                <X aria-hidden="true" />
              </SheetClose>
            }
          />
          {meta ? <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-6 py-3">{meta}</div> : null}
          <div tabIndex={0} role="region" aria-label={`Detalhes: ${title}`} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-muted/50 px-6 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset">
            {children}
          </div>
          {footer ? <footer className="shrink-0 border-t border-border bg-card px-6 py-3">{footer}</footer> : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
