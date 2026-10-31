"use client";

import {
  ClipboardCheck,
  Flag,
  History,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedHeight } from "@/components/ui/animated-height";
import { Presence } from "@/components/ui/presence";
import { Skeleton } from "@/components/ui/skeleton";
import type { ListEapMilestones200DataItemType } from "@/lib/api/generated/model/listEapMilestones200DataItemType";
import type { GetScheduleMonitoring200 } from "@/lib/api/generated/model/getScheduleMonitoring200";
import { cn } from "@/lib/utils";

import type { EapAccess } from "./eap-access";
import type { HistoryEntry, HistoryTone } from "./eap-history-entries";
import {
  MilestoneHomologation,
  prefetchMilestoneHomologation,
} from "./eap-milestone-homologation";
import { ExpandableText } from "./institutional-shared";
import { civilDateInput, type ProjectDetail } from "./eap-present";
import { SectionCard } from "./overview-panel";
import { mergeAllMilestones } from "./milestone-order";
import { milestoneTypeLabel } from "./project-records";

export type MonitoringState =
  | { status: "loading" }
  | { status: "ready"; data: GetScheduleMonitoring200 }
  | { status: "error" };
export type HistoryState =
  | { status: "loading" }
  | { status: "ready"; entries: HistoryEntry[] }
  | { status: "error" };

const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function shortDate(value: string | null) {
  const input = civilDateInput(value);
  if (!input) {
    return "Sem data";
  }
  const [, month, day] = input.split("-");
  return `${day} ${MONTHS[Number(month) - 1]}`;
}

function CardMessage({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {[0, 1, 2].map((key) => (
        <Skeleton key={key} className="h-10 w-full" />
      ))}
    </div>
  );
}

type Tab = "pendentes" | "proximos" | "todos";

type Entry = {
  id: string;
  title: string;
  date: string | null;
  dateLabel: string;
  statusLabel: string;
  tone: "warning" | "danger" | "info" | "success" | "neutral";
  meta: string[];
  reason: string | null;
  canDecide: boolean;
  overdue: boolean;
  /** Tipo real do marco (ENTREGA, APROVACAO ou HOMOLOGACAO); define o ícone da linha. */
  type: string | null;
  /** Situação real do marco (PENDENTE, ENTREGUE, AJUSTES_SOLICITADOS, APROVADO ou REJEITADO). */
  status: string;
};

const TYPE_ICON: Record<string, typeof Flag> = {
  ENTREGA: PackageCheck,
  APROVACAO: ShieldCheck,
  HOMOLOGACAO: ClipboardCheck,
};

const TONE: Record<Entry["tone"], string> = {
  warning: "bg-warning/20 text-warning-foreground",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success-foreground",
  neutral: "bg-muted text-muted-foreground",
};

/** Linha de marco: ícone do tipo, nome, situação, data e ações. O detalhe (homologação) abre dentro do próprio cartão. */
function EntryRow({
  entry,
  expanded,
  onToggle,
  onOpen,
  onPrefetch,
  onDetailHeight,
  children,
}: {
  entry: Entry;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  /** Pré-carrega o detalhe ao aproximar o ponteiro, focar ou tocar, para abrir sem esperar. */
  onPrefetch: () => void;
  /** Informa a altura do detalhe aberto (0 ao fechar), para o cartão abrir espaço só para ele. */
  onDetailHeight?: (height: number) => void;
  children: React.ReactNode;
}) {
  const detail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = detail.current;
    if (!expanded || !element || !onDetailHeight) {
      return;
    }
    const observer = new ResizeObserver(() => onDetailHeight(element.offsetHeight + 12));
    observer.observe(element);
    return () => {
      observer.disconnect();
      onDetailHeight(0);
    };
  }, [expanded, onDetailHeight]);
  const prefetch = {
    onPointerEnter: onPrefetch,
    onFocus: onPrefetch,
    onPointerDown: onPrefetch,
  };
  const TypeIcon = (entry.type ? TYPE_ICON[entry.type] : null) ?? Flag;
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg",
            TONE[entry.tone],
          )}
          aria-hidden="true"
        >
          <TypeIcon className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold break-words">{entry.title}</p>
              <p
                className={cn(
                  "text-xs",
                  entry.overdue
                    ? "font-semibold text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {entry.dateLabel}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                TONE[entry.tone],
              )}
            >
              {entry.statusLabel}
            </span>
          </div>
          {entry.meta.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {entry.meta.join(" · ")}
            </p>
          ) : null}
          {entry.reason ? (
            <ExpandableText
              text={entry.reason}
              className="text-xs text-muted-foreground"
            />
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="xs"
              variant="outline"
              aria-expanded={expanded}
              onClick={onToggle}
              {...prefetch}
            >
              {expanded ? "Ocultar detalhes" : "Ver detalhes"}
            </Button>
            {entry.canDecide ? (
              <Button type="button" size="xs" onClick={onOpen} {...prefetch}>
                Analisar entrega
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      <Presence open={expanded} expansion>
        <div ref={detail} className="mt-3 rounded-lg border bg-muted/20 p-3">
          <AnimatedHeight>{children}</AnimatedHeight>
        </div>
      </Presence>
    </li>
  );
}

/** Monta as listas do cartão de marcos (todos, pendentes e próximos) a partir dos dados reais da EAP e do monitoramento. */
function useMilestoneData(monitoring: MonitoringState, project: ProjectDetail) {
  const milestones = (project.phases ?? []).flatMap(
    (phase) => phase.milestones ?? [],
  );
  const names = project.members
    ? new Map(project.members.map((member) => [member.userId, member.name]))
    : null;
  const data = monitoring.status === "ready" ? monitoring.data : null;
  const byId = new Map(
    milestones.map((milestone) => [milestone.id, milestone]),
  );

  const entregues: Entry[] = (data?.homologation.milestones ?? [])
    .filter(
      (item) =>
        item.status === "ENTREGUE" || item.status === "AJUSTES_SOLICITADOS",
    )
    .map((item) => {
      const view = byId.get(item.milestoneId);
      const corrections = item.status === "AJUSTES_SOLICITADOS";
      return {
        id: item.milestoneId,
        title: item.title,
        date: item.submittedAt,
        dateLabel: item.submittedAt
          ? `Enviada em ${shortDate(item.submittedAt)}`
          : "Sem data de envio",
        statusLabel: corrections
          ? "Correções solicitadas"
          : "Aguardando validação",
        tone: (corrections ? "danger" : "warning") as Entry["tone"],
        meta: [
          milestoneTypeLabel(item.type as ListEapMilestones200DataItemType),
          item.deliveredByName ? `Entregue por ${item.deliveredByName}` : null,
          item.reviewerName
            ? `Validador: ${item.reviewerName}`
            : "Sem validador designado",
          item.attempts > 0 ? `Tentativa ${item.attempts}` : null,
        ].filter(Boolean) as string[],
        reason: corrections ? (view?.validationNote ?? null) : null,
        canDecide: item.canDecide,
        overdue: false,
        type: item.type,
        status: item.status,
      };
    })
    .sort((left, right) => (left.date ?? "").localeCompare(right.date ?? ""));
  /** Pendentes: só as entregas aguardando análise ou homologação (as com correção solicitada aparecem em Todos). */
  const pendentes = entregues.filter((entry) => entry.status === "ENTREGUE");

  const proximos: Entry[] = (data?.items ?? [])
    .filter(
      (item) =>
        item.entityType === "MILESTONE" &&
        item.status === "PENDENTE" &&
        item.plannedEndAt,
    )
    .sort((left, right) =>
      (left.plannedEndAt as string).localeCompare(right.plannedEndAt as string),
    )
    .map((item) => ({
      id: item.entityId,
      title: item.title,
      date: item.plannedEndAt,
      dateLabel: `Previsto para ${shortDate(item.plannedEndAt)}`,
      statusLabel: item.overdue ? "Atrasado" : "Planejado",
      tone: (item.overdue ? "danger" : "neutral") as Entry["tone"],
      meta: [
        item.responsibleName ? `Responsável: ${item.responsibleName}` : null,
      ].filter(Boolean) as string[],
      reason: null,
      canDecide: false,
      overdue: item.overdue,
      type: byId.get(item.entityId)?.type ?? null,
      status: "PENDENTE",
    }));

  const historico: Entry[] = milestones
    .filter(
      (milestone) =>
        milestone.status === "APROVADO" || milestone.status === "REJEITADO",
    )
    .map((milestone) => {
      const approved = milestone.status === "APROVADO";
      return {
        id: milestone.id,
        title: milestone.title,
        date: milestone.validatedAt,
        dateLabel: milestone.validatedAt
          ? `${approved ? "Aprovado" : "Rejeitado"} em ${shortDate(milestone.validatedAt)}`
          : approved
            ? "Aprovado"
            : "Rejeitado",
        statusLabel: approved ? "Aprovado" : "Rejeitado",
        tone: approved ? "success" : "danger",
        meta: [
          milestone.validatedBy ? `Por ${milestone.validatedBy}` : null,
        ].filter(Boolean) as string[],
        reason: milestone.validationNote,
        canDecide: false,
        overdue: false,
        type: milestone.type,
        status: milestone.status,
      } satisfies Entry;
    })
    .sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""));

  /** Marcos ainda não entregues e sem data prevista: não entram em Próximos, mas existem e aparecem em Todos. */
  const semData: Entry[] = milestones
    .filter((milestone) => milestone.status === "PENDENTE")
    .map((milestone) => ({
      id: milestone.id,
      title: milestone.title,
      date: null,
      dateLabel: "Sem data prevista",
      statusLabel: "Planejado",
      tone: "neutral" as Entry["tone"],
      meta: [] as string[],
      reason: null,
      canDecide: false,
      overdue: false,
      type: milestone.type,
      status: "PENDENTE",
    }));

  /** Todos: cada marco uma só vez (sem duplicar por tentativa), com a situação visível. */
  const todos: Entry[] = mergeAllMilestones(
    entregues,
    historico,
    proximos,
    semData,
  );

  const lists: Record<Tab, Entry[]> = { pendentes, proximos, todos };
  const empty: Record<Tab, string> = {
    pendentes: "Nenhuma entrega aguardando análise ou homologação.",
    proximos: "Nenhum marco previsto que ainda não tenha sido entregue.",
    todos: "Nenhum marco cadastrado neste projeto.",
  };
  const ready = monitoring.status === "ready";
  return { lists, empty, ready, byId, names };
}

const TAB_LABELS: ReadonlyArray<readonly [Tab, string]> = [
  ["todos", "Todos"],
  ["pendentes", "Pendentes"],
  ["proximos", "Próximos"],
];

/** Linha compacta do dashboard: ícone do tipo, nome, data, situação e a ação que abre o painel com o detalhe. */
/**
 * Marcos e Homologações no dashboard: abas Todos, Pendentes e Próximos; as linhas aparecem direto (o que pede ação vem
 * primeiro) e o cartão cresce até o limite de altura. Os botões de cada linha abrem o painel lateral com o detalhe da
 * homologação e, passando do limite, "Ver todos" abre a lista completa. Sem decisões automáticas e sem dados inventados.
 */
export function MilestonesCard({
  monitoring,
  project,
  access,
  onChanged,
}: {
  monitoring: MonitoringState;
  project: ProjectDetail;
  access: EapAccess;
  onChanged: () => void;
}) {
  const data = useMilestoneData(monitoring, project);
  const { lists, empty, ready, byId } = data;
  const [tab, setTab] = useState<Tab>("todos");
  const [expanded, setExpanded] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detailHeight, setDetailHeight] = useState(0);
  const prefetch = (id: string) => {
    const milestone = byId.get(id);
    if (milestone) {
      prefetchMilestoneHomologation(project.id, milestone, true);
    }
  };

  return (
    <SectionCard
      title="Marcos e Homologações"
      subtitle="Entregas pendentes, próximas e já decididas"
      icon={Flag}
      tone="green"
      moreLabel={`Ver todos (${lists[tab].length})`}
      extraHeight={detailHeight}
      expanded={expanded}
      onExpandedChange={(next) => {
        setExpanded(next);
        if (!next) {
          setOpenId(null);
        }
      }}
    >
      {monitoring.status === "loading" ? (
        <ListSkeleton />
      ) : monitoring.status === "error" ? (
        <CardMessage>
          Não foi possível consultar os marcos do projeto.
        </CardMessage>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          className="min-h-0 flex-1"
        >
          <TabsList variant="line" className="w-full justify-start">
            {TAB_LABELS.map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-none gap-1.5 px-2 text-xs"
              >
                {label}
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {String(lists[value].length).padStart(2, "0")}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
          {TAB_LABELS.map(([key]) => {
            const list = lists[key];
            return (
              <TabsContent key={key} value={key} className="mt-3">
                {list.length === 0 ? (
                  <CardMessage>{ready ? empty[key] : ""}</CardMessage>
                ) : (
                  <ul className="flex flex-col divide-y">
                    {list.map((entry) => {
                      const milestone = byId.get(entry.id);
                      return (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          expanded={openId === entry.id}
                          onToggle={() =>
                            setOpenId(openId === entry.id ? null : entry.id)
                          }
                          onOpen={() => setOpenId(entry.id)}
                          onPrefetch={() => prefetch(entry.id)}
                          onDetailHeight={setDetailHeight}
                        >
                          {milestone ? (
                            <MilestoneHomologation
                              projectId={project.id}
                              milestone={milestone}
                              access={access}
                              names={data.names}
                              showEvidence
                              onMilestone={() => undefined}
                              onChanged={onChanged}
                            />
                          ) : null}
                        </EntryRow>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </SectionCard>
  );
}

const HISTORY_DOT: Record<HistoryTone, string> = {
  accept: "bg-success",
  reject: "bg-destructive",
  adjustments: "bg-warning",
  impediment: "bg-warning",
  cancel: "bg-muted-foreground",
  automatic: "bg-muted-foreground",
  reactivate: "bg-primary",
  progress: "bg-primary",
  delivery: "bg-primary",
  evidence: "bg-primary",
  reschedule: "bg-primary",
  dates: "bg-primary",
  neutral: "bg-primary",
};

/** Linha do tempo discreta de eventos reais do projeto; `clamp` limita a descrição na prévia (o painel mostra tudo). */
function HistoryTimeline({
  entries,
  clamp,
}: {
  entries: HistoryEntry[];
  clamp: boolean;
}) {
  return (
    <ul className="flex flex-col">
      {entries.map((entry) => {
        const description = entry.notes[0]?.text ?? entry.cause;
        return (
          <li
            key={entry.id}
            className="relative pb-4 pl-6 last:pb-0 before:absolute before:top-3 before:bottom-0 before:left-[4px] before:w-px before:bg-border last:before:hidden"
          >
            <span
              className={cn(
                "absolute top-1 left-0 size-2.5 rounded-full ring-4 ring-card",
                HISTORY_DOT[entry.tone],
              )}
              aria-hidden="true"
            />
            <p className="text-xs font-semibold break-words">{entry.title}</p>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">{entry.kindLabel}</span> ·{" "}
              {entry.actor} · {entry.createdAt}
            </p>
            {description ? (
              <p
                className={cn(
                  "mt-0.5 text-xs break-words whitespace-pre-wrap text-muted-foreground/90",
                  clamp && "line-clamp-2",
                )}
              >
                {description}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Histórico executivo recente: eventos da auditoria do projeto direto no cartão (até o limite de altura); "Ver todos" abre o histórico completo. */
export function ExecutiveHistoryCard({ history }: { history: HistoryState }) {
  const entries = history.status === "ready" ? history.entries : [];
  return (
    <SectionCard
      title="Histórico executivo recente"
      subtitle="Últimas decisões e atualizações relevantes"
      icon={History}
      tone="purple"
      moreLabel={`Ver todos (${entries.length})`}
    >
      {history.status === "loading" ? (
        <ListSkeleton />
      ) : history.status === "error" ? (
        <CardMessage>Não foi possível consultar o histórico.</CardMessage>
      ) : entries.length === 0 ? (
        <CardMessage>Nenhum evento registrado.</CardMessage>
      ) : (
        <HistoryTimeline entries={entries} clamp={false} />
      )}
    </SectionCard>
  );
}
