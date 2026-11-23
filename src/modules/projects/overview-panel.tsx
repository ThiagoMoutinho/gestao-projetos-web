"use client";

import type { Flag } from "lucide-react";
import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Card } from "@/components/ui/card";

import { SeeMore } from "./institutional-shared";
import { OverviewDetailDrawer } from "./overview-detail-drawer";
import { useOverflow } from "./use-overflow";

const SECTION_TONE = {
  blue: "bg-primary/12 text-primary ring-primary/25",
  green: "bg-success/15 text-success-foreground ring-success/30",
  purple: "bg-status-validation-soft text-status-validation-ink ring-status-validation/30",
  amber: "bg-warning/20 text-warning-foreground ring-warning/35",
} as const;

/** Acabamento dos cartões da Visão Geral (Figma): borda suave no lugar do anel e sombra em duas camadas. */
export const OVERVIEW_CARD =
  "min-h-full rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-0 dark:border-border dark:shadow-none";

/**
 * Crescimento natural com limite: o cartão tem a altura do conteúdo e para de crescer em `--widget-max` (definido por
 * widget no quadro, sem relação com a linha do grid). Passando disso o excesso fica oculto (sem rolagem interna) e o
 * cartão oferece "Ver mais", que expande o próprio cartão (o limite sai e a linha do grid cresce, sem sobrepor os
 * vizinhos); "Ver menos" volta ao limite.
 */
const WIDGET_MAX_HEIGHT = "max-h-(--widget-max)";

/** Dentro de um cartão com abas (por exemplo, "Sobre o projeto"), os SectionCard internos aparecem sem moldura nem cabeçalho. */
/** `slot` é o lugar, no cabeçalho do cartão externo, onde a ação (por exemplo, o lápis de editar) de cada seção interna aparece. */
export const EmbeddedCards = createContext<{ slot: HTMLElement | null } | null>(null);

type SectionCardProps = Parameters<typeof SectionCardFrame>[0];

/** Card de seção da Visão Geral (modelo do Figma): ícone em bloco colorido, título, subtítulo e ação à direita. */
export function SectionCard(props: SectionCardProps) {
  const embedded = useContext(EmbeddedCards);
  return embedded ? <EmbeddedSection {...props} slot={embedded.slot} /> : <SectionCardFrame {...props} />;
}

/** Mesmo conteúdo do cartão (ação, corpo, expansão e rodapé), sem Card nem cabeçalho. */
function EmbeddedSection({ action, children, footer, expansion, moreLabel = "Ver mais", expandable = false, expanded: controlled, onExpandedChange, slot }: SectionCardProps & { slot: HTMLElement | null }) {
  const [own, setOwn] = useState(false);
  const expanded = controlled ?? own;
  const hasExpansion = expansion !== undefined && expansion !== null;
  return (
    <div className="flex flex-col gap-3">
      {action ? (slot ? createPortal(action, slot) : <div className="flex justify-end">{action}</div>) : null}
      <div className="flex flex-col gap-3">{hasExpansion && expanded ? expansion : children}</div>
      {hasExpansion || expandable ? (
        <SeeMore
          onClick={() => {
            setOwn(!expanded);
            onExpandedChange?.(!expanded);
          }}
          expanded={expanded}
          className="mt-0"
        >
          {expanded ? "Ver menos" : moreLabel}
        </SeeMore>
      ) : null}
      {footer}
    </div>
  );
}

function SectionCardFrame({
  title,
  subtitle,
  icon: Icon,
  tone,
  action,
  moreLabel = "Ver mais",
  showToggle = true,
  expandable = false,
  unbounded = false,
  extraHeight = 0,
  expanded: controlled,
  onExpandedChange,
  expansion,
  drawer,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  icon: typeof Flag;
  tone: keyof typeof SECTION_TONE;
  action?: React.ReactNode;
  /** Texto da ação de expandir. Ela só aparece quando o conteúdo passa do limite de altura (ou com o cartão já expandido). */
  moreLabel?: string;
  /** false quando o próprio cartão já traz a ação de expandir (por exemplo, no rodapé). */
  showToggle?: boolean;
  /** O cartão tem conteúdo complementar que só aparece expandido: "Ver mais" aparece mesmo sem excedente a cortar. */
  expandable?: boolean;
  /** Sem limite de altura nem corte: o cartão cresce com o conteúdo e cada parte controla a sua própria expansão. */
  unbounded?: boolean;
  /** Altura a somar ao limite do cartão (por exemplo, o detalhe de um item aberto no lugar), sem virar "Ver todos". */
  extraHeight?: number;
  /** Controle externo do estado expandido (por exemplo, o lápis que abre a edição já com o cartão expandido). */
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Conteúdo completo exibido no lugar do resumo quando o cartão está expandido (com transição). Sem ele, expandir só retira o limite. */
  expansion?: React.ReactNode;
  /** Rodapé sempre visível (fora da área que pode ser cortada pelo limite de altura), por exemplo totais e ações essenciais. */
  footer?: React.ReactNode;
  /**
   * Detalhes em painel lateral (OverviewDetailDrawer): o cartão fica compacto e o botão de baixo ("Ver detalhes") abre o painel,
   * em vez de expandir o cartão. O botão só aparece quando o conteúdo passa do limite ou quando `expandable` é verdadeiro.
   */
  drawer?: { title: string; description: string; content: React.ReactNode; meta?: React.ReactNode; footer?: React.ReactNode };
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [body, setBody] = useState<HTMLDivElement | null>(null);
  const [own, setOwn] = useState(false);
  const expanded = controlled ?? own;
  const { overflowing, cut } = useOverflow(expanded || unbounded ? null : body);
  const setExpanded = (next: boolean) => {
    setOwn(next);
    onExpandedChange?.(next);
  };
  const hasExpansion = expansion !== undefined && expansion !== null;
  const card = useRef<HTMLDivElement>(null);
  const lastHeight = useRef<number | null>(null);

  // A altura do cartão é medida a cada mudança de tamanho; ao expandir ou recolher, ela anima da altura anterior até a nova.
  useLayoutEffect(() => {
    const element = card.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => {
      lastHeight.current = element.offsetHeight;
    });
    observer.observe(element);
    lastHeight.current ??= element.offsetHeight;
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const element = card.current;
    const from = lastHeight.current;
    if (!element || from === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const to = element.offsetHeight;
    if (Math.abs(from - to) < 2) {
      return;
    }
    element.style.maxHeight = "none";
    element.style.height = `${from}px`;
    element.getBoundingClientRect();
    element.style.transition = "height 300ms ease-out";
    element.style.height = `${to}px`;
    const timer = setTimeout(() => {
      element.style.transition = "";
      element.style.height = "";
      element.style.maxHeight = "";
    }, 320);
    return () => clearTimeout(timer);
  }, [expanded, hasExpansion]);

  return (
    <>
    <Card
      ref={card}
      className={`${OVERVIEW_CARD} ${expanded || unbounded ? "" : WIDGET_MAX_HEIGHT} gap-4 p-5`}
      data-expanded={expanded || undefined}
      style={extraHeight > 0 && !expanded && !unbounded ? { maxHeight: `calc(var(--widget-max) + ${extraHeight}px)` } : undefined}
    >
      <div className="-mx-5 -mt-5 flex shrink-0 items-start justify-between gap-3 rounded-t-xl border-b border-border/60 bg-muted/30 px-5 pt-5 pb-4 dark:border-border">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${SECTION_TONE[tone]}`}
            aria-hidden="true"
          >
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs leading-snug text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>
        {action}
      </div>
      <div
        ref={setBody}
        className={`relative flex min-h-0 flex-1 flex-col gap-3 ${expanded || unbounded ? "" : "overflow-hidden"}`}
        style={overflowing && cut > 0 && !expanded && !unbounded ? { clipPath: `inset(0 0 ${cut}px 0)` } : undefined}
      >
        {hasExpansion ? (
          <div key={expanded ? "expansion" : "summary"} className="motion-fade flex min-h-0 flex-1 flex-col gap-3">
            {expanded ? expansion : children}
          </div>
        ) : (
          children
        )}
      </div>
      {drawer ? (
        overflowing || expandable ? (
          <div className="shrink-0">
            <SeeMore popup onClick={() => setDrawerOpen(true)} className="mt-0">
              {moreLabel}
            </SeeMore>
          </div>
        ) : null
      ) : showToggle && (overflowing || expandable || expanded) ? (
        <div className="shrink-0">
          <SeeMore
            onClick={() => setExpanded(!expanded)}
            expanded={expanded}
            className="mt-0"
          >
            {expanded ? "Ver menos" : moreLabel}
          </SeeMore>
        </div>
      ) : null}
      {footer ? <div className="mt-auto shrink-0">{footer}</div> : null}
    </Card>
    {drawer ? (
      <OverviewDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={drawer.title}
        description={drawer.description}
        icon={Icon}
        iconClassName={SECTION_TONE[tone]}
        meta={drawer.meta}
        footer={drawer.footer}
      >
        {drawer.content}
      </OverviewDetailDrawer>
    ) : null}
    </>
  );
}

/** Cartão padrão da Visão Geral: título, subtítulo e, à direita, contador, ação ou ícone. */
export function Panel({
  title,
  subtitle,
  icon: Icon,
  count,
  countTone = "primary",
  action,
  bare = false,
  children,
}: {
  title: string;
  subtitle: string;
  icon?: typeof Flag;
  count?: number | null;
  countTone?: "primary" | "amber";
  action?: React.ReactNode;
  /** Sem moldura de cartão nem cabeçalho (o conteúdo vai dentro de outra seção); a ação fica alinhada à direita. */
  bare?: boolean;
  children: React.ReactNode;
}) {
  const embedded = useContext(EmbeddedCards);
  if (bare) {
    return (
      <div className="flex flex-col gap-3">
        {action ? (embedded?.slot ? createPortal(action, embedded.slot) : <div className="flex justify-end">{action}</div>) : null}
        {children}
      </div>
    );
  }
  return (
    <Card className={`${OVERVIEW_CARD} gap-3 p-5`}>
      <div className="-mx-5 -mt-5 flex shrink-0 items-start justify-between gap-2 rounded-t-xl border-b border-border/60 bg-muted/30 px-5 pt-5 pb-3 dark:border-border">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${SECTION_TONE.blue}`} aria-hidden="true">
              <Icon className="size-5" />
            </div>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs leading-snug text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        {action ? (
          action
        ) : count !== undefined && count !== null ? (
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${countTone === "amber" ? "bg-warning/20 text-warning-foreground" : "bg-primary/10 text-primary"}`}
          >
            {String(count).padStart(2, "0")}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </Card>
  );
}

/** Informação-chave curta (rótulo e valor) usada nos cartões e nos painéis laterais da Visão Geral. */
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div data-cut-unit className="min-w-0 rounded-md bg-muted/50 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-xs font-semibold">{value}</dd>
    </div>
  );
}
