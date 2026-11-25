"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Archive,
  CalendarDays,
  Download,
  FolderKanban,
  LayoutDashboard,
  LayoutGrid,
  List,
  Network,
  Pencil,
  EllipsisVertical,
  ChevronLeft,
  ChevronRight,
  Check,
  TriangleAlert,
  Search,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type MouseEvent, type ReactNode } from "react";

import { OptionCombobox } from "@/components/option-combobox";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { formatCivilDate } from "./eap-date-field";
import { civilDateInput } from "./eap-present";
import { basisToPercent, formatBasis } from "./eap-progress";
import { EapStatusBadge } from "./eap-status-badge";
import { ProjectEditDialog } from "./project-edit-dialog";
import {
  avatarColorIndex,
  canEditProject,
  delayCell,
  filterOptions,
  filterPortfolio,
  idlePortfolioFilters,
  isFiltering,
  ownerInitials,
  paginate,
  portfolioCsv,
  portfolioHealth,
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
import { AVATAR_PALETTE } from "./people-stack";
import { PROJECT_STATUS_COLOR as STATUS_COLOR, projectStatusKind, projectStatusLabel } from "./project-status";

const PAGE_SIZES = ["10", "15", "25", "50"];

const menuItem = "gap-2.5 rounded-md px-2.5 py-2 text-label [&_svg]:size-4 [&_svg]:text-muted-foreground";

const TAB_LABEL: Record<PortfolioView, string> = { active: "Ativos", concluded: "Concluídos", archived: "Arquivados", all: "Todos" };

const focusRing = "focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none";

function PageHeader({ eapPrompt = false, actions }: { eapPrompt?: boolean; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden="true">
          <FolderKanban className="size-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl leading-[1.25] font-semibold tracking-[-0.025em] text-foreground">Projetos</h1>
          <p className="mt-1 truncate text-[11.5px] text-muted-foreground">Situação, prazo e responsáveis de cada projeto da CTIN.</p>
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

/** Tom do chip da situação selecionada (tokens de status do sistema). */
const CHIP_TONE: Record<string, string> = {
  CRITICO: "border-status-critical/45 bg-status-critical-soft text-status-critical-ink hover:bg-status-critical-soft",
  EM_ATENCAO: "border-status-attention/45 bg-status-attention-soft text-status-attention-ink hover:bg-status-attention-soft",
  EM_EXECUCAO: "border-status-running/45 bg-status-running-soft text-status-running-ink hover:bg-status-running-soft",
  EM_VALIDACAO: "border-status-validation/45 bg-status-validation-soft text-status-validation-ink hover:bg-status-validation-soft",
  NAO_INICIADO: "border-status-idle/45 bg-status-idle-soft text-status-idle-ink hover:bg-status-idle-soft",
  CONCLUIDO: "border-status-done/45 bg-status-done-soft text-status-done-ink hover:bg-status-done-soft",
};

/**
 * Resumo do portfólio: à esquerda, os projetos ativos (com o total) e quantos precisam de ação (críticos e em atenção);
 * à direita, a barra com a participação de cada situação e os chips, que filtram a lista (o ativo volta para Todos).
 * Situações sem projetos ficam esmaecidas.
 */
function PortfolioHealth({
  chips,
  health,
  isActive,
  onSelect,
}: {
  chips: ReadonlyArray<{ key: string; label: string; value: number }>;
  health: ReturnType<typeof portfolioHealth>;
  isActive: (key: string) => boolean;
  onSelect: (key: string, active: boolean) => void;
}) {
  const total = chips.find((chip) => chip.key === "total")?.value ?? 0;
  const situations = chips.filter((chip) => chip.key !== "total");
  const filtered = filterActive(situations, isActive);
  const distribution = situations
    .filter((chip) => chip.value > 0)
    .map((chip) => `${chip.label}: ${chip.value} (${statusShare(chip.value, total)}%)`)
    .join(", ");
  return (
    <section
      aria-label="Resumo do portfólio"
      className="grid gap-x-8 gap-y-3 rounded-2xl border border-border/70 bg-card px-5 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] md:grid-cols-[minmax(13rem,auto)_minmax(0,1fr)] md:items-center dark:border-border"
    >
      <div className="flex flex-col items-start gap-2">
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="text-4xl leading-none font-semibold tracking-tight text-foreground tabular-nums">{health.active}</span>
          <span className="text-body text-muted-foreground">
            {health.active === 1 ? "projeto ativo" : "projetos ativos"} · {health.total} no total
          </span>
        </p>
        {health.needsAction > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-critical-soft px-2.5 py-1 text-label font-semibold text-status-critical-ink">
            <TriangleAlert className="size-3.5" aria-hidden="true" />
            {health.needsAction === 1 ? "1 precisa de ação" : `${health.needsAction} precisam de ação`}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-done-soft px-2.5 py-1 text-label font-semibold text-status-done-ink">
            <Check className="size-3.5" aria-hidden="true" />
            Nenhum projeto exige ação
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div role="img" aria-label={distribution ? `Distribuição por situação: ${distribution}` : "Sem projetos"} className="flex h-2.5 gap-1">
          {total === 0 ? <span className="h-full flex-1 rounded-full bg-muted" /> : null}
          {situations.map((chip) =>
            chip.value > 0 ? (
              <span
                key={chip.key}
                title={`${chip.label}: ${count(chip.value, "projeto", "projetos")} (${statusShare(chip.value, total)}%)`}
                className={cn(
                  "h-full min-w-2 rounded-full transition-[flex-grow,opacity] duration-200 ease-out motion-reduce:transition-none",
                  filtered && !isActive(chip.key) && "opacity-35",
                )}
                style={{ flexGrow: chip.value, flexBasis: 0, backgroundColor: STATUS_COLOR[chip.key as ProjectStatus] }}
              />
            ) : null,
          )}
        </div>
        <ul aria-label="Filtrar por situação" className="flex flex-wrap gap-x-1 gap-y-2">
          {situations.map((chip) => {
            const active = isActive(chip.key);
            const empty = chip.value === 0 && !active;
            const share = statusShare(chip.value, total);
            return (
              <li key={chip.key}>
                <button
                  type="button"
                  aria-pressed={active}
                  disabled={empty}
                  aria-label={`Filtrar ${chip.label}: ${count(chip.value, "projeto", "projetos")}`}
                  title={chip.value > 0 ? `${share}% dos projetos` : undefined}
                  onClick={() => onSelect(chip.key, active)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-card px-2 text-label text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
                    focusRing,
                    active && CHIP_TONE[chip.key],
                  )}
                >
                  <span className="size-2 shrink-0 rounded-[3px]" style={{ backgroundColor: STATUS_COLOR[chip.key as ProjectStatus] }} aria-hidden="true" />
                  {chip.label}
                  <span className={cn("font-semibold tabular-nums", active ? "text-current" : "text-foreground")}>{chip.value}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Há uma situação filtrada pela legenda (as demais faixas da barra ficam esmaecidas). */
function filterActive(chips: ReadonlyArray<{ key: string }>, isActive: (key: string) => boolean) {
  return chips.some((chip) => isActive(chip.key));
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
  const [filters, setFilters] = useState<PortfolioFilters>(idlePortfolioFilters);
  const [sort, setSort] = useState<PortfolioSort>({ key: "urgency", direction: "desc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const chips = useMemo(() => statusChips(projects), [projects]);
  const statusLabel = useMemo(() => new Map(chips.map((chip) => [chip.key, chip.label])), [chips]);
  const unavailable = useMemo(() => unavailableSituations(projects), [projects]);
  const health = useMemo(() => portfolioHealth(projects), [projects]);
  const counts = useMemo(() => viewCounts(projects), [projects]);
  const options = useMemo(() => filterOptions(projects), [projects]);
  const visible = useMemo(() => sortPortfolio(filterPortfolio(projects, filters, view), sort), [projects, filters, view, sort]);
  const paged = paginate(visible, page, pageSize);
  const filtering = isFiltering(filters);
  const firstShown = visible.length === 0 ? 0 : (paged.current - 1) * pageSize + 1;
  // Chave da lista: muda com visualização, filtros (exceto a digitação da busca), ordenação e página, e reinicia o fade.
  const listKey = [view, filters.status, filters.company, filters.owner, sort.key, sort.direction, paged.current, pageSize].join("|");

  function updateFilters(next: Partial<PortfolioFilters>) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  function changeView(next: PortfolioView) {
    setView(next);
    setPage(1);
    if (next === "concluded") {
      setFilters((current) => ({ ...current, status: "" }));
    }
  }

  /** Chip clicado: o ativo volta para Todos; Concluído abre a visualização de concluídos; os demais filtram os ativos. */
  function selectChip(key: string, active: boolean) {
    if (key === "total" || active) {
      changeView("all");
      updateFilters({ status: "" });
    } else if (key === "CONCLUIDO") {
      changeView("concluded");
      updateFilters({ status: "" });
    } else {
      changeView("active");
      updateFilters({ status: key as ProjectStatus });
    }
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
    <div className="flex w-full min-w-0 flex-col gap-6">
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

      <PortfolioHealth
        chips={chips}
        health={health}
        isActive={(key) => (key === "CONCLUIDO" ? view === "concluded" : filters.status === key)}
        onSelect={selectChip}
      />
      {unavailable > 0 ? (
        <p className="-mt-2 text-label text-muted-foreground">
          {unavailable === 1
            ? "1 projeto sem situação calculada (consulta indisponível) não entra nos indicadores por situação."
            : `${unavailable} projetos sem situação calculada (consulta indisponível) não entram nos indicadores por situação.`}
        </p>
      ) : null}

      <section aria-label="Lista de projetos" className="@container min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-border">
        <div className="flex flex-wrap items-center gap-2.5 p-4 @min-[980px]:flex-nowrap">
          {/* A rolagem horizontal (só em telas estreitas) fica no contêiner, com a barra oculta; a lista de abas nunca rola. */}
          <Tabs
            value={view}
            onValueChange={(next) => changeView(next as PortfolioView)}
            className="max-w-full shrink-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <TabsList aria-label="Visualização dos projetos" className="h-10 w-max overflow-visible">
              {PORTFOLIO_VIEWS.map((item) => (
                <TabsTrigger key={item.key} value={item.key} disabled={!item.available} title={item.description} className="group/view flex-none gap-1.5 px-2.5 text-label">
                  {TAB_LABEL[item.key]}
                  <span className="rounded-full bg-foreground/[0.07] px-1.5 py-0.5 text-[11px] leading-none font-semibold tabular-nums group-data-active/view:bg-primary/12 group-data-active/view:text-primary">
                    {counts[item.key]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <label className="relative min-w-[13rem] flex-1 @min-[980px]:min-w-[9rem]">
            <span className="sr-only">Pesquisar por nome, GLPI ou identificador do projeto</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={filters.query}
              onChange={(event) => updateFilters({ query: event.target.value })}
              placeholder="Nome ou GLPI..."
              className="h-10 rounded-[7px] pl-9 text-xs"
            />
          </label>
          {options.companies.length > 0 ? (
            <div className="w-full sm:w-44 @min-[980px]:w-36 @min-[980px]:shrink-0">
              <FilterSelect
                label="Empresa"
                value={filters.company}
                onChange={(company) => updateFilters({ company })}
                options={options.companies.map((name) => ({ value: name, label: name }))}
              />
            </div>
          ) : null}
          {options.owners.length > 0 ? (
            <div className="w-full sm:w-44 @min-[980px]:w-36 @min-[980px]:shrink-0">
              <FilterSelect
                label="Gestor"
                value={filters.owner}
                onChange={(owner) => updateFilters({ owner })}
                options={options.owners.map((name) => ({ value: name, label: name }))}
              />
            </div>
          ) : null}
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

        <div className="flex min-h-11 flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4 py-2 text-label text-muted-foreground">
          {filtering ? <span>Filtros:</span> : null}
          <ActiveFilters
            tags={[
              ...(filters.status ? [{ key: "status", text: statusLabel.get(filters.status) ?? filters.status, onRemove: () => updateFilters({ status: "" }) }] : []),
              ...(filters.company ? [{ key: "company", text: `Empresa: ${filters.company}`, onRemove: () => updateFilters({ company: "" }) }] : []),
              ...(filters.owner ? [{ key: "owner", text: `Gestor: ${filters.owner}`, onRemove: () => updateFilters({ owner: "" }) }] : []),
              ...(filters.query.trim() ? [{ key: "query", text: `Busca: ${filters.query.trim()}`, onRemove: () => updateFilters({ query: "" }) }] : []),
            ]}
          />
          <span aria-live="polite">
            {visible.length} de {counts[view]} {counts[view] === 1 ? "projeto" : "projetos"} · ordenados por {sortText(sort)}
          </span>
          {filtering ? (
            <Button type="button" variant="ghost" size="xs" className="ml-auto text-primary hover:text-primary" onClick={() => updateFilters(idlePortfolioFilters)}>
              Limpar filtros
            </Button>
          ) : null}
        </div>

        {projects.length === 0 || visible.length === 0 ? (
          <div className="px-4 pb-4">
            <ProjectEmpty
              title={projects.length === 0 ? "Nenhum projeto disponível" : "Nenhum projeto encontrado"}
              description={
                projects.length === 0
                  ? "A consulta não retornou projetos para o seu acesso."
                  : `A pesquisa e os filtros não encontraram projetos em ${TAB_LABEL[view]}.`
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
          <div className="relative w-full min-w-0 overflow-x-auto border-t border-border">
            <table className="w-full min-w-[1000px] text-left">
              <thead className="bg-muted/50 text-label font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <SortHeader label="Projeto" sortKey="name" sort={sort} onSort={toggleSort} className="pl-4" />
                  <th scope="col" className="px-2.5 py-3">Empresa</th>
                  <th scope="col" className="px-2.5 py-3">Equipe</th>
                  <th scope="col" className="px-2.5 py-3">Situação</th>
                  <th scope="col" className="px-2.5 py-3">Progresso</th>
                  <SortHeader label="Prazo" sortKey="urgency" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Última atualização" sortKey="updated" sort={sort} onSort={toggleSort} />
                  <th scope="col" className="w-11 px-2.5 py-3"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody key={listKey} className="motion-fade">
                {paged.items.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    opening={navigating && openingId === project.id}
                    canEdit={canEditProject(viewerRole, project)}
                    onOpen={(target) => open(project.id, target)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visible.length > 0 ? (
          <nav aria-label="Paginação dos projetos" className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3.5 text-label text-muted-foreground">
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
  opening,
  canEdit,
  onOpen,
}: {
  project: ProjectListRow;
  opening: boolean;
  canEdit: boolean;
  onOpen: (target?: "eap" | "cronograma") => void;
}) {
  const [editing, setEditing] = useState(false);
  // A linha inteira abre a Visão Geral; o nome é o link acessível por teclado e o menu tem ações próprias.
  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    // Cliques no diálogo de edição (renderizado fora da tabela) também chegam aqui pela árvore do React.
    if (!event.currentTarget.contains(event.target as Node) || (event.target as HTMLElement).closest("a, button, [role=menu]")) {
      return;
    }
    onOpen();
  }
  const attention = project.status === "EM_ATENCAO" || project.status === "CRITICO";
  const details = detailsText(project);

  return (
    <tr
      onClick={handleClick}
      className={cn(
        "cursor-pointer border-b border-border/60 align-middle text-body transition-colors duration-200 last:border-b-0 hover:bg-primary/5 motion-reduce:transition-none",
        opening && "bg-primary/5",
      )}
    >
      <td
        className="min-w-[12rem] py-3.5 pr-3 pl-4"
        style={attention && project.status ? { boxShadow: `inset 3px 0 0 ${STATUS_COLOR[project.status]}` } : undefined}
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Link href={`/projetos/${project.id}`} className={cn("block font-semibold text-foreground hover:text-primary focus-visible:rounded-sm", focusRing)} />
            }
          >
            {project.name}
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="flex-col items-start gap-0.5">
            <span>{details.delivery}</span>
          </TooltipContent>
        </Tooltip>
        <span className="mt-0.5 flex items-center gap-1.5 text-label text-muted-foreground">
          {opening ? <Spinner className="size-3" /> : null}
          {project.glpiTicketId ? `GLPI #${project.glpiTicketId}` : `ID ${project.id.slice(0, 8)}`}
          {attention ? <span className="sr-only">Exige atenção.</span> : null}
        </span>
      </td>
      <td className="w-36 max-w-44 min-w-[8rem] px-2.5 py-3.5">
        <CompanyCell project={project} />
      </td>
      <td className="w-32 px-2.5 py-3.5">
        <ManagerTeamCell project={project} />
      </td>
      <td className="px-2.5 py-3.5">
        {project.status === null || project.situation === null ? (
          <Muted value={null} />
        ) : (
          <span className="flex flex-col items-start gap-1">
            <EapStatusBadge
              kind={projectStatusKind(project.status)}
              label={projectStatusLabel(project.status)}
              title={`Situação calculada pela EAP. Situação registrada no cadastro: ${projectStatusLabel(project.registeredStatus)}.`}
              className={cn("px-2 py-[3px] text-label whitespace-nowrap", project.status === "SUSPENSO" && "bg-muted text-muted-foreground")}
            />
            {project.situation.readyForClosure ? (
              <span className="flex items-center gap-1.5 text-label font-medium text-success-foreground" title="Todas as fases concluídas; o encerramento depende de decisão formal">
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                Apto para encerramento
              </span>
            ) : null}
            {project.situation.closureRequirementsMissing ? (
              <span className="text-label text-muted-foreground" title="Encerramento registrado, mas há fases não concluídas">Encerramento pendente</span>
            ) : null}
          </span>
        )}
      </td>
      <td className="min-w-[8.5rem] px-2.5 py-3.5">
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
              className="w-20 [&_[data-slot=progress-indicator]]:bg-primary [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-muted"
            />
            <span className="text-label font-semibold text-foreground tabular-nums">{formatBasis(project.progressBasisPoints)}%</span>
          </span>
        )}
      </td>
      <td className="px-2.5 py-3.5 whitespace-nowrap">
        <DeadlineCell project={project} />
      </td>
      <td className="px-2.5 py-3.5 whitespace-nowrap">
        <UpdatedCell project={project} />
      </td>
      <td className="px-2.5 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground" aria-label={`Ações de ${project.name}`} />}
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
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuItem
              disabled
              className={menuItem}
              title="O arquivamento depende de alteração no banco (campo de arquivamento), ainda não autorizada."
            >
              <Archive aria-hidden="true" />
              Arquivar
              <span className="ml-auto text-label text-muted-foreground">Em breve</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {canEdit ? <ProjectEditDialog project={project} open={editing} onOpenChange={setEditing} /> : null}
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
 * não foi cadastrada. O início previsto fica no título.
 */
function DeadlineCell({ project }: { project: ProjectListRow }) {
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

/**
 * Empresa do projeto: o nome institucional da ficha ou, sem ele, os fornecedores participantes. Até duas linhas, com o
 * nome completo e a origem no título.
 */
function CompanyCell({ project }: { project: ProjectListRow }) {
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
    <span className="line-clamp-2 text-body break-words text-foreground" title={`${names}\n${origin}`}>
      {names}
    </span>
  );
}

/**
 * Equipe em avatares sobrepostos, com o gestor primeiro e marcado por um anel na cor da paleta (sem gestor vinculado, o
 * dono do projeto). Até 4 avatares e "+N"; o tooltip lista todos com os papéis.
 */
function ManagerTeamCell({ project }: { project: ProjectListRow }) {
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
  const avatar = "flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-card";
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
        <span className={cn(avatar, "relative z-10 ring-primary/60", AVATAR_PALETTE[avatarColorIndex(lead.id, AVATAR_PALETTE.length)])}>{ownerInitials(lead.name)}</span>
        {visible.map((person) => (
          <span key={person.id} className={cn(avatar, AVATAR_PALETTE[avatarColorIndex(person.id, AVATAR_PALETTE.length)])}>
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

/** Data e hora exatas (fuso de Belém, como no restante do sistema), para a informação complementar. */
const MOMENT = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Belem", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/**
 * Última atualização = última movimentação real do acompanhamento (situação, conclusão, impedimento, entrega, homologação,
 * reprogramação, planejamento), nunca acessos ou visualizações. Rótulo relativo em destaque e a data exata abaixo; o tooltip traz
 * data e hora. O texto relativo depende do relógio de quem consulta, por isso pode diferir do servidor perto da virada do dia.
 */
function UpdatedCell({ project }: { project: ProjectListRow }) {
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
  const stale = label.days > 30;
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="flex w-fit flex-col items-start gap-1" />}>
        <span suppressHydrationWarning className={cn("text-body font-medium", stale ? "text-warning-foreground" : "text-foreground")}>
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

export function ProjectListError({ message }: { message: string }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <PageHeader />
      <ProjectEmpty
        title="Não foi possível consultar os projetos"
        description={message}
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        }
      />
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
    <Empty className="border bg-card">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FolderKanban />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  );
}
