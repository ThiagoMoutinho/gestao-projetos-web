"use client";

import {
  ArrowRight,
  CalendarClock,
  CircleCheck,
  ClipboardCheck,
  Clock,
  Flag,
  FolderKanban,
  History,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { EapStatusBadge } from "@/modules/projects/eap-status-badge";
import { civilDateInput } from "@/modules/projects/eap-present";
import { basisToPercent, formatBasis } from "@/modules/projects/eap-progress";
import type { ProjectListRow, ProjectMonitoringSignals } from "@/modules/projects/project-portfolio";
import { PROJECT_STATUS_COLOR, projectStatusKind, projectStatusLabel } from "@/modules/projects/project-status";

import { DashboardRetry } from "./dashboard-retry";
import { DashboardSection, SectionEmpty, StatusDot } from "./dashboard-section";
import {
  attentionProjects,
  dashboardIndicators,
  daysBetween,
  isActive,
  portfolioPending,
  recentlyUpdated,
  relativeDayLabel,
  statusDistribution,
  supplierLoad,
  upcomingMilestones,
  type DashboardIndicatorKey,
} from "./portfolio-dashboard";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const INDICATOR_COLOR: Record<DashboardIndicatorKey, string> = {
  total: "var(--primary)",
  EM_EXECUCAO: PROJECT_STATUS_COLOR.EM_EXECUCAO,
  EM_ATENCAO: PROJECT_STATUS_COLOR.EM_ATENCAO,
  CRITICO: PROJECT_STATUS_COLOR.CRITICO,
  CONCLUIDO: PROJECT_STATUS_COLOR.CONCLUIDO,
};

const linkFocus = "rounded-sm focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none";

function givenName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function percent(share: number) {
  return `${Math.round(share * 100)}%`;
}

function civilText(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

type HomeProps = {
  name: string;
  todayLabel: string;
  /** Dia civil de hoje (AAAA-MM-DD), no mesmo fuso das datas da EAP. */
  today: string;
  rows: ProjectListRow[];
  signals: Record<string, ProjectMonitoringSignals | null>;
};

export function HomeOverview({ name, todayLabel, today, rows, signals }: HomeProps) {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] min-w-0 flex-col gap-5">
      <HomeHeader name={name} todayLabel={todayLabel} />
      {rows.length === 0 ? (
        <DashboardSection title="Portfólio">
          <SectionEmpty
            icon={<FolderKanban />}
            title="Nenhum projeto disponível"
            description="A consulta não retornou projetos para o seu acesso. Os indicadores aparecem quando houver projetos vinculados."
          />
        </DashboardSection>
      ) : (
        <>
          <Indicators rows={rows} />
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)]">
            <div className="flex min-w-0 flex-col gap-4">
              <AttentionSection rows={rows} />
              <div className="grid min-w-0 items-start gap-4 lg:grid-cols-2">
                <MilestonesSection rows={rows} signals={signals} today={today} />
                <SupplierSection rows={rows} />
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <StatusSection rows={rows} />
              <PendingSection rows={rows} signals={signals} />
              <RecentSection rows={rows} today={today} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function HomeHeader({ name, todayLabel }: { name: string; todayLabel: string }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <span className="block text-[10px] font-bold tracking-[0.14em] text-primary uppercase">Painel executivo</span>
        <h1 className="mt-1.5 text-2xl font-medium tracking-tight text-foreground">Olá, {givenName(name)}!</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {todayLabel} · Situação dos projetos da CTIN calculada pela EAP de cada projeto.
        </p>
      </div>
      <Link href="/projetos" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start sm:self-auto")}>
        Abrir portfólio
        <ArrowRight aria-hidden="true" />
      </Link>
    </header>
  );
}

function Indicators({ rows }: { rows: ProjectListRow[] }) {
  const indicators = dashboardIndicators(rows);
  const active = rows.filter(isActive).length;

  return (
    <section aria-label="Indicadores do portfólio">
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {indicators.map((indicator) => {
          const alert = (indicator.key === "CRITICO" || indicator.key === "EM_ATENCAO") && indicator.value > 0;
          const color = INDICATOR_COLOR[indicator.key];
          return (
            <li
              key={indicator.key}
              className={cn(
                "flex min-w-0 flex-col rounded-[10px] border bg-card px-4 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]",
                indicator.key === "total" && "col-span-2 md:col-span-1",
              )}
              style={alert ? { boxShadow: `inset 3px 0 0 ${color}, 0 1px 2px rgba(16,24,40,0.04)` } : undefined}
            >
              <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <StatusDot color={color} className="size-2" />
                <span className="truncate">{indicator.label}</span>
              </span>
              <strong className="mt-2 text-[1.625rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">
                {indicator.value}
              </strong>
              <span className="mt-1.5 text-xs text-muted-foreground">
                {indicator.key === "total" ? `${plural(active, "em curso", "em curso")} · acessíveis ao seu perfil` : `${percent(indicator.share)} do portfólio`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AttentionSection({ rows }: { rows: ProjectListRow[] }) {
  const { items, total } = attentionProjects(rows);

  return (
    <DashboardSection
      title="Exigem atenção"
      description="Projetos críticos e em atenção, do maior risco ao menor."
      action={total > 0 ? <CountPill tone="danger">{plural(total, "projeto", "projetos")}</CountPill> : null}
      footer={
        total > items.length ? (
          <Link href="/projetos" className={cn("font-medium text-primary hover:underline", linkFocus)}>
            Mais {total - items.length} no portfólio
          </Link>
        ) : null
      }
    >
      {items.length === 0 ? (
        <SectionEmpty
          icon={<CircleCheck />}
          title="Nenhum projeto crítico ou em atenção"
          description="Pela situação calculada, nenhum projeto em curso apresenta atraso ou risco de prazo."
        />
      ) : (
        <ul className="divide-y">
          {items.map((project) => (
            <li key={project.id}>
              <AttentionRow project={project} />
            </li>
          ))}
        </ul>
      )}
    </DashboardSection>
  );
}

function AttentionRow({ project }: { project: ProjectListRow }) {
  const status = project.status as NonNullable<ProjectListRow["status"]>;
  const delay = project.situation?.delayDays ?? 0;
  const next = project.nextDelivery;

  return (
    <Link
      href={`/projetos/${project.id}`}
      style={{ boxShadow: `inset 3px 0 0 ${PROJECT_STATUS_COLOR[status]}` }}
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none motion-reduce:transition-none md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_7.5rem_auto]"
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-foreground group-hover:text-primary">{project.name}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {project.glpiTicketId ? `GLPI #${project.glpiTicketId}` : `ID ${project.id.slice(0, 8)}`}
          {project.suppliers && project.suppliers.length > 0 ? ` · ${project.suppliers.join(", ")}` : ""}
        </span>
      </span>
      <span className="col-span-2 row-start-2 min-w-0 text-xs md:col-span-1 md:row-start-auto">
        {next ? (
          <>
            <span className="block truncate text-foreground/80" title={next.title}>
              {next.corrections ? "Correções: " : ""}
              {next.title}
            </span>
            <span className={cn("block", next.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
              {civilText(civilDateInput(next.plannedAt))}
              {next.overdue ? " · Atrasada" : ""}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{project.nextDeliveryAvailable ? "Sem entregas pendentes" : "Entrega indisponível"}</span>
        )}
      </span>
      <span className="hidden items-center gap-2 md:flex">
        {project.progressBasisPoints === null ? (
          <span className="text-xs text-muted-foreground">Sem andamento</span>
        ) : (
          <>
            <Progress
              value={basisToPercent(project.progressBasisPoints)}
              aria-label={`Andamento de ${project.name}`}
              className="w-14 [&_[data-slot=progress-indicator]]:bg-primary [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-muted"
            />
            <span className="text-xs font-semibold text-foreground/80 tabular-nums">{formatBasis(project.progressBasisPoints)}%</span>
          </>
        )}
      </span>
      <span className="row-start-1 flex flex-col items-end gap-1 md:row-start-auto">
        <EapStatusBadge kind={projectStatusKind(status)} label={projectStatusLabel(status)} className="px-2 py-[3px] whitespace-nowrap" />
        {delay > 0 ? (
          <span className={cn("text-xs font-medium whitespace-nowrap", status === "CRITICO" ? "text-destructive" : "text-status-adjust-ink")}>
            {plural(delay, "dia de atraso", "dias de atraso")}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function StatusSection({ rows }: { rows: ProjectListRow[] }) {
  const { segments, known, unavailable } = statusDistribution(rows);

  return (
    <DashboardSection
      title="Situação do portfólio"
      description="Distribuição pela situação calculada."
      footer={unavailable > 0 ? `${plural(unavailable, "projeto", "projetos")} sem situação calculada (consulta indisponível).` : null}
      contentClassName="px-4 py-4"
    >
      {known === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma situação pôde ser calculada.</p>
      ) : (
        <>
          <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {segments.map((segment) => (
              <span
                key={segment.status}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${segment.share * 100}%`, backgroundColor: PROJECT_STATUS_COLOR[segment.status] }}
              />
            ))}
          </div>
          <ul className="mt-4 flex flex-col gap-2.5">
            {segments.map((segment) => (
              <li key={segment.status} className="flex items-center gap-2.5 text-[13px]">
                <StatusDot color={PROJECT_STATUS_COLOR[segment.status]} className="size-2" />
                <span className="min-w-0 flex-1 truncate text-foreground/80">{projectStatusLabel(segment.status)}</span>
                <span className="font-semibold text-foreground tabular-nums">{segment.count}</span>
                <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{percent(segment.share)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardSection>
  );
}

function PendingSection({ rows, signals }: { rows: ProjectListRow[]; signals: HomeProps["signals"] }) {
  const pending = portfolioPending(rows, signals);
  const lines: { label: string; value: number; icon: LucideIcon; tone: string; hint: string }[] = [
    { label: "Tarefas vencidas", value: pending.overdueTasks, icon: Clock, tone: "bg-status-critical-soft text-status-critical-ink", hint: "Prazo vigente vencido e tarefa não concluída." },
    { label: "Marcos vencidos", value: pending.overdueMilestones, icon: Flag, tone: "bg-status-critical-soft text-status-critical-ink", hint: "Data prevista vencida sem entrega." },
    { label: "Homologações aguardando", value: pending.awaitingHomologation, icon: ClipboardCheck, tone: "bg-status-validation-soft text-status-validation-ink", hint: "Marcos entregues aguardando a validação do gestor." },
    { label: "Marcos em correção", value: pending.inCorrections, icon: TriangleAlert, tone: "bg-warning/20 text-warning-foreground", hint: "Marcos devolvidos com ajustes solicitados." },
    { label: "Aptos para encerramento", value: pending.readyForClosure, icon: CircleCheck, tone: "bg-success/15 text-success-foreground", hint: "Todas as fases concluídas; falta a decisão formal." },
  ];

  return (
    <DashboardSection
      title="Pendências e atrasos"
      description="Somadas nos projetos em curso."
      footer={pending.unavailable > 0 ? `${plural(pending.unavailable, "projeto", "projetos")} sem monitoramento de prazos disponível.` : null}
    >
      <ul className="divide-y">
        {lines.map((line) => {
          const Icon = line.icon;
          return (
            <li key={line.label} className="flex items-center gap-3 px-4 py-2.5" title={line.hint}>
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5", line.value > 0 ? line.tone : "bg-muted text-muted-foreground")} aria-hidden="true">
                <Icon />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground/80">{line.label}</span>
              <span className={cn("text-sm font-semibold tabular-nums", line.value > 0 ? "text-foreground" : "text-muted-foreground")}>{line.value}</span>
            </li>
          );
        })}
      </ul>
    </DashboardSection>
  );
}

function MilestonesSection({ rows, signals, today }: { rows: ProjectListRow[]; signals: HomeProps["signals"]; today: string }) {
  const { items, total, overdue } = upcomingMilestones(rows, signals, today);

  return (
    <DashboardSection
      title="Próximos marcos"
      description="Entregas previstas nos projetos em curso."
      action={total > 0 ? <CountPill>{total}</CountPill> : null}
      footer={overdue > 0 ? `${plural(overdue, "marco vencido aparece", "marcos vencidos aparecem")} em Pendências e atrasos.` : null}
    >
      {items.length === 0 ? (
        <SectionEmpty icon={<CalendarClock />} title="Nenhum marco previsto" description="Não há marcos a entregar com data prevista nos projetos em curso." />
      ) : (
        <ul className="divide-y">
          {items.map((milestone) => {
            const [, month, day] = milestone.plannedOn.split("-");
            const soon = milestone.daysUntil <= 7;
            return (
              <li key={`${milestone.projectId}-${milestone.id}`}>
                <Link
                  href={`/projetos/${milestone.projectId}?aba=eap`}
                  className="group flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none motion-reduce:transition-none"
                >
                  <span className="flex w-10 shrink-0 flex-col items-center rounded-md border bg-muted/40 py-1 leading-none" aria-hidden="true">
                    <span className="text-sm font-semibold text-foreground tabular-nums">{day}</span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground uppercase">{MONTHS[Number(month) - 1]}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground group-hover:text-primary" title={milestone.title}>
                      {milestone.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {milestone.projectName}
                      {milestone.responsibleName ? ` · ${milestone.responsibleName}` : ""}
                    </span>
                  </span>
                  <span className={cn("shrink-0 text-xs whitespace-nowrap", soon ? "font-medium text-status-adjust-ink" : "text-muted-foreground")}>
                    <span className="sr-only">{civilText(milestone.plannedOn)}, </span>
                    {relativeDayLabel(milestone.daysUntil)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardSection>
  );
}

function SupplierSection({ rows }: { rows: ProjectListRow[] }) {
  const load = supplierLoad(rows);
  const notes = [
    load.hidden > 0 ? `Mais ${plural(load.hidden, "fornecedor", "fornecedores")}` : null,
    load.withoutSupplier > 0 ? `${plural(load.withoutSupplier, "projeto", "projetos")} sem fornecedor vinculado` : null,
    load.unavailable > 0 ? `${load.unavailable} com participantes indisponíveis` : null,
  ].filter(Boolean);

  return (
    <DashboardSection title="Projetos por fornecedor" description="Projetos em curso de cada fornecedor." footer={notes.length > 0 ? notes.join(" · ") : null}>
      {load.items.length === 0 ? (
        <SectionEmpty icon={<Users />} title="Nenhum fornecedor vinculado" description="Os fornecedores aparecem quando forem incluídos como participantes dos projetos." />
      ) : (
        <ul className="flex flex-col gap-3.5 px-4 py-4">
          {load.items.map((supplier) => {
            const risk = [
              supplier.critical > 0 ? plural(supplier.critical, "crítico", "críticos") : null,
              supplier.attention > 0 ? `${supplier.attention} em atenção` : null,
            ].filter(Boolean);
            return (
              <li key={supplier.name} className="min-w-0">
                <span className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate text-foreground/80" title={supplier.name}>{supplier.name}</span>
                  <span className="shrink-0 font-semibold text-foreground tabular-nums">{supplier.total}</span>
                </span>
                <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
                  <span className="h-full rounded-full bg-primary/70" style={{ width: `${(supplier.total / load.max) * 100}%` }} />
                </span>
                {risk.length > 0 ? <span className="mt-1 block text-xs font-medium text-status-adjust-ink">{risk.join(" · ")}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardSection>
  );
}

function RecentSection({ rows, today }: { rows: ProjectListRow[]; today: string }) {
  const recent = recentlyUpdated(rows);

  return (
    <DashboardSection title="Atualizações recentes" description="Projetos com cadastro alterado por último.">
      <ul className="divide-y">
        {recent.map((project) => {
          const updatedOn = civilDateInput(project.updatedAt);
          return (
            <li key={project.id}>
              <Link
                href={`/projetos/${project.id}`}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none motion-reduce:transition-none"
              >
                <History className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-foreground group-hover:text-primary">{project.name}</span>
                  <span className="block text-xs text-muted-foreground">{project.status ? projectStatusLabel(project.status) : "Situação indisponível"}</span>
                </span>
                <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground" title={updatedOn ? civilText(updatedOn) : undefined}>
                  {updatedOn ? relativeDayLabel(daysBetween(today, updatedOn)) : "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </DashboardSection>
  );
}

function CountPill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "danger" }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        tone === "danger" ? "bg-status-critical-soft text-status-critical-ink" : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function HomeOverviewError({ name, todayLabel, message }: { name: string; todayLabel: string; message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] min-w-0 flex-col gap-5">
      <HomeHeader name={name} todayLabel={todayLabel} />
      <DashboardSection title="Portfólio">
        <div className="flex flex-col items-center gap-4 pb-8">
          <SectionEmpty icon={<TriangleAlert />} title="Não foi possível montar o painel" description={message} />
          <DashboardRetry />
        </div>
      </DashboardSection>
    </div>
  );
}
