"use client";

import { useEffect, useState } from "react";

import type { ComboOption } from "@/components/option-combobox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GetScheduleMonitoring200 } from "@/lib/api/generated/model/getScheduleMonitoring200";
import { getProjectOverview } from "@/lib/api/generated/visão-institucional/visão-institucional";

import type { EapAccess } from "./eap-access";
import type { ProjectDetail, ScheduleView } from "./eap-present";
import { AboutProject, ContextPlanning, fieldOf } from "./institutional-about";
import { EvidencesAndTickets, type EvidenceOrigins } from "./institutional-evidence";
import { buildEvolutions, EvolutionsCard } from "./institutional-evolutions";
import { ResultsCard } from "./institutional-results";
import type { Overview } from "./institutional-shared";
import { OverviewWidgets } from "./overview-widgets";
import { CardSkeleton } from "./overview-skeleton";
import { Panel } from "./overview-panel";
import { Users } from "lucide-react";
import { Participants, PendingNotice, PlanningPanel } from "./planning-overview";
import { consolidateSchedule, requiredFields, timelineMilestones } from "./planning-panel";
import { SituationCard } from "./project-situation";

type State = { status: "loading" } | { status: "ready"; data: Overview } | { status: "error" };
type Monitoring = { status: "loading" } | { status: "ready"; data: GetScheduleMonitoring200 } | { status: "error" };
type ProjectStatus = Parameters<typeof SituationCard>[0]["status"];

/**
 * Corpo da Visão Geral abaixo dos indicadores: quatro cards em duas colunas (Sobre o projeto, Resultados,
 * Principais evoluções e Situação atual), seguidos dos cards de marcos, histórico executivo e resumo, do cartão Planejamento (cronograma, contexto e participantes) e de Evidências e Chamados. Todos são widgets do quadro e podem ser reordenados. Os dados institucionais vêm de `/projects/:id/overview`, que também informa as permissões
 * de edição e validação; a API confere as duas de novo a cada gravação.
 */
export function ProjectOverviewSections({
  indicators,
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
  planning,
}: {
  /** Linha de indicadores do topo (situação, prazo, pendências e próxima entrega). */
  indicators: React.ReactNode;
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
  /** Dados do painel de Planejamento que não dependem dos dados institucionais. */
  planning: {
    schedule: ScheduleView;
    members: ProjectDetail["members"];
    access: EapAccess;
    closed: boolean;
    onScheduleSaved: () => void;
  };
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
  // Mesmos campos obrigatórios do cartão Planejamento; o aviso fica no topo da página, como na referência.
  const monitored = monitoring.status === "ready" ? monitoring.data.items : null;
  const fields = requiredFields({
    context: data
      ? {
          PROBLEM: fieldOf(data, "PROBLEM").published?.value ?? null,
          PURPOSE: fieldOf(data, "PURPOSE").published?.value ?? null,
          SCOPE: fieldOf(data, "SCOPE").published?.value ?? null,
        }
      : null,
    schedule: monitored
      ? { milestonesWithDate: timelineMilestones(monitored).length, hasCurrentEnd: consolidateSchedule(monitored).current.end !== null }
      : null,
    members: planning.members,
  });

  return (
    <>
      <PendingNotice fields={fields} />
      {indicators}
      <OverviewWidgets
        nodes={{
          sobre:
            state.status === "loading" ? (
              <CardSkeleton label="Carregando sobre o projeto" lines={5} />
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
              <CardSkeleton label="Carregando resultados" lines={5} />
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
          planejamento: (
            <PlanningPanel
              projectId={projectId}
              monitoring={monitoring}
              schedule={planning.schedule}
              members={planning.members}
              access={planning.access}
              closed={planning.closed}
              onScheduleSaved={planning.onScheduleSaved}
              context={{
                texts: data
                  ? {
                      PROBLEM: fieldOf(data, "PROBLEM").published?.value ?? null,
                      PURPOSE: fieldOf(data, "PURPOSE").published?.value ?? null,
                      SCOPE: fieldOf(data, "SCOPE").published?.value ?? null,
                    }
                  : null,
                node: data ? (
                  <ContextPlanning projectId={projectId} data={data} onChanged={reload} bare />
                ) : state.status === "loading" ? (
                  <Skeleton className="h-24 rounded-xl" aria-busy="true" aria-label="Carregando contexto e planejamento" />
                ) : (
                  <p role="alert" className="text-xs text-muted-foreground">Não foi possível carregar o contexto do projeto.</p>
                ),
              }}
            />
          ),
          equipe: (
            <Panel title="Equipe" subtitle="Responsáveis pelos compromissos do projeto" icon={Users}>
              <Participants members={planning.members} />
            </Panel>
          ),
          evidencias:
            state.status === "loading" ? (
              <CardSkeleton label="Carregando evidências e chamados" lines={3} />
            ) : data ? (
              <EvidencesAndTickets projectId={projectId} data={data} canAdd={canRegisterEvidence} origins={evidenceOrigins} onChanged={reload} />
            ) : null,
        }}
      />
    </>
  );
}
