"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Archive,
  CalendarDays,
  Check,
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
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type MouseEvent, type ReactNode } from "react";

import { OptionCombobox } from "@/components/option-combobox";
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar";
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
  PORTFOLIO_VIEWS,
  SORT_LABEL,
  sortPortfolio,
  statusChips,
  TEAM_ROLE_LABEL,
  teamPreview,
  unavailableSituations,
  type PortfolioFilters,
  type PortfolioSort,
  type PortfolioView,
  type ProjectListRow,
  type ProjectStatus,
} from "./project-portfolio";
import { PROJECT_STATUS_COLOR as STATUS_COLOR, projectStatusKind, projectStatusLabel } from "./project-status";

const PAGE_SIZES = ["10", "15", "25", "50"];

const menuItem = "gap-2.5 rounded-md px-2.5 py-2 text-label [&_svg]:size-4 [&_svg]:text-muted-foreground";

const TAB_LABEL: Record<PortfolioView, string> = { active: "Ativos", concluded: "Concluídos", archived: "Arquivados", all: "Todos" };

/** Paleta suave de 8 cores para os avatares da equipe (fundo claro + iniciais escuras, contraste acima de 4,5:1). A cor vem só do ID da pessoa. */
const AVATAR_PALETTE = [
  "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-100",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100",
  "bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-100",
  "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100",
  "bg-rose-100 text-rose-900 dark:bg-rose-900/50 dark:text-rose-100",
  "bg-teal-100 text-teal-900 dark:bg-teal-900/50 dark:text-teal-100",
  "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-100",
  "bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-100",
] as const;

const focusRing = "focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none";

/** Ponto colorido com halo suave, na cor da situação (token --status-*). */
function dotStyle(color: string) {
  return { backgroundColor: color, boxShadow: `0 0 0 3px color-mix(in oklch, ${color} 15%, transparent)` };
}

function PageHeader({ eapPrompt = false, actions }: { eapPrompt?: boolean; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <span className="block text-label font-bold tracking-[0.14em] text-primary uppercase">Portfólio institucional</span>
        <h1 className="mt-1.5 text-page-title font-medium tracking-tight text-foreground">Projetos</h1>
        <p className="mt-1 text-body text-muted-foreground">Situação, prazo e responsáveis de cada projeto da CTIN.</p>
        {eapPrompt ? (
          <p className="mt-3 max-w-xl rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-body text-primary">
            Selecione um projeto para abrir a Estrutura Analítica.
          </p>
        ) : null}
      </div>
      {actions}
    </header>
  );
}

/** Controle desabilitado com explicação: o span recebe foco/hover, pois botão desabilitado não dispara o Tooltip. */
function SoonTooltip({ children, text = "Em breve" }: { children: ReactNode; text?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className={cn("inline-flex rounded-md", focusRing)} />}>{children}</TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
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
  const [sort, setSort] = useState<PortfolioSort>({ key: "name", direction: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const chips = useMemo(() => statusChips(projects), [projects]);
  const unavailable = useMemo(() => unavailableSituations(projects), [projects]);
  const options = useMemo(() => filterOptions(projects), [projects]);
  const visible = useMemo(() => sortPortfolio(filterPortfolio(projects, filters, view), sort), [projects, filters, view, sort]);
  const paged = paginate(visible, page, pageSize);
  const filtering = isFiltering(filters);
  const firstShown = visible.length === 0 ? 0 : (paged.current - 1) * pageSize + 1;
  // Chave da lista: muda com visualização, filtros (exceto a digitação da busca), ordenação e página, e reinicia o fade.
  const listKey = [view, filters.status, filters.supplier, filters.owner, sort.key, sort.direction, paged.current, pageSize].join("|");

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
    <div className="flex w-full min-w-0 flex-col gap-5">
      <PageHeader
        eapPrompt={eapPrompt}
        actions={
          <SoonTooltip>
            <Button type="button" variant="outline" disabled>
              <Download aria-hidden="true" />
              Exportar
            </Button>
          </SoonTooltip>
        }
      />

      <section aria-label="Situação dos projetos" className="flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active =
            chip.key === "total" ? view === "all" && filters.status === "" : chip.key === "CONCLUIDO" ? view === "concluded" : filters.status === chip.key;
          return (
            <Button
              key={chip.key}
              type="button"
              variant="outline"
              aria-pressed={active}
              onClick={() => selectChip(chip.key, active)}
              className={cn("h-8 rounded-full px-3 text-label", active ? "border-primary bg-primary/10 font-semibold text-primary hover:bg-primary/10" : "bg-card")}
            >
              {active ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
              {chip.key === "total" ? null : (
                <span className="size-2 shrink-0 rounded-full" style={dotStyle(STATUS_COLOR[chip.key])} aria-hidden="true" />
              )}
              {chip.label}
              <span className="font-semibold tabular-nums">{chip.value}</span>
            </Button>
          );
        })}
      </section>
      {unavailable > 0 ? (
        <p className="-mt-2 text-label text-muted-foreground">
          {unavailable === 1
            ? "1 projeto sem situação calculada (consulta indisponível) não entra nos indicadores por situação."
            : `${unavailable} projetos sem situação calculada (consulta indisponível) não entram nos indicadores por situação.`}
        </p>
      ) : null}

      <section aria-label="Lista de projetos" className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <Tabs value={view} onValueChange={(next) => changeView(next as PortfolioView)} className="min-w-0 px-4 pt-2">
          <TabsList variant="line" aria-label="Visualização dos projetos" className="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-b border-border p-0">
            {PORTFOLIO_VIEWS.map((item) => (
              <TabsTrigger
                key={item.key}
                value={item.key}
                disabled={!item.available}
                title={item.description}
                className="h-9 flex-none rounded-none px-0.5 text-label font-medium text-muted-foreground hover:text-foreground data-active:text-primary after:bg-primary group-data-horizontal/tabs:after:bottom-0"
              >
                {TAB_LABEL[item.key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="relative min-w-[14rem] flex-1">
              <span className="sr-only">Pesquisar por nome, GLPI ou identificador do projeto</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={filters.query}
                onChange={(event) => updateFilters({ query: event.target.value })}
                placeholder="Pesquisar por nome, GLPI ou identificador..."
                className="h-9 pl-9 text-body"
              />
            </label>
            {options.suppliers.length > 0 ? (
              <div className="w-full sm:w-52">
                <FilterSelect
                  label="Fornecedor"
                  value={filters.supplier}
                  onChange={(supplier) => updateFilters({ supplier })}
                  options={options.suppliers.map((name) => ({ value: name, label: name }))}
                />
              </div>
            ) : null}
            {options.owners.length > 0 ? (
              <div className="w-full sm:w-52">
                <FilterSelect
                  label="Gestor"
                  value={filters.owner}
                  onChange={(owner) => updateFilters({ owner })}
                  options={options.owners.map((name) => ({ value: name, label: name }))}
                />
              </div>
            ) : null}
            {filtering ? (
              <Button type="button" variant="ghost" size="sm" className="text-primary hover:text-primary" onClick={() => updateFilters(idlePortfolioFilters)}>
                Limpar filtros
              </Button>
            ) : null}
            <Tabs value="list" className="ml-auto">
              <TabsList aria-label="Modo de exibição">
                <TabsTrigger value="list">
                  <List aria-hidden="true" />
                  Lista
                </TabsTrigger>
                <Tooltip>
                  <TooltipTrigger render={<span className="inline-flex" />}>
                    <TabsTrigger value="board" disabled>
                      <LayoutGrid aria-hidden="true" />
                      Quadro
                    </TabsTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Em breve</TooltipContent>
                </Tooltip>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex items-center justify-between gap-3 text-label text-muted-foreground">
            <span aria-live="polite">
              {visible.length === 1 ? "1 projeto encontrado" : `${visible.length} projetos encontrados`} · ordenados por {SORT_LABEL[sort.key]} (
              {sort.direction === "asc" ? "crescente" : "decrescente"})
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="sm" className="text-label text-muted-foreground" />}>
                <ArrowUpDown aria-hidden="true" />
                Ordenar por
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-lg p-1.5">
                {(["name", "deadline", "updated"] as const).map((key) => (
                  <DropdownMenuItem key={key} className={menuItem} onClick={() => toggleSort(key)}>
                    <span className="capitalize">{SORT_LABEL[key]}</span>
                    {sort.key === key ? (
                      sort.direction === "asc" ? <ArrowUp className="ml-auto size-3.5" aria-hidden="true" /> : <ArrowDown className="ml-auto size-3.5" aria-hidden="true" />
                    ) : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
            <table className="w-full min-w-[1040px] text-left">
              <thead className="bg-muted/60 text-label font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <SortHeader label="Projeto" sortKey="name" sort={sort} onSort={toggleSort} className="pl-4" />
                  <th scope="col" className="px-2.5 py-4">Fornecedor</th>
                  <th scope="col" className="px-1.5 py-4 text-center">Equipe</th>
                  <th scope="col" className="px-2.5 py-4">Situação</th>
                  <th scope="col" className="px-2.5 py-4">Progresso</th>
                  <th scope="col" className="px-2.5 py-4">Início</th>
                  <SortHeader label="Previsão" sortKey="deadline" sort={sort} onSort={toggleSort} />
                  <th scope="col" className="px-2.5 py-4">Atraso</th>
                  <th scope="col" className="w-12 px-3 py-3"><span className="sr-only">Ações</span></th>
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
  return { delivery, updated: `Atualizado em ${dateText(project.updatedAt)}` };
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
  const delay = delayCell(project);
  const details = detailsText(project);

  return (
    <tr
      onClick={handleClick}
      style={attention && project.status ? { boxShadow: `inset 3px 0 0 ${STATUS_COLOR[project.status]}` } : undefined}
      className={cn(
        "cursor-pointer border-b border-border/60 align-middle text-body transition-colors duration-200 last:border-b-0 even:bg-muted/30 hover:bg-primary/5 motion-reduce:transition-none",
        opening && "bg-primary/5",
      )}
    >
      <td className="min-w-[13rem] py-4 pr-3 pl-4">
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
            <span className="opacity-80">{details.updated}</span>
          </TooltipContent>
        </Tooltip>
        <span className="mt-0.5 flex items-center gap-1.5 text-label text-muted-foreground">
          {opening ? <Spinner className="size-3" /> : null}
          {project.glpiTicketId ? `GLPI #${project.glpiTicketId}` : `ID ${project.id.slice(0, 8)}`}
          {attention ? <span className="sr-only">Exige atenção.</span> : null}
        </span>
      </td>
      <td className="w-44 max-w-44 px-2.5 py-4">
        {project.suppliers === null ? (
          <Muted value={null} />
        ) : (
          <Truncated text={project.suppliers.join(", ") || "Não informado"} />
        )}
      </td>
      <td className="w-32 px-1.5 py-4 text-center">
        <TeamCell project={project} />
      </td>
      <td className="px-2.5 py-4">
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
      <td className="min-w-[7.5rem] px-2.5 py-4">
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
              className="w-16 [&_[data-slot=progress-indicator]]:bg-primary [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-muted"
            />
            <span className="text-label font-semibold text-foreground tabular-nums">{formatBasis(project.progressBasisPoints)}%</span>
          </span>
        )}
      </td>
      <td className="px-2.5 py-4 whitespace-nowrap text-foreground">
        {project.plannedStartAt ? dateText(project.plannedStartAt) : <span className="text-label text-muted-foreground">Não definido</span>}
      </td>
      <td className="px-2.5 py-4 whitespace-nowrap text-foreground">
        {project.plannedEndAt ? dateText(project.plannedEndAt) : <span className="text-label text-muted-foreground">Não definido</span>}
      </td>
      <td className="px-2.5 py-4 whitespace-nowrap">
        <span
          className={cn(
            "text-body",
            delay.kind === "delay" && "font-semibold text-destructive",
            delay.kind === "risk" && "font-medium text-warning-foreground",
            (delay.kind === "ontime" || delay.kind === "unavailable") && "text-muted-foreground",
          )}
        >
          {delay.text}
        </span>
      </td>
      <td className="px-3 py-2.5">
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
        className={cn("-ml-2 h-auto px-2 py-1 text-label tracking-[0.06em] uppercase hover:text-foreground", active ? "text-primary" : "text-muted-foreground")}
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

/** Equipe do projeto: até 3 avatares sobrepostos, +N para o restante; o tooltip lista nome e papel e o clique abre os detalhes. */
function TeamCell({ project }: { project: ProjectListRow }) {
  if (project.team === null) {
    return <Muted value={null} />;
  }
  if (project.team.length === 0) {
    return <span className="text-body text-muted-foreground" aria-label="Sem participantes cadastrados">—</span>;
  }
  const { visible, extra } = teamPreview(project.team);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={`/projetos/${project.id}`}
            aria-label={`Equipe de ${project.name}: ${project.team.length} ${project.team.length === 1 ? "participante" : "participantes"}. Abrir detalhes do projeto.`}
            className={cn("inline-flex rounded-full", focusRing)}
          />
        }
      >
        <AvatarGroup className="-space-x-1">
          {visible.map((person) => (
            <Avatar key={person.id}>
              <AvatarFallback className={cn("text-label font-semibold", AVATAR_PALETTE[avatarColorIndex(person.id, AVATAR_PALETTE.length)])}>{ownerInitials(person.name)}</AvatarFallback>
            </Avatar>
          ))}
          {extra > 0 ? <AvatarGroupCount className="bg-muted text-label text-muted-foreground">+{extra}</AvatarGroupCount> : null}
        </AvatarGroup>
      </TooltipTrigger>
      <TooltipContent side="top" align="start" className="flex-col items-start gap-1">
        {project.team.map((person) => (
          <span key={person.id}>
            <span className="font-medium">{person.name}</span>
            <span className="opacity-80"> · {person.roles.map((role) => TEAM_ROLE_LABEL[role] ?? role).join(", ")}</span>
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

/** Texto em uma linha com reticências; o conteúdo completo fica no tooltip (foco por teclado incluído). */
function Truncated({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span tabIndex={0} className={cn("block min-w-0 truncate rounded-sm text-body text-foreground", focusRing)} />}>{text}</TooltipTrigger>
      <TooltipContent side="top" align="start">{text}</TooltipContent>
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
