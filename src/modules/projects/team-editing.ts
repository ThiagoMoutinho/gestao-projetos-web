/**
 * Edição do cartão Equipe: rascunho do formulário e tradução para as operações da API de participantes
 * (adicionar, alterar função, remover). Funções puras, sem React; a autorização fica no backend.
 */

export const TEAM_ROLES = ["GESTOR", "PATROCINADOR", "RESPONSAVEL_TECNICO", "FORNECEDOR", "PO", "DESENVOLVEDOR", "OBSERVADOR"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** Papéis com um responsável principal no cartão (o primeiro participante de cada um). */
export const KEY_ROLES = ["GESTOR", "PATROCINADOR", "RESPONSAVEL_TECNICO", "FORNECEDOR"] as const;
export type KeyRole = (typeof KEY_ROLES)[number];

/** A função de dono do projeto é protegida pela API (muda só por transferência de titularidade). */
export const OWNER_ROLE = "DONO_PROJETO";

export type TeamMember = { id: string; userId: string; role: string; /** Função do catálogo (só junto do acesso Observador). */ functionId?: string | null };

export type DraftRow = { rowId: string; memberId: string | null; userId: string; role: TeamRole; functionId: string | null };

export type TeamDraft = {
  /** userId escolhido para cada responsável principal; "" = não definido. */
  key: Record<KeyRole, string>;
  /** Demais participantes (inclui gestores ou fornecedores adicionais). */
  others: DraftRow[];
};

export type TeamOperation =
  | { type: "remove"; memberId: string; userId: string; role: string }
  | { type: "update"; memberId: string; userId: string; from: string; role: TeamRole; functionId: string | null }
  | { type: "add"; userId: string; role: TeamRole; functionId: string | null };

function isTeamRole(role: string): role is TeamRole {
  return (TEAM_ROLES as readonly string[]).includes(role);
}

function isKeyRole(role: string): role is KeyRole {
  return (KEY_ROLES as readonly string[]).includes(role);
}

/** Responsável principal de cada papel: o primeiro participante com essa função (mesma regra do cartão). */
export function principalMembers(members: ReadonlyArray<TeamMember>) {
  const principal = {} as Record<KeyRole, TeamMember | undefined>;
  for (const role of KEY_ROLES) {
    principal[role] = members.find((member) => member.role === role);
  }
  return principal;
}

export function draftFromMembers(members: ReadonlyArray<TeamMember>): TeamDraft {
  const principal = principalMembers(members);
  const principalIds = new Set(KEY_ROLES.map((role) => principal[role]?.id).filter(Boolean));
  return {
    key: {
      GESTOR: principal.GESTOR?.userId ?? "",
      PATROCINADOR: principal.PATROCINADOR?.userId ?? "",
      RESPONSAVEL_TECNICO: principal.RESPONSAVEL_TECNICO?.userId ?? "",
      FORNECEDOR: principal.FORNECEDOR?.userId ?? "",
    },
    others: members
      .filter((member) => member.role !== OWNER_ROLE && !principalIds.has(member.id) && isTeamRole(member.role))
      .map((member) => ({ rowId: member.id, memberId: member.id, userId: member.userId, role: member.role as TeamRole, functionId: member.functionId ?? null })),
  };
}

/** Problemas que impedem salvar: linha sem pessoa e a mesma pessoa duas vezes na mesma função. */
export function teamProblems(draft: TeamDraft, names: (userId: string) => string = (id) => id): string[] {
  const problems: string[] = [];
  if (draft.others.some((row) => !row.userId)) {
    problems.push("Escolha a pessoa de cada participante adicionado ou remova a linha vazia.");
  }
  const seen = new Set<string>();
  const entries = [
    ...KEY_ROLES.filter((role) => draft.key[role]).map((role) => ({ userId: draft.key[role], role: role as string })),
    ...draft.others.filter((row) => row.userId).map((row) => ({ userId: row.userId, role: row.role as string })),
  ];
  for (const entry of entries) {
    const id = `${entry.userId}|${entry.role}`;
    if (seen.has(id)) {
      problems.push(`${names(entry.userId)} aparece mais de uma vez como ${ROLE_TEXT[entry.role as TeamRole] ?? entry.role}.`);
    }
    seen.add(id);
  }
  return [...new Set(problems)];
}

/** Rótulos dos papéis fixos do seletor de função. */
export const ROLE_TEXT: Record<TeamRole, string> = {
  GESTOR: "Gestor",
  PATROCINADOR: "Patrocinador",
  RESPONSAVEL_TECNICO: "Responsável técnico",
  FORNECEDOR: "Fornecedor",
  PO: "PO",
  DESENVOLVEDOR: "Desenvolvedor",
  OBSERVADOR: "Observador",
};

/**
 * Operações necessárias para sair do estado atual e chegar ao rascunho, na ordem segura para a API:
 * remoções, depois alterações de função e por fim inclusões (evita conflito de duplicidade no meio do caminho).
 */
export function teamOperations(members: ReadonlyArray<TeamMember>, draft: TeamDraft): TeamOperation[] {
  const removes: TeamOperation[] = [];
  const updates: TeamOperation[] = [];
  const adds: TeamOperation[] = [];
  const principal = principalMembers(members);

  for (const role of KEY_ROLES) {
    const current = principal[role];
    const chosen = draft.key[role];
    if (current && current.userId === chosen) continue;
    if (current) removes.push({ type: "remove", memberId: current.id, userId: current.userId, role });
    if (chosen) adds.push({ type: "add", userId: chosen, role, functionId: null });
  }

  const before = draftFromMembers(members).others;
  const kept = new Map(draft.others.filter((row) => row.memberId).map((row) => [row.memberId as string, row]));
  for (const row of before) {
    const next = kept.get(row.memberId as string);
    if (!next) {
      removes.push({ type: "remove", memberId: row.memberId as string, userId: row.userId, role: row.role });
    } else if (next.role !== row.role || next.functionId !== row.functionId) {
      updates.push({ type: "update", memberId: row.memberId as string, userId: row.userId, from: row.role, role: next.role, functionId: next.functionId });
    }
  }
  for (const row of draft.others) {
    if (!row.memberId && row.userId) adds.push({ type: "add", userId: row.userId, role: row.role, functionId: row.functionId });
  }

  return [...removes, ...updates, ...adds];
}

export function isKeyRoleValue(role: string): role is KeyRole {
  return isKeyRole(role);
}

/** Prefixo do valor do seletor para uma função do catálogo (as demais opções usam o próprio papel de acesso). */
export const FUNCTION_PREFIX = "FN:";

/** Valor do seletor da linha: a função do catálogo, quando houver; senão o papel de acesso. */
export function choiceOf(row: { role: TeamRole; functionId: string | null }): string {
  return row.functionId ? `${FUNCTION_PREFIX}${row.functionId}` : row.role;
}

/** Traduz a escolha do seletor: função do catálogo = acesso Observador + a função (só rótulo, sem permissões extras). */
export function applyChoice(value: string): { role: TeamRole; functionId: string | null } | null {
  if (value.startsWith(FUNCTION_PREFIX)) {
    const functionId = value.slice(FUNCTION_PREFIX.length);
    return functionId ? { role: "OBSERVADOR", functionId } : null;
  }
  return isTeamRole(value) ? { role: value, functionId: null } : null;
}

/** Quem cria funções do catálogo: ADMIN e PMO (a API é quem de fato barra os demais). */
export function canManageMemberFunctions(globalRole: string): boolean {
  return globalRole === "ADMIN" || globalRole === "PMO";
}

export const MEMBER_FUNCTION_NAME_MIN = 2;
export const MEMBER_FUNCTION_NAME_MAX = 60;

const ACCENTED = "áàâãäåéèêëíìîïóòôõöúùûüçñ";
const PLAIN = "aaaaaaeeeeiiiiooooouuuucn";

/** Mesma chave da API: minúsculas, sem acento nem pontuação e sem espaços repetidos ("Gestão" = "gestao"). */
export function functionNameKey(name: string): string {
  let out = "";
  for (const char of name.replace(/\s+/g, " ").trim().toLowerCase()) {
    const index = ACCENTED.indexOf(char);
    out += index >= 0 ? PLAIN[index] : char;
  }
  return out.replace(/[^a-z0-9]+/g, " ").trim();
}

/** Problema do nome digitado (ou null): vazio, curto, longo ou sem letras/números. */
export function memberFunctionNameProblem(name: string): string | null {
  const clean = name.replace(/\s+/g, " ").trim();
  if (clean.length < MEMBER_FUNCTION_NAME_MIN) return `Informe o nome da função (mínimo ${MEMBER_FUNCTION_NAME_MIN} caracteres).`;
  if (clean.length > MEMBER_FUNCTION_NAME_MAX) return `Use no máximo ${MEMBER_FUNCTION_NAME_MAX} caracteres.`;
  if (functionNameKey(clean).length < MEMBER_FUNCTION_NAME_MIN) return "Use letras ou números no nome.";
  return null;
}

/** Nomes dos papéis fixos da lista (iguais aos rótulos do seletor): uma função do catálogo não pode repetir nenhum. */
const RESERVED_ROLE_NAMES = ["Dono do projeto", "Gestor", "Patrocinador", "PO", "Responsável técnico", "Desenvolvedor", "Fornecedor", "Observador"] as const;

/** Conflito do nome com o que já existe: "role" (papel fixo), "function" (função do catálogo) ou null. Ignora caixa, acento e espaços. */
export function functionNameConflict(name: string, existing: ReadonlyArray<{ name: string }>): "role" | "function" | null {
  const key = functionNameKey(name);
  if (key.length === 0) return null;
  if (RESERVED_ROLE_NAMES.some((role) => functionNameKey(role) === key)) return "role";
  return existing.some((entry) => functionNameKey(entry.name) === key) ? "function" : null;
}

/** A função já existe (como papel fixo ou no catálogo)? */
export function duplicateFunctionName(name: string, existing: ReadonlyArray<{ name: string }>): boolean {
  return functionNameConflict(name, existing) !== null;
}
