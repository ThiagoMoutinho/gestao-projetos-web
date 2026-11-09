"use client";

import { Info } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AboutProject, ContextPlanning } from "./institutional-about";
import { ResultsCard } from "./institutional-results";
import type { Overview } from "./institutional-shared";
import { EmbeddedCards, SectionCard } from "./overview-panel";

type ResultsProps = Parameters<typeof ResultsCard>[0];

type Tab = "sistema" | "contexto" | "resultados";

/** Evento disparado por "Completar agora" (faixa de cadastro incompleto): abre a aba Contexto e leva a pessoa até ela. */
export const COMPLETE_CONTEXT_EVENT = "overview:complete-context";

/**
 * "Sobre o projeto": um único cartão com as abas Sistema, Contexto e Resultados (como na referência). Cada aba reaproveita o
 * componente que já existia (Sobre o Sistema, Contexto e planejamento, Resultados), com as mesmas regras de edição,
 * validação e permissão; os cartões internos aparecem sem moldura própria para não virar cartão dentro de cartão.
 */
export function AboutTabsCard({ projectId, data, results, onChanged }: { projectId: string; data: Overview; results: ResultsProps; onChanged: () => void }) {
  const [tab, setTab] = useState<Tab>("sistema");
  // Ação de cada aba (lápis de editar) aparece no cabeçalho do cartão, ao lado do título, como na referência.
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const embedded = useMemo(() => ({ slot }), [slot]);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const open = () => {
      setTab("contexto");
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      root.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    };
    window.addEventListener(COMPLETE_CONTEXT_EVENT, open);
    return () => window.removeEventListener(COMPLETE_CONTEXT_EVENT, open);
  }, []);

  return (
    <div ref={root} id="sobre-projeto" className="flex min-w-0 flex-1 scroll-mt-6 flex-col">
      <SectionCard title="Sobre o projeto" subtitle="Sistema, problema, finalidade e resultados" icon={Info} tone="blue" unbounded showToggle={false} action={<div ref={setSlot} className="flex items-center gap-2" />}>
        <EmbeddedCards.Provider value={embedded}>
          <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
            <TabsList variant="line" className="w-full justify-start">
              {(
                [
                  ["sistema", "Sistema"],
                  ["contexto", "Contexto"],
                  ["resultados", "Resultados"],
                ] as const
              ).map(([value, label]) => (
                <TabsTrigger key={value} value={value} className="flex-none px-2 text-xs">
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="sistema" className="mt-3">
              <AboutProject projectId={projectId} data={data} onChanged={onChanged} />
            </TabsContent>
            <TabsContent value="contexto" className="mt-3">
              <div id="planejamento-contexto" className="scroll-mt-6">
                <ContextPlanning projectId={projectId} data={data} onChanged={onChanged} bare />
              </div>
            </TabsContent>
            <TabsContent value="resultados" className="mt-3">
              <ResultsCard {...results} />
            </TabsContent>
          </Tabs>
        </EmbeddedCards.Provider>
      </SectionCard>
    </div>
  );
}
