"use client";

import type { Flag } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";

import { SeeMore } from "./institutional-shared";
import { useOverflow } from "./use-overflow";

const SECTION_TONE = {
  blue: "bg-primary/10 text-primary",
  green: "bg-success/15 text-success-foreground",
  purple: "bg-[#f4ecfb] text-[#7450bf]",
  amber: "bg-warning/20 text-warning-foreground",
} as const;

/** Acabamento dos cartões da Visão Geral (Figma): borda suave no lugar do anel e sombra em duas camadas. */
export const OVERVIEW_CARD =
  "min-h-full rounded-[10px] border border-[#E4E7EC] bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-0 dark:border-border dark:shadow-none";

/**
 * Crescimento natural com limite: o cartão tem a altura do conteúdo e para de crescer em `--widget-max` (definido por
 * widget no quadro, sem relação com a linha do grid). Passando disso o excesso fica oculto (sem rolagem interna) e o
 * cartão oferece "Ver mais", que expande o próprio cartão (o limite sai e a linha do grid cresce, sem sobrepor os
 * vizinhos); "Ver menos" volta ao limite.
 */
const WIDGET_MAX_HEIGHT = "max-h-(--widget-max)";

/** Card de seção da Visão Geral (modelo do Figma): ícone em bloco colorido, título, subtítulo e ação à direita. */
export function SectionCard({
  title,
  subtitle,
  icon: Icon,
  tone,
  action,
  moreLabel = "Ver mais",
  showToggle = true,
  unbounded = false,
  extraHeight = 0,
  expanded: controlled,
  onExpandedChange,
  expansion,
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
  children: React.ReactNode;
}) {
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
    <Card
      ref={card}
      className={`${OVERVIEW_CARD} ${expanded || unbounded ? "" : WIDGET_MAX_HEIGHT} gap-4 p-5`}
      data-expanded={expanded || undefined}
      style={extraHeight > 0 && !expanded && !unbounded ? { maxHeight: `calc(var(--widget-max) + ${extraHeight}px)` } : undefined}
    >
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#EDF0F3] pb-4 dark:border-border">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${SECTION_TONE[tone]}`}
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
      {showToggle && (overflowing || expanded) ? (
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
  children,
}: {
  title: string;
  subtitle: string;
  icon?: typeof Flag;
  count?: number | null;
  countTone?: "primary" | "amber";
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className={`${OVERVIEW_CARD} gap-3 p-5`}>
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[#EDF0F3] pb-3 dark:border-border">
        <div>
          <h2 className="text-base font-medium">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {action ? (
          action
        ) : count !== undefined && count !== null ? (
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${countTone === "amber" ? "bg-warning/20 text-warning-foreground" : "bg-primary/10 text-primary"}`}
          >
            {String(count).padStart(2, "0")}
          </span>
        ) : Icon ? (
          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
        ) : null}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </Card>
  );
}

/** Informação-chave curta (rótulo e valor) usada nos cartões e nos painéis laterais da Visão Geral. */
export function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 px-3 py-2">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="truncate text-xs font-semibold">{value}</dd>
    </div>
  );
}
