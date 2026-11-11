"use client";

import { CalendarRange, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

import { SectionCard } from "./overview-panel";

/**
 * Cartão Planejamento: organização, cronograma, escopo e responsáveis do projeto. Reúne três seções recolhíveis
 * (cronograma e reprogramações, contexto e planejamento, participantes); cada seção traz o próprio resumo no cabeçalho
 * e controla a sua expansão, então o cartão não tem limite de altura nem "Ver mais".
 */
export function PlanningCard({ children }: { children: React.ReactNode }) {
  // Widget do quadro, como os demais: o cartão estica até o fim da linha do grid (min-h-full), sem limite de altura próprio.
  return (
    <SectionCard
      title="Planejamento"
      subtitle="Cronograma, escopo e responsáveis: o que foi planejado e os compromissos assumidos."
      icon={CalendarRange}
      tone="purple"
      unbounded
      showToggle={false}
    >
      <div className="flex flex-col divide-y divide-border/60 dark:divide-border">{children}</div>
    </SectionCard>
  );
}

/** Espera da transição de abertura (300 ms em CollapsibleContent) antes de rolar até a seção. */
const OPEN_TRANSITION_MS = 350;

/**
 * Seção recolhível do cartão Planejamento: título e resumo sempre visíveis; o conteúdo abre com transição suave.
 * Quando a URL aponta para a seção (`#id`), ela abre sozinha e a página rola até ela só depois da expansão, na carga
 * da página e também em mudanças posteriores do endereço. O foco vai para o cabeçalho, para o teclado continuar dali.
 */
export function PlanningSection({
  id,
  title,
  summary,
  badge,
  defaultOpen = false,
  children,
}: {
  id?: string;
  title: string;
  /** Linha curta com os dados-chave, visível com a seção recolhida. */
  summary?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    const timers: number[] = [];
    let touched = false;
    const markTouched = () => {
      touched = true;
    };
    const reveal = () => {
      if (window.location.hash !== `#${id}`) {
        return;
      }
      setOpen(true);
      touched = false;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const scroll = (smooth: boolean) => root.current?.scrollIntoView({ behavior: smooth && !reduced ? "smooth" : "auto", block: "start" });
      // Primeiro depois da expansão; uma segunda vez, se o resto da página ainda mexeu no layout e a pessoa não rolou.
      timers.push(
        window.setTimeout(() => {
          scroll(true);
          trigger.current?.focus({ preventScroll: true });
        }, OPEN_TRANSITION_MS),
        window.setTimeout(() => {
          if (!touched) {
            scroll(false);
          }
        }, 1400),
      );
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    window.addEventListener("popstate", reveal);
    window.addEventListener("wheel", markTouched, { passive: true });
    window.addEventListener("touchmove", markTouched, { passive: true });
    window.addEventListener("keydown", markTouched);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("hashchange", reveal);
      window.removeEventListener("popstate", reveal);
      window.removeEventListener("wheel", markTouched);
      window.removeEventListener("touchmove", markTouched);
      window.removeEventListener("keydown", markTouched);
    };
  }, [id]);

  return (
    <Collapsible open={open} onOpenChange={setOpen} id={id} ref={root} className="scroll-mt-6 py-1 first:pt-0 last:pb-0">
      <CollapsibleTrigger
        ref={trigger}
        className="group/section flex w-full items-center gap-3 rounded-md px-1 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{title}</span>
            {badge}
          </span>
          {summary ? <span className="text-xs text-muted-foreground">{summary}</span> : null}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-panel-open/section:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 px-1 pt-1 pb-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
