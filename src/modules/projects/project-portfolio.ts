import type { ListProjects200DataItemStatus } from "@/lib/api/generated/model/listProjects200DataItemStatus";

export type ProjectStatus = ListProjects200DataItemStatus;

/** Situação calculada pela API a partir da EAP (regras aprovadas), com os detalhes exibidos na tela. */
export type ProjectSituation = {
  status: ProjectStatus;
  delayDays: number;
  /** Itens executáveis em atraso (tarefas/marcos), pela regra única da API. */
  delayedItems: number;
  pendingValidation: number;
  closureRequirementsMissing: boolean;
  /** Todas as fases concluídas sem encerramento formal (sinal da API; não é uma situação). */
  readyForClosure: boolean;
};

/** Participante do projeto: uma pessoa com um ou mais papéis. */
export type TeamMember = { id: string; name: string; roles: string[] };

export const TEAM_ROLE_LABEL: Record<string, string> = {
  DONO_PROJETO: "Dono do projeto",
  GESTOR: "Gestor",
  PO: "PO",
  RESPONSAVEL_TECNICO: "Responsável técnico",
  DESENVOLVEDOR: "Desenvolvedor",
  FORNECEDOR: "Fornecedor",
  OBSERVADOR: "Observador",
};

const TEAM_ROLE_ORDER = Object.keys(TEAM_ROLE_LABEL);

/** Agrupa os vínculos por pessoa (papéis na ordem institucional) e ordena a equipe por papel principal e nome. */
export function buildTeam(members: ReadonlyArray<{ userId: string; role: string; name: string }>): TeamMember[] {
  const byUser = new Map<string, TeamMember>();
  for (const member of members) {
    const name = member.name.trim();
    if (!name) {
      continue;
    }
    const current = byUser.get(member.userId) ?? { id: member.userId, name, roles: [] };
    if (!current.roles.includes(member.role)) {
      current.roles.push(member.role);
    }
    byUser.set(member.userId, current);
  }
  const rank = (role: string) => (TEAM_ROLE_ORDER.indexOf(role) === -1 ? TEAM_ROLE_ORDER.length : TEAM_ROLE_ORDER.indexOf(role));
  const people = [...byUser.values()].map((person) => ({ ...person, roles: [...person.roles].sort((a, b) => rank(a) - rank(b)) }));
  return people.sort((a, b) => rank(a.roles[0]) - rank(b.roles[0]) || a.name.localeCompare(b.name, "pt-BR"));
}

/** Índice (0 a total-1) da cor do avatar: hash FNV-1a do ID da pessoa, estável entre projetos e renderizações; não depende de papel. */
export function avatarColorIndex(id: string, total = 8) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % total;
}

/** Até `max` avatares visíveis e a quantidade restante (+N). */
export function teamPreview(team: ReadonlyArray<TeamMember>, max = 3) {
  return { visible: team.slice(0, max), extra: Math.max(0, team.length - max) };
}

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
  /** Última alteração do cadastro do projeto (não é movimentação do acompanhamento). */
  updatedAt: string;
  /**
   * Instante da movimentação relevante mais recente do acompanhamento (situação, conclusão, impedimento, entrega, homologação,
   * reprogramação, definição de planejamento ou troca de responsável). Acessos e visualizações não contam. null = nenhuma
   * movimentação registrada; use `movementAvailable` para saber se a consulta funcionou.
   */
  lastMovementAt: string | null;
  movementAvailable: boolean;
  ownerId: string;
  ownerName: string | null;
  managers: string[] | null;
  /** Todos os participantes vinculados ao projeto (uma entrada por pessoa, com seus papéis); null quando a consulta falhou. */
  team: TeamMember[] | null;
  suppliers: string[] | null;
  /**
   * Empresa do projeto: a "Empresa responsável" da ficha institucional (publicada) ou, sem ela, os fornecedores
   * participantes. Lista vazia = nenhuma vinculada; null = não foi possível consultar.
   */
  companies: string[] | null;
  companySource: CompanySource | null;
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
  /**
   * Sinais dos indicadores do portfólio. `null` = a consulta correspondente falhou (o indicador não inventa valor).
   * Impedimentos vêm do resumo executivo; contagens de atraso por tipo, do monitoramento de prazos.
   */
  activeImpediments: number | null;
  overduePhases: number | null;
  overdueTasks: number | null;
  overdueMilestones: number | null;
};

/** Origem do nome da empresa: ficha institucional (nome cadastrado) ou participantes com papel Fornecedor. */
export type CompanySource = "profile" | "supplier";

/** Mesmo critério de texto útil da ficha (meaningfulText): ao menos duas letras ou dígitos. */
function usefulText(value: string | null | undefined) {
  const text = (value ?? "").trim();
  return text.replace(/[^\p{L}\p{N}]/gu, "").length >= 2 ? text : null;
}

/**
 * Empresa exibida na lista: prioriza o nome institucional cadastrado na ficha (Empresa responsável, versão publicada);
 * sem ele, usa os fornecedores vinculados como participantes. `profile` undefined = a ficha não pôde ser consultada.
 */
export function resolveCompanies(
  profile: string | null | undefined,
  suppliers: string[] | null,
): { companies: string[] | null; companySource: CompanySource | null } {
  const institutional = usefulText(profile);
  if (institutional) {
    return { companies: [institutional], companySource: "profile" };
  }
  if (suppliers && suppliers.length > 0) {
    return { companies: [...suppliers], companySource: "supplier" };
  }
  // Sem nenhuma das duas consultas não dá para afirmar que não há empresa.
  if (suppliers === null && profile === undefined) {
    return { companies: null, companySource: null };
  }
  return { companies: [], companySource: null };
}

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

export type PortfolioFilters = { query: string; status: ProjectStatus | ""; company: string; owner: string };

export const idlePortfolioFilters: PortfolioFilters = { query: "", status: "", company: "", owner: "" };

export type PortfolioSort = { key: "urgency" | "delay" | "progress" | "name" | "deadline" | "updated"; direction: "asc" | "desc" };

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

/** Chips de situação da listagem: Todos + as seis situações do protótipo, com a contagem de cada uma. */
export const STATUS_CHIPS: ReadonlyArray<{ key: "total" | ProjectStatus; label: string }> = [
  { key: "total", label: "Todos" },
  { key: "CRITICO", label: "Crítico" },
  { key: "EM_ATENCAO", label: "Em atenção" },
  { key: "EM_EXECUCAO", label: "Em execução" },
  { key: "EM_VALIDACAO", label: "Em validação" },
  { key: "NAO_INICIADO", label: "Não iniciado" },
  { key: "CONCLUIDO", label: "Concluído" },
];

export function statusChips(rows: ReadonlyArray<Pick<ProjectListRow, "status">>) {
  const counts: Record<string, number> = { total: rows.length };
  for (const row of rows) {
    if (row.status) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
  }
  return STATUS_CHIPS.map((chip) => ({ ...chip, value: counts[chip.key] ?? 0 }));
}

/** Participação (0 a 100, inteiro) de uma situação no portfólio; sem projetos, 0. Calculada, nunca fixa. */
export function statusShare(value: number, total: number): number {
  if (total <= 0 || value <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((value / total) * 100));
}

/** Iniciais do gestor para o avatar (primeira e última palavra do nome). */
export function ownerInitials(name: string | null) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return "?";
  }
  const letters = words.length === 1 ? words[0].slice(0, 2) : `${words[0][0]}${words[words.length - 1][0]}`;
  return letters.toLocaleUpperCase("pt-BR");
}

/** Coluna Atraso: dias de atraso, risco (em atenção sem atraso), no prazo ou indisponível (situação não calculada). */
export function delayCell(row: Pick<ProjectListRow, "status" | "situation">): { kind: "delay" | "risk" | "ontime" | "unavailable"; text: string } {
  if (row.status === null || row.situation === null) {
    return { kind: "unavailable", text: "Indisponível" };
  }
  const days = row.situation.delayDays;
  if (days > 0) {
    return { kind: "delay", text: days === 1 ? "1 dia" : `${days} dias` };
  }
  return row.status === "EM_ATENCAO" ? { kind: "risk", text: "Risco" } : { kind: "ontime", text: "No prazo" };
}

export const SORT_LABEL: Record<PortfolioSort["key"], string> = {
  urgency: "urgência",
  delay: "atraso",
  progress: "progresso",
  name: "nome",
  deadline: "previsão",
  updated: "última atualização",
};

/** Gravidade da situação para a ordenação por urgência (menor = mais urgente); sem situação calculada vai por último. */
const URGENCY_RANK: Record<string, number> = {
  CRITICO: 0,
  EM_ATENCAO: 1,
  EM_EXECUCAO: 2,
  EM_VALIDACAO: 3,
  NAO_INICIADO: 4,
  SUSPENSO: 5,
  CONCLUIDO: 6,
};

function urgencyOf(row: Pick<ProjectListRow, "status" | "situation">) {
  return { delay: row.situation?.delayDays ?? 0, rank: row.status ? (URGENCY_RANK[row.status] ?? 7) : 8 };
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
      (filters.company === "" || (row.companies ?? []).includes(filters.company)) &&
      (filters.owner === "" || (row.managers ?? []).includes(filters.owner))
    );
  });
}

export function isFiltering(filters: PortfolioFilters) {
  return filters.query.trim() !== "" || filters.status !== "" || filters.company !== "" || filters.owner !== "";
}

/** Opções reais dos filtros: só aparecem valores presentes nos projetos acessíveis. */
export function filterOptions(rows: ReadonlyArray<ProjectListRow>) {
  const sorted = (values: Iterable<string>) => [...new Set(values)].sort((left, right) => left.localeCompare(right, "pt-BR"));
  return {
    statuses: [...new Set(rows.flatMap((row) => (row.status ? [row.status] : [])))],
    companies: sorted(rows.flatMap((row) => row.companies ?? [])),
    owners: sorted(rows.flatMap((row) => row.managers ?? [])),
  };
}

/** Ordena por urgência, atraso, progresso, nome, prazo vigente ou última atualização; projetos sem prazo ficam por último. */
export function sortPortfolio(rows: ReadonlyArray<ProjectListRow>, sort: PortfolioSort) {
  const factor = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    if (sort.key === "urgency") {
      // "desc" = mais urgentes primeiro: maior atraso, depois a situação mais grave, depois o nome.
      const a = urgencyOf(left);
      const b = urgencyOf(right);
      const byUrgency = b.delay - a.delay || a.rank - b.rank;
      return (sort.direction === "desc" ? byUrgency : -byUrgency) || left.name.localeCompare(right.name, "pt-BR");
    }
    if (sort.key === "delay") {
      // "desc" = maior atraso primeiro; sem situação calculada vai por último.
      const a = left.situation?.delayDays ?? -1;
      const b = right.situation?.delayDays ?? -1;
      return factor * (a - b) || left.name.localeCompare(right.name, "pt-BR");
    }
    if (sort.key === "progress") {
      // "asc" = menor progresso primeiro; sem andamento calculado vai por último nas duas direções.
      const a = left.progressAvailable ? left.progressBasisPoints : null;
      const b = right.progressAvailable ? right.progressBasisPoints : null;
      if (a === null || b === null) {
        return a !== null ? -1 : b !== null ? 1 : left.name.localeCompare(right.name, "pt-BR");
      }
      return factor * (a - b) || left.name.localeCompare(right.name, "pt-BR");
    }
    if (sort.key === "deadline") {
      if (!left.plannedEndAt || !right.plannedEndAt) {
        return left.plannedEndAt ? -1 : right.plannedEndAt ? 1 : left.name.localeCompare(right.name, "pt-BR");
      }
      return factor * left.plannedEndAt.localeCompare(right.plannedEndAt) || left.name.localeCompare(right.name, "pt-BR");
    }
    if (sort.key === "updated") {
      // Pela última movimentação real; sem movimentação (ou sem consulta) vai por último nas duas direções.
      if (!left.lastMovementAt || !right.lastMovementAt) {
        return left.lastMovementAt ? -1 : right.lastMovementAt ? 1 : left.name.localeCompare(right.name, "pt-BR");
      }
      return factor * left.lastMovementAt.localeCompare(right.lastMovementAt) || left.name.localeCompare(right.name, "pt-BR");
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

/** Marco da próxima entrega: o de menor prazo ainda a entregar (pendente ou devolvido). Critério único da Visão Geral. */
export function nextDeliveryItem<T extends MonitoredMilestone>(items: ReadonlyArray<T>): T | undefined {
  return earliestMilestone(items, (status) => status !== "APROVADO" && status !== "ENTREGUE");
}

/**
 * Próxima entrega a partir dos itens do monitoramento de prazos: marcos ainda a entregar (pendentes ou
 * devolvidos). Marco já entregue aguarda validação e aparece à parte, como homologação pendente.
 */
export function nextDeliveryFrom(items: ReadonlyArray<MonitoredMilestone>): NextDelivery | null {
  const next = nextDeliveryItem(items);
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

/** Marco ainda a entregar (pendente ou devolvido), vindo do monitoramento de prazos. */
export type PortfolioMilestone = {
  id: string;
  title: string;
  status: string;
  /** Data prevista vigente em dia civil (AAAA-MM-DD). */
  plannedOn: string;
  overdue: boolean;
  responsibleName: string | null;
};

/** Sinais do monitoramento de prazos de um projeto, usados nos painéis (contagens calculadas pela API). */
export type ProjectMonitoringSignals = {
  openMilestones: PortfolioMilestone[];
  overdueTasks: number;
  overdueMilestones: number;
  awaitingHomologation: number;
  inCorrections: number;
};

/** Quantidade de projetos em cada visualização (abas), sem considerar busca e filtros. */
export function viewCounts(rows: ReadonlyArray<Pick<ProjectListRow, "status">>): Record<PortfolioView, number> {
  return {
    active: rows.filter((row) => matchesView(row, "active")).length,
    concluded: rows.filter((row) => matchesView(row, "concluded")).length,
    archived: rows.filter((row) => matchesView(row, "archived")).length,
    all: rows.length,
  };
}

/**
 * Dias sem movimentação relevante após os quais o projeto entra em "Precisam de ação" por falta de atualização.
 * Mesmo limiar visual da coluna "Última atualização" da lista.
 */
export const PORTFOLIO_FOLLOW_UP_DAYS = 30;

/** Dia civil local `AAAA-MM-DD` (Belém), para comparar prazos sem inventar fuso. */
function civilToday(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Belem", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : now.toISOString().slice(0, 10);
}

function civilKey(value: string | null | undefined) {
  return value?.slice(0, 10) || null;
}

/** Projeto ativo (não concluído formalmente) com prazo final vigente já ultrapassado. */
export function projectDeadlinePast(row: Pick<ProjectListRow, "status" | "plannedEndAt">, today: string = civilToday()) {
  if (!matchesView(row, "active")) {
    return false;
  }
  const end = civilKey(row.plannedEndAt);
  return end !== null && end < today;
}

/**
 * Em atraso: projeto distinto, ativo, com descumprimento efetivo de prazo (itens abertos vencidos ou prazo final
 * do projeto ultrapassado). Impedimento sozinho não conta. Concluídos ficam de fora.
 */
export function isPortfolioDelayed(
  row: Pick<ProjectListRow, "status" | "situation" | "plannedEndAt" | "overduePhases" | "overdueTasks" | "overdueMilestones">,
  today: string = civilToday(),
) {
  if (!matchesView(row, "active")) {
    return false;
  }
  if ((row.situation?.delayDays ?? 0) > 0) {
    return true;
  }
  if ((row.overduePhases ?? 0) > 0 || (row.overdueTasks ?? 0) > 0 || (row.overdueMilestones ?? 0) > 0) {
    return true;
  }
  return projectDeadlinePast(row, today);
}

/** Sem atualização no período de acompanhamento (só quando a consulta de movimentação respondeu). */
export function isPortfolioStale(
  row: Pick<ProjectListRow, "status" | "lastMovementAt" | "movementAvailable">,
  now: Date = new Date(),
  followUpDays: number = PORTFOLIO_FOLLOW_UP_DAYS,
) {
  if (!matchesView(row, "active") || !row.movementAvailable || row.lastMovementAt === null) {
    return false;
  }
  const days = updatedLabel(row.lastMovementAt, now).days;
  return days !== null && days > followUpDays;
}

/**
 * Precisam de ação: projeto distinto que exige intervenção do PMO (situação crítica/atenção, impedimento ativo,
 * pendência crítica de homologação/encerramento ou falta de atualização). Um projeto com várias condições conta uma vez.
 * Independente de "Em atraso": pode coincidir, mas não é a mesma contagem.
 */
export function isPortfolioNeedsAction(
  row: Pick<
    ProjectListRow,
    "status" | "situation" | "activeImpediments" | "lastMovementAt" | "movementAvailable" | "awaitingValidation" | "nextDelivery"
  >,
  now: Date = new Date(),
) {
  if (!matchesView(row, "active")) {
    return false;
  }
  if (row.status === "CRITICO" || row.status === "EM_ATENCAO") {
    return true;
  }
  if ((row.activeImpediments ?? 0) > 0) {
    return true;
  }
  if ((row.situation?.pendingValidation ?? 0) > 0 || row.situation?.closureRequirementsMissing === true) {
    return true;
  }
  if (row.awaitingValidation !== null || (row.nextDelivery?.corrections ?? false)) {
    return true;
  }
  return isPortfolioStale(row, now);
}

/** Motivos legíveis do indicador "Em atraso" (para a lista filtrada). */
export function portfolioDelayedReasons(
  row: Pick<ProjectListRow, "status" | "situation" | "plannedEndAt" | "overduePhases" | "overdueTasks" | "overdueMilestones">,
  today: string = civilToday(),
) {
  if (!isPortfolioDelayed(row, today)) {
    return [] as string[];
  }
  const reasons: string[] = [];
  const delayDays = row.situation?.delayDays ?? 0;
  if (delayDays > 0) {
    reasons.push(delayDays === 1 ? "1 dia de atraso na execução" : `${delayDays} dias de atraso na execução`);
  }
  if ((row.overdueTasks ?? 0) > 0) {
    reasons.push(row.overdueTasks === 1 ? "1 tarefa vencida" : `${row.overdueTasks} tarefas vencidas`);
  }
  if ((row.overduePhases ?? 0) > 0) {
    reasons.push(row.overduePhases === 1 ? "1 fase vencida" : `${row.overduePhases} fases vencidas`);
  }
  if ((row.overdueMilestones ?? 0) > 0) {
    reasons.push(row.overdueMilestones === 1 ? "1 marco vencido" : `${row.overdueMilestones} marcos vencidos`);
  }
  if (projectDeadlinePast(row, today)) {
    reasons.push("Prazo final do projeto ultrapassado");
  }
  return reasons.length > 0 ? reasons : ["Prazo efetivamente vencido"];
}

/** Motivos legíveis do indicador "Precisam de ação". */
export function portfolioNeedsActionReasons(
  row: Pick<
    ProjectListRow,
    "status" | "situation" | "activeImpediments" | "lastMovementAt" | "movementAvailable" | "awaitingValidation" | "nextDelivery"
  >,
  now: Date = new Date(),
) {
  if (!isPortfolioNeedsAction(row, now)) {
    return [] as string[];
  }
  const reasons: string[] = [];
  if (row.status === "CRITICO") {
    reasons.push("Situação crítica");
  }
  if (row.status === "EM_ATENCAO") {
    reasons.push("Situação em atenção");
  }
  if ((row.activeImpediments ?? 0) > 0) {
    reasons.push(row.activeImpediments === 1 ? "1 impedimento ativo" : `${row.activeImpediments} impedimentos ativos`);
  }
  if ((row.situation?.pendingValidation ?? 0) > 0 || row.awaitingValidation !== null) {
    reasons.push("Homologação pendente");
  }
  if (row.nextDelivery?.corrections) {
    reasons.push("Entrega devolvida para correções");
  }
  if (row.situation?.closureRequirementsMissing) {
    reasons.push("Encerramento sem requisitos completos");
  }
  if (isPortfolioStale(row, now)) {
    reasons.push(`Sem atualização há mais de ${PORTFOLIO_FOLLOW_UP_DAYS} dias`);
  }
  return reasons.length > 0 ? reasons : ["Requer acompanhamento do PMO"];
}

/**
 * Saúde do portfólio: ativos, críticos, precisam de ação e em atraso com critérios independentes,
 * atraso médio só dos atrasados (dias inteiros) e concluídos.
 */
export function portfolioHealth(
  rows: ReadonlyArray<
    Pick<
      ProjectListRow,
      | "status"
      | "situation"
      | "plannedEndAt"
      | "activeImpediments"
      | "overduePhases"
      | "overdueTasks"
      | "overdueMilestones"
      | "lastMovementAt"
      | "movementAvailable"
      | "awaitingValidation"
      | "nextDelivery"
    >
  >,
  now: Date = new Date(),
) {
  const today = civilToday(now);
  const active = rows.filter((row) => matchesView(row, "active"));
  const delayedRows = active.filter((row) => isPortfolioDelayed(row, today));
  const delayDays = delayedRows.map((row) => row.situation?.delayDays ?? 0).filter((days) => days > 0);
  return {
    total: rows.length,
    active: active.length,
    critical: active.filter((row) => row.status === "CRITICO").length,
    needsAction: active.filter((row) => isPortfolioNeedsAction(row, now)).length,
    delayed: delayedRows.length,
    concluded: rows.filter((row) => row.status === "CONCLUIDO").length,
    averageDelay: delayDays.length === 0 ? null : Math.round(delayDays.reduce((sum, days) => sum + days, 0) / delayDays.length),
  };
}

function csvField(value: string) {
  return /[";\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Planilha CSV (separador ";" e BOM, para abrir direto no Excel em português) dos projetos exibidos na lista.
 * `labels` traduz a situação; datas civis vão como AAAA-MM-DD; dados não consultados saem como "Indisponível".
 */
export function portfolioCsv(rows: ReadonlyArray<ProjectListRow>, labels: { status: (status: ProjectStatus) => string; progress: (basisPoints: number) => string }) {
  const header = ["Projeto", "GLPI", "Situação", "Progresso (%)", "Atraso (dias)", "Início previsto", "Término previsto", "Empresa", "Gestor", "Responsável", "Equipe", "Última movimentação"];
  const lines = rows.map((row) => [
    row.name,
    row.glpiTicketId ?? "",
    row.status ? labels.status(row.status) : "Indisponível",
    !row.progressAvailable ? "Indisponível" : row.progressBasisPoints === null ? "" : labels.progress(row.progressBasisPoints),
    row.situation ? String(row.situation.delayDays) : "Indisponível",
    row.plannedStartAt?.slice(0, 10) ?? "",
    row.plannedEndAt?.slice(0, 10) ?? "",
    row.companies === null ? "Indisponível" : row.companies.join(", ") || "Não informada",
    row.managers === null ? "Indisponível" : row.managers.join(", "),
    row.ownerName ?? "",
    row.team === null ? "Indisponível" : row.team.map((person) => person.name).join(", "),
    !row.movementAvailable ? "Indisponível" : (row.lastMovementAt?.slice(0, 10) ?? "Sem movimentação"),
  ]);
  return "\uFEFF" + [header, ...lines].map((line) => line.map(csvField).join(";")).join("\r\n");
}

/**
 * "Última atualização" da lista: rótulo relativo (hoje, ontem, há N dias/semanas/meses) pelo dia civil local, para leitura
 * rápida; a data completa fica no título. Datas futuras (relógios divergentes) contam como hoje.
 */
export function updatedLabel(updatedAt: string, now: Date = new Date()) {
  const updated = new Date(updatedAt);
  if (Number.isNaN(updated.getTime())) {
    return { text: "Indisponível", days: null as number | null };
  }
  const day = (value: Date) => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const days = Math.max(0, Math.round((day(now) - day(updated)) / 86_400_000));
  let text: string;
  if (days === 0) text = "Hoje";
  else if (days === 1) text = "Ontem";
  else if (days < 14) text = `Há ${days} dias`;
  else if (days < 60) text = `Há ${Math.floor(days / 7)} semanas`;
  else if (days < 365) text = `Há ${Math.floor(days / 30)} meses`;
  else text = Math.floor(days / 365) === 1 ? "Há 1 ano" : `Há ${Math.floor(days / 365)} anos`;
  return { text, days };
}

/** Movimentações do resumo executivo (a API já traz só os tipos relevantes e sem acessos), do mais recente ao mais antigo. */
type MovementLike = { at: string; governance: boolean };

/**
 * Instante da movimentação relevante mais recente do acompanhamento. As de governança (edição do cadastro, participantes,
 * ficha institucional e validação do resumo) não contam como andamento do projeto. null = nenhuma movimentação.
 */
export function lastMovementFrom(movements: ReadonlyArray<MovementLike>): string | null {
  let latest: string | null = null;
  for (const movement of movements) {
    if (movement.governance || Number.isNaN(new Date(movement.at).getTime())) continue;
    if (latest === null || new Date(movement.at).getTime() > new Date(latest).getTime()) latest = movement.at;
  }
  return latest;
}

/**
 * Data do prazo vigente exibida na lista: o dia consolidado da EAP (tarefas e marcos, a mesma referência da Visão Geral) volta
 * ao meio-dia de Belém para seguir o formato das demais datas; sem itens com data, vale a data gravada no próprio projeto.
 */
export function currentPlanDate(consolidatedDay: string | null, projectDate: string | null): string | null {
  return consolidatedDay ? `${consolidatedDay}T12:00:00.000-03:00` : projectDate;
}
