"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import type { ComboOption } from "@/components/option-combobox";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import type { GetScheduleMonitoring200 } from "@/lib/api/generated/model/getScheduleMonitoring200";
import { getProjectOverview } from "@/lib/api/generated/visão-institucional/visão-institucional";

import { AboutProject, ContextPlanning } from "./institutional-about";
import { EvidencesAndTickets, type EvidenceOrigins } from "./institutional-evidence";
import { buildEvolutions, EvolutionsCard } from "./institutional-evolutions";
import { ResultsCard } from "./institutional-results";
import type { Overview } from "./institutional-shared";
import { OverviewWidgets } from "./overview-widgets";
import { Panel } from "./overview-panel";
import { SituationCard } from "./project-situation";

type State = { status: "loading" } | { status: "ready"; data: Overview } | { status: "error" };
type Monitoring = { status: "loading" } | { status: "ready"; data: GetScheduleMonitoring200 } | { status: "error" };
type ProjectStatus = Parameters<typeof SituationCard>[0]["status"];

/**
 * Corpo da Visão Geral abaixo dos indicadores: quatro cards em duas colunas (Sobre o projeto, Resultados,
 * Principais evoluções e Situação atual) e uma seção secundária recolhível com evidências, chamados GLPI e
 * os demais painéis. Os dados institucionais vêm de `/projects/:id/overview`, que também informa as permissões
 * de edição e validação; a API confere as duas de novo a cada gravação.
 */
export function ProjectOverviewSections({
  projectId,
  userId,
  canRegisterEvidence,
  evidenceOrigins,
  milestones,
  status,
  monitoring,
  impediments,
  onOpenEap,
  cards,
}: {
  projectId: string;
  userId: string;
  /** Mesma regra da EAP (espelho da API): inclui fornecedor e colaborador vinculados e autorizados. */
  canRegisterEvidence: boolean;
  /** Nome do item da EAP (fase, tarefa ou marco) de cada evidência, para mostrar o vínculo. */
  evidenceOrigins: EvidenceOrigins;
  milestones: ComboOption[];
  status: ProjectStatus;
  monitoring: Monitoring;
  impediments: number;
  onOpenEap: () => void;
  /** Demais cards da Visão Geral: marcos e homologações, histórico executivo e resumo. */
  cards: { marcos: React.ReactNode; historico: React.ReactNode; resumo: React.ReactNode };
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    getProjectOverview(projectId)
      .then((response) => {
        if (active) {
          setState(response.status === 200 ? { status: "ready", data: response.data } : { status: "error" });
        }
      })
      .catch(() => active && setState({ status: "error" }));
    return () => {
      active = false;
    };
  }, [projectId, version]);

  const reload = () => setVersion((current) => current + 1);
  const data = state.status === "ready" ? state.data : null;
  const evolutions = buildEvolutions(data ? data.evolutions : null, []);

  return (
    <>
      <OverviewWidgets
        nodes={{
          sobre:
            state.status === "loading" ? (
              <Skeleton className="h-64 rounded-xl" aria-busy="true" aria-label="Carregando sobre o projeto" />
            ) : data ? (
              <AboutProject projectId={projectId} data={data} onChanged={reload} />
            ) : (
            <Panel title="Informações institucionais" subtitle="Sobre o projeto e resultados para o IGEPPS">
              <div role="alert" className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Não foi possível carregar as informações institucionais.</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setState({ status: "loading" });
                    reload();
                  }}
                >
                  Tentar novamente
                </Button>
              </div>
            </Panel>
            ),
          resultados:
            state.status === "loading" ? (
              <Skeleton className="h-64 rounded-xl" aria-busy="true" aria-label="Carregando resultados" />
            ) : data ? (
              <ResultsCard
              projectId={projectId}
              summary={data.profile.resultsSummary}
              canEditSummary={data.permissions.canEdit}
              results={data.results}
              permissions={data.permissions}
              evidences={data.evidences}
              userId={userId}
              milestones={milestones}
              onChanged={reload}
            />
            ) : null,
          evolucoes: (
            <EvolutionsCard
              projectId={projectId}
              items={evolutions}
              canEdit={data?.permissions.canEdit ?? false}
              loading={state.status === "loading"}
              failed={state.status === "error"}
              onChanged={reload}
            />
          ),
          situacao: <SituationCard status={status} monitoring={monitoring} impediments={impediments} onOpenEap={onOpenEap} />,
          marcos: cards.marcos,
          historico: cards.historico,
          resumo: cards.resumo,
        }}
      />

      <Collapsible>
        <CollapsibleTrigger
          render={
            <Button type="button" variant="outline" size="sm" className="group/more gap-1.5">
              Mais informações do projeto
              <ChevronDown className="size-3.5 transition-transform group-data-panel-open/more:rotate-180" aria-hidden="true" />
            </Button>
          }
        />
        <CollapsibleContent>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {data ? (
              <div className="lg:col-span-2">
                <ContextPlanning projectId={projectId} data={data} onChanged={reload} />
              </div>
            ) : null}
            {data ? <EvidencesAndTickets projectId={projectId} data={data} canAdd={canRegisterEvidence} origins={evidenceOrigins} onChanged={reload} /> : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
