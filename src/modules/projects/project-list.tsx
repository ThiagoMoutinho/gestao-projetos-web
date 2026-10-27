"use client";

import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ClipboardCheck,
  FolderKanban,
  Hourglass,
  Info,
  List,
  MoreHorizontal,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type MouseEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { OptionCombobox } from "@/components/option-combobox";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { formatCivilDate } from "./eap-date-field";
import { civilDateInput } from "./eap-present";
import { basisToPercent, formatBasis } from "./eap-progress";
import { EapStatusBadge } from "./eap-status-badge";
import { ProjectEditDialog } from "./project-edit-dialog";
import {
  canEditProject,
  filterOptions,
  filterPortfolio,
  idlePortfolioFilters,
  isFiltering,
  paginate,
  PORTFOLIO_VIEWS,
  portfolioIndicators,
  sortPortfolio,
  unavailableSituations,
  type PortfolioFilters,
  type PortfolioSort,
  type PortfolioView,
  type ProjectListRow,
  type ProjectStatus,
} from "./project-portfolio";
import { projectStatusKind, projectStatusLabel } from "./project-status";

const PAGE_SIZES = ["10", "15", "25", "50"];

const menuItem = "rounded-md px-2.5 py-2 text-[12px] text-[#344054]";

const TAB_LABEL: Record<PortfolioView, string> = { active: "Ativos", concluded: "Concluídos", archived: "Arquivados", all: "Todos" };

/** Ponto colorido com halo suave, como nos indicadores do Figma. */
function dotStyle(color: string) {
  return { backgroundColor: color, boxShadow: `0 0 0 4px ${color}26` };
}

/** Cor do ponto de cada indicador e da borda lateral da linha, pela situação calculada. */
const STATUS_COLOR: Record<ProjectStatus, string> = {
  NAO_INICIADO: "#9fb3c8",
  EM_EXECUCAO: "#2873cf",
  EM_ATENCAO: "#e0a130",
  CRITICO: "#d92d20",
  EM_VALIDACAO: "#7450bf",
  CONCLUIDO: "#12a46e",
  SUSPENSO: "#98a2b3",
};

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
  const indicators = useMemo(() => portfolioIndicators(projects), [projects]);
  const unavailable = useMemo(() => unavailableSituations(projects), [projects]);
  const options = useMemo(() => filterOptions(projects), [projects]);
  const visible = useMemo(() => sortPortfolio(filterPortfolio(projects, filters, view), sort), [projects, filters, view, sort]);
  const paged = paginate(visible, page, pageSize);
  const filtering = isFiltering(filters);
  const currentView = PORTFOLIO_VIEWS.find((item) => item.key === view) ?? PORTFOLIO_VIEWS[0];
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

  /** Indicador clicado: Concluídos abre a visualização de concluídos; o total mostra todos; os demais filtram os ativos. */
  function selectIndicator(key: string, active: boolean) {
    if (key === "total") {
      changeView("all");
      updateFilters({ status: "" });
    } else if (key === "CONCLUIDO") {
      changeView(active ? "active" : "concluded");
      updateFilters({ status: "" });
    } else {
      changeView("active");
      updateFilters({ status: active ? "" : (key as ProjectStatus) });
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
    <div className="mx-auto flex w-full max-w-[90rem] min-w-0 flex-col gap-5">
      <header>
        <span className="block text-[10px] font-bold tracking-[0.14em] text-[#2865b9] uppercase">Portfólio institucional</span>
        <h1 className="mt-1.5 text-2xl font-medium tracking-tight text-[#172033]">Todos os Projetos</h1>
        <p className="mt-1 text-[13px] text-[#667085]">Acompanhe o portfólio institucional de projetos da CTIN.</p>
        {eapPrompt ? (
          <p className="mt-3 max-w-xl rounded-[7px] border border-[#d8e6f8] bg-[#f7faff] px-3 py-2 text-sm text-[#174f9e]">
            Selecione um projeto para abrir a Estrutura Analítica.
          </p>
        ) : null}
      </header>

      <section aria-label="Indicadores do portfólio" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {indicators.map((indicator) => {
          const active =
            indicator.key === "total"
              ? view === "all" && filters.status === ""
              : indicator.key === "CONCLUIDO"
                ? view === "concluded"
                : filters.status === indicator.key;
          return (
            <button
              key={indicator.key}
              type="button"
              aria-pressed={active}
              onClick={() => selectIndicator(indicator.key, active)}
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-xl border bg-white px-4 py-3.5 text-left transition-colors duration-200 hover:border-[#bad1f0] focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none motion-reduce:transition-none",
                active ? "border-[#84adff] bg-[#f5f9ff]" : "border-[#e4e7ec]",
              )}
            >
              <span className="size-2.5 shrink-0 rounded-full" style={dotStyle(indicator.key === "total" ? "#2865b9" : STATUS_COLOR[indicator.key])} aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-[11px] text-[#475467]">{indicator.label}</span>
                <strong className="mt-0.5 block text-lg leading-tight font-semibold text-[#172033] tabular-nums">{indicator.value}</strong>
              </span>
            </button>
          );
        })}
      </section>
      {unavailable > 0 ? (
        <p className="-mt-2 text-[11px] text-[#667085]">
          {unavailable === 1
            ? "1 projeto sem situação calculada (consulta indisponível) não entra nos indicadores por situação."
            : `${unavailable} projetos sem situação calculada (consulta indisponível) não entram nos indicadores por situação.`}
        </p>
      ) : null}

      <section aria-label="Lista de projetos" className="min-w-0 overflow-hidden rounded-xl border border-[#e4e7ec] bg-white">
        <Tabs value={view} onValueChange={(next) => changeView(next as PortfolioView)} className="min-w-0 px-4 pt-2">
          <TabsList variant="line" aria-label="Visualização dos projetos" className="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-b border-[#edf0f3] p-0">
            {PORTFOLIO_VIEWS.map((item) => (
              <TabsTrigger
                key={item.key}
                value={item.key}
                disabled={!item.available}
                title={item.description}
                className="h-9 flex-none rounded-none px-0.5 text-xs font-medium text-[#667085] hover:text-[#344054] data-active:text-[#175cd3] after:bg-[#175cd3] group-data-horizontal/tabs:after:bottom-0"
              >
                {TAB_LABEL[item.key]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex flex-col gap-3 p-4">
          <div className="grid min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
            <label className="relative min-w-0">
              <span className="sr-only">Pesquisar por nome, GLPI ou identificador do projeto</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#98a2b3]" aria-hidden="true" />
              <Input
                value={filters.query}
                onChange={(event) => updateFilters({ query: event.target.value })}
                placeholder="Pesquisar por nome, GLPI ou identificador..."
                className="h-9 rounded-lg border-[#d7dce3] bg-white pl-9 text-[13px]"
              />
            </label>
            {view === "concluded" ? null : (
              <FilterSelect
                label="Situação"
                value={filters.status}
                onChange={(status) => updateFilters({ status: status as ProjectStatus | "" })}
                options={options.statuses.map((status) => ({ value: status, label: projectStatusLabel(status) }))}
              />
            )}
            {options.suppliers.length > 0 ? (
              <FilterSelect
                label="Fornecedor"
                value={filters.supplier}
                onChange={(supplier) => updateFilters({ supplier })}
                options={options.suppliers.map((name) => ({ value: name, label: name }))}
              />
            ) : null}
            {options.owners.length > 0 ? (
              <FilterSelect
                label="Responsável"
                value={filters.owner}
                onChange={(owner) => updateFilters({ owner })}
                options={options.owners.map((name) => ({ value: name, label: name }))}
              />
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-3 text-[11px] text-[#667085]">
            <span className="flex items-center gap-1.5" aria-live="polite">
              <List className="size-3.5" aria-hidden="true" />
              {visible.length === 1 ? "1 projeto encontrado" : `${visible.length} projetos encontrados`} · {currentView.label}
            </span>
            {filtering ? (
              <button type="button" onClick={() => updateFilters(idlePortfolioFilters)} className="rounded-sm font-medium text-[#175cd3] hover:underline focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none">
                Limpar filtros
              </button>
            ) : null}
          </div>
        </div>

        {projects.length === 0 || visible.length === 0 ? (
          <div className="px-4 pb-4">
            <ProjectEmpty
              title={projects.length === 0 ? "Nenhum projeto disponível" : "Nenhum projeto encontrado"}
              description={
                projects.length === 0
                  ? "A consulta não retornou projetos para o seu acesso."
                  : `A pesquisa e os filtros não encontraram projetos em ${currentView.label}.`
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
          <div className="w-full min-w-0 overflow-x-auto border-t border-[#edf0f3]">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-[10px] font-semibold tracking-[0.06em] text-[#667085] uppercase">
                <tr className="border-b border-[#edf0f3]">
                  <SortHeader label="Nome do projeto" sortKey="name" sort={sort} onSort={toggleSort} className="pl-4" />
                  <th scope="col" className="hidden px-3 py-3 xl:table-cell">Fornecedor</th>
                  <th scope="col" className="px-3 py-3">Situação</th>
                  <th scope="col" className="px-3 py-3">Andamento</th>
                  <th scope="col" className="hidden px-3 py-3 md:table-cell">Próxima entrega</th>
                  <SortHeader label="Prazo vigente" sortKey="deadline" sort={sort} onSort={toggleSort} />
                  <SortHeader label="Atualização" sortKey="updated" sort={sort} onSort={toggleSort} className="hidden xl:table-cell" />
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
          <nav aria-label="Paginação dos projetos" className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0f3] px-4 py-3 text-[11px] text-[#667085]">
            <span>
              Exibindo {firstShown}–{firstShown + paged.items.length - 1} de {visible.length} {visible.length === 1 ? "projeto" : "projetos"}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="w-32">
                <OptionCombobox
                  label="Projetos por página"
                  value={String(pageSize)}
                  onChange={(next) => {
                    setPageSize(Number(next) || 10);
                    setPage(1);
                  }}
                  options={PAGE_SIZES.map((size) => ({ value: size, label: `${size} por página` }))}
                  compact
                  className="h-8 rounded-lg border-[#d7dce3] bg-white [&_input]:text-[11px]"
                />
              </div>
              <Button type="button" variant="outline" className="h-8 rounded-lg px-3 text-[11px]" disabled={paged.current === 1} onClick={() => setPage(paged.current - 1)}>
                Anterior
              </Button>
              {Array.from({ length: paged.pages }, (_, index) => index + 1).map((number) => (
                <button
                  key={number}
                  type="button"
                  aria-label={`Página ${number}`}
                  aria-current={number === paged.current ? "page" : undefined}
                  onClick={() => setPage(number)}
                  className={cn(
                    "size-8 rounded-lg text-[11px] font-medium focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none",
                    number === paged.current ? "bg-[#e9f2ff] text-[#175cd3]" : "text-[#667085] hover:bg-[#f2f4f7]",
                  )}
                >
                  {number}
                </button>
              ))}
              <Button type="button" variant="outline" className="h-8 rounded-lg px-3 text-[11px]" disabled={paged.current === paged.pages} onClick={() => setPage(paged.current + 1)}>
                Próxima
              </Button>
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
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
  const delayDays = project.situation?.delayDays ?? 0;
  const attention = project.status === "EM_ATENCAO" || project.status === "CRITICO";

  return (
    <tr
      onClick={handleClick}
      style={attention && project.status ? { boxShadow: `inset 3px 0 0 ${STATUS_COLOR[project.status]}` } : undefined}
      className={cn(
        "cursor-pointer border-b border-[#edf0f3] align-top text-[12px] transition-colors duration-200 last:border-b-0 hover:bg-[#f8fbff] motion-reduce:transition-none",
        opening && "bg-[#f5f9ff]",
      )}
    >
      <td className="max-w-[18rem] py-3.5 pr-3 pl-4">
        <Link href={`/projetos/${project.id}`} className="text-[13px] font-semibold text-[#172033] hover:text-primary focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none">
          {project.name}
        </Link>
        <span className="mt-1 flex items-center gap-1.5 text-[11px] text-[#98a2b3]">
          {opening ? <Spinner className="size-3" /> : null}
          {project.glpiTicketId ? `GLPI #${project.glpiTicketId}` : `ID ${project.id.slice(0, 8)}`}
          {attention ? <span className="sr-only">Exige atenção.</span> : null}
        </span>
      </td>
      <td className="hidden px-3 py-3.5 xl:table-cell">
        <Muted value={project.suppliers === null ? null : project.suppliers.join(", ") || "Não informado"} />
      </td>
      <td className="px-3 py-3.5">
        {project.status === null || project.situation === null ? (
          <Muted value={null} />
        ) : (
          <span className="flex flex-col items-start gap-1">
            <EapStatusBadge
              kind={projectStatusKind(project.status)}
              label={projectStatusLabel(project.status)}
              title={`Situação calculada pela EAP. Situação registrada no cadastro: ${projectStatusLabel(project.registeredStatus)}.`}
              className={cn("px-2 py-[3px] text-[10px] whitespace-nowrap", project.status === "SUSPENSO" && "bg-[#f2f4f7] text-[#667085]")}
            />
            {attention && delayDays > 0 ? (
              <span className={cn("flex items-center gap-1.5 text-[11px] font-medium", project.status === "CRITICO" ? "text-destructive" : "text-[#b4570f]")}>
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                {delayDays === 1 ? "1 dia de atraso" : `${delayDays} dias de atraso`}
              </span>
            ) : null}
            {project.situation.readyForClosure ? (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#157454]" title="Todas as fases concluídas; o encerramento depende de decisão formal">
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                Apto para encerramento
              </span>
            ) : null}
            {project.situation.closureRequirementsMissing ? (
              <span className="text-[11px] text-[#98a2b3]" title="Encerramento registrado, mas há fases não concluídas">Encerramento pendente</span>
            ) : null}
          </span>
        )}
      </td>
      <td className="min-w-[8.5rem] px-3 py-3.5">
        {!project.progressAvailable ? (
          <Muted value={null} />
        ) : project.eapEmpty ? (
          <span className="text-[11px] text-[#98a2b3]">EAP sem itens cadastrados</span>
        ) : project.progressBasisPoints === null ? (
          <span className="text-[11px] text-[#98a2b3]" title="Sem fases com andamento calculável">Sem andamento</span>
        ) : (
          <span className="flex items-center gap-2.5">
            <Progress
              value={basisToPercent(project.progressBasisPoints)}
              aria-label={`Andamento de ${project.name}`}
              className="w-20 [&_[data-slot=progress-indicator]]:bg-[#2873cf] [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-[#e9eef5]"
            />
            <span className="text-[11px] font-semibold text-[#344054] tabular-nums">{formatBasis(project.progressBasisPoints)}%</span>
          </span>
        )}
      </td>
      <td className="hidden px-3 py-3.5 md:table-cell">
        <NextDeliveryCell project={project} />
      </td>
      <td className="px-3 py-3.5 whitespace-nowrap text-[#344054]">
        {project.plannedStartAt || project.plannedEndAt ? (
          <span className="flex flex-col">
            <span>{project.plannedStartAt ? dateText(project.plannedStartAt) : "—"}</span>
            <span>{project.plannedEndAt ? dateText(project.plannedEndAt) : "—"}</span>
          </span>
        ) : (
          <span className="text-[11px] text-[#98a2b3]">Não definido</span>
        )}
      </td>
      <td className="hidden px-3 py-3.5 whitespace-nowrap text-[#667085] xl:table-cell">{dateText(project.updatedAt)}</td>
      <td className="px-3 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button type="button" variant="ghost" size="icon-sm" className="text-[#98a2b3] hover:bg-[#f2f4f7] hover:text-[#344054]" aria-label={`Ações de ${project.name}`} />}
          >
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-lg p-1.5">
            <DropdownMenuItem className={menuItem} onClick={() => onOpen()}>
              Abrir visão geral
            </DropdownMenuItem>
            <DropdownMenuItem className={menuItem} onClick={() => onOpen("cronograma")}>
              Consultar cronograma
            </DropdownMenuItem>
            <DropdownMenuItem className={menuItem} onClick={() => onOpen("eap")}>
              Abrir EAP
            </DropdownMenuItem>
            {canEdit ? (
              <DropdownMenuItem className={menuItem} onClick={() => setEditing(true)}>
                Editar projeto
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuItem
              disabled
              className={menuItem}
              title="O arquivamento depende de alteração no banco (campo de arquivamento), ainda não autorizada."
            >
              Arquivar
              <span className="ml-auto text-[10px] text-[#98a2b3]">Em breve</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {canEdit ? <ProjectEditDialog project={project} open={editing} onOpenChange={setEditing} /> : null}
      </td>
    </tr>
  );
}

/**
 * Próxima entrega: projeto suspenso; marco a entregar (com correções necessárias, quando devolvido);
 * marco já entregue aguardando homologação; ou nenhuma entrega pendente.
 */
function NextDeliveryCell({ project }: { project: ProjectListRow }) {
  if (!project.nextDeliveryAvailable) {
    return <Muted value={null} />;
  }
  if (project.status === "SUSPENSO") {
    return <DeliveryLine icon={<Info />} tone="bg-[#eef4ff] text-[#2865b9]" title="Projeto suspenso" detail="Execução paralisada" />;
  }
  const next = project.nextDelivery;
  const awaiting = project.awaitingValidation;
  if (next) {
    const date = `${dateText(next.plannedAt)}${next.overdue ? " · Atrasada" : ""}`;
    return (
      <span className="flex flex-col gap-1.5">
        <DeliveryLine
          icon={next.corrections ? <AlertTriangle /> : <ClipboardCheck />}
          tone={next.corrections ? "bg-warning/20 text-warning-foreground" : "bg-[#f4ecfb] text-[#7450bf]"}
          title={next.corrections ? "Correções necessárias" : next.title}
          detail={next.corrections ? `${next.title} · ${date}` : date}
          danger={next.overdue}
        />
        {awaiting ? <span className="pl-8 text-[11px] text-[#7450bf]">Também há marco entregue aguardando homologação</span> : null}
      </span>
    );
  }
  if (awaiting) {
    return (
      <DeliveryLine
        icon={<ClipboardCheck />}
        tone="bg-[#f4ecfb] text-[#7450bf]"
        title="Marco entregue"
        titleClass="text-[#7450bf]"
        detail={`Aguardando homologação · ${awaiting.title} · ${dateText(awaiting.plannedAt)}`}
      />
    );
  }
  return <DeliveryLine icon={<Hourglass />} tone="bg-[#f2f4f7] text-[#667085]" title="Sem entregas pendentes" muted />;
}

function DeliveryLine({
  icon,
  tone,
  title,
  detail,
  danger = false,
  muted = false,
  titleClass,
}: {
  icon: ReactNode;
  tone: string;
  title: string;
  detail?: string;
  danger?: boolean;
  muted?: boolean;
  titleClass?: string;
}) {
  return (
    <span className="flex max-w-[15rem] items-start gap-2">
      <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5", tone)} aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate", muted ? "text-[11px] text-[#98a2b3]" : "text-[12px] text-[#344054]", titleClass)} title={title}>
          {title}
        </span>
        {detail ? (
          <span className={cn("block text-[11px]", danger ? "font-medium text-destructive" : "text-[#98a2b3]")}>{detail}</span>
        ) : null}
      </span>
    </span>
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
    <th scope="col" aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className={cn("px-3 py-3", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm uppercase hover:text-[#172033] focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none",
          active && "text-[#175cd3]",
        )}
      >
        {label}
        <Icon className={cn("size-3", active ? "text-[#175cd3]" : "opacity-60")} aria-hidden="true" />
      </button>
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
      className="h-9 rounded-lg border-[#d7dce3] bg-white [&_input]:text-[13px]"
    />
  );
}

function Muted({ value }: { value: string | null }) {
  return value === null ? (
    <span className="text-[11px] text-[#98a2b3]" title="Não foi possível consultar este dado">Indisponível</span>
  ) : (
    <span className="text-[12px] text-[#344054]">{value}</span>
  );
}

function dateText(value: string) {
  return formatCivilDate(civilDateInput(value));
}

export function ProjectListError({ message }: { message: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[90rem] min-w-0 flex-col gap-5">
      <header>
        <span className="block text-[10px] font-bold tracking-[0.14em] text-[#2865b9] uppercase">Portfólio institucional</span>
        <h1 className="mt-1.5 text-2xl font-medium tracking-tight text-[#172033]">Todos os Projetos</h1>
        <p className="mt-1 text-[13px] text-[#667085]">Acompanhe o portfólio institucional de projetos da CTIN.</p>
      </header>
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
