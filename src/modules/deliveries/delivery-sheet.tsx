"use client";

import { CircleCheck, ExternalLink, History, Info, ListChecks, PackageCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { listDeliveryItemEvents } from "@/lib/api/generated/conformidade-de-entrega/conformidade-de-entrega";
import type { ListDeliveryItemEvents200DataItem } from "@/lib/api/generated/model/listDeliveryItemEvents200DataItem";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/modules/auth/roles";
import {
  conformityPercent,
  describeHistory,
  evidenceDisplay,
  ITEM_STATUS,
  NATURE_LABEL,
  type EvidenceKind,
  type Tone,
} from "@/modules/projects/delivery-compliance";
import { personName, stamp } from "@/modules/projects/institutional-shared";
import { DrawerCard, DrawerCount, DrawerEmpty, DrawerNav, OverviewDetailDrawer } from "@/modules/projects/overview-detail-drawer";
import { projectRoleLabel } from "@/modules/projects/project-records";

import { DELIVERY_STATUS, deliveryTitle } from "./deliveries-portfolio";
import type { DeliveryRecord } from "./load-deliveries";

type Tab = "geral" | "checklist" | "historico";

/** Cores de situação (tokens de status do sistema): mesmas famílias usadas nos cartões e na Conformidade de Entrega. */
export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-status-done-soft text-status-done-ink",
  warning: "bg-status-attention-soft text-status-attention-ink",
  danger: "bg-status-critical-soft text-status-critical-ink",
  info: "bg-primary/10 text-primary",
};

const DOT: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-status-done",
  warning: "bg-status-attention",
  danger: "bg-status-critical",
  info: "bg-primary",
};

export function ToneBadge({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-label font-medium whitespace-nowrap", TONE_CLASS[tone])}>
      {children}
    </span>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-x-6 max-sm:flex-col max-sm:items-start max-sm:gap-0.5">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm font-semibold break-words text-foreground sm:text-right">{children}</dd>
    </div>
  );
}

/**
 * Painel lateral de uma entrega (o mesmo Sheet dos painéis da Visão Geral): Visão geral, Checklist e Histórico, com cabeçalho e
 * rodapé fixos e o conteúdo central rolável. Nesta etapa é só de consulta: aprovar, rejeitar e dispensar documentos continuam no
 * cartão Conformidade de Entrega do projeto (o rodapé leva até ele), onde as permissões e regras já existem.
 */
export function DeliverySheet({ record, open, onOpenChange }: { record: DeliveryRecord | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!record) return null;
  const status = DELIVERY_STATUS[record.status];
  return (
    <OverviewDetailDrawer
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Detalhes da entrega"
      title={deliveryTitle(record)}
      description={`${record.projectName}${record.suppliers.length > 0 ? ` · ${record.suppliers.join(", ")}` : ""}`}
      icon={PackageCheck}
      iconClassName="bg-primary/12 text-primary ring-primary/25"
      meta={
        <>
          <ToneBadge tone={status.tone} title={status.hint}>
            {status.label}
          </ToneBadge>
          <span className="rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-label font-medium text-muted-foreground dark:border-border">{NATURE_LABEL[record.nature]}</span>
        </>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Link href={`/projetos/${record.projectId}`} className={buttonVariants({ variant: "default" })}>
            Abrir no projeto <ExternalLink aria-hidden="true" />
          </Link>
        </div>
      }
    >
      <SheetBody key={record.id} record={record} />
    </OverviewDetailDrawer>
  );
}

function SheetBody({ record }: { record: DeliveryRecord }) {
  const [tab, setTab] = useState<Tab>("geral");
  const { version } = record;
  return (
    <div className="flex flex-col gap-4">
      <DrawerNav
        label="Partes da entrega"
        active={tab}
        onSelect={(id) => setTab(id as Tab)}
        items={[
          { id: "geral", label: "Visão geral", icon: Info },
          { id: "checklist", label: "Checklist", icon: ListChecks, count: version.items.length },
          { id: "historico", label: "Histórico", icon: History },
        ]}
      />
      <div key={tab} role="group" aria-label={tab === "geral" ? "Visão geral" : tab === "checklist" ? "Checklist" : "Histórico"} className="motion-fade flex flex-col gap-4">
        {tab === "geral" ? <Overview record={record} /> : null}
        {tab === "checklist" ? <Checklist record={record} /> : null}
        {tab === "historico" ? <HistoryTab record={record} /> : null}
      </div>
    </div>
  );
}

function Overview({ record }: { record: DeliveryRecord }) {
  const { version } = record;
  const c = version.conformity;
  const percent = conformityPercent(c);
  const counts: Array<{ label: string; value: number; tone: Tone }> = [
    { label: "Aprovados", value: c.approved, tone: "success" },
    { label: "Dispensados", value: c.dispensed, tone: "info" },
    { label: "Em validação", value: c.awaitingValidation, tone: "warning" },
    { label: "Pendentes", value: c.pending, tone: "neutral" },
    { label: "Rejeitados", value: c.rejected, tone: "danger" },
  ];
  return (
    <>
      <DrawerCard icon={Info} title="Informações da entrega">
        <dl className="flex flex-col gap-3">
          <Row label="Projeto">{record.projectName}</Row>
          <Row label="Fornecedor">{record.suppliers.length > 0 ? record.suppliers.join(", ") : <span className="font-normal text-muted-foreground">Não informado</span>}</Row>
          <Row label="Natureza">{NATURE_LABEL[record.nature]}</Row>
          <Row label="Versão">{version.versionLabel}</Row>
          <Row label="Modelo de checklist">
            Revisão {version.templateRevision}
            {version.templateIsProposal ? <span className="font-normal text-muted-foreground"> · proposta</span> : null}
          </Row>
          <Row label="Registrada em">{stamp(version.createdAt)}</Row>
          <Row label="Registrada por">
            <span className="inline-flex items-center gap-1.5">
              <UserRound className="size-3.5 text-muted-foreground" aria-hidden="true" />
              {personName(version.createdBy)}
            </span>
          </Row>
          <Row label="Rodadas de avaliação">{version.rounds}</Row>
          {version.notes ? <Row label="Observações">{version.notes}</Row> : null}
        </dl>
      </DrawerCard>

      <DrawerCard icon={CircleCheck} title="Andamento da conformidade" aside={<ToneBadge tone={DELIVERY_STATUS[record.status].tone}>{DELIVERY_STATUS[record.status].label}</ToneBadge>}>
        <div className="mb-2.5 flex items-end justify-between gap-3">
          <p className="text-3xl leading-none font-semibold tracking-tight">{percent}%</p>
          <p className="text-xs text-muted-foreground">
            {c.required - c.blockingItems.length} de {c.required} obrigatórios atendidos
          </p>
        </div>
        <Progress value={percent} aria-label="Documentos obrigatórios atendidos" className="**:data-[slot=progress-track]:h-2" />
        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5" aria-label="Documentos por situação">
          {counts.map((entry) => (
            <li key={entry.label} className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/40 px-2 py-2.5 text-center dark:bg-muted/25">
              <span className="text-xl leading-none font-semibold">{entry.value}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">{entry.label}</span>
            </li>
          ))}
        </ul>
        {c.blockingItems.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-label font-semibold tracking-[0.06em] text-muted-foreground uppercase">O que falta para a conformidade</p>
            <ul className="flex flex-col gap-2">
              {c.blockingItems.map((entry) => {
                const info = ITEM_STATUS[entry.status];
                return (
                  <li key={entry.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 text-sm break-words text-foreground">{entry.title}</span>
                    <ToneBadge tone={info.tone}>{info.label}</ToneBadge>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </DrawerCard>
    </>
  );
}

function Checklist({ record }: { record: DeliveryRecord }) {
  const items = record.version.items;
  return (
    <DrawerCard icon={ListChecks} title="Documentos exigidos" aside={<DrawerCount value={items.length} />}>
      {items.length === 0 ? (
        <DrawerEmpty>Esta entrega não tem documentos no checklist.</DrawerEmpty>
      ) : (
        <ul className="flex flex-col gap-5">
          {items.map((item) => {
            const info = ITEM_STATUS[item.status];
            const evidence = evidenceDisplay(item.evidenceKind as EvidenceKind | null, item.evidenceRef);
            return (
              <li key={item.id} className="flex min-w-0 flex-col gap-1.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm leading-snug font-semibold break-words text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.required ? "Obrigatório" : "Opcional"}
                    </p>
                  </div>
                  <ToneBadge tone={info.tone} title={info.hint}>
                    {info.label}
                  </ToneBadge>
                </div>
                {evidence ? (
                  <p className="text-xs break-all text-muted-foreground">
                    {evidence.kindLabel}:{" "}
                    {evidence.href ? (
                      <a href={evidence.href} target="_blank" rel="noreferrer noopener" className="text-primary underline-offset-2 hover:underline">
                        {evidence.text}
                      </a>
                    ) : (
                      evidence.text
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Nenhuma evidência enviada.</p>
                )}
                {item.submittedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Enviado por {personName(item.submittedBy)} em {stamp(item.submittedAt)}
                  </p>
                ) : null}
                {item.decidedAt ? (
                  <p className="text-xs text-muted-foreground">
                    {info.label} por {personName(item.decidedBy)} em {stamp(item.decidedAt)}
                  </p>
                ) : null}
                {item.decisionNote ? <blockquote className="rounded-md border-l-2 border-border bg-muted/50 px-2.5 py-1.5 text-xs text-foreground">{item.decisionNote}</blockquote> : null}
              </li>
            );
          })}
        </ul>
      )}
    </DrawerCard>
  );
}

type HistoryEvent = ListDeliveryItemEvents200DataItem & { itemTitle: string; label: string; tone: Tone };
type HistoryState = { status: "loading" } | { status: "ready"; events: HistoryEvent[] } | { status: "error" };

function HistoryTab({ record }: { record: DeliveryRecord }) {
  const [state, setState] = useState<HistoryState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const { version, projectId } = record;

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- nova consulta a cada abertura da aba
    setState({ status: "loading" });
    Promise.all(
      version.items.map(async (item) => {
        const response = await listDeliveryItemEvents(projectId, version.id, item.id);
        if (response.status !== 200) throw new Error("events");
        const labels = describeHistory(response.data.data);
        return response.data.data.map((event, index): HistoryEvent => ({ ...event, itemTitle: item.title, label: labels[index].label, tone: labels[index].tone }));
      }),
    )
      .then((lists) => {
        if (active) setState({ status: "ready", events: lists.flat().sort((left, right) => right.createdAt.localeCompare(left.createdAt)) });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, [version, projectId, attempt]);

  const events = useMemo(() => (state.status === "ready" ? state.events : []), [state]);

  return (
    <DrawerCard icon={History} title="Histórico da entrega" aside={state.status === "ready" ? <DrawerCount value={events.length} /> : null}>
      {state.status === "loading" ? (
        <div className="flex flex-col gap-3" role="status" aria-label="Carregando histórico">
          <Skeleton className="h-14 rounded-lg motion-reduce:animate-none" />
          <Skeleton className="h-14 rounded-lg motion-reduce:animate-none" />
          <Skeleton className="h-14 rounded-lg motion-reduce:animate-none" />
        </div>
      ) : state.status === "error" ? (
        <div role="alert" className="flex flex-col items-start gap-2 rounded-lg border border-status-critical/25 bg-status-critical-soft px-3 py-3">
          <p className="text-sm font-medium text-foreground">Não foi possível carregar o histórico.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>
            Tentar novamente
          </Button>
        </div>
      ) : events.length === 0 ? (
        <DrawerEmpty>Nenhum registro ainda: o histórico começa no primeiro envio de documento.</DrawerEmpty>
      ) : (
        <ol className="relative flex flex-col gap-5 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-border">
          {events.map((event) => {
            const roles = [...new Set([...(event.actorRole ? [roleLabel(event.actorRole)] : []), ...event.actorProjectRoles.map((role) => projectRoleLabel(role as never) ?? role)])].join(" · ");
            return (
              <li key={event.id} className="relative flex gap-3">
                <span className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-card", DOT[event.tone])} aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className="text-sm font-semibold text-foreground">{event.label}</span>
                    <time dateTime={event.createdAt} className="text-xs text-muted-foreground tabular-nums">
                      {stamp(event.createdAt)}
                    </time>
                  </div>
                  <p className="text-xs text-foreground/80">{event.itemTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {personName(event.actor)}
                    {roles ? ` · ${roles}` : ""}
                  </p>
                  {event.note ? <blockquote className="mt-1 rounded-md border-l-2 border-border bg-muted/50 px-2.5 py-1.5 text-xs text-foreground">{event.note}</blockquote> : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </DrawerCard>
  );
}
