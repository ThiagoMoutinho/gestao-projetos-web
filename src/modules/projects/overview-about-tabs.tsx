"use client";

import { Info, PencilLine, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AboutDrawerContent } from "./about-drawer";
import { type AboutTab, AboutProjectDialog } from "./about-project-dialog";
import { meaningfulText } from "./field-display";
import { AboutTiles, CONTEXT_KEYS, fieldOf, LABELS } from "./institutional-about";
import { ResultsCard } from "./institutional-results";
import { ExpandableText, type Overview } from "./institutional-shared";
import { SectionCard } from "./overview-panel";

type ResultsProps = Parameters<typeof ResultsCard>[0];

/** Evento disparado por "Completar agora" (faixa de cadastro incompleto): abre o diálogo de edição na aba Contexto. */
export const COMPLETE_CONTEXT_EVENT = "overview:complete-context";

/** Quantos resultados esperados aparecem no cartão; os demais ficam na aba Resultados do diálogo. */
const EXPECTED_PREVIEW = 5;

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="text-label font-semibold tracking-[0.06em] text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  );
}

/** Abas do cartão (as mesmas do diálogo de edição). */
const TAB_LABEL: Record<AboutTab, string> = { sistema: "Sistema", contexto: "Contexto", resultados: "Resultados" };

const NOT_INFORMED = <p className="text-xs text-muted-foreground">Não informado</p>;

/**
 * "Sobre o projeto" na Visão Geral: cartão compacto, só para consulta (resumo do sistema, problema, principais resultados
 * esperados e identificação). A edição acontece no diálogo amplo (mesmo padrão do diálogo da Equipe), aberto pelo lápis do
 * cabeçalho, com as mesmas regras de salvamento, validação e permissão dos editores que ficavam no cartão.
 */
export function AboutTabsCard({ projectId, data, results, onChanged }: { projectId: string; data: Overview; results: ResultsProps; onChanged: () => void }) {
  const [dialog, setDialog] = useState<AboutTab | null>(null);
  const [tab, setTab] = useState<AboutTab>("sistema");
  // O cartão fica compacto: os textos aparecem resumidos e o texto completo abre no painel lateral de detalhes ("Ver detalhes").
  const [overflow, setOverflow] = useState<Record<string, boolean>>({});
  const reportOverflow = (key: string) => (value: boolean) => setOverflow((current) => (current[key] === value ? current : { ...current, [key]: value }));
  const textOverflows = Object.entries(overflow).some(([key, value]) => value && key.startsWith(`${tab}:`));
  const root = useRef<HTMLDivElement>(null);
  const { canEdit, canRegisterResults, canValidateResults } = data.permissions;
  const canOpenEditor = canEdit || canRegisterResults;

  useEffect(() => {
    const open = () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      root.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      setDialog("contexto");
    };
    window.addEventListener(COMPLETE_CONTEXT_EVENT, open);
    return () => window.removeEventListener(COMPLETE_CONTEXT_EVENT, open);
  }, []);

  const description = meaningfulText(fieldOf(data, "SYSTEM_DESCRIPTION").published?.value);
  const summary = meaningfulText(data.profile.resultsSummary.published?.value);
  const expected = data.results.expected
    .map((item) => item.published?.content.text?.trim())
    .filter((text): text is string => Boolean(text));
  const pending = [...data.results.expected, ...data.results.achieved].filter((item) => item.status === "PENDING_VALIDATION").length;

  return (
    <div ref={root} id="sobre-projeto" className="flex min-w-0 flex-1 scroll-mt-6 flex-col">
      <SectionCard
        title="Sobre o projeto"
        subtitle="Sistema, problema, finalidade e resultados"
        icon={Info}
        tone="blue"
        moreLabel="Ver detalhes"
        expandable={textOverflows || expected.length > EXPECTED_PREVIEW}
        drawer={{
          title: "Sobre o projeto",
          description: "Ficha institucional, sistema, contexto e resultados do projeto.",
          content: <AboutDrawerContent data={data} description={description} summary={summary} expected={expected} />,
        }}
        action={
          canOpenEditor ? (
            <Button type="button" variant="outline" size="icon" aria-label="Editar: Sobre o projeto" onClick={() => setDialog("sistema")}>
              <PencilLine aria-hidden="true" />
            </Button>
          ) : null
        }
        footer={<AboutTiles data={data} />}
      >
        <Tabs id="planejamento-contexto" value={tab} onValueChange={(value) => setTab(value as AboutTab)} className="scroll-mt-6 gap-3">
          <TabsList variant="line" className="w-full justify-start gap-4 border-b">
            {(Object.keys(TAB_LABEL) as AboutTab[]).map((value) => (
              <TabsTrigger key={value} value={value} className="flex-none px-1">
                {TAB_LABEL[value]}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="sistema" className="motion-fade flex flex-col gap-4">
            <Block label={LABELS.SYSTEM_DESCRIPTION}>{description ? <ExpandableText text={description} markdown lines={26} open={false} onOverflowChange={reportOverflow("sistema:descricao")} /> : NOT_INFORMED}</Block>
          </TabsContent>
          <TabsContent value="contexto" className="motion-fade flex flex-col gap-4">
            {CONTEXT_KEYS.map((key) => {
              const text = meaningfulText(fieldOf(data, key).published?.value);
              return (
                <Block key={key} label={LABELS[key]}>
                  {text ? <ExpandableText text={text} markdown lines={14} open={false} onOverflowChange={reportOverflow(`contexto:${key}`)} /> : NOT_INFORMED}
                </Block>
              );
            })}
          </TabsContent>
          <TabsContent value="resultados" className="motion-fade flex flex-col gap-4">
            {summary ? (
              <Block label={LABELS.RESULTS_SUMMARY}>
                <ExpandableText text={summary} markdown lines={14} open={false} onOverflowChange={reportOverflow("resultados:resumo")} />
              </Block>
            ) : null}
            <Block label="Principais resultados esperados">
              {expected.length > 0 ? (
                <ul className="flex flex-col gap-1.5">
                  {expected.slice(0, EXPECTED_PREVIEW).map((text, index) => (
                    <li key={`${index}-${text}`} className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
                      <Target aria-hidden="true" className="mt-[3px] size-3.5 shrink-0 text-status-done" />
                      <span className="line-clamp-3">{text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                NOT_INFORMED
              )}
              <div className="-mt-0.5 flex flex-wrap items-center gap-2">
                <Button type="button" variant="ghost" size="xs" className="-ml-2 text-primary" onClick={() => setDialog("resultados")}>
                  {expected.length > EXPECTED_PREVIEW ? `Ver todos os resultados (${expected.length})` : "Ver resultados"}
                </Button>
                {pending > 0 && (canValidateResults || canRegisterResults) ? (
                  <span className="rounded-md bg-warning/20 px-2 py-1 text-xs font-medium text-warning-foreground">{pending} aguardando validação</span>
                ) : null}
              </div>
            </Block>
          </TabsContent>
        </Tabs>
      </SectionCard>
      {dialog ? (
        <AboutProjectDialog
          projectId={projectId}
          data={data}
          initialTab={dialog}
          results={{
            projectId: results.projectId,
            results: results.results,
            permissions: results.permissions,
            evidences: results.evidences,
            userId: results.userId,
            milestones: results.milestones,
            onChanged: results.onChanged,
          }}
          onChanged={onChanged}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  );
}
