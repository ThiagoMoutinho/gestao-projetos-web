import type { ListProjects200DataItemStatus } from "@/lib/api/generated/model/listProjects200DataItemStatus";

export type ProjectStatus = ListProjects200DataItemStatus;

/** Situação calculada pela API a partir da EAP (regras aprovadas), com os detalhes exibidos na tela. */
export type ProjectSituation = {
  status: ProjectStatus;
  delayDays: number;
  pendingValidation: number;
  closureRequirementsMissing: boolean;
  /** Todas as fases concluídas sem encerramento formal (sinal da API; não é uma situação). */
  readyForClosure: boolean;
};

/** Próxima entrega: o marco ainda a entregar com a data prevista mais próxima; `corrections` quando foi devolvido. */
export type NextDelivery = { title: string; plannedAt: string; overdue: boolean; corrections: boolean };

/** Marco já entregue que aguarda a validação do gestor (não é atraso do fornecedor). */
export type AwaitingValidation = { title: string; plannedAt: string };

/**
 * Linha do portfólio. `null` significa que o dado não pôde ser consultado (exibido como
 * "Indisponível"); listas vazias significam que a consulta funcionou e não há registros.
 */
export type ProjectListRow = {
  id: string;
  name: string;
  description: string | null;
  glpiTicketId: string | null;
  /** Situação calculada pela EAP; null quando não pôde ser consultada. É a usada em selos, filtros e indicadores. */
  status: ProjectStatus | null;
  situation: ProjectSituation | null;
  /** Situação gravada no cadastro do projeto, preservada como histórico. */
  registeredStatus: ProjectStatus;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  updatedAt: string;
  ownerId: string;
  ownerName: string | null;
  managers: string[] | null;
  suppliers: string[] | null;
  /** Andamento consolidado pela regra da API (média das fases com valor), em pontos-base. */
  progressBasisPoints: number | null;
  progressAvailable: boolean;
  /** A EAP foi consultada e não tem fases (logo, nem tarefas nem marcos). */
  eapEmpty: boolean;
  nextDelivery: NextDelivery | null;
  awaitingValidation: AwaitingValidation | null;
  nextDeliveryAvailable: boolean;
  /** Vínculo de quem consulta com o projeto (vem da lista da API), para liberar ações. */
  viewerIsOwner: boolean;
  viewerRoles: string[];
};

/** Edição do cadastro (mesma regra da API): PMO, coordenação, ADMIN, dono ou gestão do projeto. */
export function canEditProject(globalRole: string, row: Pick<ProjectListRow, "viewerIsOwner" | "viewerRoles">) {
  if (globalRole === "ADMIN" || globalRole === "PMO" || globalRole === "COORDENADOR") {
    return true;
  }
  return row.viewerIsOwner || row.viewerRoles.some((role) => role === "DONO_PROJETO" || role === "GESTOR");
}

/**
 * Visualizações da lista. O arquivamento é uma condição separada da situação, mas o backend ainda não
 * tem esse dado: a visualização de arquivados fica indisponível e nenhum projeto é tratado como arquivado.
 */
export type PortfolioView = "active" | "concluded" | "archived" | "all";

export const PORTFOLIO_VIEWS: ReadonlyArray<{ key: PortfolioView; label: string; description: string; available: boolean }> = [
  { key: "active", label: "Projetos Ativos", description: "Exibe projetos não concluídos e não arquivados.", available: true },
  { key: "concluded", label: "Projetos Concluídos", description: "Exibe projetos formalmente concluídos e não arquivados.", available: true },
  {
    key: "archived",
    label: "Projetos Arquivados",
    description: "Indisponível: o cadastro de projetos ainda não registra o arquivamento.",
    available: false,
  },
  { key: "all", label: "Todos os Projetos", description: "Exibe todos os projetos acessíveis, de qualquer situação.", available: true },
];

/** Projeto na visualização: ativos são os não concluídos formalmente (sem situação calculada também entram). */
export function matchesView(row: Pick<ProjectListRow, "status">, view: PortfolioView) {
  if (view === "all") {
    return true;
  }
  if (view === "archived") {
    return false;
  }
  return view === "concluded" ? row.status === "CONCLUIDO" : row.status !== "CONCLUIDO";
}

export type PortfolioFilters = { query: string; status: ProjectStatus | ""; supplier: string; owner: string };

export const idlePortfolioFilters: PortfolioFilters = { query: "", status: "", supplier: "", owner: "" };

export type PortfolioSort = { key: "name" | "deadline" | "updated"; direction: "asc" | "desc" };

/** Indicadores pela situação calculada de cada projeto acessível (a lista já vem filtrada pela API). */
export const INDICATORS: ReadonlyArray<{ key: "total" | ProjectStatus; label: string }> = [
  { key: "total", label: "Projetos acessíveis" },
  { key: "EM_EXECUCAO", label: "Em execução" },
  { key: "EM_ATENCAO", label: "Em atenção" },
  { key: "CRITICO", label: "Críticos" },
  { key: "EM_VALIDACAO", label: "Em validação" },
  { key: "CONCLUIDO", label: "Concluídos" },
];

export function portfolioIndicators(rows: ReadonlyArray<Pick<ProjectListRow, "status">>) {
  const counts: Record<string, number> = { total: rows.length };
  for (const row of rows) {
    if (row.status) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
  }
  return INDICATORS.map((indicator) => ({ ...indicator, value: counts[indicator.key] ?? 0 }));
}

/** Projetos cuja situação não pôde ser calculada: os indicadores por situação não os incluem. */
export function unavailableSituations(rows: ReadonlyArray<Pick<ProjectListRow, "status">>) {
  return rows.filter((row) => row.status === null).length;
}

function plain(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Pesquisa por nome, chamado GLPI ou identificador, combinada com os filtros selecionados. */
export function filterPortfolio(rows: ReadonlyArray<ProjectListRow>, filters: PortfolioFilters, view: PortfolioView = "all") {
  const query = plain(filters.query);
  return rows.filter((row) => {
    if (!matchesView(row, view)) {
      return false;
    }
    const matchesQuery =
      query === "" ||
      plain(row.name).includes(query) ||
      (row.glpiTicketId !== null && plain(row.glpiTicketId).includes(query.replace(/^#/, ""))) ||
      row.id.toLowerCase().startsWith(query);
    return (
      matchesQuery &&
      (filters.status === "" || row.status === filters.status) &&
      (filters.supplier === "" || (row.suppliers ?? []).includes(filters.supplier)) &&
      (filters.owner === "" || row.ownerName === filters.owner)
    );
  });
}

export function isFiltering(filters: PortfolioFilters) {
  return filters.query.trim() !== "" || filters.status !== "" || filters.supplier !== "" || filters.owner !== "";
}

/** Opções reais dos filtros: só aparecem valores presentes nos projetos acessíveis. */
export function filterOptions(rows: ReadonlyArray<ProjectListRow>) {
  const sorted = (values: Iterable<string>) => [...new Set(values)].sort((left, right) => left.localeCompare(right, "pt-BR"));
  return {
    statuses: [...new Set(rows.flatMap((row) => (row.status ? [row.status] : [])))],
    suppliers: sorted(rows.flatMap((row) => row.suppliers ?? [])),
    owners: sorted(rows.flatMap((row) => (row.ownerName ? [row.ownerName] : []))),
  };
}

/** Ordena por nome, prazo vigente ou última atualização; projetos sem prazo ficam por último. */
export function sortPortfolio(rows: ReadonlyArray<ProjectListRow>, sort: PortfolioSort) {
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    if (sort.key === "deadline") {
      if (!left.plannedEndAt || !right.plannedEndAt) {
        return left.plannedEndAt ? -1 : right.plannedEndAt ? 1 : left.name.localeCompare(right.name, "pt-BR");
      }
      return factor * left.plannedEndAt.localeCompare(right.plannedEndAt) || left.name.localeCompare(right.name, "pt-BR");
    }
    if (sort.key === "updated") {
      return factor * left.updatedAt.localeCompare(right.updatedAt);
    }
    return factor * left.name.localeCompare(right.name, "pt-BR");
  });
}

type MonitoredMilestone = { entityType: string; title: string; status: string; plannedEndAt: string | null; overdue: boolean };

function earliestMilestone<T extends MonitoredMilestone>(items: ReadonlyArray<T>, accept: (status: string) => boolean) {
  return items
    .filter((item) => item.entityType === "MILESTONE" && accept(item.status) && item.plannedEndAt)
    .sort((left, right) => (left.plannedEndAt as string).localeCompare(right.plannedEndAt as string))[0];
}

/**
 * Próxima entrega a partir dos itens do monitoramento de prazos: marcos ainda a entregar (pendentes ou
 * devolvidos). Marco já entregue aguarda validação e aparece à parte, como homologação pendente.
 */
export function nextDeliveryFrom(items: ReadonlyArray<MonitoredMilestone>): NextDelivery | null {
  const next = earliestMilestone(items, (status) => status !== "APROVADO" && status !== "ENTREGUE");
  return next
    ? {
        title: next.title,
        plannedAt: next.plannedEndAt as string,
        overdue: next.overdue,
        corrections: next.status === "REJEITADO" || next.status === "AJUSTES_SOLICITADOS",
      }
    : null;
}

/** Marco entregue mais antigo ainda aguardando validação. */
export function awaitingValidationFrom(items: ReadonlyArray<MonitoredMilestone>): AwaitingValidation | null {
  const awaiting = earliestMilestone(items, (status) => status === "ENTREGUE");
  return awaiting ? { title: awaiting.title, plannedAt: awaiting.plannedEndAt as string } : null;
}

export function paginate<T>(rows: ReadonlyArray<T>, page: number, size: number) {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, page), pages);
  return { pages, current, items: rows.slice((current - 1) * size, current * size) };
}
