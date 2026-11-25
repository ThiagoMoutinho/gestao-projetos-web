"use client";

import {
  BadgeCheck,
  Ban,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheck,
  CircleX,
  Clock,
  FilePenLine,
  FileText,
  Flag,
  Gauge,
  History as HistoryIcon,
  Info,
  Layers,
  LayoutDashboard,
  OctagonAlert,
  PackageCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  TriangleAlert,
  Undo2,
  UserRound,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";
import { Presence } from "@/components/ui/presence";
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
import { DrawerCard, DrawerCount, DrawerEmpty, DrawerNav } from "./overview-detail-drawer";
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

/** Badge de situação no cabeçalho (fundo suave + ponto), como na referência visual. */
const SITUATION_BADGE: Record<Indicators["situation"]["status"], string> = {
  NAO_INICIADO: "bg-muted text-muted-foreground",
  EM_EXECUCAO: "bg-primary/10 text-primary",
  EM_ATENCAO: "bg-status-attention-soft text-status-attention-ink",
  CRITICO: "bg-status-critical-soft text-status-critical-ink",
  EM_VALIDACAO: "bg-status-validation-soft text-status-validation-ink",
  CONCLUIDO: "bg-status-done-soft text-status-done-ink",
  SUSPENSO: "bg-muted text-muted-foreground",
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

/** Progresso circular (valor em basis points da API; 10_000 = 100%). */
function CircularProgress({ basisPoints, label, className }: { basisPoints: number | null; label: string; className?: string }) {
  const pct = basisPoints === null ? 0 : Math.min(100, Math.max(0, Math.round(basisPoints / 100)));
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  return (
    <div className={cn("relative size-20 shrink-0", className)} role="img" aria-label={label}>
      <svg viewBox="0 0 96 96" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={basisPoints === null ? circumference : offset}
          className="text-primary transition-[stroke-dashoffset] duration-300 ease-out motion-reduce:transition-none"
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-lg font-semibold tracking-tight tabular-nums text-foreground">{percent(basisPoints)}</span>
        <span className="mt-1 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase">concluído</span>
      </span>
    </div>
  );
}

/** Tom de cada indicador quando tem valor (tokens de situação); com zero, o bloco fica neutro. */
const METRIC_TONE = {
  running: "bg-status-running-soft text-status-running-ink",
  validation: "bg-status-validation-soft text-status-validation-ink",
  critical: "bg-status-critical-soft text-status-critical-ink",
  done: "bg-status-done-soft text-status-done-ink",
} as const;

/** Indicador operacional em bloco: ícone na cor do assunto, valor em destaque e rótulo; o crítico ganha fundo de alerta. */
function OpsMetric({
  icon: Icon,
  label,
  value,
  tone,
  emphasize = false,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: keyof typeof METRIC_TONE;
  emphasize?: boolean;
}) {
  const hot = emphasize && value > 0;
  return (
    <div
      className={cn(
        "flex h-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5",
        hot ? "border-status-critical-ink/20 bg-status-critical-soft/60" : "border-border/60 bg-muted/25 dark:border-border",
      )}
    >
      <span
        className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", value > 0 ? METRIC_TONE[tone] : "bg-muted text-muted-foreground")}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <span className="grid min-w-0 leading-tight">
        <span className={cn("text-xl font-semibold tabular-nums", hot ? "text-status-critical-ink" : "text-foreground")}>{value}</span>
        <span className={cn("truncate text-[11px]", hot ? "text-status-critical-ink" : "text-muted-foreground")} title={label}>
          {label}
        </span>
      </span>
    </div>
  );
}

/** Resumo curto da situação (dados da API; sem inventar valores). */
function shortSituation(data: Indicators) {
  const status = projectStatusLabel(data.situation.status);
  const delay =
    data.situation.delayDays > 0
      ? `, com o maior atraso em ${data.situation.delayDays} ${data.situation.delayDays === 1 ? "dia" : "dias"}`
      : "";
  const overdue =
    data.overdue.total === 0
      ? "Nenhum item em atraso"
      : `${data.overdue.total} ${data.overdue.total === 1 ? "item em atraso" : "itens em atraso"} (${data.overdue.tasks} ${data.overdue.tasks === 1 ? "tarefa" : "tarefas"}, ${data.overdue.milestones} ${data.overdue.milestones === 1 ? "marco" : "marcos"})`;
  const impediment =
    data.impediments === 0
      ? "nenhum impedimento"
      : `${data.impediments} ${data.impediments === 1 ? "tarefa com impedimento" : "tarefas com impedimento"}`;
  return `${status}${delay}. ${overdue} e ${impediment}.`;
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

/** Detalhes estruturados da situação (expansível no cartão; preserva todos os campos da API). */
function SituationDetails({ data }: { data: Indicators }) {
  // Só o que o cartão ainda não mostra: reprogramações, homologação, impedimentos e a lista de entregas ficam nos indicadores
  // do cartão e no painel de detalhes (aba Entregas), sem repetir aqui.
  const facts = [
    {
      label: "Maior atraso",
      value: data.situation.delayDays > 0 ? `${data.situation.delayDays} ${data.situation.delayDays === 1 ? "dia" : "dias"}` : "Sem atraso",
    },
    { label: "Tarefas atrasadas", value: String(data.overdue.tasks) },
    { label: "Marcos atrasados", value: String(data.overdue.milestones) },
  ] as const;
  return (
    <dl className="grid grid-cols-1 gap-2 pt-2.5 sm:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-baseline justify-between gap-3 text-xs sm:flex-col sm:items-start sm:gap-0.5">
          <dt className="text-muted-foreground">{fact.label}</dt>
          <dd className="font-medium tabular-nums text-foreground">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Faixa "Situação atual" no tom da situação: fundo suave, ícone e borda da cor correspondente. */
const SITUATION_CALLOUT: Record<Indicators["situation"]["status"], { box: string; icon: LucideIcon; ink: string }> = {
  NAO_INICIADO: { box: "border-border/70 bg-muted/40", icon: Info, ink: "text-muted-foreground" },
  EM_EXECUCAO: { box: "border-primary/20 bg-primary/5", icon: Info, ink: "text-primary" },
  EM_ATENCAO: { box: "border-status-attention-ink/20 bg-status-attention-soft/70", icon: TriangleAlert, ink: "text-status-attention-ink" },
  CRITICO: { box: "border-status-critical-ink/20 bg-status-critical-soft/70", icon: OctagonAlert, ink: "text-status-critical-ink" },
  EM_VALIDACAO: { box: "border-status-validation-ink/20 bg-status-validation-soft/70", icon: Layers, ink: "text-status-validation-ink" },
  CONCLUIDO: { box: "border-status-done-ink/20 bg-status-done-soft/70", icon: CircleCheck, ink: "text-status-done-ink" },
  SUSPENSO: { box: "border-border/70 bg-muted/40", icon: Ban, ink: "text-muted-foreground" },
};

/** Faixa "Situação atual" — sempre no rodapé do cartão (fora da área cortável). */
function SituationBar({ data }: { data: Indicators }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const callout = SITUATION_CALLOUT[data.situation.status];
  const CalloutIcon = callout.icon;
  return (
    <section className={cn("rounded-xl border px-3.5 py-2.5", callout.box)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-2.5 text-left focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <CalloutIcon className={cn("mt-0.5 size-4 shrink-0", callout.ink)} aria-hidden="true" />
        <p className={cn("min-w-0 flex-1 text-xs leading-relaxed text-foreground/90", !open && "line-clamp-2")}>
          <span className={cn("font-semibold", callout.ink)}>Situação atual · </span>
          {shortSituation(data)}
        </p>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      <Presence open={open}>
        <div id={id} className="pt-1">
          <SituationDetails data={data} />
        </div>
      </Presence>
    </section>
  );
}

/**
 * Síntese, indicadores, próximas entregas e movimentações: usado no resumo ao vivo e no snapshot de uma validação.
 * `part` separa o essencial (síntese e indicadores, sempre visíveis no cartão) do complementar (próximas entregas e
 * movimentações, que aparecem quando o cartão é expandido).
 */
function SummaryContent({ data, part = "all" }: { data: Indicators; part?: "all" | "core" | "extra"; generatedAt?: string }) {
  const core = part !== "extra";
  const extra = part !== "core";
  if (!data.hasData) {
    return core ? <p className="text-xs text-muted-foreground">{data.narrative[0]?.text}</p> : null;
  }

  const phasesLabel =
    data.progress.phasesTotal === 1
      ? `${data.progress.phasesCalculated} de ${data.progress.phasesTotal} fase calculada`
      : `${data.progress.phasesCalculated} de ${data.progress.phasesTotal} fases calculadas`;

  return (
    <>
      {core ? (
        part === "core" ? (
          <div className="@container flex min-h-0 flex-1 flex-col">
            {/* Progresso à esquerda e indicadores operacionais em blocos 2×2 (a situação fica no rodapé, sempre visível). */}
            <div className="grid flex-1 gap-4 @min-[520px]:grid-cols-[auto_minmax(0,1fr)] @min-[520px]:items-center @min-[520px]:gap-6">
              <div className="flex items-center gap-4 @min-[520px]:flex-col @min-[520px]:gap-2.5 @min-[520px]:text-center">
                <CircularProgress
                  basisPoints={data.progress.basisPoints}
                  label={`Progresso consolidado: ${percent(data.progress.basisPoints)}`}
                  className="size-24 @min-[520px]:size-28"
                />
                <div className="min-w-0 @min-[520px]:flex @min-[520px]:flex-col @min-[520px]:items-center">
                  <p className="text-sm font-semibold text-foreground">Progresso consolidado</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{phasesLabel}</p>
                  {data.situation.delayDays > 0 ? (
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-status-critical-soft px-2.5 py-1 text-[11px] font-medium text-status-critical-ink">
                      <Clock className="size-3.5" aria-hidden="true" />
                      Maior atraso: {data.situation.delayDays} {data.situation.delayDays === 1 ? "dia" : "dias"}
                    </span>
                  ) : null}
                </div>
              </div>
              <ul aria-label="Indicadores operacionais" className="grid min-w-0 grid-cols-1 gap-2.5 @min-[300px]:grid-cols-2">
                {(
                  [
                    { icon: RefreshCw, label: "Reprogramações", value: data.reschedules.total, tone: "running" },
                    { icon: Layers, label: "Aguardando homologação", value: data.homologation.awaiting, tone: "validation" },
                    { icon: TriangleAlert, label: data.impediments === 1 ? "Impedimento" : "Impedimentos", value: data.impediments, tone: "critical", emphasize: true },
                    { icon: Flag, label: "Entregas futuras", value: data.nextDeliveries.length, tone: "done" },
                  ] as const
                ).map((item) => (
                  <li key={item.tone}>
                    <OpsMetric icon={item.icon} label={item.label} value={item.value} tone={item.tone} emphasize={"emphasize" in item && item.emphasize} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-foreground/85">{data.narrative.map((line) => line.text).join(" ")}</p>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Fact label="Progresso consolidado" value={percent(data.progress.basisPoints)} />
              <Fact label="Itens em atraso" value={String(data.overdue.total)} />
              <Fact label="Impedimentos" value={String(data.impediments)} />
              <Fact label="Reprogramações" value={String(data.reschedules.total)} />
              <Fact label="Aguardando homologação" value={String(data.homologation.awaiting)} />
              <Fact label="Em correção" value={String(data.homologation.inCorrections)} />
            </dl>
          </>
        )
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

type SummaryTab = "visao" | "entregas" | "movimentacoes" | "validacoes";

/**
 * Painel de detalhes do Resumo executivo: barra fixa (Visão geral, Entregas, Movimentações, Validações) que mostra uma parte
 * por vez. O histórico de validações do PMO fica só neste painel; no cartão o botão "Histórico" abre aqui.
 */
function SummaryDrawerContent({
  data,
  ownerName,
  suppliers,
  updatedAt,
  observation,
  projectId,
  refreshKey,
  initialTab = "visao",
}: {
  data: Indicators;
  ownerName: string;
  suppliers: string[] | null;
  updatedAt: string;
  observation: string | null;
  projectId: string;
  refreshKey: string;
  initialTab?: SummaryTab;
}) {
  const [tab, setTab] = useState<SummaryTab>(initialTab);
  const nav = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  function choose(id: string) {
    setTab(id as SummaryTab);
    nav.current?.closest<HTMLElement>("[role=region]")?.scrollTo({ top: 0 });
  }
  const tabLabel =
    tab === "visao" ? "Visão geral" : tab === "entregas" ? "Entregas" : tab === "movimentacoes" ? "Movimentações" : "Validações";
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
          { id: "validacoes", label: "Validações", icon: ShieldCheck },
        ]}
      />
      <div key={tab} role="group" aria-label={tabLabel} className="motion-fade flex flex-col gap-4">
        {tab === "visao" ? (
          <div className="flex flex-col gap-4">
            <DrawerCard
              icon={Gauge}
              title="Situação e progresso"
              aside={
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-label font-medium", SITUATION_BADGE[data.situation.status])}>
                  <span className={cn("size-2 rounded-full", DOT[data.situation.status])} aria-hidden="true" />
                  {projectStatusLabel(data.situation.status)}
                </span>
              }
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
                <CircularProgress
                  basisPoints={data.progress.basisPoints}
                  label={`Progresso consolidado: ${percent(data.progress.basisPoints)}`}
                  className="mx-auto size-32 sm:mx-0"
                />
                <div className="min-w-0 flex-1 space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Progresso consolidado</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {data.progress.phasesTotal === 1
                        ? `${data.progress.phasesCalculated} de ${data.progress.phasesTotal} fase calculada.`
                        : `${data.progress.phasesCalculated} de ${data.progress.phasesTotal} fases calculadas.`}
                    </p>
                  </div>
                  {data.situation.delayDays > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-status-critical-soft px-2.5 py-1 text-[11px] font-medium text-status-critical-ink">
                      <Clock className="size-3.5" aria-hidden="true" />
                      Maior atraso: {data.situation.delayDays} {data.situation.delayDays === 1 ? "dia" : "dias"}
                    </span>
                  ) : null}
                  {(() => {
                    const callout = SITUATION_CALLOUT[data.situation.status];
                    const CalloutIcon = callout.icon;
                    return (
                      <div className={cn("flex items-start gap-2.5 rounded-xl border px-3.5 py-3", callout.box)}>
                        <CalloutIcon className={cn("mt-0.5 size-4 shrink-0", callout.ink)} aria-hidden="true" />
                        <p className="min-w-0 text-[13px] leading-relaxed text-foreground/90">
                          <span className={cn("font-semibold", callout.ink)}>Situação atual · </span>
                          {shortSituation(data)}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </DrawerCard>

            <DrawerCard icon={LayoutDashboard} title="Indicadores do projeto">
              <ul
                aria-label="Indicadores do projeto"
                className="grid grid-cols-2 overflow-hidden rounded-xl bg-muted/35 sm:grid-cols-3 dark:bg-muted/20"
              >
                {(
                  [
                    { icon: RefreshCw, value: data.reschedules.total, label: "Reprogramações" },
                    { icon: Layers, value: data.homologation.awaiting, label: "Aguardando homologação" },
                    { icon: TriangleAlert, value: data.homologation.inCorrections, label: "Em correção" },
                    { icon: CalendarClock, value: data.overdue.total, label: "Itens em atraso", hot: data.overdue.total > 0 },
                    { icon: OctagonAlert, value: data.impediments, label: data.impediments === 1 ? "Impedimento" : "Impedimentos", hot: data.impediments > 0 },
                    { icon: Flag, value: data.nextDeliveries.length, label: "Entregas futuras" },
                  ] as const
                ).map((item, index) => {
                  const Icon = item.icon;
                  const hot = "hot" in item && item.hot;
                  return (
                    <li
                      key={item.label}
                      className={cn(
                        "flex flex-col items-start gap-1.5 border-border/50 px-3.5 py-3.5 dark:border-border",
                        index % 2 === 1 && "border-l",
                        index >= 2 && "border-t",
                        index % 3 !== 0 && "sm:border-l",
                        index % 3 === 0 && "sm:border-l-0",
                        index >= 3 && "sm:border-t",
                        index < 3 && "sm:border-t-0",
                      )}
                    >
                      <Icon className={cn("size-3.5", hot ? "text-status-critical-ink" : "text-muted-foreground")} aria-hidden="true" />
                      <span className={cn("text-xl leading-none font-semibold tabular-nums", hot ? "text-status-critical-ink" : "text-foreground")}>{item.value}</span>
                      <span className="text-[11px] leading-snug text-muted-foreground">{item.label}</span>
                    </li>
                  );
                })}
              </ul>
            </DrawerCard>

            <DrawerCard icon={UserRound} title="Responsáveis e registro">
              <dl className="flex flex-col gap-3.5">
                {[
                  { label: "Responsável principal", value: ownerName },
                  { label: "Fornecedor", value: suppliers === null ? "Indisponível" : suppliers.length === 0 ? "Não informado" : suppliers.join(", ") },
                  { label: "Última atualização", value: updatedAt },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-baseline justify-between gap-x-6 max-sm:flex-col max-sm:items-start max-sm:gap-0.5">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 text-sm font-semibold break-words text-foreground sm:text-right">{value}</dd>
                  </div>
                ))}
              </dl>
            </DrawerCard>

            {observation ? (
              <DrawerCard icon={ShieldCheck} title="Observação da última validação">
                <p className="text-[13px] leading-relaxed break-words text-foreground/90">{observation}</p>
              </DrawerCard>
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
        {tab === "validacoes" ? (
          <DrawerCard icon={ShieldCheck} title="Histórico de validações">
            <p className="mb-4 text-xs text-muted-foreground">Registros oficiais do PMO. Cada linha resume a validação; abra para ver o snapshot completo.</p>
            <History projectId={projectId} open refreshKey={refreshKey} />
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
          description={`Ciclo de ${cycleDay(summary.governance.cycle.start)} a ${cycleDay(summary.governance.cycle.end)}.`}
          details="Você registra, como oficial, os indicadores calculados nesta referência. Se eles mudarem antes da confirmação, o sistema pede uma nova revisão."
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

/**
 * Lista do histórico no sheet: só a primeira linha de cada validação; o snapshot e a observação aparecem ao expandir.
 */
function History({ projectId, open, refreshKey }: { projectId: string; open: boolean; refreshKey: string }) {
  const [state, setState] = useState<HistoryState>({ status: "idle" });
  const [opened, setOpened] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ id: string; data: GetExecutiveSummaryValidation200 } | "error" | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    setState({ status: "loading" });
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
    <ul className="flex flex-col divide-y divide-border/60 dark:divide-border">
      {state.items.map((item) => {
        const expanded = opened === item.id;
        return (
          <li key={item.id} className="py-3 first:pt-0 last:pb-0">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => {
                setDetail(null);
                setOpened(expanded ? null : item.id);
              }}
              className="flex w-full items-center justify-between gap-3 text-left text-xs focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="min-w-0 truncate font-medium text-foreground">{validationText(item)}</span>
              <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden="true" />
            </button>
            <Presence open={expanded}>
              <div className="mt-3 flex flex-col gap-3 rounded-xl border border-dashed border-border/70 bg-muted/30 p-3.5 dark:bg-muted/20">
                {item.observation ? <p className="text-xs leading-relaxed break-words text-muted-foreground">Observação: {item.observation}</p> : null}
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
 * O histórico de validações fica no sheet (aba Validações): no cartão o botão só abre o painel. Cada item do histórico
 * mostra uma linha; o snapshot completo aparece ao expandir dentro do sheet.
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<SummaryTab>("visao");
  const reload = useCallback(() => setVersion((value) => value + 1), []);

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

  function openDrawer(tab: SummaryTab = "visao") {
    setDrawerTab(tab);
    setDrawerOpen(true);
  }

  // Conteúdo complementar e histórico de validações: painel lateral de detalhes.
  const detail = data ? (
    <SummaryDrawerContent
      data={data}
      ownerName={ownerName}
      suppliers={suppliers}
      updatedAt={updatedAt}
      observation={governance?.lastValidation?.observation ?? null}
      projectId={projectId}
      refreshKey={`${refreshKey}:${version}`}
      initialTab={drawerTab}
    />
  ) : null;

  const validation = governance ? (
    <section aria-label="Validação do PMO" className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/25 p-3.5 dark:border-border">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate">Validação do PMO</span>
        </h3>
        {governance.currentCycleRegularValidated ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-status-done-soft px-2 py-0.5 text-[11px] font-semibold text-status-done-ink">
            <Check className="size-3" strokeWidth={2.5} aria-hidden="true" />
            Ciclo validado
          </span>
        ) : governance.periodic ? (
          <span className="inline-flex shrink-0 items-center rounded-full bg-status-attention-soft px-2 py-0.5 text-[11px] font-semibold text-status-attention-ink">Ciclo pendente</span>
        ) : (
          <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Fora do ciclo</span>
        )}
      </div>

      <div>
        <div className="flex flex-col gap-3">
          <dl className="grid gap-x-6 gap-y-2.5 text-xs sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-[11px] text-muted-foreground">Última validação</dt>
              <dd className="min-w-0 font-medium text-foreground">
                {governance.lastValidation ? (
                  <>
                    <span className="tabular-nums">{REFERENCE.format(new Date(governance.lastValidation.validatedAt))}</span>
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      · {governance.lastValidation.validatedByName ?? "PMO"}
                      {governance.lastValidation.kind === "EXTRAORDINARY" ? " · extraordinária" : ""}
                    </span>
                  </>
                ) : (
                  <span className="font-normal text-muted-foreground">Ainda não há resumo validado pelo PMO.</span>
                )}
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-[11px] text-muted-foreground">Ciclo atual</dt>
              <dd className="min-w-0 font-medium text-foreground">
                <span className="tabular-nums">
                  {cycleDay(governance.cycle.start)} a {cycleDay(governance.cycle.end)}
                </span>
                {!governance.currentCycleRegularValidated && governance.periodic ? (
                  <span className="font-normal text-muted-foreground"> · fecha na quarta</span>
                ) : null}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 dark:border-border">
            {governance.canValidate ? (
              !governance.currentCycleRegularValidated ? (
                <>
                  <Button type="button" size="sm" onClick={() => setDialog("regular")}>
                    Validar resumo
                  </Button>
                  {governance.unchangedSinceLastValidation ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setDialog("withoutChanges")}>
                      Validar sem alterações
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button type="button" size="sm" variant="secondary" onClick={() => setDialog("extraordinary")}>
                  <Plus aria-hidden="true" />
                  Validação extraordinária
                </Button>
              )
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => openDrawer("validacoes")}
            >
              <HistoryIcon aria-hidden="true" />
              Histórico de validações
            </Button>
          </div>
        </div>
      </div>
    </section>
  ) : null;

  const footer =
    data && data.hasData ? (
      <div className="flex flex-col gap-3">
        <SituationBar data={data} />
        {validation}
      </div>
    ) : (
      validation
    );

  return (
    <SectionCard
      title="Resumo executivo"
      subtitle="Panorama consolidado do projeto e validação do PMO."
      icon={FileText}
      tone="blue"
      moreLabel="Ver detalhes"
      expandable={data !== null}
      drawerOpen={drawerOpen}
      onDrawerOpenChange={(open) => {
        setDrawerOpen(open);
        if (!open) setDrawerTab("visao");
      }}
      drawer={
        data
          ? {
              title: "Resumo executivo",
              description: "Panorama consolidado do projeto: entregas, movimentações, responsáveis e validações do PMO.",
              content: detail,
            }
          : undefined
      }
      action={
        data ? (
          <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium", SITUATION_BADGE[data.situation.status])}>
            <span className={cn("size-2 rounded-full", DOT[data.situation.status])} aria-hidden="true" />
            {projectStatusLabel(data.situation.status)}
          </span>
        ) : null
      }
      footer={footer}
    >
      {state.status === "loading" ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="flex items-center gap-4">
            <Skeleton className="size-20 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-6 w-32 rounded-full" />
            </div>
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : state.status === "error" ? (
        <p className="text-xs text-muted-foreground">Não foi possível gerar o resumo do projeto agora.</p>
      ) : (
        <SummaryContent data={state.data} part="core" />
      )}
      {data ? (
        <ValidationDialog projectId={projectId} open={dialog !== null} mode={dialog ?? "regular"} summary={data} onClose={() => setDialog(null)} onDone={reload} />
      ) : null}
    </SectionCard>
  );
}
