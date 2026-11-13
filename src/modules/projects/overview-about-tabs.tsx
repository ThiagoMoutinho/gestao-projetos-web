"use client";

import { Info, PencilLine, Target } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { type AboutTab, AboutProjectDialog } from "./about-project-dialog";
import { meaningfulText } from "./field-display";
import { AboutTiles, fieldOf } from "./institutional-about";
import { ResultsCard } from "./institutional-results";
import { ExpandableText, type Overview } from "./institutional-shared";
import { SectionCard } from "./overview-panel";

type ResultsProps = Parameters<typeof ResultsCard>[0];

/** Evento disparado por "Completar agora" (faixa de cadastro incompleto): abre o diálogo de edição na aba Contexto. */
export const COMPLETE_CONTEXT_EVENT = "overview:complete-context";

/** Quantos resultados esperados aparecem no cartão; os demais ficam na aba Resultados do diálogo. */
const EXPECTED_PREVIEW = 3;

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <p className="text-xs font-semibold text-foreground/80">{label}</p>
      {children}
    </div>
  );
}

const NOT_INFORMED = <p className="text-xs text-muted-foreground">Não informado</p>;

/**
 * "Sobre o projeto" na Visão Geral: cartão compacto, só para consulta (resumo do sistema, problema, principais resultados
 * esperados e identificação). A edição acontece no diálogo amplo (mesmo padrão do diálogo da Equipe), aberto pelo lápis do
 * cabeçalho, com as mesmas regras de salvamento, validação e permissão dos editores que ficavam no cartão.
 */
export function AboutTabsCard({ projectId, data, results, onChanged }: { projectId: string; data: Overview; results: ResultsProps; onChanged: () => void }) {
  const [dialog, setDialog] = useState<AboutTab | null>(null);
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
  const problem = meaningfulText(fieldOf(data, "PROBLEM").published?.value);
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
        unbounded
        showToggle={false}
        action={
          canOpenEditor ? (
            <Button type="button" variant="outline" size="icon" aria-label="Editar: Sobre o projeto" onClick={() => setDialog("sistema")}>
              <PencilLine aria-hidden="true" />
            </Button>
          ) : null
        }
        footer={<AboutTiles data={data} />}
      >
        <div id="planejamento-contexto" className="flex scroll-mt-6 flex-col gap-4">
          <Block label="O que o sistema faz">{description ? <ExpandableText text={description} markdown lines={4} /> : NOT_INFORMED}</Block>
          <Block label="Contexto · problema a resolver">{problem ? <ExpandableText text={problem} markdown lines={3} /> : NOT_INFORMED}</Block>
          <Block label="Principais resultados esperados">
            {expected.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {expected.slice(0, EXPECTED_PREVIEW).map((text, index) => (
                  <li key={`${index}-${text}`} className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
                    <Target aria-hidden="true" className="mt-[3px] size-3.5 shrink-0 text-status-done" />
                    <span className="line-clamp-2">{text}</span>
                  </li>
                ))}
              </ul>
            ) : summary ? (
              <ExpandableText text={summary} markdown lines={3} />
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
        </div>
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
