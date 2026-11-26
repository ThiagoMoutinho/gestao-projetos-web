"use client";

import {
  AlertCircle,
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Download,
  EllipsisVertical,
  FileText,
  Folder,
  FolderKanban,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  List,
  ListChecks,
  Network,
  Pencil,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type MouseEvent, type ReactNode } from "react";

import { OptionCombobox } from "@/components/option-combobox";
import { PageLoadError } from "@/components/page-load-error";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api/fetcher";
import { notifySuccess, reportFailure } from "@/lib/feedback";
import { cn } from "@/lib/utils";

import { formatCivilDate } from "./eap-date-field";
import { civilDateInput } from "./eap-present";
import { basisToPercent, formatBasis } from "./eap-progress";
import { EapStatusBadge } from "./eap-status-badge";
import { OVERVIEW_CARD } from "./overview-panel";
import { AVATAR_PALETTE } from "./people-stack";
import { ArchiveJustificationDialog } from "./archive-justification-dialog";
import { ArchiveProjectDialog } from "./archive-project-dialog";
import { ProjectEditDialog } from "./project-edit-dialog";
import { unarchiveProject } from "./archive-project-api";
import {
  avatarColorIndex,
  canArchiveProject,
  canEditProject,
  delayCell,
  filterOptions,
  filterPortfolio,
  idlePortfolioFilters,
  isFiltering,
  ownerInitials,
  paginate,
  portfolioCsv,
  isPortfolioDelayed,
  isPortfolioNeedsAction,
  portfolioDelayedReasons,
  portfolioHealth,
  portfolioNeedsActionReasons,
  PORTFOLIO_FOLLOW_UP_DAYS,
  PORTFOLIO_VIEWS,
  SORT_LABEL,
  sortPortfolio,
  statusChips,
  statusShare,
  TEAM_ROLE_LABEL,
  teamPreview,
  unavailableSituations,
  updatedLabel,
  viewCounts,
  type PortfolioFilters,
  type PortfolioSort,
  type PortfolioView,
  type ProjectListRow,
  type ProjectStatus,
} from "./project-portfolio";
import { PROJECT_STATUS_COLOR as STATUS_COLOR, projectStatusKind, projectStatusLabel } from "./project-status";

/** Mesmo acabamento dos cartões da Visão Geral / EAP (sem `min-h-full`, que esticaria a página). */
const CARD = OVERVIEW_CARD.replace("min-h-full ", "");

/** Mesmo envelope de página da Visão Geral, EAP, Cronograma e Entregas. */
const PAGE = "mx-auto flex w-full max-w-[90rem] min-w-0 flex-col gap-6";

const PAGE_SIZES = ["10", "15", "25", "50"];

const menuItem = "gap-2.5 rounded-md px-2.5 py-2 text-label [&_svg]:size-4 [&_svg]:text-muted-foreground";

const TAB_LABEL: Record<PortfolioView, string> = { active: "Ativos", concluded: "Concluídos", archived: "Arquivados", all: "Todos" };

const TAB_ICON: Record<PortfolioView, LucideIcon> = {
  active: Folder,
  concluded: CircleCheck,
  archived: Archive,
  all: Layers,
};

/**
 * Abas de visualização no azul da marca (`--brand`), o mesmo tom do marcador
 * do menu no Claro — sem o azul-marinho escuro (`--brand-deep`).
 */
function ViewTabs({
  value,
  onChange,
}: {
  value: PortfolioView;
  onChange: (next: PortfolioView) => void;
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as PortfolioView)}
      className="max-w-full shrink-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <TabsList aria-label="Visualização dos projetos" className="h-10 w-max gap-0.5 overflow-visible bg-muted p-1">
        {PORTFOLIO_VIEWS.map((item) => {
          const Icon = TAB_ICON[item.key];
          return (
            <TabsTrigger
              key={item.key}
              value={item.key}
              disabled={!item.available}
              className={cn(
                "flex-none gap-1.5 px-3 text-label transition-[background-color,color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
                "data-active:bg-brand data-active:text-brand-foreground data-active:shadow-sm",
                "dark:data-active:bg-brand dark:data-active:text-brand-foreground",
              )}
            >
              <Icon aria-hidden="true" className="size-3.5" />
              {TAB_LABEL[item.key]}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

const focusRing = "focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none";

function PageHeader({ eapPrompt = false, actions }: { eapPrompt?: boolean; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
          aria-hidden="true"
        >
          <FolderKanban className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl leading-[1.25] font-semibold tracking-[-0.025em] text-foreground">Projetos</h1>
          <p className="mt-1 text-[11.5px] leading-snug text-muted-foreground">Situação, prazo e responsáveis de cada projeto da CTIN.</p>
        </div>
      </div>
      {actions}
      {eapPrompt ? (
        <p className="w-full max-w-xl rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-body text-primary">
          Selecione um projeto para abrir a Estrutura Analítica.
        </p>
      ) : null}
    </header>
  );
}

/**
 * Ordenações do menu "Ordenar", cada uma com a direção que responde à pergunta do PMO (mais urgentes, maior atraso,
 * menor progresso...) ou atualização mais recente.
 */
const SORT_OPTIONS: ReadonlyArray<{ id: string; sort: PortfolioSort; label: string }> = [
  { id: "urgency", sort: { key: "urgency", direction: "desc" }, label: "Mais urgentes" },
  { id: "delay", sort: { key: "delay", direction: "desc" }, label: "Maior atraso" },
  { id: "progress", sort: { key: "progress", direction: "asc" }, label: "Menor progresso" },
  { id: "name", sort: { key: "name", direction: "asc" }, label: "Nome (A–Z)" },
  { id: "deadline", sort: { key: "deadline", direction: "asc" }, label: "Previsão mais próxima" },
  { id: "updated", sort: { key: "updated", direction: "desc" }, label: "Atualizados recentemente" },
];

function sortPreset(sort: PortfolioSort) {
  return SORT_OPTIONS.find((option) => option.sort.key === sort.key && option.sort.direction === sort.direction) ?? null;
}

function sortText(sort: PortfolioSort) {
  const preset = sortPreset(sort);
  if (preset) return preset.label.toLowerCase();
  return `${SORT_LABEL[sort.key]} (${sort.direction === "asc" ? "crescente" : "decrescente"})`;
}

/** Rótulo de "N projetos atrasados" e similares. */
function count(value: number, one: string, many: string) {
  return `${value} ${value === 1 ? one : many}`;
}

/** Mesmos tons dos indicadores da Visão Geral. */
const INDICATOR_TONE = {
  primary: "bg-primary/12 text-primary ring-primary/25",
  purple: "bg-status-validation-soft text-status-validation-ink ring-status-validation/30",
  amber: "bg-warning/20 text-warning-foreground ring-warning/35",
  green: "bg-success/15 text-success-foreground ring-success/30",
} as const;

/** Foco do resumo: um dos quatro cartões indicadores (clique de novo limpa o filtro). */
type SummaryFocus = "active" | "needsAction" | "delayed" | "concluded";

/** Mesmo cartão da Visão Geral / EAP (`Card` + `OVERVIEW_CARD`), selecionável para filtrar a lista. */
function Indicator({
  icon: Icon,
  tone,
  label,
  selected,
  disabled,
  onSelect,
  children,
}: {
  icon: LucideIcon;
  tone: keyof typeof INDICATOR_TONE;
  label: string;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={selected}
      aria-disabled={disabled || undefined}
      aria-label={`${label}${selected ? ", filtro ativo" : ""}`}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        OVERVIEW_CARD,
        "min-h-[104px] flex-row items-center gap-3.5 px-4 py-4 outline-none transition-[border-color,background-color,box-shadow] duration-200 ease-out motion-reduce:transition-none",
        !disabled && "cursor-pointer hover:border-primary/35 hover:bg-muted/20 focus-visible:ring-2 focus-visible:ring-primary/25",
        disabled && "pointer-events-none opacity-50",
        selected && "border-primary/45 bg-primary/[0.04] ring-1 ring-primary/25",
      )}
    >
      <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset", INDICATOR_TONE[tone])} aria-hidden="true">
        <Icon className="size-5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {children}
      </div>
    </Card>
  );
}

/**
 * Resumo do portfólio no padrão dos indicadores da Visão Geral. Cada cartão filtra a lista; clicar de novo remove o filtro.
 */
function PortfolioHealth({
  chips,
  health,
  maxDelayDays,
  focus,
  onFocus,
}: {
  chips: ReadonlyArray<{ key: string; label: string; value: number }>;
  health: ReturnType<typeof portfolioHealth>;
  maxDelayDays: number;
  focus: SummaryFocus | null;
  onFocus: (next: SummaryFocus) => void;
}) {
  const total = chips.find((chip) => chip.key === "total")?.value ?? 0;
  const critical = chips.find((chip) => chip.key === "CRITICO")?.value ?? 0;
  const attention = chips.find((chip) => chip.key === "EM_ATENCAO")?.value ?? 0;
  const activeShare = total > 0 ? Math.round((health.active / total) * 100) : 0;

  return (
    <section aria-label="Resumo do portfólio" className="@container">
      <div className="grid gap-3 sm:grid-cols-2 @[66rem]:grid-cols-4">
        <Indicator icon={ListChecks} tone="primary" label="Projetos ativos" selected={focus === "active"} disabled={health.active === 0} onSelect={() => onFocus("active")}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-bold text-foreground tabular-nums dark:text-foreground">{health.active}</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{health.total} no total</span>
          </div>
          <Progress value={activeShare} aria-hidden="true" className="mt-1 **:data-[slot=progress-track]:h-1.5" />
          <p className="text-xs text-muted-foreground">{activeShare}% do portfólio acessível</p>
        </Indicator>

        <Indicator
          icon={AlertCircle}
          tone="purple"
          label="Precisam de ação"
          selected={focus === "needsAction"}
          disabled={health.needsAction === 0}
          onSelect={() => onFocus("needsAction")}
        >
          {health.needsAction > 0 ? (
            <>
              <p className="text-[15px] font-bold text-foreground tabular-nums dark:text-foreground">{health.needsAction}</p>
              <div className="flex flex-wrap gap-1.5">
                {critical > 0 ? (
                  <span className="rounded-full bg-status-critical-soft px-2 py-0.5 text-[10px] font-medium text-status-critical-ink">
                    {count(critical, "crítico", "críticos")}
                  </span>
                ) : null}
                {attention > 0 ? (
                  <span className="rounded-full bg-status-attention-soft px-2 py-0.5 text-[10px] font-medium text-status-attention-ink">
                    {count(attention, "em atenção", "em atenção")}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-[15px] font-bold text-muted-foreground">Nenhum</p>
          )}
        </Indicator>

        <Indicator icon={CalendarDays} tone="amber" label="Em atraso" selected={focus === "delayed"} disabled={health.delayed === 0} onSelect={() => onFocus("delayed")}>
          <p className="text-[15px] font-bold text-foreground tabular-nums dark:text-foreground">{health.delayed}</p>
          {maxDelayDays > 0 ? (
            <p className="text-xs text-muted-foreground">
              Maior atraso: {maxDelayDays} {maxDelayDays === 1 ? "dia" : "dias"}
              {health.averageDelay !== null ? ` · média ${health.averageDelay} d` : ""}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum projeto ativo atrasado</p>
          )}
        </Indicator>

        <Indicator icon={Check} tone="green" label="Concluídos" selected={focus === "concluded"} disabled={health.concluded === 0} onSelect={() => onFocus("concluded")}>
          <p className="text-[15px] font-bold text-foreground tabular-nums dark:text-foreground">{health.concluded}</p>
          <p className="text-xs text-muted-foreground">
            {health.concluded === 0 ? "Nenhum projeto concluído" : `${statusShare(health.concluded, total)}% do portfólio`}
          </p>
        </Indicator>
      </div>
    </section>
  );
}

/** Etiquetas dos filtros em uso, cada uma com o botão de remover (a situação vem dos cartões do topo). */
function ActiveFilters({ tags }: { tags: ReadonlyArray<{ key: string; text: string; onRemove: () => void }> }) {
  if (tags.length === 0) return null;
  return (
    <ul aria-label="Filtros ativos" className="flex flex-wrap items-center gap-2">
      {tags.map((tag) => (
        <li key={tag.key} className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/25 bg-primary/10 py-0.5 pr-1 pl-2.5 text-label text-primary">
          <span className="truncate">{tag.text}</span>
          <button
            type="button"
            onClick={tag.onRemove}
            aria-label={`Remover filtro: ${tag.text}`}
            className={cn("flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-primary/15", focusRing)}
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ProjectList({
  projects,
  eapPrompt = false,
  viewerRole = "",
}: {
  projects: ProjectListRow[];
  eapPrompt?: boolean;
  /** Perfil global de quem consulta, para liberar a edição do cadastro. */
  viewerRole?: string;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [view, setView] = useState<PortfolioView>("active");
  const [summaryFocus, setSummaryFocus] = useState<SummaryFocus | null>(null);
  const [filters, setFilters] = useState<PortfolioFilters>(idlePortfolioFilters);
  const [sort, setSort] = useState<PortfolioSort>({ key: "urgency", direction: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const chips = useMemo(() => statusChips(projects), [projects]);
  const statusLabel = useMemo(() => new Map(chips.map((chip) => [chip.key, chip.label])), [chips]);
  const unavailable = useMemo(() => unavailableSituations(projects), [projects]);
  const health = useMemo(() => portfolioHealth(projects), [projects]);
  const maxDelayDays = useMemo(
    () => projects.reduce((max, row) => Math.max(max, row.situation?.delayDays ?? 0), 0),
    [projects],
  );
  const counts = useMemo(() => viewCounts(projects), [projects]);
  const options = useMemo(() => filterOptions(projects), [projects]);
  const visible = useMemo(() => {
    let rows = filterPortfolio(projects, filters, view);
    if (summaryFocus === "needsAction") {
      rows = rows.filter((row) => isPortfolioNeedsAction(row));
    } else if (summaryFocus === "delayed") {
      rows = rows.filter((row) => isPortfolioDelayed(row));
    }
    return sortPortfolio(rows, sort);
  }, [projects, filters, view, sort, summaryFocus]);
  const paged = paginate(visible, page, pageSize);
  const filtering = isFiltering(filters) || summaryFocus !== null;
  const firstShown = visible.length === 0 ? 0 : (paged.current - 1) * pageSize + 1;
  // Chave da lista: muda com visualização, filtros (exceto a digitação da busca), ordenação e página, e reinicia o fade.
  const listKey = [view, summaryFocus, filters.status, filters.company, filters.owner, sort.key, sort.direction, paged.current, pageSize].join("|");

  const SUMMARY_FILTER_LABEL: Record<SummaryFocus, string> = {
    active: "Projetos ativos",
    needsAction: "Precisam de ação",
    delayed: "Em atraso",
    concluded: "Concluídos",
  };

  function updateFilters(next: Partial<PortfolioFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  function changeView(next: PortfolioView) {
    setView(next);
    setSummaryFocus(null);
    setPage(1);
    if (next === "concluded") {
      setFilters((current) => ({ ...current, status: "" }));
    }
  }

  /** Cartão do resumo: aplica o filtro correspondente; clicar de novo remove o foco. */
  function toggleSummaryFocus(next: SummaryFocus) {
    const clearing = summaryFocus === next;
    setSummaryFocus(clearing ? null : next);
    if (!clearing) {
      setView(next === "concluded" ? "concluded" : "active");
      setFilters((current) => ({ ...current, status: "" }));
    }
    setPage(1);
  }

  /** Baixa a lista exibida (visualização, filtros e ordenação atuais) em CSV para o Excel. */
  function exportList() {
    const csv = portfolioCsv(visible, { status: projectStatusLabel, progress: formatBasis });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `projetos-${new Date().toLocaleDateString("sv-SE")}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function changeSort(next: PortfolioSort) {
    setSort(next);
    setPage(1);
  }

  function toggleSort(key: PortfolioSort["key"]) {
    setSort((current) =>
      current.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: key === "name" ? "asc" : "desc" },
    );
  }

  function open(projectId: string, target?: "eap" | "cronograma") {
    setOpeningId(projectId);
    const href =
      target === "eap" ? `/projetos/${projectId}?aba=eap` : target === "cronograma" ? `/projetos/${projectId}#cronograma` : `/projetos/${projectId}`;
    startNavigation(() => router.push(href));
  }

  return (
    <div className={PAGE}>
      <PageHeader
        eapPrompt={eapPrompt}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value="list">
              <TabsList aria-label="Modo de exibição" className="h-10">
                <TabsTrigger value="list" className="gap-1.5 px-3 text-label">
                  <List aria-hidden="true" />
                  Lista
                </TabsTrigger>
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex h-full" />}>
                    <TabsTrigger value="board" disabled aria-label="Quadro (em breve)" className="gap-1.5 px-3 text-label">
                      <LayoutGrid aria-hidden="true" />
                      Quadro
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Quadro · em breve</TooltipContent>
                </Tooltip>
              </TabsList>
            </Tabs>
            <Button type="button" variant="outline" className="h-10" onClick={exportList} disabled={visible.length === 0} title="Baixar a lista exibida em planilha (CSV)">
              <Download aria-hidden="true" />
              Exportar
            </Button>
            {/* Cadastro de projeto ainda não implementado: o botão fica visível, sem ação. */}
            <Button type="button" className="h-10" title="Cadastro de projeto em breve">
              <Plus aria-hidden="true" />
              Novo projeto
            </Button>
          </div>
        }
      />

      <PortfolioHealth chips={chips} health={health} maxDelayDays={maxDelayDays} focus={summaryFocus} onFocus={toggleSummaryFocus} />
      {unavailable > 0 ? (
        <p className="-mt-2 text-label text-muted-foreground">
          {unavailable === 1
            ? "1 projeto sem situação calculada (consulta indisponível) não entra nos indicadores por situação."
            : `${unavailable} projetos sem situação calculada (consulta indisponível) não entram nos indicadores por situação.`}
        </p>
      ) : null}

      <section aria-label="Lista de projetos" className={cn(CARD, "@container min-w-0 overflow-hidden rounded-2xl shadow-[0_1px_3px_rgba(16,24,40,0.05)]")}>
        <div className="flex flex-wrap items-center gap-2.5 px-5 py-4 @min-[980px]:flex-nowrap">
          {/* A rolagem horizontal (só em telas estreitas) fica no contêiner, com a barra oculta; a lista de abas nunca rola. */}
          <ViewTabs value={view} onChange={changeView} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5 @min-[980px]:flex-nowrap">
            {options.statuses.length > 0 ? (
              <div className="w-full min-w-[12.5rem] sm:w-[13rem] @min-[980px]:w-[13rem] @min-[980px]:shrink-0">
                <FilterSelect
                  label="Situação"
                  value={filters.status}
                  onChange={(status) => updateFilters({ status: status as ProjectStatus | "" })}
                  options={options.statuses.map((status) => ({ value: status, label: projectStatusLabel(status) }))}
                />
              </div>
            ) : null}
            {options.companies.length > 0 ? (
              <div className="w-full min-w-[14rem] flex-1 basis-[14rem] @min-[980px]:min-w-[16rem]">
                <FilterSelect
                  label="Empresa"
                  value={filters.company}
                  onChange={(company) => updateFilters({ company })}
                  options={options.companies.map((name) => ({ value: name, label: name }))}
                />
              </div>
            ) : null}
            {options.owners.length > 0 ? (
              <div className="w-full min-w-[14rem] flex-1 basis-[14rem] @min-[980px]:min-w-[16rem]">
                <FilterSelect
                  label="Gestor"
                  value={filters.owner}
                  onChange={(owner) => updateFilters({ owner })}
                  options={options.owners.map((name) => ({ value: name, label: name }))}
                />
              </div>
            ) : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="outline" className="h-10 shrink-0 text-label" title={`Ordenado por ${sortText(sort)}`} />}>
              <ArrowUpDown aria-hidden="true" />
              Ordenar
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-lg p-1.5">
              {SORT_OPTIONS.map((option) => {
                const selected = sortPreset(sort)?.id === option.id;
                return (
                  <DropdownMenuItem key={option.id} className={menuItem} onClick={() => changeSort(option.sort)}>
                    {option.label}
                    {selected ? <Check className="ml-auto size-3.5 text-primary" aria-hidden="true" /> : null}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex min-h-11 flex-wrap items-center gap-2 border-t border-border/70 bg-muted/35 px-5 py-2 text-label text-muted-foreground">
          {filtering ? <span>Filtros:</span> : null}
          <ActiveFilters
            tags={[
              ...(summaryFocus
                ? [{ key: "summary", text: SUMMARY_FILTER_LABEL[summaryFocus], onRemove: () => setSummaryFocus(null) }]
                : []),
              ...(filters.status ? [{ key: "status", text: statusLabel.get(filters.status) ?? filters.status, onRemove: () => updateFilters({ status: "" }) }] : []),
              ...(filters.company ? [{ key: "company", text: `Empresa: ${filters.company}`, onRemove: () => updateFilters({ company: "" }) }] : []),
              ...(filters.owner ? [{ key: "owner", text: `Gestor: ${filters.owner}`, onRemove: () => updateFilters({ owner: "" }) }] : []),
            ]}
          />
          <span aria-live="polite">
            {visible.length} de {counts[view]} {counts[view] === 1 ? "projeto" : "projetos"} · ordenados por {sortText(sort)}
          </span>
          {filtering ? (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="ml-auto text-primary hover:text-primary"
              onClick={() => {
                setSummaryFocus(null);
                updateFilters(idlePortfolioFilters);
              }}
            >
              Limpar filtros
            </Button>
          ) : null}
        </div>

        {projects.length === 0 || visible.length === 0 ? (
          <div className="motion-fade px-5 pt-1 pb-5">
            <ProjectEmpty
              title={projects.length === 0 ? "Nenhum projeto disponível" : "Nenhum projeto encontrado"}
              description={
                projects.length === 0
                  ? "A consulta não retornou projetos para o seu acesso."
                  : `Os filtros não encontraram projetos em ${TAB_LABEL[view]}.`
              }
              action={
                filtering ? (
                  <Button variant="outline" onClick={() => updateFilters(idlePortfolioFilters)}>
                    Limpar filtros
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="relative w-full min-w-0 overflow-x-auto border-t border-border/70">
            <table className={cn("w-full text-left", view === "archived" ? "min-w-[1120px]" : "min-w-[1000px]")}>
              <thead className="bg-card text-label font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                <tr className="border-b border-border/70">
                  <SortHeader label="Projeto" sortKey="name" sort={sort} onSort={toggleSort} className="pl-5" />
                  <th scope="col" className="px-2.5 py-3">Empresa</th>
                  <th scope="col" className="px-2.5 py-3">Equipe</th>
                  <th scope="col" className="px-2.5 py-3">Situação</th>
                  <th scope="col" className="px-2.5 py-3">Progresso</th>
                  <SortHeader label="Prazo" sortKey="urgency" sort={sort} onSort={toggleSort} />
                  {view === "archived" ? <th scope="col" className="px-2.5 py-3">Arquivado em</th> : null}
                  <SortHeader label="Última atualização" sortKey="updated" sort={sort} onSort={toggleSort} />
                  <th scope="col" className="w-11 px-2.5 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody key={listKey} className="motion-fade">
                {paged.items.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    view={view}
                    opening={navigating && openingId === project.id}
                    canEdit={canEditProject(viewerRole, project) && !project.archivedAt}
                    canArchive={canArchiveProject(viewerRole, project)}
                    focus={summaryFocus}
                    onOpen={(target) => open(project.id, target)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visible.length > 0 ? (
          <nav aria-label="Paginação dos projetos" className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/20 px-5 py-3.5 text-label text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-36">
                <OptionCombobox
                  label="Projetos por página"
                  value={String(pageSize)}
                  onChange={(next) => {
                    setPageSize(Number(next) || 10);
                    setPage(1);
                  }}
                  options={PAGE_SIZES.map((size) => ({ value: size, label: `${size} por página` }))}
                />
              </div>
              <span>
                Exibindo {firstShown}–{firstShown + paged.items.length - 1} de {visible.length} {visible.length === 1 ? "projeto" : "projetos"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button type="button" variant="outline" size="sm" disabled={paged.current === 1} onClick={() => setPage(paged.current - 1)}>
                <ChevronLeft aria-hidden="true" />
                Anterior
              </Button>
              {Array.from({ length: paged.pages }, (_, index) => index + 1).map((number) => (
                <Button
                  key={number}
                  type="button"
                  variant={number === paged.current ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label={`Página ${number}`}
                  aria-current={number === paged.current ? "page" : undefined}
                  onClick={() => setPage(number)}
                  className={number === paged.current ? "text-primary" : "text-muted-foreground"}
                >
                  {number}
                </Button>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={paged.current === paged.pages} onClick={() => setPage(paged.current + 1)}>
                Próxima
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

/** Próxima entrega e atualização, movidas da tabela para o tooltip do nome do projeto. */
function detailsText(project: ProjectListRow) {
  let delivery: string;
  if (!project.nextDeliveryAvailable) {
    delivery = "Próxima entrega: indisponível";
  } else if (project.status === "SUSPENSO") {
    delivery = "Projeto suspenso · execução paralisada";
  } else if (project.nextDelivery) {
    const next = project.nextDelivery;
    delivery = `Próxima entrega: ${next.title} · ${dateText(next.plannedAt)}${next.overdue ? " · atrasada" : ""}${next.corrections ? " · correções necessárias" : ""}`;
  } else if (project.awaitingValidation) {
    delivery = `Marco entregue aguardando homologação: ${project.awaitingValidation.title} · ${dateText(project.awaitingValidation.plannedAt)}`;
  } else {
    delivery = "Sem entregas pendentes";
  }
  return { delivery };
}

function ProjectRow({
  project,
  view,
  opening,
  canEdit,
  canArchive,
  focus,
  onOpen,
}: {
  project: ProjectListRow;
  view: PortfolioView;
  opening: boolean;
  canEdit: boolean;
  canArchive: boolean;
  /** Quando um cartão do resumo filtra a lista, mostra o motivo da classificação. */
  focus: SummaryFocus | null;
  onOpen: (target?: "eap" | "cronograma") => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [unarchiveOpen, setUnarchiveOpen] = useState(false);
  const [justificationOpen, setJustificationOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const archived = Boolean(project.archivedAt);
  const showArchivedAt = view === "archived";

  async function confirmUnarchive() {
    if (archiveBusy) {
      return;
    }
    setArchiveBusy(true);
    try {
      const response = await unarchiveProject(project.id);
      if (response.status !== 204) {
        throw new ApiError(response.status, "HTTP_ERROR", "Não foi possível restaurar o projeto.");
      }
      notifySuccess("Projeto restaurado.");
      setUnarchiveOpen(false);
      router.refresh();
    } catch (caught) {
      reportFailure(caught, "Não foi possível restaurar o projeto.");
    } finally {
      setArchiveBusy(false);
    }
  }

  // A linha inteira abre a Visão Geral; o nome é o link acessível por teclado e o menu tem ações próprias.
  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    // Cliques no diálogo de edição (renderizado fora da tabela) também chegam aqui pela árvore do React.
    if (!event.currentTarget.contains(event.target as Node) || (event.target as HTMLElement).closest("a, button, [role=menu]")) {
      return;
    }
    onOpen();
  }
  const attention = !archived && (project.status === "EM_ATENCAO" || project.status === "CRITICO");
  const details = detailsText(project);
  const focusReasons =
    archived || !focus
      ? []
      : focus === "needsAction"
        ? portfolioNeedsActionReasons(project)
        : focus === "delayed"
          ? portfolioDelayedReasons(project)
          : [];

  return (
    <tr
      onClick={handleClick}
      className={cn(
        "group/row cursor-pointer border-b align-middle text-body transition-colors duration-200 ease-out last:border-b-0 motion-reduce:transition-none",
        archived
          ? "border-border/40 bg-muted/25 hover:bg-muted/40"
          : "border-border/50 hover:bg-primary/[0.04]",
        opening && (archived ? "bg-muted/45" : "bg-primary/5"),
      )}
    >
      <td
        className="min-w-[12rem] py-4 pr-3 pl-5"
        style={attention && project.status ? { boxShadow: `inset 3px 0 0 ${STATUS_COLOR[project.status]}` } : undefined}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                href={`/projetos/${project.id}`}
                className={cn(
                  "block text-[13.5px] leading-snug font-semibold transition-colors focus-visible:rounded-sm",
                  archived ? "text-foreground/85 hover:text-foreground" : "text-foreground hover:text-primary",
                  focusRing,
                )}
              />
            }
          >
            {project.name}
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="flex-col items-start gap-0.5">
            <span>{details.delivery}</span>
          </TooltipContent>
        </Tooltip>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-label text-muted-foreground">
          {opening ? <Spinner className="size-3" /> : null}
          {project.glpiTicketId ? `GLPI #${project.glpiTicketId}` : `ID ${project.id.slice(0, 8)}`}
          {archived && view === "all" ? (
            <span className="rounded-md border border-border/70 bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Arquivado
            </span>
          ) : null}
          {attention ? <span className="sr-only">Exige atenção.</span> : null}
        </span>
        {focusReasons.length > 0 ? (
          <span className="mt-1.5 flex flex-wrap gap-1" aria-label="Motivo do indicador">
            {focusReasons.map((reason) => (
              <span key={reason} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {reason}
              </span>
            ))}
          </span>
        ) : null}
      </td>
      <td className="w-36 max-w-44 min-w-[8rem] px-2.5 py-4">
        <CompanyCell project={project} muted={archived} />
      </td>
      <td className="w-32 px-2.5 py-4">
        <ManagerTeamCell project={project} muted={archived} />
      </td>
      <td className="px-2.5 py-4">
        {project.status === null || project.situation === null ? (
          <Muted value={null} />
        ) : (
          <span className="flex flex-col items-start gap-1">
            <EapStatusBadge
              kind={projectStatusKind(project.status)}
              label={projectStatusLabel(project.status)}
              title={
                archived
                  ? `Situação histórica no arquivamento. Situação registrada no cadastro: ${projectStatusLabel(project.registeredStatus)}.`
                  : `Situação calculada pela EAP. Situação registrada no cadastro: ${projectStatusLabel(project.registeredStatus)}.`
              }
              className={cn(
                "px-2 py-[3px] text-label whitespace-nowrap",
                (archived || project.status === "SUSPENSO") && "border-border/60 bg-muted text-muted-foreground",
              )}
            />
            {archived ? (
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">No arquivamento</span>
            ) : null}
            {!archived && project.situation.readyForClosure ? (
              <span className="flex items-center gap-1.5 text-label font-medium text-success-foreground" title="Todas as fases concluídas; o encerramento depende de decisão formal">
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                Apto para encerramento
              </span>
            ) : null}
            {!archived && project.situation.closureRequirementsMissing ? (
              <span className="text-label text-muted-foreground" title="Encerramento registrado, mas há fases não concluídas">Encerramento pendente</span>
            ) : null}
          </span>
        )}
      </td>
      <td className="min-w-[8.5rem] px-2.5 py-4">
        {!project.progressAvailable ? (
          <Muted value={null} />
        ) : project.eapEmpty ? (
          <span className="text-label text-muted-foreground">EAP sem itens cadastrados</span>
        ) : project.progressBasisPoints === null ? (
          <span className="text-label text-muted-foreground" title="Sem fases com andamento calculável">Sem andamento</span>
        ) : (
          <span className="flex items-center gap-2.5">
            <Progress
              value={basisToPercent(project.progressBasisPoints)}
              aria-label={`Andamento de ${project.name}`}
              className={cn(
                "w-20 [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-muted",
                archived
                  ? "[&_[data-slot=progress-indicator]]:bg-muted-foreground/55"
                  : "[&_[data-slot=progress-indicator]]:bg-primary",
              )}
            />
            <span className={cn("text-label tabular-nums", archived ? "font-medium text-muted-foreground" : "font-semibold text-foreground")}>
              {formatBasis(project.progressBasisPoints)}%
            </span>
          </span>
        )}
      </td>
      <td className="px-2.5 py-4 whitespace-nowrap">
        <DeadlineCell project={project} historical={archived} />
      </td>
      {showArchivedAt ? (
        <td className="px-2.5 py-4 whitespace-nowrap">
          <ArchivedAtCell value={project.archivedAt} />
        </td>
      ) : null}
      <td className="px-2.5 py-4 whitespace-nowrap">
        <UpdatedCell project={project} muted={archived} />
      </td>
      <td className="px-2.5 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground transition-colors group-hover/row:text-foreground" aria-label={`Ações de ${project.name}`} />}
          >
            <EllipsisVertical aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-lg p-1.5">
            <DropdownMenuItem className={menuItem} onClick={() => onOpen()}>
              <LayoutDashboard aria-hidden="true" />
              Abrir visão geral
            </DropdownMenuItem>
            <DropdownMenuItem className={menuItem} onClick={() => onOpen("cronograma")}>
              <CalendarDays aria-hidden="true" />
              Consultar cronograma
            </DropdownMenuItem>
            <DropdownMenuItem className={menuItem} onClick={() => onOpen("eap")}>
              <Network aria-hidden="true" />
              Abrir EAP
            </DropdownMenuItem>
            {canEdit ? (
              <DropdownMenuItem className={menuItem} onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Editar projeto
              </DropdownMenuItem>
            ) : null}
            {archived ? (
              <>
                <DropdownMenuSeparator className="my-1.5" />
                <DropdownMenuItem className={menuItem} onClick={() => setJustificationOpen(true)}>
                  <FileText aria-hidden="true" />
                  Ver justificativa
                </DropdownMenuItem>
              </>
            ) : null}
            {canArchive ? (
              <>
                <DropdownMenuSeparator className="my-1.5" />
                <DropdownMenuItem
                  className={menuItem}
                  onClick={() => (archived ? setUnarchiveOpen(true) : setArchiveOpen(true))}
                >
                  <Archive aria-hidden="true" />
                  {archived ? "Restaurar projeto" : "Arquivar projeto"}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        {canEdit ? <ProjectEditDialog project={project} open={editing} onOpenChange={setEditing} /> : null}
        {canArchive && !archived ? (
          <ArchiveProjectDialog project={project} open={archiveOpen} onOpenChange={setArchiveOpen} />
        ) : null}
        {archived ? (
          <ArchiveJustificationDialog
            project={{
              name: project.name,
              archivedAt: project.archivedAt,
              archivedByName: project.archivedByUser?.name ?? null,
              archivedByRole: project.archivedByUser?.role ?? null,
              archiveReason: project.archiveReason,
              archiveJustification: project.archiveJustification,
              archiveOtherDescription: project.archiveOtherDescription,
            }}
            open={justificationOpen}
            onOpenChange={setJustificationOpen}
          />
        ) : null}
        {canArchive && archived ? (
          <AlertDialog
            open={unarchiveOpen}
            onOpenChange={(next) => {
              if (!next && !archiveBusy) {
                setUnarchiveOpen(false);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogMedia className="bg-primary/12 text-primary">
                  <Archive />
                </AlertDialogMedia>
                <AlertDialogTitle>Restaurar o projeto?</AlertDialogTitle>
                <AlertDialogDescription>
                  O projeto volta às abas Ativos ou Concluídos com a aparência normal, conforme a situação. EAP, datas,
                  evidências e a justificativa de arquivamento permanecem intactos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={archiveBusy}>Cancelar</AlertDialogCancel>
                <Button type="button" className="h-10" loading={archiveBusy} onClick={() => void confirmUnarchive()}>
                  {archiveBusy ? "Restaurando…" : "Restaurar projeto"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </td>
    </tr>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: PortfolioSort["key"];
  sort: PortfolioSort;
  onSort: (key: PortfolioSort["key"]) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className={cn("px-2.5 py-2.5", className)}>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => onSort(sortKey)}
        className={cn("-ml-2 h-auto px-2 py-1 text-left text-label leading-tight tracking-[0.06em] whitespace-normal uppercase hover:text-foreground", active ? "text-primary" : "text-muted-foreground")}
      >
        {label}
        <Icon className={cn("size-3", !active && "opacity-60")} aria-hidden="true" />
      </Button>
    </th>
  );
}

/** Filtro com o Combobox do shadcn: digitar filtra as opções; vazio ("") significa todos. */
function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <OptionCombobox
      label={`Filtrar por ${label.toLowerCase()}`}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={`${label}: todos`}
      clearable
    />
  );
}

/**
 * Prazo numa coluna só: o atraso (ou risco / no prazo) em destaque e, abaixo, a previsão de término ou o aviso de que ela
 * não foi cadastrada. O início previsto fica no título. Em arquivados, só o registro histórico — sem cobrança operacional.
 */
function DeadlineCell({ project, historical = false }: { project: ProjectListRow; historical?: boolean }) {
  if (historical) {
    return (
      <span
        className="flex flex-col items-start gap-1"
        title={project.plannedStartAt ? `Início previsto no arquivamento: ${dateText(project.plannedStartAt)}` : "Início previsto não definido"}
      >
        <span className="text-body font-medium text-muted-foreground">Prazo vigente</span>
        {project.plannedEndAt ? (
          <span className="text-label text-muted-foreground">{dateText(project.plannedEndAt)}</span>
        ) : (
          <span className="text-label text-muted-foreground">Não definido</span>
        )}
      </span>
    );
  }
  const delay = delayCell(project);
  const headline =
    delay.kind === "delay" ? `${delay.text} de atraso` : delay.kind === "risk" ? "Risco de atraso" : delay.text;
  return (
    <span className="flex flex-col items-start gap-1" title={project.plannedStartAt ? `Início previsto: ${dateText(project.plannedStartAt)}` : "Início previsto não definido"}>
      <span
        className={cn(
          "text-body",
          delay.kind === "delay" && "font-semibold text-destructive",
          delay.kind === "risk" && "font-semibold text-warning-foreground",
          delay.kind === "ontime" && "font-medium text-foreground",
          delay.kind === "unavailable" && "text-label text-muted-foreground",
        )}
      >
        {headline}
      </span>
      {project.plannedEndAt ? (
        <span className="text-label text-muted-foreground">Previsão {dateText(project.plannedEndAt)}</span>
      ) : (
        <span className="text-label text-muted-foreground">Previsão não definida</span>
      )}
    </span>
  );
}

/** Data e hora exatas (fuso de Belém, como no restante do sistema), para a informação complementar. */
const MOMENT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Belem",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const ARCHIVE_TIME = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Belem",
  hour: "2-digit",
  minute: "2-digit",
});

/** Data/hora do arquivamento — distinta da última atualização do acompanhamento. */
function ArchivedAtCell({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-label text-muted-foreground">—</span>;
  }
  const at = new Date(value);
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex w-fit flex-col items-start gap-1" />}>
        <span className="text-body font-medium text-muted-foreground">{dateText(value)}</span>
        <span className="text-label text-muted-foreground">{ARCHIVE_TIME.format(at)}</span>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="flex-col items-start gap-0.5">
        <span className="font-semibold">Arquivado em</span>
        <span>{MOMENT.format(at).replace(", ", " às ")}</span>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Empresa do projeto: o nome institucional da ficha ou, sem ele, os fornecedores participantes. Até duas linhas, com o
 * nome completo e a origem no título.
 */
function CompanyCell({ project, muted = false }: { project: ProjectListRow; muted?: boolean }) {
  if (project.companies === null) {
    return <Muted value={null} />;
  }
  if (project.companies.length === 0) {
    return <span className="text-label text-muted-foreground">Não informada</span>;
  }
  const names = project.companies.join(", ");
  const origin =
    project.companySource === "profile"
      ? "Empresa responsável cadastrada na ficha do projeto."
      : "Fornecedor participante do projeto (a ficha ainda não tem a empresa responsável).";
  return (
    <span
      className={cn("line-clamp-2 text-body break-words", muted ? "text-muted-foreground" : "text-foreground")}
      title={`${names}\n${origin}`}
    >
      {names}
    </span>
  );
}

/**
 * Equipe em avatares sobrepostos, com o gestor primeiro e marcado por um anel na cor da paleta (sem gestor vinculado, o
 * dono do projeto). Até 4 avatares e "+N"; o tooltip lista todos com os papéis. Em arquivados, avatares neutros.
 */
function ManagerTeamCell({ project, muted = false }: { project: ProjectListRow; muted?: boolean }) {
  if (project.team === null && project.ownerName === null) {
    return <Muted value={null} />;
  }
  const team = project.team ?? [];
  const manager = team.find((person) => person.roles.includes("GESTOR"));
  const lead =
    manager ?? team.find((person) => person.id === project.ownerId) ?? (project.ownerName ? { id: project.ownerId, name: project.ownerName, roles: ["DONO_PROJETO"] } : team[0]);
  if (!lead) {
    return <span className="text-body text-muted-foreground" aria-label="Sem participantes cadastrados">—</span>;
  }
  const leadRole = manager ? "Gestor" : (TEAM_ROLE_LABEL[lead.roles[0]] ?? lead.roles[0]);
  const { visible, extra } = teamPreview(team.filter((person) => person.id !== lead.id), 3);
  const people = team.length > 0 ? team : [lead];
  const avatar = "flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-card";
  const mutedAvatar = "bg-muted text-muted-foreground";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={`/projetos/${project.id}`}
            aria-label={`${leadRole}: ${lead.name}. Equipe de ${project.name}: ${people.length} ${people.length === 1 ? "participante" : "participantes"}.`}
            className={cn("flex w-fit items-center -space-x-1.5 rounded-full", focusRing)}
          />
        }
      >
        <span
          className={cn(
            avatar,
            "relative z-10",
            muted ? cn(mutedAvatar, "ring-border/70") : cn("ring-primary/60", AVATAR_PALETTE[avatarColorIndex(lead.id, AVATAR_PALETTE.length)]),
          )}
        >
          {ownerInitials(lead.name)}
        </span>
        {visible.map((person) => (
          <span
            key={person.id}
            className={cn(avatar, muted ? mutedAvatar : AVATAR_PALETTE[avatarColorIndex(person.id, AVATAR_PALETTE.length)])}
          >
            {ownerInitials(person.name)}
          </span>
        ))}
        {extra > 0 ? <span className={cn(avatar, "bg-muted text-muted-foreground")}>+{extra}</span> : null}
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="flex-col items-start gap-1">
        <span className="font-semibold">
          {leadRole}: {lead.name}
        </span>
        {people
          .filter((person) => person.id !== lead.id)
          .map((person) => (
            <span key={person.id}>
              <span className="font-medium">{person.name}</span>
              <span className="opacity-80"> · {person.roles.map((role) => TEAM_ROLE_LABEL[role] ?? role).join(", ")}</span>
            </span>
          ))}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Última atualização = última movimentação real do acompanhamento (situação, conclusão, impedimento, entrega, homologação,
 * reprogramação, planejamento), nunca acessos ou visualizações. Rótulo relativo em destaque e a data exata abaixo; o tooltip traz
 * data e hora. O texto relativo depende do relógio de quem consulta, por isso pode diferir do servidor perto da virada do dia.
 */
function UpdatedCell({ project, muted = false }: { project: ProjectListRow; muted?: boolean }) {
  if (!project.movementAvailable) {
    return <Muted value={null} />;
  }
  if (project.lastMovementAt === null) {
    return (
      <span className="text-label text-muted-foreground" title="Nenhuma movimentação relevante registrada no acompanhamento do projeto.">
        Sem movimentação
      </span>
    );
  }
  const at = project.lastMovementAt;
  const label = updatedLabel(at);
  if (label.days === null) {
    return <Muted value={null} />;
  }
  const stale = !muted && label.days > PORTFOLIO_FOLLOW_UP_DAYS;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex w-fit flex-col items-start gap-1" />}>
        <span
          suppressHydrationWarning
          className={cn(
            "text-body font-medium",
            muted ? "text-muted-foreground" : stale ? "text-warning-foreground" : "text-foreground",
          )}
        >
          {label.text}
        </span>
        <span className="text-label text-muted-foreground">{dateText(at)}</span>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="flex-col items-start gap-0.5">
        <span className="font-semibold">Última movimentação do projeto</span>
        <span>{MOMENT.format(new Date(at)).replace(", ", " às ")}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function Muted({ value }: { value: string | null }) {
  return value === null ? (
    <span className="text-label text-muted-foreground" title="Não foi possível consultar este dado">Indisponível</span>
  ) : (
    <span className="text-body whitespace-nowrap text-foreground">{value}</span>
  );
}

function dateText(value: string) {
  return formatCivilDate(civilDateInput(value));
}

/** Falha ao carregar o portfólio: cabeçalho preservado + padrão compartilhado de erro de carga. */
export function ProjectListError({ message }: { message: string }) {
  return (
    <div className={PAGE}>
      <PageHeader />
      <PageLoadError title="Não foi possível carregar os projetos" message={message} />
    </div>
  );
}

function ProjectEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Empty className={cn(CARD, "border bg-card py-12 shadow-[0_1px_3px_rgba(16,24,40,0.05)]")}>
      <EmptyHeader className="max-w-md gap-3">
        <EmptyMedia variant="icon" className="mb-0 size-12 rounded-xl bg-primary/10 text-primary [&_svg]:size-5">
          <FolderKanban />
        </EmptyMedia>
        <EmptyTitle className="text-card-title">{title}</EmptyTitle>
        <EmptyDescription className="text-body">{description}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  );
}
