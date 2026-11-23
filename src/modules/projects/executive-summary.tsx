"use client";

import {
  BadgeCheck,
  Ban,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  CircleX,
  Clock,
  FilePenLine,
  FileText,
  Gauge,
  History as HistoryIcon,
  Layers,
  LayoutDashboard,
  OctagonAlert,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
  Undo2,
  UserRound,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";
import { Presence } from "@/components/ui/presence";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getExecutiveSummary,
  getExecutiveSummaryValidation,
  listExecutiveSummaryValidations,
  validateExecutiveSummary,
} from "@/lib/api/generated/cronograma/cronograma";
import type { GetExecutiveSummary200 } from "@/lib/api/generated/model/getExecutiveSummary200";
import type { GetExecutiveSummaryValidation200 } from "@/lib/api/generated/model/getExecutiveSummaryValidation200";
import { cn } from "@/lib/utils";

import { useAction } from "./institutional-shared";
import { civilDay } from "./eap-deadline";
import { DrawerCard, DrawerCount, DrawerEmpty, DrawerNav, DrawerSectionHead } from "./overview-detail-drawer";
import { Fact, SectionCard } from "./overview-panel";
import { nextVisibleCount, TIMELINE_PAGE, visibleCount } from "./progressive-list";
import { projectStatusLabel } from "./project-status";

/** Indicadores automáticos (o resumo ao vivo e o snapshot de uma validação têm os mesmos campos). */
type Indicators = Omit<GetExecutiveSummary200, "governance">;
type Governance = GetExecutiveSummary200["governance"];
type ValidationItem = NonNullable<Governance["lastValidation"]>;
type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: GetExecutiveSummary200 };

const DOT: Record<Indicators["situation"]["status"], string> = {
  NAO_INICIADO: "bg-muted-foreground",
  EM_EXECUCAO: "bg-primary",
  EM_ATENCAO: "bg-warning",
  CRITICO: "bg-destructive",
  EM_VALIDACAO: "bg-primary",
  CONCLUIDO: "bg-success",
  SUSPENSO: "bg-muted-foreground",
};

const zone = { timeZone: "America/Belem" } as const;
const REFERENCE = new Intl.DateTimeFormat("pt-BR", { ...zone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const CIVIL_DAY = new Intl.DateTimeFormat("pt-BR", { ...zone, day: "2-digit", month: "2-digit", year: "numeric" });
const HOUR = new Intl.DateTimeFormat("pt-BR", { ...zone, hour: "2-digit", minute: "2-digit" });
const LONG_DAY = new Intl.DateTimeFormat("pt-BR", { ...zone, day: "numeric", month: "long", year: "numeric" });
const MOMENT = new Intl.DateTimeFormat("pt-BR", { ...zone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Datas civis do ciclo (AAAA-MM-DD) em dd/mm, sem converter fuso. */
function cycleDay(day: string) {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

function percent(basisPoints: number | null) {
  return basisPoints === null ? "Indisponível" : `${(Math.round(basisPoints / 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

const METRIC_TONE = {
  blue: "bg-primary/10 text-primary",
  red: "bg-status-critical-soft text-status-critical-ink",
} as const;

/** Indicador do cartão: ícone em bloco colorido, número em destaque e rótulo. */
function Metric({ icon: Icon, tone, label, value }: { icon: typeof Layers; tone: keyof typeof METRIC_TONE; label: string; value: string }) {
  return (
    <div data-cut-unit className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/60 bg-card px-3 py-2.5 dark:border-border">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", METRIC_TONE[tone])} aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-base leading-none font-semibold">{value}</p>
        <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold text-foreground/80">{title}</h3>
      {children}
    </section>
  );
}

/** Próximas entregas (lista); `comfortable` é a versão do painel de detalhes, em linhas maiores. */
function DeliveriesList({ data, comfortable = false }: { data: Indicators; comfortable?: boolean }) {
  if (data.nextDeliveries.length === 0) {
    return comfortable ? <DrawerEmpty>Nenhuma entrega futura prevista.</DrawerEmpty> : <p className="text-xs text-muted-foreground">Nenhuma entrega futura prevista.</p>;
  }
  return (
    <ul className={cn("flex flex-col", comfortable ? "gap-2" : "gap-1")}>
      {data.nextDeliveries.map((delivery) => (
        <li key={delivery.id} className={cn("flex items-baseline justify-between gap-3", comfortable ? "rounded-xl bg-muted/50 px-3.5 py-2.5 text-[13px] dark:bg-muted/30" : "text-xs")}>
          <span className="min-w-0 truncate" title={delivery.title}>
            {delivery.title}
            {delivery.phaseName ? <span className="text-muted-foreground"> · {delivery.phaseName}</span> : null}
          </span>
          <span className={cn("shrink-0 font-medium", delivery.overdue ? "text-destructive" : "text-muted-foreground")}>
            {CIVIL_DAY.format(new Date(delivery.plannedAt))}
            {delivery.overdue ? " · vencido" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

type Movement = Indicators["movements"][number];

/** Ícone, título e tom de cada tipo de movimentação (tokens de status do sistema; o texto do evento continua o da API). */
const MOVEMENT_VISUAL: Record<string, { icon: LucideIcon; title: string; tone: string }> = {
  CANCELLATION: { icon: CircleX, title: "Item cancelado", tone: "bg-status-critical-soft text-status-critical-ink ring-status-critical/25" },
  REACTIVATION: { icon: RefreshCw, title: "Item reativado", tone: "bg-status-done-soft text-status-done-ink ring-status-done/25" },
  STATUS: { icon: TrendingUp, title: "Andamento alterado", tone: "bg-status-attention-soft text-status-attention-ink ring-status-attention/25" },
  COMPLETION: { icon: CircleCheck, title: "Item concluído", tone: "bg-status-done-soft text-status-done-ink ring-status-done/25" },
  REOPENING: { icon: Undo2, title: "Item reaberto", tone: "bg-status-attention-soft text-status-attention-ink ring-status-attention/25" },
  IMPEDIMENT_OPENED: { icon: OctagonAlert, title: "Impedimento registrado", tone: "bg-status-critical-soft text-status-critical-ink ring-status-critical/25" },
  IMPEDIMENT_RESOLVED: { icon: ShieldCheck, title: "Impedimento resolvido", tone: "bg-status-done-soft text-status-done-ink ring-status-done/25" },
  DELIVERY: { icon: PackageCheck, title: "Entrega registrada", tone: "bg-primary/10 text-primary ring-primary/25" },
  ACCEPTANCE: { icon: BadgeCheck, title: "Entrega aceita", tone: "bg-status-done-soft text-status-done-ink ring-status-done/25" },
  ADJUSTMENTS_REQUESTED: { icon: FilePenLine, title: "Ajustes solicitados", tone: "bg-status-attention-soft text-status-attention-ink ring-status-attention/25" },
  REJECTION: { icon: Ban, title: "Entrega rejeitada", tone: "bg-status-critical-soft text-status-critical-ink ring-status-critical/25" },
  RESCHEDULE: { icon: CalendarClock, title: "Reprogramação", tone: "bg-status-validation-soft text-status-validation-ink ring-status-validation/25" },
  PLANNING_DEFINED: { icon: CalendarClock, title: "Planejamento atualizado", tone: "bg-status-validation-soft text-status-validation-ink ring-status-validation/25" },
  OWNER_TRANSFERRED: { icon: UserRoundCog, title: "Titularidade transferida", tone: "bg-primary/10 text-primary ring-primary/25" },
};
const MOVEMENT_FALLBACK = { icon: HistoryIcon, title: "Movimentação", tone: "bg-muted text-muted-foreground ring-border" };

/** Agrupa por dia civil (as movimentações já vêm do mais recente ao mais antigo). */
function groupMovementsByDay(movements: ReadonlyArray<Movement>) {
  const groups: Array<{ key: string; label: string; items: Movement[] }> = [];
  for (const movement of movements) {
    const key = civilDay(movement.at);
    if (!key) continue;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(movement);
    else groups.push({ key, label: LONG_DAY.format(new Date(movement.at)), items: [movement] });
  }
  return groups;
}

/** Linha do tempo das movimentações (painel de detalhes): por data, com ícone por tipo, título em destaque e texto secundário. Mostra 15 por vez. */
function MovementsTimeline({ movements }: { movements: ReadonlyArray<Movement> }) {
  const [loaded, setLoaded] = useState(0);
  const total = movements.length;
  const shown = visibleCount(loaded, total);
  const groups = groupMovementsByDay(movements.slice(0, shown));
  return (
    <>
      <div className="flex flex-col">
        {groups.map((group, groupIndex) => (
          <section key={group.key} aria-label={group.label} className={cn(groupIndex > 0 && "mt-5 border-t border-border/50 pt-5 dark:border-border")}>
            <h4 className="mb-4 inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-label font-semibold tracking-[0.04em] text-foreground/80 uppercase dark:bg-muted/60">
              <CalendarDays className="size-3.5 text-primary" aria-hidden="true" />
              {group.label}
            </h4>
            <ol className="flex flex-col">
              {group.items.map((movement, index) => {
                const visual = MOVEMENT_VISUAL[movement.kind] ?? MOVEMENT_FALLBACK;
                const Icon = visual.icon;
                const last = index === group.items.length - 1;
                return (
                  <li key={movement.id} className="relative flex items-start gap-3.5 pb-5 last:pb-0">
                    {last ? null : <span className="absolute top-9 -bottom-0 left-[17px] w-px bg-border" aria-hidden="true" />}
                    <span className={cn("relative flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", visual.tone)} aria-hidden="true">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm leading-snug font-semibold text-foreground">{visual.title}</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed break-words text-foreground/80">{movement.summary}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="size-3" aria-hidden="true" />
                          {movement.automatic ? "Automático" : (movement.actorName ?? "Usuário não identificado")}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time dateTime={movement.at} className="inline-flex items-center gap-1">
                          <Clock className="size-3" aria-hidden="true" />
                          {HOUR.format(new Date(movement.at))}
                        </time>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      {shown < total ? (
        <div className="mt-5 flex flex-col items-start gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => setLoaded(nextVisibleCount(shown, total))}>
            Mostrar mais {Math.min(TIMELINE_PAGE, total - shown)} movimentações
          </Button>
          <p role="status" aria-live="polite" className="text-[11px] text-muted-foreground">
            Mostrando {shown} de {total} movimentações.
          </p>
        </div>
      ) : null}
    </>
  );
}

/** Movimentações relevantes: lista compacta no card; no painel de detalhes (`comfortable`), linha do tempo por data. */
function MovementsList({ data, comfortable = false }: { data: Indicators; comfortable?: boolean }) {
  if (data.movements.length === 0) {
    return comfortable ? <DrawerEmpty>Nenhuma movimentação relevante registrada.</DrawerEmpty> : <p className="text-xs text-muted-foreground">Nenhuma movimentação relevante registrada.</p>;
  }
  if (comfortable) return <MovementsTimeline movements={data.movements} />;
  return (
    <ul className="flex flex-col gap-1.5">
      {data.movements.map((movement) => (
        <li key={movement.id} className="text-xs">
          <span className="break-words">{movement.summary}</span>
          <span className="block text-[11px] text-muted-foreground">
            {movement.automatic ? "Automático" : (movement.actorName ?? "Usuário não identificado")} · {MOMENT.format(new Date(movement.at))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function validationText(item: ValidationItem) {
  const who = item.validatedByName ?? "PMO";
  const kind = item.kind === "EXTRAORDINARY" ? "Validação extraordinária" : "Validação regular";
  return `${kind} por ${who} em ${REFERENCE.format(new Date(item.validatedAt))} · ciclo ${cycleDay(item.cycleStart)} a ${cycleDay(item.cycleEnd)}${item.unchanged ? " · sem alterações" : ""}`;
}

/**
 * Síntese, indicadores, próximas entregas e movimentações: usado no resumo ao vivo e no snapshot de uma validação.
 * `part` separa o essencial (síntese e indicadores, sempre visíveis no cartão) do complementar (próximas entregas e
 * movimentações, que aparecem quando o cartão é expandido).
 */
function SummaryContent({ data, part = "all", generatedAt }: { data: Indicators; part?: "all" | "core" | "extra"; generatedAt?: string }) {
  const core = part !== "extra";
  const extra = part !== "core";
  if (!data.hasData) {
    return core ? <p className="text-xs text-muted-foreground">{data.narrative[0]?.text}</p> : null;
  }
  return (
    <>
      {core ? (
        <>
          <p className="text-xs leading-relaxed text-foreground/85">{data.narrative.map((line) => line.text).join(" ")}</p>
          {part === "core" ? (
            <p className="text-[11px] text-muted-foreground">Dados de {generatedAt ? REFERENCE.format(new Date(generatedAt)) : ""}. Indicadores calculados automaticamente a cada consulta; a validação oficial do PMO fica registrada abaixo.</p>
          ) : null}
          {part === "core" ? (
            <>
              <div data-cut-unit className="flex flex-col gap-1.5 rounded-lg bg-muted/50 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">Progresso consolidado</p>
                  <p className="text-base leading-none font-semibold">{percent(data.progress.basisPoints)}</p>
                </div>
                <Progress
                  value={data.progress.basisPoints === null ? 0 : Math.round(data.progress.basisPoints / 100)}
                  aria-label="Progresso consolidado do projeto"
                  className="**:data-[slot=progress-track]:h-1.5"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Metric icon={RefreshCw} tone="blue" label="Reprogramações" value={String(data.reschedules.total)} />
                <Metric icon={Layers} tone="blue" label="Aguardando homologação" value={String(data.homologation.awaiting)} />
                <Metric icon={TriangleAlert} tone="red" label="Em correção" value={String(data.homologation.inCorrections)} />
              </div>
            </>
          ) : (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Fact label="Progresso consolidado" value={percent(data.progress.basisPoints)} />
              <Fact label="Itens em atraso" value={String(data.overdue.total)} />
              <Fact label="Impedimentos" value={String(data.impediments)} />
              <Fact label="Reprogramações" value={String(data.reschedules.total)} />
              <Fact label="Aguardando homologação" value={String(data.homologation.awaiting)} />
              <Fact label="Em correção" value={String(data.homologation.inCorrections)} />
            </dl>
          )}
        </>
      ) : null}
      {extra ? (
        <>
          <Block title="Próximas entregas">
            <DeliveriesList data={data} />
          </Block>
          <Block title="Movimentações relevantes">
            <MovementsList data={data} />
          </Block>
        </>
      ) : null}
    </>
  );
}

type SummaryTab = "visao" | "entregas" | "movimentacoes";

/**
 * Painel de detalhes do Resumo executivo, no modelo do Sobre o projeto: barra fixa (Visão geral, Entregas, Movimentações) que
 * mostra uma parte por vez, em cartões com ícone. Os dados vêm do resumo já carregado pelo card (sem nova consulta).
 */
function SummaryDrawerContent({ data, ownerName, suppliers, updatedAt, observation }: { data: Indicators; ownerName: string; suppliers: string[] | null; updatedAt: string; observation: string | null }) {
  const [tab, setTab] = useState<SummaryTab>("visao");
  const nav = useRef<HTMLDivElement>(null);
  function choose(id: string) {
    setTab(id as SummaryTab);
    nav.current?.closest<HTMLElement>("[role=region]")?.scrollTo({ top: 0 });
  }
  return (
    <div className="flex flex-col gap-4">
      <DrawerNav
        wrapperRef={nav}
        label="Partes do painel"
        active={tab}
        onSelect={choose}
        items={[
          { id: "visao", label: "Visão geral", icon: LayoutDashboard },
          { id: "entregas", label: "Entregas", icon: PackageCheck, count: data.nextDeliveries.length },
          { id: "movimentacoes", label: "Movimentações", icon: HistoryIcon, count: data.movements.length },
        ]}
      />
      <div key={tab} role="group" aria-label={tab === "visao" ? "Visão geral" : tab === "entregas" ? "Entregas" : "Movimentações"} className="motion-fade flex flex-col gap-4">
        {tab === "visao" ? (
          // Uma superfície só, organizada por seções e divisórias (em vez de vários cartões independentes).
          <div className="flex flex-col gap-1 overflow-hidden rounded-2xl border border-border/70 bg-card py-1 shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-border">
            <section aria-labelledby="resumo-situacao" className="px-5 py-4">
              <DrawerSectionHead
                id="resumo-situacao"
                icon={Gauge}
                title="Situação e progresso"
                caption="Andamento consolidado do projeto."
                aside={
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-label font-medium dark:border-border">
                    <span className={cn("size-2 rounded-full", DOT[data.situation.status])} aria-hidden="true" />
                    {projectStatusLabel(data.situation.status)}
                  </span>
                }
              />
              <div className="mb-2.5 flex items-end justify-between gap-3">
                <p className="text-4xl leading-none font-semibold tracking-tight">{percent(data.progress.basisPoints)}</p>
                <p className="text-xs text-muted-foreground">Progresso consolidado</p>
              </div>
              <Progress value={data.progress.basisPoints === null ? 0 : Math.round(data.progress.basisPoints / 100)} aria-label="Progresso consolidado do projeto" className="**:data-[slot=progress-track]:h-2" />
            </section>

            <section aria-labelledby="resumo-indicadores" className="px-5 py-4">
              <DrawerSectionHead id="resumo-indicadores" icon={LayoutDashboard} title="Indicadores do projeto" caption="Contagens que pedem atenção." />
              {/* Cinco indicadores numa faixa (celular: 3 + 2), separados por divisórias sutis. */}
              <ul aria-label="Indicadores do projeto" className="grid grid-cols-3 sm:grid-cols-5">
                {(
                  [
                    { icon: RefreshCw, value: data.reschedules.total, label: "Reprogramações" },
                    { icon: Layers, value: data.homologation.awaiting, label: "Aguardando homologação" },
                    { icon: TriangleAlert, value: data.homologation.inCorrections, label: "Em correção" },
                    { icon: CalendarClock, value: data.overdue.total, label: "Itens em atraso" },
                    { icon: OctagonAlert, value: data.impediments, label: "Impedimentos" },
                  ] as const
                ).map(({ icon: Icon, value, label }) => (
                  <li
                    key={label}
                    className="flex flex-col items-center gap-1 border-l border-border/60 px-2 py-3 text-center dark:border-border [&:nth-child(3n+1)]:border-l-0 [&:nth-child(n+4)]:border-t sm:[&:nth-child(3n+1)]:border-l sm:[&:nth-child(5n+1)]:border-l-0 sm:[&:nth-child(n+4)]:border-t-0"
                  >
                    <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                    <span className="text-2xl leading-none font-semibold">{value}</span>
                    <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="resumo-registro" className="px-5 py-4">
              <DrawerSectionHead id="resumo-registro" icon={UserRound} title="Responsáveis e registro" caption="Quem responde e quando foi atualizado." />
              <dl className="flex flex-col gap-3">
                {[
                  { label: "Responsável principal", value: ownerName },
                  { label: "Fornecedor", value: suppliers === null ? "Indisponível" : suppliers.length === 0 ? "Não informado" : suppliers.join(", ") },
                  { label: "Última atualização", value: updatedAt },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-baseline justify-between gap-x-6 max-sm:flex-col max-sm:items-start max-sm:gap-0.5">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 text-sm font-semibold break-words text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {observation ? (
              <section aria-labelledby="resumo-observacao" className="px-5 py-4">
                <DrawerSectionHead id="resumo-observacao" icon={ShieldCheck} title="Observação da última validação" />
                <p className="text-[13px] leading-relaxed break-words text-foreground/90">{observation}</p>
              </section>
            ) : null}
          </div>
        ) : null}
        {tab === "entregas" ? (
          <DrawerCard icon={PackageCheck} title="Próximas entregas" aside={data.nextDeliveries.length > 0 ? <DrawerCount value={data.nextDeliveries.length} /> : null}>
            <DeliveriesList data={data} comfortable />
          </DrawerCard>
        ) : null}
        {tab === "movimentacoes" ? (
          <DrawerCard icon={HistoryIcon} title="Movimentações relevantes" aside={data.movements.length > 0 ? <DrawerCount value={data.movements.length} /> : null}>
            <MovementsList data={data} comfortable />
          </DrawerCard>
        ) : null}
      </div>
    </div>
  );
}

type Mode = "regular" | "withoutChanges" | "extraordinary";

/** Confirmação da validação: mostra o que será registrado e envia a impressão digital que o PMO viu. */
function ValidationDialog({
  projectId,
  open,
  mode,
  summary,
  onClose,
  onDone,
}: {
  projectId: string;
  open: boolean;
  mode: Mode;
  summary: GetExecutiveSummary200;
  onClose: () => void;
  onDone: () => void;
}) {
  const [observation, setObservation] = useState("");
  const { busy, run } = useAction(onDone);
  const extraordinary = mode === "extraordinary";
  const canSend = !extraordinary || observation.trim().length > 0;

  async function confirm() {
    const done = await run(
      () =>
        validateExecutiveSummary(projectId, {
          fingerprint: summary.governance.fingerprint,
          ...(observation.trim() ? { observation: observation.trim() } : {}),
          ...(extraordinary ? { extraordinary: true } : {}),
          ...(mode === "withoutChanges" ? { withoutChanges: true } : {}),
        }),
      extraordinary ? "Validação extraordinária registrada." : "Resumo executivo validado.",
      "Não foi possível validar o resumo.",
    );
    if (done) {
      setObservation("");
      onClose();
    } else {
      // Indicadores mudaram ou o ciclo já foi validado: mostra de novo o que está valendo agora.
      onDone();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy && !next) {
          onClose();
        }
      }}
    >
      <EditDialogContent className="sm:max-w-[560px]">
        <EditDialogHeader
          icon={BadgeCheck}
          title={extraordinary ? "Validação extraordinária" : mode === "withoutChanges" ? "Validar sem alterações" : "Validar resumo executivo"}
          description={
            <>
              Você registra, como oficial, os indicadores calculados em {REFERENCE.format(new Date(summary.generatedAt))} (ciclo {cycleDay(summary.governance.cycle.start)} a{" "}
              {cycleDay(summary.governance.cycle.end)}). Se eles mudarem antes da confirmação, o sistema pede uma nova revisão.
            </>
          }
          onClose={onClose}
          closeDisabled={busy}
        />
        <EditDialogBody>
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed">{summary.narrative.map((line) => line.text).join(" ")}</p>
        <Textarea
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
          maxLength={2000}
          placeholder={extraordinary ? "Observação (obrigatória na validação extraordinária)" : "Observação (opcional)"}
          aria-label="Observação da validação"
          aria-required={extraordinary}
        />
        </EditDialogBody>
        <EditDialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy || !canSend} onClick={() => void confirm()}>
            {busy ? "Registrando…" : "Confirmar validação"}
          </Button>
        </EditDialogFooter>
      </EditDialogContent>
    </Dialog>
  );
}

type HistoryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: ValidationItem[] };

function History({ projectId, open, refreshKey }: { projectId: string; open: boolean; refreshKey: string }) {
  const [state, setState] = useState<HistoryState>({ status: "idle" });
  const [opened, setOpened] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ id: string; data: GetExecutiveSummaryValidation200 } | "error" | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    listExecutiveSummaryValidations(projectId)
      .then((response) => {
        if (active) {
          setState(response.status === 200 ? { status: "ready", items: response.data.data } : { status: "error" });
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [projectId, open, refreshKey]);

  useEffect(() => {
    if (!opened) {
      return;
    }
    let active = true;
    getExecutiveSummaryValidation(projectId, opened)
      .then((response) => {
        if (active) {
          setDetail(response.status === 200 ? { id: opened, data: response.data } : "error");
        }
      })
      .catch(() => {
        if (active) {
          setDetail("error");
        }
      });
    return () => {
      active = false;
    };
  }, [projectId, opened]);

  if (!open) {
    return null;
  }
  if (state.status === "idle" || state.status === "loading") {
    return <Skeleton className="h-10 w-full" />;
  }
  if (state.status === "error") {
    return <p className="text-xs text-muted-foreground">Não foi possível consultar o histórico de validações.</p>;
  }
  if (state.items.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhuma validação registrada até o momento.</p>;
  }
  return (
    <ul className="flex flex-col divide-y">
      {state.items.map((item) => {
        const expanded = opened === item.id;
        return (
          <li key={item.id} className="py-2 first:pt-0 last:pb-0">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => {
                setDetail(null);
                setOpened(expanded ? null : item.id);
              }}
              className="flex w-full items-start justify-between gap-2 text-left text-xs focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="block font-medium break-words">{validationText(item)}</span>
                {item.observation ? <span className="block break-words text-muted-foreground">Observação: {item.observation}</span> : null}
              </span>
              <ChevronDown className={cn("mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden="true" />
            </button>
            <Presence open={expanded}>
              <div className="mt-2 flex flex-col gap-3 rounded-md border border-dashed p-3">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  Registro oficial (somente leitura) · dados de {detail && detail !== "error" && detail.id === item.id ? REFERENCE.format(new Date(detail.data.snapshot.generatedAt)) : "…"}
                </p>
                {detail === "error" ? (
                  <p className="text-xs text-muted-foreground">Não foi possível abrir o registro.</p>
                ) : detail && detail.id === item.id ? (
                  <SummaryContent data={detail.data.snapshot} />
                ) : (
                  <Skeleton className="h-16 w-full" />
                )}
              </div>
            </Presence>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Resumo executivo: indicadores automáticos (calculados pela API a cada consulta, sem IA) e, separado, o registro
 * oficial da validação do PMO (ciclo semanal de quinta a quarta, histórico imutável e snapshot em leitura). Só o perfil
 * global PMO valida; os demais consultam.
 *
 * O cartão tem altura limitada como os demais: síntese, indicadores e o estado da validação ficam sempre visíveis (a
 * validação no rodapé) e o restante (próximas entregas, movimentações, responsável e fornecedor) aparece em "Ver mais",
 * que expande o próprio cartão. Abrir o histórico de validações não altera o "Ver mais": o cartão só abre espaço para o histórico.
 */
export function ExecutiveSummaryCard({
  projectId,
  ownerName,
  suppliers,
  updatedAt,
  refreshKey,
}: {
  projectId: string;
  ownerName: string;
  suppliers: string[] | null;
  updatedAt: string;
  /** Muda quando o projeto é atualizado: o resumo é consultado de novo. */
  refreshKey: string;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<Mode | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyHeight, setHistoryHeight] = useState(0);
  const historyBox = useRef<HTMLDivElement>(null);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  // Altura do histórico aberto: o cartão abre espaço só para ele, sem virar "Ver menos" nem mostrar os blocos extras.
  useEffect(() => {
    const element = historyBox.current;
    if (!historyOpen || !element) {
      return;
    }
    const observer = new ResizeObserver(() => setHistoryHeight(element.offsetHeight + 12));
    observer.observe(element);
    return () => {
      observer.disconnect();
      setHistoryHeight(0);
    };
  }, [historyOpen]);

  useEffect(() => {
    let active = true;
    getExecutiveSummary(projectId)
      .then((response) => {
        if (active) {
          setState(response.status === 200 ? { status: "ready", data: response.data } : { status: "error" });
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [projectId, refreshKey, version]);

  const data = state.status === "ready" ? state.data : null;
  const governance = data?.governance ?? null;

  // Conteúdo complementar (antes aparecia em "Ver mais"): vai para o painel lateral de detalhes.
  const detail = data ? (
    <SummaryDrawerContent data={data} ownerName={ownerName} suppliers={suppliers} updatedAt={updatedAt} observation={governance?.lastValidation?.observation ?? null} />
  ) : null;

  const validation = governance ? (
    <section aria-label="Validação do PMO" className="flex flex-col gap-1.5 rounded-md border border-primary/20 bg-primary/5 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <ShieldCheck className="size-3.5" aria-hidden="true" /> Validação do PMO (registro oficial)
      </h3>
      <p className="text-xs">{governance.lastValidation ? validationText(governance.lastValidation) : "Ainda não há resumo validado pelo PMO."}</p>
      <p className="text-xs text-muted-foreground">
        Ciclo atual: {cycleDay(governance.cycle.start)} a {cycleDay(governance.cycle.end)} ·{" "}
        {governance.currentCycleRegularValidated ? "validado" : governance.periodic ? `pendente (fecha na quarta, ${cycleDay(governance.cycle.end)})` : "projeto fora das cobranças periódicas"}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {governance.canValidate ? (
          !governance.currentCycleRegularValidated ? (
            <>
              <Button type="button" size="xs" onClick={() => setDialog("regular")}>
                Validar resumo
              </Button>
              {governance.unchangedSinceLastValidation ? (
                <Button type="button" size="xs" variant="outline" onClick={() => setDialog("withoutChanges")}>
                  Validar sem alterações
                </Button>
              ) : null}
            </>
          ) : (
            <Button type="button" size="xs" variant="outline" onClick={() => setDialog("extraordinary")}>
              Validação extraordinária
            </Button>
          )
        ) : null}
        <button
          type="button"
          aria-expanded={historyOpen}
          onClick={() => {
            // Abrir o histórico não muda o estado do cartão ("Ver mais"/"Ver menos"): ele só ganha a altura do histórico (extraHeight).
            setHistoryOpen(!historyOpen);
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronDown className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", historyOpen && "rotate-180")} aria-hidden="true" />
          Histórico de validações
        </button>
      </div>
      <Presence open={historyOpen}>
        <div ref={historyBox} className="pt-1">
          <History projectId={projectId} open={historyOpen} refreshKey={`${refreshKey}:${version}`} />
        </div>
      </Presence>
    </section>
  ) : null;

  return (
    <SectionCard
      title="Resumo executivo"
      subtitle="Panorama consolidado do projeto e validação do PMO."
      icon={FileText}
      tone="blue"
      extraHeight={historyHeight}
      moreLabel="Ver detalhes"
      expandable={data !== null}
      drawer={
        data
          ? {
              title: "Resumo executivo",
              description: "Panorama consolidado do projeto: entregas, movimentações e responsáveis.",
              content: detail,
            }
          : undefined
      }
      action={
        data ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium dark:border-border">
            <span className={cn("size-2 rounded-full", DOT[data.situation.status])} aria-hidden="true" />
            {projectStatusLabel(data.situation.status)}
          </span>
        ) : null
      }
      footer={validation}
    >
      {state.status === "loading" ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : state.status === "error" ? (
        <p className="text-xs text-muted-foreground">Não foi possível gerar o resumo do projeto agora.</p>
      ) : (
        <>
          <SummaryContent data={state.data} part="core" generatedAt={state.data.generatedAt} />
        </>
      )}
      {data ? (
        <ValidationDialog projectId={projectId} open={dialog !== null} mode={dialog ?? "regular"} summary={data} onClose={() => setDialog(null)} onDone={reload} />
      ) : null}
    </SectionCard>
  );
}
